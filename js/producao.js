let abaAtual = "pendentes";

document.addEventListener("DOMContentLoaded", () => {
  exigirPerfil("ppcp", "admin");
  carregarLista();

  document.getElementById("tab-pendentes").addEventListener("click", () => trocarAba("pendentes"));
  document.getElementById("tab-geradas").addEventListener("click", () => trocarAba("geradas"));
  document.getElementById("btn-atualizar").addEventListener("click", carregarLista);
  document.getElementById("btn-voltar").addEventListener("click", () => {
    logoutUsuario();
    window.location.href = "login.html";
  });
});

function trocarAba(aba) {
  abaAtual = aba;
  document.getElementById("tab-pendentes").className = aba === "pendentes" ? "btn" : "btn btn-ghost";
  document.getElementById("tab-geradas").className = aba === "geradas" ? "btn" : "btn btn-ghost";
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
        id, quantidade, data_solicitacao, solicitante, numero_ordem,
        peca:peca_id ( codigo ),
        maquina:maquina_id ( codigo, nome ),
        lote:lote_id ( numero ),
        setor:setor_id ( nome )
      `)
      .eq("status", "aprovado")
      .order("revisado_em", { ascending: true });

    if (abaAtual === "pendentes") {
      query = query.is("numero_ordem", null);
    } else {
      query = query.not("numero_ordem", "is", null);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      empty.classList.remove("hidden");
      empty.textContent =
        abaAtual === "pendentes"
          ? "Nenhuma solicitação aprovada aguardando ordem de fabricação."
          : "Nenhuma ordem gerada ainda.";
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
            ${
              item.numero_ordem
                ? `<div class="lbl">Ordem</div><div class="val">${item.numero_ordem}</div>`
                : `<span class="status-badge status-pendente">sem ordem</span>`
            }
          </div>
        </div>
        <div class="chev">›</div>
      `;
      row.addEventListener("click", () => {
        window.location.href = `producao_detalhe.html?id=${item.id}`;
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
