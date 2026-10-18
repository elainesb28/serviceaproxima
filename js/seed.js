/* ==========================================================================
   seed.js — dados de demonstração criados na primeira abertura do app.
   Contas com login:  ana@demo.com (cliente)  e  marcia@demo.com (prestador),
   ambas com a senha 123456.  Os demais perfis são fictícios (só aparecem na lista).
   Cidade/bairros de exemplo: Brasília-DF. Troque os valores aqui se quiser outra região.
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, DB, CFG } = g;

  const DEMO_PASSWORD = '123456';
  const A = (bairro, cidade, uf) => ({ cep: '', rua: '', bairro, cidade: cidade || 'Brasília', uf: uf || 'DF', coords: null });

  async function run() {
    const seeded = await DB.kv.get('seeded', null);
    if (seeded && seeded.v === CFG.SCHEMA_VERSION) return false;
    if (seeded) await DB.reset(); // sobrou demonstração de uma versão anterior (outras categorias): recomeça do zero

    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const day = 86400000;
    const iso = (daysAgo) => U.addDays(U.todayISO(), -daysAgo);

    /* ---------- profissionais ---------- */
    const proDefs = [
      ['pro_helena', 'Helena Costa', 'Babá com experiência em recém-nascidos', ['baba'], 'Asa Sul', 12, 850, 15, 4.9, 128, 'Babá com 12 anos de experiência, curso de primeiros socorros infantil e referências verificáveis. Rotina, alimentação e brincadeiras com carinho e atenção.'],
      ['pro_juliana', 'Juliana Rocha', 'Babá e recreadora infantil', ['baba'], 'Taguatinga', 9, 420, 25, 4.8, 74, 'Atividades lúdicas, acompanhamento de lição de casa e busca na escola. Paciência e organização na rotina das crianças.'],
      ['pro_camila', 'Camila Barbosa', 'Babá folguista (noites e fins de semana)', ['baba'], 'Águas Claras', 7, 310, 18, 4.7, 52, 'Disponível para noites, fins de semana e feriados. Experiência com crianças de 1 a 10 anos.'],
      ['pro_anapaula', 'Ana Paula Martins', 'Doméstica e organização do lar', ['domestica'], 'Águas Claras', 8, 390, 12, 5.0, 61, 'Limpeza completa, organização de armários e rotina da casa. Pontual, discreta e de total confiança.'],
      ['pro_rosangela', 'Rosângela Pereira', 'Doméstica e passadeira', ['domestica'], 'Asa Sul', 15, 610, 30, 4.7, 96, 'Faxina semanal ou avulsa, passadoria e cuidado com a casa. Mais de 15 anos em casas de família.'],
      ['pro_lucia', 'Lúcia Ferreira', 'Cuidadora de idosos', ['cuidador'], 'Asa Norte', 11, 530, 20, 4.8, 88, 'Acompanhamento diurno e noturno, apoio na higiene, alimentação, mobilidade e administração de medicação conforme prescrição.'],
      ['pro_sandra', 'Sandra Alves', 'Cuidadora com técnico em enfermagem', ['cuidador'], 'Taguatinga', 14, 700, 18, 4.9, 112, 'Cuidados com idosos acamados ou com mobilidade reduzida, curativos simples, aferição de pressão e acompanhamento em consultas.'],
      ['pro_marta', 'Marta Gomes', 'Doméstica e cozinheira', ['domestica', 'baba'], 'Guará', 13, 480, 35, 4.6, 57, 'Rotina completa da casa, refeições do dia a dia e cuidado com as crianças quando necessário.']
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

    // Conta demo da prestadora (com login)
    const marciaHash = await U.pwHash('marcia@demo.com', DEMO_PASSWORD);
    users.push({
      id: 'pro_marcia', role: 'prestador', seed: true, name: 'Márcia Souza', email: 'marcia@demo.com', phone: '(61) 99111-2233',
      passHash: marciaHash, avatar: null, address: A('Asa Sul'), settings: { simulate: true }, firstDiscountUsed: false,
      pro: {
        headline: 'Babá e cuidadora de idosos', bio: 'Babá e cuidadora com 10 anos de experiência. Curso de primeiros socorros, referências de famílias atendidas e muito carinho no cuidado com crianças e idosos.',
        years: 10, categories: ['baba', 'cuidador'], radiusKm: 45, businessName: 'Cuidar com Carinho', social: '@cuidarcomcarinho',
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

    // 1) Pedidos abertos na região (aparecem em "Novos pedidos" da Márcia)
    requests.push(baseReq({
      id: 'req_seed_idosa', clientId: 'cli_carla', category: 'cuidador', title: 'Cuidadora para minha mãe (período diurno)',
      description: 'Minha mãe tem 82 anos, caminha com apoio e precisa de ajuda com medicação, refeições e companhia durante o dia, de segunda a sexta.',
      location: A('Asa Norte'), budget: 200, createdAt: now - 25 * 60000
    }));
    requests.push(baseReq({
      id: 'req_seed_baba', clientId: 'cli_roberto', category: 'baba', title: 'Babá para duas crianças',
      description: 'Preciso de babá para meus filhos de 3 e 6 anos nas tardes de segunda a sexta, com busca na escola, lanche e brincadeiras.',
      location: A('Taguatinga'), budget: 120, createdAt: now - 70 * 60000
    }));
    requests.push(baseReq({
      id: 'req_seed_noite', clientId: 'cli_mariana', category: 'cuidador', title: 'Acompanhante noturno para idoso',
      description: 'Meu pai tem 79 anos e precisa de alguém para passar a noite com ele após uma cirurgia no quadril, por duas semanas.',
      location: A('Asa Sul'), budget: null, createdAt: now - 3 * 3600000
    }));

    // 2) Histórico concluído da Márcia (alimenta ganhos, agenda e avaliações)
    const hist = [
      [0, 'Babá — tarde de sexta', 'cli_carla', 120, 'baba', 5, 'As crianças adoraram. Muito atenciosa!'],
      [0, 'Acompanhamento de idosa (manhã)', 'cli_roberto', 200, 'cuidador', 5, ''],
      [1, 'Babá — noite fora de casa', 'cli_mariana', 150, 'baba', 5, 'Chegou no horário e deixou tudo organizado.'],
      [2, 'Cuidadora de idoso — turno diurno', 'cli_ricardo', 240, 'cuidador', 4, 'Boa profissional, só atrasou um pouco.'],
      [3, 'Babá — saída da escola e lanche', 'cli_anap', 130, 'baba', 5, 'Explicou toda a rotina com clareza.'],
      [5, 'Acompanhamento em consulta médica', 'cli_carla', 160, 'cuidador', 5, ''],
      [8, 'Babá — fim de semana', 'cli_roberto', 350, 'baba', 5, 'Muito cuidadosa com as crianças.'],
      [10, 'Cuidadora — turno da tarde', 'cli_mariana', 210, 'cuidador', 4, ''],
      [13, 'Cuidadora — plantão noturno', 'cli_ricardo', 400, 'cuidador', 5, 'Profissional excelente.'],
      [15, 'Babá — meio período', 'cli_anap', 170, 'baba', 5, ''],
      [18, 'Cuidadora de idosa — dia inteiro', 'cli_carla', 320, 'cuidador', 5, ''],
      [20, 'Babá — noite', 'cli_roberto', 160, 'baba', 4, 'Preço justo.'],
      [24, 'Cuidadora — semana de acompanhamento', 'cli_mariana', 500, 'cuidador', 5, 'Cuidou do meu pai com muito carinho.'],
      [26, 'Babá — recreação e lição de casa', 'cli_ricardo', 140, 'baba', 5, '']
    ];
    hist.forEach(([ago, title, clientId, value, cat, rating, comment], i) => {
      const id = 'req_seed_h' + i;
      const doneAt = ago === 0 ? Math.min(now - 1000, startToday.getTime() + (i + 1) * 3600000) : startToday.getTime() - ago * day + 15 * 3600000;
      const cl = users.find((u) => u.id === clientId);
      requests.push(baseReq({
        id, clientId, category: cat, title, description: `${title} — serviço concluído (dados de exemplo).`, location: cl.address,
        status: 'concluido', providerId: 'pro_marcia', price: value, schedule: { date: iso(ago), time: ago === 0 ? '09:00' : '14:00', durationH: 2 },
        payment: { method: 'pix', amount: value, discount: 0, total: value, status: 'pago', paidAt: doneAt },
        review: { rating, comment, tags: [], at: doneAt + 3600000 }, createdAt: doneAt - 2 * day, completedAt: doneAt, finishedAt: doneAt
      }));
      transactions.push({ id: 'trx_seed_c' + i, userId: 'pro_marcia', type: 'credito', amount: value, net: U.round2(value * (1 - CFG.PLATFORM_FEE)), requestId: id, description: title, createdAt: doneAt, status: 'concluido' });
    });
    transactions.push({ id: 'trx_seed_w1', userId: 'pro_marcia', type: 'saque', amount: 2000, net: 2000, requestId: null, description: 'Saque via Pix', createdAt: startToday.getTime() - 9 * day + 10 * 3600000, status: 'concluido' });

    // 3) Atendimentos de hoje ainda por fazer (agenda da Márcia)
    [['req_seed_t1', 'Babá — tarde com as crianças', 'cli_carla', 120, '15:00', 'baba'], ['req_seed_t2', 'Acompanhamento de idosa', 'cli_roberto', 180, '17:00', 'cuidador']].forEach(([id, title, clientId, value, time, cat]) => {
      const cl = users.find((u) => u.id === clientId);
      requests.push(baseReq({
        id, clientId, category: cat, title, description: `${title} (dados de exemplo).`, location: cl.address, status: 'agendado', providerId: 'pro_marcia',
        price: value, schedule: { date: U.todayISO(), time, durationH: 2 }, createdAt: now - day
      }));
    });

    // 4) Histórico da Ana (aparece em "Serviços recentes"); pago antes da promoção, então ela ainda tem o desconto
    const anaDone = startToday.getTime() - 30 * day + 16 * 3600000;
    requests.push(baseReq({
      id: 'req_seed_ana1', clientId: 'cli_ana', category: 'baba', title: 'Babá para sábado de manhã', description: 'Preciso de babá para minha filha de 4 anos no sábado, das 9h às 13h, com brincadeiras e almoço.',
      location: users.find((u) => u.id === 'cli_ana').address,
      status: 'concluido', providerId: 'pro_helena', price: 160, conditions: 'Referências apresentadas. Almoço da criança incluso.', schedule: { date: iso(30), time: '09:00', durationH: 4 },
      payment: { method: 'pix', amount: 160, discount: 0, total: 160, status: 'pago', paidAt: anaDone },
      review: { rating: 5, comment: 'Minha filha adorou e eu fiquei muito tranquila.', tags: ['Confiança'], at: anaDone + 7200000 }, createdAt: anaDone - 4 * day, completedAt: anaDone, finishedAt: anaDone
    }));
    messages.push(
      { requestId: 'req_seed_ana1', providerId: 'pro_helena', clientId: 'cli_ana', from: 'cli_ana', type: 'text', text: 'Oi, Helena! Você consegue ficar com minha filha no sábado de manhã?', createdAt: anaDone - 4 * day, readBy: ['cli_ana', 'pro_helena'] },
      { requestId: 'req_seed_ana1', providerId: 'pro_helena', clientId: 'cli_ana', from: 'pro_helena', type: 'text', text: 'Consigo sim! Chego às 9h e fico até as 13h.', createdAt: anaDone - 4 * day + 600000, readBy: ['cli_ana', 'pro_helena'] },
      { requestId: 'req_seed_ana1', providerId: 'pro_helena', clientId: 'cli_ana', from: 'pro_helena', type: 'system', text: 'Atendimento concluído e pago.', createdAt: anaDone, readBy: ['cli_ana', 'pro_helena'] }
    );

    /* ---------- notificações iniciais ---------- */
    const notifs = [
      { userId: 'cli_ana', title: 'Bem-vinda ao ServiceAproxima', body: 'Peça um atendimento e receba propostas de babás, domésticas e cuidadores perto de você.', link: '/c/novo', read: false, createdAt: now - 60000 },
      { userId: 'pro_marcia', title: 'Novos pedidos na sua região', body: 'Há pedidos de cuidador de idosos e de babá esperando sua proposta.', link: '/p/pedidos', read: false, createdAt: now - 20 * 60000 },
      { userId: 'pro_marcia', title: 'Hoje você tem 2 atendimentos agendados', body: 'Confira os horários na sua agenda.', link: '/p/agenda', read: false, createdAt: now - 30 * 60000 }
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