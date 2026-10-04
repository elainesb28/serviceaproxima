/* ==========================================================================
   views-auth.js — splash, login e cadastros
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, UI, Svc, CFG } = g;
  const esc = U.esc, icon = U.icon;
  const Views = (g.Views = g.Views || {});
  const Common = (g.Common = g.Common || {});

  /* ---------- peças compartilhadas com outros arquivos ---------- */
  Common.addressFields = (a) => {
    a = a || {};
    return `
      ${UI.field({ label: 'CEP', name: 'cep', value: a.cep, placeholder: '00000-000', mask: 'cep', inputmode: 'numeric', autocomplete: 'postal-code', extra: 'data-input="cep"', hint: 'Preenche o endereço sozinho quando você está online.' })}
      ${UI.field({ label: 'Rua e número', name: 'rua', value: a.rua, placeholder: 'Ex.: SQS 100, Bloco A', autocomplete: 'street-address' })}
      ${UI.field({ label: 'Bairro', name: 'bairro', value: a.bairro, placeholder: 'Ex.: Asa Sul', required: true })}
      <div class="grid-2-1">
        ${UI.field({ label: 'Cidade', name: 'cidade', value: a.cidade, placeholder: 'Ex.: Brasília', required: true })}
        ${UI.select({ label: 'UF', name: 'uf', options: [{ value: '', label: '—' }].concat(CFG.UFS), value: a.uf })}
      </div>`;
  };
  Common.readAddress = (d) => ({ cep: d.cep || '', rua: (d.rua || '').trim(), bairro: (d.bairro || '').trim(), cidade: (d.cidade || '').trim(), uf: d.uf || '', coords: null });

  // consulta ViaCEP (só funciona online; se falhar, o usuário digita à mão)
  Common.cepLookup = async (input) => {
    const cep = U.digits(input.value);
    if (cep.length !== 8) return;
    const form = input.closest('form');
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
      clearTimeout(t);
      const j = await res.json();
      if (j.erro) return UI.toast('CEP não encontrado. Preencha o endereço à mão.');
      const set = (n, v) => { const el = form.elements[n]; if (el && v && !el.value) el.value = v; };
      set('rua', j.logradouro); set('bairro', j.bairro); set('cidade', j.localidade);
      if (form.elements.uf && !form.elements.uf.value) form.elements.uf.value = j.uf;
    } catch (e) { /* sem internet: segue o preenchimento manual */ }
  };

  Common.termsModal = () => UI.sheet({
    title: 'Termos de Uso e Privacidade',
    html: `<div class="prose">
      <p><b>Versão de demonstração.</b> Este texto é um modelo e deve ser revisado por um profissional jurídico antes de qualquer uso real.</p>
      <h3>Como funciona</h3><p>O ServiceAproxima conecta clientes a profissionais autônomos. A plataforma não é empregadora dos profissionais nem garante a execução dos serviços.</p>
      <h3>Seus dados</h3><p>Nesta versão, tudo o que você informa fica salvo apenas neste navegador (localStorage) e não é enviado a nenhum servidor. Limpar os dados do navegador apaga a conta.</p>
      <h3>Pagamentos</h3><p>Os pagamentos são simulados. Nenhuma cobrança real é feita e números de cartão não são armazenados.</p>
      <h3>Conduta</h3><p>Seja respeitoso, informe dados verdadeiros e cumpra o combinado.</p></div>`
  });
  UI.actions.terms = () => Common.termsModal();

  const goHome = (u) => g.App.go(u.role === 'prestador' ? '/p/painel' : '/c/inicio');

  /* ---------- splash ---------- */
  Views.splash = {
    public: true,
    async render() {
      return `<section class="screen splash">
        <div class="splash-top">${U.logo(112)}
          <h1 class="wordmark"><span class="w1">Service</span><span class="w2">Aproxima</span></h1>
          <p>Serviços perto de você</p></div>
        <div class="splash-actions">
          <button class="btn go lg" data-action="go" data-to="/entrar/cliente">Sou Cliente ${icon('chevron', 18)}</button>
          <button class="btn indigo lg" data-action="go" data-to="/entrar/prestador">Sou Prestador ${icon('chevron', 18)}</button>
          <p class="fine">Ao continuar, você aceita os <button class="link" data-action="terms">Termos de Uso</button> e a Política de Privacidade.</p>
        </div></section>`;
    }
  };

  /* ---------- login ---------- */
  Views.login = {
    public: true,
    async render(ctx) {
      const role = ctx.params.role === 'prestador' ? 'prestador' : 'cliente';
      const demo = role === 'prestador' ? 'marcos@demo.com' : 'ana@demo.com';
      return `<section class="screen auth">
        ${UI.header({ title: role === 'prestador' ? 'Entrar como prestador' : 'Entrar como cliente', back: '/', plain: true })}
        <div class="scroll"><div class="auth-body">
          <div class="auth-logo">${U.logo(64)}</div>
          <form data-submit="login" data-role="${role}" novalidate>
            ${UI.field({ label: 'E-mail', name: 'email', type: 'email', placeholder: 'exemplo@email.com', autocomplete: 'email', required: true })}
            ${UI.field({ label: 'Senha', name: 'password', type: 'password', placeholder: '••••••••', autocomplete: 'current-password', required: true })}
            <div class="form-error" role="alert" hidden></div>
            <button class="btn ${role === 'prestador' ? 'indigo' : 'go'} lg block" type="submit">Entrar</button>
          </form>
          <div class="demo-box">
            <p><b>Quer só testar?</b> Entre com a conta de demonstração (${esc(demo)}, senha ${g.Seed.DEMO_PASSWORD}).</p>
            <button class="btn outline block" data-action="login-demo" data-role="${role}">Entrar com a conta demo</button>
          </div>
          <p class="center">Ainda não tem conta? <a class="link" href="#/cadastro/${role}">Criar conta</a></p>
        </div></div></section>`;
    },
    submits: {
      async login(form, ev, ctx) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const d = UI.formData(form);
        UI.busy(btn, true, 'Entrando...');
        try {
          const u = await Svc.Auth.login(d.email, d.password);
          if (u.role !== form.dataset.role) UI.toast(`Você entrou com uma conta de ${u.role === 'prestador' ? 'prestador' : 'cliente'}.`);
          goHome(u);
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); }
      }
    },
    actions: {
      async 'login-demo'(btn) {
        try { goHome(await Svc.Auth.loginDemo(btn.dataset.role)); } catch (e) { UI.error(e); }
      }
    }
  };

  /* ---------- cadastro de cliente ---------- */
  Views.signupCliente = {
    public: true,
    async render() {
      return `<section class="screen auth">
        ${UI.header({ title: 'Crie sua conta', back: '/entrar/cliente', plain: true })}
        <div class="scroll"><div class="auth-body">
          <form data-submit="signup" novalidate>
            ${UI.field({ label: 'Nome completo', name: 'name', placeholder: 'Seu nome', autocomplete: 'name', required: true })}
            ${UI.field({ label: 'E-mail', name: 'email', type: 'email', placeholder: 'exemplo@email.com', autocomplete: 'email', required: true })}
            ${UI.field({ label: 'Telefone', name: 'phone', type: 'tel', placeholder: '(00) 00000-0000', mask: 'phone', inputmode: 'tel', autocomplete: 'tel', required: true })}
            ${UI.field({ label: 'Senha', name: 'password', type: 'password', placeholder: 'Mínimo de 6 caracteres', autocomplete: 'new-password', required: true })}
            <label class="check"><input type="checkbox" name="terms" required /><span>Eu aceito os <button type="button" class="link" data-action="terms">Termos de Uso</button> e a Política de Privacidade.</span></label>
            <div class="form-error" role="alert" hidden></div>
            <button class="btn indigo lg block" type="submit">Criar conta</button>
          </form>
          <p class="center">Já tem uma conta? <a class="link" href="#/entrar/cliente">Entrar</a></p>
        </div></div></section>`;
    },
    submits: {
      async signup(form) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const d = UI.formData(form);
        try {
          if (!d.terms) throw new Error('Aceite os Termos de Uso para continuar.');
          UI.busy(btn, true, 'Criando conta...');
          const u = await Svc.Auth.register({ role: 'cliente', name: d.name, email: d.email, phone: d.phone, password: d.password });
          UI.toast('Conta criada! Bem-vindo(a).', 'success');
          goHome(u);
        } catch (e) { err.textContent = e.message; err.hidden = false; UI.busy(btn, false); }
      }
    }
  };

  /* ---------- cadastro de prestador (2 etapas) ---------- */
  let draft = { step: 1, a: {}, b: { categories: [], radiusKm: CFG.DEFAULT_RADIUS_KM } };

  Views.signupPrestador = {
    public: true,
    async render() {
      const s1 = draft.step === 1;
      const a = draft.a, b = draft.b;
      return `<section class="screen auth">
        ${UI.header({ title: 'Cadastro de prestador', sub: `Passo ${draft.step} de 2 · ${s1 ? 'Dados pessoais' : 'Perfil profissional'}`, back: s1 ? '/entrar/prestador' : '@step1', plain: true })}
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s1 ? 50 : 100}"><i style="width:${s1 ? 50 : 100}%"></i></div>
        <div class="scroll"><div class="auth-body">
        ${s1 ? `<form data-submit="step1" novalidate>
            ${UI.field({ label: 'Nome completo', name: 'name', value: a.name, placeholder: 'Seu nome completo', autocomplete: 'name', required: true })}
            <div class="grid-2">
              ${UI.field({ label: 'CPF', name: 'cpf', value: a.cpf, placeholder: '000.000.000-00', mask: 'cpf', inputmode: 'numeric', required: true })}
              ${UI.field({ label: 'Nascimento', name: 'birth', value: a.birth, placeholder: 'DD/MM/AAAA', mask: 'date', inputmode: 'numeric', required: true })}
            </div>
            ${UI.field({ label: 'Celular', name: 'phone', type: 'tel', value: a.phone, placeholder: '(00) 00000-0000', mask: 'phone', inputmode: 'tel', autocomplete: 'tel', required: true })}
            ${UI.field({ label: 'E-mail', name: 'email', type: 'email', value: a.email, placeholder: 'exemplo@email.com', autocomplete: 'email', required: true })}
            ${UI.field({ label: 'Senha', name: 'password', type: 'password', value: a.password, placeholder: 'Mínimo de 6 caracteres', autocomplete: 'new-password', required: true })}
            <h3 class="section-h">Endereço de atendimento</h3>
            ${Common.addressFields(a.address)}
            <div class="form-error" role="alert" hidden></div>
            <button class="btn indigo lg block" type="submit">Próxima etapa ${icon('chevron', 18)}</button>
          </form>` : `<form data-submit="step2" novalidate>
            <h3 class="section-h">Serviços prestados</h3>
            <div class="chips" role="group" aria-label="Serviços prestados">
              ${CFG.CATEGORIES.map((c) => `<label class="chip-check"><input type="checkbox" name="cat" value="${c.id}" ${b.categories.includes(c.id) ? 'checked' : ''} /><span>${icon(c.icon, 16)} ${esc(c.name)}</span></label>`).join('')}
            </div>
            ${UI.field({ label: 'Como você se apresenta?', name: 'headline', value: b.headline, placeholder: 'Ex.: Eletricista residencial', maxlength: 60 })}
            <div class="field"><label for="f_radius">Raio de atendimento: <b id="radiusOut">${b.radiusKm} km</b></label>
              <input id="f_radius" name="radiusKm" type="range" min="5" max="100" step="5" value="${b.radiusKm}" data-input="radius" />
              <div class="range-scale"><span>5 km</span><span>100 km</span></div></div>
            ${UI.field({ label: 'Nome artístico / empresa', name: 'businessName', value: b.businessName, placeholder: 'Ex.: Silva Pinturas & Cia' })}
            ${UI.field({ label: 'Redes sociais / portfólio', name: 'social', value: b.social, placeholder: 'instagram.com/seuperfil' })}
            <label class="check"><input type="checkbox" name="terms" required /><span>Li e aceito os <button type="button" class="link" data-action="terms">Termos de Uso</button> e a Política de Prestadores.</span></label>
            <div class="form-error" role="alert" hidden></div>
            <button class="btn indigo lg block" type="submit">Finalizar cadastro e criar conta</button>
          </form>`}
        </div></div></section>`;
    },
    actions: {
      step1() { draft.step = 1; g.App.rerender(); }
    },
    inputs: {
      cep(el) { Common.cepLookup(el); },
      radius(el) { const o = document.getElementById('radiusOut'); if (o) o.textContent = el.value + ' km'; }
    },
    submits: {
      async step1(form) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const d = UI.formData(form);
        try {
          if (d.name.trim().split(/\s+/).length < 2) throw new Error('Informe nome e sobrenome.');
          if (!U.validCPF(d.cpf)) throw new Error('CPF inválido. Confira os números.');
          if (!U.validBirth(d.birth)) throw new Error('Data de nascimento inválida (DD/MM/AAAA). É preciso ter 18 anos ou mais.');
          if (!U.validPhone(d.phone)) throw new Error('Informe o celular com DDD.');
          if (!U.validEmail(d.email)) throw new Error('Informe um e-mail válido.');
          if (String(d.password).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
          const address = Common.readAddress(d);
          if (!address.bairro || !address.cidade || !address.uf) throw new Error('Informe bairro, cidade e UF do seu atendimento.');
          draft.a = { name: d.name, cpf: d.cpf, birth: d.birth, phone: d.phone, email: d.email, password: d.password, address };
          draft.step = 2;
          g.App.rerender({ top: true });
        } catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'center' }); }
      },
      async step2(form) {
        const err = form.querySelector('.form-error'); err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        const fd = new FormData(form);
        const d = UI.formData(form);
        const cats = fd.getAll('cat');
        draft.b = Object.assign(draft.b, { categories: cats, headline: d.headline, radiusKm: Number(d.radiusKm), businessName: d.businessName, social: d.social });
        try {
          if (!cats.length) throw new Error('Escolha ao menos um serviço que você presta.');
          if (!d.terms) throw new Error('Aceite os Termos de Uso para continuar.');
          UI.busy(btn, true, 'Criando conta...');
          const a = draft.a;
          const u = await Svc.Auth.register({
            role: 'prestador', name: a.name, email: a.email, phone: a.phone, password: a.password, address: a.address,
            pro: { cpf: a.cpf, birth: a.birth, categories: cats, headline: d.headline, radiusKm: Number(d.radiusKm), businessName: d.businessName, social: d.social }
          });
          draft = { step: 1, a: {}, b: { categories: [], radiusKm: CFG.DEFAULT_RADIUS_KM } };
          UI.toast('Conta criada! Complete seu perfil para receber mais pedidos.', 'success');
          goHome(u);
        } catch (e) {
          err.textContent = e.message; err.hidden = false; UI.busy(btn, false);
          if (/CPF|nascimento/i.test(e.message)) { draft.step = 1; }
        }
      }
    },
    onLeave() { /* mantém o rascunho enquanto o usuário navega entre as etapas */ }
  };
})(window);
