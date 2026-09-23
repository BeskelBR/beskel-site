(() => {
  "use strict";

  const journey = document.querySelector('.journey-board');
  if (!journey) return;
  let activeModule = '';
  let requestVersion = 0;

  const apiBase = () => location.origin.replace(/\/$/, '');
  const token = () => sessionStorage.getItem('hvb-session-view') || '';
  const unit = () => localStorage.getItem('hvb-unit-id') || '';
  const shortId = (value) => value ? `${String(value).slice(0, 8)}…` : '—';
  const fmtDate = (value) => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d); };
  const countText = (result) => result.ok ? `${result.items.length}${result.next ? '+' : ''}` : '—';

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
  function metric(label,value){const n=document.createElement('article');n.className='journey-metric';const s=document.createElement('span');s.textContent=label;const b=document.createElement('strong');b.textContent=value;n.append(s,b);return n;}
  function badge(text,kind=''){const n=document.createElement('span');n.className=`journey-badge ${kind}`.trim();n.textContent=text;return n;}
  function item(title,line,meta,status){const n=document.createElement('div');n.className='journey-item';const a=document.createElement('strong');a.textContent=title;const b=document.createElement('span');b.textContent=line;const c=document.createElement('small');c.textContent=meta;n.append(a,b,c);if(status)n.append(status);return n;}
  function empty(text,isError=false){const n=document.createElement('div');n.className=isError?'journey-error':'journey-empty';n.textContent=text;return n;}
  function panel(title,nodes){const n=document.createElement('article');n.className='journey-panel';const h=document.createElement('h4');h.textContent=title;const l=document.createElement('div');l.className='journey-list';l.append(...(nodes?.length?nodes:[empty('Sem registros nesta visão.')]));n.append(h,l);return n;}
  function errorPanel(title,result){return panel(title,[empty(result.status===403?'Visão não liberada para o perfil atual.':'Consulta indisponível no momento.',result.status!==403)]);}
  function heading(eyebrow,title,description,refresh){const h=document.createElement('div');h.className='journey-head';const c=document.createElement('div');const e=document.createElement('span');e.className='eyebrow';e.textContent=eyebrow;const t=document.createElement('h3');t.textContent=title;const p=document.createElement('p');p.textContent=description;c.append(e,t,p);const b=document.createElement('button');b.type='button';b.className='secondary-btn';b.textContent='Atualizar jornada';b.addEventListener('click',refresh);h.append(c,b);return h;}

  async function renderPatients(version){
    journey.replaceChildren(); journey.append(heading('Jornada cadastral','Pacientes','Cadastro, responsáveis, vínculos e episódios apresentados como contexto longitudinal de consulta.',()=>renderFor('pacientes')));
    const currentUnit=unit();
    const [patients,responsibles,links,episodes]=await Promise.all([
      safe('/v1/pacientes?limit=100'), safe('/v1/responsaveis?limit=100'), safe('/v1/vinculos?limit=100'), currentUnit?safe(`/v1/episodios?limit=100&unidade_id=${encodeURIComponent(currentUnit)}`):Promise.resolve({ok:false,status:0,items:[],next:null})
    ]);
    if(version!==requestVersion||activeModule!=='pacientes')return;
    const activeLinks=links.ok?links.items.filter(x=>!x.fim):[];
    const activeEpisodes=episodes.ok?episodes.items.filter(x=>!x.encerrado_em):[];
    const metrics=document.createElement('div');metrics.className='journey-metrics';metrics.append(metric('Pacientes',countText(patients)),metric('Responsáveis',countText(responsibles)),metric('Vínculos ativos',links.ok?`${activeLinks.length}${links.next?'+':''}`:'—'),metric('Episódios não encerrados',episodes.ok?`${activeEpisodes.length}${episodes.next?'+':''}`:'—'));journey.append(metrics);
    const responsibleById=new Map((responsibles.items||[]).map(x=>[x.id,x]));
    const linksByPatient=new Map();(links.items||[]).forEach(x=>{const list=linksByPatient.get(x.paciente_id)||[];list.push(x);linksByPatient.set(x.paciente_id,list);});
    const episodesByPatient=new Map();(episodes.items||[]).forEach(x=>{const list=episodesByPatient.get(x.paciente_id)||[];list.push(x);episodesByPatient.set(x.paciente_id,list);});
    const columns=document.createElement('div');columns.className='journey-columns';
    if(patients.ok)columns.append(panel('Pacientes',patients.items.slice(0,12).map(x=>{const patientLinks=linksByPatient.get(x.id)||[];const patientEpisodes=episodesByPatient.get(x.id)||[];return item(x.nome||`Paciente ${shortId(x.id)}`,`${x.especie_codigo||'Espécie não informada'} • ${x.estado_vital||'estado não informado'}`,`${patientLinks.filter(l=>!l.fim).length} vínculo(s) ativo(s) • ${patientEpisodes.filter(e=>!e.encerrado_em).length} episódio(s) não encerrado(s)`,badge(x.estado_vital||'cadastrado',x.estado_vital==='vivo'?'good':''));})));else columns.append(errorPanel('Pacientes',patients));
    if(links.ok)columns.append(panel('Vínculos recentes',links.items.slice(0,12).map(x=>item(x.papel||'Vínculo',responsibleById.get(x.responsavel_id)?.nome||`Responsável ${shortId(x.responsavel_id)}`,`Paciente ${shortId(x.paciente_id)} • início ${fmtDate(x.inicio)}`,badge(x.fim?'encerrado':'ativo',x.fim?'warn':'good')))));else columns.append(errorPanel('Vínculos recentes',links));
    if(episodes.ok)columns.append(panel('Episódios',episodes.items.slice(0,12).map(x=>item(x.tipo||'Episódio assistencial',`Paciente ${shortId(x.paciente_id)}`,`Admitido ${fmtDate(x.admitido_em)} • versão ${x.versao??'—'}`,badge(x.encerrado_em?'encerrado':x.alta_clinica_em?'alta clínica':'ativo',x.encerrado_em?'good':x.alta_clinica_em?'warn':'good')))));else columns.append(errorPanel('Episódios',episodes));
    journey.append(columns);
  }

  async function renderRecord(version){
    const currentUnit=unit(); journey.replaceChildren(); journey.append(heading('Jornada clínica','Prontuário','Evoluções e versões organizadas para leitura longitudinal; redação e retificação dependem da matriz de cargos.',()=>renderFor('prontuario')));
    if(!currentUnit){journey.append(empty('Defina a unidade hospitalar DEV para carregar o prontuário.',true));return;}
    const q=encodeURIComponent(currentUnit);
    const [evolutions,versions,patients,episodes]=await Promise.all([safe(`/v1/prontuario/evolucoes?limit=100&unidade_id=${q}`),safe(`/v1/prontuario/versoes?limit=100&unidade_id=${q}`),safe('/v1/pacientes?limit=100'),safe(`/v1/episodios?limit=100&unidade_id=${q}`)]);
    if(version!==requestVersion||activeModule!=='prontuario')return;
    const patientById=new Map((patients.items||[]).map(x=>[x.id,x]));
    const episodeById=new Map((episodes.items||[]).map(x=>[x.id,x]));
    const metrics=document.createElement('div');metrics.className='journey-metrics';metrics.append(metric('Evoluções',countText(evolutions)),metric('Versões',countText(versions)),metric('Pacientes carregados',countText(patients)),metric('Episódios carregados',countText(episodes)));journey.append(metrics);
    const columns=document.createElement('div');columns.className='journey-columns';
    if(evolutions.ok)columns.append(panel('Evoluções recentes',[...evolutions.items].sort((a,b)=>String(b.criada_em||b.ocorrida_em||'').localeCompare(String(a.criada_em||a.ocorrida_em||''))).slice(0,12).map(x=>{const ep=episodeById.get(x.episodio_id);const patient=patientById.get(x.paciente_id||ep?.paciente_id);return item(x.tipo||'Evolução clínica',patient?.nome||`Paciente ${shortId(x.paciente_id||ep?.paciente_id)}`,`${fmtDate(x.ocorrida_em||x.criada_em)} • episódio ${shortId(x.episodio_id)}`,badge('registrada','good'));})));else columns.append(errorPanel('Evoluções recentes',evolutions));
    if(versions.ok)columns.append(panel('Histórico de versões',versions.items.slice(0,12).map(x=>item(`Versão ${x.versao??'—'}`,`Evolução ${shortId(x.evolucao_id)}`,`${fmtDate(x.criada_em)} • ${shortId(x.id)}`,badge(x.atual===false?'histórica':'registrada',x.atual===false?'warn':'good')))));else columns.append(errorPanel('Histórico de versões',versions));
    journey.append(columns);
  }

  async function renderFor(module){
    if(!['pacientes','prontuario'].includes(module))return;
    activeModule=module;requestVersion+=1;const version=requestVersion;journey.hidden=false;journey.replaceChildren(empty('Carregando jornada…'));
    if(module==='pacientes')await renderPatients(version);
    if(module==='prontuario')await renderRecord(version);
  }

  document.querySelectorAll('[data-module]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>renderFor(button.dataset.module||''),0)));
  document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>renderFor(button.dataset.go||''),0)));
})();