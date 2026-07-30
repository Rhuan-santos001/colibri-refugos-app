let solicitacaoId = null;
let arquivoSelecionado = null;

document.addEventListener("DOMContentLoaded", () => {
  exigirLoginInspetor();

  const params = new URLSearchParams(window.location.search);
  solicitacaoId = params.get("id");
  if (!solicitacaoId) {
    showToast("Solicitação não encontrada", true);
    window.location.href = "lista.html";
    return;
  }

  carregarDetalhe();

  document.getElementById("btn-voltar").addEventListener("click", () => {
    window.location.href = "lista.html";
  });

  document.getElementById("photo-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    arquivoSelecionado = file;
    const preview = document.getElementById("photo-preview");
    const placeholder = document.getElementById("photo-placeholder");
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
    placeholder.classList.add("hidden");
  });

  document.getElementById("btn-aprovar").addEventListener("click", () => atualizarStatus("aprovado"));
  document.getElementById("btn-rejeitar").addEventListener("click", () => atualizarStatus("rejeitado"));
});

async function carregarDetalhe() {
  setLoading("shell", true);
  try {
    const { data, error } = await supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, status, solicitante, foto_url,
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
    document.getElementById("v-peca").textContent = data.peca?.codigo ?? "-";
    document.getElementById("v-solicitante").textContent = data.solicitante ?? "-";
    document.getElementById("v-setor").textContent = data.setor?.nome ?? "-";
    document.getElementById("v-quantidade").textContent = data.quantidade ?? "-";
    document.getElementById("v-status").textContent = data.status ?? "-";
    document.getElementById("v-data").textContent = formatarData(data.data_solicitacao);
    document.getElementById("v-motivo").textContent = data.motivo ? `${data.motivo.codigo} - ${data.motivo.descricao}` : "-";

    if (data.foto_url) {
      document.getElementById("photo-preview").src = data.foto_url;
      document.getElementById("photo-preview").classList.remove("hidden");
      document.getElementById("photo-placeholder").classList.add("hidden");
    }

    if (data.status !== "pendente") {
      document.getElementById("btn-aprovar").disabled = true;
      document.getElementById("btn-rejeitar").disabled = true;
    }
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar detalhe: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

async function atualizarStatus(novoStatus) {
  setLoading("shell", true);
  document.getElementById("btn-aprovar").disabled = true;
  document.getElementById("btn-rejeitar").disabled = true;

  try {
    let fotoUrl = null;

    if (arquivoSelecionado) {
      const ext = arquivoSelecionado.name.split(".").pop();
      const path = `solicitacao-${solicitacaoId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient
        .storage.from(STORAGE_BUCKET)
        .upload(path, arquivoSelecionado, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: pub } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      fotoUrl = pub.publicUrl;
    }

    const updatePayload = {
      status: novoStatus,
      revisado_por: getInspetorLogado(),
      revisado_em: new Date().toISOString(),
    };
    if (fotoUrl) updatePayload.foto_url = fotoUrl;

    const { error } = await supabaseClient
      .from("solicitacoes")
      .update(updatePayload)
      .eq("id", solicitacaoId);

    if (error) throw error;

    showToast(novoStatus === "aprovado" ? "Solicitação aprovada!" : "Solicitação rejeitada.");
    setTimeout(() => (window.location.href = "lista.html"), 900);
  } catch (err) {
    console.error(err);
    showToast("Erro ao atualizar: " + err.message, true);
    document.getElementById("btn-aprovar").disabled = false;
    document.getElementById("btn-rejeitar").disabled = false;
  } finally {
    setLoading("shell", false);
  }
}
