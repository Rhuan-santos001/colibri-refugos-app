// =========================================================
// Helpers compartilhados por todas as páginas
// =========================================================

// ---- Logo do colibri em SVG (mesma silhueta do app original) ----
const COLIBRI_SVG = `
<svg viewBox="0 0 512 300" xmlns="http://www.w3.org/2000/svg" fill="#2fbf82">
  <path d="M40 190 C 120 140, 190 120, 250 95 C 300 75, 360 55, 470 40
           C 400 60, 340 85, 300 115 C 340 110, 400 118, 470 150
           C 380 140, 300 150, 250 175 C 200 200, 140 215, 40 190 Z"/>
</svg>`;

function mountLogo(elId) {
  const el = document.getElementById(elId);
  if (el) el.innerHTML = COLIBRI_SVG;
}

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

// ---- Sessão do usuário logado (inspetor ou ppcp), guardada no navegador ----
function setUsuarioLogado(usuario, tipo) {
  sessionStorage.setItem("colibri_usuario", usuario);
  sessionStorage.setItem("colibri_tipo", tipo);
}
function getUsuarioLogado() {
  return sessionStorage.getItem("colibri_usuario");
}
function getTipoLogado() {
  return sessionStorage.getItem("colibri_tipo");
}
function logoutUsuario() {
  sessionStorage.removeItem("colibri_usuario");
  sessionStorage.removeItem("colibri_tipo");
}
// Exige que o usuário logado tenha um dos tipos permitidos (ex: "ppcp",
// ou "inspetor"). Se não, manda pro login.
function exigirPerfil(...tiposPermitidos) {
  const tipo = getTipoLogado();
  if (!getUsuarioLogado() || !tiposPermitidos.includes(tipo)) {
    window.location.href = "login.html";
  }
}

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
