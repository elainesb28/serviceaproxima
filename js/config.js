/* ==========================================================================
   config.js — constantes do app. Edite aqui para ajustar categorias,
   desconto, taxa da plataforma etc.
   ========================================================================== */
(function (g) {
  'use strict';

  const CFG = {
    APP_NAME: 'ServiceAproxima',
    FIRST_SERVICE_DISCOUNT: 0.15,   // 15% no primeiro serviço pago do cliente
    PLATFORM_FEE: 0,                // fração retida do profissional (0 = sem taxa). Ex.: 0.1 = 10%
    SCHEMA_VERSION: 1,
    MAX_PHOTOS: 4,
    DEFAULT_RADIUS_KM: 30,
    DEFAULT_AVAILABILITY: { days: [1, 2, 3, 4, 5], hours: [8, 9, 10, 11, 14, 15, 16, 17] },
    CATEGORIES: [
      { id: 'pintura', name: 'Pintura', icon: 'brush', tone: 'blue' },
      { id: 'eletrica', name: 'Elétrica', icon: 'bolt', tone: 'yellow' },
      { id: 'encanador', name: 'Encanador', icon: 'droplet', tone: 'cyan' },
      { id: 'diarista', name: 'Diarista', icon: 'sparkles', tone: 'purple' },
      { id: 'reparos', name: 'Reparos', icon: 'hammer', tone: 'orange' },
      { id: 'outros', name: 'Outros', icon: 'dots', tone: 'grey' }
    ],
    BASE_PRICE: { pintura: 250, eletrica: 120, encanador: 110, diarista: 140, reparos: 130, outros: 100 },
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
    RATING_TAGS: ['Pontualidade', 'Qualidade do trabalho', 'Preço justo', 'Educação', 'Capricho na limpeza'],
    cat(id) { return this.CATEGORIES.find((c) => c.id === id) || this.CATEGORIES[this.CATEGORIES.length - 1]; }
  };

  g.CFG = CFG;
})(window);
