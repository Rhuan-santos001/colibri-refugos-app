document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("in-data").value = hojeISO();
  await carregarDropdownsIniciais();

  document.getElementById("sel-lote").addEventListener("change", carregarPecasDoLote);
  document.getElementById("sel-setor").addEventListener("change", carregarMaquinasEMotivosDoSetor);

  document.getElementById("btn-limpar").addEventListener("click", () => {
    document.getElementById("form-solicitacao").reset();
    document.getElementById("in-data").value = hojeISO();
    resetarDependentes();
    document.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
  });

  document.getElementById("form-solicitacao").addEventListener("submit", salvarSolicitacao);
});

function resetarDependentes() {
  ["sel-peca", "sel-maquina", "sel-motivo"].forEach((id) => {
    const el = document.getElementById(id);
    el.disabled = true;
    el.innerHTML = "";
  });
}

// Carrega lote e setor assim que a página abre (peça, máquina e motivo
// dependem de uma escolha anterior, então começam vazios/desabilitados)
async function carregarDropdownsIniciais() {
  setLoading("shell", true);
  try {
    const [lotes, setores] = await Promise.all([
      supabaseClient.from("lotes").select("id, numero").order("numero"),
      supabaseClient.from("setores").select("id, nome").order("nome"),
    ]);

    [lotes, setores].forEach((r) => {
      if (r.error) throw r.error;
    });

    popularSelect(document.getElementById("sel-lote"),
      lotes.data.map((l) => ({ id: l.id, label: l.numero })), "Localizar Lotes");

    popularSelect(document.getElementById("sel-setor"),
      setores.data.map((s) => ({ id: s.id, label: s.nome })), "Selecione o setor");
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar dados: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

// Ao escolher o lote, busca só as peças que pertencem a ele
async function carregarPecasDoLote() {
  const loteId = document.getElementById("sel-lote").value;
  const selPeca = document.getElementById("sel-peca");

  selPeca.disabled = true;
  selPeca.innerHTML = "";
  if (!loteId) return;

  setLoading("shell", true);
  try {
    const { data, error } = await supabaseClient
      .from("lote_peca")
      .select("peca:peca_id ( id, codigo )")
      .eq("lote_id", loteId);

    if (error) throw error;

    const pecasOrdenadas = data
      .map((r) => r.peca)
      .filter(Boolean)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    popularSelect(selPeca,
      pecasOrdenadas.map((p) => ({ id: p.id, label: p.codigo })),
      "Localizar peças");

    selPeca.disabled = false;
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar peças do lote: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

// Ao escolher o setor, busca só as máquinas e motivos daquele setor
async function carregarMaquinasEMotivosDoSetor() {
  const setorId = document.getElementById("sel-setor").value;
  const selMaquina = document.getElementById("sel-maquina");
  const selMotivo = document.getElementById("sel-motivo");

  selMaquina.disabled = true;
  selMotivo.disabled = true;
  selMaquina.innerHTML = "";
  selMotivo.innerHTML = "";

  if (!setorId) return;

  setLoading("shell", true);
  try {
    const [maquinas, motivos] = await Promise.all([
      supabaseClient
        .from("maquinas")
        .select("id, codigo, nome")
        .eq("setor_id", setorId)
        .order("codigo"),
      supabaseClient
        .from("motivo_setor")
        .select("motivo:motivo_id ( id, codigo, descricao )")
        .eq("setor_id", setorId),
    ]);

    if (maquinas.error) throw maquinas.error;
    if (motivos.error) throw motivos.error;

    popularSelect(selMaquina,
      maquinas.data.map((m) => ({ id: m.id, label: `${m.codigo} - ${m.nome}` })),
      "Localizar Máquina");

    const motivosOrdenados = motivos.data
      .map((r) => r.motivo)
      .filter(Boolean)
      .sort((a, b) => Number(a.codigo) - Number(b.codigo));

    popularSelect(selMotivo,
      motivosOrdenados.map((m) => ({ id: m.id, label: `${m.codigo} - ${m.descricao}` })),
      "Localizar itens");

    selMaquina.disabled = false;
    selMotivo.disabled = false;
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar máquinas/motivos: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

function validarCampo(fieldId, valido) {
  const el = document.getElementById(fieldId);
  el.classList.toggle("invalid", !valido);
  return valido;
}

async function salvarSolicitacao(e) {
  e.preventDefault();

  const lote = document.getElementById("sel-lote").value;
  const peca = document.getElementById("sel-peca").value;
  const quantidade = document.getElementById("in-quantidade").value;
  const data = document.getElementById("in-data").value;
  const setor = document.getElementById("sel-setor").value;
  const maquina = document.getElementById("sel-maquina").value;
  const motivo = document.getElementById("sel-motivo").value;
  const solicitante = document.getElementById("in-solicitante").value.trim();

  let ok = true;
  ok = validarCampo("f-lote", !!lote) && ok;
  ok = validarCampo("f-peca", !!peca) && ok;
  ok = validarCampo("f-quantidade", quantidade && Number(quantidade) > 0) && ok;
  ok = validarCampo("f-data", !!data) && ok;
  ok = validarCampo("f-setor", !!setor) && ok;
  ok = validarCampo("f-maquina", !!maquina) && ok;
  ok = validarCampo("f-motivo", !!motivo) && ok;
  ok = validarCampo("f-solicitante", !!solicitante) && ok;

  if (!ok) {
    showToast("Preencha todos os campos obrigatórios", true);
    return;
  }

  const btn = document.getElementById("btn-salvar");
  btn.disabled = true;
  setLoading("shell", true);

  try {
    const { error } = await supabaseClient.from("solicitacoes").insert({
      lote_id: lote,
      peca_id: peca,
      quantidade: Number(quantidade),
      data_solicitacao: data,
      setor_id: setor,
      maquina_id: maquina,
      motivo_id: motivo,
      solicitante: solicitante,
      status: "pendente",
    });

    if (error) throw error;

    showToast("Solicitação salva com sucesso!");
    document.getElementById("form-solicitacao").reset();
    document.getElementById("in-data").value = hojeISO();
    resetarDependentes();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar: " + err.message, true);
  } finally {
    btn.disabled = false;
    setLoading("shell", false);
  }
}
