"use strict";

const app = document.getElementById("app");
const API = "/api/mock";
const DEMO_TOKEN = "demo-rafael";
const TERMINAL_ID = "HVB-T01";
const AUTH_KEY = "hvb_access_auth";

const state = { identity:null, auth:readJson(AUTH_KEY), access:null };

function readJson(key){ try{return JSON.parse(sessionStorage.getItem(key)||"null");}catch{return null;} }
function writeJson(key,value){ sessionStorage.setItem(key,JSON.stringify(value)); }
function clearLocal(){ sessionStorage.removeItem(AUTH_KEY); state.identity=null; state.auth=null; state.access=null; }
function esc(value){ return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function go(path){ history.pushState({},"",path); router(); }
function nowLabel(){ return new Date().toLocaleString("pt-BR",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }
function shell(content,title="Terminal de Acesso"){
  return `<div class="screen"><div class="dev-banner">Ambiente de desenvolvimento • Hardware e dados simulados</div><header class="topbar"><div class="brand-inline"><img src="/hvb/assets/logo-lateral.webp" alt="Hospital Veterinário Brasília"><div class="topbar-title">${esc(title)}</div></div><div class="clock" id="clock">${nowLabel()}</div></header><main class="content">${content}</main></div>`;
}
function render(html){ app.innerHTML=html; window.scrollTo({top:0,behavior:"instant"}); updateClock(); }
function updateClock(){ const el=document.getElementById("clock"); if(el)el.textContent=nowLabel(); }
setInterval(updateClock,30000);

async function apiGet(params){
  const res=await fetch(`${API}?${new URLSearchParams(params)}`,{cache:"no-store"});
  const body=await res.json(); if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED"); return body.data;
}
async function apiPost(payload){
  const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const body=await res.json(); if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED"); return body.data;
}

function idleScreen(){
  clearLocal();
  render(`<section class="hero-idle"><div class="idle-card"><img class="logo-main" src="/hvb/assets/logo-principal.webp" alt="Hospital Veterinário Brasília"><div class="module-label">Terminal de Acesso HVB</div><h1 class="idle-title" style="color:#fff">Aproxime seu crachá</h1><div class="nfc-mark" aria-hidden="true">◉</div><p style="font-size:18px;margin:0 0 10px">DESFire EV3 + confirmação facial</p><div class="status-pill"><span class="status-dot"></span>Pronto para autenticação</div><div class="idle-clock">${nowLabel()}</div><button class="dev-action" id="simulateBadge">Simular credencial de teste</button></div></section>`);
  document.getElementById("simulateBadge").addEventListener("click",()=>go(`/auth/${DEMO_TOKEN}`));
}

async function credentialScreen(token){
  render(shell(`<div class="card"><div class="eyebrow">Etapa 1 de 2</div><h1>Identificando credencial…</h1><p class="lead">Validando a identidade alegada pela credencial.</p></div>`,"Autenticação"));
  try{
    state.identity=await apiPost({action:"identifyCredential",token,terminal_id:TERMINAL_ID});
    const p=state.identity.employee;
    render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Credencial identificada</div><h1>${esc(p.name)}</h1><div class="person"><span class="role">${esc(p.role)}</span></div><div class="factor-list"><div class="factor ok"><b>✓</b><span>DESFire identificado</span></div><div class="factor pending"><b>2</b><span>Face 1:1 + liveness pendentes</span></div></div><div class="actions"><button class="btn" id="verify">Confirmar identidade</button><button class="btn ghost" id="cancel">Cancelar</button></div><p class="footer-note">DEV: câmera e biometria ainda estão simuladas.</p></div>`,"Autenticação"));
    document.getElementById("verify").addEventListener("click",verifyIdentity);
    document.getElementById("cancel").addEventListener("click",()=>go("/"));
  }catch{ showError("Credencial não reconhecida","Não foi possível iniciar a autenticação."); }
}

async function verifyIdentity(){
  if(!state.identity)return go("/");
  render(shell(`<div class="card"><div class="eyebrow">Etapa 2 de 2</div><h1>Verificando rosto e presença…</h1><p class="lead">Comparação 1:1 com liveness/PAD.</p><div class="scan-frame"><div class="scan-face">◎</div><span>Simulação local</span></div></div>`,"Autenticação biométrica"));
  try{
    state.auth=await apiPost({action:"verifyIdentity",challenge_id:state.identity.challenge_id,face_match:true,liveness:true,terminal_id:TERMINAL_ID});
    writeJson(AUTH_KEY,state.auth);
    render(shell(`<div class="card"><div class="big-check">✓</div><div class="eyebrow">Identidade confirmada</div><h1>${esc(state.auth.employee.name)}</h1><div class="factor-list"><div class="factor ok"><b>✓</b><span>DESFire EV3</span></div><div class="factor ok"><b>✓</b><span>Face 1:1</span></div><div class="factor ok"><b>✓</b><span>Liveness/PAD</span></div></div><div class="actions"><button class="btn" id="orders">Consultar ordens pendentes</button></div><p class="footer-note">Nenhuma retirada foi registrada.</p></div>`,"Autenticação concluída"));
    document.getElementById("orders").addEventListener("click",()=>go("/ordens"));
  }catch{ showError("Identidade não confirmada","Acesso não autorizado. Tente novamente."); }
}

async function ordersScreen(){
  const auth=readJson(AUTH_KEY); if(!auth?.auth_session_id||auth.expires_at<Date.now())return go("/"); state.auth=auth;
  try{
    const orders=await apiGet({action:"pendingOrders",auth_session_id:auth.auth_session_id});
    const cards=orders.length?orders.map(o=>`<button class="order-card" data-order="${esc(o.order_id)}"><div class="row"><div><div class="eyebrow">${esc(o.order_id)}</div><strong>${esc(o.patient?.name||"Paciente")}</strong></div>${o.has_sensitive_items?`<span class="chip sensitive">Sensível</span>`:`<span class="chip">Comum</span>`}</div><div class="order-meta"><span>${esc(o.episode_id)}</span><span>${o.item_count} itens</span><span>${o.total_units} unidades</span></div><div class="order-cta">Autorizar acesso para esta ordem →</div></button>`).join(""):`<div class="card"><h2>Nenhuma ordem pendente</h2><p class="lead">Não há ordens aguardando retirada.</p></div>`;
    render(shell(`<div class="eyebrow">Usuário autenticado</div><h1>${esc(auth.employee.name)}</h1><p class="lead">Selecione a ordem que motivará este acesso. O picking será feito no HVB Mobile.</p><div class="section-title">Ordens aguardando retirada</div><div class="list">${cards}</div><div class="actions"><button class="btn ghost" id="cancel">Encerrar autenticação</button></div>`,"Ordens pendentes"));
    document.querySelectorAll("[data-order]").forEach(btn=>btn.addEventListener("click",()=>authorizeAccess(btn.dataset.order)));
    document.getElementById("cancel").addEventListener("click",()=>go("/"));
  }catch{ go("/"); }
}

async function authorizeAccess(orderId){
  if(!state.auth?.auth_session_id)return go("/");
  render(shell(`<div class="card"><div class="eyebrow">Autorização</div><h1>Validando acesso…</h1><p class="lead">A API está verificando ordem, permissões e sensibilidade.</p></div>`,"Controle de acesso"));
  try{
    state.access=await apiPost({action:"startAccessSession",auth_session_id:state.auth.auth_session_id,order_ids:[orderId],terminal_id:TERMINAL_ID});
    go(`/acesso/${encodeURIComponent(state.access.access_session_id)}`);
  }catch(error){
    const msg=error.message==="SENSITIVE_ACCESS_DENIED"?"Seu perfil não possui autorização para os itens sensíveis desta ordem.":"Não foi possível criar a sessão de acesso.";
    showError("Acesso não autorizado",msg,"/ordens");
  }
}

const stateLabel=value=>({DOOR_AUTHORIZED:"Porta autorizada",DOOR_OPEN:"Porta aberta",ENTRY_CONFIRMED:"Entrada confirmada",SENSITIVE_CABINET_AUTHORIZED:"Armário sensível autorizado",SENSITIVE_CABINET_OPEN:"Armário sensível aberto",ACCESS_ACTIVE:"Acesso ativo",CLOSED:"Sessão encerrada",EXPIRED:"Sessão expirada"}[value]||value);

async function accessScreen(accessSessionId){
  try{
    const access=await apiGet({action:"accessSession",id:accessSessionId}); if(!access)return go("/"); state.access=access;
    const o=access.orders?.[0];
    const sensitive=access.sensitive_access?`<div class="notice sensitive-notice"><b>Estoque sensível</b><span>O armário só será autorizado depois da entrada confirmada e da porta fechada.</span></div>`:"";
    render(shell(`<div class="access-banner"><div class="big-check">✓</div><div><div class="eyebrow">Acesso autorizado</div><h1>${esc(access.employee?.name||"Funcionário")}</h1></div></div><div class="card"><div class="summary"><div class="summary-row"><span>Ordem</span><strong>${esc(o?.order_id||"—")}</strong></div><div class="summary-row"><span>Paciente</span><strong>${esc(o?.patient?.name||"—")}</strong></div><div class="summary-row"><span>Itens</span><strong>${o?.item_count??0}</strong></div><div class="summary-row"><span>Status físico</span><strong>${esc(stateLabel(access.state))}</strong></div></div></div>${sensitive}<div class="notice"><b>Picking no HVB Mobile</b><span>O Terminal não confirma materiais ou quantidades. Continue no dispositivo móvel autorizado.</span></div>${devControls(access)}<p class="footer-note">DEV: controladores, sensores, câmera e DESFire estão simulados. Nenhum movimento de estoque é realizado.</p>`,"Sessão de acesso"));
    bindDev(access);
  }catch{ go("/"); }
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
    try{ await apiPost({action:"registerAccessEvent",access_session_id:access.access_session_id,event_type:btn.dataset.event,metadata:{source:"dev-ui"}}); accessScreen(access.access_session_id); }
    catch{ btn.disabled=false; alert("A sequência física simulada não permitiu este evento."); }
  }));
  const finish=document.getElementById("finish"); if(finish)finish.addEventListener("click",()=>go("/"));
}

async function auditScreen(){
  try{
    const audit=await apiGet({action:"audit"});
    const rows=audit.length?audit.map(e=>`<div class="audit-row"><div class="time">${new Date(e.occurred_at).toLocaleString("pt-BR")}</div><strong>${esc(e.event_type)}</strong><div>${esc(e.employee?.name||"Sistema")} • ${esc(e.terminal_id||"—")}</div><div class="meta">${esc(e.access_session_id||e.auth_session_id||"sem sessão")}</div></div>`).join(""):`<div class="card"><p class="lead">Nenhum evento registrado nesta execução.</p></div>`;
    render(shell(`<div class="eyebrow">Somente leitura</div><h1>Auditoria do Terminal</h1><p class="lead">Eventos simulados de identidade e acesso físico.</p><div class="stack">${rows}</div><div class="actions"><button class="btn ghost" id="back">Voltar</button></div>`,"Auditoria"));
    document.getElementById("back").addEventListener("click",()=>go("/"));
  }catch{ go("/"); }
}

function deprecatedScreen(){
  render(shell(`<div class="card"><div class="eyebrow">Fluxo legado</div><h1>Esta função mudou de lugar</h1><p class="lead">Seleção de atendimento, materiais e confirmação de retirada não são mais responsabilidades do Terminal. O picking será realizado pelo HVB Mobile e escriturado pela API HVB.</p><div class="actions"><button class="btn" id="home">Ir para o Terminal de Acesso</button></div></div>`,"Arquitetura v2"));
  document.getElementById("home").addEventListener("click",()=>go("/"));
}
function showError(title,message,back="/"){
  render(shell(`<div class="card"><div class="big-error">!</div><div class="eyebrow">Operação interrompida</div><h1>${esc(title)}</h1><p class="lead">${esc(message)}</p><div class="actions"><button class="btn ghost" id="back">Voltar</button></div></div>`,"Terminal de Acesso"));
  document.getElementById("back").addEventListener("click",()=>go(back));
}

function router(){
  const path=location.pathname;
  const auth=path.match(/^\/auth\/([^/]+)$/); const access=path.match(/^\/acesso\/([^/]+)$/);
  if(path==="/")return idleScreen();
  if(auth)return credentialScreen(decodeURIComponent(auth[1]));
  if(path==="/ordens")return ordersScreen();
  if(access)return accessScreen(decodeURIComponent(access[1]));
  if(path==="/admin/auditoria")return auditScreen();
  if(["/atendimentos","/materiais","/retirada","/sucesso"].includes(path)||/^\/atendimento\//.test(path))return deprecatedScreen();
  go("/");
}
window.addEventListener("popstate",router);
router();
