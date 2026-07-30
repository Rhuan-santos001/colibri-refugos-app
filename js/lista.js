document.addEventListener("DOMContentLoaded", () => {
  exigirLoginInspetor();
  carregarLista();

  document.getElementById("btn-atualizar").addEventListener("click", carregarLista);
  document.getElementById("btn-voltar").addEventListener("click", () => {
    logoutInspetor();
    window.location.href = "login.html";
  });
});

async function carregarLista() {
  setLoading("shell", true);
  const container = document.getElementById("lista-container");
  const empty = document.getElementById("empty");
  container.innerHTML = "";

  try {
    const { data, error } = await supabaseClient
      .from("solicitacoes")
      .select(`
        id, quantidade, data_solicitacao, status, solicitante,
        peca:peca_id ( codigo ),
        maquina:maquina_id ( codigo, nome ),
        lote:lote_id ( numero )
      `)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      empty.classList.remove("hidden");
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
            <div class="lbl">Máquina</div>
            <div class="val">${item.maquina ? item.maquina.codigo + " - " + item.maquina.nome : "-"}</div>
          </div>
          <div>
            <div class="lbl">Usuário</div>
            <div class="val">${item.solicitante ?? "-"}</div>
          </div>
          <div>
            <div class="lbl">Quantidade</div>
            <div class="val">${item.quantidade}</div>
            <div class="lbl">Data</div>
            <div class="val">${formatarData(item.data_solicitacao)}</div>
          </div>
          <div>
            <div class="lbl">Lote</div>
            <div class="val">${item.lote?.numero ?? "-"}</div>
            <span class="status-badge status-${item.status}">${item.status}</span>
          </div>
        </div>
        <div class="chev">›</div>
      `;
      row.addEventListener("click", () => {
        window.location.href = `detalhe.html?id=${item.id}`;
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
