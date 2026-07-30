let solicitacaoId = null;

document.addEventListener("DOMContentLoaded", () => {
  exigirPerfil("qualidade", "admin");

  const params = new URLSearchParams(window.location.search);
  solicitacaoId = params.get("id");
  if (!solicitacaoId) {
    showToast("Solicitação não encontrada", true);
    window.location.href = "qualidade.html";
    return;
  }

  carregarDetalhe();

  document.getElementById("btn-voltar").addEventListener("click", () => {
    window.location.href = "qualidade.html";
  });

  document.getElementById("btn-aprovar").addEventListener("click", () => revisar("aprovado"));
  document.getElementById("btn-rejeitar").addEventListener("click", () => revisar("rejeitado"));
  document.getElementById("btn-consumido99").addEventListener("click", () => revisar("consumido_99"));
});

async function carregarDetalhe() {
  setLoading("shell", true);
  try {
    const { data, error } = await supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, solicitante, revisado_por, foto_url,
        status_qualidade, quantidade_consumida_estoque,
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

    if (data.foto_url) {
      document.getElementById("v-foto-wrap").innerHTML = `<img src="${data.foto_url}" alt="Foto" style="max-width:280px; border-radius:8px; border:1px solid var(--cinza-borda);">`;
    }

    if (data.quantidade_consumida_estoque != null) {
      document.getElementById("in-qtd-consumida").value = data.quantidade_consumida_estoque;
    }

    if (data.status_qualidade !== "pendente") {
      ["btn-aprovar", "btn-rejeitar", "btn-consumido99"].forEach((id) => {
        document.getElementById(id).disabled = true;
      });
      document.getElementById("in-qtd-consumida").disabled = true;
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar detalhe: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

async function revisar(novoStatus) {
  const payload = {
    status_qualidade: novoStatus,
    qualidade_revisado_por: getUsuarioLogado(),
    qualidade_revisado_em: new Date().toISOString(),
  };

  if (novoStatus === "consumido_99") {
    const campo = document.getElementById("f-qtd-consumida");
    const valor = document.getElementById("in-qtd-consumida").value;
    if (!valor || Number(valor) <= 0) {
      campo.classList.add("invalid");
      showToast("Informe a quantidade consumida do estoque", true);
      return;
    }
    campo.classList.remove("invalid");
    payload.quantidade_consumida_estoque = Number(valor);
  }

  ["btn-aprovar", "btn-rejeitar", "btn-consumido99"].forEach((id) => {
    document.getElementById(id).disabled = true;
  });
  setLoading("shell", true);

  try {
    const { error } = await supabaseClient
      .from("solicitacoes")
      .update(payload)
      .eq("id", solicitacaoId);

    if (error) throw error;

    const mensagens = {
      aprovado: "Aprovado: sem saldo, PPCP vai gerar a ordem.",
      rejeitado: "Solicitação rejeitada pela Qualidade.",
      consumido_99: "Consumo do estoque registrado, ordem bloqueada.",
    };
    showToast(mensagens[novoStatus]);
    setTimeout(() => (window.location.href = "qualidade.html"), 900);
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar: " + err.message, true);
    ["btn-aprovar", "btn-rejeitar", "btn-consumido99"].forEach((id) => {
      document.getElementById(id).disabled = false;
    });
  } finally {
    setLoading("shell", false);
  }
}
