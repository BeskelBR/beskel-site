"use strict";

const app=document.getElementById("separationApp");
const API="/api/mock";
const PICKING_DISPLAY_ID="HVB-PICKING-01";
const TERMINAL_ID="HVB-T01";
const PICKING_DISPLAY_DEV_CREDENTIAL="HVB-PICKING-DEV-CREDENTIAL";
let ACCESS_ID=(location.pathname.match(/^\/separacao\/([^/]+)$/)||[])[1]||new URLSearchParams(location.search).get("access")||"";
function tokenKey(accessId=ACCESS_ID){return `hvb_separation_token_${accessId||"none"}`;}
function storeAccessToken(accessId,token){
  if(!accessId||!token)return;
  sessionStorage.setItem(tokenKey(accessId),token);
  // DEV fallback for iOS/Safari tab restoration. Production kiosk will use secure device storage.
  localStorage.setItem(tokenKey(accessId),token);
}
function clearAccessToken(accessId=ACCESS_ID){
  if(!accessId)return;
  sessionStorage.removeItem(tokenKey(accessId));
  localStorage.removeItem(tokenKey(accessId));
}
const tokenFromHash=decodeURIComponent(String(location.hash||"").replace(/^#/,""));
if(tokenFromHash&&ACCESS_ID){
  storeAccessToken(ACCESS_ID,tokenFromHash);
  history.replaceState({},"",location.pathname+location.search);
}
const ACCESS_TOKEN=()=>{
  const key=tokenKey();
  const token=sessionStorage.getItem(key)||localStorage.getItem(key)||"";
  if(token&&!sessionStorage.getItem(key))sessionStorage.setItem(key,token);
  return token;
};
let access=null;
let filter="pending";
let lastSignature="";
let refreshBusy=false;
let refreshFailures=0;
let kioskResetTimer=null;
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function nowLabel(){return new Date().toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function cmd(prefix){return `${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;}
function stateLabel(v){
  return ({
    DOOR_AUTHORIZED:"Acesso liberado",
    DOOR_OPEN:"Porta aberta",
    ENTRY_CONFIRMED:"Presença detectada • picking em andamento",
    PICKING_READY:"Picking concluído • aguardando saída",
    EXIT_CONFIRMED:"Saída detectada • aguardando fechamento",
    READY_TO_CONFIRM:"Porta fechada • finalização automática pendente",
    WITHDRAWAL_CONFIRMED:"Retirada confirmada",
    CLOSED:"Sessão encerrada",
    EXPIRED:"Sessão expirada"
  }[v]||v||"—");
}
function canPick(){return access?.state==="ENTRY_CONFIRMED";}
function isResolved(status){return ["CONFIRMED","PARTIAL","UNAVAILABLE"].includes(status);}

async function apiGet(params){
  const res=await fetch(`${API}?${new URLSearchParams(params)}`,{cache:"no-store"});
  const body=await res.json();
  if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED");
  return body.data;
}
async function apiPost(payload){
  const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const body=await res.json();
  if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED");
  return body.data;
}

async function discoverActiveSession(){
  const latest=await apiPost({
    action:"activePickingSession",
    source_device_id:PICKING_DISPLAY_ID,
    device_credential:PICKING_DISPLAY_DEV_CREDENTIAL
  });
  if(!latest?.access_session_id||!latest?.session_token)return null;

  ACCESS_ID=latest.access_session_id;
  storeAccessToken(ACCESS_ID,latest.session_token);
  history.replaceState({},"",`/separacao/${encodeURIComponent(ACCESS_ID)}`);
  return latest;
}

function returnToKioskWaiting(){
  if(ACCESS_ID)clearAccessToken(ACCESS_ID);
  ACCESS_ID="";
  access=null;
  lastSignature="";
  refreshFailures=0;
  history.replaceState({},"","/separacao");
  renderWaitingForSession();
  refresh();
}

function renderWaitingForSession(){
  app.innerHTML=shell(`<section class="hero"><div class="eyebrow">Terminal de Retirada • Kiosk</div><h1>Aguardando sessão de retirada</h1><p class="lead">Este tablet assume automaticamente a próxima AccessSession ativa da sala. Nenhuma ação de pareamento é necessária.</p><div class="notice"><strong>DEV:</strong> a identidade do dispositivo interno está simulada. Em produção será fornecida pelo provisionamento seguro do tablet.</div></section>`);
}

function accessSignature(value){
  return JSON.stringify({
    state:value?.state||null,
    sensitive_state:value?.sensitive_state||null,
    timeout_alerted_at:value?.timeout_alerted_at||null,
    confirmation:value?.withdrawal_confirmation?.confirmed_at||null,
    picking_state:value?.picking_state||{}
  });
}
function rememberAccess(value){
  access=value;
  lastSignature=accessSignature(value);
}
function showConnectionNotice(message="Conexão instável. Mantendo a última sessão válida e tentando reconectar…"){
  const content=document.querySelector(".content");
  if(!content)return;
  let note=document.getElementById("separationConnectionNotice");
  if(!note){
    note=document.createElement("div");
    note.id="separationConnectionNotice";
    note.className="notice critical";
    content.prepend(note);
  }
  note.innerHTML=`<strong>Reconectando</strong><span>${esc(message)}</span>`;
}
function clearConnectionNotice(){
  document.getElementById("separationConnectionNotice")?.remove();
}

function sourceLabel(source){
  if(source?.source_type==="ORDER")return `${source.source_id} · ${source.quantity} un`;
  return `AJUSTE AO VIVO · ${source?.quantity||0} un`;
}
function dateLabel(value){
  if(!value)return "sem validade";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"—":date.toLocaleDateString("pt-BR");
}
function groupsFromAccess(){
  return (access?.picking_tasks||[]).map(task=>({
    key:task.picking_task_id,
    picking_task_id:task.picking_task_id,
    product_id:task.product_id,
    primary_location:String(task.location_code||"SEM COORD.").toUpperCase(),
    description:task.description,
    sensitive:task.sensitive===true,
    quantity:Number(task.quantity||0),
    stock_lot_id:task.stock_lot_id,
    lot_code:task.lot_code,
    expires_at:task.expires_at,
    received_at:task.received_at,
    allocation_strategy:task.allocation_strategy||"FEFO",
    sources:(task.sources||[]).map(sourceLabel),
    alternatives:(task.fallback_lots||[]).map(lot=>({
      stock_lot_id:lot.stock_lot_id,
      lot_code:lot.lot_code,
      location_code:String(lot.location_code||"").toUpperCase(),
      available_units:Number(lot.available_units||0),
      expires_at:lot.expires_at,
      received_at:lot.received_at,
      sensitive_area:lot.sensitive_area===true
    }))
  })).sort((a,b)=>activeLocation(a).localeCompare(activeLocation(b),"pt-BR",{numeric:true}));
}
function groupRecord(group){return access?.picking_state?.[group.key]||{};}
function groupStatus(group){return groupRecord(group).status||"PENDING";}
function activeLocation(group){return groupRecord(group).active_location||group.primary_location;}
function activeStockLotId(group){return groupRecord(group).active_stock_lot_id||group.stock_lot_id;}
function activeLotCode(group){return groupRecord(group).active_lot_code||group.lot_code;}
function activeLot(group){
  const stockLotId=activeStockLotId(group);
  if(stockLotId===group.stock_lot_id)return {
    stock_lot_id:group.stock_lot_id,
    lot_code:group.lot_code,
    location_code:group.primary_location,
    expires_at:group.expires_at
  };
  return group.alternatives.find(lot=>lot.stock_lot_id===stockLotId)||{
    stock_lot_id:stockLotId,
    lot_code:activeLotCode(group),
    location_code:activeLocation(group),
    expires_at:null
  };
}
function actualQuantity(group){
  const rec=groupRecord(group);
  if(rec.status==="PARTIAL")return Number(rec.actual_quantity||0);
  if(rec.status==="UNAVAILABLE")return 0;
  if(rec.status==="CONFIRMED")return group.quantity;
  return null;
}
function lastResolvedGroup(groups){
  return groups
    .filter(group=>isResolved(groupStatus(group)))
    .sort((a,b)=>Date.parse(groupRecord(b).updated_at||0)-Date.parse(groupRecord(a).updated_at||0))[0]||null;
}
function sensitiveUnlocked(group){
  if(!group.sensitive)return true;
  return access?.sensitive_access===true&&access?.sensitive_state==="OPEN";
}
function sensitiveSessionActive(){
  return ["UNLOCK_AUTHORIZED","OPEN","CLOSED"].includes(access?.sensitive_state);
}
async function pickingEvent(eventType,group,metadata={}){
  try{
    access=await apiPost({
      action:"registerPickingEvent",
      access_session_id:ACCESS_ID,
      session_token:ACCESS_TOKEN(),
      event_type:eventType,
      metadata:{
        group_key:group.key,
        description:group.description,
        expected_quantity:group.quantity,
        location_code:activeLocation(group),
        stock_lot_id:activeStockLotId(group),
        lot_code:activeLotCode(group),
        ...metadata
      },
      command_id:cmd("pick"),
      source_device_id:PICKING_DISPLAY_ID
    });
  }catch(error){
    alert("Não foi possível registrar o evento de separação: "+error.message);
    throw error;
  }
}

async function sensitiveEvent(eventType,sourceDeviceId,metadata={}){
  try{
    access=await apiPost({
      action:"registerSensitiveEvent",
      access_session_id:ACCESS_ID,
      session_token:ACCESS_TOKEN(),
      event_type:eventType,
      metadata,
      command_id:cmd("sensitive"),
      source_occurred_at:new Date().toISOString(),
      source_device_id:sourceDeviceId
    });
    render();
  }catch(error){
    alert("Não foi possível alterar o acesso à medicação sensível: "+error.message);
    throw error;
  }
}

function sensitiveStatePanel(groups){
  if(!access?.sensitive_access)return "";
  const pending=groups.filter(group=>group.sensitive&&!isResolved(groupStatus(group))).length;
  const total=groups.filter(group=>group.sensitive).length;
  const state=access.sensitive_state||"LOCKED";
  let action="";
  let text="";

  if(state==="LOCKED"){
    text=pending
      ? `Armário travado. ${pending} de ${total} tarefa(s) sensível(is) ainda precisam ser resolvidas.`
      : "Itens sensíveis resolvidos; aguarde confirmação de segurança.";
    if(pending) action=`<button class="btn warn" id="requestSensitive">RETIRAR MEDICAÇÃO SENSÍVEL</button>`;
  }else if(state==="UNLOCK_AUTHORIZED"){
    text="Abertura autorizada para esta AccessSession, sem nova autenticação. A autorização expira rapidamente se a porta não abrir.";
    action=`<button class="btn secondary" id="simulateSensitiveOpen">DEV • Simular armário aberto</button>`;
  }else if(state==="OPEN"){
    text="Armário sensível aberto. Resolva somente os itens sensíveis e feche o armário assim que concluir esta sessão.";
    action=`<button class="btn warn" id="simulateSensitiveCloseAndLock">DEV • Simular fechamento do armário</button>`;
  }else if(state==="CLOSED"){
    text="Porta do armário fechada. O sistema está confirmando a trava automaticamente.";
    action=`<button class="btn secondary" disabled>Confirmando trava…</button>`;
  }else if(state==="COMPLETED"){
    text=`Retirada sensível concluída e armário confirmado como travado. Aberturas nesta sessão: ${access.sensitive_open_count||0}.`;
  }else{
    text="Estado do armário sensível indisponível.";
  }

  return `<section class="notice critical"><strong>Medicação sensível</strong><span>${esc(text)}</span><div class="actions" style="margin-top:12px">${action}</div></section>`;
}

function shell(content){
  return `<div class="screen"><div class="dev-banner">DEV • Tela interna de separação • nenhum movimento real de estoque</div><header class="topbar"><div class="brand"><img src="/hvb/assets/logo-lateral.webp" alt="Hospital Veterinário Brasília"><div><div class="brand-title">Terminal de Retirada</div><div class="room-label">Sala de estoque • PICKING-DISPLAY-01</div></div></div><div class="clock">${nowLabel()}</div></header><main class="content">${content}</main></div>`;
}

function waitingScreen(){
  const name=access?.employee?.name||"Servidor autenticado";
  app.innerHTML=shell(`<section class="success"><div class="eyebrow">Sessão reconhecida</div><h1>${esc(name)}</h1><p class="lead">A tela está vinculada à sessão ${esc(access?.access_session_id||ACCESS_ID||"—")}.</p><div class="notice"><strong>${esc(stateLabel(access?.state))}</strong><br>A separação será liberada após a detecção de presença na sala.</div><p class="lead">Continue a simulação no Terminal de Acesso externo.</p></section>`);
}

function render(options={}){
  const preserveScroll=options.preserveScroll!==false;
  const previousScroll=preserveScroll?(window.scrollY||document.documentElement.scrollTop||0):0;
  if(access)lastSignature=accessSignature(access);

  if(!access){app.innerHTML=shell(`<div class="empty">Carregando sessão de acesso…</div>`);return;}

  if(access.state==="WITHDRAWAL_CONFIRMED"||access.withdrawal_confirmation){
    const confirmed=access.withdrawal_confirmation?.results||[];
    const totalActual=confirmed.reduce((sum,item)=>sum+Number(item.actual_quantity||0),0);
    app.innerHTML=shell(`<section class="success"><div class="check">✓</div><div class="eyebrow">Retirada confirmada automaticamente</div><h1>${confirmed.length} posição(ões) concluída(s)</h1><p class="lead">${totalActual} unidade(s) confirmadas após saída e fechamento da porta.</p><div class="notice"><strong>DEV:</strong> o protótipo registrou o resultado e a auditoria, mas não movimentou estoque real.</div></section>`);
    window.scrollTo({top:0,behavior:"instant"});
    if(!kioskResetTimer){
      kioskResetTimer=setTimeout(()=>{
        kioskResetTimer=null;
        returnToKioskWaiting();
      },4000);
    }
    return;
  }

  if(!["ENTRY_CONFIRMED","PICKING_READY","EXIT_CONFIRMED","READY_TO_CONFIRM","CLOSED","EXPIRED"].includes(access.state)){waitingScreen();return;}

  const groups=groupsFromAccess();
  const resolved=groups.filter(g=>isResolved(groupStatus(g))).length;
  const exceptions=groups.filter(g=>groupStatus(g)==="EXCEPTION").length;
  const total=groups.length;
  const percent=total?Math.round(resolved/total*100):0;
  const shown=groups.filter(g=>filter==="all"||!isResolved(groupStatus(g)));
  const readonly=!canPick();
  const closed=["CLOSED","EXPIRED"].includes(access.state);

  const renderCard=group=>{
    const rec=groupRecord(group);
    const status=groupStatus(group);
    const loc=activeLocation(group);
    const sensitiveLocked=group.sensitive&&!sensitiveUnlocked(group);
    const commonBlocked=!group.sensitive&&sensitiveSessionActive();
    const locked=sensitiveLocked||commonBlocked;
    const cls=`pick-card ${isResolved(status)?"done":""} ${locked?"locked":""}`;
    const sensitive=group.sensitive?'<span style="color:var(--critical);font-weight:800">⚠ SENSÍVEL</span>':"item comum";
    let controls="";

    if(commonBlocked){
      controls=`<button class="btn secondary" disabled>Conclua e tranque a sessão de medicação sensível</button>`;
    }else if(sensitiveLocked&&!isResolved(status)){
      controls=`<button class="btn secondary" disabled>🔒 Armário sensível fechado</button>`;
    }else if(status==="EXCEPTION"&&canPick()){
      controls=`
        <span class="exception-hint">Nenhum outro lote FEFO elegível com saldo suficiente foi encontrado automaticamente.</span>
        <button class="btn warn" data-partial="${esc(group.key)}">Retirada parcial</button>
        <button class="btn warn" data-unavailable="${esc(group.key)}">Registrar indisponível</button>
        <button class="btn secondary" data-cancel-exception="${esc(group.key)}">Cancelar</button>
      `;
    }else if(status==="CONFIRMED"){
      controls=canPick()&&!sensitiveLocked&&!commonBlocked?`<button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">✓ Retirado</span>`;
    }else if(status==="PARTIAL"){
      controls=canPick()&&!sensitiveLocked&&!commonBlocked?`<span class="resolved-label">⚠ Parcial: ${esc(rec.actual_quantity)} un</span><button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">⚠ Parcial: ${esc(rec.actual_quantity)} un</span>`;
    }else if(status==="UNAVAILABLE"){
      controls=canPick()&&!sensitiveLocked&&!commonBlocked?`<span class="resolved-label">⚠ Indisponível</span><button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">⚠ Indisponível</span>`;
    }else if(readonly){
      controls=`<span class="resolved-label">Aguardando resolução anterior</span>`;
    }else{
      controls=`<button class="btn primary" data-confirm="${esc(group.key)}">✓ Retirado</button><button class="btn warn" data-exception="${esc(group.key)}">Não encontrei</button>`;
    }

    return `<article class="${cls}">
      <div class="loc">${esc(loc)}</div>
      <div>
        <div class="material">${esc(group.description)}</div>
        <div class="meta"><span>${sensitive}</span><span>FEFO</span><span>Lote ${esc(activeLotCode(group))}</span><span>Val. ${esc(dateLabel(activeLot(group).expires_at))}</span><span>${group.sources.length} origem(ns)</span>${loc!==group.primary_location?`<span>Realocado de ${esc(group.primary_location)}</span>`:""}</div>
        <div class="orders">${group.sources.map(esc).join(" &nbsp; • &nbsp; ")}</div>
        ${rec.auto_reallocated&&status==="PENDING"?`<div class="notice"><strong>Realocado automaticamente por FEFO.</strong><span>O lote anterior foi registrado como divergente. Siga para ${esc(loc)} • lote ${esc(activeLotCode(group))}.</span></div>`:""}
        ${status==="EXCEPTION"?`<div class="exception-box"><strong>Lote ${esc(activeLotCode(group))} não encontrado em ${esc(loc)}</strong><span>O desvio ficou registrado. O sistema tentou automaticamente o próximo lote FEFO elegível, mas não encontrou alternativa suficiente.</span></div>`:""}
        <div class="actions">${controls}</div>
      </div>
      <div class="qty"><strong>${group.quantity}</strong><span>unidade(s)</span></div>
    </article>`;
  };

  const commonCards=shown.filter(group=>!group.sensitive).map(renderCard).join("")||`<div class="empty">Nenhum item comum pendente nesta visualização.</div>`;
  const sensitiveCards=shown.filter(group=>group.sensitive).map(renderCard).join("")||`<div class="empty">Nenhuma medicação sensível pendente nesta visualização.</div>`;
  const sensitiveSection=access.sensitive_access
    ? `${sensitiveStatePanel(groups)}<div class="toolbar"><h2>Medicação sensível</h2></div><section class="pick-list">${sensitiveCards}</section>`
    : "";

  const allResolved=resolved===total&&total>0&&exceptions===0;
  const sensitiveSecured=!access.sensitive_access||access.sensitive_state==="COMPLETED";
  const lastResolved=lastResolvedGroup(groups);
  let flowNotice="";
  if(allResolved&&access.state==="ENTRY_CONFIRMED"&&!sensitiveSecured){
    flowNotice=`<div class="notice critical"><strong>Checklist resolvido, mas o armário sensível ainda precisa ser fechado e travado.</strong> Ao confirmar a trava, o sistema concluirá o picking automaticamente.</div>`;
  }else if(access.state==="PICKING_READY"){
    flowNotice=`<div class="notice"><strong>Separação concluída automaticamente.</strong> Saia da sala. Até o sensor registrar sua saída, você ainda pode corrigir o último item se necessário.</div>${lastResolved?`<div class="actions"><button class="btn secondary" id="undoLastResolved">Desfazer último item</button></div>`:""}`;
  }else if(access.state==="EXIT_CONFIRMED"){
    flowNotice=`<div class="notice"><strong>Saída detectada.</strong> Aguardando o fechamento físico da porta.</div>`;
  }else if(access.state==="READY_TO_CONFIRM"){
    flowNotice=`<div class="notice critical"><strong>Porta fechada.</strong> A finalização automática ainda está pendente; o sistema manterá a sessão recuperável sem repetir a retirada.</div>`;
  }

  app.innerHTML=shell(`
    <div class="session-bar">
      <div class="stat"><span>Servidor</span><strong>${esc(access.employee?.name||"—")}</strong></div>
      <div class="stat"><span>Ordens</span><strong>${access.orders?.length||0}</strong></div>
      <div class="stat"><span>Progresso</span><strong>${resolved}/${total}</strong></div>
      <div class="stat"><span>Sessão</span><strong>${esc(stateLabel(access.state))}</strong></div>
    </div>
    <section class="hero"><div class="hero-row"><div><div class="eyebrow">Separação por lote • FEFO</div><h1>Retire o lote indicado na coordenada informada</h1><p class="lead">A coordenada pertence ao lote armazenado. O sistema prioriza menor validade e usa a entrada mais antiga como desempate. Divergências físicas permanecem auditáveis.</p></div><div class="progress-wrap"><div class="progress-label"><span>Checklist</span><strong>${percent}%</strong></div><div class="progress"><div style="width:${percent}%"></div></div></div></div></section>
    ${closed?`<div class="notice critical"><strong>Sessão física encerrada.</strong> Esta tela está em modo de consulta.</div>`:""}
    ${exceptions?`<div class="notice critical"><strong>${exceptions} divergência(s) aberta(s).</strong> Resolva cada item antes da confirmação.</div>`:""}
    ${flowNotice}
    <div class="toolbar"><h2>Materiais comuns</h2><div class="filters"><button class="chip-btn ${filter==="pending"?"active":""}" data-filter="pending">Pendentes</button><button class="chip-btn ${filter==="all"?"active":""}" data-filter="all">Todos</button></div></div>
    <section class="pick-list">${commonCards}</section>
    ${sensitiveSection}
    <div class="footer-actions"><div class="status">${exceptions?"Há divergências para resolver":access.state==="PICKING_READY"?"Separação concluída automaticamente • saia da sala":allResolved&&!sensitiveSecured?"Feche e trave o armário sensível":"Confirme os itens; o sistema concluirá a separação automaticamente"}</div></div>
  `);

  if(preserveScroll){
    requestAnimationFrame(()=>{
      const maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
      window.scrollTo(0,Math.min(previousScroll,maxScroll));
    });
  }

  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;render();}));

  document.getElementById("undoLastResolved")?.addEventListener("click",async()=>{
    if(!lastResolved)return;
    await pickingEvent("PICKING_ITEM_UNDONE",lastResolved);
    render();
  });

  document.querySelectorAll("[data-confirm]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.confirm);if(!group)return;
    await pickingEvent("PICKING_ITEM_CONFIRMED",group,{actual_quantity:group.quantity});
    render();
  }));

  document.querySelectorAll("[data-undo]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.undo);if(!group)return;
    await pickingEvent("PICKING_ITEM_UNDONE",group);
    render();
  }));

  document.querySelectorAll("[data-exception]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.exception);if(!group)return;
    await pickingEvent("STOCK_LOCATION_DISCREPANCY",group,{system_quantity:group.quantity,found_quantity:null});
    render();
  }));

  document.querySelectorAll("[data-partial]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.partial);if(!group)return;
    const actual=Number(prompt(`Quantidade realmente encontrada (máx. ${group.quantity}):`,"1"));
    if(!Number.isFinite(actual)||actual<=0||actual>=group.quantity)return alert("Informe quantidade maior que zero e menor que a solicitada.");
    await pickingEvent("PICKING_PARTIAL",group,{actual_quantity:actual});
    render();
  }));

  document.querySelectorAll("[data-unavailable]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.unavailable);if(!group)return;
    if(!confirm("Registrar que nenhuma unidade foi encontrada?"))return;
    await pickingEvent("PICKING_UNAVAILABLE",group,{actual_quantity:0});
    render();
  }));

  document.querySelectorAll("[data-cancel-exception]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.cancelException);if(!group)return;
    await pickingEvent("PICKING_ITEM_UNDONE",group);
    render();
  }));

  document.getElementById("requestSensitive")?.addEventListener("click",async()=>{
    await sensitiveEvent("SENSITIVE_ACCESS_REQUESTED",PICKING_DISPLAY_ID,{source:"picking-display"});
  });
  document.getElementById("simulateSensitiveOpen")?.addEventListener("click",async()=>{
    await sensitiveEvent("SENSITIVE_DOOR_OPENED",TERMINAL_ID,{source:"dev-sensitive-sensor"});
  });
  document.getElementById("simulateSensitiveCloseAndLock")?.addEventListener("click",async()=>{
    const btn=document.getElementById("simulateSensitiveCloseAndLock");
    if(btn)btn.disabled=true;
    try{
      access=await apiPost({
        action:"registerSensitiveEvent",
        access_session_id:ACCESS_ID,
        session_token:ACCESS_TOKEN(),
        event_type:"SENSITIVE_DOOR_CLOSED",
        metadata:{source:"dev-sensitive-sensor"},
        command_id:cmd("sensitive-close"),
        source_occurred_at:new Date().toISOString(),
        source_device_id:TERMINAL_ID
      });
      access=await apiPost({
        action:"registerSensitiveEvent",
        access_session_id:ACCESS_ID,
        session_token:ACCESS_TOKEN(),
        event_type:"SENSITIVE_LOCK_CONFIRMED",
        metadata:{source:"dev-sensitive-lock"},
        command_id:cmd("sensitive-lock"),
        source_occurred_at:new Date().toISOString(),
        source_device_id:TERMINAL_ID
      });
      render();
    }catch(error){
      if(btn)btn.disabled=false;
      alert("Não foi possível confirmar o fechamento seguro do armário: "+error.message);
    }
  });

}

async function refresh(){
  if(refreshBusy||document.hidden)return;

  refreshBusy=true;
  try{
    if(!ACCESS_ID){
      const discovered=await discoverActiveSession();
      if(!discovered){
        renderWaitingForSession();
        refreshFailures=0;
        return;
      }
      rememberAccess(discovered);
      render({preserveScroll:false});
      return;
    }

    let token=ACCESS_TOKEN();
    if(!token){
      const discovered=await discoverActiveSession();
      if(discovered?.access_session_id===ACCESS_ID){
        token=ACCESS_TOKEN();
      }else{
        throw new Error("SESSION_TOKEN_MISSING");
      }
    }

    const latest=await apiGet({action:"accessSession",id:ACCESS_ID,session_token:token});
    if(!latest)throw new Error("SESSION_NOT_FOUND");

    refreshFailures=0;
    clearConnectionNotice();
    const signature=accessSignature(latest);
    if(signature!==lastSignature||!app.innerHTML){
      rememberAccess(latest);
      render({preserveScroll:Boolean(access)});
    }else{
      access=latest;
    }
  }catch(error){
    refreshFailures+=1;
    if(access){
      // A polling failure is not a logout. Keep the last valid state on screen.
      showConnectionNotice();
    }else if(refreshFailures>=3){
      app.innerHTML=shell(`<div class="empty">Não foi possível consultar a sessão agora. O Terminal continuará tentando automaticamente.</div>`);
    }
  }finally{
    refreshBusy=false;
  }
}

refresh();
const separationPoll=setInterval(refresh,5000);
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)refresh();
});
window.addEventListener("pagehide",()=>{
  if(access?.state==="CLOSED"||access?.state==="EXPIRED"){
    clearInterval(separationPoll);
    clearAccessToken(ACCESS_ID);
  }
});
