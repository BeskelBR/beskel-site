(() => {
  "use strict";

  const journey = document.querySelector('.journey-board');
  if (!journey) return;
  let activeModule = '';
  let requestVersion = 0;

  function apiBase() { return (localStorage.getItem('hvb-api-base') || location.origin).replace(/\/$/, ''); }
  function token() { return sessionStorage.getItem('hvb-access-token') || ''; }
  function unit() { return localStorage.getItem('hvb-unit-id') || ''; }
  function shortId(value) { return value ? `${String(value).slice(0, 8)}…` : '—'; }
  function fmtDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }
  function countText(result) { return result.ok ? `${result.items.length}${result.next ? '+' : ''}` : '—'; }
  function nonZero(value) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) && Math.abs(parsed) > 0;
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
    const node = document.createElement('article'); node.className = 'journey-metric';
    const span = document.createElement('span'); span.textContent = label;
    const strong = document.createElement('strong'); strong.textContent = value;
    node.append(span, strong); return node;
  }
  function badge(text, kind = '') {
    const node = document.createElement('span'); node.className = `journey-badge ${kind}`.trim(); node.textContent = text; return node;
  }
  function item(title, line, meta, status) {
    const node = document.createElement('div'); node.className = 'journey-item';
    const strong = document.createElement('strong'); strong.textContent = title;
    const span = document.createElement('span'); span.textContent = line;
    const small = document.createElement('small'); small.textContent = meta;
    node.append(strong, span, small); if (status) node.append(status); return node;
  }
  function empty(text, isError = false) { const node = document.createElement('div'); node.className = isError ? 'journey-error' : 'journey-empty'; node.textContent = text; return node; }
  function panel(title, nodes) {
    const node = document.createElement('article'); node.className = 'journey-panel';
    const h4 = document.createElement('h4'); h4.textContent = title;
    const list = document.createElement('div'); list.className = 'journey-list';
    list.append(...(nodes?.length ? nodes : [empty('Sem registros nesta visão.')])); node.append(h4, list); return node;
  }
  function errorPanel(title, result) { return panel(title, [empty(result.status === 403 ? 'Visão não liberada para o perfil atual.' : 'Consulta indisponível no momento.', result.status !== 403)]); }
  function heading(eyebrow, title, description, refresh) {
    const head = document.createElement('div'); head.className = 'journey-head';
    const copy = document.createElement('div');
    const eye = document.createElement('span'); eye.className = 'eyebrow'; eye.textContent = eyebrow;
    const h3 = document.createElement('h3'); h3.textContent = title;
    const p = document.createElement('p'); p.textContent = description;
    copy.append(eye, h3, p);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary-btn'; button.textContent = 'Atualizar jornada'; button.addEventListener('click', refresh);
    head.append(copy, button); return head;
  }

  async function renderFinance(version) {
    const currentUnit = unit();
    journey.replaceChildren();
    journey.append(heading('Jornada administrativa', 'Financeiro', 'Títulos, recebimentos, caixa e conciliação apresentados como leitura operacional, sem executar baixas ou reversões.', () => renderFor('financeiro')));
    if (!currentUnit) { journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada financeira.', true)); return; }
    const q = encodeURIComponent(currentUnit);
    const [titles, receipts, sessions, credits, deposits, statement] = await Promise.all([
      safe(`/v1/financeiro/titulos?limit=100&unidade_id=${q}`),
      safe(`/v1/financeiro/recebimentos?limit=100&unidade_id=${q}`),
      safe(`/v1/financeiro/sessoes?limit=100&unidade_id=${q}`),
      safe(`/v1/financeiro/creditos?limit=100&unidade_id=${q}`),
      safe(`/v1/financeiro/depositos?limit=100&unidade_id=${q}`),
      safe(`/v1/financeiro/extrato?limit=100&unidade_id=${q}`),
    ]);
    if (version !== requestVersion || activeModule !== 'financeiro') return;
    const openTitles = titles.ok ? titles.items.filter((x) => !x.revertido && nonZero(x.saldo)) : [];
    const openSessions = sessions.ok ? sessions.items.filter((x) => !x.fechada) : [];
    const unreconciledDeposits = deposits.ok ? deposits.items.filter((x) => nonZero(x.nao_conciliado) || nonZero(x.nao_alocado)) : [];
    const unreconciledStatement = statement.ok ? statement.items.filter((x) => x.nao_conciliado) : [];
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    metrics.append(metric('Títulos com saldo', titles.ok ? `${openTitles.length}${titles.next ? '+' : ''}` : '—'), metric('Recebimentos', countText(receipts)), metric('Caixas abertos', sessions.ok ? `${openSessions.length}${sessions.next ? '+' : ''}` : '—'), metric('Itens não conciliados', deposits.ok && statement.ok ? `${unreconciledDeposits.length + unreconciledStatement.length}${deposits.next || statement.next ? '+' : ''}` : '—'));
    journey.append(metrics);
    const columns = document.createElement('div'); columns.className = 'journey-columns';
    if (titles.ok) columns.append(panel('Títulos com saldo', openTitles.slice(0,10).map((x) => item(`Título ${shortId(x.id)}`, `Valor ${x.valor ?? '—'} • saldo ${x.saldo ?? '—'}`, `Vencimento ${x.vencimento || '—'} • pagador ${shortId(x.pagador_id)}`, badge('em aberto','warn'))))); else columns.append(errorPanel('Títulos com saldo', titles));
    if (receipts.ok) columns.append(panel('Recebimentos recentes', [...receipts.items].sort((a,b) => String(b.recebido_em || '').localeCompare(String(a.recebido_em || ''))).slice(0,10).map((x) => item(`${x.meio || 'Recebimento'} • ${x.valor ?? '—'}`, x.referencia || `Pagador ${shortId(x.pagador_id)}`, `${fmtDate(x.recebido_em)} • ${x.revertido ? 'revertido' : 'ativo'}`, badge(x.revertido ? 'revertido' : 'registrado', x.revertido ? 'bad' : 'good'))))); else columns.append(errorPanel('Recebimentos recentes', receipts));
    if (sessions.ok) columns.append(panel('Sessões de caixa', sessions.items.slice(0,10).map((x) => item(`Caixa ${shortId(x.caixa_id)}`, `Abertura ${x.abertura ?? '—'} • esperado ${x.esperado ?? '—'}`, `${fmtDate(x.aberta_em)} • ${shortId(x.id)}`, badge(x.fechada ? 'fechado' : 'aberto', x.fechada ? 'good' : 'warn'))))); else columns.append(errorPanel('Sessões de caixa', sessions));
    if (credits.ok) columns.append(panel('Créditos disponíveis', credits.items.filter((x) => !x.revertido && nonZero(x.disponivel)).slice(0,10).map((x) => item(`Crédito ${x.valor ?? '—'}`, `Disponível ${x.disponivel ?? '—'}`, `Pagador ${shortId(x.pagador_id)} • ${shortId(x.id)}`, badge('disponível','good'))))); else columns.append(errorPanel('Créditos disponíveis', credits));
    if (deposits.ok && statement.ok) columns.append(panel('Conciliação', [
      ...unreconciledDeposits.slice(0,5).map((x) => item(`Depósito ${x.valor ?? '—'}`, x.referencia || `Conta ${shortId(x.conta_financeira_id)}`, `${fmtDate(x.depositado_em)} • não alocado ${x.nao_alocado ?? '—'} • não conciliado ${x.nao_conciliado ?? '—'}`, badge('revisar','warn'))),
      ...unreconciledStatement.slice(0,5).map((x) => item(`Extrato ${x.valor ?? '—'}`, x.referencia || `Conta ${shortId(x.conta_financeira_id)}`, `${fmtDate(x.ocorrido_em)} • ${shortId(x.id)}`, badge('não conciliado','warn'))),
    ])); else columns.append(errorPanel('Conciliação', deposits.ok ? statement : deposits));
    journey.append(columns);
  }

  async function renderPurchases(version) {
    const currentUnit = unit();
    journey.replaceChildren();
    journey.append(heading('Jornada administrativa', 'Compras', 'Pedidos, decisões e recebimentos apresentados em sequência, sem executar aprovações ou entradas de estoque pela interface.', () => renderFor('compras')));
    if (!currentUnit) { journey.append(empty('Defina a unidade hospitalar DEV para carregar a jornada de compras.', true)); return; }
    const q = encodeURIComponent(currentUnit);
    const [orders, orderItems, decisions, receipts, receiptItems, suppliers] = await Promise.all([
      safe(`/v1/compras/pedidos?limit=100&unidade_id=${q}`),
      safe(`/v1/compras/itens?limit=100&unidade_id=${q}`),
      safe(`/v1/compras/decisoes?limit=100&unidade_id=${q}`),
      safe(`/v1/compras/recebimentos?limit=100&unidade_id=${q}`),
      safe(`/v1/compras/recebimentos-itens?limit=100&unidade_id=${q}`),
      safe(`/v1/compras/fornecedores?limit=100&unidade_id=${q}`),
    ]);
    if (version !== requestVersion || activeModule !== 'compras') return;
    const supplierById = new Map((suppliers.items || []).map((x) => [x.id, x]));
    const itemsByOrder = new Map();
    (orderItems.items || []).forEach((x) => { const list = itemsByOrder.get(x.pedido_id) || []; list.push(x); itemsByOrder.set(x.pedido_id, list); });
    const pendingOrders = orders.ok ? orders.items.filter((x) => !['recebido','cancelado','encerrado'].includes(String(x.situacao || '').toLowerCase())) : [];
    const partialOrders = orders.ok && orderItems.ok ? orders.items.filter((order) => (itemsByOrder.get(order.id) || []).some((x) => Number(x.recebido_apresentacoes || 0) < Number(x.quantidade_apresentacoes || 0))) : [];
    const metrics = document.createElement('div'); metrics.className = 'journey-metrics';
    metrics.append(metric('Pedidos', countText(orders)), metric('Pedidos em andamento', orders.ok ? `${pendingOrders.length}${orders.next ? '+' : ''}` : '—'), metric('Com recebimento incompleto', orders.ok && orderItems.ok ? `${partialOrders.length}${orders.next || orderItems.next ? '+' : ''}` : '—'), metric('Recebimentos', countText(receipts)));
    journey.append(metrics);
    const columns = document.createElement('div'); columns.className = 'journey-columns';
    if (orders.ok) columns.append(panel('Pedidos', orders.items.slice(0,10).map((x) => item(x.referencia || `Pedido ${shortId(x.id)}`, supplierById.get(x.fornecedor_id)?.nome || `Fornecedor ${shortId(x.fornecedor_id)}`, `${x.situacao || 'sem situação'} • ${fmtDate(x.criada_em)}`, badge(x.situacao || 'sem estado', String(x.situacao || '').toLowerCase() === 'aprovado' ? 'good' : 'warn'))))); else columns.append(errorPanel('Pedidos', orders));
    if (orderItems.ok) columns.append(panel('Itens dos pedidos', orderItems.items.slice(0,12).map((x) => item(`Item ${shortId(x.id)}`, `Solicitado ${x.quantidade_apresentacoes ?? '—'} • recebido ${x.recebido_apresentacoes ?? '—'}`, `Pedido ${shortId(x.pedido_id)} • apresentação ${shortId(x.apresentacao_id)}`, badge(Number(x.recebido_apresentacoes || 0) >= Number(x.quantidade_apresentacoes || 0) ? 'recebido' : 'pendente', Number(x.recebido_apresentacoes || 0) >= Number(x.quantidade_apresentacoes || 0) ? 'good' : 'warn'))))); else columns.append(errorPanel('Itens dos pedidos', orderItems));
    if (decisions.ok) columns.append(panel('Decisões registradas', [...decisions.items].sort((a,b) => Number(b.sequencia || 0) - Number(a.sequencia || 0)).slice(0,10).map((x) => item(`Pedido ${shortId(x.pedido_id)}`, x.estado || 'Decisão sem estado', `Sequência ${x.sequencia ?? '—'} • ${fmtDate(x.criada_em)}`, badge(x.estado || 'registrada', x.estado === 'aprovado' ? 'good' : x.estado === 'rejeitado' ? 'bad' : 'warn'))))); else columns.append(errorPanel('Decisões registradas', decisions));
    if (receipts.ok) columns.append(panel('Recebimentos recentes', [...receipts.items].sort((a,b) => String(b.ocorrido_em || '').localeCompare(String(a.ocorrido_em || ''))).slice(0,10).map((x) => item(x.referencia || `Recebimento ${shortId(x.id)}`, x.documento_fornecedor || `Pedido ${shortId(x.pedido_id)}`, `${fmtDate(x.ocorrido_em)} • ${shortId(x.id)}`, badge('registrado','good'))))); else columns.append(errorPanel('Recebimentos recentes', receipts));
    if (receiptItems.ok) columns.append(panel('Entrada vinculada ao estoque', receiptItems.items.slice(0,10).map((x) => item(`Recebimento ${shortId(x.recebimento_id)}`, `Quantidade ${x.quantidade_apresentacoes ?? '—'} apresentações • base ${x.quantidade_base ?? '—'}`, `Posição ${shortId(x.posicao_id)} • custo base ${x.custo_base_snapshot ?? '—'}`, badge(x.revertido ? 'revertido' : 'integrado ao estoque', x.revertido ? 'bad' : 'good'))))); else columns.append(errorPanel('Entrada vinculada ao estoque', receiptItems));
    journey.append(columns);
  }

  async function renderFor(module) {
    if (!['financeiro','compras'].includes(module)) return;
    activeModule = module;
    requestVersion += 1;
    const version = requestVersion;
    journey.hidden = false;
    journey.replaceChildren(empty('Carregando jornada administrativa…'));
    if (module === 'financeiro') await renderFinance(version);
    if (module === 'compras') await renderPurchases(version);
  }

  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => setTimeout(() => renderFor(button.dataset.module || ''), 0)));
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => setTimeout(() => renderFor(button.dataset.go || ''), 0)));
})();