"use strict";

const app=document.getElementById("separationApp");
const API="/api/mock";
const PICKING_DISPLAY_ID="HVB-PICKING-01";
const ACCESS_ID=(location.pathname.match(/^\/separacao\/([^/]+)$/)||[])[1]||new URLSearchParams(location.search).get("access");
const STORAGE_KEY=`hvb_separation_${ACCESS_ID||"none"}`;

let access=null;
let filter="pending";
let localState=loadState();
let lastSignature="";

function loadState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};}catch{return {};}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(localState));}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function nowLabel(){return new Date().toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function cmd(prefix){return `${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;}
function stateLabel(v){
  return ({
    DOOR_AUTHORIZED:"Acesso liberado",
    DOOR_OPEN:"Porta aberta",
    ENTRY_CONFIRMED:"Presença detectada",
    READY_TO_CONFIRM:"Porta fechada • aguardando confirmação",
    WITHDRAWAL_CONFIRMED:"Retirada confirmada",
    CLOSED:"Sessão encerrada",
    EXPIRED:"Sessão expirada"
  }[v]||v||"—");
}
function canPick(){return access?.state==="ENTRY_CONFIRMED";}
function canConfirm(){return access?.state==="READY_TO_CONFIRM";}
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

function sourceEntries(){
  const out=[];
  (access?.orders||[]).forEach(order=>{
    (order.items||[]).forEach((item,index)=>out.push({
      source:`${order.order_id} · ${item.quantity}`,
      member:`${order.order_id}:${index}`,
      item
    }));
  });
  (access?.live_items||[]).forEach((item,index)=>out.push({
    source:`AJUSTE AO VIVO · ${item.quantity}`,
    member:`live:${item.live_item_id||index}`,
    item
  }));
  return out;
}

function groupsFromAccess(){
  const map=new Map();
  sourceEntries().forEach(({source,member,item})=>{
    const primary=String(item.location_code||"SEM COORD.").toUpperCase();
    const key=`${primary}|${item.description}|${item.sensitive?1:0}`;
    if(!map.has(key))map.set(key,{
      key,
      primary_location:primary,
      description:item.description,
      sensitive:item.sensitive===true,
      quantity:0,
      sources:[],
      members:[],
      alternatives:[]
    });
    const group=map.get(key);
    group.quantity+=Number(item.quantity||0);
    group.sources.push(source);
    group.members.push(member);
    (item.alternate_locations||[]).forEach(alt=>{
      if(!group.alternatives.some(x=>x.location_code===alt.location_code)){
        group.alternatives.push({
          location_code:String(alt.location_code||"").toUpperCase(),
          available_units:Number(alt.available_units||0),
          sensitive_area:alt.sensitive_area===true
        });
      }
    });
  });
  return [...map.values()].sort((a,b)=>activeLocation(a).localeCompare(activeLocation(b),"pt-BR",{numeric:true}));
}
function groupRecord(group){return localState[group.key]||{};}
function groupStatus(group){return groupRecord(group).status||"PENDING";}
function activeLocation(group){return groupRecord(group).active_location||group.primary_location;}
function actualQuantity(group){
  const rec=groupRecord(group);
  if(rec.status==="PARTIAL")return Number(rec.actual_quantity||0);
  if(rec.status==="UNAVAILABLE")return 0;
  if(rec.status==="CONFIRMED")return group.quantity;
  return null;
}
function sensitiveUnlocked(group){
  if(!group.sensitive)return true;
  return access?.sensitive_access===true&&access?.sensitive_access_granted===true;
}
function writeGroup(group,patch){
  localState[group.key]={...groupRecord(group),...patch,updated_at:new Date().toISOString()};
  saveState();
}
async function pickingEvent(eventType,group,metadata={}){
  try{
    access=await apiPost({
      action:"registerPickingEvent",
      access_session_id:ACCESS_ID,
      event_type:eventType,
      metadata:{
        description:group.description,
        expected_quantity:group.quantity,
        location_code:activeLocation(group),
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

  if(!["ENTRY_CONFIRMED","READY_TO_CONFIRM","CLOSED","EXPIRED"].includes(access.state)){waitingScreen();return;}

  const groups=groupsFromAccess();
  const resolved=groups.filter(g=>isResolved(groupStatus(g))).length;
  const exceptions=groups.filter(g=>groupStatus(g)==="EXCEPTION").length;
  const total=groups.length;
  const percent=total?Math.round(resolved/total*100):0;
  const shown=groups.filter(g=>filter==="all"||!isResolved(groupStatus(g)));
  const readonly=!canPick();
  const closed=["CLOSED","EXPIRED"].includes(access.state);

  const cards=shown.map(group=>{
    const rec=groupRecord(group);
    const status=groupStatus(group);
    const loc=activeLocation(group);
    const locked=!sensitiveUnlocked(group);
    const cls=`pick-card ${isResolved(status)?"done":""} ${locked?"locked":""}`;
    const sensitive=group.sensitive?'<span style="color:var(--critical);font-weight:800">⚠ SENSÍVEL</span>':"item comum";
    let controls="";

    if(locked){
      controls=`<button class="btn secondary" disabled>🔒 Sem autorização sensível</button>`;
    }else if(status==="EXCEPTION"&&canPick()){
      const alternatives=group.alternatives
        .filter(alt=>alt.location_code!==loc&&(!group.sensitive||alt.sensitive_area))
        .map(alt=>`<button class="btn secondary" data-alt="${esc(group.key)}" data-alt-location="${esc(alt.location_code)}">Ir para ${esc(alt.location_code)}${alt.available_units?` · ${alt.available_units} un sist.`:""}</button>`).join("");
      controls=`
        ${alternatives||'<span class="exception-hint">Sem coordenada alternativa cadastrada.</span>'}
        <button class="btn warn" data-partial="${esc(group.key)}">Retirada parcial</button>
        <button class="btn warn" data-unavailable="${esc(group.key)}">Registrar indisponível</button>
        <button class="btn secondary" data-cancel-exception="${esc(group.key)}">Cancelar</button>
      `;
    }else if(status==="CONFIRMED"){
      controls=canPick()?`<button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">✓ Retirado</span>`;
    }else if(status==="PARTIAL"){
      controls=canPick()?`<span class="resolved-label">⚠ Parcial: ${esc(rec.actual_quantity)} un</span><button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">⚠ Parcial: ${esc(rec.actual_quantity)} un</span>`;
    }else if(status==="UNAVAILABLE"){
      controls=canPick()?`<span class="resolved-label">⚠ Indisponível</span><button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`:`<span class="resolved-label">⚠ Indisponível</span>`;
    }else if(readonly){
      controls=`<span class="resolved-label">Aguardando resolução anterior</span>`;
    }else{
      controls=`<button class="btn primary" data-confirm="${esc(group.key)}">✓ Retirado</button><button class="btn warn" data-exception="${esc(group.key)}">Não encontrei</button>`;
    }

    return `<article class="${cls}">
      <div class="loc">${esc(loc)}</div>
      <div>
        <div class="material">${esc(group.description)}</div>
        <div class="meta"><span>${sensitive}</span><span>${group.sources.length} referência(s)</span>${loc!==group.primary_location?`<span>Origem: ${esc(group.primary_location)}</span>`:""}</div>
        <div class="orders">${group.sources.map(esc).join(" &nbsp; • &nbsp; ")}</div>
        ${status==="EXCEPTION"?`<div class="exception-box"><strong>Não encontrado em ${esc(loc)}</strong><span>Escolha uma coordenada alternativa ou registre a contingência.</span></div>`:""}
        <div class="actions">${controls}</div>
      </div>
      <div class="qty"><strong>${group.quantity}</strong><span>unidade(s)</span></div>
    </article>`;
  }).join("")||`<div class="empty">Nenhum item pendente nesta visualização.</div>`;

  const allResolved=resolved===total&&total>0&&exceptions===0;
  let flowNotice="";
  if(allResolved&&access.state==="ENTRY_CONFIRMED"){
    flowNotice=`<div class="notice"><strong>Checklist concluído.</strong> Agora simule/aguarde o fechamento da porta. A confirmação final será liberada depois de <code>DOOR_CLOSED</code>.</div>`;
  }else if(access.state==="READY_TO_CONFIRM"&&!allResolved){
    flowNotice=`<div class="notice critical"><strong>Porta fechada com pendências.</strong> A confirmação permanece bloqueada até que todas as linhas tenham resultado válido.</div>`;
  }else if(access.state==="READY_TO_CONFIRM"&&allResolved){
    flowNotice=`<div class="notice"><strong>Porta fechada.</strong> O resultado está pronto para confirmação final.</div>`;
  }

  app.innerHTML=shell(`
    <div class="session-bar">
      <div class="stat"><span>Servidor</span><strong>${esc(access.employee?.name||"—")}</strong></div>
      <div class="stat"><span>Ordens</span><strong>${access.orders?.length||0}</strong></div>
      <div class="stat"><span>Progresso</span><strong>${resolved}/${total}</strong></div>
      <div class="stat"><span>Sessão</span><strong>${esc(stateLabel(access.state))}</strong></div>
    </div>
    <section class="hero"><div class="hero-row"><div><div class="eyebrow">Separação guiada por coordenada</div><h1>Siga a sequência física do estoque</h1><p class="lead">Quando um material não estiver na coordenada prevista, registre a divergência e siga a contingência sem apagar o ocorrido.</p></div><div class="progress-wrap"><div class="progress-label"><span>Checklist</span><strong>${percent}%</strong></div><div class="progress"><div style="width:${percent}%"></div></div></div></div></section>
    ${closed?`<div class="notice critical"><strong>Sessão física encerrada.</strong> Esta tela está em modo de consulta.</div>`:""}
    ${exceptions?`<div class="notice critical"><strong>${exceptions} divergência(s) aberta(s).</strong> Resolva cada item antes da confirmação.</div>`:""}
    ${flowNotice}
    <div class="toolbar"><h2>Materiais</h2><div class="filters"><button class="chip-btn ${filter==="pending"?"active":""}" data-filter="pending">Pendentes</button><button class="chip-btn ${filter==="all"?"active":""}" data-filter="all">Todos</button></div></div>
    <section class="pick-list">${cards}</section>
    <div class="footer-actions"><div class="status">${exceptions?"Há divergências para resolver":allResolved?(canConfirm()?"Pronto para confirmar":"Checklist concluído • aguardando fechamento da porta"):"Confirme cada posição conforme separar"}</div><button class="btn primary confirm-all" id="confirmAll" ${allResolved&&canConfirm()&&!closed?"":"disabled"}>CONFIRMAR RETIRADA</button></div>
  `);

  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;render();}));

  document.querySelectorAll("[data-confirm]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.confirm);if(!group)return;
    await pickingEvent("PICKING_ITEM_CONFIRMED",group,{actual_quantity:group.quantity});
    writeGroup(group,{status:"CONFIRMED",actual_quantity:group.quantity});
    render();
  }));

  document.querySelectorAll("[data-undo]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.undo);if(!group)return;
    await pickingEvent("PICKING_ITEM_UNDONE",group);
    writeGroup(group,{status:"PENDING",actual_quantity:null});
    render();
  }));

  document.querySelectorAll("[data-exception]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.exception);if(!group)return;
    await pickingEvent("STOCK_LOCATION_DISCREPANCY",group,{system_quantity:group.quantity,found_quantity:null});
    writeGroup(group,{status:"EXCEPTION",discrepancy_location:activeLocation(group)});
    render();
  }));

  document.querySelectorAll("[data-alt]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.alt);if(!group)return;
    const from=activeLocation(group),to=btn.dataset.altLocation;
    await pickingEvent("PICKING_LOCATION_REROUTED",group,{from_location:from,to_location:to});
    writeGroup(group,{status:"PENDING",active_location:to});
    render();
  }));

  document.querySelectorAll("[data-partial]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.partial);if(!group)return;
    const actual=Number(prompt(`Quantidade realmente encontrada (máx. ${group.quantity}):`,"1"));
    if(!Number.isFinite(actual)||actual<=0||actual>=group.quantity)return alert("Informe quantidade maior que zero e menor que a solicitada.");
    await pickingEvent("PICKING_PARTIAL",group,{actual_quantity:actual});
    writeGroup(group,{status:"PARTIAL",actual_quantity:actual});
    render();
  }));

  document.querySelectorAll("[data-unavailable]").forEach(btn=>btn.addEventListener("click",async()=>{
    const group=groups.find(x=>x.key===btn.dataset.unavailable);if(!group)return;
    if(!confirm("Registrar que nenhuma unidade foi encontrada?"))return;
    await pickingEvent("PICKING_UNAVAILABLE",group,{actual_quantity:0});
    writeGroup(group,{status:"UNAVAILABLE",actual_quantity:0});
    render();
  }));

  document.querySelectorAll("[data-cancel-exception]").forEach(btn=>btn.addEventListener("click",()=>{
    const group=groups.find(x=>x.key===btn.dataset.cancelException);if(!group)return;
    writeGroup(group,{status:"PENDING"});
    render();
  }));

  document.getElementById("confirmAll")?.addEventListener("click",async()=>{
    const latestGroups=groupsFromAccess();
    const results=latestGroups.map(group=>({
      key:group.key,
      description:group.description,
      expected_quantity:group.quantity,
      actual_quantity:actualQuantity(group),
      location_code:activeLocation(group),
      status:groupStatus(group)
    }));
    try{
      access=await apiPost({
        action:"confirmWithdrawal",
        access_session_id:ACCESS_ID,
        results,
        command_id:cmd("confirm"),
        source_device_id:PICKING_DISPLAY_ID
      });
      render();
    }catch(error){
      alert("A retirada ainda não pode ser confirmada: "+error.message);
    }
  });
}

async function refresh(){
  if(!ACCESS_ID){app.innerHTML=shell(`<div class="empty">Sessão não informada. Abra esta tela a partir do Terminal de Acesso.</div>`);return;}
  try{
    const latest=await apiGet({action:"accessSession",id:ACCESS_ID});
    if(!latest)throw new Error("SESSION_NOT_FOUND");
    const signature=JSON.stringify({state:latest.state,confirmation:latest.withdrawal_confirmation?.confirmed_at||null,events:latest.events?.length||0});
    access=latest;
    if(signature!==lastSignature||!app.innerHTML){lastSignature=signature;render();}
  }catch{
    app.innerHTML=shell(`<div class="empty">Não foi possível carregar a sessão. Verifique o Terminal de Acesso e tente novamente.</div>`);
  }
}

refresh();
setInterval(refresh,2000);
