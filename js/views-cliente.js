/* ==========================================================================
   views-cliente.js — telas do cliente
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, UI, Svc, CFG, DB, Sim } = g;
  const esc = U.esc, icon = U.icon;
  const Views = (g.Views = g.Views || {});
  const Common = (g.Common = g.Common || {});

  /* ---------- helpers ---------- */
  Common.usersById = async () => new Map((await DB.users.all()).map((u) => [u.id, u]));
  Common.catTile = (c) => `<a class="cat tone-${c.tone}" href="#/c/explorar?cat=${c.id}"><span class="cat-ic">${icon(c.icon, 24)}</span><span class="cat-name">${esc(c.name)}</span></a>`;
  Common.serviceCard = (r, o) => {
    const cat = CFG.cat(r.category);
    const prov = o.provider;
    let sub;
    if (r.status === 'aberta') sub = o.proposals ? `${o.proposals} ${U.plural(o.proposals, 'proposta recebida', 'propostas recebidas')}` : (r.targetProviderId && prov ? `Aguardando ${prov.name}` : 'Aguardando propostas');
    else if (r.status === 'cancelado') sub = (r.cancel && r.cancel.reason) || 'Cancelado';
    else if (r.status === 'concluido') sub = `${prov ? 'Realizado por ' + prov.name : 'Concluído'} · ${U.fmtDate(r.schedule.date)}`;
    else sub = `${U.fmtDate(r.schedule.date)} às ${r.schedule.time}${prov ? ' · ' + prov.name : ''}`;
    return `<a class="svc-card" href="#${o.to}"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 22)}</span>
      <span class="svc-main"><b>${esc(r.title)}</b><small>${esc(sub)}</small></span>
      <span class="svc-side">${UI.badge(r.status)}${r.price ? `<b>${U.money(r.price)}</b>` : ''}</span></a>`;
  };
  Common.proCard = (item, base) => {
    const p = item.pro;
    return `<article class="pro-card"><a class="pro-link" href="#/${base}/pro/${p.id}">
      ${UI.avatar(p, 54, { online: p.pro.online, verified: p.pro.verified === 'verificado' })}
      <span class="pro-info"><b>${esc(p.name)}</b><small>${esc(p.pro.headline)}</small>
        <span class="pro-meta">${UI.rating(item.stats.rating, item.stats.count)}${item.km != null ? `<span class="dist">${icon('pin', 13)} ${U.fmtKm(item.km)}${item.km > 20 ? '' : ' de distância'}</span>` : `<span class="dist">${icon('pin', 13)} ${esc(p.address.bairro || p.address.cidade || '')}</span>`}</span>
      </span></a><a class="btn small primary" href="#/${base}/pro/${p.id}">Ver perfil</a></article>`;
  };
  const sortHours = () => Array.from({ length: 13 }, (_, i) => String(7 + i).padStart(2, '0') + ':00');

  /* ======================================================================
     Início
     ====================================================================== */
  Views['c.inicio'] = {
    nav: 'inicio', live: true,
    async render(ctx) {
      const u = ctx.user;
      const [reqs, users, top] = await Promise.all([Svc.Requests.forClient(u.id), Common.usersById(), Svc.Providers.search({ client: u, sort: 'rating' })]);
      const recent = reqs.slice(0, 3);
      const proposals = await DB.proposals.all();
      return `<section class="screen"><div class="scroll">
        <div class="home-top">
          <div><small>Que bom ver você de novo,</small><h1>Olá, ${esc(U.firstName(u.name))}!</h1></div>
          <div class="row gap">${UI.bellButton(ctx.badges.bell, 'c')}<a href="#/c/perfil" aria-label="Meu perfil">${UI.avatar(u, 42)}</a></div>
        </div>
        <form class="searchbar" data-submit="search" role="search">${icon('search', 20)}
          <input name="q" placeholder="O que você precisa hoje?" aria-label="Buscar serviços" autocomplete="off" />
          <button type="button" class="icon-btn tint" data-action="go" data-to="/c/explorar" aria-label="Abrir busca com filtros">${icon('sliders', 20)}</button></form>
        <div class="section-row"><h2>Categorias</h2><a class="link" href="#/c/explorar">Ver todas</a></div>
        <div class="cat-grid">${CFG.CATEGORIES.map(Common.catTile).join('')}</div>
        ${u.firstDiscountUsed ? '' : `<div class="promo"><div><h3>Ganhe 15% de desconto no seu primeiro serviço!</h3><p>Vale para pagamentos por Pix ou cartão, aplicado na hora de pagar.</p>
          <a class="btn white small" href="#/c/novo">Eu quero</a></div><span class="burst" aria-hidden="true"></span></div>`}
        <div class="section-row"><h2>Serviços recentes</h2><a class="link" href="#/c/servicos">Histórico</a></div>
        ${recent.length ? `<div class="stack">${recent.map((r) => Common.serviceCard(r, { provider: users.get(r.providerId), proposals: proposals.filter((p) => p.requestId === r.id && p.status === 'enviada').length, to: '/c/servico/' + r.id })).join('')}</div>`
          : UI.empty('clipboard', 'Você ainda não pediu nenhum serviço', 'Descreva o que precisa e receba propostas de profissionais da região.', '<a class="btn primary" href="#/c/novo">Pedir um serviço</a>')}
        ${top.length ? `<div class="section-row"><h2>Em destaque</h2><a class="link" href="#/c/explorar">Ver mais</a></div><div class="stack">${top.slice(0, 3).map((i) => Common.proCard(i, 'c')).join('')}</div>` : ''}
        <div class="spacer"></div></div></section>`;
    },
    submits: {
      async search(form, ev, ctx) {
        const q = UI.formData(form).q.trim();
        if (q) await saveRecent(ctx.user.id, q);
        g.App.go('/c/explorar' + (q ? '?q=' + encodeURIComponent(q) : ''));
      }
    }
  };

  const saveRecent = async (uid, q) => {
    const list = (await DB.kv.get('recent:' + uid, [])).filter((x) => x !== q);
    list.unshift(q);
    await DB.kv.set('recent:' + uid, list.slice(0, 6));
  };

  /* ======================================================================
     Buscar / Explorar
     ====================================================================== */
  const ex = { nav: -1, q: '', place: '', cat: '', sort: 'dist' };
  const resultsHtml = (list) => list.length
    ? `<div class="section-row"><h2>${list.length} ${U.plural(list.length, 'profissional encontrado', 'profissionais encontrados')}</h2></div><div class="stack">${list.map((i) => Common.proCard(i, 'c')).join('')}</div>`
    : UI.empty('search', 'Nenhum profissional encontrado', 'Tente outra categoria, outro bairro ou menos palavras.', '<button class="btn outline" data-action="ex-clear">Limpar filtros</button>');
  const refreshResults = async (ctx) => {
    const box = document.getElementById('results');
    if (!box) return;
    const list = await Svc.Providers.search({ q: ex.q, category: ex.cat, place: ex.place, client: ctx.user, sort: ex.sort });
    box.innerHTML = resultsHtml(list);
    const rec = document.getElementById('recent');
    if (rec) rec.hidden = !!(ex.q || ex.cat || ex.place);
  };

  Views['c.explorar'] = {
    nav: 'explorar',
    async render(ctx) {
      if (ex.nav !== ctx.navId) { ex.nav = ctx.navId; ex.q = ctx.query.q || ''; ex.cat = ctx.query.cat || ''; ex.place = ''; ex.sort = 'dist'; }
      const recent = await DB.kv.get('recent:' + ctx.user.id, []);
      const list = await Svc.Providers.search({ q: ex.q, category: ex.cat, place: ex.place, client: ctx.user, sort: ex.sort });
      return `<section class="screen">
        ${UI.header({ title: 'Buscar serviços', right: UI.bellButton(ctx.badges.bell, 'c') })}
        <div class="scroll">
        <form class="searchbar" data-submit="search" role="search">${icon('search', 20)}
          <input name="q" value="${esc(ex.q)}" data-input="q" placeholder="Babá, doméstica, cuidador de idosos..." aria-label="Buscar profissionais" autocomplete="off" /></form>
        <div class="searchbar place">${icon('pin', 20)}<input name="place" value="${esc(ex.place)}" data-input="place" placeholder="Bairro ou cidade" aria-label="Filtrar por bairro ou cidade" autocomplete="off" /></div>
        <div class="chips scroll-x" role="group" aria-label="Categorias">
          <button class="chip ${!ex.cat ? 'on' : ''}" data-action="ex-cat" data-id="">Todas</button>
          ${CFG.CATEGORIES.map((c) => `<button class="chip ${ex.cat === c.id ? 'on' : ''}" data-action="ex-cat" data-id="${c.id}">${icon(c.icon, 15)} ${esc(c.name)}</button>`).join('')}
        </div>
        <div class="row between center-y"><label class="sort">Ordenar por
          <select data-change="sort" aria-label="Ordenar resultados"><option value="dist" ${ex.sort === 'dist' ? 'selected' : ''}>Mais próximos</option><option value="rating" ${ex.sort === 'rating' ? 'selected' : ''}>Melhor avaliados</option></select></label></div>
        <div id="recent" ${recent.length && !(ex.q || ex.cat || ex.place) ? '' : 'hidden'}>
          <div class="section-row"><h2>Buscas recentes</h2><button class="link" data-action="ex-clear-recent">Limpar</button></div>
          <div class="chips">${recent.map((r) => `<button class="chip ghost" data-action="ex-recent" data-q="${esc(r)}">${icon('clock', 14)} ${esc(r)}</button>`).join('')}</div>
        </div>
        <div id="results">${resultsHtml(list)}</div><div class="spacer"></div></div></section>`;
    },
    submits: { async search(form, ev, ctx) { const q = UI.formData(form).q.trim(); if (q) await saveRecent(ctx.user.id, q); } },
    inputs: {
      q: U.debounce((el) => { ex.q = el.value; refreshResults(g.App.ctx); }, 250),
      place: U.debounce((el) => { ex.place = el.value; refreshResults(g.App.ctx); }, 250)
    },
    changes: { sort(el) { ex.sort = el.value; refreshResults(g.App.ctx); } },
    actions: {
      'ex-cat'(btn) {
        ex.cat = btn.dataset.id;
        document.querySelectorAll('[data-action="ex-cat"]').forEach((b) => b.classList.toggle('on', b.dataset.id === ex.cat));
        refreshResults(g.App.ctx);
      },
      'ex-recent'(btn) { ex.q = btn.dataset.q; const i = document.querySelector('input[name=q]'); if (i) i.value = ex.q; refreshResults(g.App.ctx); },
      async 'ex-clear-recent'(btn, ev, ctx) { await DB.kv.set('recent:' + ctx.user.id, []); document.getElementById('recent').hidden = true; },
      'ex-clear'() { ex.q = ''; ex.cat = ''; ex.place = ''; g.App.rerender(); }
    }
  };

  /* ======================================================================
     Descrever problema / novo pedido
     ====================================================================== */
  let nd = null;
  const freshDraft = (ctx) => ({
    nav: ctx.navId, category: ctx.query.cat || '', title: '', description: '',
    target: ctx.query.pro || null,
    prefDate: ctx.query.date || '', prefTime: ctx.query.time || ''
  });

  Views['c.novo'] = {
    nav: 'novo',
    async render(ctx) {
      if (!nd || nd.nav !== ctx.navId) nd = freshDraft(ctx);
      const u = ctx.user;
      const target = nd.target ? await Svc.Providers.get(nd.target) : null;
      if (nd.target && !target) nd.target = null;
      if (target && !nd.category) nd.category = target.pro.categories[0];
      const a = u.address || {};
      return `<section class="screen">
        ${UI.header({ title: 'Descrever problema', back: true })}
        <div class="scroll"><form class="pad" data-submit="novo" novalidate>
          ${target ? `<div class="target-banner">${UI.avatar(target, 40)}<span><small>Pedido direto para</small><b>${esc(target.name)}</b></span><button type="button" class="link" data-action="nd-region">Enviar para a região</button></div>` : ''}
          <h3 class="section-h">Que tipo de serviço?</h3>
          <div class="chips" role="radiogroup" aria-label="Categoria">${CFG.CATEGORIES.map((c) => `<label class="chip-check"><input type="radio" name="category" value="${c.id}" ${nd.category === c.id ? 'checked' : ''} /><span>${icon(c.icon, 16)} ${esc(c.name)}</span></label>`).join('')}</div>
          ${UI.field({ label: 'Título do pedido', name: 'title', value: nd.title, placeholder: 'Ex.: Pintar a sala de estar', maxlength: 80, required: true })}
          ${UI.field({ label: 'Descreva o problema', name: 'description', type: 'textarea', value: nd.description, placeholder: 'Conte o que está acontecendo, tamanho do local, materiais que já tem...', maxlength: 1000, required: true })}
          <h3 class="section-h">Onde será o serviço?</h3>
          ${Common.addressFields(a)}
          <h3 class="section-h">Quando e quanto?</h3>
          <div class="grid-2">
            ${UI.field({ label: 'Data desejada', name: 'prefDate', type: 'date', value: nd.prefDate, min: U.todayISO() })}
            ${UI.select({ label: 'Horário', name: 'prefTime', value: nd.prefTime, options: [{ value: '', label: 'Qualquer um' }].concat(sortHours()) })}
          </div>
          ${UI.field({ label: 'Orçamento estimado (opcional)', name: 'budget', placeholder: 'R$ 0,00', mask: 'money', inputmode: 'decimal', hint: 'Ajuda os profissionais a entender o que você espera pagar.' })}
          ${u.firstDiscountUsed ? '' : `<div class="note ok">${icon('percent', 18)}<span>Você tem <b>15% de desconto</b> no primeiro serviço pago por Pix ou cartão.</span></div>`}
          <div class="form-error" role="alert" hidden></div>
          <button class="btn go lg block" type="submit">${target ? 'Enviar para ' + esc(U.firstName(target.name)) : 'Enviar solicitação'}</button>
        </form></div></section>`;
    },
    inputs: { cep(el) { Common.cepLookup(el); } },
    actions: {
      'nd-region'() { saveForm(); nd.target = null; g.App.rerender(); }
    },
    submits: {
      async novo(form, ev, ctx) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const d = UI.formData(form);
        saveForm();
        try {
          const loc = Common.readAddress(d);
          const budget = d.budget ? U.parseMoney(d.budget) : null;
          if (d.budget && !(budget > 0)) throw new Error('Orçamento inválido. Use apenas números, ex.: 150,00.');
          UI.busy(btn, true, 'Enviando...');
          const req = await Svc.Requests.create(ctx.user, {
            category: d.category, title: d.title, description: d.description, location: loc, budget,
            preferred: { date: d.prefDate || null, time: d.prefTime || null }, targetProviderId: nd.target
          });
          nd = null;
          UI.toast('Pedido enviado! As propostas chegam aqui.', 'success');
          g.App.go('/c/servico/' + req.id);
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); err.scrollIntoView({ block: 'center' }); }
      }
    }
  };
  function saveForm() {
    const f = document.querySelector('form[data-submit=novo]');
    if (!f || !nd) return;
    const d = UI.formData(f);
    Object.assign(nd, { category: d.category || nd.category, title: d.title, description: d.description, prefDate: d.prefDate, prefTime: d.prefTime });
  }

  /* ======================================================================
     Perfil do profissional (visão do cliente)
     ====================================================================== */
  const sel = { nav: -1, date: '', time: '' };
  Views['c.pro'] = {
    async render(ctx) {
      const pro = await Svc.Providers.get(ctx.params.id);
      if (!pro) return `<section class="screen">${UI.header({ title: 'Profissional', back: true })}<div class="scroll">${UI.empty('user', 'Profissional não encontrado', 'Ele pode ter removido a conta.', '<a class="btn primary" href="#/c/explorar">Voltar à busca</a>')}</div></section>`;
      if (sel.nav !== ctx.navId) { sel.nav = ctx.navId; sel.date = ''; sel.time = ''; }
      const st = await Svc.Providers.stats(pro);
      const reviews = (await Svc.Providers.reviews(pro.id)).slice(0, 5);
      const days = Array.from({ length: 10 }, (_, i) => U.addDays(U.todayISO(), i));
      const slotsByDay = {};
      for (const dt of days) slotsByDay[dt] = await Svc.Providers.slots(pro.id, dt);
      if (!sel.date || !slotsByDay[sel.date]) sel.date = days.find((d) => slotsByDay[d].some((s) => s.ok)) || days[0];
      const km = Svc.Geo.distanceKm(ctx.user.address, pro.address);
      const p = pro.pro;
      const slots = slotsByDay[sel.date];
      const isSeed = !!pro.seed;
      return `<section class="screen">
        ${UI.header({ title: 'Perfil do profissional', back: true })}
        <div class="scroll">
          <div class="card profile-head">
            ${UI.avatar(pro, 76, { verified: p.verified === 'verificado' })}
            <div><h2>${esc(pro.name)}</h2><p class="muted">${esc(p.headline)}${p.businessName ? ' · ' + esc(p.businessName) : ''}</p>
              <div class="row gap wrap">${UI.rating(st.rating, st.count)}<span class="dist">${icon('pin', 13)} ${esc(Svc.Geo.formatAddress(pro.address))}${km != null ? ' · ' + U.fmtKm(km) : ''}</span></div></div>
            <div class="stats3"><div><b>${p.years} ${U.plural(p.years, 'ano', 'anos')}</b><small>Experiência</small></div><div><b>${st.jobs}${st.jobs >= 50 ? '+' : ''}</b><small>Serviços</small></div><div><b>${p.responseMin} min</b><small>Resposta</small></div></div>
          </div>
          ${p.online ? '' : `<div class="note warn">${icon('clock', 18)}<span>Este profissional está offline agora e pode demorar para responder.</span></div>`}
          ${p.bio ? `<h3 class="section-h">Sobre</h3><p class="prose-p">${esc(p.bio)}</p>` : ''}
          <h3 class="section-h">Especialidades</h3>
          <div class="chips">${p.categories.map((c) => `<span class="chip static">${icon(CFG.cat(c).icon, 14)} ${esc(CFG.cat(c).name)}</span>`).join('')}</div>
          <div class="section-row"><h2>Selecione a data</h2><span class="muted">${esc(U.monthLabel(U.parseISO(sel.date)))}</span></div>
          <div class="days" role="listbox" aria-label="Datas disponíveis">${days.map((d) => { const has = slotsByDay[d].some((s) => s.ok); return `<button class="day ${d === sel.date ? 'on' : ''}" data-action="pick-date" data-d="${d}" ${has ? '' : 'disabled'} role="option" aria-selected="${d === sel.date}"><small>${esc(U.weekdayShort(d))}</small><b>${U.parseISO(d).getDate()}</b></button>`; }).join('')}</div>
          <div class="section-row"><h2>Horários disponíveis</h2></div>
          ${slots.length ? `<div class="slots">${slots.map((s) => `<button class="slot ${s.time === sel.time ? 'on' : ''}" data-action="pick-time" data-t="${s.time}" ${s.ok ? '' : 'disabled'}>${s.time}</button>`).join('')}</div>` : '<p class="muted">Sem atendimento neste dia.</p>'}
          <div class="section-row"><h2>Avaliações</h2></div>
          ${reviews.length ? `<div class="stack">${reviews.map((r) => `<article class="review"><div class="row between"><b>${esc(U.firstName(r.clientName))}</b>${U.stars(r.rating, 13)}</div>${r.comment ? `<p>${esc(r.comment)}</p>` : ''}<small class="muted">${esc(r.title)} · ${U.fmtRel(r.at)}</small></article>`).join('')}</div>` : '<p class="muted">Ainda sem avaliações detalhadas no app.</p>'}
          <div class="spacer big"></div>
        </div>
        <div class="sticky-cta">
          <button class="btn outline icon-only" data-action="pro-whats" data-id="${pro.id}" ${isSeed ? 'disabled title="Indisponível em profissionais de exemplo"' : ''} aria-label="Chamar no WhatsApp">${icon('whatsapp', 22)}</button>
          <button class="btn go lg grow" data-action="pro-request" data-id="${pro.id}">${sel.time ? `Solicitar para ${U.fmtDay(sel.date)} às ${sel.time}` : 'Pedir orçamento'}</button>
        </div></section>`;
    },
    actions: {
      'pick-date'(btn) { sel.date = btn.dataset.d; sel.time = ''; g.App.rerender(); },
      'pick-time'(btn) { sel.time = sel.time === btn.dataset.t ? '' : btn.dataset.t; g.App.rerender(); },
      async 'pro-request'(btn, ev, ctx) {
        const pro = await Svc.Providers.get(btn.dataset.id);
        if (!pro) return;
        const q = `pro=${pro.id}&cat=${pro.pro.categories[0]}${sel.time ? `&date=${sel.date}&time=${sel.time}` : ''}`;
        g.App.go('/c/novo?' + q);
      },
      async 'pro-whats'(btn, ev, ctx) {
        const pro = await Svc.Providers.get(btn.dataset.id);
        if (!pro) return;
        const when = sel.time ? ` para ${U.fmtDateLong(sel.date)} às ${sel.time}` : '';
        const msg = `Olá, ${U.firstName(pro.name)}! Vi seu perfil no ServiceAproxima e gostaria de um orçamento${when}.`;
        window.open(`https://wa.me/55${U.digits(pro.phone)}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      }
    }
  };

  /* ======================================================================
     Meus serviços
     ====================================================================== */
  const svcTab = { nav: -1, tab: 'solicitados' };
  const TABS = { solicitados: ['aberta'], agendados: ['agendado', 'em_andamento', 'aguardando_pagamento'], concluidos: ['concluido', 'cancelado'] };
  Views['c.servicos'] = {
    nav: 'servicos', live: true,
    async render(ctx) {
      if (svcTab.nav !== ctx.navId) { svcTab.nav = ctx.navId; svcTab.tab = TABS[ctx.query.tab] ? ctx.query.tab : 'solicitados'; }
      const [reqs, users, props] = await Promise.all([Svc.Requests.forClient(ctx.user.id), Common.usersById(), DB.proposals.all()]);
      const count = (t) => reqs.filter((r) => TABS[t].includes(r.status)).length;
      const list = reqs.filter((r) => TABS[svcTab.tab].includes(r.status));
      const empty = { solicitados: ['clipboard', 'Nenhum pedido em aberto', 'Peça um serviço e acompanhe as propostas por aqui.'], agendados: ['calendar', 'Nada agendado', 'Quando você aceitar uma proposta, o serviço aparece aqui.'], concluidos: ['check', 'Nenhum serviço concluído ainda', 'O histórico dos seus serviços fica guardado aqui.'] }[svcTab.tab];
      return `<section class="screen">
        ${UI.header({ title: 'Meus serviços', right: UI.bellButton(ctx.badges.bell, 'c') })}
        <div class="tabs" role="tablist">${Object.keys(TABS).map((t) => `<button role="tab" class="${svcTab.tab === t ? 'on' : ''}" aria-selected="${svcTab.tab === t}" data-action="svc-tab" data-t="${t}">${{ solicitados: 'Solicitados', agendados: 'Agendados', concluidos: 'Concluídos' }[t]}${count(t) ? `<i>${count(t)}</i>` : ''}</button>`).join('')}</div>
        <div class="scroll">${list.length ? `<div class="stack">${list.map((r) => Common.serviceCard(r, { provider: users.get(r.providerId) || (r.targetProviderId ? users.get(r.targetProviderId) : null), proposals: props.filter((p) => p.requestId === r.id && p.status === 'enviada').length, to: '/c/servico/' + r.id })).join('')}</div>`
          : UI.empty(empty[0], empty[1], empty[2], svcTab.tab === 'solicitados' ? '<a class="btn primary" href="#/c/novo">Pedir um serviço</a>' : '')}<div class="spacer"></div></div></section>`;
    },
    actions: { 'svc-tab'(btn) { svcTab.tab = btn.dataset.t; g.App.rerender(); } }
  };

  /* ======================================================================
     Detalhe do serviço
     ====================================================================== */
  const STEPS = ['Solicitado', 'Agendado', 'Em andamento', 'Pagamento', 'Concluído'];
  const STEP_OF = { aberta: 0, agendado: 1, em_andamento: 2, aguardando_pagamento: 3, concluido: 4 };
  Views['c.servico'] = {
    live: true,
    async render(ctx) {
      const r = await Svc.Requests.get(ctx.params.id);
      if (!r || r.clientId !== ctx.user.id) return `<section class="screen">${UI.header({ title: 'Serviço', back: '/c/servicos' })}<div class="scroll">${UI.empty('clipboard', 'Serviço não encontrado', '', '<a class="btn primary" href="#/c/servicos">Meus serviços</a>')}</div></section>`;
      const users = await Common.usersById();
      const prov = users.get(r.providerId);
      const target = r.targetProviderId ? users.get(r.targetProviderId) : null;
      const props = (await Svc.Proposals.forRequest(r.id)).filter((p) => p.status === 'enviada');
      const stats = prov ? await Svc.Providers.stats(prov) : null;
      const cat = CFG.cat(r.category);
      const step = STEP_OF[r.status];
      const canDemo = prov && Sim.isSimPro(prov) && ctx.user.settings.simulate !== false && ['agendado', 'em_andamento'].includes(r.status);
      let footer = '';
      if (r.status === 'aguardando_pagamento') footer = `<a class="btn go lg block" href="#/c/pagar/${r.id}">Pagar ${U.money(r.price)}</a>`;
      else if (r.status === 'concluido' && !r.review) footer = `<a class="btn go lg block" href="#/c/avaliar/${r.id}">Avaliar profissional</a>`;
      else if (r.status === 'concluido' || r.status === 'cancelado') footer = `<button class="btn primary lg block" data-action="again" data-id="${r.id}">Solicitar novo serviço</button>`;
      return `<section class="screen">
        ${UI.header({ title: 'Detalhes do serviço', back: '/c/servicos', right: UI.badge(r.status) })}
        <div class="scroll">
          <div class="svc-title"><span class="svc-ic tone-${cat.tone}">${icon(cat.icon, 24)}</span><div><h2>${esc(r.title)}</h2><p class="muted">${icon('pin', 13)} ${esc(Svc.Geo.formatAddress(r.location, true))}</p></div></div>
          ${r.status === 'cancelado' ? `<div class="note warn">${icon('alert', 18)}<span><b>Serviço cancelado.</b> ${esc((r.cancel && r.cancel.reason) || '')}</span></div>` : `
          <ol class="stepper" aria-label="Andamento do serviço">${STEPS.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'now' : ''}" ${i === step ? 'aria-current="step"' : ''}><i>${i < step ? icon('check', 12) : i + 1}</i><span>${s}</span></li>`).join('')}</ol>`}
          <div class="card"><h3>Descrição</h3><p class="prose-p">${esc(r.description)}</p></div>
          ${prov ? `<div class="card pro-mini"><a href="#/c/pro/${prov.id}" class="row gap center-y grow">${UI.avatar(prov, 48, { verified: prov.pro.verified === 'verificado' })}<span><b>${esc(prov.name)}</b><br>${UI.rating(stats.rating, stats.count)}</span></a>
            <a class="icon-btn tint" href="#/c/chat/${r.id}/${prov.id}" aria-label="Conversar">${icon('chat', 20)}</a><a class="icon-btn tint" href="tel:${U.digits(prov.phone)}" aria-label="Ligar">${icon('phone', 20)}</a></div>` : ''}
          ${r.schedule ? `<div class="info-grid"><div>${icon('calendar', 18)}<small>Data e hora</small><b>${U.fmtDate(r.schedule.date)}, ${r.schedule.time}</b></div><div>${icon('clock', 18)}<small>Duração prevista</small><b>${r.schedule.durationH} ${U.plural(r.schedule.durationH, 'hora', 'horas')}</b></div>
            <div>${icon('wallet', 18)}<small>Preço total</small><b>${U.money(r.price)}</b></div><div>${icon('shield', 18)}<small>Pagamento</small><b>${r.payment ? 'Pago' + (r.payment.discount ? ' (−' + U.money(r.payment.discount) + ')' : '') : 'Pendente'}</b></div></div>` : (r.budget ? `<div class="info-grid"><div>${icon('wallet', 18)}<small>Seu orçamento estimado</small><b>${U.money(r.budget)}</b></div></div>` : '')}
          ${r.conditions ? `<div class="note info">${icon('clipboard', 18)}<span><b>Observações do profissional:</b> ${esc(r.conditions)}</span></div>` : ''}
          ${r.status === 'aberta' ? `<div class="section-row"><h2>Propostas recebidas</h2></div>${props.length ? `<div class="stack">${props.map((p) => proposalCard(p, users.get(p.providerId), r)).join('')}</div>`
            : `<div class="waiting"><span class="pulse"></span><p>${target ? `Aguardando ${esc(target.name)} responder.` : 'Os profissionais da região foram avisados. As propostas aparecem aqui.'}</p></div>`}` : ''}
          ${r.review ? `<div class="card"><div class="row between"><h3>Sua avaliação</h3>${U.stars(r.review.rating, 16)}</div>${(r.review.tags || []).length ? `<div class="chips">${r.review.tags.map((t) => `<span class="chip static">${esc(t)}</span>`).join('')}</div>` : ''}${r.review.comment ? `<p class="prose-p">${esc(r.review.comment)}</p>` : ''}</div>` : ''}
          ${r.payment ? `<p class="muted center">Pago por ${r.payment.method === 'pix' ? 'Pix' : 'cartão' + (r.payment.last4 ? ' final ' + r.payment.last4 : '')} em ${U.fmtDate(U.toISO(new Date(r.payment.paidAt)))}.</p>` : ''}
          <div class="stack gap-s">
            ${canDemo ? `<button class="btn outline block" data-action="demo-finish" data-id="${r.id}">${icon('refresh', 18)} Demo: simular conclusão pelo profissional</button>` : ''}
            ${['aberta', 'agendado', 'em_andamento'].includes(r.status) ? `<button class="btn danger-outline block" data-action="cancel-req" data-id="${r.id}">Cancelar ${r.status === 'aberta' ? 'solicitação' : 'serviço'}</button>` : ''}
          </div>
          <div class="spacer ${footer ? 'big' : ''}"></div>
        </div>
        ${footer ? `<div class="sticky-cta">${footer}</div>` : ''}</section>`;
    },
    actions: {
      async 'accept-prop'(btn, ev, ctx) {
        UI.busy(btn, true, 'Aceitando...');
        try { await Svc.Proposals.respond(btn.dataset.id, true, ctx.user.id); UI.toast('Proposta aceita! Serviço agendado.', 'success'); g.App.rerender(); }
        catch (e) { UI.error(e); UI.busy(btn, false); g.App.rerender(); }
      },
      async 'reject-prop'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Recusar proposta?', message: 'O profissional será avisado.', confirmText: 'Recusar', danger: true }))) return;
        try { await Svc.Proposals.respond(btn.dataset.id, false, ctx.user.id); g.App.rerender(); } catch (e) { UI.error(e); }
      },
      async 'cancel-req'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Cancelar este serviço?', message: 'O profissional será avisado e o pedido será encerrado.', confirmText: 'Cancelar serviço', cancelText: 'Manter', danger: true }))) return;
        try { await Svc.Requests.cancel(btn.dataset.id, ctx.user.id); UI.toast('Serviço cancelado.'); g.App.rerender(); } catch (e) { UI.error(e); }
      },
      async 'demo-finish'(btn) {
        try { await Sim.finishJob(btn.dataset.id); UI.toast('O profissional concluiu o serviço. Agora é só pagar.', 'success'); g.App.rerender(); } catch (e) { UI.error(e); }
      },
      async again(btn, ev, ctx) {
        const r = await Svc.Requests.get(btn.dataset.id);
        const prov = r && (r.providerId || r.targetProviderId);
        const ok = prov && (await Svc.Providers.get(prov));
        g.App.go(`/c/novo?cat=${r.category}${ok ? '&pro=' + prov : ''}`);
      }
    }
  };

  function proposalCard(p, pro, r) {
    return `<article class="proposal"><div class="row gap center-y">${UI.avatar(pro, 40)}<span class="grow"><b>${esc(pro ? pro.name : 'Profissional')}</b><br><small class="muted">${esc(pro ? pro.pro.headline : '')}</small></span><b class="price">${U.money(p.value)}</b></div>
      <ul class="facts"><li>${icon('calendar', 15)} ${U.fmtDateLong(p.date)}, ${p.time}</li><li>${icon('clock', 15)} Duração: ${p.durationH} ${U.plural(p.durationH, 'hora', 'horas')}</li>${p.materialIncluded ? `<li>${icon('check', 15)} Material incluso</li>` : ''}</ul>
      ${p.conditions ? `<p class="prose-p small">${esc(p.conditions)}</p>` : ''}
      <div class="row gap"><a class="btn outline small" href="#/c/chat/${r.id}/${p.providerId}">${icon('chat', 16)} Conversar</a><button class="btn ghost small" data-action="reject-prop" data-id="${p.id}">Recusar</button><button class="btn go small grow" data-action="accept-prop" data-id="${p.id}">Aceitar</button></div></article>`;
  }

  /* ======================================================================
     Pagamento (simulado)
     ====================================================================== */
  let payMethod = 'pix';
  Views['c.pagar'] = {
    async render(ctx) {
      const r = await Svc.Requests.get(ctx.params.id);
      const back = '/c/servico/' + ctx.params.id;
      if (!r || r.clientId !== ctx.user.id) return `<section class="screen">${UI.header({ title: 'Pagamento', back: '/c/servicos' })}<div class="scroll">${UI.empty('wallet', 'Serviço não encontrado')}</div></section>`;
      const prov = await DB.users.get(r.providerId);
      if (r.status === 'concluido' && r.payment) {
        const p = r.payment;
        return `<section class="screen">${UI.header({ title: 'Pagamento', back })}<div class="scroll"><div class="success"><div class="success-ic">${icon('check', 40)}</div><h2>Pagamento confirmado</h2><p class="muted">${esc(r.title)}${prov ? ' · ' + esc(prov.name) : ''}</p>
          <div class="card receipt"><div class="row between"><span>Valor do serviço</span><b>${U.money(p.amount)}</b></div>${p.discount ? `<div class="row between ok"><span>Desconto do primeiro serviço (15%)</span><b>−${U.money(p.discount)}</b></div>` : ''}<div class="row between total"><span>Total pago</span><b>${U.money(p.total)}</b></div>
          <small class="muted">${p.method === 'pix' ? 'Pix' : 'Cartão' + (p.last4 ? ' final ' + p.last4 : '')} · pagamento simulado</small></div>
          ${r.review ? '' : `<a class="btn go lg block" href="#/c/avaliar/${r.id}">Avaliar profissional</a>`}<a class="btn outline block" href="#/c/inicio">Voltar ao início</a></div></div></section>`;
      }
      if (r.status !== 'aguardando_pagamento') return `<section class="screen">${UI.header({ title: 'Pagamento', back })}<div class="scroll">${UI.empty('wallet', 'Ainda não há nada para pagar', 'O pagamento é liberado quando o profissional conclui o serviço.', `<a class="btn primary" href="#${back}">Ver serviço</a>`)}</div></section>`;
      const q = await Svc.Jobs.quote(r, ctx.user, payMethod);
      const code = '00020126580014BR.GOV.BCB.PIX0136' + U.hashNum(r.id).toString(16).padStart(8, '0') + '-sa00-4e1b-9c3d-' + U.hashNum(r.id + 'x').toString(16).padStart(12, '0') + '5204000053039865406' + String(Math.round(q.total * 100)).padStart(6, '0') + '5802BR5913SERVICEAPROXIMA6008BRASILIA62070503***6304SIMU';
      return `<section class="screen">${UI.header({ title: 'Pagamento', back })}<div class="scroll"><form class="pad" data-submit="pay" novalidate>
        <div class="card"><div class="row gap center-y">${UI.avatar(prov, 44)}<span class="grow"><b>${esc(r.title)}</b><br><small class="muted">${prov ? esc(prov.name) : ''}</small></span></div></div>
        <div class="note warn">${icon('shield', 18)}<span><b>Pagamento simulado.</b> Nenhuma cobrança real é feita e o número do cartão não é guardado.</span></div>
        <h3 class="section-h">Forma de pagamento</h3>
        <div class="seg" role="radiogroup" aria-label="Forma de pagamento">
          <label class="${payMethod === 'pix' ? 'on' : ''}"><input type="radio" name="method" value="pix" ${payMethod === 'pix' ? 'checked' : ''} data-change="method" />${icon('pix', 20)} Pix</label>
          <label class="${payMethod === 'cartao' ? 'on' : ''}"><input type="radio" name="method" value="cartao" ${payMethod === 'cartao' ? 'checked' : ''} data-change="method" />${icon('card', 20)} Cartão</label></div>
        <div id="panePix" ${payMethod === 'pix' ? '' : 'hidden'}><p class="muted">Copie o código e cole no app do seu banco. Aqui, basta confirmar abaixo.</p>
          <div class="pixcode"><code id="pixCode">${code}</code><button type="button" class="btn outline small" data-action="copy-pix">${icon('copy', 16)} Copiar código</button></div></div>
        <div id="paneCard" ${payMethod === 'cartao' ? '' : 'hidden'}>
          ${UI.field({ label: 'Número do cartão', name: 'number', mask: 'card', inputmode: 'numeric', autocomplete: 'cc-number', placeholder: '0000 0000 0000 0000' })}
          ${UI.field({ label: 'Nome impresso no cartão', name: 'cname', autocomplete: 'cc-name', placeholder: 'Como está no cartão' })}
          <div class="grid-2">${UI.field({ label: 'Validade', name: 'exp', mask: 'exp', inputmode: 'numeric', autocomplete: 'cc-exp', placeholder: 'MM/AA' })}${UI.field({ label: 'CVV', name: 'cvv', inputmode: 'numeric', maxlength: 4, autocomplete: 'cc-csc', placeholder: '000' })}</div>
          <small class="hint">Para testar: 4242 4242 4242 4242, qualquer nome, validade futura e CVV 123.</small></div>
        <div class="card receipt"><div class="row between"><span>Valor do serviço</span><b>${U.money(q.amount)}</b></div>
          ${q.canDiscount ? `<div class="row between ok"><span>Desconto do primeiro serviço (15%)</span><b>−${U.money(U.round2(q.amount * CFG.FIRST_SERVICE_DISCOUNT))}</b></div>` : ''}
          <div class="row between total"><span>Total</span><b>${U.money(q.canDiscount ? U.round2(q.amount * (1 - CFG.FIRST_SERVICE_DISCOUNT)) : q.amount)}</b></div></div>
        <div class="form-error" role="alert" hidden></div>
        <button class="btn go lg block" type="submit">Confirmar pagamento</button></form></div></section>`;
    },
    changes: {
      method(el) {
        payMethod = el.value;
        document.getElementById('panePix').hidden = payMethod !== 'pix';
        document.getElementById('paneCard').hidden = payMethod !== 'cartao';
        document.querySelectorAll('.seg label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      }
    },
    actions: {
      async 'copy-pix'() {
        const t = document.getElementById('pixCode').textContent;
        try { await navigator.clipboard.writeText(t); UI.toast('Código copiado.', 'success'); } catch (e) { UI.toast('Não foi possível copiar. Selecione o texto e copie à mão.', 'error'); }
      }
    },
    submits: {
      async pay(form, ev, ctx) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const d = UI.formData(form);
        UI.busy(btn, true, 'Processando...');
        try {
          await Svc.Jobs.pay(ctx.params.id, ctx.user.id, { method: d.method, card: { number: d.number, name: d.cname, exp: d.exp, cvv: d.cvv } });
          payMethod = 'pix';
          g.App.rerender({ top: true });
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); err.scrollIntoView({ block: 'center' }); }
      }
    }
  };

  /* ======================================================================
     Avaliação
     ====================================================================== */
  Views['c.avaliar'] = {
    async render(ctx) {
      const r = await Svc.Requests.get(ctx.params.id);
      const back = '/c/servico/' + ctx.params.id;
      if (!r || r.clientId !== ctx.user.id) return `<section class="screen">${UI.header({ title: 'Avaliar', back: '/c/servicos' })}<div class="scroll">${UI.empty('star', 'Serviço não encontrado')}</div></section>`;
      if (r.status !== 'concluido' || r.review) return `<section class="screen">${UI.header({ title: 'Avaliar', back })}<div class="scroll">${UI.empty('star', r.review ? 'Você já avaliou este serviço' : 'A avaliação abre depois do pagamento', '', `<a class="btn primary" href="#${back}">Ver serviço</a>`)}</div></section>`;
      const prov = await DB.users.get(r.providerId);
      return `<section class="screen">${UI.header({ title: 'Avaliar profissional', back })}<div class="scroll"><form class="pad center-form" data-submit="review" novalidate>
        ${UI.avatar(prov, 72)}<h2>Como foi com ${esc(prov ? U.firstName(prov.name) : 'o profissional')}?</h2><p class="muted">${esc(r.title)}</p>
        ${UI.starPicker('rating', 0)}
        <div class="chips center" role="group" aria-label="O que se destacou">${CFG.RATING_TAGS.map((t) => `<label class="chip-check"><input type="checkbox" name="tag" value="${esc(t)}" /><span>${esc(t)}</span></label>`).join('')}</div>
        ${UI.field({ label: 'Comentário (opcional)', name: 'comment', type: 'textarea', maxlength: 500, placeholder: 'Conte como foi a experiência para ajudar outros clientes.' })}
        <div class="form-error" role="alert" hidden></div>
        <button class="btn go lg block" type="submit">Enviar avaliação</button></form></div></section>`;
    },
    changes: {
      rating(el) { document.querySelectorAll('.star-picker label').forEach((l) => l.classList.toggle('on', Number(l.querySelector('input').value) <= Number(el.value))); }
    },
    submits: {
      async review(form, ev, ctx) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const fd = new FormData(form);
        UI.busy(btn, true, 'Enviando...');
        try {
          await Svc.Jobs.review(ctx.params.id, ctx.user.id, { rating: fd.get('rating'), comment: fd.get('comment'), tags: fd.getAll('tag') });
          UI.toast('Obrigado pela avaliação!', 'success');
          g.App.go('/c/servico/' + ctx.params.id);
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); }
      }
    }
  };
})(window);
