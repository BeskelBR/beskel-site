(() => {
  "use strict";

  const journey = document.querySelector('.journey-board');
  if (!journey) return;
  let activeModule = '';
  let requestVersion = 0;

  function apiBase() { return location.origin.replace(/\/$/, ''); }
  function token() { return sessionStorage.getItem('hvb-session-view') || ''; }
  function unit() { return localStorage.getItem('hvb-unit-id') || ''; }
  function shortId(value) { return value ? `${String(value).slice(0, 8)}…` : '—'; }
  function fmtDate(value) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d); }
  function countText(result) { return result.ok ? `${result.items.length}${result.next ? '+' : ''}` : '—'; }
  async function request(path) {
    const current = token();
    if (!current) throw Object.assign(new Error('sessao_ausente'), { status: 401 });
    const response = await window.HVBSession.fetch(`${apiBase()}${path}`, { headers: { Accept: 'application/json' } });
    const type = response.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), { status: response.status });
    return body;
  }
  async function safe(path) { try { const data = await request(path); return { ok: true, items: data?.items || [], next: data?.next_cursor || null }; } catch (error) { return { ok: false, status: error.status || 0, items: [], next: null }; } }
  function metric(label, value) { const n = document.createElement('article'); n.className = 'journey-metric'; const s = document.createElement('span'); s.textContent = label; const b = document.createElement('strong'); b.textContent = value; n.append(s,b); return n; }
  function badge(text, kind='') { const n=document.createElement('span'); n.className=`journey-badge ${kind}`.trim(); n.textContent=text; return n; }
  function item(title,line,meta,status){ const n=document.createElement('div'); n.className='journey-item'; const a=document.createElement('strong');a.textContent=title;const b=document.createElement('span');b.textContent=line;const c=document.createElement('small');c.textContent=meta;n.append(a,b,c);if(status)n.append(status);return n; }
  function empty(text,isError=false){ const n=document.createElement('div');n.className=isError?'journey-error':'journey-empty';n.textContent=text;return n; }
  function panel(title,nodes){ const n=document.createElement('article');n.className='journey-panel';const h=document.createElement('h4');h.textContent=title;const list=document.createElement('div');list.className='journey-list';list.append(...(nodes?.length?nodes:[empty('Sem registros nesta visão.')]));n.append(h,list);return n; }
  function errorPanel(title,result){ return panel(title,[empty(result.status===403?'Visão não liberada para o perfil atual.':'Consulta indisponível no momento.',result.status!==403)]); }
  function heading(eyebrow,title,description,refresh){ const h=document.createElement('div');h.className='journey-head';const copy=document.createElement('div');const e=document.createElement('span');e.className='eyebrow';e.textContent=eyebrow;const t=document.createElement('h3');t.textContent=title;const p=document.createElement('p');p.textContent=description;copy.append(e,t,p);const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent='Atualizar jornada';b.addEventListener('click',refresh);h.append(copy,b);return h; }

  async function renderDocuments(version){
    const currentUnit=unit(); journey.replaceChildren(); journey.append(heading('Jornada documental','Documentos','Solicitações, versões, aprovações, assinaturas e entregas em leitura rastreável, sem executar atos documentais.',()=>renderFor('documentos')));
    if(!currentUnit){journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada documental.',true));return;}
    const q=encodeURIComponent(currentUnit);
    const [requests,versions,approvals,signatures,deliveries]=await Promise.all([
      safe(`/v1/documentos/solicitacoes?limit=100&unidade_id=${q}`), safe(`/v1/documentos/versoes?limit=100&unidade_id=${q}`), safe(`/v1/documentos/aprovacoes?limit=100&unidade_id=${q}`), safe(`/v1/documentos/assinaturas?limit=100&unidade_id=${q}`), safe(`/v1/documentos/entregas?limit=100&unidade_id=${q}`)
    ]);
    if(version!==requestVersion||activeModule!=='documentos')return;
    const overdue=requests.ok?requests.items.filter(x=>x.prazo_vencido):[];
    const awaitingApproval=versions.ok?versions.items.filter(x=>!x.aprovado&&!x.substituido):[];
    const metrics=document.createElement('div');metrics.className='journey-metrics';metrics.append(metric('Solicitações',countText(requests)),metric('Prazo vencido',requests.ok?`${overdue.length}${requests.next?'+':''}`:'—'),metric('Versões sem aprovação',versions.ok?`${awaitingApproval.length}${versions.next?'+':''}`:'—'),metric('Entregas',countText(deliveries)));journey.append(metrics);
    const columns=document.createElement('div');columns.className='journey-columns';
    if(requests.ok)columns.append(panel('Solicitações recentes',[...requests.items].sort((a,b)=>String(b.recebida_em||b.criada_em||'').localeCompare(String(a.recebida_em||a.criada_em||''))).slice(0,10).map(x=>item(x.protocolo||`Solicitação ${shortId(x.id)}`,`${x.escopo||'Escopo não informado'} • paciente ${shortId(x.paciente_id)}`,`Recebida ${fmtDate(x.recebida_em||x.criada_em)} • prazo ${fmtDate(x.prazo_em)}`,badge(x.prazo_vencido?'prazo vencido':(x.acesso_vigente?'acesso vigente':'revisar'),x.prazo_vencido?'bad':x.acesso_vigente?'good':'warn'))))); else columns.append(errorPanel('Solicitações recentes',requests));
    if(versions.ok)columns.append(panel('Versões documentais',versions.items.slice(0,10).map(x=>item(`Versão ${x.versao??'—'}`,`Solicitação ${shortId(x.solicitacao_id)} • modelo ${shortId(x.modelo_versao_id)}`,`${x.publico?'público':'restrito'} • ${shortId(x.id)}`,badge(x.substituido?'substituída':x.aprovado?'aprovada':'sem aprovação',x.substituido?'warn':x.aprovado?'good':'warn'))))); else columns.append(errorPanel('Versões documentais',versions));
    if(signatures.ok)columns.append(panel('Assinaturas registradas',[...signatures.items].sort((a,b)=>String(b.declarada_em||b.criada_em||'').localeCompare(String(a.declarada_em||a.criada_em||''))).slice(0,10).map(x=>item(x.mecanismo||'Assinatura declarada',`Documento ${shortId(x.documento_versao_id)} • ${x.estado||'sem estado'}`,`${fmtDate(x.declarada_em||x.criada_em)} • ${x.referencia||shortId(x.id)}`,badge(x.estado||'registrada',x.estado==='verificada'?'good':'warn'))))); else columns.append(errorPanel('Assinaturas registradas',signatures));
    if(deliveries.ok)columns.append(panel('Entregas registradas',[...deliveries.items].sort((a,b)=>String(b.entregue_em||b.criada_em||'').localeCompare(String(a.entregue_em||a.criada_em||''))).slice(0,10).map(x=>item(x.canal||'Entrega',`Documento ${shortId(x.documento_versao_id)} • destinatário ${shortId(x.destinatario_id)}`,`${fmtDate(x.entregue_em||x.criada_em)} • ${x.referencia||shortId(x.id)}`,badge('entregue','good'))))); else columns.append(errorPanel('Entregas registradas',deliveries));
    journey.append(columns);
  }

  async function renderPreventive(version){
    const currentUnit=unit(); journey.replaceChildren(); journey.append(heading('Jornada preventiva','Preventivo','Adesões, ocorrências, aplicações e revisões organizadas pela situação registrada no backend.',()=>renderFor('preventivo')));
    if(!currentUnit){journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada preventiva.',true));return;}
    const q=encodeURIComponent(currentUnit);
    const [enrollments,occurrences,applications,reviews]=await Promise.all([
      safe(`/v1/protocolos/adesoes?limit=100&unidade_id=${q}`), safe(`/v1/protocolos/ocorrencias?limit=100&unidade_id=${q}`), safe(`/v1/protocolos/aplicacoes?limit=100&unidade_id=${q}`), safe(`/v1/protocolos/revisoes?limit=100&unidade_id=${q}`)
    ]);
    if(version!==requestVersion||activeModule!=='preventivo')return;
    const pendingOccurrences=occurrences.ok?occurrences.items.filter(x=>!['concluida','cancelada','encerrada'].includes(String(x.situacao||'').toLowerCase())):[];
    const materialReview=applications.ok?applications.items.filter(x=>x.material_revisao):[];
    const openReviews=reviews.ok?reviews.items.filter(x=>!['resolvida','encerrada'].includes(String(x.situacao||'').toLowerCase())):[];
    const metrics=document.createElement('div');metrics.className='journey-metrics';metrics.append(metric('Adesões',countText(enrollments)),metric('Ocorrências pendentes',occurrences.ok?`${pendingOccurrences.length}${occurrences.next?'+':''}`:'—'),metric('Aplicações com revisão',applications.ok?`${materialReview.length}${applications.next?'+':''}`:'—'),metric('Revisões abertas',reviews.ok?`${openReviews.length}${reviews.next?'+':''}`:'—'));journey.append(metrics);
    const columns=document.createElement('div');columns.className='journey-columns';
    if(enrollments.ok)columns.append(panel('Adesões',enrollments.items.slice(0,10).map(x=>item(x.referencia||`Adesão ${shortId(x.id)}`,`Paciente ${shortId(x.paciente_id)} • protocolo ${shortId(x.protocolo_versao_id)}`,`Início ${x.inicio_data||'—'} • ${shortId(x.id)}`,badge('ativa','good'))))); else columns.append(errorPanel('Adesões',enrollments));
    if(occurrences.ok)columns.append(panel('Ocorrências',occurrences.items.slice(0,12).map(x=>item(`Ocorrência ${shortId(x.id)}`,`Paciente ${shortId(x.paciente_id)} • etapa ${shortId(x.etapa_id)}`,`Prevista ${x.prevista_data||'—'} • sequência ${x.sequencia??'—'}`,badge(x.situacao||'sem situação',String(x.situacao||'').toLowerCase()==='concluida'?'good':'warn'))))); else columns.append(errorPanel('Ocorrências',occurrences));
    if(applications.ok)columns.append(panel('Aplicações recentes',[...applications.items].sort((a,b)=>String(b.ocorrida_em||b.criada_em||'').localeCompare(String(a.ocorrida_em||a.criada_em||''))).slice(0,10).map(x=>item(x.referencia||`Aplicação ${shortId(x.id)}`,`Paciente ${shortId(x.paciente_id)} • origem ${x.origem||'—'}`,`${fmtDate(x.ocorrida_em||x.criada_em)} • lote ${x.lote_declarado||'—'}`,badge(x.material_revisao?'revisar material':(x.ativa?'ativa':'inativa'),x.material_revisao?'warn':x.ativa?'good':'bad'))))); else columns.append(errorPanel('Aplicações recentes',applications));
    if(reviews.ok)columns.append(panel('Revisões preventivas',[...reviews.items].sort((a,b)=>String(b.observada_em||b.criada_em||'').localeCompare(String(a.observada_em||a.criada_em||''))).slice(0,10).map(x=>item(x.descricao||`Revisão ${shortId(x.id)}`,`Paciente ${shortId(x.paciente_id)} • ocorrência ${shortId(x.ocorrencia_id)}`,`${fmtDate(x.observada_em||x.criada_em)} • ${x.situacao_ocorrencia||'situação não informada'}`,badge(x.situacao||'aberta',String(x.situacao||'').toLowerCase()==='resolvida'?'good':'warn'))))); else columns.append(errorPanel('Revisões preventivas',reviews));
    journey.append(columns);
  }

  async function renderAdmin(version){
    journey.replaceChildren(); journey.append(heading('Governança','Administração','Usuários, papéis, credenciais e dispositivos em leitura administrativa. Alterações permanecem bloqueadas até validação da matriz de cargos.',()=>renderFor('administracao')));
    const [users,roles,assignments,credentials,devices,units]=await Promise.all([safe('/v1/usuarios?limit=100'),safe('/v1/papeis?limit=100'),safe('/v1/atribuicoes?limit=100'),safe('/v1/credenciais?limit=100'),safe('/v1/dispositivos?limit=100'),safe('/v1/unidades?limit=100')]);
    if(version!==requestVersion||activeModule!=='administracao')return;
    const activeUsers=users.ok?users.items.filter(x=>x.ativo):[];
    const activeDevices=devices.ok?devices.items.filter(x=>x.ativo):[];
    const validCredentials=credentials.ok?credentials.items.filter(x=>!x.revogada_em&&(!x.expira_em||new Date(x.expira_em)>new Date())):[];
    const metrics=document.createElement('div');metrics.className='journey-metrics';metrics.append(metric('Usuários ativos',users.ok?`${activeUsers.length}${users.next?'+':''}`:'—'),metric('Papéis',countText(roles)),metric('Credenciais vigentes',credentials.ok?`${validCredentials.length}${credentials.next?'+':''}`:'—'),metric('Dispositivos ativos',devices.ok?`${activeDevices.length}${devices.next?'+':''}`:'—'));journey.append(metrics);
    const columns=document.createElement('div');columns.className='journey-columns';
    if(users.ok)columns.append(panel('Usuários',users.items.slice(0,12).map(x=>item(x.nome||x.login||`Usuário ${shortId(x.id)}`,x.login||'Login não informado',shortId(x.id),badge(x.ativo?'ativo':'inativo',x.ativo?'good':'bad'))))); else columns.append(errorPanel('Usuários',users));
    if(roles.ok)columns.append(panel('Papéis',roles.items.slice(0,12).map(x=>item(x.nome||`Papel ${shortId(x.id)}`,`${(assignments.items||[]).filter(a=>a.papel_id===x.id).length} atribuição(ões) carregada(s)`,shortId(x.id),badge('configurado','good'))))); else columns.append(errorPanel('Papéis',roles));
    if(credentials.ok)columns.append(panel('Credenciais',credentials.items.slice(0,12).map(x=>{const revoked=Boolean(x.revogada_em);const expired=x.expira_em&&new Date(x.expira_em)<=new Date();return item(x.tipo||`Credencial ${shortId(x.id)}`,`Usuário ${shortId(x.usuario_id)}`,`Expira ${fmtDate(x.expira_em)} • ${shortId(x.id)}`,badge(revoked?'revogada':expired?'expirada':'vigente',revoked||expired?'bad':'good'));}))); else columns.append(errorPanel('Credenciais',credentials));
    if(devices.ok)columns.append(panel('Dispositivos',devices.items.slice(0,12).map(x=>item(x.nome||`Dispositivo ${shortId(x.id)}`,`Unidade ${shortId(x.unidade_id)}`,shortId(x.id),badge(x.ativo?'ativo':'inativo',x.ativo?'good':'bad'))))); else columns.append(errorPanel('Dispositivos',devices));
    if(units.ok)columns.append(panel('Unidades',units.items.slice(0,8).map(x=>item(x.nome||`Unidade ${shortId(x.id)}`,x.fuso||'Fuso não informado',shortId(x.id),badge('configurada','good'))))); else columns.append(errorPanel('Unidades',units));
    journey.append(columns);
  }

  async function renderFor(module){
    if(!['documentos','preventivo','administracao'].includes(module))return;
    activeModule=module;requestVersion+=1;const version=requestVersion;journey.hidden=false;journey.replaceChildren(empty('Carregando jornada…'));
    if(module==='documentos')await renderDocuments(version);
    if(module==='preventivo')await renderPreventive(version);
    if(module==='administracao')await renderAdmin(version);
  }

  document.querySelectorAll('[data-module]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>renderFor(button.dataset.module||''),0)));
  document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>renderFor(button.dataset.go||''),0)));
})();