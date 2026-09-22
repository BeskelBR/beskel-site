"use strict";

// Delta v4 — fluxo físico N1 aprovado para o Terminal HVB.
// Mantém app.js como base e substitui somente as telas/controles reabertos nesta revisão.

state.liveItems = state.liveItems || [];

let hvbV4AccessPoll = null;
let hvbV4AccessPollId = null;

function v4StopAccessPoll(){
  if(hvbV4AccessPoll) clearInterval(hvbV4AccessPoll);
  hvbV4AccessPoll = null;
  hvbV4AccessPollId = null;
}
function v4EnsureAccessPoll(id){
  if(hvbV4AccessPoll && hvbV4AccessPollId === id) return;
  v4StopAccessPoll();
  hvbV4AccessPollId = id;
  hvbV4AccessPoll = setInterval(()=>{
    if(location.pathname !== `/acesso/${encodeURIComponent(id)}`) return v4StopAccessPoll();
    accessScreen(id);
  },2500);
}

function v4StateLabel(value){
  return ({
    DOOR_AUTHORIZED:"Acesso liberado",
    DOOR_OPEN:"Porta aberta",
    ENTRY_CONFIRMED:"Presença detectada",
    READY_TO_CONFIRM:"Porta fechada • aguardando confirmação",
    WITHDRAWAL_CONFIRMED:"Retirada confirmada",
    CLOSED:"Sessão encerrada",
    EXPIRED:"Sessão expirada"
  }[value] || value || "—");
}

function v4LiveItemsPanel(){
  const rows=state.liveItems.length
    ? state.liveItems.map((item,index)=>`<div class="material-row"><span><b>${esc(item.location_code)}</b> · ${esc(item.description)} ${item.sensitive?'<span class="chip sensitive">Sensível</span>':""}</span><strong>${esc(item.quantity)}</strong><button class="btn ghost" data-remove-live="${index}">Remover</button></div>`).join("")
    : `<p class="lead">Nenhum ajuste ao vivo adicionado.</p>`;
  return `<div class="dev-panel live-context-panel"><div class="eyebrow">Edição ao vivo • DEV</div><p>Use quando a retirada precisar incluir material fora das ORs selecionadas. O ajuste fica vinculado à AccessSession e será auditável.</p><div class="materials-list">${rows}</div><div class="actions"><button class="btn secondary" id="addLiveItem">+ Adicionar material</button></div></div>`;
}

function v4UpdateSelection(orders){
  const selected=selectedOrdersFrom(orders);
  const total=selected.length+state.liveItems.length;
  const count=document.getElementById("selectedCount");
  const authorize=document.getElementById("authorizeSelected");
  if(count) count.textContent=`${selected.length} OR(s) + ${state.liveItems.length} ajuste(s) ao vivo`;
  if(authorize){
    authorize.disabled=total===0;
    authorize.textContent=total?`Confirmar contexto (${total}) e autorizar acesso`:"Selecione OR(s) ou adicione material";
  }
}

function v4BindLiveItems(orders){
  document.getElementById("addLiveItem")?.addEventListener("click",()=>{
    const description=prompt("Material a adicionar:");
    if(!description?.trim()) return;
    const quantity=Number(prompt("Quantidade:","1"));
    if(!Number.isFinite(quantity)||quantity<=0) return alert("Quantidade inválida.");
    const locationCode=(prompt("Coordenada física:","MANUAL")||"MANUAL").trim().toUpperCase();
    const sensitive=confirm("Este material pertence ao estoque sensível?");
    state.liveItems.push({
      live_item_id:`live_${Date.now()}_${state.liveItems.length+1}`,
      description:description.trim(),
      quantity,
      location_code:locationCode,
      sensitive
    });
    const host=document.getElementById("liveContextHost");
    if(host) host.innerHTML=v4LiveItemsPanel();
    v4BindLiveItems(orders);
    v4UpdateSelection(orders);
  });
  document.querySelectorAll("[data-remove-live]").forEach(btn=>btn.addEventListener("click",()=>{
    state.liveItems.splice(Number(btn.dataset.removeLive),1);
    const host=document.getElementById("liveContextHost");
    if(host) host.innerHTML=v4LiveItemsPanel();
    v4BindLiveItems(orders);
    v4UpdateSelection(orders);
  }));
}

ordersScreen = async function(){
  v4StopAccessPoll();
  const auth=readJson(AUTH_KEY);
  if(!auth?.auth_session_id||auth.expires_at<Date.now())return go("/");
  state.auth=auth;
  state.selectedOrders.clear();
  state.liveItems=[];
  try{
    const orders=await apiGet({action:"pendingOrders",auth_session_id:auth.auth_session_id});
    const cards=orders.length?orders.map(orderCard).join(""):`<div class="card"><h2>Nenhuma ordem pendente</h2><p class="lead">Você ainda pode registrar um material por edição ao vivo.</p></div>`;
    render(shell(`
      <div class="eyebrow">Usuário autenticado</div>
      <h1>${esc(auth.employee.name)}</h1>
      <p class="lead">Selecione uma ou mais Ordens de Retirada ou registre um ajuste ao vivo. O contexto é confirmado antes da abertura da porta.</p>
      <div class="selection-toolbar">
        <div><div class="section-title">Ordens aguardando retirada</div><strong id="selectedCount">0 OR(s) + 0 ajuste(s) ao vivo</strong></div>
        <div class="selection-actions"><button class="btn ghost" id="selectAll" ${orders.length?"":"disabled"}>Selecionar todas</button><button class="btn ghost" id="clearAll" disabled>Limpar</button></div>
      </div>
      <div class="list">${cards}</div>
      <div id="liveContextHost">${v4LiveItemsPanel()}</div>
      <div class="sticky-actions"><button class="btn" id="authorizeSelected" disabled>Selecione OR(s) ou adicione material</button><button class="btn ghost" id="cancel">Encerrar autenticação</button></div>
    `,"Ordens e materiais"));

    document.querySelectorAll(".order-checkbox").forEach(input=>input.addEventListener("change",()=>{
      if(input.checked)state.selectedOrders.add(input.value);else state.selectedOrders.delete(input.value);
      input.closest("[data-order-card]")?.classList.toggle("selected",input.checked);
      const clear=document.getElementById("clearAll");
      if(clear)clear.disabled=state.selectedOrders.size===0;
      v4UpdateSelection(orders);
    }));
    document.getElementById("selectAll")?.addEventListener("click",()=>{
      document.querySelectorAll(".order-checkbox").forEach(input=>{input.checked=true;state.selectedOrders.add(input.value);input.closest("[data-order-card]")?.classList.add("selected");});
      document.getElementById("clearAll").disabled=false;
      v4UpdateSelection(orders);
    });
    document.getElementById("clearAll")?.addEventListener("click",()=>{
      document.querySelectorAll(".order-checkbox").forEach(input=>{input.checked=false;input.closest("[data-order-card]")?.classList.remove("selected");});
      state.selectedOrders.clear();
      document.getElementById("clearAll").disabled=true;
      v4UpdateSelection(orders);
    });
    document.getElementById("authorizeSelected")?.addEventListener("click",()=>authorizeAccess([...state.selectedOrders],state.liveItems));
    document.getElementById("cancel")?.addEventListener("click",()=>go("/"));
    v4BindLiveItems(orders);
    v4UpdateSelection(orders);
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    go("/");
  }
};

authorizeAccess = async function(orderIds,liveItems=[]){
  if(!state.auth?.auth_session_id)return go("/");
  const ids=[...new Set((orderIds||[]).filter(Boolean))];
  const additions=(Array.isArray(liveItems)?liveItems:[]).map(item=>({...item}));
  if(!ids.length&&!additions.length)return;
  render(shell(`<div class="card"><div class="eyebrow">Etapa 3 • Contexto da retirada</div><h1>Validando retirada…</h1><p class="lead">A API está verificando ORs, ajustes ao vivo, permissões e eventual acesso ao estoque sensível.</p></div>`,"Controle de acesso"));
  try{
    state.access=await apiPost({
      action:"startAccessSession",
      auth_session_id:state.auth.auth_session_id,
      order_ids:ids,
      live_items:additions,
      terminal_id:TERMINAL_ID,
      command_id:commandId("access")
    });
    state.liveItems=[];
    go(`/acesso/${encodeURIComponent(state.access.access_session_id)}`);
  }catch(error){
    if(isConnectivityError(error))return failClosed();
    const msg=error.message==="SENSITIVE_ACCESS_DENIED"
      ?"Seu perfil não possui autorização para os itens sensíveis presentes no contexto da retirada."
      : error.message==="LIVE_ITEM_INVALID"
        ?"Há um material adicionado ao vivo com dados inválidos."
        :"Não foi possível criar a sessão de acesso.";
    showError("Acesso não autorizado",msg,"/ordens");
  }
};

function v4AccessOrders(access){
  const orders=(access.orders||[]).map(order=>`<div class="access-order"><div class="row"><div><div class="eyebrow">${esc(order.order_id)}</div><strong>${esc(order.patient?.name||"Paciente")}</strong></div>${order.has_sensitive_items?'<span class="chip sensitive">Sensível</span>':'<span class="chip">Comum</span>'}</div><div class="order-meta"><span>${esc(order.episode_id)}</span><span>${order.item_count} itens</span></div>${materialsList(order)}</div>`).join("");
  const live=(access.live_items||[]).length
    ? `<div class="access-order"><div class="eyebrow">Ajustes ao vivo</div><strong>Materiais adicionados na etapa 3</strong><div class="materials-list">${access.live_items.map(item=>`<div class="material-row"><span><b>${esc(item.location_code)}</b> · ${esc(item.description)}</span><strong>${esc(item.quantity)}</strong>${item.sensitive?'<span class="chip sensitive">Sensível</span>':""}</div>`).join("")}</div></div>`
    : "";
  return orders+live;
}

accessScreen = async function(accessSessionId){
  try{
    const access=await apiGet({action:"accessSession",id:accessSessionId});
    if(!access)return go("/");
    state.access=access;
    const totalItems=(access.orders||[]).reduce((sum,order)=>sum+(order.item_count||0),0)+(access.live_items||[]).length;
    const sensitive=access.sensitive_access
      ? `<div class="notice sensitive-notice"><b>Acesso sensível autorizado</b><span>Esta sessão contém material sensível e a permissão foi validada antes da abertura.</span></div>`
      : "";
    render(shell(`
      <div class="access-banner"><div class="big-check">✓</div><div><div class="eyebrow">Sessão de acesso</div><h1>${esc(access.employee?.name||"Funcionário")}</h1></div></div>
      <div class="card"><div class="summary"><div class="summary-row"><span>Ordens</span><strong>${access.orders?.length||0}</strong></div><div class="summary-row"><span>Ajustes ao vivo</span><strong>${access.live_items?.length||0}</strong></div><div class="summary-row"><span>Itens</span><strong>${totalItems}</strong></div><div class="summary-row"><span>Status</span><strong>${esc(v4StateLabel(access.state))}</strong></div></div></div>
      ${sensitive}
      <div class="section-title">Contexto confirmado da retirada</div>
      <div class="access-orders">${v4AccessOrders(access)}</div>
      <div class="notice"><b>Fluxo físico N1</b><span>NFC → biometria → contexto da retirada → abertura → presença → separação guiada → fechamento da porta → confirmação.</span></div>
      <div class="dev-panel"><div class="eyebrow">Terminal de Retirada</div><p>Abra a tela interna vinculada a esta mesma AccessSession para acompanhar a separação em tempo real.</p><div class="actions"><button class="btn" id="openSeparation">Abrir Terminal de Retirada</button></div></div>
      ${devControls(access)}
      <p class="footer-note">DEV: controladores, sensores, câmera e NFC estão simulados. Nenhum movimento real de estoque é realizado.</p>
    `,"Sessão de acesso"));
    document.getElementById("openSeparation")?.addEventListener("click",()=>window.open(`/separacao/${encodeURIComponent(accessSessionId)}`,"hvb-separacao","noopener"));
    bindDev(access);
    v4EnsureAccessPoll(accessSessionId);
  }catch(error){
    if(isConnectivityError(error))return failClosed("A API HVB ficou indisponível. O Terminal não emitirá novas autorizações ou transições enquanto estiver desconectado.");
    go("/");
  }
};

devControls = function(access){
  let button="";
  if(access.state==="DOOR_AUTHORIZED")button=`<button class="btn secondary" data-event="DOOR_OPENED">${access.sensitive_access?"Simular abertura + acesso sensível":"Simular porta aberta"}</button>`;
  else if(access.state==="DOOR_OPEN")button=`<button class="btn secondary" data-event="PRESENCE_CONFIRMED">Simular presença detectada</button>`;
  else if(access.state==="ENTRY_CONFIRMED")button=`<button class="btn secondary" data-event="DOOR_CLOSED">Simular fechamento da porta após picking</button>`;
  else if(access.state==="READY_TO_CONFIRM")button=`<button class="btn secondary" disabled>Aguardando confirmação no Terminal de Retirada</button>`;
  else if(access.state==="WITHDRAWAL_CONFIRMED")button=`<button class="btn ghost" id="finish">Finalizar demonstração</button>`;
  else button=`<button class="btn ghost" id="finish">Voltar ao terminal</button>`;
  return `<div class="dev-panel"><div class="eyebrow">Controles DEV</div><p>Simulação da sequência física aprovada. O Terminal de Retirada acompanha esta mesma AccessSession.</p><div class="actions">${button}</div></div>`;
};

bindDev = function(access){
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
  document.getElementById("finish")?.addEventListener("click",()=>{v4StopAccessPoll();go("/");});
};

function v4ReplaceCredentialCopy(){
  const replacements=[
    ["DESFire EV3 + confirmação facial","NFC TAG + confirmação facial"],
    ["DESFire identificado","NFC TAG identificada"],
    ["DESFire EV3","NFC TAG simples"],
    ["DESFire","NFC"]
  ];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{let value=node.nodeValue;replacements.forEach(([from,to])=>value=value.replace(from,to));node.nodeValue=value;});
}
const v4CopyObserver=new MutationObserver(v4ReplaceCredentialCopy);
v4CopyObserver.observe(document.documentElement,{subtree:true,childList:true});
v4ReplaceCredentialCopy();

// Approved v4 is now the canonical runtime layer for the DEV terminal.
router();
