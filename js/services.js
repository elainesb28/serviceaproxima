/* ==========================================================================
   services.js — REGRAS DE NEGÓCIO
   --------------------------------------------------------------------------
   As telas só conversam com `Svc`. `Svc` só conversa com `DB` (storage.js).
   Se um dia existir um backend, esta camada vira chamadas à API.
   Todas as funções são assíncronas e lançam Error com mensagem em português
   (as telas mostram `e.message` direto ao usuário).
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, DB, CFG } = g;

  /* ---------- eventos internos (a simulação "escuta" por aqui) ---------- */
  const handlers = {};
  const Svc = {
    on(evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); },
    emit(evt, payload) { (handlers[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } }); }
  };
  const fail = (msg) => { throw new Error(msg); };

  /* ======================================================================
     Sessão e contas
     ====================================================================== */
  const Auth = {
    async current() {
      const id = await DB.kv.get('session', null);
      if (!id) return null;
      const u = await DB.users.get(id);
      if (!u) await DB.kv.remove('session');
      return u || null;
    },
    async register(data) {
      const email = String(data.email || '').trim().toLowerCase();
      const role = data.role === 'prestador' ? 'prestador' : 'cliente';
      if (String(data.name || '').trim().split(/\s+/).length < 2) fail('Informe nome e sobrenome.');
      if (!U.validEmail(email)) fail('Informe um e-mail válido.');
      if (!U.validPhone(data.phone)) fail('Informe um telefone com DDD.');
      if (String(data.password || '').length < 6) fail('A senha precisa ter pelo menos 6 caracteres.');
      if (await DB.users.find((u) => u.email === email)) fail('Já existe uma conta com este e-mail. Tente entrar.');
      const user = {
        role, name: data.name.trim(), email, phone: data.phone, passHash: await U.pwHash(email, data.password), avatar: null,
        address: data.address || { cep: '', rua: '', bairro: '', cidade: '', uf: '', coords: null },
        settings: { simulate: true }, firstDiscountUsed: false
      };
      if (role === 'prestador') {
        const p = data.pro || {};
        if (!U.validCPF(p.cpf)) fail('CPF inválido.');
        if (!U.validBirth(p.birth)) fail('Informe a data de nascimento no formato DD/MM/AAAA (maiores de 18 anos).');
        if (!p.categories || !p.categories.length) fail('Escolha ao menos um serviço que você presta.');
        user.pro = {
          headline: p.headline || CFG.cat(p.categories[0]).name, bio: p.bio || '', years: Number(p.years) || 0, categories: p.categories,
          radiusKm: Number(p.radiusKm) || CFG.DEFAULT_RADIUS_KM, businessName: p.businessName || '', social: p.social || '', online: true,
          availability: JSON.parse(JSON.stringify(CFG.DEFAULT_AVAILABILITY)), portfolio: [],
          verified: 'pendente', responseMin: 30, ratingBase: { avg: 0, count: 0 }, jobsBase: 0,
          cpf: U.digits(p.cpf), birth: p.birth
        };
      }
      const row = await DB.users.insert(user);
      await DB.kv.set('session', row.id);
      await Notifs.push(row.id, 'Conta criada', role === 'prestador' ? 'Complete seu perfil e fique online para receber pedidos.' : 'Peça seu primeiro serviço e ganhe 15% de desconto.', role === 'prestador' ? '/p/perfil' : '/c/novo');
      return row;
    },
    async login(email, password) {
      const e = String(email || '').trim().toLowerCase();
      if (!e || !password) fail('Informe e-mail e senha.');
      const u = await DB.users.find((x) => x.email === e);
      if (!u || !u.passHash || u.passHash !== (await U.pwHash(e, password))) fail('E-mail ou senha incorretos.');
      await DB.kv.set('session', u.id);
      return u;
    },
    async loginDemo(role) { return this.login(role === 'prestador' ? 'marcia@demo.com' : 'ana@demo.com', g.Seed.DEMO_PASSWORD); },
    async logout() { await DB.kv.remove('session'); },
    async update(userId, patch) {
      return DB.users.update(userId, (u) => {
        const next = Object.assign({}, patch);
        if (patch.pro) next.pro = Object.assign({}, u.pro, patch.pro);
        if (patch.settings) next.settings = Object.assign({}, u.settings, patch.settings);
        if (patch.address) next.address = Object.assign({}, u.address, patch.address);
        return next;
      });
    },
    async changePassword(user, oldPw, newPw) {
      if (!user.passHash || user.passHash !== (await U.pwHash(user.email, oldPw))) fail('Senha atual incorreta.');
      if (String(newPw || '').length < 6) fail('A nova senha precisa ter pelo menos 6 caracteres.');
      return DB.users.update(user.id, { passHash: await U.pwHash(user.email, newPw) });
    },
    async deleteAccount(userId) {
      const u = await DB.users.get(userId);
      if (!u) return;
      if (u.role === 'cliente') {
        const mine = await DB.requests.where((r) => r.clientId === userId);
        const ids = new Set(mine.map((r) => r.id));
        await DB.requests.removeWhere((r) => r.clientId === userId);
        await DB.proposals.removeWhere((p) => ids.has(p.requestId));
        await DB.messages.removeWhere((m) => ids.has(m.requestId));
      } else {
        const open = await DB.requests.where((r) => r.providerId === userId && !['concluido', 'cancelado'].includes(r.status));
        for (const r of open) await Requests.cancel(r.id, userId, 'O profissional removeu a conta.');
        await DB.proposals.removeWhere((p) => p.providerId === userId);
      }
      await DB.notifications.removeWhere((n) => n.userId === userId);
      await DB.transactions.removeWhere((t) => t.userId === userId);
      await DB.users.remove(userId);
      await DB.kv.remove('session');
    }
  };

  /* ======================================================================
     Localização / distância (estimativa para demonstração)
     ====================================================================== */
  const Geo = {
    distanceKm(a, b) {
      if (!a || !b || !a.cidade || !b.cidade) return null;
      const ca = U.norm(a.cidade) + '/' + U.norm(a.uf), cb = U.norm(b.cidade) + '/' + U.norm(b.uf);
      const ba = U.norm(a.bairro), bb = U.norm(b.bairro);
      const key = [ca + ba, cb + bb].sort().join('|');
      const h = U.hashNum(key);
      if (ca !== cb) return 25 + (h % 350) / 10;
      if (!ba || !bb) return null;
      if (ba === bb) return 0.4 + (h % 15) / 10;
      return 2 + (h % 100) / 10;
    },
    formatAddress(a, full) {
      if (!a) return '';
      const parts = full ? [a.rua, a.bairro, a.cidade && a.uf ? a.cidade + ' - ' + a.uf : a.cidade] : [a.bairro, a.cidade && a.uf ? a.cidade + ' - ' + a.uf : a.cidade];
      return parts.filter(Boolean).join(', ');
    }
  };

  /* ======================================================================
     Notificações
     ====================================================================== */
  const Notifs = {
    push(userId, title, body, link, key) {
      return DB.notifications.insert({ userId, title, body, link: link || null, read: false, key: key || null });
    },
    // junta várias mensagens do mesmo chat numa única notificação não lida
    async pushCoalesced(userId, key, title, body, link) {
      const ex = await DB.notifications.find((n) => n.userId === userId && n.key === key && !n.read);
      if (ex) return DB.notifications.update(ex.id, { title, body, createdAt: Date.now() });
      return this.push(userId, title, body, link, key);
    },
    async list(userId) { return (await DB.notifications.where((n) => n.userId === userId)).sort((a, b) => b.createdAt - a.createdAt); },
    async unread(userId) { return (await DB.notifications.where((n) => n.userId === userId && !n.read)).length; },
    async markRead(id) { return DB.notifications.update(id, { read: true }); },
    async markAllRead(userId) {
      const list = await DB.notifications.where((n) => n.userId === userId && !n.read);
      for (const n of list) await DB.notifications.update(n.id, { read: true });
    }
  };

  /* ======================================================================
     Profissionais
     ====================================================================== */
  const Providers = {
    async reviews(proId) {
      const done = await DB.requests.where((r) => r.providerId === proId && r.review);
      const clients = await DB.users.all();
      return done.map((r) => {
        const c = clients.find((u) => u.id === r.clientId);
        return { requestId: r.id, rating: r.review.rating, comment: r.review.comment, tags: r.review.tags || [], at: r.review.at, title: r.title, clientName: c ? c.name : 'Cliente removido' };
      }).sort((a, b) => b.at - a.at);
    },
    async stats(pro, reqs) {
      const all = reqs || (await DB.requests.where((r) => r.providerId === pro.id));
      const reviewed = all.filter((r) => r.review);
      const base = (pro.pro && pro.pro.ratingBase) || { avg: 0, count: 0 };
      const count = base.count + reviewed.length;
      const sum = base.avg * base.count + reviewed.reduce((s, r) => s + r.review.rating, 0);
      const jobs = ((pro.pro && pro.pro.jobsBase) || 0) + all.filter((r) => r.status === 'concluido').length;
      return { rating: count ? sum / count : 0, count, jobs };
    },
    async get(id) {
      const u = await DB.users.get(id);
      return u && u.role === 'prestador' ? u : null;
    },
    async list() { return DB.users.where((u) => u.role === 'prestador'); },
    // busca com texto, categoria, local e ordenação
    async search({ q, category, place, client, sort }) {
      const reqs = await DB.requests.all();
      const nq = U.norm(q), np = U.norm(place);
      const out = [];
      for (const p of await this.list()) {
        if (category && !p.pro.categories.includes(category)) continue;
        if (np && !(U.norm(p.address.bairro).includes(np) || U.norm(p.address.cidade).includes(np))) continue;
        if (nq) {
          const hay = U.norm([p.name, p.pro.headline, p.pro.bio, p.pro.businessName, p.pro.categories.map((c) => CFG.cat(c).name).join(' ')].join(' '));
          if (!nq.split(/\s+/).every((w) => hay.includes(w))) continue;
        }
        const st = await this.stats(p, reqs.filter((r) => r.providerId === p.id));
        out.push({ pro: p, stats: st, km: client ? Geo.distanceKm(client.address, p.address) : null });
      }
      out.sort((a, b) => {
        if (a.pro.pro.online !== b.pro.pro.online) return a.pro.pro.online ? -1 : 1;
        if (sort === 'rating') return b.stats.rating - a.stats.rating || b.stats.count - a.stats.count;
        const ka = a.km == null ? 1e9 : a.km, kb = b.km == null ? 1e9 : b.km;
        return ka - kb || b.stats.rating - a.stats.rating;
      });
      return out;
    },
    // horários do dia para o cliente escolher
    async slots(proId, dateISO) {
      const p = await this.get(proId);
      if (!p) return [];
      const av = p.pro.availability || CFG.DEFAULT_AVAILABILITY;
      const dow = U.parseISO(dateISO).getDay();
      if (!av.days.includes(dow)) return [];
      const busy = new Set();
      (await DB.requests.where((r) => r.providerId === proId && ['agendado', 'em_andamento'].includes(r.status) && r.schedule && r.schedule.date === dateISO))
        .forEach((r) => { const h = Number(r.schedule.time.slice(0, 2)); for (let i = 0; i < Math.max(1, Math.ceil(r.schedule.durationH || 1)); i++) busy.add(h + i); });
      const nowH = new Date().getHours();
      const isToday = dateISO === U.todayISO();
      return av.hours.slice().sort((a, b) => a - b).map((h) => ({ time: String(h).padStart(2, '0') + ':00', ok: !busy.has(h) && !(isToday && h <= nowH) }));
    },
    async hasConflict(proId, date, time, durationH, ignoreReqId) {
      const start = Number(time.slice(0, 2)), len = Math.max(1, Math.ceil(durationH || 1));
      const list = await DB.requests.where((r) => r.providerId === proId && r.id !== ignoreReqId && ['agendado', 'em_andamento'].includes(r.status) && r.schedule && r.schedule.date === date);
      return list.some((r) => {
        const s = Number(r.schedule.time.slice(0, 2)), l = Math.max(1, Math.ceil(r.schedule.durationH || 1));
        return start < s + l && s < start + len;
      });
    },
    async nextFreeSlot(proId, fromDaysAhead) {
      for (let d = fromDaysAhead || 1; d <= 14; d++) {
        const date = U.addDays(U.todayISO(), d);
        const s = (await this.slots(proId, date)).find((x) => x.ok);
        if (s) return { date, time: s.time };
      }
      return null;
    }
  };

  /* ======================================================================
     Pedidos de serviço
     ====================================================================== */
  const Requests = {
    get: (id) => DB.requests.get(id),
    async forClient(clientId) { return (await DB.requests.where((r) => r.clientId === clientId)).sort((a, b) => b.createdAt - a.createdAt); },
    async forProvider(proId) { return (await DB.requests.where((r) => r.providerId === proId)).sort((a, b) => b.createdAt - a.createdAt); },
    // pedidos que o profissional ainda pode responder
    async openFor(pro) {
      const list = await DB.requests.where((r) => r.status === 'aberta' && !r.declinedBy.includes(pro.id) && (r.targetProviderId ? r.targetProviderId === pro.id : pro.pro.categories.includes(r.category)));
      const clients = await DB.users.all();
      const out = [];
      for (const r of list) {
        const c = clients.find((u) => u.id === r.clientId);
        const km = Geo.distanceKm(pro.address, r.location);
        if (!r.targetProviderId && km != null && km > (pro.pro.radiusKm || CFG.DEFAULT_RADIUS_KM)) continue;
        out.push({ req: r, client: c || null, km });
      }
      return out.sort((a, b) => b.req.createdAt - a.req.createdAt);
    },
    async create(client, data) {
      const title = String(data.title || '').trim();
      const description = String(data.description || '').trim();
      if (!data.category) fail('Escolha a categoria do serviço.');
      if (title.length < 4) fail('Dê um título curto para o pedido (mín. 4 letras).');
      if (description.length < 10) fail('Descreva o problema com um pouco mais de detalhe (mín. 10 letras).');
      const loc = data.location || {};
      if (!loc.bairro || !loc.cidade || !loc.uf) fail('Informe onde o serviço será feito (bairro, cidade e UF).');
      let budget = data.budget == null || data.budget === '' ? null : Number(data.budget);
      if (budget != null && (!Number.isFinite(budget) || budget <= 0)) fail('O orçamento estimado precisa ser maior que zero.');
      if (data.preferred && data.preferred.date && data.preferred.date < U.todayISO()) fail('A data desejada não pode ser no passado.');
      if (data.targetProviderId) {
        const p = await Providers.get(data.targetProviderId);
        if (!p) fail('Este profissional não está mais disponível.');
      }
      const req = await DB.requests.insert({
        clientId: client.id, category: data.category, title, description,
        location: loc, budget,
        preferred: data.preferred || { date: null, time: null }, targetProviderId: data.targetProviderId || null,
        status: 'aberta', providerId: null, proposalId: null, schedule: null, price: null, conditions: '', payment: null, review: null, declinedBy: [], cancel: null
      });
      // endereço do perfil: preenche se ainda estiver vazio
      if (!client.address || !client.address.bairro) await Auth.update(client.id, { address: loc });
      // avisa profissionais
      const targets = req.targetProviderId ? [await Providers.get(req.targetProviderId)] : (await Requests.candidates(req));
      for (const p of targets.filter(Boolean)) {
        await Notifs.push(p.id, req.targetProviderId ? 'Pedido enviado para você' : 'Novo pedido na sua região', `${U.firstName(client.name)} precisa de: ${req.title}.`, '/p/pedido/' + req.id);
      }
      Svc.emit('request:created', { request: req, client });
      return req;
    },
    // profissionais que receberiam um pedido aberto (categoria + raio + online)
    async candidates(req) {
      const out = [];
      for (const p of await Providers.list()) {
        if (!p.pro.online || !p.pro.categories.includes(req.category)) continue;
        const km = Geo.distanceKm(p.address, req.location);
        if (km != null && km > (p.pro.radiusKm || CFG.DEFAULT_RADIUS_KM)) continue;
        out.push(p);
      }
      return out;
    },
    async decline(reqId, proId) {
      const r = await DB.requests.get(reqId);
      if (!r || r.status !== 'aberta') fail('Este pedido não está mais aberto.');
      if (r.targetProviderId === proId) {
        await DB.requests.update(reqId, { status: 'cancelado', cancel: { by: proId, reason: 'O profissional não pôde atender este pedido.', at: Date.now() } });
        const p = await DB.users.get(proId);
        await Notifs.push(r.clientId, 'Pedido recusado', `${p ? p.name : 'O profissional'} não pôde atender "${r.title}". Você pode pedir a outro profissional.`, '/c/servico/' + r.id);
      } else {
        await DB.requests.update(reqId, (x) => ({ declinedBy: x.declinedBy.concat(proId) }));
      }
    },
    async cancel(reqId, byUserId, reason) {
      const r = await DB.requests.get(reqId);
      if (!r) fail('Pedido não encontrado.');
      if (['concluido', 'cancelado', 'aguardando_pagamento'].includes(r.status)) fail('Este serviço não pode mais ser cancelado.');
      const by = await DB.users.get(byUserId);
      const byClient = r.clientId === byUserId;
      await DB.requests.update(reqId, { status: 'cancelado', cancel: { by: byUserId, reason: reason || (byClient ? 'Cancelado pelo cliente.' : 'Cancelado pelo profissional.'), at: Date.now() } });
      const pend = await DB.proposals.where((p) => p.requestId === reqId && p.status === 'enviada');
      for (const p of pend) await DB.proposals.update(p.id, { status: 'encerrada' });
      const other = byClient ? r.providerId : r.clientId;
      if (other) await Notifs.push(other, 'Serviço cancelado', `${by ? by.name : 'A outra parte'} cancelou "${r.title}".`, (byClient ? '/p/servico/' : '/c/servico/') + r.id);
      if (r.providerId) await Chat.system(r.id, r.providerId, r.clientId, 'Este serviço foi cancelado.');
    }
  };

  /* ======================================================================
     Propostas
     ====================================================================== */
  const Proposals = {
    forRequest: async (reqId) => (await DB.proposals.where((p) => p.requestId === reqId)).sort((a, b) => b.createdAt - a.createdAt),
    async send({ requestId, providerId, value, date, time, durationH, conditions, materialIncluded }) {
      const r = await DB.requests.get(requestId);
      if (!r || r.status !== 'aberta') fail('Este pedido não está mais aberto para propostas.');
      if (r.targetProviderId && r.targetProviderId !== providerId) fail('Este pedido foi enviado a outro profissional.');
      const v = Number(value);
      if (!Number.isFinite(v) || v <= 0) fail('Informe um valor maior que zero.');
      if (v > 100000) fail('Valor muito alto. Confira o número digitado.');
      if (!date || !time) fail('Escolha a data e o horário do serviço.');
      if (date < U.todayISO()) fail('A data não pode ser no passado.');
      if (date === U.todayISO() && Number(time.slice(0, 2)) <= new Date().getHours()) fail('Esse horário de hoje já passou.');
      const dur = Math.max(1, Number(durationH) || 1);
      if (await Providers.hasConflict(providerId, date, time, dur)) fail('Você já tem um serviço agendado nesse horário.');
      // substitui proposta anterior ainda aberta do mesmo profissional
      await DB.proposals.where((p) => p.requestId === requestId && p.providerId === providerId && p.status === 'enviada')
        .then((olds) => Promise.all(olds.map((o) => DB.proposals.update(o.id, { status: 'substituida' }))));
      const prop = await DB.proposals.insert({
        requestId, providerId, clientId: r.clientId, value: U.round2(v), date, time, durationH: dur,
        conditions: String(conditions || '').trim(), materialIncluded: !!materialIncluded, status: 'enviada'
      });
      await Chat.send({ requestId, providerId, fromId: providerId, type: 'proposal', proposalId: prop.id });
      const p = await DB.users.get(providerId);
      await Notifs.push(r.clientId, 'Nova proposta recebida', `${p ? p.name : 'Um profissional'} propôs ${U.money(prop.value)} para "${r.title}".`, '/c/servico/' + requestId);
      return prop;
    },
    async respond(proposalId, accept, clientId) {
      const prop = await DB.proposals.get(proposalId);
      if (!prop) fail('Proposta não encontrada.');
      const r = await DB.requests.get(prop.requestId);
      if (!r || r.clientId !== clientId) fail('Você não pode responder a esta proposta.');
      if (r.status !== 'aberta' || prop.status !== 'enviada') fail('Esta proposta não está mais disponível.');
      if (!accept) {
        await DB.proposals.update(proposalId, { status: 'recusada' });
        await Chat.system(r.id, prop.providerId, r.clientId, 'O cliente recusou a proposta.');
        await Notifs.push(prop.providerId, 'Proposta recusada', `Sua proposta para "${r.title}" foi recusada.`, '/p/pedido/' + r.id);
        return prop;
      }
      if (await Providers.hasConflict(prop.providerId, prop.date, prop.time, prop.durationH)) fail('O profissional ficou sem esse horário. Peça uma nova proposta.');
      const others = await DB.proposals.where((p) => p.requestId === r.id && p.id !== prop.id && p.status === 'enviada');
      for (const o of others) {
        await DB.proposals.update(o.id, { status: 'recusada' });
        await Notifs.push(o.providerId, 'Pedido fechado', `O cliente escolheu outro profissional para "${r.title}".`, '/p/pedido/' + r.id);
      }
      await DB.proposals.update(proposalId, { status: 'aceita' });
      await DB.requests.update(r.id, {
        status: 'agendado', providerId: prop.providerId, proposalId: prop.id, price: prop.value, conditions: prop.conditions,
        schedule: { date: prop.date, time: prop.time, durationH: prop.durationH }
      });
      await Chat.system(r.id, prop.providerId, r.clientId, `Proposta aceita! Serviço agendado para ${U.fmtDate(prop.date)} às ${prop.time}.`);
      await Notifs.push(prop.providerId, 'Proposta aceita!', `"${r.title}" foi agendado para ${U.fmtDate(prop.date)} às ${prop.time}.`, '/p/servico/' + r.id);
      return prop;
    }
  };

  /* ======================================================================
     Andamento, pagamento e avaliação
     ====================================================================== */
  const Jobs = {
    async start(reqId, proId) {
      const r = await DB.requests.get(reqId);
      if (!r || r.providerId !== proId) fail('Serviço não encontrado.');
      if (r.status !== 'agendado') fail('Só é possível iniciar um serviço agendado.');
      await DB.requests.update(reqId, { status: 'em_andamento', startedAt: Date.now() });
      await Chat.system(reqId, proId, r.clientId, 'O profissional iniciou o serviço.');
      await Notifs.push(r.clientId, 'Serviço iniciado', `"${r.title}" está em andamento.`, '/c/servico/' + reqId);
    },
    async finish(reqId, proId) {
      const r = await DB.requests.get(reqId);
      if (!r || r.providerId !== proId) fail('Serviço não encontrado.');
      if (!['agendado', 'em_andamento'].includes(r.status)) fail('Este serviço não pode ser concluído agora.');
      await DB.requests.update(reqId, { status: 'aguardando_pagamento', finishedAt: Date.now() });
      await Chat.system(reqId, proId, r.clientId, 'Serviço concluído. Aguardando o pagamento.');
      await Notifs.push(r.clientId, 'Serviço concluído', `Pague "${r.title}" para finalizar e avaliar o profissional.`, '/c/pagar/' + reqId);
    },
    // valores que o cliente verá na tela de pagamento
    async quote(req, client, method) {
      const eligible = !client.firstDiscountUsed && (method === 'pix' || method === 'cartao');
      const discount = eligible ? U.round2(req.price * CFG.FIRST_SERVICE_DISCOUNT) : 0;
      return { amount: req.price, discount, total: U.round2(req.price - discount), eligible, canDiscount: !client.firstDiscountUsed };
    },
    // Pagamento SIMULADO: nenhum dado de cartão é guardado (só os 4 últimos dígitos).
    async pay(reqId, clientId, { method, card }) {
      const r = await DB.requests.get(reqId);
      const c = await DB.users.get(clientId);
      if (!r || r.clientId !== clientId || !c) fail('Serviço não encontrado.');
      if (r.status !== 'aguardando_pagamento') fail('Este serviço não está aguardando pagamento.');
      if (!['pix', 'cartao'].includes(method)) fail('Escolha a forma de pagamento.');
      let last4 = null;
      if (method === 'cartao') {
        if (!card || !U.luhn(card.number)) fail('Número do cartão inválido.');
        if (!/^\d{2}\/\d{2}$/.test(card.exp || '')) fail('Informe a validade como MM/AA.');
        const [mm, aa] = card.exp.split('/').map(Number);
        if (mm < 1 || mm > 12) fail('Mês de validade inválido.');
        const endOfMonth = new Date(2000 + aa, mm, 0, 23, 59, 59);
        if (endOfMonth < new Date()) fail('Cartão vencido.');
        if (!/^\d{3,4}$/.test(card.cvv || '')) fail('CVV inválido.');
        if (String(card.name || '').trim().length < 3) fail('Informe o nome impresso no cartão.');
        last4 = U.digits(card.number).slice(-4);
      }
      const q = await this.quote(r, c, method);
      const now = Date.now();
      await DB.requests.update(reqId, { status: 'concluido', completedAt: now, payment: { method, last4, amount: q.amount, discount: q.discount, total: q.total, status: 'pago', paidAt: now } });
      if (q.eligible) await DB.users.update(c.id, { firstDiscountUsed: true });
      // O desconto promocional é custeado pela plataforma: o profissional recebe o valor cheio (menos a taxa, se houver).
      const net = U.round2(q.amount * (1 - CFG.PLATFORM_FEE));
      await DB.transactions.insert({ userId: r.providerId, type: 'credito', amount: q.amount, net, requestId: reqId, description: r.title, status: 'concluido' });
      await Chat.system(reqId, r.providerId, r.clientId, 'Pagamento confirmado.');
      await Notifs.push(r.providerId, 'Pagamento recebido', `Você recebeu ${U.money(net)} por "${r.title}".`, '/p/ganhos');
      return Requests.get(reqId);
    },
    async review(reqId, clientId, { rating, comment, tags }) {
      const r = await DB.requests.get(reqId);
      if (!r || r.clientId !== clientId) fail('Serviço não encontrado.');
      if (r.status !== 'concluido') fail('Você só pode avaliar depois de concluir e pagar o serviço.');
      if (r.review) fail('Este serviço já foi avaliado.');
      const n = Number(rating);
      if (!(n >= 1 && n <= 5)) fail('Escolha de 1 a 5 estrelas.');
      await DB.requests.update(reqId, { review: { rating: n, comment: String(comment || '').trim().slice(0, 500), tags: tags || [], at: Date.now() } });
      const c = await DB.users.get(clientId);
      await Notifs.push(r.providerId, 'Nova avaliação', `${c ? U.firstName(c.name) : 'Um cliente'} deu ${n} ${U.plural(n, 'estrela', 'estrelas')} para "${r.title}".`, '/p/avaliacoes');
    }
  };

  /* ======================================================================
     Chat (um chat por pedido + profissional)
     ====================================================================== */
  const Chat = {
    async messages(reqId, proId) {
      return (await DB.messages.where((m) => m.requestId === reqId && m.providerId === proId)).sort((a, b) => a.createdAt - b.createdAt);
    },
    async send({ requestId, providerId, fromId, type, text, proposalId }) {
      const r = await DB.requests.get(requestId);
      if (!r) fail('Pedido não encontrado.');
      if (r.status === 'cancelado') fail('Este serviço foi cancelado.');
      if (r.providerId && r.providerId !== providerId) fail('Este pedido foi fechado com outro profissional.');
      if (type === 'text' && !String(text || '').trim()) fail('Digite uma mensagem.');
      const msg = await DB.messages.insert({
        requestId, providerId, clientId: r.clientId, from: fromId, type: type || 'text', text: String(text || '').trim().slice(0, 2000),
        proposalId: proposalId || null, readBy: [fromId]
      });
      const toId = fromId === r.clientId ? providerId : r.clientId;
      const sender = await DB.users.get(fromId);
      const prev = String(text || '').trim().slice(0, 80);
      const link = (fromId === r.clientId ? '/p/chat/' : '/c/chat/') + requestId + '/' + providerId;
      if (type !== 'proposal') await Notifs.pushCoalesced(toId, 'chat:' + requestId + ':' + providerId, `Mensagem de ${sender ? U.firstName(sender.name) : 'alguém'}`, prev, link);
      Svc.emit('chat:message', { message: msg, request: r, toId });
      return msg;
    },
    async system(requestId, providerId, clientId, text) {
      return DB.messages.insert({ requestId, providerId, clientId, from: 'sistema', type: 'system', text, readBy: [clientId, providerId] });
    },
    async markRead(requestId, providerId, userId) {
      const list = await DB.messages.where((m) => m.requestId === requestId && m.providerId === providerId && !m.readBy.includes(userId));
      for (const m of list) await DB.messages.update(m.id, { readBy: m.readBy.concat(userId) });
      const key = 'chat:' + requestId + ':' + providerId;
      const ns = await DB.notifications.where((n) => n.userId === userId && n.key === key && !n.read);
      for (const n of ns) await DB.notifications.update(n.id, { read: true });
    },
    // lista de conversas do usuário
    async threads(user) {
      const msgs = await DB.messages.where((m) => (user.role === 'cliente' ? m.clientId === user.id : m.providerId === user.id) && m.type !== 'system');
      const map = new Map();
      msgs.forEach((m) => {
        const k = m.requestId + '|' + m.providerId;
        const t = map.get(k) || { requestId: m.requestId, providerId: m.providerId, clientId: m.clientId, last: null, unread: 0 };
        if (!t.last || m.createdAt > t.last.createdAt) t.last = m;
        if (!m.readBy.includes(user.id)) t.unread++;
        map.set(k, t);
      });
      const users = await DB.users.all();
      const reqs = await DB.requests.all();
      return Array.from(map.values()).map((t) => ({
        ...t, request: reqs.find((r) => r.id === t.requestId) || null,
        other: users.find((u) => u.id === (user.role === 'cliente' ? t.providerId : t.clientId)) || null
      })).filter((t) => t.request).sort((a, b) => b.last.createdAt - a.last.createdAt);
    },
    async unreadCount(user) { return (await this.threads(user)).reduce((s, t) => s + t.unread, 0); }
  };

  /* ======================================================================
     Financeiro do profissional
     ====================================================================== */
  const Finance = {
    async summary(proId) {
      const tx = (await DB.transactions.where((t) => t.userId === proId)).sort((a, b) => b.createdAt - a.createdAt);
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const day = 86400000;
      const credits = tx.filter((t) => t.type === 'credito');
      const balance = U.round2(credits.reduce((s, t) => s + t.net, 0) - tx.filter((t) => t.type === 'saque').reduce((s, t) => s + t.amount, 0));
      const today = U.round2(credits.filter((t) => t.createdAt >= t0.getTime()).reduce((s, t) => s + t.net, 0));
      const last30 = U.round2(credits.filter((t) => t.createdAt >= t0.getTime() - 29 * day).reduce((s, t) => s + t.net, 0));
      // 4 semanas, da mais antiga (esquerda) para a mais recente
      const weeks = [0, 1, 2, 3].map((i) => {
        const end = t0.getTime() + day - i * 7 * day, start = end - 7 * day;
        return credits.filter((t) => t.createdAt >= start && t.createdAt < end).reduce((s, t) => s + t.net, 0);
      }).reverse();
      const todayJobs = (await DB.requests.where((r) => r.providerId === proId && r.status !== 'cancelado' && r.schedule && r.schedule.date === U.todayISO())).length;
      return { tx, balance, today, last30, weeks, todayJobs };
    },
    async withdraw(proId, amount, pixKey) {
      const s = await this.summary(proId);
      const v = Number(amount);
      if (!Number.isFinite(v) || v <= 0) fail('Informe o valor do saque.');
      if (v < 10) fail('O saque mínimo é de R$ 10,00.');
      if (v > s.balance + 0.001) fail('Valor maior que o saldo disponível.');
      if (String(pixKey || '').trim().length < 5) fail('Informe uma chave Pix válida.');
      const tx = await DB.transactions.insert({ userId: proId, type: 'saque', amount: U.round2(v), net: U.round2(v), requestId: null, description: 'Saque via Pix', status: 'concluido' });
      await Notifs.push(proId, 'Saque realizado', `${U.money(v)} enviados via Pix (simulado).`, '/p/ganhos');
      return tx;
    }
  };

  /* ======================================================================
     Agenda
     ====================================================================== */
  const Agenda = {
    async day(proId, dateISO) {
      const list = await DB.requests.where((r) => r.providerId === proId && r.status !== 'cancelado' && r.schedule && r.schedule.date === dateISO);
      return list.sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));
    },
    async markers(proId, year, month) {
      const pre = `${year}-${String(month + 1).padStart(2, '0')}`;
      const list = await DB.requests.where((r) => r.providerId === proId && r.status !== 'cancelado' && r.schedule && r.schedule.date.startsWith(pre));
      const map = {};
      list.forEach((r) => { map[r.schedule.date] = (map[r.schedule.date] || 0) + 1; });
      return map;
    }
  };

  /* ======================================================================
     Backup
     ====================================================================== */
  const Backup = {
    async exportJSON() {
      const data = await DB.dump();
      return JSON.stringify({ app: 'ServiceAproxima', v: CFG.SCHEMA_VERSION, exportedAt: new Date().toISOString(), data });
    },
    async importJSON(text) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { fail('Arquivo inválido: não é um JSON.'); }
      if (!obj || obj.app !== 'ServiceAproxima' || !obj.data || typeof obj.data !== 'object') fail('Este arquivo não é um backup do ServiceAproxima.');
      if (obj.v > CFG.SCHEMA_VERSION) fail('Este backup foi gerado por uma versão mais nova do app.');
      await DB.restore(obj.data);
    }
  };

  Object.assign(Svc, { Auth, Geo, Notifs, Providers, Requests, Proposals, Jobs, Chat, Finance, Agenda, Backup });
  g.Svc = Svc;
})(window);
