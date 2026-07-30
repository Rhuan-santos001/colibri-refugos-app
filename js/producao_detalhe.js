let solicitacaoId = null;

document.addEventListener("DOMContentLoaded", () => {
  exigirPerfil("ppcp", "admin");

  const params = new URLSearchParams(window.location.search);
  solicitacaoId = params.get("id");
  if (!solicitacaoId) {
    showToast("Solicitação não encontrada", true);
    window.location.href = "producao.html";
    return;
  }

  carregarDetalhe();

  document.getElementById("btn-voltar").addEventListener("click", () => {
    window.location.href = "producao.html";
  });

  document.getElementById("btn-salvar").addEventListener("click", salvarOrdem);
});

async function carregarDetalhe() {
  setLoading("shell", true);
  try {
    const { data, error } = await supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, solicitante, revisado_por, numero_ordem,
        peca:peca_id ( codigo ),
        maquina:maquina_id ( codigo, nome ),
        lote:lote_id ( numero ),
        setor:setor_id ( nome ),
        motivo:motivo_id ( codigo, descricao )
      `)
      .eq("id", solicitacaoId)
      .single();

    if (error) throw error;

    document.getElementById("v-lote").textContent = data.lote?.numero ?? "-";
    document.getElementById("v-maquina").textContent = data.maquina ? `${data.maquina.codigo} - ${data.maquina.nome}` : "-";
    document.getElementById("v-solicitante").textContent = data.solicitante ?? "-";
    document.getElementById("v-peca").textContent = data.peca?.codigo ?? "-";
    document.getElementById("v-setor").textContent = data.setor?.nome ?? "-";
    document.getElementById("v-aprovador").textContent = data.revisado_por ?? "-";
    document.getElementById("v-quantidade").textContent = data.quantidade ?? "-";
    document.getElementById("v-data").textContent = formatarData(data.data_solicitacao);
    document.getElementById("v-motivo").textContent = data.motivo ? `${data.motivo.codigo} - ${data.motivo.descricao}` : "-";

    if (data.numero_ordem) {
      document.getElementById("in-ordem").value = data.numero_ordem;
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar detalhe: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

async function salvarOrdem() {
  const numeroOrdem = document.getElementById("in-ordem").value.trim();
  const campo = document.getElementById("f-ordem");

  if (!numeroOrdem) {
    campo.classList.add("invalid");
    showToast("Informe o número da ordem", true);
    return;
  }
  campo.classList.remove("invalid");

  const btn = document.getElementById("btn-salvar");
  btn.disabled = true;
  setLoading("shell", true);

  try {
    const { error } = await supabaseClient
      .from("solicitacoes")
      .update({
        numero_ordem: numeroOrdem,
        ordem_gerada_por: getUsuarioLogado(),
        ordem_gerada_em: new Date().toISOString(),
      })
      .eq("id", solicitacaoId);

    if (error) throw error;

    showToast("Ordem de fabricação salva!");
    setTimeout(() => (window.location.href = "producao.html"), 800);
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar: " + err.message, true);
  } finally {
    btn.disabled = false;
    setLoading("shell", false);
  }
}
