let abaAtual = "pendentes";

document.addEventListener("DOMContentLoaded", () => {
  exigirPerfil("qualidade", "admin");
  carregarLista();

  document.getElementById("tab-pendentes").addEventListener("click", () => trocarAba("pendentes"));
  document.getElementById("tab-revisadas").addEventListener("click", () => trocarAba("revisadas"));
  document.getElementById("btn-atualizar").addEventListener("click", carregarLista);
  document.getElementById("btn-voltar").addEventListener("click", () => {
    logoutUsuario();
    window.location.href = "login.html";
  });
});

function trocarAba(aba) {
  abaAtual = aba;
  document.getElementById("tab-pendentes").className = aba === "pendentes" ? "btn" : "btn btn-ghost";
  document.getElementById("tab-revisadas").className = aba === "revisadas" ? "btn" : "btn btn-ghost";
  carregarLista();
}

async function carregarLista() {
  setLoading("shell", true);
  const container = document.getElementById("lista-container");
  const empty = document.getElementById("empty");
  container.innerHTML = "";

  try {
    let query = supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, solicitante, status_qualidade, quantidade_consumida_estoque,
        peca:peca_id ( codigo ),
        maquina:maquina_id ( codigo, nome ),
        lote:lote_id ( numero ),
        setor:setor_id ( nome )
      `)
      .eq("status", "aprovado") // já aprovado pelo inspetor
      .order("revisado_em", { ascending: true });

    if (abaAtual === "pendentes") {
      query = query.eq("status_qualidade", "pendente");
    } else {
      query = query.neq("status_qualidade", "pendente");
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      empty.classList.remove("hidden");
      empty.textContent =
        abaAtual === "pendentes"
          ? "Nenhuma solicitação aguardando revisão da Qualidade."
          : "Nenhuma solicitação revisada ainda.";
      return;
    }
    empty.classList.add("hidden");

    data.forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <div class="cols">
          <div>
            <div class="lbl">Peça</div>
            <div class="val">${item.peca?.codigo ?? "-"}</div>
            <div class="lbl">Lote</div>
            <div class="val">${item.lote?.numero ?? "-"}</div>
          </div>
          <div>
            <div class="lbl">Setor</div>
            <div class="val">${item.setor?.nome ?? "-"}</div>
            <div class="lbl">Máquina</div>
            <div class="val">${item.maquina ? item.maquina.codigo + " - " + item.maquina.nome : "-"}</div>
          </div>
          <div>
            <div class="lbl">Quantidade</div>
            <div class="val">${item.quantidade}</div>
            <div class="lbl">Data</div>
            <div class="val">${formatarData(item.data_solicitacao)}</div>
          </div>
          <div>
            ${rotuloStatusQualidade(item.status_qualidade, item.quantidade_consumida_estoque)}
          </div>
        </div>
        <div class="chev">›</div>
      `;
      row.addEventListener("click", () => {
        window.location.href = `qualidade_detalhe.html?id=${item.id}`;
      });
      container.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    showToast("Erro ao carregar lista: " + err.message, true);
  } finally {
    setLoading("shell", false);
  }
}

function rotuloStatusQualidade(status, qtdConsumida) {
  if (status === "pendente") return `<span class="status-badge status-pendente">pendente</span>`;
  if (status === "aprovado") return `<span class="status-badge status-aprovado">sem saldo - gerar ordem</span>`;
  if (status === "rejeitado") return `<span class="status-badge status-rejeitado">rejeitado</span>`;
  if (status === "consumido_99") return `<span class="status-badge status-consumido99">consumido 99 (${qtdConsumida ?? "-"})</span>`;
  return "-";
}
