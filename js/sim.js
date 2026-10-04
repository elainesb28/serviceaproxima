/* ==========================================================================
   sim.js — MODO DEMONSTRAÇÃO
   --------------------------------------------------------------------------
   Como o app roda só no navegador, não existe outra pessoa do outro lado.
   Para você testar o fluxo completo, os profissionais de EXEMPLO (os que não
   têm login) respondem sozinhos: mandam mensagem e uma proposta alguns
   segundos depois do pedido. Dá para desligar em Perfil > Modo demonstração.
   Contas reais criadas por você (e a conta Marcos Silva) nunca são simuladas.
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, DB, CFG, Svc } = g;

  const isSimPro = (u) => !!(u && u.role === 'prestador' && u.seed && !u.passHash);
  const wait = (a, b) => (a + Math.random() * (b - a)) * 1000;
  const DURATION = { pintura: 4, eletrica: 2, encanador: 2, diarista: 6, reparos: 2, outros: 2 };
  const TERMS = [
    'Material não incluso. Garantia de 90 dias sobre o serviço.',
    'Material incluso. Deixo o local limpo ao final.',
    'Valor fechado, sem custo extra de deslocamento.'
  ];

  async function enqueue(task) {
    const q = await DB.kv.get('sim_queue', []);
    q.push(task);
    await DB.kv.set('sim_queue', q);
  }
  const simOn = (u) => !u || !u.settings || u.settings.simulate !== false;

  Svc.on('request:created', async ({ request, client }) => {
    try {
      if (!simOn(client)) return;
      let pros = [];
      if (request.targetProviderId) {
        const p = await DB.users.get(request.targetProviderId);
        if (isSimPro(p)) pros = [p];
      } else {
        pros = (await Svc.Providers.list()).filter((p) => isSimPro(p) && p.pro.online && p.pro.categories.includes(request.category))
          .sort((a, b) => (Svc.Geo.distanceKm(client.address, a.address) || 99) - (Svc.Geo.distanceKm(client.address, b.address) || 99)).slice(0, 2);
      }
      for (let i = 0; i < pros.length; i++) await enqueue({ type: 'proposal', requestId: request.id, providerId: pros[i].id, at: Date.now() + wait(4 + i * 9, 8 + i * 12) });
    } catch (e) { console.error(e); }
  });

  Svc.on('chat:message', async ({ message, request }) => {
    try {
      if (message.from !== request.clientId || message.type !== 'text') return;
      const client = await DB.users.get(request.clientId);
      const pro = await DB.users.get(message.providerId);
      if (!simOn(client) || !isSimPro(pro)) return;
      await enqueue({ type: 'reply', requestId: request.id, providerId: pro.id, text: message.text || '', at: Date.now() + wait(2, 4) });
    } catch (e) { console.error(e); }
  });

  async function runProposal(t) {
    const r = await DB.requests.get(t.requestId);
    const pro = await DB.users.get(t.providerId);
    if (!r || !pro || r.status !== 'aberta') return;
    if (r.targetProviderId && r.targetProviderId !== pro.id) return;
    let slot = null;
    if (r.preferred && r.preferred.date && r.preferred.time) {
      const ok = (await Svc.Providers.slots(pro.id, r.preferred.date)).find((s) => s.time === r.preferred.time && s.ok);
      if (ok) slot = { date: r.preferred.date, time: r.preferred.time };
    }
    if (!slot) slot = await Svc.Providers.nextFreeSlot(pro.id, 1);
    if (!slot) return;
    const h = U.hashNum(r.id + pro.id);
    const base = r.budget ? r.budget * (0.9 + (h % 30) / 100) : CFG.BASE_PRICE[r.category] * (1 + (h % 40) / 100);
    const value = Math.max(30, Math.round(base / 5) * 5);
    const dur = DURATION[r.category] || 2;
    const client = await DB.users.get(r.clientId);
    await Svc.Chat.send({
      requestId: r.id, providerId: pro.id, fromId: pro.id, type: 'text',
      text: `Olá, ${U.firstName(client ? client.name : '')}! Vi seu pedido "${r.title}". Posso atender em ${U.fmtDate(slot.date)} às ${slot.time}. Mandei a proposta aqui no chat.`
    });
    await Svc.Proposals.send({ requestId: r.id, providerId: pro.id, value, date: slot.date, time: slot.time, durationH: dur, conditions: TERMS[h % TERMS.length], materialIncluded: h % 2 === 0 });
  }

  async function runReply(t) {
    const r = await DB.requests.get(t.requestId);
    if (!r || r.status === 'cancelado' || (r.providerId && r.providerId !== t.providerId)) return;
    const s = U.norm(t.text);
    let text;
    if (/valor|preco|orcamento|quanto/.test(s)) text = 'O valor depende do que for preciso fazer. Vou detalhar tudo na proposta.';
    else if (/quando|horario|data|dia|hoje|amanha/.test(s)) text = 'Tenho horários livres nos próximos dias. Se preferir, escolha o dia no pedido que eu confirmo.';
    else if (/obrigad|valeu|ok|combinado/.test(s)) text = 'Por nada! Qualquer coisa é só chamar.';
    else text = 'Entendi! Algum detalhe a mais que eu deva saber antes de passar o valor?';
    await Svc.Chat.send({ requestId: r.id, providerId: t.providerId, fromId: t.providerId, type: 'text', text });
  }

  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const q = await DB.kv.get('sim_queue', []);
      const now = Date.now();
      const due = q.filter((t) => t.at <= now);
      if (!due.length) return;
      await DB.kv.set('sim_queue', q.filter((t) => t.at > now));
      for (const t of due) {
        try { if (t.type === 'proposal') await runProposal(t); else if (t.type === 'reply') await runReply(t); }
        catch (e) { console.error('Simulação falhou:', e); }
      }
      if (Sim.onChange) Sim.onChange();
    } finally { busy = false; }
  }

  const Sim = {
    isSimPro, onChange: null,
    start() { if (!Sim._t) Sim._t = setInterval(tick, 2000); },
    // botão "Demo": o profissional de exemplo conclui o serviço
    async finishJob(reqId) {
      const r = await DB.requests.get(reqId);
      if (!r) throw new Error('Serviço não encontrado.');
      const pro = await DB.users.get(r.providerId);
      if (!isSimPro(pro)) throw new Error('Só funciona com profissionais de exemplo.');
      return Svc.Jobs.finish(reqId, pro.id);
    }
  };
  g.Sim = Sim;
})(window);
