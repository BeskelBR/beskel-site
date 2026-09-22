"use strict";

const app=document.getElementById("separationApp");
const API="/api/mock";
const PICKING_DISPLAY_ID="HVB-PICKING-01";
const TERMINAL_ID="HVB-T01";
const ACCESS_ID=(location.pathname.match(/^\/separacao\/([^/]+)$/)||[])[1]||new URLSearchParams(location.search).get("access");
const TOKEN_KEY=`hvb_separation_token_${ACCESS_ID||"none"}`;
const tokenFromHash=decodeURIComponent(String(location.hash||"").replace(/^#/,""));
if(tokenFromHash){
  sessionStorage.setItem(TOKEN_KEY,tokenFromHash);
  history.replaceState({},"",location.pathname+location.search);
}
const ACCESS_TOKEN=()=>sessionStorage.getItem(TOKEN_KEY)||"";
let access=null;
let filter="pending";
let lastSignature="";
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
    READY_TO_CONFIRM:"Porta fechada • aguardando confirmação",
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
    action=`<button class="btn warn" id="simulateSensitiveClose">DEV • Simular armário fechado</button>`;
  }else if(state==="CLOSED"){
    text="Porta do armário fechada. Aguardando confirmação da trava.";
    action=`<button class="btn secondary" id="simulateSensitiveLock">DEV • Simular trava confirmada</button>`;
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

function render(){
  if(!access){app.innerHTML=shell(`<div class="empty">Carregando sessão de acesso…</div>`);return;}

  if(access.state==="WITHDRAWAL_CONFIRMED"||access.withdrawal_confirmation){
    const confirmed=access.withdrawal_confirmation?.results||[];
    const totalActual=confirmed.reduce((sum,item)=>sum+Number(item.actual_quantity||0),0);
    app.innerHTML=shell(`<section class="success"><div class="check">✓</div><div class="eyebrow">Retirada confirmada</div><h1>${confirmed.length} posição(ões) concluída(s)</h1><p class="lead">${totalActual} unidade(s) confirmadas na retirada.</p><div class="notice"><strong>DEV:</strong> o protótipo registrou o resultado e a auditoria, mas não movimentou estoque real.</div></section>`);
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
      const alternatives=group.alternatives
        .filter(alt=>alt.location_code!==loc&&alt.available_units>=group.quantity&&(!group.sensitive||alt.sensitive_area))
        .map(alt=>`<button class="btn secondary" data-alt="${esc(group.key)}" data-alt-location="${esc(alt.location_code)}" data-alt-lot="${esc(alt.stock_lot_id)}">Ir para ${esc(alt.location_code)} · lote ${esc(alt.lot_code)} · val. ${esc(dateLabel(alt.expires_at))}${alt.available_units?` · ${alt.available_units} un livres`:""}</button>`).join("");
      controls=`
        ${alternatives||'<span class="exception-hint">Sem outro lote único com saldo suficiente para esta tarefa.</span>'}
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
        ${status==="EXCEPTION"?`<div class="exception-box"><strong>Lote ${esc(activeLotCode(group))} não encontrado em ${esc(loc)}</strong><span>O desvio fica registrado. Escolha outro lote elegível, retirada parcial ou indisponibilidade.</span></div>`:""}
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
  const readyForFinish=allResolved&&sensitiveSecured;
  let flowNotice="";
  if(allResolved&&access.state==="ENTRY_CONFIRMED"&&!sensitiveSecured){
    flowNotice=`<div class="notice critical"><strong>Checklist resolvido, mas o armário sensível ainda não está confirmado como travado.</strong> Feche e confirme a trava antes de concluir a separação.</div>`;
  }else if(readyForFinish&&access.state==="ENTRY_CONFIRMED"){
    flowNotice=`<div class="notice"><strong>Checklist concluído.</strong> Finalize a separação antes de sair da sala.</div>`;
  }else if(access.state==="PICKING_READY"){
    flowNotice=`<div class="notice"><strong>Separação concluída.</strong> Saia da sala. O Terminal de Acesso aguardará o sensor indicar ausência antes do fechamento.</div>`;
  }else if(access.state==="EXIT_CONFIRMED"){
    flowNotice=`<div class="notice"><strong>Saída detectada.</strong> Aguardando o fechamento físico da porta.</div>`;
  }else if(access.state==="READY_TO_CONFIRM"){
    flowNotice=`<div class="notice"><strong>Porta fechada.</strong> A confirmação final será feita no Terminal de Acesso externo.</div>`;
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
    <div class="footer-actions"><div class="status">${exceptions?"Há divergências para resolver":readyForFinish?(access.state==="ENTRY_CONFIRMED"?"Checklist concluído • finalize a separação":"Separação concluída • aguarde o fluxo físico"):"Confirme os itens e mantenha o armário sensível fechado fora da sessão de retirada"}</div><button class="btn primary confirm-all" id="finishPicking" ${readyForFinish&&access.state==="ENTRY_CONFIRMED"&&!closed?"":"disabled"}>CONCLUIR SEPARAÇÃO</button></div>
  `);

  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;render();}));

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

  document.querySelectorAll("[data-alt]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.alt);if(!group)return;
    const from=activeLocation(group),to=btn.dataset.altLocation;
    await pickingEvent("PICKING_LOT_REALLOCATED",group,{
      from_location:from,
      from_stock_lot_id:activeStockLotId(group),
      to_location:to,
      to_stock_lot_id:btn.dataset.altLot
    });
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
  document.getElementById("simulateSensitiveClose")?.addEventListener("click",async()=>{
    await sensitiveEvent("SENSITIVE_DOOR_CLOSED",TERMINAL_ID,{source:"dev-sensitive-sensor"});
  });
  document.getElementById("simulateSensitiveLock")?.addEventListener("click",async()=>{
    await sensitiveEvent("SENSITIVE_LOCK_CONFIRMED",TERMINAL_ID,{source:"dev-sensitive-lock"});
  });

  document.getElementById("finishPicking")?.addEventListener("click",async()=>{
    try{
      access=await apiPost({
        action:"registerAccessEvent",
        access_session_id:ACCESS_ID,
        session_token:ACCESS_TOKEN(),
        event_type:"PICKING_READY",
        command_id:cmd("picking-ready"),
        source_occurred_at:new Date().toISOString(),
        source_device_id:PICKING_DISPLAY_ID,
        metadata:{source:"picking-display"}
      });
      render();
    }catch(error){
      alert("A separação ainda não pode ser concluída: "+error.message);
    }
  });
}

async function refresh(){
  if(!ACCESS_ID){app.innerHTML=shell(`<div class="empty">Sessão não informada. Abra esta tela a partir do Terminal de Acesso.</div>`);return;}
  try{
    const token=ACCESS_TOKEN();
    if(!token)throw new Error("SESSION_TOKEN_MISSING");
    const latest=await apiGet({action:"accessSession",id:ACCESS_ID,session_token:token});
    if(!latest)throw new Error("SESSION_NOT_FOUND");
    const signature=JSON.stringify({state:latest.state,sensitive_state:latest.sensitive_state,confirmation:latest.withdrawal_confirmation?.confirmed_at||null,picking_state:latest.picking_state||{},events:latest.events?.length||0});
    access=latest;
    if(signature!==lastSignature||!app.innerHTML){lastSignature=signature;render();}
  }catch{
    app.innerHTML=shell(`<div class="empty">Não foi possível carregar a sessão. Verifique o Terminal de Acesso e tente novamente.</div>`);
  }
}

refresh();
setInterval(refresh,2000);
