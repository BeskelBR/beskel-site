"use strict";

// Bridge DEV entre o Terminal de Acesso externo e a tela interna de separação.
// Mantém os dois papéis separados: o terminal externo autentica/libera acesso;
// a tela interna guia e confirma a separação.

function replaceSeparationCopy(){
  const replacements=[
    ["O Terminal confirma o contexto do acesso; o picking detalhado continua no HVB Mobile.","Confira os materiais e selecione uma ou mais Ordens de Retirada. A separação será guiada pela tela interna da sala."],
    ["A lista acima confirma o contexto das ordens selecionadas. A conferência item a item, ajustes e confirmação final continuam no HVB Mobile.","A lista acima confirma o contexto das ordens selecionadas. A conferência e a confirmação da retirada acontecem na tela de separação dentro da sala."],
    ["O Terminal agora exibe as Ordens de Retirada e seus materiais para confirmação de contexto, mas picking item a item e escrituração permanecem no HVB Mobile/API.","O Terminal exibe as Ordens de Retirada e seus materiais para confirmação de contexto. A separação é guiada pela tela interna e a escrituração permanece na API HVB."],
    ["Picking no HVB Mobile","Separação na tela interna"],
    ["Continue no dispositivo móvel autorizado.","Continue na tela de separação dentro da sala."]
  ];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{let value=node.nodeValue;replacements.forEach(([from,to])=>{value=value.replace(from,to);});node.nodeValue=value;});
}

function injectSeparationLink(){
  if(!location.pathname.startsWith("/acesso/"))return;
  if(document.getElementById("openSeparation"))return;
  const accessId=decodeURIComponent(location.pathname.split("/").filter(Boolean)[1]||"");
  if(!accessId)return;
  const content=document.querySelector("main.content");
  if(!content)return;

  const panel=document.createElement("div");
  panel.className="dev-panel";
  panel.innerHTML=`<div class="eyebrow">Tela interna da sala</div><p>Use a segunda tela/tablet para simular a separação guiada por localização física. Ela acompanha esta mesma AccessSession.</p><div class="actions"><button class="btn" id="openSeparation">Abrir Terminal de Retirada</button></div>`;
  const devPanel=content.querySelector(".dev-panel");
  if(devPanel)content.insertBefore(panel,devPanel);else content.appendChild(panel);
  panel.querySelector("#openSeparation")?.addEventListener("click",()=>window.open(`/separacao/${encodeURIComponent(accessId)}`,"hvb-separacao","noopener"));
}

function apply(){replaceSeparationCopy();injectSeparationLink();}
const observer=new MutationObserver(apply);observer.observe(document.documentElement,{subtree:true,childList:true});apply();
