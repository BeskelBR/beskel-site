"use strict";

// Near-term operational demo: use the employee's messaging channel as the
// in-room reference list. This does not move stock, confirm clinical execution,
// or replace the HVB API as the system of record.

const HVB_MESSAGING_MODE = "WHATSAPP";

function messagingWithdrawalMessage(orders){
  const lines=["HVB — Ordens para retirada","",`${orders.length} ordem(ns) selecionada(s)`];
  orders.forEach(order=>{
    lines.push("",order.order_id);
    (order.items||[]).forEach(item=>lines.push(`• ${item.description} — ${item.quantity}${item.sensitive?" [SENSÍVEL]":""}`));
  });
  lines.push("","Use esta mensagem como referência durante a separação.","A escrituração oficial permanece na API HVB.");
  return lines.join("\n");
}

// Replace the DEV message body used by the existing WhatsApp helper.
withdrawalMessage = messagingWithdrawalMessage;

function prepareWhatsappWindow(){
  const phone=configuredWhatsapp();
  if(!phone)return null;
  try{
    const popup=window.open("about:blank","_blank");
    if(popup){
      popup.document.title="Preparando WhatsApp…";
      popup.document.body.innerHTML="<p style='font-family:sans-serif;padding:24px'>Preparando lista de retirada…</p>";
    }
    return popup;
  }catch{
    return null;
  }
}

function deliverWhatsappWindow(popup,orders){
  const phone=configuredWhatsapp();
  if(!phone){ if(popup&&!popup.closed)popup.close(); return false; }
  const target=`https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(messagingWithdrawalMessage(orders))}`;
  if(popup&&!popup.closed){
    popup.opener=null;
    popup.location.replace(target);
  }else{
    window.open(target,"_blank","noopener,noreferrer");
  }
  return true;
}

// The original implementation creates the AccessSession correctly, but only
// offers WhatsApp as a separate manual action. For the demonstration we open a
// WhatsApp handoff as a direct consequence of the user's explicit confirmation
// of the selected ORs. wa.me cannot press "Send" for the user; true unattended
// dispatch requires WhatsApp Business Platform/API and is intentionally outside
// this DEV demonstration.
authorizeAccess = async function(orderIds){
  if(!state.auth?.auth_session_id)return go("/");
  const ids=[...new Set((orderIds||[]).filter(Boolean))];
  if(!ids.length)return;

  const whatsappWindow=prepareWhatsappWindow();
  render(shell(`<div class="card"><div class="eyebrow">Autorização + mensageria</div><h1>Validando ${ids.length} ordem(ns)…</h1><p class="lead">A API valida permissões e cria a sessão. Em seguida, a lista será preparada para o WhatsApp vinculado ao servidor autenticado.</p></div>`,"Controle de acesso"));

  try{
    state.access=await apiPost({
      action:"startAccessSession",
      auth_session_id:state.auth.auth_session_id,
      order_ids:ids,
      terminal_id:TERMINAL_ID,
      command_id:commandId("access")
    });

    const sent=deliverWhatsappWindow(whatsappWindow,state.access.orders||[]);
    sessionStorage.setItem("hvb_dev_message_handoff",JSON.stringify({
      channel:HVB_MESSAGING_MODE,
      access_session_id:state.access.access_session_id,
      prepared:sent,
      prepared_at:new Date().toISOString()
    }));
    go(`/acesso/${encodeURIComponent(state.access.access_session_id)}`);
  }catch(error){
    if(whatsappWindow&&!whatsappWindow.closed)whatsappWindow.close();
    if(isConnectivityError(error))return failClosed();
    const msg=error.message==="SENSITIVE_ACCESS_DENIED"
      ?"Seu perfil não possui autorização para os itens sensíveis presentes nas ordens selecionadas."
      :"Não foi possível criar a sessão de acesso.";
    showError("Acesso não autorizado",msg,"/ordens");
  }
};

function replaceOperationalCopy(){
  const replacements=[
    ["O Terminal confirma o contexto do acesso; o picking detalhado continua no HVB Mobile.","Confira os materiais e selecione uma ou mais Ordens de Retirada. Ao confirmar, a lista é preparada para o WhatsApp vinculado ao servidor autenticado."],
    ["A lista acima confirma o contexto das ordens selecionadas. A conferência item a item, ajustes e confirmação final continuam no HVB Mobile.","A lista acima confirma o contexto das ordens selecionadas. Durante esta fase do projeto, o WhatsApp serve como referência dentro da sala; a API HVB permanece a autoridade de escrituração."],
    ["O Terminal agora exibe as Ordens de Retirada e seus materiais para confirmação de contexto, mas picking item a item e escrituração permanecem no HVB Mobile/API.","O Terminal exibe as Ordens de Retirada e seus materiais para confirmação de contexto. A lista pode seguir para o WhatsApp do servidor; a escrituração permanece na API HVB."],
    ["WhatsApp com selecionadas","Enviar lista ao WhatsApp"],
    ["Abrir WhatsApp com a lista","Abrir lista no WhatsApp"]
  ];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    let value=node.nodeValue;
    replacements.forEach(([from,to])=>{ value=value.replace(from,to); });
    node.nodeValue=value;
  });

  const handoff=readJson("hvb_dev_message_handoff");
  if(location.pathname.startsWith("/acesso/")&&handoff?.prepared){
    const content=document.querySelector("main.content");
    if(content&&!document.getElementById("messageHandoffStatus")){
      const status=document.createElement("div");
      status.id="messageHandoffStatus";
      status.className="notice";
      status.innerHTML="<b>WhatsApp preparado</b><span>A lista das ORs foi aberta para o telefone de teste vinculado neste Terminal. No DEV, o envio final ainda exige confirmação no WhatsApp.</span>";
      const firstNotice=content.querySelector(".notice");
      if(firstNotice)content.insertBefore(status,firstNotice); else content.appendChild(status);
    }
  }
}

const messagingObserver=new MutationObserver(()=>replaceOperationalCopy());
messagingObserver.observe(document.documentElement,{subtree:true,childList:true});
replaceOperationalCopy();
