/* ==========================================================================
   views-comum.js — conversas, chat, notificações e perfil (cliente e prestador)
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, UI, Svc, CFG, DB } = g;
  const esc = U.esc, icon = U.icon;
  const Views = (g.Views = g.Views || {});
  const Common = (g.Common = g.Common || {});
  const baseOf = (u) => (u.role === 'prestador' ? 'p' : 'c');

  /* ======================================================================
     Lista de conversas
     ====================================================================== */
  const messagesView = (role) => ({
    nav: role === 'cliente' ? 'mensagens' : undefined, live: true,
    async render(ctx) {
      const b = baseOf(ctx.user);
      const threads = await Svc.Chat.threads(ctx.user);
      return `<section class="screen ${role === 'prestador' ? 'pro' : ''}">${UI.header({ title: 'Conversas', back: role === 'prestador' ? '/p/painel' : null, right: UI.bellButton(ctx.badges.bell, b) })}
        <div class="scroll">${threads.length ? `<div class="stack">${threads.map((t) => `<a class="thread ${t.unread ? 'unread' : ''}" href="#/${b}/chat/${t.requestId}/${t.providerId}">
          ${UI.avatar(t.other, 48)}<span class="grow"><b>${esc(t.other ? t.other.name : 'Usuário removido')}</b><small class="muted">${esc(t.request.title)}</small>
          <span class="preview">${t.last.type === 'proposal' ? 'Proposta enviada' : esc(t.last.text)}</span></span>
          <span class="thread-side"><small>${U.fmtRel(t.last.createdAt)}</small>${t.unread ? `<i class="count">${t.unread}</i>` : ''}</span></a>`).join('')}</div>`
          : UI.empty('chat', 'Nenhuma conversa ainda', role === 'cliente' ? 'Ao pedir um serviço, as conversas com os profissionais aparecem aqui.' : 'Quando você falar com um cliente, a conversa aparece aqui.')}
        <div class="spacer"></div></div></section>`;
    }
  });
  Views['c.mensagens'] = messagesView('cliente');
  Views['p.mensagens'] = messagesView('prestador');

  /* ======================================================================
     Chat (só texto)
     ====================================================================== */
  const msgHtml = (m, ctx, props, request) => {
    if (m.type === 'system') return `<div class="msg-sys"><span>${esc(m.text)}</span></div>`;
    const mine = m.from === ctx.user.id;
    if (m.type === 'proposal') {
      const p = props.get(m.proposalId);
      if (!p) return '';
      const canAnswer = ctx.user.role === 'cliente' && p.status === 'enviada' && request.status === 'aberta';
      const label = { enviada: 'Aguardando resposta', aceita: 'Aceita', recusada: 'Recusada', substituida: 'Substituída por outra proposta', encerrada: 'Encerrada' }[p.status] || p.status;
      return `<div class="msg ${mine ? 'me' : ''}"><div class="bubble proposal-b"><div class="row between center-y"><b>Proposta de serviço</b><b class="price">${U.money(p.value)}</b></div>
        <ul class="facts"><li>${icon('calendar', 14)} ${U.fmtDate(p.date)} às ${p.time}</li><li>${icon('clock', 14)} ${p.durationH} ${U.plural(p.durationH, 'hora', 'horas')}${p.materialIncluded ? ' · material incluso' : ''}</li></ul>
        ${p.conditions ? `<p class="small">${esc(p.conditions)}</p>` : ''}
        ${canAnswer ? `<div class="row gap"><button class="btn ghost small" data-action="chat-reject" data-id="${p.id}">Recusar</button><button class="btn go small grow" data-action="chat-accept" data-id="${p.id}">Aceitar</button></div>` : UI.pill(label, { aceita: 'green', recusada: 'red', enviada: 'amber' }[p.status] || 'grey')}
        <time>${U.fmtTime(m.createdAt)}</time></div></div>`;
    }
    return `<div class="msg ${mine ? 'me' : ''}"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}<time>${U.fmtTime(m.createdAt)}</time></div></div>`;
  };

  const loadThread = async (ctx) => {
    const request = await Svc.Requests.get(ctx.params.req);
    const proId = ctx.params.pro;
    if (!request) return null;
    const ok = ctx.user.role === 'cliente' ? request.clientId === ctx.user.id : proId === ctx.user.id;
    if (!ok) return null;
    const other = await DB.users.get(ctx.user.role === 'cliente' ? proId : request.clientId);
    const [msgs, props] = await Promise.all([Svc.Chat.messages(request.id, proId), DB.proposals.where((p) => p.requestId === request.id && p.providerId === proId)]);
    return { request, proId, other, msgs, props: new Map(props.map((p) => [p.id, p])) };
  };
  const listHtml = (t, ctx) => t.msgs.length ? t.msgs.map((m) => msgHtml(m, ctx, t.props, t.request)).join('')
    : `<div class="chat-empty">${icon('chat', 28)}<p>Nenhuma mensagem ainda. Diga olá${ctx.user.role === 'cliente' ? ' e conte mais detalhes do serviço' : ' e tire as dúvidas antes de enviar a proposta'}.</p></div>`;

  const chatView = {
    live: true,
    async render(ctx) {
      const t = await loadThread(ctx);
      const b = baseOf(ctx.user);
      if (!t) return `<section class="screen ${b === 'p' ? 'pro' : ''}">${UI.header({ title: 'Conversa', back: `/${b}/mensagens` })}<div class="scroll">${UI.empty('chat', 'Conversa não encontrada')}</div></section>`;
      const r = t.request;
      const locked = r.status === 'cancelado' ? 'Este serviço foi cancelado.' : (r.providerId && r.providerId !== t.proId ? 'Este pedido foi fechado com outro profissional.' : '');
      const canPropose = ctx.user.role === 'prestador' && r.status === 'aberta';
      return `<section class="screen chat ${b === 'p' ? 'pro' : ''}">
        ${UI.header({ title: t.other ? t.other.name : 'Usuário removido', sub: r.title, back: `/${b}/mensagens`, right: `<a class="icon-btn tint" href="#/${b}/${b === 'c' ? 'servico' : (r.providerId === ctx.user.id ? 'servico' : 'pedido')}/${r.id}" aria-label="Ver pedido">${icon('clipboard', 20)}</a>` })}
        ${canPropose ? `<div class="chat-bar"><span>${icon('wallet', 16)} Pedido de ${esc(U.money(r.budget || 0)).replace('R$ 0,00', 'valor a combinar')}</span><button class="btn go small" data-action="chat-propose">Enviar proposta</button></div>` : ''}
        <div class="scroll chat-list" id="chatList" aria-live="polite">${listHtml(t, ctx)}</div>
        ${locked ? `<div class="chat-locked">${icon('lock', 16)} ${esc(locked)}</div>` : `<form class="composer" data-submit="chat-send"><textarea name="text" rows="1" placeholder="Escreva uma mensagem" aria-label="Mensagem" maxlength="2000" data-input="grow"></textarea><button class="btn go icon-only" type="submit" aria-label="Enviar">${icon('send', 20)}</button></form>`}
      </section>`;
    },
    async mount(ctx, root) {
      const list = root.querySelector('#chatList');
      if (list) list.scrollTop = list.scrollHeight;
      try { await Svc.Chat.markRead(ctx.params.req, ctx.params.pro, ctx.user.id); } catch (e) { /* ignora */ }
      g.App.refreshBadges();
    },
    // atualiza só a lista de mensagens (não perde o texto digitado)
    async refresh(ctx, root) {
      const t = await loadThread(ctx);
      const list = root.querySelector('#chatList');
      if (!t || !list) return g.App.rerender();
      const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      const sig = t.msgs.length + ':' + t.msgs.map((m) => m.id).join('') + Array.from(t.props.values()).map((p) => p.status).join('');
      if (list.dataset.sig === sig) return;
      list.dataset.sig = sig;
      list.innerHTML = listHtml(t, ctx);
      if (atBottom) list.scrollTop = list.scrollHeight;
      await Svc.Chat.markRead(ctx.params.req, ctx.params.pro, ctx.user.id);
      g.App.refreshBadges();
    },
    inputs: {
      grow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 110) + 'px'; }
    },
    keydowns: {
      grow(el, ev) { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); el.form.requestSubmit(); } }
    },
    submits: {
      async 'chat-send'(form, ev, ctx) {
        const ta = form.elements.text;
        const text = ta.value.trim();
        if (!text) return;
        ta.value = ''; ta.style.height = 'auto';
        try {
          await Svc.Chat.send({ requestId: ctx.params.req, providerId: ctx.params.pro, fromId: ctx.user.id, type: 'text', text });
          await chatView.refresh(ctx, document.getElementById('app'));
          const list = document.getElementById('chatList'); if (list) list.scrollTop = list.scrollHeight;
        } catch (e) { ta.value = text; UI.error(e); }
      }
    },
    actions: {
      'chat-propose'(btn, ev, ctx) { Common.proposalSheet(ctx.params.req, ctx.user, () => g.App.rerender()); },
      async 'chat-accept'(btn, ev, ctx) {
        try { await Svc.Proposals.respond(btn.dataset.id, true, ctx.user.id); UI.toast('Proposta aceita! Serviço agendado.', 'success'); g.App.go('/c/servico/' + ctx.params.req); }
        catch (e) { UI.error(e); g.App.rerender(); }
      },
      async 'chat-reject'(btn, ev, ctx) {
        if (!(await UI.confirm({ title: 'Recusar proposta?', message: 'O profissional será avisado.', confirmText: 'Recusar', danger: true }))) return;
        try { await Svc.Proposals.respond(btn.dataset.id, false, ctx.user.id); g.App.rerender(); } catch (e) { UI.error(e); }
      }
    }
  };
  Views['c.chat'] = chatView;
  Views['p.chat'] = chatView;

  /* ======================================================================
     Notificações
     ====================================================================== */
  const notifView = (role) => ({
    live: true,
    async render(ctx) {
      const list = await Svc.Notifs.list(ctx.user.id);
      const b = baseOf(ctx.user);
      return `<section class="screen ${role === 'prestador' ? 'pro' : ''}">${UI.header({ title: 'Notificações', back: true, right: list.some((n) => !n.read) ? '<button class="link" data-action="notif-all">Marcar como lidas</button>' : '' })}
        <div class="scroll">${list.length ? `<div class="stack">${list.map((n) => `<button class="notif ${n.read ? '' : 'unread'}" data-action="notif-open" data-id="${n.id}" data-to="${esc(n.link || '')}"><span class="notif-ic">${icon('bell', 18)}</span><span class="grow"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span><time>${U.fmtRel(n.createdAt)}</time></button>`).join('')}</div>`
          : UI.empty('bell', 'Sem notificações', 'Avisos sobre propostas, serviços e pagamentos aparecem aqui.')}<div class="spacer"></div></div></section>`;
    },
    actions: {
      async 'notif-open'(btn) { await Svc.Notifs.markRead(btn.dataset.id); g.App.refreshBadges(); if (btn.dataset.to) g.App.go(btn.dataset.to); else g.App.rerender(); },
      async 'notif-all'(btn, ev, ctx) { await Svc.Notifs.markAllRead(ctx.user.id); g.App.refreshBadges(); g.App.rerender(); }
    }
  });
  Views['c.notificacoes'] = notifView('cliente');
  Views['p.notificacoes'] = notifView('prestador');

  /* ======================================================================
     Perfil
     ====================================================================== */
  const profileView = (role) => ({
    nav: role === 'prestador' ? 'perfil' : undefined,
    async render(ctx) {
      const u = ctx.user, p = u.pro, isPro = role === 'prestador';
      const other = isPro ? 'cliente' : 'prestador';
      const stats = isPro ? await Svc.Providers.stats(u) : null;
      return `<section class="screen ${isPro ? 'pro' : ''}">${UI.header({ title: 'Meu perfil', back: isPro ? null : true, right: UI.bellButton(ctx.badges.bell, baseOf(u)) })}
        <div class="scroll">
          <div class="profile-top">${UI.avatar(u, 84)}<h2>${esc(u.name)}</h2><p class="muted">${esc(u.email)}</p>
            ${isPro ? `<div class="row gap wrap center">${UI.rating(stats.rating, stats.count)}${UI.pill({ verificado: 'Identidade verificada', pendente: 'Verificação pendente', em_analise: 'Verificação em análise' }[p.verified] || 'Verificação pendente', p.verified === 'verificado' ? 'green' : 'amber')}</div>` : ''}</div>
          <form class="pad" data-submit="save-profile" novalidate>
            <h3 class="section-h">Dados pessoais</h3>
            ${UI.field({ label: 'Nome completo', name: 'name', value: u.name, autocomplete: 'name', required: true })}
            ${UI.field({ label: 'Telefone', name: 'phone', type: 'tel', value: u.phone, mask: 'phone', inputmode: 'tel', required: true })}
            <h3 class="section-h">${isPro ? 'Endereço de atendimento' : 'Meu endereço'}</h3>
            ${Common.addressFields(u.address)}
            ${isPro ? `<h3 class="section-h">Perfil profissional</h3>
              <div class="chips" role="group" aria-label="Serviços prestados">${CFG.CATEGORIES.map((c) => `<label class="chip-check"><input type="checkbox" name="cat" value="${c.id}" ${p.categories.includes(c.id) ? 'checked' : ''} /><span>${icon(c.icon, 16)} ${esc(c.name)}</span></label>`).join('')}</div>
              ${UI.field({ label: 'Como você se apresenta?', name: 'headline', value: p.headline, maxlength: 60 })}
              ${UI.field({ label: 'Sobre você', name: 'bio', type: 'textarea', value: p.bio, maxlength: 400, placeholder: 'Conte sua experiência e como trabalha.' })}
              <div class="grid-2">${UI.field({ label: 'Anos de experiência', name: 'years', type: 'number', value: p.years, min: 0, max: 60, inputmode: 'numeric' })}${UI.field({ label: 'Nome artístico / empresa', name: 'businessName', value: p.businessName })}</div>
              ${UI.field({ label: 'Redes sociais / portfólio', name: 'social', value: p.social, placeholder: 'instagram.com/seuperfil' })}
              <div class="field"><label for="f_radius">Raio de atendimento: <b id="radiusOut">${p.radiusKm} km</b></label><input id="f_radius" name="radiusKm" type="range" min="5" max="100" step="5" value="${p.radiusKm}" data-input="radius" /></div>
              <h3 class="section-h">Disponibilidade</h3>
              <p class="muted small">Dias e horários que os clientes podem escolher no seu perfil.</p>
              <div class="chips" role="group" aria-label="Dias de atendimento">${CFG.WEEKDAYS.map((w, i) => `<label class="chip-check"><input type="checkbox" name="day" value="${i}" ${p.availability.days.includes(i) ? 'checked' : ''} /><span>${w}</span></label>`).join('')}</div>
              <div class="chips" role="group" aria-label="Horários de início">${Array.from({ length: 13 }, (_, i) => 7 + i).map((h) => `<label class="chip-check"><input type="checkbox" name="hour" value="${h}" ${p.availability.hours.includes(h) ? 'checked' : ''} /><span>${String(h).padStart(2, '0')}:00</span></label>`).join('')}</div>` : ''}
            <div class="form-error" role="alert" hidden></div>
            <button class="btn ${isPro ? 'indigo' : 'primary'} lg block" type="submit">Salvar alterações</button>
          </form>
          <div class="pad">
            <h3 class="section-h">Modo demonstração</h3>
            <label class="toggle-row"><span><b>Profissionais de exemplo respondem sozinhos</b><small>Mandam mensagem e proposta poucos segundos depois do seu pedido.</small></span><input type="checkbox" data-change="sim" ${u.settings.simulate !== false ? 'checked' : ''} role="switch" /></label>
            <button class="btn outline block" data-action="switch-role" data-role="${other}">${icon('refresh', 18)} Alternar para o ambiente ${other === 'prestador' ? 'do prestador' : 'do cliente'} (conta demo)</button>
            <button class="btn ghost block" data-action="reset-demo">Restaurar dados de demonstração</button>
            <button class="btn danger-outline block" data-action="logout">${icon('logout', 18)} Sair da conta</button>
            <p class="fine center">${CFG.APP_NAME} · protótipo · dados salvos só neste navegador</p>
          </div></div></section>`;
    },
    inputs: { cep(el) { Common.cepLookup(el); }, radius(el) { const o = document.getElementById('radiusOut'); if (o) o.textContent = el.value + ' km'; } },
    changes: {
      async sim(el, ev, ctx) { try { await Svc.Auth.update(ctx.user.id, { settings: { simulate: el.checked } }); UI.toast(el.checked ? 'Respostas automáticas ligadas.' : 'Respostas automáticas desligadas.'); } catch (e) { UI.error(e); } }
    },
    submits: {
      async 'save-profile'(form, ev, ctx) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const d = UI.formData(form), fd = new FormData(form);
        try {
          if (d.name.trim().split(/\s+/).length < 2) throw new Error('Informe nome e sobrenome.');
          if (!U.validPhone(d.phone)) throw new Error('Informe um telefone com DDD.');
          const address = Common.readAddress(d);
          const patch = { name: d.name.trim(), phone: d.phone, address };
          if (ctx.user.role === 'prestador') {
            const cats = fd.getAll('cat'), days = fd.getAll('day').map(Number), hours = fd.getAll('hour').map(Number);
            if (!cats.length) throw new Error('Escolha ao menos um serviço que você presta.');
            if (!days.length || !hours.length) throw new Error('Marque ao menos um dia e um horário de atendimento.');
            if (!address.bairro || !address.cidade) throw new Error('Informe bairro e cidade do seu atendimento.');
            const years = Number(d.years);
            if (!(years >= 0 && years <= 60)) throw new Error('Anos de experiência deve estar entre 0 e 60.');
            patch.pro = { categories: cats, headline: d.headline.trim() || CFG.cat(cats[0]).name, bio: d.bio.trim(), years, businessName: d.businessName.trim(), social: d.social.trim(), radiusKm: Number(d.radiusKm), availability: { days, hours: hours.sort((a, b) => a - b) } };
          }
          UI.busy(btn, true, 'Salvando...');
          await Svc.Auth.update(ctx.user.id, patch);
          UI.toast('Perfil atualizado.', 'success');
          g.App.rerender();
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); err.scrollIntoView({ block: 'center' }); }
      }
    },
    actions: {
      async logout() { await Svc.Auth.logout(); g.App.go('/'); },
      async 'reset-demo'() {
        if (!(await UI.confirm({ title: 'Restaurar demonstração?', message: 'Isso apaga tudo o que foi criado neste navegador (contas, pedidos, conversas) e recria os dados de exemplo.', confirmText: 'Restaurar', danger: true }))) return;
        await g.App.resetDemo();
      }
    }
  });
  Views['c.perfil'] = profileView('cliente');
  Views['p.perfil'] = profileView('prestador');
})(window);
