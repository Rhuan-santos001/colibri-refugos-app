document.addEventListener("DOMContentLoaded", async () => {
  exigirPerfil("ppcp", "inspetor", "admin");
  await carregarFiltros();
  document.getElementById("btn-buscar").addEventListener("click", buscar);
  document.getElementById("btn-limpar-filtros").addEventListener("click", () => {
    ["f-lote", "f-peca", "f-setor", "f-maquina", "f-status", "f-ordem"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    document.getElementById("f-data-inicio").value = "";
    document.getElementById("f-data-fim").value = "";
    buscar();
  });
  document.getElementById("modal-close").addEventListener("click", fecharModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") fecharModal();
  });
  buscar();
});

async function carregarFiltros() {
  setLoading("shell", true);
  try {
    const [lotes, pecas, setores, maquinas] = await Promise.all([
      supabaseClient.from("lotes").select("id, numero").order("numero"),
      supabaseClient.from("pecas").select("id, codigo").order("codigo"),
      supabaseClient.from("setores").select("id, nome").order("nome"),
      supabaseClient.from("maquinas").select("id, codigo, nome").order("codigo"),
    ]);
    [lotes, pecas, setores, maquinas].forEach((r) => {
      if (r.error) throw r.error;
    });

    adicionarOpcoes("f-lote", lotes.data.map((l) => ({ id: l.id, label: l.numero })));
    adicionarOpcoes("f-peca", pecas.data.map((p) => ({ id: p.id, label: p.codigo })));
    adicionarOpcoes("f-setor", setores.data.map((s) => ({ id: s.id, label: s.nome })));
    adicionarOpcoes("f-maquina", maquinas.data.map((m) => ({ id: m.id, label: `${m.codigo} - ${m.nome}` })));
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar filtros: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

function adicionarOpcoes(selectId, itens) {
  const el = document.getElementById(selectId);
  itens.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.label;
    el.appendChild(opt);
  });
}

let ultimosResultados = [];

async function buscar() {
  setLoading("shell", true);
  try {
    let query = supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, status, numero_ordem, solicitante,
        foto_url, revisado_por, revisado_em, ordem_gerada_por, ordem_gerada_em,
        peca:peca_id ( codigo ),
        maquina:maquina_id ( codigo, nome ),
        lote:lote_id ( numero ),
        setor:setor_id ( id, nome ),
        motivo:motivo_id ( codigo, descricao )
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    const lote = document.getElementById("f-lote").value;
    const peca = document.getElementById("f-peca").value;
    const setor = document.getElementById("f-setor").value;
    const maquina = document.getElementById("f-maquina").value;
    const status = document.getElementById("f-status").value;
    const ordem = document.getElementById("f-ordem").value;
    const dataInicio = document.getElementById("f-data-inicio").value;
    const dataFim = document.getElementById("f-data-fim").value;

    if (lote) query = query.eq("lote_id", lote);
    if (peca) query = query.eq("peca_id", peca);
    if (setor) query = query.eq("setor_id", setor);
    if (maquina) query = query.eq("maquina_id", maquina);
    if (status) query = query.eq("status", status);
    if (ordem === "sim") query = query.not("numero_ordem", "is", null);
    if (ordem === "nao") query = query.is("numero_ordem", null);
    if (dataInicio) query = query.gte("data_solicitacao", dataInicio);
    if (dataFim) query = query.lte("data_solicitacao", dataFim);

    const { data, error } = await query;
    if (error) throw error;

    ultimosResultados = data;
    renderizarTabela(data);
    renderizarGrafico(data);
    renderizarTotal(data);
  } catch (err) {
    console.error(err);
    showToast("Erro ao buscar: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

function renderizarTotal(data) {
  const total = data.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
  document.getElementById("qtd-total").textContent = total;
}

function renderizarTabela(data) {
  const tbody = document.getElementById("tbody-resultados");
  const empty = document.getElementById("empty");
  const tabela = document.getElementById("tabela-resultados");
  tbody.innerHTML = "";
  document.getElementById("contador").textContent = data.length;

  if (!data.length) {
    tabela.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  tabela.classList.remove("hidden");
  empty.classList.add("hidden");

  data.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.lote?.numero ?? "-"}</td>
      <td>${item.peca?.codigo ?? "-"}</td>
      <td>${item.setor?.nome ?? "-"}</td>
      <td>${item.maquina ? item.maquina.codigo + " - " + item.maquina.nome : "-"}</td>
      <td>${item.quantidade}</td>
      <td>${formatarData(item.data_solicitacao)}</td>
      <td><span class="status-badge status-${item.status}">${item.status}</span></td>
      <td>${item.numero_ordem ?? "—"}</td>
    `;
    tr.addEventListener("click", () => abrirModal(item.id));
    tbody.appendChild(tr);
  });
}

function abrirModal(id) {
  const item = ultimosResultados.find((r) => r.id === id);
  if (!item) return;

  const corpo = document.getElementById("modal-corpo");
  corpo.innerHTML = `
    <div class="detail-field"><div class="lbl">Lote</div><div class="val">${item.lote?.numero ?? "-"}</div></div>
    <div class="detail-field"><div class="lbl">Peça</div><div class="val">${item.peca?.codigo ?? "-"}</div></div>
    <div class="detail-field"><div class="lbl">Setor</div><div class="val">${item.setor?.nome ?? "-"}</div></div>
    <div class="detail-field"><div class="lbl">Recurso/Máquina</div><div class="val">${item.maquina ? item.maquina.codigo + " - " + item.maquina.nome : "-"}</div></div>
    <div class="detail-field"><div class="lbl">Quantidade</div><div class="val">${item.quantidade}</div></div>
    <div class="detail-field"><div class="lbl">Data da solicitação</div><div class="val">${formatarData(item.data_solicitacao)}</div></div>
    <div class="detail-field"><div class="lbl">Solicitante</div><div class="val">${item.solicitante ?? "-"}</div></div>
    <div class="detail-field"><div class="lbl">Motivo</div><div class="val">${item.motivo ? item.motivo.codigo + " - " + item.motivo.descricao : "-"}</div></div>
    <div class="detail-field"><div class="lbl">Status</div><div class="val"><span class="status-badge status-${item.status}">${item.status}</span></div></div>
    <div class="detail-field"><div class="lbl">Revisado por</div><div class="val">${item.revisado_por ?? "-"}</div></div>
    <div class="detail-field"><div class="lbl">Ordem de fabricação</div><div class="val">${item.numero_ordem ?? "—"}</div></div>
    <div class="detail-field"><div class="lbl">Ordem gerada por</div><div class="val">${item.ordem_gerada_por ?? "-"}</div></div>
    ${
      item.foto_url
        ? `<div class="modal-foto"><div class="lbl">Foto</div><img src="${item.foto_url}" alt="Foto do refugo"></div>`
        : `<div class="modal-foto"><div class="lbl">Foto</div><div class="val">Sem foto anexada</div></div>`
    }
  `;

  document.getElementById("modal-overlay").classList.remove("hidden");
}

function fecharModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function renderizarGrafico(data) {
  const porSetor = {};
  data.forEach((item) => {
    const nome = item.setor?.nome ?? "Sem setor";
    porSetor[nome] = (porSetor[nome] || 0) + Number(item.quantidade || 0);
  });

  const entradas = Object.entries(porSetor).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById("bar-chart");
  container.innerHTML = "";

  if (!entradas.length) {
    container.innerHTML = '<p class="section-sub">Sem dados para exibir.</p>';
    return;
  }

  const max = entradas[0][1];
  entradas.forEach(([nome, total]) => {
    const pct = max > 0 ? Math.max((total / max) * 100, 4) : 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label">${nome}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="bar-value">${total}</div>
    `;
    container.appendChild(row);
  });
}
