(() => {
  "use strict";

  const detailView = document.querySelector('[data-module-view="detail"]');
  const detailHead = detailView?.querySelector('.detail-head');
  if (!detailView || !detailHead) return;

  const journey = document.createElement('section');
  journey.className = 'journey-board';
  journey.hidden = true;
  journey.setAttribute('aria-live', 'polite');
  detailHead.insertAdjacentElement('afterend', journey);

  let activeModule = '';
  let requestVersion = 0;

  function apiBase() {
    return (localStorage.getItem('hvb-api-base') || location.origin).replace(/\/$/, '');
  }
  function token() { return sessionStorage.getItem('hvb-access-token') || ''; }
  function unit() { return localStorage.getItem('hvb-unit-id') || ''; }
  function shortId(value) { return value ? `${String(value).slice(0, 8)}…` : '—'; }
  function fmtDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  function countText(result) { return result.ok ? `${result.items.length}${result.next ? '+' : ''}` : '—'; }
  function positive(value) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0;
  }

  async function request(path) {
    const current = token();
    if (!current) throw Object.assign(new Error('sessao_ausente'), { status: 401 });
    const response = await fetch(`${apiBase()}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${current}` } });
    const type = response.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw Object.assign(new Error(body?.erro || `HTTP ${response.status}`), { status: response.status });
    return body;
  }
  async function safe(path) {
    try {
      const data = await request(path);
      return { ok: true, items: data?.items || [], next: data?.next_cursor || null };
    } catch (error) {
      return { ok: false, status: error.status || 0, items: [], next: null };
    }
  }

  function metric(label, value) {
    const node = document.createElement('article');
    node.className = 'journey-metric';
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    node.append(span, strong);
    return node;
  }
  function badge(text, kind = '') {
    const node = document.createElement('span');
    node.className = `journey-badge ${kind}`.trim();
    node.textContent = text;
    return node;
  }
  function item(title, line, meta, status) {
    const node = document.createElement('div'); node.className = 'journey-item';
    const strong = document.createElement('strong'); strong.textContent = title;
    const span = document.createElement('span'); span.textContent = line;
    const small = document.createElement('small'); small.textContent = meta;
    node.append(strong, span, small);
    if (status) node.append(status);
    return node;
  }
  function empty(text, error = false) {
    const node = document.createElement('div');
    node.className = error ? 'journey-error' : 'journey-empty';
    node.textContent = text;
    return node;
  }
  function panel(title, content) {
    const node = document.createElement('article'); node.className = 'journey-panel';
    const h4 = document.createElement('h4'); h4.textContent = title;
    const list = document.createElement('div'); list.className = 'journey-list';
    if (Array.isArray(content) && content.length) list.append(...content);
    else list.append(empty(typeof content === 'string' ? content : 'Sem registros nesta visão.'));
    node.append(h4, list);
    return node;
  }
  function errorPanel(title, result) {
    const text = result.status === 403 ? 'Visão não liberada para o perfil atual.' : 'Consulta indisponível no momento.';
    const node = document.createElement('article'); node.className = 'journey-panel';
    const h4 = document.createElement('h4'); h4.textContent = title;
    node.append(h4, empty(text, result.status !== 403));
    return node;
  }
  function heading(eyebrow, title, description, onRefresh) {
    const head = document.createElement('div'); head.className = 'journey-head';
    const copy = document.createElement('div');
    const eye = document.createElement('span'); eye.className = 'eyebrow'; eye.textContent = eyebrow;
    const h3 = document.createElement('h3'); h3.textContent = title;
    const p = document.createElement('p'); p.textContent = description;
    copy.append(eye, h3, p);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-btn'; button.textContent = 'Atualizar jornada';
    button.addEventListener('click', onRefresh);
    head.append(copy, button);
    return head;
  }

  async function renderExams(version) {
    const currentUnit = unit();
    journey.replaceChildren();
    journey.append(heading('Jornada operacional', 'Exames', 'Solicitações, coletas e resultados em uma leitura operacional sem interpretação clínica automática.', () => renderFor('exames')));
    if (!currentUnit) { journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada de exames.', true)); return; }
    const q = encodeURIComponent(currentUnit);
    const [requests, collections, results, releases] = await Promise.all([
      safe(`/v1/exames/solicitacoes?limit=100&unidade_id=${q}`),
      safe(`/v1/exames/coletas?limit=100&unidade_id=${q}`),
      safe(`/v1/exames/resultados?limit=100&unidade_id=${q}`),
      safe(`/v1/exames/liberacoes?limit=100&unidade_id=${q}`),
    ]);
    if (version !== requestVersion || activeModule !== 'exames') return;
    const pendingResults = results.ok ? results.items.filter((x) => !x.liberado) : [];
    const reviewResults = results.ok ? results.items.filter((x) => x.necessita_revisao || x.tem_pendencias || x.faltam_obrigatorios) : [];
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    metrics.append(metric('Solicitações', countText(requests)), metric('Coletas', countText(collections)), metric('Resultados não liberados', results.ok ? String(pendingResults.length) + (results.next ? '+' : '') : '—'), metric('Resultados com revisão', results.ok ? String(reviewResults.length) + (results.next ? '+' : '') : '—'));
    journey.append(metrics);
    const columns = document.createElement('div'); columns.className = 'journey-columns';
    if (requests.ok) columns.append(panel('Solicitações recentes', [...requests.items].sort((a,b) => String(b.solicitada_em || b.criada_em || '').localeCompare(String(a.solicitada_em || a.criada_em || ''))).slice(0,8).map((x) => item(x.referencia || 'Solicitação de exame', x.indicacao || `Episódio ${shortId(x.episodio_id)}`, `${fmtDate(x.solicitada_em || x.criada_em)} • ${shortId(x.id)}`)))); else columns.append(errorPanel('Solicitações recentes', requests));
    if (collections.ok) columns.append(panel('Coletas e amostras', [...collections.items].sort((a,b) => String(b.coletada_em || b.criada_em || '').localeCompare(String(a.coletada_em || a.criada_em || ''))).slice(0,8).map((x) => item(x.referencia || x.material || 'Coleta', `${x.material || 'Material não informado'} • ${x.origem || 'Origem não informada'}`, `${fmtDate(x.coletada_em || x.criada_em)} • ${shortId(x.id)}`, badge(x.situacao_amostra || 'sem decisão', x.situacao_amostra === 'aceita' ? 'good' : x.situacao_amostra ? 'warn' : ''))))); else columns.append(errorPanel('Coletas e amostras', collections));
    if (results.ok) columns.append(panel('Resultados aguardando liberação', pendingResults.slice(0,8).map((x) => item(x.referencia || `Resultado ${shortId(x.id)}`, `Produzido ${fmtDate(x.produzido_em)}`, `${x.tem_pendencias ? 'Com pendências' : 'Sem pendências declaradas'} • ${shortId(x.id)}`, badge(x.necessita_revisao || x.tem_pendencias || x.faltam_obrigatorios ? 'revisar' : 'aguardando liberação', x.necessita_revisao || x.tem_pendencias || x.faltam_obrigatorios ? 'warn' : ''))))); else columns.append(errorPanel('Resultados aguardando liberação', results));
    if (releases.ok) columns.append(panel('Liberações recentes', [...releases.items].sort((a,b) => String(b.criada_em || '').localeCompare(String(a.criada_em || ''))).slice(0,8).map((x) => item(`Liberação ${shortId(x.id)}`, `Resultado ${shortId(x.resultado_id)}`, `${fmtDate(x.criada_em)} • ${x.pendencias_confirmadas ? 'pendências confirmadas' : 'sem confirmação de pendências'}`, badge('liberado','good'))))); else columns.append(errorPanel('Liberações recentes', releases));
    journey.append(columns);
  }

  async function renderStock(version) {
    const currentUnit = unit();
    journey.replaceChildren();
    journey.append(heading('Jornada operacional', 'Estoque', 'Posições, reservas e inventários em leitura administrativa; movimentações físicas permanecem separadas no Terminal HVB.', () => renderFor('estoque')));
    if (!currentUnit) { journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada de estoque.', true)); return; }
    const q = encodeURIComponent(currentUnit);
    const [positions, reservations, inventories, products, lots, locations] = await Promise.all([
      safe(`/v1/estoque/posicoes?limit=100&unidade_id=${q}`),
      safe(`/v1/estoque/reservas?limit=100&unidade_id=${q}`),
      safe(`/v1/estoque/inventarios?limit=100&unidade_id=${q}`),
      safe('/v1/estoque/produtos?limit=100'),
      safe('/v1/estoque/lotes?limit=100'),
      safe(`/v1/locais?limit=100&unidade_id=${q}`),
    ]);
    if (version !== requestVersion || activeModule !== 'estoque') return;
    const productById = new Map((products.items || []).map((x) => [x.id, x]));
    const lotById = new Map((lots.items || []).map((x) => [x.id, x]));
    const locationById = new Map((locations.items || []).map((x) => [x.id, x]));
    const activeReservations = reservations.ok ? reservations.items.filter((x) => x.situacao === 'ativa') : [];
    const openInventories = inventories.ok ? inventories.items.filter((x) => x.situacao === 'aberta') : [];
    const availablePositions = positions.ok ? positions.items.filter((x) => positive(x.disponivel_base)) : [];
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    metrics.append(metric('Posições registradas', countText(positions)), metric('Com saldo disponível', positions.ok ? String(availablePositions.length) + (positions.next ? '+' : '') : '—'), metric('Reservas ativas', reservations.ok ? String(activeReservations.length) + (reservations.next ? '+' : '') : '—'), metric('Inventários abertos', inventories.ok ? String(openInventories.length) + (inventories.next ? '+' : '') : '—'));
    journey.append(metrics);
    const columns = document.createElement('div'); columns.className = 'journey-columns';
    if (positions.ok) columns.append(panel('Posições de estoque', positions.items.slice(0,10).map((x) => {
      const lot = lotById.get(x.lote_id); const product = productById.get(lot?.produto_id); const location = locationById.get(x.local_id);
      return item(product?.nome || `Lote ${shortId(x.lote_id)}`, `Disponível ${x.disponivel_base ?? '—'} • reservado ${x.reservado_base ?? '—'}`, `${location?.nome || `Local ${shortId(x.local_id)}`} • posição ${shortId(x.id)}`, badge(positive(x.disponivel_base) ? 'disponível' : 'sem saldo disponível', positive(x.disponivel_base) ? 'good' : 'warn'));
    }))); else columns.append(errorPanel('Posições de estoque', positions));
    if (reservations.ok) columns.append(panel('Reservas ativas', activeReservations.slice(0,10).map((x) => item(`Reserva ${shortId(x.id)}`, `Quantidade ${x.quantidade_base ?? '—'}`, `Posição ${shortId(x.posicao_id)} • expira ${fmtDate(x.expira_em)}`, badge('ativa','warn'))))); else columns.append(errorPanel('Reservas ativas', reservations));
    if (inventories.ok) columns.append(panel('Inventários', inventories.items.slice(0,10).map((x) => item(`Inventário ${shortId(x.id)}`, locationById.get(x.local_id)?.nome || `Local ${shortId(x.local_id)}`, `${fmtDate(x.criada_em)} • ${x.motivo || 'Sem motivo informado'}`, badge(x.situacao || 'sem estado', x.situacao === 'aberta' ? 'warn' : 'good'))))); else columns.append(errorPanel('Inventários', inventories));
    if (lots.ok) columns.append(panel('Lotes do catálogo', lots.items.slice(0,10).map((x) => item(productById.get(x.produto_id)?.nome || `Produto ${shortId(x.produto_id)}`, `${x.fabricante || 'Fabricante não informado'} • lote ${x.codigo || shortId(x.id)}`, `Validade ${x.validade || '—'} • custo base ${x.custo_base ?? '—'}`, badge(x.situacao_validade || 'validade não classificada', x.situacao_validade === 'valido' ? 'good' : x.situacao_validade ? 'warn' : ''))))); else columns.append(errorPanel('Lotes do catálogo', lots));
    journey.append(columns);
  }

  async function renderFor(module) {
    activeModule = module;
    requestVersion += 1;
    const version = requestVersion;
    if (!['exames','estoque'].includes(module)) { journey.hidden = true; journey.replaceChildren(); return; }
    journey.hidden = false;
    journey.replaceChildren(empty('Carregando jornada operacional…'));
    if (module === 'exames') await renderExams(version);
    if (module === 'estoque') await renderStock(version);
  }

  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => setTimeout(() => renderFor(button.dataset.module || ''), 0)));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setTimeout(() => renderFor(button.dataset.go || ''), 0)));
})();