/* ==========================================================================
   app.js — roteador (hash), eventos globais e inicialização
   --------------------------------------------------------------------------
   Cada tela (em g.Views) é um objeto:
     render(ctx)  -> HTML da tela (async)
     mount(ctx, root)           (opcional) roda depois de desenhar
     refresh(ctx, root)         (opcional) atualização leve quando os dados mudam
     actions / submits / inputs / changes / keydowns   (handlers por nome)
     nav: id do item ativo da barra inferior
     live: true => a tela se atualiza sozinha quando chega algo novo
     public: true => não exige login
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, UI, Svc, DB, Views } = g;

  const ROUTES = [
    ['/', 'splash'],
    ['/entrar/:role', 'login'],
    ['/cadastro/cliente', 'signupCliente'],
    ['/cadastro/prestador', 'signupPrestador'],
    ['/c/inicio', 'c.inicio'], ['/c/explorar', 'c.explorar'], ['/c/novo', 'c.novo'], ['/c/pro/:id', 'c.pro'],
    ['/c/servicos', 'c.servicos'], ['/c/servico/:id', 'c.servico'], ['/c/pagar/:id', 'c.pagar'], ['/c/avaliar/:id', 'c.avaliar'],
    ['/c/mensagens', 'c.mensagens'], ['/c/chat/:req/:pro', 'c.chat'], ['/c/notificacoes', 'c.notificacoes'], ['/c/perfil', 'c.perfil'],
    ['/p/painel', 'p.painel'], ['/p/pedidos', 'p.pedidos'], ['/p/pedido/:id', 'p.pedido'], ['/p/agenda', 'p.agenda'],
    ['/p/servicos', 'p.servicos'], ['/p/servico/:id', 'p.servico'], ['/p/ganhos', 'p.ganhos'], ['/p/avaliacoes', 'p.avaliacoes'],
    ['/p/mensagens', 'p.mensagens'], ['/p/chat/:req/:pro', 'p.chat'], ['/p/notificacoes', 'p.notificacoes'], ['/p/perfil', 'p.perfil']
  ].map(([path, view]) => ({ view, re: new RegExp('^' + path.replace(/:[a-z]+/g, '([^/]+)') + '$'), keys: (path.match(/:[a-z]+/g) || []).map((k) => k.slice(1)) }));

  const App = { ctx: null, view: null, navId: 0, _busy: false };
  const root = () => document.getElementById('app');

  const parseHash = () => {
    const raw = (location.hash || '#/').slice(1) || '/';
    const [path, qs] = raw.split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { path: path.replace(/\/+$/, '') || '/', query };
  };
  const match = (path) => {
    for (const r of ROUTES) {
      const m = r.re.exec(path);
      if (m) { const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); return { route: r, params }; }
    }
    return null;
  };

  App.go = (path) => { if (('#' + path) === location.hash) App.rerender(); else location.hash = path; };

  App.refreshBadges = async () => {
    const u = App.ctx && App.ctx.user;
    if (!u) return;
    const [bell, chat] = await Promise.all([Svc.Notifs.unread(u.id), Svc.Chat.unreadCount(u)]);
    const prev = App.ctx.badges;
    App.ctx.badges = { bell, chat, mensagens: chat };
    if (prev && (prev.bell !== bell || prev.chat !== chat)) {
      document.querySelectorAll('.bell').forEach((b) => { b.querySelector('.count')?.remove(); if (bell) b.insertAdjacentHTML('beforeend', `<i class="count">${bell > 9 ? '9+' : bell}</i>`); });
      const tab = document.querySelector('.tabbar a[href="#/c/mensagens"]');
      if (tab) { tab.querySelector('.count')?.remove(); if (chat) tab.insertAdjacentHTML('beforeend', `<i class="count">${chat > 9 ? '9+' : chat}</i>`); }
    }
  };

  /* ---------- desenho da tela ---------- */
  async function draw(opts) {
    opts = opts || {};
    const { path, query } = parseHash();
    const found = match(path) || match('/');
    const view = Views[found.route.view];
    const user = await Svc.Auth.current();
    
    // proteção de rotas e separação de ambientes
    if (!view.public && !user) return App.go('/');
    if (view.public && user && found.route.view !== 'splash' && !opts.stay) return App.go(user.role === 'prestador' ? '/p/painel' : '/c/inicio');
    if (found.route.view === 'splash' && user) return App.go(user.role === 'prestador' ? '/p/painel' : '/c/inicio');
    if (user && /^\/c\//.test(path) && user.role !== 'cliente') return App.go('/p/painel');
    if (user && /^\/p\//.test(path) && user.role !== 'prestador') return App.go('/c/inicio');

    const ctx = { params: found.params, query, user, navId: App.navId, badges: { bell: 0, chat: 0, mensagens: 0 } };
    if (user) { const [bell, chat] = await Promise.all([Svc.Notifs.unread(user.id), Svc.Chat.unreadCount(user)]); ctx.badges = { bell, chat, mensagens: chat }; }
    const sc = root().querySelector('.scroll');
    const scrollTop = sc ? sc.scrollTop : 0;
    let html;
    try { html = await view.render(ctx); } catch (e) { console.error(e); html = `<section class="screen"><div class="scroll">${UI.empty('alert', 'Algo deu errado ao abrir esta tela', e.message, '<a class="btn primary" href="#/">Voltar ao início</a>')}</div></section>`; }
    
    // se a rota mudou enquanto carregava, descarta
    if (opts.token && opts.token !== App._token) return;
    UI.stopAudio && UI.stopAudio();
    if (App.view && App.view !== view && App.view.onLeave) App.view.onLeave();
    App.view = view; App.ctx = ctx;
    const nav = view.nav && user ? UI.tabbar(user.role, view.nav, { mensagens: ctx.badges.chat }) : '';
    root().innerHTML = html + nav;
    root().dataset.env = user ? user.role : 'publico';
    document.body.dataset.env = user ? user.role : 'publico';
    const nsc = root().querySelector('.scroll');
    if (nsc) nsc.scrollTop = opts.keepScroll ? scrollTop : 0;
    if (view.mount) await view.mount(ctx, root());
    syncSwitcher(user);
  }

  App.rerender = (o) => draw({ keepScroll: !(o && o.top), stay: true, token: App._token });

  window.addEventListener('hashchange', () => { App.navId++; App._token = Symbol(); draw({ token: App._token }); });

  /* ---------- eventos globais (delegação) ---------- */
  const handler = (map, el, ev) => {
    const name = el.dataset[map === 'actions' ? 'action' : map === 'submits' ? 'submit' : map === 'changes' ? 'change' : map === 'keydowns' ? 'input' : 'input'];
    const fn = (App.view && App.view[map] && App.view[map][name]) || (map === 'actions' && UI.actions[name]) || (map === 'actions' && Global[name]);
    if (fn) return fn(el, ev, App.ctx);
    return undefined;
  };
  
  const Global = {
    go(el) { App.go(el.dataset.to); },
    back() { if (history.length > 1) history.back(); else App.go('/'); }
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (el.tagName === 'A') ev.preventDefault();
    if (!root().contains(el)) return;
    handler('actions', el, ev);
  });
  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('form[data-submit]');
    if (!form) return;
    ev.preventDefault();
    handler('submits', form, ev);
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.mask) { const v = U.mask(el.dataset.mask, el.value); if (v !== el.value) el.value = v; }
    if (el.dataset && el.dataset.input) handler('inputs', el, ev);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.change) handler('changes', el, ev);
  });
  document.addEventListener('keydown', (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.input && App.view && App.view.keydowns && App.view.keydowns[el.dataset.input]) App.view.keydowns[el.dataset.input](el, ev, App.ctx);
  });

  /* ---------- atualização ao vivo ---------- */
  let refreshing = false;
  App.onDataChanged = async () => {
    if (refreshing || !App.view || !App.ctx) return;
    refreshing = true;
    try {
      await App.refreshBadges();
      const v = App.view;
      if (document.querySelector('.overlay')) return; // não mexe com janela aberta
      if (v.refresh) await v.refresh(App.ctx, root());
      else if (v.live) {
        const a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && root().contains(a)) return; // não atrapalha quem está digitando
        await draw({ keepScroll: true, stay: true, token: App._token });
      }
    } finally { refreshing = false; }
  };
  window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('sa:')) App.onDataChanged(); });

  /* ---------- stub para compatibilidade ---------- */
  function syncSwitcher(user) {
    return;
  }

  App.resetDemo = async () => {
    await DB.reset();
    await g.Seed.run();
    App.navId++;
    UI.toast('Dados de demonstração restaurados.', 'success');
    App.go('/');
  };

  /* ---------- início ---------- */
  async function boot() {
    try {
      await g.Seed.run();
      g.Sim.onChange = () => App.onDataChanged();
      g.Sim.start();
      setInterval(() => { if (!document.hidden) App.onDataChanged(); }, 6000);
      App._token = Symbol();
      await draw({ token: App._token });
    } catch (e) {
      console.error(e);
      root().innerHTML = `<section class="screen"><div class="scroll">${UI.empty('alert', 'Não foi possível iniciar o app', (e && e.message) || 'Verifique se o navegador permite salvar dados do site (localStorage).')}</div></section>`;
    }
  }
  g.App = App;
  document.addEventListener('DOMContentLoaded', boot);
})(window);