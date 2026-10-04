/* ==========================================================================
   ui.js — componentes de interface reutilizáveis
   ========================================================================== */
(function (g) {
  'use strict';
  const { U, CFG } = g;
  const UI = { actions: {} };
  const esc = U.esc, icon = U.icon;

  /* ---------- toasts ---------- */
  UI.toast = (msg, kind) => {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'bell', 18)}<span>${esc(msg)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, kind === 'error' ? 5200 : 3200);
  };
  UI.error = (e) => { console.error(e); UI.toast((e && e.message) || 'Algo deu errado. Tente de novo.', 'error'); };

  /* ---------- avatar ---------- */
  UI.avatar = (u, size, extra) => {
    const s = size || 44;
    const hue = U.hashNum((u && u.id) || 'x') % 360;
    const online = extra && extra.online != null ? `<i class="dot ${extra.online ? 'on' : 'off'}" title="${extra.online ? 'Online' : 'Offline'}"></i>` : '';
    const verified = extra && extra.verified ? `<i class="vbadge" title="Identidade verificada">${icon('check', 10)}</i>` : '';
    const inner = `<span>${esc(U.initials(u ? u.name : '?'))}</span>`;
    return `<span class="avatar" style="--s:${s}px;--h:${hue}">${inner}${online}${verified}</span>`;
  };

  /* ---------- selos e vazio ---------- */
  UI.badge = (status) => { const s = CFG.STATUS[status] || { label: status, tone: 'grey' }; return `<span class="badge ${s.tone}">${esc(s.label)}</span>`; };
  UI.pill = (text, tone) => `<span class="badge ${tone || 'grey'}">${esc(text)}</span>`;
  UI.empty = (ic, title, text, actionHtml) => `<div class="empty"><div class="empty-ic">${icon(ic, 28)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${actionHtml || ''}</div>`;
  UI.rating = (value, count) => `<span class="rating">${icon('star', 14)}<b>${value ? value.toFixed(1).replace('.', ',') : 'Novo'}</b>${count != null && value ? `<small>(${count})</small>` : ''}</span>`;

  /* ---------- barra superior e inferior ---------- */
  UI.header = ({ title, sub, back, right, plain }) => `
    <header class="appbar ${plain ? 'plain' : ''}">
      ${back ? `<button class="icon-btn" ${back === true ? 'data-action="back"' : String(back).startsWith('@') ? `data-action="${esc(String(back).slice(1))}"` : `data-action="go" data-to="${esc(back)}"`} aria-label="Voltar">${icon('back', 22)}</button>` : ''}
      <div class="appbar-title"><h1>${esc(title || '')}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
      <div class="appbar-right">${right || ''}</div>
    </header>`;

  UI.bellButton = (n, base) => `<button class="icon-btn bell" data-action="go" data-to="/${base}/notificacoes" aria-label="Notificações${n ? ` (${n} não lidas)` : ''}">${icon('bell', 22)}${n ? `<i class="count">${n > 9 ? '9+' : n}</i>` : ''}</button>`;

  UI.tabbar = (role, active, badges) => {
    const b = badges || {};
    const item = (id, ic, label, to) => `<a class="tab ${active === id ? 'on' : ''}" href="#${to}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 22)}<span>${label}</span>${b[id] ? `<i class="count">${b[id] > 9 ? '9+' : b[id]}</i>` : ''}</a>`;
    if (role === 'cliente') {
      return `<nav class="tabbar" aria-label="Navegação principal">
        ${item('inicio', 'home', 'Início', '/c/inicio')}
        ${item('explorar', 'search', 'Buscar', '/c/explorar')}
        <a class="tab fab" href="#/c/novo" aria-label="Pedir um serviço">${icon('plus', 26)}</a>
        ${item('servicos', 'clipboard', 'Serviços', '/c/servicos')}
        ${item('mensagens', 'chat', 'Conversas', '/c/mensagens')}
      </nav>`;
    }
    return `<nav class="tabbar" aria-label="Navegação principal">
      ${item('painel', 'home', 'Início', '/p/painel')}
      ${item('pedidos', 'clipboard', 'Pedidos', '/p/pedidos')}
      ${item('agenda', 'calendar', 'Agenda', '/p/agenda')}
      ${item('ganhos', 'wallet', 'Ganhos', '/p/ganhos')}
      ${item('perfil', 'user', 'Perfil', '/p/perfil')}
    </nav>`;
  };

  /* ---------- formulários ---------- */
  UI.field = ({ label, name, type, value, placeholder, mask, autocomplete, hint, required, maxlength, inputmode, min, max, step, extra, id }) => {
    const fid = id || 'f_' + name;
    const t = type || 'text';
    const isPw = t === 'password';
    const input = t === 'textarea'
      ? `<textarea id="${fid}" name="${name}" rows="4" placeholder="${esc(placeholder || '')}" ${maxlength ? `maxlength="${maxlength}"` : ''} ${required ? 'required' : ''} ${extra || ''}>${esc(value || '')}</textarea>`
      : `<input id="${fid}" name="${name}" type="${t}" value="${esc(value == null ? '' : value)}" placeholder="${esc(placeholder || '')}" ${mask ? `data-mask="${mask}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''} ${required ? 'required' : ''} ${extra || ''} />`;
    return `<div class="field"><label for="${fid}">${esc(label)}</label><div class="input-wrap">${input}${isPw ? `<button type="button" class="eye" data-action="toggle-pw" data-target="${fid}" aria-label="Mostrar senha">${icon('eye', 18)}</button>` : ''}</div>${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</div>`;
  };
  UI.select = ({ label, name, options, value, id }) => {
    const fid = id || 'f_' + name;
    return `<div class="field"><label for="${fid}">${esc(label)}</label><div class="input-wrap"><select id="${fid}" name="${name}">${options.map((o) => { const v = typeof o === 'string' ? o : o.value; const l = typeof o === 'string' ? o : o.label; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></div></div>`;
  };
  UI.formData = (form) => { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v : v.name; }); return o; };
  UI.busy = (btn, on, text) => {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${esc(text || 'Aguarde...')}`; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  };

  /* ---------- modal / bottom sheet ---------- */
  UI.sheet = ({ title, html, onMount, wide, noClose }) => {
    const root = document.getElementById('modal-root');
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'overlay';
    wrap.innerHTML = `<div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title || 'Janela')}">
      <div class="sheet-grab" aria-hidden="true"></div>
      <div class="sheet-head"><h2>${esc(title || '')}</h2>${noClose ? '' : `<button class="icon-btn" data-close aria-label="Fechar">${icon('x', 20)}</button>`}</div>
      <div class="sheet-body">${html}</div></div>`;
    root.appendChild(wrap);
    document.body.classList.add('modal-open');
    const api = {
      el: wrap.querySelector('.sheet-body'),
      close() {
        document.removeEventListener('keydown', onKey);
        wrap.classList.add('out');
        setTimeout(() => { wrap.remove(); if (!root.children.length) document.body.classList.remove('modal-open'); }, 180);
        if (prev && prev.focus) try { prev.focus(); } catch (e) { /* ignora */ }
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && !noClose && root.lastElementChild === wrap) api.close();
      if (e.key === 'Tab') { // mantém o foco dentro da janela
        const f = wrap.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (!noClose && (e.target === wrap || e.target.closest('[data-close]'))) api.close(); });
    if (onMount) onMount(api);
    const first = wrap.querySelector('input:not([type=hidden]), textarea, select') || wrap.querySelector('button');
    if (first) first.focus();
    return api;
  };

  UI.confirm = ({ title, message, confirmText, cancelText, danger }) => new Promise((resolve) => {
    let answered = false;
    const s = UI.sheet({
      title: title || 'Confirmar',
      html: `<p class="muted">${esc(message || '')}</p><div class="row gap end"><button class="btn ghost" data-no>${esc(cancelText || 'Voltar')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmText || 'Confirmar')}</button></div>`,
      onMount(api) {
        api.el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; api.close(); resolve(true); });
        api.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; api.close(); resolve(false); });
      }
    });
    // fechar pelo X/Esc também conta como "não"
    const obs = new MutationObserver(() => {
      if (document.body.contains(s.el)) return;
      obs.disconnect();
      if (!answered) { answered = true; resolve(false); }
    });
    obs.observe(document.getElementById('modal-root'), { childList: true });
  });

  UI.actions['toggle-pw'] = (btn) => {
    const inp = document.getElementById(btn.dataset.target);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.innerHTML = icon(show ? 'eyeoff' : 'eye', 18);
    btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  };

  /* ---------- seletor de estrelas ---------- */
  UI.starPicker = (name, value) => `<div class="star-picker" role="radiogroup" aria-label="Nota">${[1, 2, 3, 4, 5].map((n) => `<label class="${n <= (value || 0) ? 'on' : ''}"><input type="radio" name="${name}" value="${n}" data-change="rating" ${n === value ? 'checked' : ''} /><span>${icon('star', 34)}</span><b class="sr">${n} ${U.plural(n, 'estrela', 'estrelas')}</b></label>`).join('')}</div>`;

  g.UI = UI;
})(window);
