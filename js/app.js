// =========================================================
// Helpers compartilhados por todas as páginas
// =========================================================

// ---- Ícone genérico (hexágono + check, tema industrial/qualidade) ----
const APP_ICON_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,6 108,33 108,87 60,114 12,87 12,33"
           fill="none" stroke="var(--primary)" stroke-width="7" stroke-linejoin="round"/>
  <path d="M38 62 L54 78 L84 44" fill="none" stroke="var(--primary-dark)"
        stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function mountLogo(elId) {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = APP_ICON_SVG;
}

// ---- Tema claro/escuro ----
function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = tema === "dark" ? "☀️" : "🌙";
}
function initTema() {
  const salvo = localStorage.getItem("app_tema") || "light";
  aplicarTema(salvo);
}
function alternarTema() {
  const atual = localStorage.getItem("app_tema") || "light";
  const novo = atual === "dark" ? "light" : "dark";
  localStorage.setItem("app_tema", novo);
  aplicarTema(novo);
}
function mountThemeToggle() {
  if (document.getElementById("theme-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "theme-toggle";
  btn.className = "theme-toggle";
  btn.type = "button";
  btn.title = "Alternar tema claro/escuro";
  btn.addEventListener("click", alternarTema);
  document.body.appendChild(btn);
  aplicarTema(localStorage.getItem("app_tema") || "light");
}

document.addEventListener("DOMContentLoaded", mountThemeToggle);

// ---- Toast ----
function showToast(msg, isError = false) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = "toast" + (isError ? " error" : "") + " show";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---- Loading overlay ----
function setLoading(shellId, on) {
  const shell = document.getElementById(shellId);
  if (!shell) return;
  let ov = shell.querySelector(".loading-overlay");
  if (on) {
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "loading-overlay";
      ov.textContent = "Carregando...";
      shell.appendChild(ov);
    }
  } else if (ov) {
    ov.remove();
  }
}

// ---- Sessão do usuário logado (inspetor, ppcp, qualidade...) ----
// Usa localStorage (não sessionStorage) de propósito: sessionStorage é
// limpo se a aba fecha, se abre um link em aba nova, ou em alguns
// celulares quando o navegador "descarta" a aba em segundo plano -
// isso causava logout inesperado. localStorage persiste até o usuário
// clicar em "Sair" de verdade.
function setUsuarioLogado(usuario, tipo) {
  localStorage.setItem("app_usuario", usuario);
  localStorage.setItem("app_tipo", tipo);
  localStorage.setItem("app_ultima_atividade", String(Date.now()));
}
function getUsuarioLogado() {
  return localStorage.getItem("app_usuario");
}
function getTipoLogado() {
  return localStorage.getItem("app_tipo");
}
function logoutUsuario() {
  localStorage.removeItem("app_usuario");
  localStorage.removeItem("app_tipo");
  localStorage.removeItem("app_ultima_atividade");
}
// Exige que o usuário logado tenha um dos tipos permitidos (ex: "ppcp",
// ou "inspetor"). Se não, manda pro login.
function exigirPerfil(...tiposPermitidos) {
  const tipo = getTipoLogado();
  if (!getUsuarioLogado() || !tiposPermitidos.includes(tipo)) {
    window.location.href = "login.html";
  }
}

// ---- Logout automático por inatividade (120 minutos) ----
// Guarda o horário da última atividade no localStorage (não só em
// memória), assim funciona mesmo se a pessoa recarregar a página ou
// abrir de novo depois de um tempo - continua contando a partir da
// última interação real, não reseta o relógio à toa.
const LIMITE_INATIVIDADE_MIN = 120;

function registrarAtividade() {
  if (getUsuarioLogado()) {
    localStorage.setItem("app_ultima_atividade", String(Date.now()));
  }
}

function checarInatividade() {
  const usuario = getUsuarioLogado();
  if (!usuario) return;

  const ultima = Number(localStorage.getItem("app_ultima_atividade") || Date.now());
  const minutosParados = (Date.now() - ultima) / 60000;

  if (minutosParados >= LIMITE_INATIVIDADE_MIN) {
    logoutUsuario();
    window.location.href = "login.html?motivo=inatividade";
  }
}

function iniciarMonitorInatividade() {
  if (!getUsuarioLogado()) return;

  checarInatividade();
  registrarAtividade();

  ["mousemove", "mousedown", "keydown", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, registrarAtividade, { passive: true });
  });

  // confere a cada minuto (cobre a aba ficar parada sem eventos novos)
  setInterval(checarInatividade, 60000);
}

// ---- Indicador "logado como" ----
function mountUserBadge() {
  const usuario = getUsuarioLogado();
  const tipo = getTipoLogado();
  if (!usuario || document.getElementById("user-badge")) return;

  const rotulos = { inspetor: "Inspetor", ppcp: "PPCP", qualidade: "Qualidade", admin: "Admin" };
  const badge = document.createElement("div");
  badge.id = "user-badge";
  badge.className = "user-badge";
  badge.textContent = `Logado como: ${usuario} (${rotulos[tipo] || tipo})`;
  document.body.appendChild(badge);
}

document.addEventListener("DOMContentLoaded", () => {
  mountUserBadge();
  iniciarMonitorInatividade();
});

// ---- Compatibilidade com nomes antigos (usados no fluxo do inspetor) ----
function setInspetorLogado(usuario) {
  setUsuarioLogado(usuario, "inspetor");
}
function getInspetorLogado() {
  return getTipoLogado() === "inspetor" ? getUsuarioLogado() : null;
}
function logoutInspetor() {
  logoutUsuario();
}
function exigirLoginInspetor() {
  exigirPerfil("inspetor");
}

// ---- Formatação de data dd/mm/aaaa ----
function formatarData(isoDate) {
  if (!isoDate) return "";
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- Popular um <select> a partir de um array de {id, label} ----
function popularSelect(selectEl, itens, placeholder) {
  selectEl.innerHTML = "";
  const optPh = document.createElement("option");
  optPh.value = "";
  optPh.textContent = placeholder;
  optPh.disabled = true;
  optPh.selected = true;
  selectEl.appendChild(optPh);
  itens.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.label;
    selectEl.appendChild(opt);
  });
}
