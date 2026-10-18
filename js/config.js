/* ==========================================================================
   config.js — constantes do app. Foco: babás, domésticas e cuidadores de idosos. Edite aqui para ajustar categorias,
   desconto, taxa da plataforma etc.
   ========================================================================== */
(function (g) {
  'use strict';

  const CFG = {
    APP_NAME: 'ServiceAproxima',
    FIRST_SERVICE_DISCOUNT: 0.15,   // 15% no primeiro serviço pago do cliente
    PLATFORM_FEE: 0,                // fração retida do profissional (0 = sem taxa). Ex.: 0.1 = 10%
    SCHEMA_VERSION: 2,   // aumente ao mudar categorias/dados de exemplo: o app recria a demonstração sozinho
    MAX_PHOTOS: 4,
    DEFAULT_RADIUS_KM: 30,
    DEFAULT_AVAILABILITY: { days: [1, 2, 3, 4, 5], hours: [8, 9, 10, 11, 14, 15, 16, 17] },
    CATEGORIES: [
      { id: 'baba', name: 'Babá', icon: 'baby', tone: 'blue' },
      { id: 'domestica', name: 'Doméstica', icon: 'home', tone: 'cyan' },
      { id: 'cuidador', name: 'Cuidador de idosos', icon: 'heart', tone: 'purple' }
    ],
    // valor-base de referência por atendimento (usado nas propostas de demonstração)
    BASE_PRICE: { baba: 120, domestica: 140, cuidador: 180 },
    // status do pedido -> rótulo e cor do selo
    STATUS: {
      aberta: { label: 'Aguardando propostas', tone: 'amber' },
      agendado: { label: 'Agendado', tone: 'blue' },
      em_andamento: { label: 'Em andamento', tone: 'indigo' },
      aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'amber' },
      concluido: { label: 'Concluído', tone: 'green' },
      cancelado: { label: 'Cancelado', tone: 'red' }
    },
    UFS: ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'],
    WEEKDAYS: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    RATING_TAGS: ['Pontualidade', 'Confiança', 'Paciência e carinho', 'Responsabilidade', 'Cuidado com a casa'],
    cat(id) { return this.CATEGORIES.find((c) => c.id === id) || this.CATEGORIES[this.CATEGORIES.length - 1]; }
  };

  g.CFG = CFG;
})(window);