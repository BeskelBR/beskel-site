"use strict";

const app = document.getElementById("app");
const API = "/api/mock";
const DEMO_TOKEN = "hvb_demo_Q7m4xP9nK2";
const SESSION_KEY = "hvb_dev_session";
const CREDENTIAL_KEY = "hvb_dev_credential_token";
const LAST_TX_KEY = "hvb_dev_last_transaction";

const state = {
  session: readJson(SESSION_KEY),
  attendance: null,
  item: null,
  quantity: 1
};

function readJson(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
function writeJson(key, value) { sessionStorage.setItem(key, JSON.stringify(value)); }
function money(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function go(path) { history.pushState({}, "", path); router(); }
function nowLabel() { return new Date().toLocaleString("pt-BR", { weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }); }
function shell(content, title="Controle de Materiais") {
  return `<div class="screen"><div class="dev-banner">Ambiente de desenvolvimento • Dados fictícios</div><header class="topbar"><div class="brand-inline"><img src="/hvb/assets/logo-lateral.webp" alt="Hospital Veterinário Brasília"><div class="topbar-title">${escapeHtml(title)}</div></div><div class="clock" id="clock">${nowLabel()}</div></header><main class="content">${content}</main></div>`;
}
function render(html) {
  app.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "instant" });
  updateClock();
}
function updateClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = nowLabel();
}
setInterval(updateClock, 30000);

async function apiGet(params) {
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error || "REQUEST_FAILED");
  return body.data;
}
async function apiPost(payload) {
  const res = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload) });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error || "REQUEST_FAILED");
  return body.data;
}

function getSession() {
  const session = readJson(SESSION_KEY);
  if (!session || !session.expires_at || session.expires_at < Date.now()) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  state.session = session;
  return session;
}

async function ensureSession() {
  let session = getSession();
  if (session) return session;
  const token = sessionStorage.getItem(CREDENTIAL_KEY);
  if (!token) return null;
  try {
    session = await apiPost({ action:"auth", token });
    writeJson(SESSION_KEY, session);
    state.session = session;
    return session;
  } catch {
    sessionStorage.removeItem(CREDENTIAL_KEY);
    return null;
  }
}

function idleScreen() {
  render(`<section class="hero-idle"><div class="idle-card"><img class="logo-main" src="/hvb/assets/logo-principal.webp" alt="Hospital Veterinário Brasília"><div class="module-label">Controle de Materiais</div><h1 class="idle-title" style="color:#fff">Terminal disponível</h1><div class="nfc-mark" aria-hidden="true">◉</div><p style="font-size:18px;margin:0 0 10px">Aproxime seu crachá NFC</p><div class="status-pill"><span class="status-dot"></span>Pronto para autenticação</div><div class="idle-clock">${nowLabel()}</div><button class="dev-action" id="simulateBadge">Simular crachá de teste</button></div></section>`);
  document.getElementById("simulateBadge").addEventListener("click", () => go(`/auth/${DEMO_TOKEN}`));
}

async function authScreen(token) {
  render(shell(`<div class="card"><div class="eyebrow">Autenticação</div><h1>Identificando crachá…</h1><p class="lead">Aguarde um instante.</p></div>`, "Autenticação"));
  try {
    const session = await apiPost({ action:"auth", token });
    sessionStorage.setItem(CREDENTIAL_KEY, token);
    writeJson(SESSION_KEY, session);
    state.session = session;
    render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Crachá identificado</div><h1>Autenticação realizada</h1><div class="person"><strong>${escapeHtml(session.employee.name)}</strong><span class="role">${escapeHtml(session.employee.role)}</span></div><div class="actions"><button class="btn" id="continue">Localizar atendimento</button></div><p class="footer-note">Sessão temporária ativa por 15 minutos.</p></div>`, "Autenticação"));
    document.getElementById("continue").addEventListener("click", () => go("/atendimentos"));
  } catch {
    render(shell(`<div class="card"><div class="big-error">!</div><div class="eyebrow">Autenticação</div><h1>Credencial não reconhecida</h1><p class="lead">Não foi possível iniciar uma sessão com esta credencial.</p><div class="actions"><button class="btn ghost" id="back">Voltar ao terminal</button></div></div>`, "Autenticação"));
    document.getElementById("back").addEventListener("click", () => go("/"));
  }
}

async function attendancesScreen() {
  const session = await ensureSession();
  if (!session) return go("/");
  const attendances = await apiGet({ action:"attendances" });
  const content = `<div class="eyebrow">Funcionário</div><h1>${escapeHtml(session.employee.name)}</h1><p class="lead">Selecione um atendimento ativo.</p><div class="search-wrap"><input class="search" id="search" placeholder="Pesquisar PET, tutor ou atendimento" autocomplete="off" aria-label="Pesquisar atendimento"></div><div class="section-title">Atendimentos ativos</div><div class="list" id="attendanceList"></div><p class="footer-note">Somente dados fictícios neste protótipo.</p>`;
  render(shell(content, "Selecionar atendimento"));
  const list = document.getElementById("attendanceList");
  const search = document.getElementById("search");
  function paint(query="") {
    const q = query.trim().toLowerCase();
    const filtered = attendances.filter(a => {
      const p = a.patient || {};
      return !q || [p.name,p.tutor,a.attendance_id].some(v => String(v||"").toLowerCase().includes(q));
    });
    list.innerHTML = filtered.length ? filtered.map(a => `<button class="list-card" data-id="${escapeHtml(a.attendance_id)}"><strong>${escapeHtml(a.patient.name)}</strong><div class="line"><span>${escapeHtml(a.patient.species)}</span><span>Atendimento #${escapeHtml(a.attendance_id)}</span></div><div class="meta">Tutor: ${escapeHtml(a.patient.tutor)}</div></button>`).join("") : `<div class="card"><p>Nenhum atendimento encontrado.</p></div>`;
    list.querySelectorAll("[data-id]").forEach(btn => btn.addEventListener("click", () => go(`/atendimento/${btn.dataset.id}`)));
  }
  paint();
  search.addEventListener("input", e => paint(e.target.value));
}

async function attendanceScreen(id) {
  const session = await ensureSession();
  if (!session) return go("/");
  const attendance = await apiGet({ action:"attendance", id });
  if (!attendance) return render(shell(`<div class="card"><h1>Atendimento não encontrado</h1><button class="btn ghost" id="back">Voltar</button></div>`));
  state.attendance = attendance;
  const txs = attendance.transactions || [];
  const rows = txs.length ? txs.map(t => `<div class="audit-row"><div class="time">${new Date(t.timestamp).toLocaleTimeString("pt-BR")}</div><strong>${escapeHtml(t.item_id)}</strong><div>${t.quantity} item(ns) • ${money(t.total)}</div></div>`).join("") : `<div class="card"><p class="lead" style="margin:0">Nenhum material registrado nesta demonstração.</p></div>`;
  render(shell(`<div class="eyebrow">Atendimento selecionado</div><h1>${escapeHtml(attendance.patient.name)}</h1><div class="info-strip"><div class="info-box"><span>Espécie</span><strong>${escapeHtml(attendance.patient.species)}</strong></div><div class="info-box"><span>Atendimento</span><strong>#${escapeHtml(attendance.attendance_id)}</strong></div></div><div class="card"><div class="summary"><div class="summary-row"><span>Tutor</span><strong>${escapeHtml(attendance.patient.tutor)}</strong></div><div class="summary-row"><span>Funcionário</span><strong>${escapeHtml(session.employee.name)}</strong></div></div></div><div class="actions"><button class="btn" id="material">+ Registrar material</button><button class="btn ghost" id="change">Trocar atendimento</button></div><div class="section-title">Materiais registrados</div><div class="stack">${rows}</div>`, "Atendimento"));
  document.getElementById("material").addEventListener("click", () => go(`/materiais?attendance=${encodeURIComponent(id)}`));
  document.getElementById("change").addEventListener("click", () => go("/atendimentos"));
}

async function materialsScreen(attendanceId) {
  const session = await ensureSession();
  if (!session) return go("/");
  const items = await apiGet({ action:"items" });
  const content = `<div class="eyebrow">Material</div><h1>Selecione o produto</h1><p class="lead">Pesquise pelo nome ou SKU.</p><div class="search-wrap"><input class="search" id="search" placeholder="Nome ou código do material" autocomplete="off"></div><div class="list" id="itemList"></div>`;
  render(shell(content, "Selecionar material"));
  const list = document.getElementById("itemList");
  const search = document.getElementById("search");
  function paint(query="") {
    const q = query.trim().toLowerCase();
    const filtered = items.filter(i => !q || i.description.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    list.innerHTML = filtered.map(i => `<button class="list-card" data-item="${escapeHtml(i.item_id)}"><div class="row"><strong>${escapeHtml(i.description)}</strong><span class="chip">${escapeHtml(i.current_stock)} ${escapeHtml(i.unit)}</span></div><div class="line"><span>${escapeHtml(i.sku)}</span><span>${escapeHtml(i.category)}</span><span>${money(i.unit_price)}</span></div></button>`).join("");
    list.querySelectorAll("[data-item]").forEach(btn => btn.addEventListener("click", () => go(`/retirada?attendance=${encodeURIComponent(attendanceId)}&item=${encodeURIComponent(btn.dataset.item)}`)));
  }
  paint();
  search.addEventListener("input", e => paint(e.target.value));
}

async function withdrawalScreen(attendanceId, itemId) {
  const session = await ensureSession();
  if (!session) return go("/");
  const [attendance,item] = await Promise.all([apiGet({action:"attendance",id:attendanceId}), apiGet({action:"item",id:itemId})]);
  if (!attendance || !item) return go("/atendimentos");
  state.attendance = attendance; state.item = item; state.quantity = 1;
  const paint = () => {
    const total = state.quantity * item.unit_price;
    render(shell(`<div class="eyebrow">Confirme a retirada</div><h1>${escapeHtml(item.description)}</h1><div class="info-strip"><div class="info-box"><span>Estoque atual</span><strong>${item.current_stock} ${escapeHtml(item.unit)}</strong></div><div class="info-box"><span>Valor unitário</span><strong>${money(item.unit_price)}</strong></div></div><div class="section-title">Quantidade</div><div class="qty-control"><button id="minus" aria-label="Diminuir quantidade">−</button><div class="qty-value">${state.quantity}</div><button id="plus" aria-label="Aumentar quantidade">+</button></div><div class="card"><div class="summary"><div class="summary-row"><span>Funcionário</span><strong>${escapeHtml(session.employee.name)}</strong></div><div class="summary-row"><span>PET</span><strong>${escapeHtml(attendance.patient.name)}</strong></div><div class="summary-row"><span>Atendimento</span><strong>#${escapeHtml(attendance.attendance_id)}</strong></div><div class="summary-row"><span>Produto</span><strong>${escapeHtml(item.description)}</strong></div><div class="summary-row"><span>Quantidade</span><strong>${state.quantity}</strong></div><div class="summary-row"><span>Valor</span><strong>${money(total)}</strong></div></div></div><div class="actions"><button class="btn" id="confirm">CONFIRMAR RETIRADA</button><button class="btn ghost" id="cancel">Cancelar</button></div><p class="footer-note">Simulação interna do protótipo. Nenhuma integração externa é executada.</p>`, "Revisar retirada"));
    document.getElementById("minus").addEventListener("click", () => { state.quantity=Math.max(1,state.quantity-1); paint(); });
    document.getElementById("plus").addEventListener("click", () => { state.quantity=Math.min(item.current_stock,state.quantity+1); paint(); });
    document.getElementById("cancel").addEventListener("click", () => go(`/atendimento/${attendance.attendance_id}`));
    document.getElementById("confirm").addEventListener("click", confirmWithdrawal);
  };
  async function confirmWithdrawal() {
    const btn = document.getElementById("confirm");
    btn.disabled = true; btn.textContent = "Registrando…";
    try {
      const tx = await apiPost({ action:"registerConsumption", session_id:session.session_id, attendance_id:attendance.attendance_id, item_id:item.item_id, quantity:state.quantity, device:`web-${navigator.userAgent.includes("iPhone")?"iphone":"demo"}` });
      const enriched = { ...tx, employee:session.employee, patient:attendance.patient, item };
      writeJson(LAST_TX_KEY, enriched);
      go("/sucesso");
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        sessionStorage.removeItem(SESSION_KEY);
        const renewed = await ensureSession();
        if (renewed) return paint();
      }
      btn.disabled = false; btn.textContent = "CONFIRMAR RETIRADA";
      alert("Não foi possível registrar a retirada. Revise os dados e tente novamente.");
    }
  }
  paint();
}

function successScreen() {
  const tx = readJson(LAST_TX_KEY);
  if (!tx) return go("/atendimentos");
  render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Operação concluída</div><h1>Retirada registrada</h1><h2>${escapeHtml(tx.item.description)}</h2><p class="lead">Quantidade: ${tx.quantity}</p><div class="success-list"><div class="success-item"><b>✓</b><span>Estoque atualizado: ${tx.previous_stock} → ${tx.resulting_stock}</span></div><div class="success-item"><b>✓</b><span>Vinculado ao atendimento #${escapeHtml(tx.attendance_id)}</span></div><div class="success-item"><b>✓</b><span>${money(tx.total)} incluído na simulação financeira do atendimento</span></div><div class="success-item"><b>✓</b><span>Operação registrada na auditoria do protótipo</span></div></div><div class="actions"><button class="btn" id="same">Registrar outro material</button><button class="btn ghost" id="finish">Encerrar sessão</button></div><p class="footer-note">Não existe integração real com sistema externo nesta versão.</p></div>`, "Retirada registrada"));
  document.getElementById("same").addEventListener("click", () => go(`/atendimento/${tx.attendance_id}`));
  document.getElementById("finish").addEventListener("click", () => { sessionStorage.clear(); go("/"); });
}

async function auditScreen() {
  const rows = await apiGet({ action:"audit" });
  const html = rows.length ? rows.map(t => `<div class="audit-row"><div class="time">${new Date(t.timestamp).toLocaleString("pt-BR")}</div><strong>${escapeHtml(t.employee?.name || t.employee_id)}</strong><div>${escapeHtml(t.patient?.name || t.patient_id)} • #${escapeHtml(t.attendance_id)}</div><div>${escapeHtml(t.item?.description || t.item_id)} • −${t.quantity}</div><div class="meta">Estoque: ${t.previous_stock} → ${t.resulting_stock} • ${money(t.total)}</div></div>`).join("") : `<div class="card"><p class="lead" style="margin:0">Nenhuma transação registrada desde o último reinício do ambiente mock.</p></div>`;
  render(shell(`<div class="eyebrow">Auditoria</div><h1>Transações do protótipo</h1><p class="lead">Histórico somente leitura. Correções futuras devem gerar novas transações.</p><div class="stack">${html}</div><div class="actions"><button class="btn ghost" id="home">Voltar ao terminal</button></div>`, "Auditoria"));
  document.getElementById("home").addEventListener("click", () => go("/"));
}

async function router() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  try {
    if (path === "/") return idleScreen();
    if (path.startsWith("/auth/")) return authScreen(decodeURIComponent(path.split("/").pop()));
    if (path === "/atendimentos") return attendancesScreen();
    if (path.startsWith("/atendimento/")) return attendanceScreen(decodeURIComponent(path.split("/").pop()));
    if (path === "/materiais") return materialsScreen(new URLSearchParams(location.search).get("attendance"));
    if (path === "/retirada") {
      const q = new URLSearchParams(location.search);
      return withdrawalScreen(q.get("attendance"), q.get("item"));
    }
    if (path === "/sucesso") return successScreen();
    if (path === "/admin/auditoria") return auditScreen();
    return go("/");
  } catch (error) {
    console.error(error);
    render(shell(`<div class="card"><div class="big-error">!</div><h1>Não foi possível carregar esta etapa</h1><p class="lead">O ambiente de demonstração encontrou um erro temporário.</p><div class="actions"><button class="btn ghost" id="retry">Voltar ao terminal</button></div></div>`));
    document.getElementById("retry").addEventListener("click", () => go("/"));
  }
}

addEventListener("popstate", router);
router();
