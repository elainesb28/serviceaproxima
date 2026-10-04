/* ==========================================================================
   seed.js — dados de demonstração criados na primeira abertura do app.
   Contas com login:  ana@demo.com (cliente)  e  marcos@demo.com (prestador),
   ambas com a senha 123456.  Os demais perfis são fictícios (só aparecem na lista).
   Cidade/bairros de exemplo: Brasília-DF. Troque os valores aqui se quiser outra região.
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, DB, CFG } = g;

  const DEMO_PASSWORD = '123456';
  const A = (bairro, cidade, uf) => ({ cep: '', rua: '', bairro, cidade: cidade || 'Brasília', uf: uf || 'DF', coords: null });

  async function run() {
    if (await DB.kv.get('seeded', null)) return false;

    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const day = 86400000;
    const iso = (daysAgo) => U.addDays(U.todayISO(), -daysAgo);

    /* ---------- profissionais ---------- */
    const proDefs = [
      ['pro_ricardo', 'Ricardo Silva', 'Pintor profissional', ['pintura'], 'Asa Sul', 12, 850, 15, 4.9, 128, 'Pintura residencial e comercial com acabamento fino. Preparo de parede, massa corrida, textura e grafiato.'],
      ['pro_marcos_o', 'Marcos Oliveira', 'Especialista em texturas', ['pintura', 'reparos'], 'Taguatinga', 9, 420, 25, 4.8, 74, 'Texturas, grafiato e efeitos decorativos. Também faço pequenos reparos de reboco antes da pintura.'],
      ['pro_andre', 'André Santos', 'Pintura predial', ['pintura'], 'Asa Sul', 15, 610, 30, 4.7, 96, 'Fachadas, áreas comuns e apartamentos. Equipe própria e cumprimento de prazo.'],
      ['pro_carlos', 'Carlos Eduardo Lima', 'Eletricista residencial', ['eletrica'], 'Asa Norte', 11, 530, 20, 4.8, 88, 'Instalações, quadros de distribuição, tomadas, iluminação e laudos simples.'],
      ['pro_mariano', 'Mariano Silva', 'Encanador', ['encanador', 'reparos'], 'Taguatinga', 14, 700, 18, 4.9, 112, 'Vazamentos, troca de registros, desentupimento e instalação de louças.'],
      ['pro_anapaula', 'Ana Paula Martins', 'Diarista e limpeza pós-obra', ['diarista'], 'Águas Claras', 8, 390, 12, 5.0, 61, 'Limpeza residencial completa, pós-obra e organização de armários. Materiais próprios sob consulta.'],
      ['pro_juliana', 'Juliana Rocha', 'Diarista', ['diarista'], 'Asa Sul', 6, 260, 20, 4.7, 42, 'Faxina semanal ou avulsa, passadoria e cuidado com a casa.'],
      ['pro_paulo', 'Paulo Henrique', 'Marceneiro e reparos gerais', ['reparos', 'outros'], 'Guará', 13, 480, 35, 4.6, 57, 'Montagem e reparo de móveis, portas, prateleiras, fechaduras e pequenos reparos.']
    ];
    const baseAvail = () => JSON.parse(JSON.stringify(CFG.DEFAULT_AVAILABILITY));
    const users = proDefs.map(([id, name, headline, cats, bairro, years, jobs, resp, avg, cnt, bio], i) => ({
      id, role: 'prestador', seed: true, name,
      email: U.norm(name).replace(/[^a-z]+/g, '.') + '@exemplo.com',
      phone: '(61) 9' + String(8000 + i * 137).padStart(4, '0') + '-' + String(1200 + i * 311).slice(0, 4),
      passHash: null, avatar: null, address: A(bairro), settings: { simulate: true }, firstDiscountUsed: false,
      pro: {
        headline, bio, years, categories: cats, radiusKm: 30, businessName: '', social: '', online: i !== 6,
        availability: baseAvail(), verified: 'verificado', responseMin: resp,
        ratingBase: { avg, count: cnt }, jobsBase: jobs, cpf: '', birth: '',
        portfolio: []
      }
    }));

    // Conta demo do prestador (com login)
    const marcosHash = await U.pwHash('marcos@demo.com', DEMO_PASSWORD);
    users.push({
      id: 'pro_marcos', role: 'prestador', seed: true, name: 'Marcos Silva', email: 'marcos@demo.com', phone: '(61) 99111-2233',
      passHash: marcosHash, avatar: null, address: A('Asa Sul'), settings: { simulate: true }, firstDiscountUsed: false,
      pro: {
        headline: 'Eletricista e técnico em climatização', bio: 'Instalação e manutenção elétrica, chuveiros, ventiladores e ar-condicionado split.',
        years: 10, categories: ['eletrica', 'reparos', 'encanador'], radiusKm: 45, businessName: 'MS Elétrica & Reparos', social: '@msreparos',
        online: true, availability: baseAvail(), verified: 'verificado', responseMin: 10, ratingBase: { avg: 4.9, count: 96 }, jobsBase: 320,
        cpf: '', birth: '', portfolio: []
      }
    });

    // Clientes
    const anaHash = await U.pwHash('ana@demo.com', DEMO_PASSWORD);
    const clientDefs = [
      ['cli_carla', 'Carla Mendes', 'Asa Norte'], ['cli_roberto', 'Roberto Lima', 'Taguatinga'], ['cli_mariana', 'Mariana Silva', 'Asa Sul'],
      ['cli_ricardo', 'Ricardo Oliveira', 'Guará'], ['cli_anap', 'Ana Paula Moraes', 'Águas Claras']
    ];
    users.push({
      id: 'cli_ana', role: 'cliente', seed: true, name: 'Ana Souza', email: 'ana@demo.com', phone: '(61) 99222-3344', passHash: anaHash, avatar: null,
      address: { cep: '70000-000', rua: 'SQS 100, Bloco A', bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', coords: null },
      settings: { simulate: true }, firstDiscountUsed: false
    });
    clientDefs.forEach(([id, name, bairro], i) => users.push({
      id, role: 'cliente', seed: true, name, email: id.replace('cli_', '') + '@exemplo.com', phone: '(61) 9' + (7000 + i * 91) + '-' + (4400 + i * 53),
      passHash: null, avatar: null, address: A(bairro), settings: { simulate: true }, firstDiscountUsed: false
    }));

    /* ---------- pedidos ---------- */
    const requests = [];
    const proposals = [];
    const transactions = [];
    const messages = [];
    const baseReq = (o) => Object.assign({
      budget: null, preferred: { date: null, time: null }, targetProviderId: null,
      status: 'aberta', providerId: null, proposalId: null, schedule: null, price: null, conditions: '', payment: null, review: null,
      declinedBy: [], cancel: null, createdAt: now
    }, o);

    // 1) Pedidos abertos na região (aparecem em "Novos pedidos" do Marcos)
    requests.push(baseReq({
      id: 'req_seed_ar', clientId: 'cli_carla', category: 'reparos', title: 'Reparo de ar-condicionado',
      description: 'O aparelho split de 12.000 BTUs liga, mas não gela e está pingando água dentro de casa.',
      location: A('Asa Norte'), budget: 150, createdAt: now - 25 * 60000
    }));
    requests.push(baseReq({
      id: 'req_seed_chuveiro', clientId: 'cli_roberto', category: 'eletrica', title: 'Instalação de chuveiro',
      description: 'Preciso instalar um chuveiro elétrico novo. A fiação já existe, mas quero que alguém confira o disjuntor.',
      location: A('Taguatinga'), budget: 80, createdAt: now - 70 * 60000
    }));
    requests.push(baseReq({
      id: 'req_seed_tomadas', clientId: 'cli_mariana', category: 'eletrica', title: 'Trocar tomadas da cozinha',
      description: 'Três tomadas estão soltas e uma esquenta quando uso a air fryer. Quero trocar por tomadas novas.',
      location: A('Asa Sul'), budget: null, createdAt: now - 3 * 3600000
    }));

    // 2) Histórico concluído de Marcos (alimenta ganhos, agenda e avaliações)
    const hist = [
      [0, 'Instalação de tomadas', 'cli_carla', 95, 'eletrica', 5, 'Serviço rápido e limpo. Recomendo!'],
      [0, 'Troca de disjuntor', 'cli_roberto', 150, 'eletrica', 5, ''],
      [1, 'Reparo em ventilador de teto', 'cli_mariana', 180, 'reparos', 5, 'Chegou no horário e resolveu na hora.'],
      [2, 'Instalação de lustres', 'cli_ricardo', 250, 'eletrica', 4, 'Bom trabalho, só atrasou um pouco.'],
      [3, 'Revisão do quadro de luz', 'cli_anap', 290, 'eletrica', 5, 'Explicou tudo com clareza.'],
      [5, 'Troca de torneira', 'cli_carla', 120, 'encanador', 5, ''],
      [8, 'Instalação de ar-condicionado', 'cli_roberto', 350, 'reparos', 5, 'Muito caprichoso.'],
      [10, 'Pontos de iluminação externa', 'cli_mariana', 210, 'eletrica', 4, ''],
      [13, 'Troca de fiação do banheiro', 'cli_ricardo', 400, 'eletrica', 5, 'Profissional excelente.'],
      [15, 'Conserto de vazamento', 'cli_anap', 170, 'encanador', 5, ''],
      [18, 'Instalação de chuveiro', 'cli_carla', 320, 'eletrica', 5, ''],
      [20, 'Reparo em tomadas', 'cli_roberto', 260, 'eletrica', 4, 'Preço justo.'],
      [24, 'Instalação de ventiladores', 'cli_mariana', 500, 'eletrica', 5, 'Fez tudo no mesmo dia.'],
      [26, 'Troca de registro', 'cli_ricardo', 220, 'encanador', 5, '']
    ];
    hist.forEach(([ago, title, clientId, value, cat, rating, comment], i) => {
      const id = 'req_seed_h' + i;
      const doneAt = ago === 0 ? Math.min(now - 1000, startToday.getTime() + (i + 1) * 3600000) : startToday.getTime() - ago * day + 15 * 3600000;
      const cl = users.find((u) => u.id === clientId);
      requests.push(baseReq({
        id, clientId, category: cat, title, description: `${title} — serviço concluído (dados de exemplo).`, location: cl.address,
        status: 'concluido', providerId: 'pro_marcos', price: value, schedule: { date: iso(ago), time: ago === 0 ? '09:00' : '14:00', durationH: 2 },
        payment: { method: 'pix', amount: value, discount: 0, total: value, status: 'pago', paidAt: doneAt },
        review: { rating, comment, tags: [], at: doneAt + 3600000 }, createdAt: doneAt - 2 * day, completedAt: doneAt, finishedAt: doneAt
      }));
      transactions.push({ id: 'trx_seed_c' + i, userId: 'pro_marcos', type: 'credito', amount: value, net: U.round2(value * (1 - CFG.PLATFORM_FEE)), requestId: id, description: title, createdAt: doneAt, status: 'concluido' });
    });
    transactions.push({ id: 'trx_seed_w1', userId: 'pro_marcos', type: 'saque', amount: 2000, net: 2000, requestId: null, description: 'Saque via Pix', createdAt: startToday.getTime() - 9 * day + 10 * 3600000, status: 'concluido' });

    // 3) Serviços de hoje ainda por fazer (agenda do Marcos)
    [['req_seed_t1', 'Instalação de ventilador de teto', 'cli_carla', 120, '15:00'], ['req_seed_t2', 'Revisão elétrica da sala', 'cli_roberto', 180, '17:00']].forEach(([id, title, clientId, value, time]) => {
      const cl = users.find((u) => u.id === clientId);
      requests.push(baseReq({
        id, clientId, category: 'eletrica', title, description: `${title} (dados de exemplo).`, location: cl.address, status: 'agendado', providerId: 'pro_marcos',
        price: value, schedule: { date: U.todayISO(), time, durationH: 2 }, createdAt: now - day
      }));
    });

    // 4) Histórico da Ana (aparece em "Serviços recentes"); pago antes da promoção, então ela ainda tem o desconto
    const anaDone = startToday.getTime() - 30 * day + 16 * 3600000;
    requests.push(baseReq({
      id: 'req_seed_ana1', clientId: 'cli_ana', category: 'pintura', title: 'Pintura Sala de Estar', description: 'Pintar paredes da sala (cerca de 28 m²) em cinza claro, com massa corrida onde necessário.',
      location: users.find((u) => u.id === 'cli_ana').address,
      status: 'concluido', providerId: 'pro_ricardo', price: 250, conditions: 'Material incluso. Pintura em duas demãos.', schedule: { date: iso(30), time: '09:00', durationH: 4 },
      payment: { method: 'pix', amount: 250, discount: 0, total: 250, status: 'pago', paidAt: anaDone },
      review: { rating: 5, comment: 'Ficou impecável e entregou antes do prazo.', tags: ['Qualidade do trabalho'], at: anaDone + 7200000 }, createdAt: anaDone - 4 * day, completedAt: anaDone, finishedAt: anaDone
    }));
    messages.push(
      { requestId: 'req_seed_ana1', providerId: 'pro_ricardo', clientId: 'cli_ana', from: 'cli_ana', type: 'text', text: 'Oi, Ricardo! Você consegue pintar a sala na semana que vem?', createdAt: anaDone - 4 * day, readBy: ['cli_ana', 'pro_ricardo'] },
      { requestId: 'req_seed_ana1', providerId: 'pro_ricardo', clientId: 'cli_ana', from: 'pro_ricardo', type: 'text', text: 'Consigo sim! Posso começar às 9h e termino no mesmo dia.', createdAt: anaDone - 4 * day + 600000, readBy: ['cli_ana', 'pro_ricardo'] },
      { requestId: 'req_seed_ana1', providerId: 'pro_ricardo', clientId: 'cli_ana', from: 'pro_ricardo', type: 'system', text: 'Serviço concluído e pago.', createdAt: anaDone, readBy: ['cli_ana', 'pro_ricardo'] }
    );

    /* ---------- notificações iniciais ---------- */
    const notifs = [
      { userId: 'cli_ana', title: 'Bem-vinda ao ServiceAproxima', body: 'Peça um serviço e receba propostas de profissionais perto de você.', link: '/c/novo', read: false, createdAt: now - 60000 },
      { userId: 'pro_marcos', title: 'Novos pedidos na sua região', body: 'Há pedidos de ar-condicionado e chuveiro esperando sua proposta.', link: '/p/pedidos', read: false, createdAt: now - 20 * 60000 },
      { userId: 'pro_marcos', title: 'Hoje você tem 2 serviços agendados', body: 'Confira os horários na sua agenda.', link: '/p/agenda', read: false, createdAt: now - 30 * 60000 }
    ];

    /* ---------- grava tudo ---------- */
    await DB.users.insertMany(users);
    await DB.requests.insertMany(requests);
    await DB.proposals.insertMany(proposals);
    await DB.messages.insertMany(messages);
    await DB.transactions.insertMany(transactions);
    await DB.notifications.insertMany(notifs);
    await DB.kv.set('seeded', { v: CFG.SCHEMA_VERSION, at: now });
    return true;
  }

  g.Seed = { run, DEMO_PASSWORD };
})(window);
