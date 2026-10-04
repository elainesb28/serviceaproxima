/* ==========================================================================
   views-prestador.js — telas do ambiente do prestador
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, UI, Svc, CFG, DB } = g;
  const esc = U.esc, icon = U.icon;
  const Views = (g.Views = g.Views || {});
  const Common = (g.Common = g.Common || {});

  const jobCard = (r, client, to) => {
    const cat = CFG.cat(r.category);
    const when = r.schedule ? `${U.fmtDate(r.schedule.date)} às ${r.schedule.time}` : '';
    return `<a class="svc-card" href="#${to}"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 22)}</span>
      <span class="svc-main"><b>${esc(r.title)}</b><small>${esc(client ? U.firstName(client.name) : 'Cliente')}${when ? ' · ' + when : ''}</small></span>
      <span class="svc-side">${UI.badge(r.status)}${r.price ? `<b>${U.money(r.price)}</b>` : ''}</span></a>`;
  };

  const orderCard = (o, withActions) => {
    const r = o.req;
    const cat = CFG.cat(r.category);
    return `<article class="order">
      <a class="order-head" href="#/p/pedido/${r.id}"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 22)}</span>
        <span class="grow"><b>${esc(r.title)}</b><small>${esc(o.client ? U.firstName(o.client.name) : 'Cliente')} · ${esc(r.location.bairro)} · ${U.fmtRel(r.createdAt)}</small></span>
        <span class="order-price">${r.budget ? `<b>${U.money(r.budget)}</b>` : '<b class="muted">A combinar</b>'}${o.km != null ? `<small>${U.fmtKm(o.km)}</small>` : ''}</span></a>
      ${r.targetProviderId ? `<div class="chips"><span class="chip static tone-indigo">Pedido direto para você</span></div>` : ''}
      ${withActions ? `<div class="row gap"><button class="btn tint grow" data-action="order-decline" data-id="${r.id}">Recusar</button><button class="btn go grow" data-action="order-accept" data-id="${r.id}">Aceitar ${icon('chevron', 16)}</button></div>` : ''}
    </article>`;
  };

  /* ======================================================================
     Janela "Enviar proposta" (usada também no chat)
     ====================================================================== */
  Common.proposalSheet = async (reqId, user, onDone) => {
    const r = await Svc.Requests.get(reqId);
    if (!r || r.status !== 'aberta') return UI.toast('Este pedido não está mais aberto.', 'error');
    const first = (await Svc.Providers.nextFreeSlot(user.id, r.preferred && r.preferred.date === U.todayISO() ? 0 : 1)) || { date: U.addDays(U.todayISO(), 1), time: '09:00' };
    const startDate = r.preferred && r.preferred.date && r.preferred.date >= U.todayISO() ? r.preferred.date : first.date;
    UI.sheet({
      title: 'Enviar proposta',
      html: `<form novalidate>
        <p class="muted small">${esc(r.title)}${r.budget ? ' · cliente estimou ' + U.money(r.budget) : ''}</p>
        ${UI.field({ label: 'Valor do serviço (R$)', name: 'value', value: r.budget ? String(r.budget).replace('.', ',') : '', placeholder: '0,00', mask: 'money', inputmode: 'decimal', required: true })}
        <div class="grid-2">${UI.field({ label: 'Data', name: 'date', type: 'date', value: startDate, min: U.todayISO(), required: true })}
          <div class="field"><label for="f_time">Horário</label><div class="input-wrap"><select id="f_time" name="time"></select></div></div></div>
        <small class="hint" id="slotHint"></small>
        ${UI.select({ label: 'Duração prevista', name: 'durationH', value: 2, options: [1, 2, 3, 4, 5, 6, 8].map((n) => ({ value: n, label: `${n} ${U.plural(n, 'hora', 'horas')}` })) })}
        ${UI.field({ label: 'Condições e observações', name: 'conditions', type: 'textarea', placeholder: 'Ex.: material incluso, garantia de 90 dias...', maxlength: 400 })}
        <label class="check"><input type="checkbox" name="material" /><span>Material incluso no valor</span></label>
        <div class="form-error" role="alert" hidden></div>
        <button class="btn go lg block" type="submit">Enviar proposta</button></form>`,
      onMount(api) {
        const form = api.el.querySelector('form');
        const sel = form.elements.time, hint = api.el.querySelector('#slotHint');
        const loadSlots = async () => {
          const date = form.elements.date.value;
          if (!date) return;
          const slots = await Svc.Providers.slots(user.id, date);
          const okSlots = slots.filter((s) => s.ok);
          sel.innerHTML = okSlots.length ? okSlots.map((s) => `<option>${s.time}</option>`).join('') : '<option value="">Sem horários</option>';
          if (r.preferred && r.preferred.date === date && okSlots.some((s) => s.time === r.preferred.time)) sel.value = r.preferred.time;
          hint.textContent = okSlots.length ? (r.preferred && r.preferred.date === date && r.preferred.time ? `O cliente preferiu ${r.preferred.time}.` : '') : 'Você não atende ou não tem horário livre neste dia. Ajuste a disponibilidade no perfil.';
        };
        form.elements.date.addEventListener('change', loadSlots);
        loadSlots();
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const err = form.querySelector('.form-error'); err.hidden = true;
          const btn = form.querySelector('[type=submit]');
          const d = UI.formData(form);
          UI.busy(btn, true, 'Enviando...');
          try {
            const value = U.parseMoney(d.value);
            if (!(value > 0)) throw new Error('Informe um valor válido, ex.: 150,00.');
            await Svc.Proposals.send({ requestId: reqId, providerId: user.id, value, date: d.date, time: d.time, durationH: Number(d.durationH), conditions: d.conditions, materialIncluded: !!form.elements.material.checked });
            api.close();
            UI.toast('Proposta enviada ao cliente.', 'success');
            if (onDone) onDone();
          } catch (ex) { err.textContent = ex.message; err.hidden = false; UI.busy(btn, false); }
        });
      }
    });
  };

  /* ======================================================================
     Painel
     ====================================================================== */
  Views['p.painel'] = {
    nav: 'painel', live: true,
    async render(ctx) {
      const u = ctx.user, p = u.pro;
      const [fin, openAll, mine, users, stats] = await Promise.all([Svc.Finance.summary(u.id), Svc.Requests.openFor(u), Svc.Requests.forProvider(u.id), Common.usersById(), Svc.Providers.stats(u)]);
      const open = p.online ? openAll : openAll.filter((o) => o.req.targetProviderId);
      const upcoming = mine.filter((r) => ['agendado', 'em_andamento', 'aguardando_pagamento'].includes(r.status)).sort((a, b) => (a.schedule.date + a.schedule.time).localeCompare(b.schedule.date + b.schedule.time)).slice(0, 3);
      return `<section class="screen pro"><div class="scroll">
        <div class="home-top">
          <a class="row gap center-y" href="#/p/perfil">${UI.avatar(u, 52)}<span><h1 class="sm">${esc(u.name)}</h1>${UI.rating(stats.rating, stats.count)}</span></a>
          <div class="row gap center-y">${UI.bellButton(ctx.badges.bell, 'p')}<label class="switch" title="${p.online ? 'Você está online' : 'Você está offline'}"><input type="checkbox" data-change="online" ${p.online ? 'checked' : ''} role="switch" aria-label="Ficar online" /><span></span><b>${p.online ? 'Online' : 'Offline'}</b></label></div>
        </div>
        <div class="stat-row"><a class="stat dark" href="#/p/ganhos"><small>Ganhos de hoje</small><b>${U.money(fin.today)}</b></a><a class="stat" href="#/p/agenda"><small>Serviços hoje</small><b>${String(fin.todayJobs).padStart(2, '0')}</b></a></div>
        <div class="quick">
          <a href="#/p/servicos">${icon('briefcase', 22)}<span>Meus serviços</span></a>
          <a href="#/p/mensagens">${icon('chat', 22)}<span>Conversas</span>${ctx.badges.chat ? `<i class="count">${ctx.badges.chat}</i>` : ''}</a>
          <a href="#/p/avaliacoes">${icon('star', 22)}<span>Avaliações</span></a>
          <a href="#/p/agenda">${icon('calendar', 22)}<span>Agenda</span></a>
        </div>
        ${p.online ? '' : `<div class="note warn">${icon('clock', 18)}<span><b>Você está offline.</b> Não recebe pedidos novos da região, só os enviados direto para você. Ative o botão acima para voltar.</span></div>`}
        <div class="section-row"><h2>Novos pedidos na região</h2><a class="link" href="#/p/pedidos">Ver todos</a></div>
        ${open.length ? `<div class="stack">${open.slice(0, 3).map((o) => orderCard(o, true)).join('')}</div>`
          : UI.empty('clipboard', 'Nenhum pedido novo agora', p.online ? 'Quando um cliente da sua região pedir um serviço das suas categorias, ele aparece aqui.' : 'Fique online para receber pedidos da região.')}
        ${upcoming.length ? `<div class="section-row"><h2>Próximos serviços</h2><a class="link" href="#/p/servicos">Ver todos</a></div><div class="stack">${upcoming.map((r) => jobCard(r, users.get(r.clientId), '/p/servico/' + r.id)).join('')}</div>` : ''}
        <div class="spacer"></div></div></section>`;
    },
    changes: {
      async online(el, ev, ctx) {
        try { await Svc.Auth.update(ctx.user.id, { pro: { online: el.checked } }); UI.toast(el.checked ? 'Você está online.' : 'Você está offline.'); g.App.rerender(); } catch (e) { UI.error(e); }
      }
    },
    actions: {
      'order-accept'(btn, ev, ctx) { Common.proposalSheet(btn.dataset.id, ctx.user, () => g.App.rerender()); },
      async 'order-decline'(btn, ev, ctx) {
        try { await Svc.Requests.decline(btn.dataset.id, ctx.user.id); UI.toast('Pedido recusado.'); g.App.rerender(); } catch (e) { UI.error(e); }
      }
    }
  };

  /* ======================================================================
     Pedidos (solicitações)
     ====================================================================== */
  const ordTab = { nav: -1, tab: 'novos' };
  Views['p.pedidos'] = {
    nav: 'pedidos', live: true,
    async render(ctx) {
      if (ordTab.nav !== ctx.navId) { ordTab.nav = ctx.navId; ordTab.tab = 'novos'; }
      const u = ctx.user;
      const [openAll, props, users] = await Promise.all([Svc.Requests.openFor(u), DB.proposals.where((p) => p.providerId === u.id && p.status === 'enviada'), Common.usersById()]);
      const open = u.pro.online ? openAll : openAll.filter((o) => o.req.targetProviderId);
      const sentIds = new Set(props.map((p) => p.requestId));
      const novos = open.filter((o) => !sentIds.has(o.req.id));
      const sent = open.filter((o) => sentIds.has(o.req.id));
      const list = ordTab.tab === 'novos' ? novos : sent;
      return `<section class="screen pro">${UI.header({ title: 'Pedidos', sub: 'Solicitações de clientes', right: UI.bellButton(ctx.badges.bell, 'p') })}
        <div class="tabs" role="tablist"><button role="tab" class="${ordTab.tab === 'novos' ? 'on' : ''}" aria-selected="${ordTab.tab === 'novos'}" data-action="ord-tab" data-t="novos">Novos${novos.length ? `<i>${novos.length}</i>` : ''}</button><button role="tab" class="${ordTab.tab === 'enviadas' ? 'on' : ''}" aria-selected="${ordTab.tab === 'enviadas'}" data-action="ord-tab" data-t="enviadas">Propostas enviadas${sent.length ? `<i>${sent.length}</i>` : ''}</button></div>
        <div class="scroll">${!u.pro.online && ordTab.tab === 'novos' ? `<div class="note warn">${icon('clock', 18)}<span>Você está offline: só aparecem pedidos enviados direto para você.</span></div>` : ''}
        ${list.length ? `<div class="stack">${list.map((o) => orderCard(o, ordTab.tab === 'novos')).join('')}</div>` : UI.empty('clipboard', ordTab.tab === 'novos' ? 'Nenhum pedido novo' : 'Nenhuma proposta aguardando resposta', ordTab.tab === 'novos' ? 'Novos pedidos da região aparecem aqui.' : 'Quando você enviar propostas, acompanhe a resposta do cliente por aqui.')}
        <div class="spacer"></div></div></section>`;
    },
    actions: {
      'ord-tab'(btn) { ordTab.tab = btn.dataset.t; g.App.rerender(); },
      'order-accept'(btn, ev, ctx) { Common.proposalSheet(btn.dataset.id, ctx.user, () => g.App.rerender()); },
      async 'order-decline'(btn, ev, ctx) { try { await Svc.Requests.decline(btn.dataset.id, ctx.user.id); UI.toast('Pedido recusado.'); g.App.rerender(); } catch (e) { UI.error(e); } }
    }
  };

  /* ---------- detalhe do pedido (antes de fechar) ---------- */
  Views['p.pedido'] = {
    live: true,
    async render(ctx) {
      const u = ctx.user;
      const r = await Svc.Requests.get(ctx.params.id);
      const bad = (t, m) => `<section class="screen pro">${UI.header({ title: 'Pedido', back: '/p/pedidos' })}<div class="scroll">${UI.empty('clipboard', t, m, '<a class="btn primary" href="#/p/pedidos">Ver pedidos</a>')}</div></section>`;
      if (!r) return bad('Pedido não encontrado', '');
      if (r.providerId === u.id) return `<section class="screen pro">${UI.header({ title: 'Pedido', back: '/p/pedidos' })}<div class="scroll">${UI.empty('check', 'Este pedido já é seu serviço', 'Abra o serviço para ver os detalhes.', `<a class="btn primary" href="#/p/servico/${r.id}">Abrir serviço</a>`)}</div></section>`;
      if (r.targetProviderId && r.targetProviderId !== u.id) return bad('Pedido indisponível', 'Ele foi enviado a outro profissional.');
      const client = await DB.users.get(r.clientId);
      const mine = (await Svc.Proposals.forRequest(r.id)).filter((p) => p.providerId === u.id);
      const last = mine[0];
      const closed = r.status !== 'aberta';
      const km = Svc.Geo.distanceKm(u.address, r.location);
      const cat = CFG.cat(r.category);
      return `<section class="screen pro">${UI.header({ title: 'Detalhes do pedido', back: '/p/pedidos', right: UI.badge(r.status) })}
        <div class="scroll">
          <div class="svc-title"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 24)}</span><div><h2>${esc(r.title)}</h2><p class="muted">${icon('pin', 13)} ${esc(Svc.Geo.formatAddress(r.location))}${km != null ? ' · ' + U.fmtKm(km) : ''}</p></div></div>
          <div class="card"><div class="row gap center-y">${UI.avatar(client, 40)}<span><b>${esc(client ? client.name : 'Cliente removido')}</b><br><small class="muted">Pedido enviado ${U.fmtRel(r.createdAt)}</small></span></div></div>
          <div class="card"><h3>O que o cliente precisa</h3><p class="prose-p">${esc(r.description)}</p></div>
          <div class="info-grid"><div>${icon('wallet', 18)}<small>Orçamento do cliente</small><b>${r.budget ? U.money(r.budget) : 'A combinar'}</b></div>
            <div>${icon('calendar', 18)}<small>Data desejada</small><b>${r.preferred && r.preferred.date ? U.fmtDate(r.preferred.date) + (r.preferred.time ? ', ' + r.preferred.time : '') : 'Flexível'}</b></div></div>
          <div class="note info">${icon('lock', 18)}<span>O endereço completo e o telefone do cliente aparecem depois que ele aceitar sua proposta.</span></div>
          ${last ? `<div class="card"><div class="row between"><h3>Sua proposta</h3>${UI.pill({ enviada: 'Aguardando resposta', aceita: 'Aceita', recusada: 'Recusada', substituida: 'Substituída', encerrada: 'Encerrada' }[last.status] || last.status, { enviada: 'amber', aceita: 'green', recusada: 'red' }[last.status] || 'grey')}</div>
            <p><b>${U.money(last.value)}</b> · ${U.fmtDate(last.date)} às ${last.time} · ${last.durationH} h</p>${last.conditions ? `<p class="muted">${esc(last.conditions)}</p>` : ''}</div>` : ''}
          ${closed ? `<div class="note warn">${icon('alert', 18)}<span>Este pedido não está mais aberto${r.status === 'cancelado' ? ' (cancelado)' : ''}.</span></div>` : ''}
          <div class="spacer big"></div></div>
        ${closed ? '' : `<div class="sticky-cta"><a class="btn outline icon-only" href="#/p/chat/${r.id}/${u.id}" aria-label="Conversar com o cliente">${icon('chat', 22)}</a>
          <button class="btn ghost" data-action="order-decline" data-id="${r.id}">Recusar</button><button class="btn go grow" data-action="order-accept" data-id="${r.id}">${last && last.status === 'enviada' ? 'Nova proposta' : 'Enviar proposta'}</button></div>`}</section>`;
    },
    actions: {
      'order-accept'(btn, ev, ctx) { Common.proposalSheet(btn.dataset.id, ctx.user, () => g.App.rerender()); },
      async 'order-decline'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Recusar este pedido?', message: 'Ele deixa de aparecer para você.', confirmText: 'Recusar', danger: true }))) return;
        try { await Svc.Requests.decline(btn.dataset.id, ctx.user.id); UI.toast('Pedido recusado.'); g.App.go('/p/pedidos'); } catch (e) { UI.error(e); }
      }
    }
  };

  /* ======================================================================
     Agenda
     ====================================================================== */
  const ag = { nav: -1, month: null, sel: null };
  Views['p.agenda'] = {
    nav: 'agenda', live: true,
    async render(ctx) {
      if (ag.nav !== ctx.navId) { ag.nav = ctx.navId; ag.sel = U.todayISO(); ag.month = U.parseISO(ag.sel); ag.month.setDate(1); }
      const y = ag.month.getFullYear(), m = ag.month.getMonth();
      const marks = await Svc.Agenda.markers(ctx.user.id, y, m);
      const list = await Svc.Agenda.day(ctx.user.id, ag.sel);
      const users = await Common.usersById();
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      const av = ctx.user.pro.availability;
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const iso = U.toISO(new Date(y, m, d));
        const off = !av.days.includes(new Date(y, m, d).getDay());
        cells += `<button class="cal-day ${iso === ag.sel ? 'on' : ''} ${iso === U.todayISO() ? 'today' : ''} ${off ? 'off' : ''}" data-action="ag-day" data-d="${iso}" aria-label="${U.fmtDateLong(iso)}${marks[iso] ? ', ' + marks[iso] + ' serviços' : ''}" ${iso === ag.sel ? 'aria-current="date"' : ''}>${d}${marks[iso] ? `<i>${marks[iso]}</i>` : ''}</button>`;
      }
      return `<section class="screen pro">${UI.header({ title: 'Agenda', sub: 'Seus horários e serviços', right: UI.bellButton(ctx.badges.bell, 'p') })}
        <div class="scroll">
          <div class="card cal"><div class="row between center-y"><button class="icon-btn" data-action="ag-prev" aria-label="Mês anterior">${icon('back', 20)}</button><b class="cap">${esc(U.monthLabel(ag.month))}</b><button class="icon-btn" data-action="ag-next" aria-label="Próximo mês">${icon('chevron', 20)}</button></div>
            <div class="cal-head">${CFG.WEEKDAYS.map((w) => `<span>${w[0]}</span>`).join('')}</div><div class="cal-grid">${cells}</div>
            <small class="muted">Dias esmaecidos: você não atende. <a class="link" href="#/p/perfil">Editar disponibilidade</a></small></div>
          <div class="section-row"><h2 class="cap">${esc(U.fmtDateLong(ag.sel))}</h2>${ag.sel !== U.todayISO() ? '<button class="link" data-action="ag-today">Hoje</button>' : ''}</div>
          ${list.length ? `<div class="stack">${list.map((r) => `<a class="slot-row" href="#/p/servico/${r.id}"><b class="time">${r.schedule.time}</b><span class="grow"><b>${esc(r.title)}</b><small>${esc(users.get(r.clientId) ? users.get(r.clientId).name : 'Cliente')} · ${esc(Svc.Geo.formatAddress(r.location))}</small></span>${UI.badge(r.status)}</a>`).join('')}</div>` : UI.empty('calendar', 'Nada agendado neste dia', 'Quando o cliente aceitar uma proposta, o serviço entra na agenda.')}
          <div class="spacer"></div></div></section>`;
    },
    actions: {
      'ag-day'(btn) { ag.sel = btn.dataset.d; g.App.rerender(); },
      'ag-prev'() { ag.month = new Date(ag.month.getFullYear(), ag.month.getMonth() - 1, 1); g.App.rerender(); },
      'ag-next'() { ag.month = new Date(ag.month.getFullYear(), ag.month.getMonth() + 1, 1); g.App.rerender(); },
      'ag-today'() { ag.sel = U.todayISO(); ag.month = new Date(); ag.month.setDate(1); g.App.rerender(); }
    }
  };

  /* ======================================================================
     Meus serviços
     ====================================================================== */
  const jobTab = { nav: -1, tab: 'agendados' };
  const JTABS = { agendados: ['agendado', 'em_andamento', 'aguardando_pagamento'], concluidos: ['concluido', 'cancelado'] };
  Views['p.servicos'] = {
    live: true,
    async render(ctx) {
      if (jobTab.nav !== ctx.navId) { jobTab.nav = ctx.navId; jobTab.tab = 'agendados'; }
      const [reqs, users] = await Promise.all([Svc.Requests.forProvider(ctx.user.id), Common.usersById()]);
      const sortAsc = (a, b) => (a.schedule.date + a.schedule.time).localeCompare(b.schedule.date + b.schedule.time);
      const list = reqs.filter((r) => JTABS[jobTab.tab].includes(r.status)).sort(jobTab.tab === 'agendados' ? sortAsc : (a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));
      const n = (t) => reqs.filter((r) => JTABS[t].includes(r.status)).length;
      return `<section class="screen pro">${UI.header({ title: 'Meus serviços', back: '/p/painel' })}
        <div class="tabs" role="tablist">${Object.keys(JTABS).map((t) => `<button role="tab" class="${jobTab.tab === t ? 'on' : ''}" aria-selected="${jobTab.tab === t}" data-action="job-tab" data-t="${t}">${t === 'agendados' ? 'Agendados' : 'Concluídos'}${n(t) ? `<i>${n(t)}</i>` : ''}</button>`).join('')}</div>
        <div class="scroll">${list.length ? `<div class="stack">${list.map((r) => jobCard(r, users.get(r.clientId), '/p/servico/' + r.id)).join('')}</div>` : UI.empty('briefcase', jobTab.tab === 'agendados' ? 'Nenhum serviço agendado' : 'Nenhum serviço concluído', jobTab.tab === 'agendados' ? 'Envie propostas para os pedidos da região.' : '', jobTab.tab === 'agendados' ? '<a class="btn primary" href="#/p/pedidos">Ver pedidos</a>' : '')}<div class="spacer"></div></div></section>`;
    },
    actions: { 'job-tab'(btn) { jobTab.tab = btn.dataset.t; g.App.rerender(); } }
  };

  Views['p.servico'] = {
    live: true,
    async render(ctx) {
      const u = ctx.user;
      const r = await Svc.Requests.get(ctx.params.id);
      if (!r || r.providerId !== u.id) return `<section class="screen pro">${UI.header({ title: 'Serviço', back: '/p/servicos' })}<div class="scroll">${UI.empty('briefcase', 'Serviço não encontrado', '', '<a class="btn primary" href="#/p/servicos">Meus serviços</a>')}</div></section>`;
      const client = await DB.users.get(r.clientId);
      const cat = CFG.cat(r.category);
      const net = U.round2(r.price * (1 - CFG.PLATFORM_FEE));
      let footer = '';
      if (r.status === 'agendado') footer = `<button class="btn indigo lg block" data-action="job-start" data-id="${r.id}">Iniciar serviço</button>`;
      else if (r.status === 'em_andamento') footer = `<button class="btn go lg block" data-action="job-finish" data-id="${r.id}">Concluir serviço</button>`;
      return `<section class="screen pro">${UI.header({ title: 'Detalhes do serviço', back: '/p/servicos', right: UI.badge(r.status) })}
        <div class="scroll">
          <div class="svc-title"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 24)}</span><div><h2>${esc(r.title)}</h2><p class="muted">${icon('pin', 13)} ${esc(Svc.Geo.formatAddress(r.location, true))}</p></div></div>
          ${r.status === 'cancelado' ? `<div class="note warn">${icon('alert', 18)}<span><b>Serviço cancelado.</b> ${esc((r.cancel && r.cancel.reason) || '')}</span></div>` : ''}
          ${r.status === 'aguardando_pagamento' ? `<div class="note info">${icon('clock', 18)}<span>Você concluiu o serviço. Aguardando o cliente pagar.</span></div>` : ''}
          <div class="card pro-mini"><div class="row gap center-y grow">${UI.avatar(client, 48)}<span><b>${esc(client ? client.name : 'Cliente removido')}</b><br><small class="muted">${esc(client ? client.phone : '')}</small></span></div>
            <a class="icon-btn tint" href="#/p/chat/${r.id}/${u.id}" aria-label="Conversar">${icon('chat', 20)}</a>${client ? `<a class="icon-btn tint" href="tel:${U.digits(client.phone)}" aria-label="Ligar">${icon('phone', 20)}</a>` : ''}</div>
          <div class="card"><h3>Descrição</h3><p class="prose-p">${esc(r.description)}</p></div>
          <div class="info-grid"><div>${icon('calendar', 18)}<small>Data e hora</small><b>${U.fmtDate(r.schedule.date)}, ${r.schedule.time}</b></div><div>${icon('clock', 18)}<small>Duração prevista</small><b>${r.schedule.durationH} h</b></div>
            <div>${icon('wallet', 18)}<small>${r.status === 'concluido' ? 'Você recebeu' : 'Você vai receber'}</small><b>${U.money(net)}</b></div><div>${icon('shield', 18)}<small>Pagamento</small><b>${r.payment ? 'Pago' : 'Pendente'}</b></div></div>
          ${r.conditions ? `<div class="note info">${icon('clipboard', 18)}<span><b>Suas condições:</b> ${esc(r.conditions)}</span></div>` : ''}
          ${r.review ? `<div class="card"><div class="row between"><h3>Avaliação do cliente</h3>${U.stars(r.review.rating, 16)}</div>${r.review.comment ? `<p class="prose-p">${esc(r.review.comment)}</p>` : ''}</div>` : (r.status === 'concluido' ? '<p class="muted center">O cliente ainda não avaliou.</p>' : '')}
          ${['agendado', 'em_andamento'].includes(r.status) ? `<button class="btn danger-outline block" data-action="job-cancel" data-id="${r.id}">Cancelar serviço</button>` : ''}
          <div class="spacer ${footer ? 'big' : ''}"></div></div>
        ${footer ? `<div class="sticky-cta">${footer}</div>` : ''}</section>`;
    },
    actions: {
      async 'job-start'(btn, ev, ctx) { try { await Svc.Jobs.start(btn.dataset.id, ctx.user.id); UI.toast('Serviço iniciado.', 'success'); g.App.rerender(); } catch (e) { UI.error(e); } },
      async 'job-finish'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Concluir o serviço?', message: 'O cliente será avisado para pagar e avaliar.', confirmText: 'Concluir' }))) return;
        try { await Svc.Jobs.finish(btn.dataset.id, ctx.user.id); UI.toast('Serviço concluído. Aguardando pagamento.', 'success'); g.App.rerender(); } catch (e) { UI.error(e); }
      },
      async 'job-cancel'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Cancelar este serviço?', message: 'O cliente será avisado. Cancelamentos frequentes afetam sua reputação.', confirmText: 'Cancelar serviço', cancelText: 'Manter', danger: true }))) return;
        try { await Svc.Requests.cancel(btn.dataset.id, ctx.user.id); UI.toast('Serviço cancelado.'); g.App.rerender(); } catch (e) { UI.error(e); }
      }
    }
  };

  /* ======================================================================
     Ganhos (financeiro)
     ====================================================================== */
  const fin = { all: false };
  Views['p.ganhos'] = {
    nav: 'ganhos', live: true,
    async render(ctx) {
      const s = await Svc.Finance.summary(ctx.user.id);
      const max = Math.max(1, ...s.weeks);
      const labels = ['3 sem. atrás', '2 sem. atrás', 'Semana passada', 'Esta semana'];
      const users = await Common.usersById();
      const reqs = await DB.requests.all();
      const list = fin.all ? s.tx : s.tx.slice(0, 6);
      return `<section class="screen pro">${UI.header({ title: 'Meus ganhos', right: UI.bellButton(ctx.badges.bell, 'p') })}
        <div class="scroll">
          <div class="earn"><small>Ganhos dos últimos 30 dias</small><b>${U.money(s.last30)}</b>
            <div class="earn-sub"><div><small>Disponível para saque</small><b>${U.money(s.balance)}</b></div><button class="btn mint small" data-action="withdraw" ${s.balance < 10 ? 'disabled' : ''}>${icon('pix', 16)} Transferir via Pix</button></div></div>
          <div class="card"><h3>Distribuição semanal</h3>
            <div class="bars" role="img" aria-label="Ganhos por semana: ${s.weeks.map((v, i) => labels[i] + ' ' + U.money(v)).join(', ')}">${s.weeks.map((v, i) => `<div class="bar"><span class="bar-val">${v ? U.money(v).replace(/\s/g, ' ') : '—'}</span><i style="height:${Math.max(4, Math.round(v / max * 100))}%"></i><small>${labels[i]}</small></div>`).join('')}</div></div>
          <div class="section-row"><h2>Transações recentes</h2>${s.tx.length > 6 ? `<button class="link" data-action="fin-all">${fin.all ? 'Ver menos' : 'Ver todas'}</button>` : ''}</div>
          ${list.length ? `<div class="stack">${list.map((t) => {
            const req = t.requestId ? reqs.find((r) => r.id === t.requestId) : null; const c = req ? users.get(req.clientId) : null;
            return `<div class="tx"><span class="tx-ic ${t.type}">${icon(t.type === 'saque' ? 'pix' : 'check', 18)}</span><span class="grow"><b>${esc(t.type === 'saque' ? 'Saque via Pix' : (c ? c.name : 'Cliente'))}</b><small>${esc(t.type === 'saque' ? 'Transferência' : t.description)} · ${U.fmtDate(U.toISO(new Date(t.createdAt)))}</small></span><span class="tx-val ${t.type}"><b>${t.type === 'saque' ? '−' : '+'}${U.money(t.net)}</b><small>Concluído</small></span></div>`;
          }).join('')}</div>` : UI.empty('wallet', 'Sem movimentações ainda', 'Seus ganhos aparecem aqui assim que um cliente pagar um serviço.')}
          <div class="spacer"></div></div></section>`;
    },
    actions: {
      'fin-all'() { fin.all = !fin.all; g.App.rerender(); },
      async withdraw(btn, ev, ctx) {
        const s = await Svc.Finance.summary(ctx.user.id);
        UI.sheet({
          title: 'Transferir via Pix',
          html: `<form novalidate><p class="muted">Disponível: <b>${U.money(s.balance)}</b>. A transferência é simulada.</p>
            ${UI.field({ label: 'Valor (R$)', name: 'amount', value: String(s.balance).replace('.', ','), mask: 'money', inputmode: 'decimal', required: true })}
            ${UI.field({ label: 'Chave Pix', name: 'pix', placeholder: 'CPF, e-mail, celular ou chave aleatória', required: true })}
            <div class="form-error" role="alert" hidden></div><button class="btn go lg block" type="submit">Confirmar saque</button></form>`,
          onMount(api) {
            const form = api.el.querySelector('form');
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              const err = form.querySelector('.form-error'); err.hidden = true;
              const b = form.querySelector('[type=submit]'); const d = UI.formData(form);
              UI.busy(b, true, 'Enviando...');
              try { await Svc.Finance.withdraw(ctx.user.id, U.parseMoney(d.amount), d.pix); api.close(); UI.toast('Saque realizado (simulado).', 'success'); g.App.rerender(); }
              catch (ex) { err.textContent = ex.message; err.hidden = false; UI.busy(b, false); }
            });
          }
        });
      }
    }
  };

  /* ======================================================================
     Avaliações
     ====================================================================== */
  Views['p.avaliacoes'] = {
    live: true,
    async render(ctx) {
      const [st, reviews] = await Promise.all([Svc.Providers.stats(ctx.user), Svc.Providers.reviews(ctx.user.id)]);
      return `<section class="screen pro">${UI.header({ title: 'Avaliações', back: '/p/painel' })}
        <div class="scroll"><div class="card rep"><b class="big">${st.rating ? st.rating.toFixed(1).replace('.', ',') : '—'}</b>${U.stars(st.rating, 20)}<small class="muted">${st.count} ${U.plural(st.count, 'avaliação', 'avaliações')} · ${st.jobs} ${U.plural(st.jobs, 'serviço realizado', 'serviços realizados')}</small></div>
          <div class="section-row"><h2>O que dizem sobre você</h2></div>
          ${reviews.length ? `<div class="stack">${reviews.map((r) => `<article class="review"><div class="row between"><b>${esc(U.firstName(r.clientName))}</b>${U.stars(r.rating, 13)}</div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}${r.tags.length ? `<div class="chips">${r.tags.map((t) => `<span class="chip static">${esc(t)}</span>`).join('')}</div>` : ''}<small class="muted">${esc(r.title)} · ${U.fmtRel(r.at)}</small></article>`).join('')}</div>` : UI.empty('star', 'Ainda sem avaliações detalhadas', 'Depois de concluir e receber, o cliente poderá avaliar o seu trabalho.')}
          <div class="spacer"></div></div></section>`;
    }
  };
})(window);
