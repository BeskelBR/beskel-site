"use strict";

const app = document.getElementById("app");
const API = "/api/mock";
const DEMO_TOKEN = "demo-rafael";
const TERMINAL_ID = "HVB-T01";
const BIOMETRIC_DEVICE_ID = "HVB-T01-BIO-DEV";
const AUTH_KEY = "hvb_access_auth";
const WHATSAPP_KEY = "hvb_dev_whatsapp";

const state = {
  identity:null,
  evidence:null,
  auth:readJson(AUTH_KEY),
  access:null,
  selectedOrders:new Set(),
  biometricInProgress:false
};

function readJson(key){ try{return JSON.parse(sessionStorage.getItem(key)||"null");}catch{return null;} }
function writeJson(key,value){ sessionStorage.setItem(key,JSON.stringify(value)); }
function clearLocal(){ sessionStorage.removeItem(AUTH_KEY); state.identity=null; state.evidence=null; state.auth=null; state.access=null; state.selectedOrders.clear(); state.biometricInProgress=false; }
function esc(value){ return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function go(path){
  history.pushState({},"",path);
  window.scrollTo({top:0,behavior:"instant"});
  router();
}
function nowLabel(){ return new Date().toLocaleString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function commandId(prefix="cmd"){
  const suffix=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}
function shell(content,title="Terminal de Acesso"){
  return `<div class="screen"><div class="dev-banner">Ambiente de desenvolvimento • Hardware e dados simulados</div><header class="topbar"><div class="brand-inline"><img src="/hvb/assets/logo-lateral.webp" alt="Hospital Veterinário Brasília"><div class="topbar-title">${esc(title)}</div></div><div class="clock" id="clock">${nowLabel()}</div></header><main class="content">${content}</main></div>`;
}
function render(html){ app.innerHTML=html; updateClock(); }
function updateClock(){ const el=document.getElementById("clock"); if(el)el.textContent=nowLabel(); }
setInterval(updateClock,30000);

function normalizeWhatsapp(value){
  const digits=String(value||"").replace(/\D/g,"");
  if(!digits)return "";
  if(digits.length===11)return `55${digits}`;
  if(digits.length===13&&digits.startsWith("55"))return digits;
  return digits.length>=10&&digits.length<=15?digits:"";
}
function configuredWhatsapp(){ return normalizeWhatsapp(localStorage.getItem(WHATSAPP_KEY)||""); }
function saveWhatsapp(value){
  const normalized=normalizeWhatsapp(value);
  if(!normalized)throw new Error("INVALID_WHATSAPP_NUMBER");
  localStorage.setItem(WHATSAPP_KEY,normalized);
  return normalized;
}
function maskWhatsapp(value){
  const digits=normalizeWhatsapp(value);
  if(!digits)return "não configurado";
  const local=digits.startsWith("55")?digits.slice(2):digits;
  return `(${local.slice(0,2)}) *****-${local.slice(-4)}`;
}
function captureWhatsappFromUrl(){
  const url=new URL(location.href);
  const incoming=url.searchParams.get("whatsapp");
  if(!incoming)return;
  const normalized=normalizeWhatsapp(incoming);
  if(normalized)localStorage.setItem(WHATSAPP_KEY,normalized);
  url.searchParams.delete("whatsapp");
  history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);
}
function withdrawalMessage(orders){
  const lines=["HVB — Lista de retirada","",`${orders.length} ordem(ns) selecionada(s)`];
  orders.forEach(order=>{
    lines.push("",order.order_id);
    (order.items||[]).forEach(item=>lines.push(`- ${item.description} — ${item.quantity}${item.sensitive?" [SENSÍVEL]":""}`));
  });
  lines.push("","Mensagem de apoio operacional. A escrituração oficial ocorre na API HVB.");
  return lines.join("\n");
}
function openWhatsapp(orders){
  const phone=configuredWhatsapp();
  if(!phone){ alert("Configure primeiro o WhatsApp de teste neste dispositivo."); return; }
  const url=`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(withdrawalMessage(orders))}`;
  window.open(url,"_blank","noopener,noreferrer");
}
function whatsappPanel(orders){
  const phone=configuredWhatsapp();
  return `<div class="dev-panel whatsapp-panel"><div class="eyebrow">WhatsApp • DEV</div><p>Notificação complementar. O botão apenas abre o WhatsApp com a lista pré-preenchida; o envio continua sob confirmação humana.</p><div class="whatsapp-config"><input id="whatsappNumber" inputmode="tel" autocomplete="tel" placeholder="(61) 99999-9999" value="${phone?esc(phone):""}"><button class="btn ghost" id="saveWhatsapp">Salvar neste dispositivo</button></div><div class="order-meta"><span>Destino: ${esc(maskWhatsapp(phone))}</span><span>${orders.length} ordem(ns)</span></div><div class="actions"><button class="btn secondary" id="openWhatsapp" ${orders.length?"":"disabled"}>Abrir WhatsApp com a lista</button></div></div>`;
}
function bindWhatsapp(orders){
  const input=document.getElementById("whatsappNumber");
  const save=document.getElementById("saveWhatsapp");
  const open=document.getElementById("openWhatsapp");
  if(save&&input)save.addEventListener("click",()=>{
    try{
      const value=saveWhatsapp(input.value);
      input.value=value;
      alert(`WhatsApp de teste salvo: ${maskWhatsapp(value)}`);
    }catch{ alert("Número inválido. Informe DDD + número."); }
  });
  if(open)open.addEventListener("click",()=>openWhatsapp(orders));
}

async function parseResponse(res){
  let body;
  try{ body=await res.json(); }catch{ throw new Error("INVALID_API_RESPONSE"); }
  if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED");
  return body.data;
}
async function apiGet(params){
  let res;
  try{ res=await fetch(`${API}?${new URLSearchParams(params)}`,{cache:"no-store"}); }
  catch{ throw new Error("API_UNREACHABLE"); }
  return parseResponse(res);
}
async function apiPost(payload){
  let res;
  try{ res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); }
  catch{ throw new Error("API_UNREACHABLE"); }
  return parseResponse(res);
}
function isConnectivityError(error){ return ["API_UNREACHABLE","INVALID_API_RESPONSE"].includes(error?.message); }
function failClosed(message="A API HVB não está disponível. Nenhum novo acesso será autorizado por este Terminal."){
  clearLocal();
  showError("Terminal indisponível",message,"/");
}

function idleScreen(){
  clearLocal();
  render(`<section class="hero-idle"><div class="idle-card"><img class="logo-main" src="/hvb/assets/logo-principal.webp" alt="Hospital Veterinário Brasília"><div class="module-label">Terminal de Acesso HVB</div><h1 class="idle-title" style="color:#fff">Aproxime seu crachá</h1><div class="nfc-mark" aria-hidden="true">◉</div><p style="font-size:18px;margin:0 0 10px">DESFire EV3 + confirmação facial</p><div class="status-pill" id="terminalStatus"><span class="status-dot"></span><span id="terminalStatusText">Verificando serviço…</span></div><div class="idle-clock">${nowLabel()}</div><button class="dev-action" id="simulateBadge" disabled>Verificando Terminal…</button></div></section>`);
  checkTerminalAvailability();
}

async function checkTerminalAvailability(){
  const btn=document.getElementById("simulateBadge");
  const status=document.getElementById("terminalStatus");
  const text=document.getElementById("terminalStatusText");
  if(!btn||!status||!text)return;
  try{
    await apiGet({action:"terminal",terminal_id:TERMINAL_ID});
    text.textContent="Serviço disponível • pronto para autenticação";
    btn.disabled=false;
    btn.textContent="Simular credencial de teste";
    btn.addEventListener("click",()=>go(`/auth/${DEMO_TOKEN}`),{once:true});
  }catch{
    text.textContent="API indisponível • acesso bloqueado";
    status.classList.add("offline");
    btn.disabled=true;
    btn.textContent="Fail-closed ativo";
  }
}

async function credentialScreen(token){
  render(shell(`<div class="card"><div class="eyebrow">Etapa 1 de 2</div><h1>Identificando credencial…</h1><p class="lead">Validando a identidade alegada pela credencial.</p></div>`,"Autenticação"));
  try{
    state.identity=await apiPost({action:"identifyCredential",token,terminal_id:TERMINAL_ID});
    const p=state.identity.employee;
    render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Credencial identificada</div><h1>${esc(p.name)}</h1><div class="person"><span class="role">${esc(p.role)}</span></div><div class="factor-list"><div class="factor ok"><b>✓</b><span>DESFire identificado</span></div><div class="factor pending"><b>2</b><span>Iniciando face 1:1 + liveness automaticamente</span></div></div><p class="footer-note">DEV: a captura facial é simulada; em produção a câmera inicia imediatamente após a leitura NFC.</p></div>`,"Autenticação"));
    return verifyIdentity();
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    showError("Credencial não reconhecida","Não foi possível iniciar a autenticação.");
  }
}

async function verifyIdentity(){
  if(!state.identity)return go("/");
  if(state.biometricInProgress)return;
  state.biometricInProgress=true;
  render(shell(`<div class="card"><div class="eyebrow">Etapa 2 de 2</div><h1>Verificando rosto e presença…</h1><p class="lead">Comparação 1:1 + liveness/PAD iniciada automaticamente após a NFC.</p><div class="scan-frame"><div class="scan-face">◎</div><span>Simulação local</span></div></div>`,"Autenticação biométrica"));
  try{
    state.evidence=await apiPost({
      action:"createBiometricEvidence",
      challenge_id:state.identity.challenge_id,
      terminal_id:TERMINAL_ID,
      device_id:BIOMETRIC_DEVICE_ID,
      face_match:true,
      liveness:true
    });
    state.auth=await apiPost({
      action:"verifyIdentity",
      challenge_id:state.identity.challenge_id,
      evidence_id:state.evidence.evidence_id,
      terminal_id:TERMINAL_ID
    });
    writeJson(AUTH_KEY,state.auth);
    render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Identidade confirmada</div><h1>${esc(state.auth.employee.name)}</h1><div class="factor-list"><div class="factor ok"><b>✓</b><span>DESFire EV3</span></div><div class="factor ok"><b>✓</b><span>Face 1:1</span></div><div class="factor ok"><b>✓</b><span>Liveness/PAD</span></div></div><p class="footer-note">Carregando automaticamente as ordens disponíveis…</p></div>`,"Autenticação concluída"));
    setTimeout(()=>go("/ordens"),250);
  }catch(error){
    state.biometricInProgress=false;
    if(isConnectivityError(error))return failClosed();
    showError("Identidade não confirmada","Acesso não autorizado. Tente novamente.");
  }
}

function materialsList(order){
  return `<div class="materials-list">${(order.items||[]).map(item=>`<div class="material-row"><span>${esc(item.description)}</span><strong>${esc(item.quantity)}</strong>${item.sensitive?`<span class="chip sensitive">Sensível</span>`:""}</div>`).join("")}</div>`;
}
function orderCard(order){
  return `<label class="order-card selectable" data-order-card="${esc(order.order_id)}"><div class="order-select"><input type="checkbox" class="order-checkbox" value="${esc(order.order_id)}"><span class="check-ui" aria-hidden="true"></span></div><div class="order-main"><div class="row"><div><div class="eyebrow">${esc(order.order_id)}</div><strong>${esc(order.patient?.name||"Paciente")}</strong></div>${order.has_sensitive_items?`<span class="chip sensitive">Sensível</span>`:`<span class="chip">Comum</span>`}</div><div class="order-meta"><span>${esc(order.episode_id)}</span><span>${order.item_count} itens</span><span>${order.total_units} unidades</span></div>${materialsList(order)}</div></label>`;
}
function selectedOrdersFrom(orders){ return orders.filter(order=>state.selectedOrders.has(order.order_id)); }
function updateOrderSelection(orders){
  const selected=selectedOrdersFrom(orders);
  const count=document.getElementById("selectedCount");
  const authorize=document.getElementById("authorizeSelected");
  const whats=document.getElementById("whatsappSelected");
  if(count)count.textContent=`${selected.length} ordem(ns) selecionada(s)`;
  if(authorize){ authorize.disabled=selected.length===0; authorize.textContent=selected.length?`Confirmar ${selected.length} ordem(ns) e autorizar acesso`:"Selecione ao menos uma ordem"; }
  if(whats)whats.disabled=selected.length===0;
}

async function ordersScreen(){
  const auth=readJson(AUTH_KEY);
  if(!auth?.auth_session_id||auth.expires_at<Date.now())return go("/");
  state.auth=auth;
  state.selectedOrders.clear();
  try{
    const orders=await apiGet({action:"pendingOrders",auth_session_id:auth.auth_session_id});
    const cards=orders.length?orders.map(orderCard).join(""):`<div class="card"><h2>Nenhuma ordem pendente</h2><p class="lead">Não há ordens aguardando retirada.</p></div>`;
    render(shell(`<div class="eyebrow">Usuário autenticado</div><h1>${esc(auth.employee.name)}</h1><p class="lead">Confira os materiais e selecione uma ou mais Ordens de Retirada. O Terminal confirma o contexto do acesso; o picking detalhado continua no HVB Mobile.</p><div class="selection-toolbar"><div><div class="section-title">Ordens aguardando retirada</div><strong id="selectedCount">0 ordem(ns) selecionada(s)</strong></div><div class="selection-actions"><button class="btn ghost" id="selectAll" ${orders.length?"":"disabled"}>Selecionar todas</button><button class="btn ghost" id="clearAll" disabled>Limpar</button></div></div><div class="list">${cards}</div><div class="sticky-actions"><button class="btn" id="authorizeSelected" disabled>Selecione ao menos uma ordem</button><button class="btn secondary" id="whatsappSelected" disabled>WhatsApp com selecionadas</button><button class="btn ghost" id="cancel">Encerrar autenticação</button></div>${whatsappPanel([])}`,"Ordens e materiais"));

    document.querySelectorAll(".order-checkbox").forEach(input=>input.addEventListener("change",()=>{
      if(input.checked)state.selectedOrders.add(input.value);else state.selectedOrders.delete(input.value);
      const card=input.closest("[data-order-card]");
      if(card)card.classList.toggle("selected",input.checked);
      const clear=document.getElementById("clearAll");
      if(clear)clear.disabled=state.selectedOrders.size===0;
      updateOrderSelection(orders);
    }));
    document.getElementById("selectAll")?.addEventListener("click",()=>{
      document.querySelectorAll(".order-checkbox").forEach(input=>{ input.checked=true; state.selectedOrders.add(input.value); input.closest("[data-order-card]")?.classList.add("selected"); });
      document.getElementById("clearAll").disabled=false;
      updateOrderSelection(orders);
    });
    document.getElementById("clearAll")?.addEventListener("click",()=>{
      document.querySelectorAll(".order-checkbox").forEach(input=>{ input.checked=false; input.closest("[data-order-card]")?.classList.remove("selected"); });
      state.selectedOrders.clear();
      document.getElementById("clearAll").disabled=true;
      updateOrderSelection(orders);
    });
    document.getElementById("authorizeSelected")?.addEventListener("click",()=>authorizeAccess([...state.selectedOrders]));
    document.getElementById("whatsappSelected")?.addEventListener("click",()=>openWhatsapp(selectedOrdersFrom(orders)));
    document.getElementById("cancel").addEventListener("click",()=>go("/"));
    bindWhatsapp([]);
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    go("/");
  }
}

async function authorizeAccess(orderIds){
  if(!state.auth?.auth_session_id)return go("/");
  const ids=[...new Set((orderIds||[]).filter(Boolean))];
  if(!ids.length)return;
  render(shell(`<div class="card"><div class="eyebrow">Autorização</div><h1>Validando ${ids.length} ordem(ns)…</h1><p class="lead">A API está verificando ordens, permissões e sensibilidade do conjunto selecionado.</p></div>`,"Controle de acesso"));
  try{
    state.access=await apiPost({
      action:"startAccessSession",
      auth_session_id:state.auth.auth_session_id,
      order_ids:ids,
      terminal_id:TERMINAL_ID,
      command_id:commandId("access")
    });
    go(`/acesso/${encodeURIComponent(state.access.access_session_id)}`);
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    const msg=error.message==="SENSITIVE_ACCESS_DENIED"?"Seu perfil não possui autorização para os itens sensíveis presentes nas ordens selecionadas.":"Não foi possível criar a sessão de acesso.";
    showError("Acesso não autorizado",msg,"/ordens");
  }
}

const stateLabel=value=>({
  DOOR_AUTHORIZED:"Porta autorizada",
  DOOR_OPEN:"Porta aberta",
  ENTRY_CONFIRMED:"Entrada confirmada",
  SENSITIVE_CABINET_AUTHORIZED:"Armário sensível autorizado",
  SENSITIVE_CABINET_OPEN:"Armário sensível aberto",
  ACCESS_ACTIVE:"Acesso ativo",
  CLOSED:"Sessão encerrada",
  EXPIRED:"Sessão expirada"
}[value]||value);

function accessOrders(access){
  return (access.orders||[]).map(order=>`<div class="access-order"><div class="row"><div><div class="eyebrow">${esc(order.order_id)}</div><strong>${esc(order.patient?.name||"Paciente")}</strong></div>${order.has_sensitive_items?`<span class="chip sensitive">Sensível</span>`:`<span class="chip">Comum</span>`}</div><div class="order-meta"><span>${esc(order.episode_id)}</span><span>${order.item_count} itens</span></div>${materialsList(order)}</div>`).join("");
}

async function accessScreen(accessSessionId){
  try{
    const access=await apiGet({action:"accessSession",id:accessSessionId});
    if(!access)return go("/");
    state.access=access;
    const totalItems=(access.orders||[]).reduce((sum,order)=>sum+(order.item_count||0),0);
    const sensitive=access.sensitive_access?`<div class="notice sensitive-notice"><b>Estoque sensível</b><span>O armário só será autorizado depois da entrada confirmada e da porta fechada.</span></div>`:"";
    render(shell(`<div class="access-banner"><div class="big-check">✓</div><div><div class="eyebrow">Acesso autorizado</div><h1>${esc(access.employee?.name||"Funcionário")}</h1></div></div><div class="card"><div class="summary"><div class="summary-row"><span>Ordens</span><strong>${access.orders?.length||0}</strong></div><div class="summary-row"><span>Itens listados</span><strong>${totalItems}</strong></div><div class="summary-row"><span>Status físico</span><strong>${esc(stateLabel(access.state))}</strong></div></div></div>${sensitive}<div class="section-title">Materiais vinculados a esta sessão</div><div class="access-orders">${accessOrders(access)}</div><div class="notice"><b>Conferência no Terminal</b><span>A lista acima confirma o contexto das ordens selecionadas. A conferência item a item, ajustes e confirmação final continuam no HVB Mobile.</span></div>${whatsappPanel(access.orders||[])}${devControls(access)}<p class="footer-note">DEV: controladores, sensores, câmera e DESFire estão simulados. Nenhum movimento de estoque é realizado.</p>`,"Sessão de acesso"));
    bindWhatsapp(access.orders||[]);
    bindDev(access);
  }catch(error){
    if(isConnectivityError(error))return failClosed("A API HVB ficou indisponível. O Terminal não emitirá novas autorizações ou transições de barreira enquanto estiver desconectado.");
    go("/");
  }
}

function devControls(access){
  let button="";
  if(access.state==="DOOR_AUTHORIZED")button=`<button class="btn secondary" data-event="DOOR_OPENED">Simular porta aberta</button>`;
  else if(access.state==="DOOR_OPEN")button=`<button class="btn secondary" data-event="ENTRY_CONFIRMED">Simular sensor de entrada</button>`;
  else if(access.state==="ENTRY_CONFIRMED")button=`<button class="btn secondary" data-event="DOOR_CLOSED">Simular porta fechada</button>`;
  else if(access.state==="SENSITIVE_CABINET_AUTHORIZED")button=`<button class="btn secondary" data-event="SENSITIVE_CABINET_OPENED">Simular armário aberto</button>`;
  else if(access.state==="SENSITIVE_CABINET_OPEN")button=`<button class="btn secondary" data-event="SENSITIVE_CABINET_CLOSED">Simular armário fechado</button>`;
  else if(access.state==="ACCESS_ACTIVE")button=`<button class="btn secondary" data-event="ACCESS_CLOSED">Encerrar sessão de acesso</button>`;
  else button=`<button class="btn ghost" id="finish">Voltar ao terminal</button>`;
  return `<div class="dev-panel"><div class="eyebrow">Controles DEV</div><p>Simulação da sequência física. Estes botões serão substituídos pelos eventos do controlador/sensores.</p><div class="actions">${button}</div></div>`;
}

function bindDev(access){
  document.querySelectorAll("[data-event]").forEach(btn=>btn.addEventListener("click",async()=>{
    btn.disabled=true;
    try{
      await apiPost({
        action:"registerAccessEvent",
        access_session_id:access.access_session_id,
        event_type:btn.dataset.event,
        command_id:commandId("event"),
        source_occurred_at:new Date().toISOString(),
        source_device_id:TERMINAL_ID,
        metadata:{source:"dev-ui"}
      });
      accessScreen(access.access_session_id);
    }catch(error){
      if(isConnectivityError(error))return failClosed("Conectividade perdida durante a sessão. O protótipo interrompe novas transições e mantém fail-closed.");
      btn.disabled=false;
      alert("A sequência física simulada não permitiu este evento.");
    }
  }));
  const finish=document.getElementById("finish");
  if(finish)finish.addEventListener("click",()=>go("/"));
}

async function auditScreen(){
  try{
    const auth=readJson(AUTH_KEY);
    if(!auth?.auth_session_id||auth.expires_at<Date.now())return go("/");
    const audit=await apiGet({action:"audit",auth_session_id:auth.auth_session_id});
    const rows=audit.length?audit.map(e=>`<div class="audit-row"><div class="time">${new Date(e.occurred_at).toLocaleString("pt-BR")}</div><strong>${esc(e.event_type)}</strong><div>${esc(e.employee?.name||"Sistema")} • ${esc(e.terminal_id||"—")}</div><div class="meta">${esc(e.access_session_id||e.auth_session_id||"sem sessão")}</div></div>`).join(""):`<div class="card"><p class="lead">Nenhum evento registrado nesta execução.</p></div>`;
    render(shell(`<div class="eyebrow">Somente leitura</div><h1>Auditoria do Terminal</h1><p class="lead">Eventos simulados de identidade, evidência e acesso físico.</p><div class="stack">${rows}</div><div class="actions"><button class="btn ghost" id="back">Voltar</button></div>`,"Auditoria"));
    document.getElementById("back").addEventListener("click",()=>go("/"));
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    go("/");
  }
}

function deprecatedScreen(){
  render(shell(`<div class="card"><div class="eyebrow">Fluxo legado</div><h1>Esta função mudou de lugar</h1><p class="lead">O Terminal agora exibe as Ordens de Retirada e seus materiais para confirmação de contexto, mas picking item a item e escrituração permanecem no HVB Mobile/API.</p><div class="actions"><button class="btn" id="home">Ir para o Terminal de Acesso</button></div></div>`,"Arquitetura v2"));
  document.getElementById("home").addEventListener("click",()=>go("/"));
}

function showError(title,message,back="/"){
  render(shell(`<div class="card"><div class="big-error">!</div><div class="eyebrow">Operação interrompida</div><h1>${esc(title)}</h1><p class="lead">${esc(message)}</p><div class="actions"><button class="btn ghost" id="back">Voltar</button></div></div>`,"Terminal de Acesso"));
  document.getElementById("back").addEventListener("click",()=>go(back));
}

function router(){
  const path=location.pathname;
  const auth=path.match(/^\/auth\/([^/]+)$/);
  const access=path.match(/^\/acesso\/([^/]+)$/);
  if(path==="/")return idleScreen();
  if(auth)return credentialScreen(decodeURIComponent(auth[1]));
  if(path==="/ordens")return ordersScreen();
  if(access)return accessScreen(decodeURIComponent(access[1]));
  if(path==="/admin/auditoria")return auditScreen();
  if(["/atendimentos","/materiais","/retirada","/sucesso"].includes(path)||/^\/atendimento\//.test(path))return deprecatedScreen();
  return go("/");
}

window.addEventListener("popstate",router);
// Bootstrap intentionally occurs after terminal-v4.js loads, so the approved v4
// functions are installed before the first route is rendered.