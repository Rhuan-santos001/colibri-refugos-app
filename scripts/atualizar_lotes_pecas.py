#!/usr/bin/env python3
r"""
Sistema de Solicitação de Refugos - Importação diária de LOTE / COD ITEM
=================================================
Lê o relatório exportado do sistema (ex: 2707.xls, no formato
"RELATÓRIO DE ORDENS DE PRODUÇÃO COM LOTE" - na verdade é um HTML
salvo com extensão .xls, é normal, o script já lida com isso) e
sincroniza no Supabase:

  - tabela `lotes`      (coluna D do relatório)
  - tabela `pecas`      (coluna H do relatório)
  - tabela `lote_peca`  (o vínculo entre os dois, sem duplicar)

Uso:
    python atualizar_lotes_pecas.py                # usa o arquivo de hoje (ddmm.xls) na pasta atual
    python atualizar_lotes_pecas.py caminho\2707.xls  # usa um arquivo específico
    python atualizar_lotes_pecas.py --dry-run       # só mostra o que faria, não grava no banco
    python atualizar_lotes_pecas.py --pasta "C:\Exports"  # procura o arquivo de hoje nessa pasta

Configuração necessária (arquivo .env na mesma pasta do script,
veja .env.example):
    SUPABASE_URL=https://SEU-PROJETO.supabase.co
    SUPABASE_SERVICE_KEY=chave-service-role-aqui (NÃO é a anon key!)
"""

import argparse
import os
import re
import sys
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------

CHUNK_SIZE = 500  # quantos registros mandar por requisição

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")


def validar_config():
    if not SUPABASE_URL or "SEU-PROJETO" in SUPABASE_URL:
        sys.exit(
            "ERRO: SUPABASE_URL não configurada.\n"
            "Copie .env.example para .env e preencha com os dados do seu projeto."
        )
    if not SUPABASE_SERVICE_KEY or "AQUI" in SUPABASE_SERVICE_KEY:
        sys.exit(
            "ERRO: SUPABASE_SERVICE_KEY não configurada.\n"
            "Copie .env.example para .env e preencha com a chave service_role\n"
            "(Supabase > Project Settings > API > service_role secret).\n"
            "NÃO é a mesma chave 'anon' usada no site."
        )


def headers(prefer=None):
    h = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


# ---------------------------------------------------------------
# Localizar o arquivo do dia
# ---------------------------------------------------------------

def achar_arquivo_do_dia(pasta):
    hoje = datetime.now().strftime("%d%m")
    candidatos = [f"{hoje}.xls", f"{hoje}.xlsx"]
    for nome in candidatos:
        caminho = os.path.join(pasta, nome)
        if os.path.exists(caminho):
            return caminho
    sys.exit(
        f"ERRO: não encontrei nenhum dos arquivos {candidatos} na pasta '{pasta}'.\n"
        f"Exporte o relatório de hoje com esse nome, ou informe o caminho manualmente:\n"
        f"  python atualizar_lotes_pecas.py caminho\\do\\arquivo.xls"
    )


# ---------------------------------------------------------------
# Ler e limpar o relatório
# ---------------------------------------------------------------

def ler_relatorio(caminho):
    print(f"Lendo {caminho} ...")

    if not os.path.exists(caminho):
        sys.exit(f"ERRO: arquivo não encontrado: {caminho}")

    # O arquivo é HTML salvo com extensão .xls (comum em exportações
    # de ERP). Tentamos algumas codificações comuns pra evitar erro
    # de acentuação.
    tabelas = None
    ultimo_erro = None
    for encoding in ("ISO-8859-1", "utf-8", "cp1252"):
        try:
            tabelas = pd.read_html(caminho, encoding=encoding, header=0)
            break
        except Exception as e:
            ultimo_erro = e
            continue

    if tabelas is None:
        print(f"\nDetalhe técnico do erro: {type(ultimo_erro).__name__}: {ultimo_erro}\n")

        # Mostra uma prévia do conteúdo bruto do arquivo, ajuda a ver se
        # ele realmente é o relatório HTML esperado ou se veio diferente
        try:
            with open(caminho, "rb") as f:
                bruto = f.read(600)
            print("Prévia dos primeiros bytes do arquivo (pra diagnóstico):")
            print(bruto)
            print()
        except Exception:
            pass

        if "lxml" in str(ultimo_erro).lower() or "parser" in str(ultimo_erro).lower() or "html5lib" in str(ultimo_erro).lower():
            sys.exit(
                "ERRO: falta uma biblioteca de leitura de HTML (lxml/html5lib).\n"
                "Rode este comando e tente de novo:\n\n"
                "    python -m pip install --upgrade lxml html5lib beautifulsoup4\n"
            )
        sys.exit(
            "ERRO: não consegui ler o arquivo como HTML/Excel ('No tables found').\n"
            "Isso geralmente significa que o arquivo não é o relatório HTML\n"
            "esperado (pode ter vindo vazio, truncado, ou em outro formato\n"
            "desta vez). Veja a prévia acima - se não fizer sentido, me manda\n"
            "o arquivo .xls que eu confiro."
        )

    df = tabelas[0]

    # Preferimos localizar as colunas pelo NOME (mais seguro caso a ordem
    # mude no relatório), com fallback pra posição (D=3, H=7, P=15) se
    # o nome não bater.
    col_lote = col_peca = col_obs = None
    for col in df.columns:
        nome = str(col).strip().upper()
        if nome == "LOTE":
            col_lote = col
        if nome in ("COD ITEM", "CÓD ITEM", "CODITEM"):
            col_peca = col
        if nome.startswith("OBSERVA"):
            col_obs = col

    if col_lote is None or col_peca is None:
        print("AVISO: não achei LOTE/COD ITEM pelo nome, usando posição (D e H).")
        col_lote = df.columns[3]
        col_peca = df.columns[7]
    if col_obs is None:
        print("AVISO: não achei a coluna OBSERVACAO pelo nome, usando posição (P).")
        col_obs = df.columns[15] if len(df.columns) > 15 else None

    total_linhas = len(df)

    # Só entram peças cuja ordem foi "GERADA PELO LOTE" — é o padrão que
    # confirma que aquela peça realmente pertence a esse lote de
    # produção (outras linhas podem ter o mesmo número de LOTE por
    # coincidência/reprocessamento, sem serem parte do lote de verdade).
    PADRAO_OBS = re.compile(r"ORDEM GERADA PELO LOTE\s*(\d+)", re.IGNORECASE)

    if col_obs is None:
        sys.exit("ERRO: não encontrei a coluna OBSERVACAO neste relatório.")

    obs_texto = df[col_obs].astype(str)
    bate_padrao = obs_texto.str.contains("ORDEM GERADA PELO LOTE", case=False, na=False)

    pares = df.loc[bate_padrao, [col_lote, col_peca, col_obs]].copy()
    pares.columns = ["lote", "peca", "obs"]

    # Normalmente a coluna LOTE já vem preenchida nessas linhas. Em
    # alguns casos raros ela vem em branco mas o número real está
    # escrito na própria observação - aproveitamos esse fallback.
    def resolve_lote(row):
        if pd.notna(row["lote"]):
            try:
                return str(int(float(row["lote"])))
            except (ValueError, TypeError):
                return str(row["lote"]).strip()
        m = PADRAO_OBS.search(str(row["obs"]))
        return m.group(1) if m else None

    pares["lote"] = pares.apply(resolve_lote, axis=1)
    pares["peca"] = pares["peca"].astype(str).str.strip()
    pares = pares.dropna(subset=["lote", "peca"])
    pares = pares[(pares["lote"] != "") & (pares["peca"] != "")]
    pares = pares[["lote", "peca"]].drop_duplicates()

    print(f"  {total_linhas} linhas no relatório")
    print(f"  {bate_padrao.sum()} linhas com o padrão 'ORDEM GERADA PELO LOTE'")
    print(f"  {len(pares)} pares únicos (lote, peça) após o filtro")
    print(f"  {pares['lote'].nunique()} lotes distintos")
    print(f"  {pares['peca'].nunique()} peças distintas")

    return pares


# ---------------------------------------------------------------
# Supabase: upsert em lotes
# ---------------------------------------------------------------

def em_lotes_de(lista, tamanho):
    for i in range(0, len(lista), tamanho):
        yield lista[i:i + tamanho]


def upsert_lotes(numeros):
    print(f"Enviando {len(numeros)} lotes...")
    url = f"{SUPABASE_URL}/rest/v1/lotes?on_conflict=numero"
    for bloco in em_lotes_de(numeros, CHUNK_SIZE):
        payload = [{"numero": n} for n in bloco]
        r = requests.post(
            url, headers=headers("resolution=merge-duplicates,return=minimal"), json=payload
        )
        if r.status_code >= 300:
            sys.exit(f"ERRO ao inserir lotes: {r.status_code} - {r.text}")


def upsert_pecas(codigos):
    print(f"Enviando {len(codigos)} peças...")
    url = f"{SUPABASE_URL}/rest/v1/pecas?on_conflict=codigo"
    for bloco in em_lotes_de(codigos, CHUNK_SIZE):
        payload = [{"codigo": c} for c in bloco]
        r = requests.post(
            url, headers=headers("resolution=merge-duplicates,return=minimal"), json=payload
        )
        if r.status_code >= 300:
            sys.exit(f"ERRO ao inserir peças: {r.status_code} - {r.text}")


def buscar_ids(tabela, coluna, valores):
    """Busca os IDs de uma lista de valores, em blocos (evita URL gigante)."""
    mapa = {}
    url = f"{SUPABASE_URL}/rest/v1/{tabela}"
    for bloco in em_lotes_de(valores, 200):
        lista_pg = ",".join(bloco)
        params = {"select": f"id,{coluna}", coluna: f"in.({lista_pg})"}
        r = requests.get(url, headers=headers(), params=params)
        if r.status_code >= 300:
            sys.exit(f"ERRO ao buscar {tabela}: {r.status_code} - {r.text}")
        for row in r.json():
            mapa[row[coluna]] = row["id"]
    return mapa


def limpar_lote_peca():
    """Apaga todos os vínculos lote<->peça antes de reconstruir.

    É seguro: essa tabela só serve pra filtrar o dropdown do app, nada
    mais referencia ela diretamente (as solicitações guardam o lote e a
    peça escolhidos por conta própria, não dependem dessa tabela).
    Isso garante que vínculos antigos/errados de execuções anteriores
    não fiquem acumulados pra sempre.
    """
    print("Limpando vínculos lote-peça antigos...")
    url = f"{SUPABASE_URL}/rest/v1/lote_peca?lote_id=gt.0"
    r = requests.delete(url, headers=headers())
    if r.status_code >= 300:
        sys.exit(f"ERRO ao limpar lote_peca: {r.status_code} - {r.text}")


def upsert_lote_peca(pares_ids):
    print(f"Enviando {len(pares_ids)} vínculos lote-peça...")
    url = f"{SUPABASE_URL}/rest/v1/lote_peca?on_conflict=lote_id,peca_id"
    for bloco in em_lotes_de(pares_ids, CHUNK_SIZE):
        payload = [{"lote_id": l, "peca_id": p} for l, p in bloco]
        r = requests.post(
            url, headers=headers("resolution=merge-duplicates,return=minimal"), json=payload
        )
        if r.status_code >= 300:
            sys.exit(f"ERRO ao inserir vínculos lote_peca: {r.status_code} - {r.text}")


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Importa LOTE/COD ITEM do relatório diário pro Supabase")
    parser.add_argument("arquivo", nargs="?", help="Caminho do arquivo .xls exportado (opcional)")
    parser.add_argument("--pasta", default=".", help="Pasta onde procurar o arquivo do dia (se não passar 'arquivo')")
    parser.add_argument("--dry-run", action="store_true", help="Só mostra o que seria feito, não grava no banco")
    parser.add_argument(
        "--sem-limpar", action="store_true",
        help="Não apaga os vínculos antigos antes de importar (por padrão, o script limpa e reconstrói)"
    )
    args = parser.parse_args()

    caminho = args.arquivo or achar_arquivo_do_dia(args.pasta)
    pares = ler_relatorio(caminho)

    if args.dry_run:
        print("\n--dry-run ativado: nada foi gravado no banco. Amostra dos dados lidos:")
        print(pares.head(15).to_string(index=False))
        return

    validar_config()

    numeros_lote = sorted(pares["lote"].unique().tolist())
    codigos_peca = sorted(pares["peca"].unique().tolist())

    upsert_lotes(numeros_lote)
    upsert_pecas(codigos_peca)

    print("Buscando IDs gerados...")
    mapa_lote = buscar_ids("lotes", "numero", numeros_lote)
    mapa_peca = buscar_ids("pecas", "codigo", codigos_peca)

    pares_ids = []
    for _, row in pares.iterrows():
        lote_id = mapa_lote.get(row["lote"])
        peca_id = mapa_peca.get(row["peca"])
        if lote_id and peca_id:
            pares_ids.append((lote_id, peca_id))
    pares_ids = list(set(pares_ids))

    if not args.sem_limpar:
        limpar_lote_peca()

    upsert_lote_peca(pares_ids)

    print("\nConcluído com sucesso!")
    print(f"  Lotes:   {len(numeros_lote)}")
    print(f"  Peças:   {len(codigos_peca)}")
    print(f"  Vínculos: {len(pares_ids)}")


if __name__ == "__main__":
    main()
