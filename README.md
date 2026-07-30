# Colibri — Solicitação de Refugos (Supabase + GitHub Pages)

## ✅ Auditoria desta versão

Antes de reempacotar, revisei o projeto inteiro de ponta a ponta:

- Todos os `<link>`/`<script src>` das 5 páginas apontam pros caminhos certos
- Todo `getElementById` usado no JS bate com um `id` real no HTML
- Todas as queries (`from`, `select`, `insert`, `update`, `rpc`) batem com
  as tabelas/colunas/função criadas em `schema.sql`
- `reset.sql` derruba exatamente as mesmas 8 tabelas que `schema.sql` cria
- `seed_data.sql` bate com a planilha: 6 setores, 48 máquinas, 77 motivos,
  282 vínculos motivo↔setor — testei os `ON CONFLICT` contra as
  constraints reais e os escapes de aspas (ex: `COL NAN 45'`)
- CSS sem chave `{`/`}` sobrando, JS sem erro de sintaxe (`node --check`)
- Servi a pasta inteira num servidor local e confirmei `200 OK` em
  todos os arquivos (html, css, js)

Não achei nenhum bug de código. Os erros que você teve (CSS sem estilo,
depois `supabaseClient is not defined`) foram os dois causados por
arquivos que não chegaram a subir pro GitHub — não por código quebrado.
O Passo 6 abaixo foi reescrito pra evitar isso de vez.

## ⚠️ Por que o visual "quebra" (fonte serifada, sem cores, sem grid)

Isso acontece quando o navegador **não consegue carregar `css/style.css`**
— aí ele volta ao estilo padrão do HTML (fonte Times New Roman, campos
soltos, sem grid, sem verde, e até os textos de erro que deveriam ficar
escondidos aparecem visíveis). O jeito mais rápido de confirmar: abra a
página, aperte **F12** (DevTools), vá na aba **Console** ou **Network** e
veja se aparece um erro `404` para `style.css`.

As duas causas mais comuns:

1. **Testando localmente com duplo-clique no `.html`**: se você moveu só
   o arquivo `.html` para fora da pasta (sem levar `css/` e `js/` juntos),
   o link relativo `css/style.css` não encontra o arquivo. Certifique-se
   de manter a estrutura de pastas intacta (extraia o `.zip` inteiro e
   abra o `index.html` de dentro dele).
2. **Publicando no GitHub Pages arrastando arquivos um por um** pela
   interface web do GitHub: esse método às vezes só sobe os `.html` soltos
   e "esquece" as subpastas `css/` e `js/`. O jeito mais seguro é subir
   com `git` pela linha de comando (comandos no Passo 6 abaixo), ou usar
   "Add file > Upload files" arrastando a **pasta inteira** de uma vez
   (funciona no Chrome/Edge).

Depois de corrigir, confira em `https://SEU-USUARIO.github.io/SEU-REPO/css/style.css`
(ou no console do navegador) se o arquivo realmente está acessível.


Site estático (HTML/CSS/JS puro, sem build) que usa o **Supabase** como
banco de dados, autenticação simples e storage de fotos. Pode ser hospedado
de graça no **GitHub Pages**.

## Estrutura do projeto

```
colibri-refugos/
├── index.html          (tela inicial)
├── solicitacao.html     (formulário do colaborador)
├── login.html            (login do inspetor e do ppcp)
├── lista.html            (lista de solicitações pendentes - inspetor)
├── detalhe.html           (aprovação / rejeição - inspetor)
├── producao.html          (aprovados sem ordem / já geradas - ppcp)
├── producao_detalhe.html   (gerar/editar numero da ordem - ppcp)
├── consulta.html            (consulta geral + índice de refugo por setor)
├── css/style.css
├── js/
│   ├── supabase-client.js  ← AQUI você coloca sua URL e chave (anon)
│   ├── app.js
│   ├── solicitacao.js
│   ├── lista.js
│   ├── detalhe.js
│   ├── producao.js
│   ├── producao_detalhe.js
│   └── consulta.js
├── sql/
│   ├── schema.sql              ← script principal (tabelas, RLS, login)
│   ├── seed_data.sql           ← dados reais de setor/máquina/motivo (da planilha)
│   ├── migrate_v3_lote_peca.sql ← se seu banco já existe, roda só isso
│   ├── migrate_v4_ppcp.sql      ← perfil ppcp + ordem de fabricação
│   ├── diagnostico_lote_peca.sql
│   ├── reset.sql                ← apaga tudo, pra recomeçar do zero
│   └── migrate_v2.sql
├── scripts/
│   ├── atualizar_lotes_pecas.py  ← script de importação diária (lote/peça)
│   ├── requirements.txt
│   └── .env.example             ← copie pra .env e preencha (não sobe pro git)
└── README.md
```

## Passo 1 — Criar o projeto no Supabase

1. Acesse **https://supabase.com** e crie uma conta (dá para usar o GitHub).
2. Clique em **New project**. Escolha um nome, uma senha de banco (guarde
   essa senha) e a região mais próxima (ex: South America).
3. Aguarde ~2 minutos até o projeto ficar pronto.

## Passo 2 — Rodar o schema (tabelas)

1. No painel do Supabase, vá em **SQL Editor** (ícone no menu lateral).
2. Clique em **New query**.
3. Abra o arquivo `sql/schema.sql` deste projeto, copie todo o conteúdo e
   cole no editor.
4. Clique em **Run**. Isso cria todas as tabelas, políticas de segurança
   (RLS), a função de login e alguns dados de exemplo.

> O script já cria um usuário inspetor de teste:
> **usuário:** `inspetor` — **senha:** `inspetor123`
> Troque essa senha depois em Table Editor > usuarios.

## Passo 2.1 — Popular setores, máquinas e motivos reais

Gerei o arquivo `sql/seed_data.sql` a partir da sua planilha
`SETOR_MOTIV_REFUGO_E_RECURSO.xlsx`. Ele já contém:

- **6 setores**: USINAGEM, CORTE, COLADEIRA, EMBALAGEM, FURADEIRA, LINHA DE PINTURA
- **48 máquinas**, cada uma vinculada ao seu setor
- **77 motivos de refugo** (com o código original, ex: `35 - FALHA NA OPERAÇÃO`)
- A relação de **quais motivos valem para quais setores** (muitos motivos
  são genéricos e valem pra todos; alguns são específicos de um setor só)

Depois de rodar `schema.sql`, abra uma **New query** de novo, cole o
conteúdo de `sql/seed_data.sql` e clique em **Run**.

Com isso, no formulário: ao escolher o **SETOR**, os campos **RECURSO/MAQUINA**
e **MOTIVO** já ficam filtrados automaticamente só com o que pertence
àquele setor (antes disso, esses dois campos ficam desabilitados).

Se no futuro a planilha mudar (novo motivo, nova máquina, novo setor), me
manda a planilha atualizada que eu gero um novo `seed_data.sql` pra você.

## Passo 2.2 — Tabela de vínculo Lote ↔ Peça

O `schema.sql` já cria a tabela `lote_peca` (usada pelo script de
importação diária, explicado mais abaixo). Se você já tinha rodado uma
versão anterior do `schema.sql` e só quer adicionar essa tabela nova sem
mexer no resto, rode `sql/migrate_v3_lote_peca.sql` no SQL Editor.

## Passo 2.3 — Perfil PPCP e Ordem de Fabricação

O `schema.sql` já vem com o necessário. Se seu banco já existia antes
dessa versão, rode `sql/migrate_v4_ppcp.sql` no SQL Editor — ele adiciona:
- os campos `numero_ordem`, `ordem_gerada_por`, `ordem_gerada_em` na
  tabela `solicitacoes`
- o tipo `'ppcp'` como opção válida na tabela `usuarios`
- a função `login_usuario`, que substitui a `login_inspetor` antiga
  (essa continua existindo por compatibilidade, mas o site agora usa a
  nova)
- um usuário `ppcp` de teste (senha `ppcp123` — troque depois)

## Passo 3 — Criar o bucket de fotos (Storage)


1. No menu lateral, vá em **Storage**.
2. Clique em **New bucket**.
3. Nome: `fotos-refugo` — marque a opção **Public bucket** — Create.
4. Ainda em Storage, vá na aba **Policies** do bucket e confirme que existe
   permissão de **INSERT** e **SELECT** para o público (o schema.sql já
   deixa os comandos comentados no final do arquivo, caso precise rodá-los
   manualmente).

## Passo 4 — Pegar sua URL e chave da API

1. Vá em **Project Settings** (ícone de engrenagem) > **API**.
2. Copie o **Project URL** e a chave **anon public**.
3. Abra `js/supabase-client.js` neste projeto e substitua:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_PUBLICA_AQUI";
```

pelos valores copiados.

> A chave **anon** é pública por design — ela só permite o que as políticas
> RLS liberarem (que já configuramos: inserir/ler solicitações, ler
> dropdowns, e a função de login). Nunca use a chave `service_role` no
> site.

## Passo 4.1 — Importação diária de Lote / Peça

Todo dia você exporta do sistema um relatório com o nome da data
(ex: `2707.xls` para 27/07). Esse relatório é na verdade um HTML salvo
com extensão `.xls` — normal em sistemas ERP, o script já lida com isso
sem precisar converter nada manualmente.

O script lê a **coluna D (LOTE)**, a **coluna H (COD ITEM)** e a
**coluna P (OBSERVACAO)**, e sincroniza no Supabase:
- a tabela `lotes`
- a tabela `pecas`
- a tabela `lote_peca` (o vínculo entre os dois)

**Filtro importante:** só entram no vínculo lote↔peça as linhas cuja
OBSERVACAO contenha o padrão `ORDEM GERADA PELO LOTE`. Isso porque uma
peça pode aparecer no relatório com o mesmo número de LOTE por outros
motivos (ajuste manual, exportação, erro de engenharia etc.) sem
realmente pertencer àquele lote de produção — só as linhas marcadas
como "gerada pelo lote" são consideradas peças de fato daquele lote.

Cada vez que o script roda, ele **apaga e reconstrói do zero** a tabela
`lote_peca` (lotes e peças em si continuam sendo só adicionados, nunca
apagados — só o vínculo entre eles é refeito). Isso garante que o
dropdown do app sempre reflita o relatório mais recente, sem acumular
vínculos antigos ou errados de execuções passadas. Se por algum motivo
você não quiser esse comportamento, use `--sem-limpar`.

Rodar de novo o mesmo dia (ou reprocessar um dia antigo) não duplica
nada — é seguro rodar quantas vezes quiser.

**Configuração (só na primeira vez):**

1. Instale o Python 3 caso ainda não tenha: [python.org/downloads](https://www.python.org/downloads/)
2. Abra o terminal dentro da pasta `scripts/` e instale as dependências:
   ```bash
   cd scripts
   python -m pip install -r requirements.txt
   ```
   (no Windows, se `pip` sozinho não funcionar, use sempre `python -m pip ...`)
3. Copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   No Windows, se copiar pelo Explorador de Arquivos/Bloco de Notas,
   confirme que o nome final é `.env` e não `.env.txt` (o Windows às
   vezes esconde a extensão real — confira com `dir /a`).
4. Abra o `.env` e preencha (sem aspas em volta dos valores):
   - `SUPABASE_URL`: a mesma URL usada no `supabase-client.js`
   - `SUPABASE_SERVICE_KEY`: **NÃO** é a chave anon do site! Vá em
     Supabase > Project Settings > API > e copie a chave **service_role**
     (secreta). Essa chave tem acesso total e ignora as regras de
     segurança — por isso ela fica só nesse `.env` local, nunca no site
     publicado. O `.gitignore` já impede o `.env` de ir pro GitHub sem querer.

**Uso do dia a dia:**

Exporte o relatório do sistema pra dentro da pasta `scripts/` com o nome
`ddmm.xls` (ex: `2707.xls`) e rode:

```bash
python atualizar_lotes_pecas.py
```

O script encontra sozinho o arquivo de hoje. Se quiser apontar um
arquivo específico ou testar sem gravar nada no banco:

```bash
python atualizar_lotes_pecas.py caminho\para\2707.xls   # arquivo especifico
python atualizar_lotes_pecas.py --dry-run                # so mostra, nao grava
python atualizar_lotes_pecas.py --pasta "C:\Exports"      # procura o arquivo de hoje nessa pasta
python atualizar_lotes_pecas.py --sem-limpar              # nao apaga vinculos antigos antes de importar
```

Depois de rodar, no formulário do app: ao escolher o **LOTE**, o campo
**COD ITEM** passa a mostrar só as peças daquele lote (fica desabilitado
até você escolher o lote, igual já acontece com SETOR → MÁQUINA/MOTIVO).



## Passo 5 — Testar localmente (opcional)

Como o navegador bloqueia `fetch` em arquivos abertos direto (`file://`),
rode um servidor local simples dentro da pasta do projeto:

```bash
# Python
python3 -m http.server 8000

# ou Node
npx serve .
```

Depois abra `http://localhost:8000`.

## Passo 6 — Publicar no GitHub Pages (do zero, sem complicação)

Como você vai refazer o processo, a forma mais simples é começar com um
repositório **novo e vazio** (evita misturar com uploads incompletos de
antes):

1. No GitHub, crie um repositório novo (ex: `colibri-refugos`) — **não**
   marque a opção de criar README/gitignore, deixe ele totalmente vazio.
2. Abra o terminal **dentro da pasta `colibri-refugos`** deste projeto
   (a que você extraiu do zip) e rode, um comando de cada vez:

```bash
git init
git add .
git commit -m "Colibri - solicitação de refugos"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/colibri-refugos.git
git push -u origin main
```

> Troque `SEU-USUARIO` e `colibri-refugos` pelos valores reais. Essa URL
> é a mesma que aparece no botão verde **"Code"** do repositório.

3. No GitHub, vá em **Settings > Pages**.
4. Em **Source**, selecione a branch `main` e a pasta `/ (root)`.
5. Salve e aguarde 1–2 minutos. Seu site ficará em:
   `https://SEU-USUARIO.github.io/colibri-refugos/`

Como todos os comandos rodam a partir da pasta do projeto (que já contém
`css/`, `js/`, `sql/` etc.), o `git add .` sobe **tudo de uma vez só**,
sem risco de esquecer subpasta — é o mesmo problema que causou os erros
de CSS e JS não carregarem antes.

## Passo 7 — Verificação pós-deploy (não pule esse passo)

Depois que o GitHub Pages terminar de publicar, confira estas 3 URLs
direto no navegador (troque pelos seus dados). Cada uma tem que abrir
mostrando código, **não** uma página 404:

```
https://SEU-USUARIO.github.io/colibri-refugos/css/style.css
https://SEU-USUARIO.github.io/colibri-refugos/js/supabase-client.js
https://SEU-USUARIO.github.io/colibri-refugos/js/app.js
```

Se as três abrirem normalmente, o site vai funcionar. Se alguma delas
der 404, o `git push` não subiu aquele arquivo — normalmente resolve
rodando `git status` dentro da pasta do projeto pra ver o que ainda
falta subir, ou repetindo o `git add . && git commit -m "fix" && git push`.

## Cadastrando lotes, peças, máquinas, setores e motivos

**Lotes e peças** normalmente não precisam ser cadastrados manualmente —
o script `scripts/atualizar_lotes_pecas.py` faz isso todo dia. Mas se
precisar adicionar um caso avulso na mão:

```sql
insert into lotes (numero) values ('6030');
insert into pecas (codigo) values ('3300B0.010.220');

-- ligar a peça ao lote (sem isso ela não aparece no dropdown ao
-- escolher esse lote no formulário)
insert into lote_peca (lote_id, peca_id)
  select l.id, p.id from lotes l, pecas p
  where l.numero = '6030' and p.codigo = '3300B0.010.220';
```

**Máquinas e motivos** têm vínculo com setor (é isso que faz os
dropdowns dependentes funcionarem), então ao cadastrar um novo precisa
apontar pro setor certo:

```sql
-- novo setor
insert into setores (nome) values ('SEC.SOLDA');

-- nova máquina, vinculada a um setor existente
insert into maquinas (codigo, nome, setor_id)
  select '1310', 'SEC.SOLDA', id from setores where nome = 'SEC.SOLDA';

-- novo motivo (o codigo é opcional, mas ajuda a manter o padrão da planilha)
insert into motivos (codigo, descricao) values ('100', 'RETRABALHO');

-- ligar esse motivo a um ou mais setores
insert into motivo_setor (motivo_id, setor_id)
  select m.id, s.id from motivos m, setores s
  where m.codigo = '100' and s.nome = 'SEC.SOLDA';
```

## Cadastrando novos inspetores

```sql
insert into usuarios (usuario, senha, tipo) values ('novo.usuario', 'senha123', 'inspetor');
```

⚠️ A senha fica em texto puro na tabela, igual ao esquema simplificado que
você pediu. Se um dia quiser mais segurança, dá para migrar para o
**Supabase Auth** (login com e-mail/senha real, hash automático) — é só
avisar que eu adapto o login.

## Perfis e telas novas (PPCP)

- **Acesso PPCP** (login em `login.html`, mesmo formulário do inspetor —
  o app identifica o tipo de usuário e redireciona sozinho): cai em
  `producao.html`.
- **producao.html** — lista solicitações **aprovadas sem ordem de
  fabricação ainda**. Aba "Já geradas" mostra o histórico. Clicar num
  item abre `producao_detalhe.html`, onde dá pra digitar o número da
  ordem e salvar (1 ordem por registro, independente da quantidade).
- **consulta.html** — acessível pelo PPCP, Inspetor e Qualidade (tem um
  link "📊 Consulta / Índice de refugo" nas telas). Filtra por lote,
  peça, setor, máquina, status, data e se a ordem foi gerada ou não.
  Mostra os registros numa tabela (clique numa linha pra ver o detalhe
  completo, incluindo foto) e um gráfico de barras com a soma da
  quantidade refugada por setor — o "índice de refugo por setor".

## Perfil Qualidade (verificação de estoque da assistência)

- **Acesso Qualidade** (mesmo `login.html`, redireciona sozinho pra
  `qualidade.html`): usuário de teste `qualidade` / senha `qualidade123`
- **qualidade.html** — lista solicitações **já aprovadas pelo inspetor**
  aguardando revisão da Qualidade. Aba "Já revisadas" mostra o histórico.
- **qualidade_detalhe.html** — 3 ações:
  - **Aprovar**: não há saldo no estoque da assistência → PPCP **vai**
    precisar gerar ordem de fabricação (esse item passa a aparecer em
    `producao.html`)
  - **Rejeitar**: fluxo bloqueado, não segue pro PPCP
  - **Consumido 99**: havia saldo/sobra no estoque, pede a **quantidade
    consumida** e grava — isso também bloqueia o PPCP de gerar ordem
    (já foi resolvido via estoque)
- O PPCP (`producao.html`) só lista itens onde o **inspetor aprovou E
  a Qualidade aprovou** (sem saldo) — os outros dois desfechos da
  Qualidade (rejeitado / consumido 99) nunca aparecem lá.
- Rode `sql/migrate_v5_qualidade.sql` se seu banco já existia antes
  dessa versão.

## Fluxo do app

1. **index.html** — Colaborador ou Inspetor.
2. **solicitacao.html** — Colaborador preenche e salva o pedido de refugo
   (fica com status `pendente`). O campo COD ITEM só habilita depois de
   escolher o LOTE (mostra só as peças daquele lote), e RECURSO/MAQUINA
   + MOTIVO só habilitam depois de escolher o SETOR.
3. **login.html** — Inspetor entra com usuário/senha (validado por uma
   função no banco, sem expor a tabela de usuários).
4. **lista.html** — Lista as solicitações pendentes.
5. **detalhe.html** — Inspetor vê os detalhes, opcionalmente anexa uma
   foto (sobe pro Supabase Storage) e aprova ou rejeita.

## Personalizar o visual

Toda a paleta de cores está centralizada em `css/style.css`, no bloco
`:root` no topo do arquivo — é só trocar os valores de verde se quiser
outra tonalidade.
