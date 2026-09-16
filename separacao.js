"use strict";

const app=document.getElementById("separationApp");
const API="/api/mock";
const ACCESS_ID=(location.pathname.match(/^\/separacao\/([^/]+)$/)||[])[1]||new URLSearchParams(location.search).get("access");
const STORAGE_KEY=`hvb_separation_${ACCESS_ID||"none"}`;

const LOCATION_MAP=[
  [/agulha 25 x 7/i,"A2"],[/agulha 13 x 4,5/i,"A3"],[/agulha/i,"A4"],
  [/gaze/i,"G4"],[/compressa/i,"G3"],[/atadura/i,"G2"],[/algod/i,"G1"],
  [/medicamento x/i,"E1"],[/medicamento y/i,"E2"],[/medicamento z/i,"E3"],[/controlado/i,"E4"],
  [/cateter 20/i,"C1"],[/cateter 22/i,"C2"],[/cateter 24/i,"C3"],[/cateter/i,"C4"],
  [/seringa 1/i,"S1"],[/seringa 3/i,"S2"],[/seringa 5/i,"S3"],[/seringa 10/i,"S4"],[/seringa 20/i,"S5"],[/seringa/i,"S6"],
  [/soro 250/i,"H1"],[/soro 500/i,"H2"],[/soro 1000/i,"H3"],[/soro/i,"H4"],
  [/equipo/i,"B1"],[/extensor/i,"B2"],[/torneira/i,"B3"],[/sonda/i,"B4"],
  [/luva/i,"L1"],[/esparadrapo/i,"L2"],[/álcool/i,"L3"],[/clorexidina/i,"L4"],[/lâmina/i,"L5"],[/gel/i,"L6"]
];

let access=null;
let filter="pending";
let localState=loadState();
let lastAccessState=null;

function loadState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{};}catch{return {};}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(localState));}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function nowLabel(){return new Date().toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});}
function locationFor(item){
  if(item.location_code)return item.location_code;
  const hit=LOCATION_MAP.find(([re])=>re.test(item.description||""));
  return hit?hit[1]:"Z9";
}
function canPick(){return access&&["ENTRY_CONFIRMED","SENSITIVE_CABINET_AUTHORIZED","SENSITIVE_CABINET_OPEN","ACCESS_ACTIVE"].includes(access.state);}
function sensitiveUnlocked(){return access&&["SENSITIVE_CABINET_OPEN","ACCESS_ACTIVE"].includes(access.state);}
function stateLabel(v){return ({DOOR_AUTHORIZED:"Acesso autorizado",DOOR_OPEN:"Porta aberta",ENTRY_CONFIRMED:"Entrada confirmada",SENSITIVE_CABINET_AUTHORIZED:"Armário sensível aguardando abertura",SENSITIVE_CABINET_OPEN:"Armário sensível aberto",ACCESS_ACTIVE:"Separação em andamento",CLOSED:"Sessão encerrada",EXPIRED:"Sessão expirada"}[v]||v||"—");}

async function apiGet(params){
  const res=await fetch(`${API}?${new URLSearchParams(params)}`,{cache:"no-store"});
  const body=await res.json();
  if(!res.ok||!body.ok)throw new Error(body.error||"REQUEST_FAILED");
  return body.data;
}

function groupsFromAccess(){
  const map=new Map();
  (access?.orders||[]).forEach(order=>{
    (order.items||[]).forEach((item,index)=>{
      const loc=locationFor(item);
      const key=`${loc}|${item.description}|${item.sensitive?1:0}`;
      if(!map.has(key))map.set(key,{key,location:loc,description:item.description,sensitive:item.sensitive===true,quantity:0,orders:[],members:[]});
      const group=map.get(key);
      group.quantity+=Number(item.quantity||0);
      group.orders.push(`${order.order_id} · ${item.quantity}`);
      group.members.push(`${order.order_id}:${index}`);
    });
  });
  return [...map.values()].sort((a,b)=>a.location.localeCompare(b.location,"pt-BR",{numeric:true}));
}
function groupStatus(group){return localState[group.key]?.status||"PENDING";}
function setGroupStatus(group,status){localState[group.key]={status,updated_at:new Date().toISOString()};saveState();render();}

function shell(content){
  return `<div class="screen"><div class="dev-banner">DEV • Tela interna de separação • nenhum movimento real de estoque</div><header class="topbar"><div class="brand"><img src="/hvb/assets/logo-lateral.webp" alt="Hospital Veterinário Brasília"><div><div class="brand-title">Terminal de Retirada</div><div class="room-label">Sala de estoque • PICKING-DISPLAY-01</div></div></div><div class="clock">${nowLabel()}</div></header><main class="content">${content}</main></div>`;
}

function waitingScreen(){
  const name=access?.employee?.name||"Servidor autenticado";
  app.innerHTML=shell(`<section class="success"><div class="eyebrow">Sessão reconhecida</div><h1>${esc(name)}</h1><p class="lead">A tela interna está vinculada à sessão ${esc(access?.access_session_id||ACCESS_ID||"—")}.</p><div class="notice"><strong>${esc(stateLabel(access?.state))}</strong><br>A separação será liberada somente após o sensor confirmar a entrada na sala.</div><p class="lead">Continue a simulação no Terminal de Acesso externo.</p></section>`);
}

function render(){
  if(!access){app.innerHTML=shell(`<div class="empty">Carregando sessão de acesso…</div>`);return;}
  if(!canPick()&&!["CLOSED","EXPIRED"].includes(access.state)){waitingScreen();return;}
  const groups=groupsFromAccess();
  const completed=groups.filter(g=>groupStatus(g)==="CONFIRMED").length;
  const exceptions=groups.filter(g=>groupStatus(g)==="EXCEPTION").length;
  const total=groups.length;
  const percent=total?Math.round(completed/total*100):0;
  const shown=groups.filter(g=>filter==="all"||groupStatus(g)!=="CONFIRMED");
  const isClosed=["CLOSED","EXPIRED"].includes(access.state);
  const finalDone=localState.__final?.status==="CONFIRMED";

  if(finalDone){
    app.innerHTML=shell(`<section class="success"><div class="check">✓</div><div class="eyebrow">Retirada confirmada no protótipo</div><h1>${completed} posições conferidas</h1><p class="lead">O checklist desta sessão foi concluído na tela interna.</p><div class="notice"><strong>DEV:</strong> esta confirmação não gera baixa real de estoque. No HVB Sistema, a confirmação final será enviada à API para escrituração transacional.</div><button class="btn primary" id="review">Revisar checklist</button></section>`);
    document.getElementById("review")?.addEventListener("click",()=>{delete localState.__final;saveState();render();});
    return;
  }

  const cards=shown.map(group=>{
    const status=groupStatus(group);
    const locked=group.sensitive&&!sensitiveUnlocked();
    const cls=`pick-card ${status==="CONFIRMED"?"done":""} ${locked?"locked":""}`;
    const sensitive=group.sensitive?`<span style="color:var(--critical);font-weight:800">⚠ SENSÍVEL</span>`:"item comum";
    const controls=locked
      ? `<button class="btn secondary" disabled>🔒 Aguardando armário</button>`
      : status==="CONFIRMED"
        ? `<button class="btn secondary" data-undo="${esc(group.key)}">Desfazer</button>`
        : `<button class="btn primary" data-confirm="${esc(group.key)}">✓ Retirado</button><button class="btn warn" data-exception="${esc(group.key)}">Não encontrado</button>`;
    return `<article class="${cls}"><div class="loc">${esc(group.location)}</div><div><div class="material">${esc(group.description)}</div><div class="meta"><span>${sensitive}</span><span>${group.orders.length} referência(s) de OR</span></div><div class="orders">${group.orders.map(esc).join(" &nbsp; • &nbsp; ")}</div><div class="actions">${controls}</div></div><div class="qty"><strong>${group.quantity}</strong><span>unidade(s)</span></div></article>`;
  }).join("")||`<div class="empty">Nenhum item pendente nesta visualização.</div>`;

  const warning=isClosed?`<div class="notice critical"><strong>Sessão física encerrada.</strong> O checklist fica apenas para consulta DEV.</div>`:"";
  const exceptionNote=exceptions?`<div class="notice critical"><strong>${exceptions} pendência(s).</strong> Resolva os itens marcados como não encontrados antes da confirmação final.</div>`:"";
  app.innerHTML=shell(`
    <div class="session-bar">
      <div class="stat"><span>Servidor</span><strong>${esc(access.employee?.name||"—")}</strong></div>
      <div class="stat"><span>Ordens</span><strong>${access.orders?.length||0}</strong></div>
      <div class="stat"><span>Progresso</span><strong>${completed}/${total}</strong></div>
      <div class="stat"><span>Sessão</span><strong>${esc(stateLabel(access.state))}</strong></div>
    </div>
    <section class="hero"><div class="hero-row"><div><div class="eyebrow">Separação guiada por endereço</div><h1>Siga a sequência física do estoque</h1><p class="lead">O código grande indica onde buscar. Ordens iguais são consolidadas sem perder a referência de origem.</p></div><div class="progress-wrap"><div class="progress-label"><span>Checklist</span><strong>${percent}%</strong></div><div class="progress"><div style="width:${percent}%"></div></div></div></div></section>
    ${warning}${exceptionNote}
    <div class="toolbar"><h2>Materiais</h2><div class="filters"><button class="chip-btn ${filter==="pending"?"active":""}" data-filter="pending">Pendentes</button><button class="chip-btn ${filter==="all"?"active":""}" data-filter="all">Todos</button></div></div>
    <section class="pick-list">${cards}</section>
    <div class="footer-actions"><div class="status">${exceptions?"Há pendências para resolver":completed===total&&total?"Todos os itens foram conferidos":"Confirme cada posição conforme separar"}</div><button class="btn primary confirm-all" id="confirmAll" ${completed===total&&total&&!exceptions&&!isClosed?"":"disabled"}>CONFIRMAR RETIRADA</button></div>
  `);

  document.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;render();}));
  document.querySelectorAll("[data-confirm]").forEach(btn=>btn.addEventListener("click",()=>{const g=groups.find(x=>x.key===btn.dataset.confirm);if(g)setGroupStatus(g,"CONFIRMED");}));
  document.querySelectorAll("[data-undo]").forEach(btn=>btn.addEventListener("click",()=>{const g=groups.find(x=>x.key===btn.dataset.undo);if(g)setGroupStatus(g,"PENDING");}));
  document.querySelectorAll("[data-exception]").forEach(btn=>btn.addEventListener("click",()=>{const g=groups.find(x=>x.key===btn.dataset.exception);if(g)setGroupStatus(g,"EXCEPTION");}));
  document.getElementById("confirmAll")?.addEventListener("click",()=>{localState.__final={status:"CONFIRMED",confirmed_at:new Date().toISOString(),access_session_id:ACCESS_ID};saveState();render();});
}

async function refresh(){
  if(!ACCESS_ID){app.innerHTML=shell(`<div class="empty">Sessão não informada. Abra esta tela a partir do Terminal de Acesso.</div>`);return;}
  try{
    const latest=await apiGet({action:"accessSession",id:ACCESS_ID});
    if(!latest)throw new Error("SESSION_NOT_FOUND");
    const changed=latest.state!==lastAccessState;
    access=latest;lastAccessState=latest.state;
    if(changed||!app.innerHTML)render();
  }catch{
    app.innerHTML=shell(`<div class="empty">Não foi possível carregar a sessão. Verifique o Terminal de Acesso e tente novamente.</div>`);
  }
}

refresh();
setInterval(refresh,2500);
