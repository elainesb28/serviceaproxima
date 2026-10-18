/* ==========================================================================
   util.js — funções utilitárias (formatação, validação, ícones, mídia)
   Não depende de nenhum outro arquivo.
   ========================================================================== */
(function (g) {
  'use strict';
  const U = {};

  /* ---------- texto / formatação ---------- */
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  U.round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  U.uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
  U.initials = (name) => {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  };
  U.hashNum = (str) => {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  U.plural = (n, one, many) => (n === 1 ? one : many);
  U.fmtKm = (km) => (km == null ? '' : (km < 10 ? km.toFixed(1) : Math.round(km)).toString().replace('.', ',') + ' km');

  /* ---------- datas ---------- */
  U.toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  U.todayISO = () => U.toISO(new Date());
  U.parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  U.addDays = (iso, n) => { const d = U.parseISO(iso); d.setDate(d.getDate() + n); return U.toISO(d); };
  U.fmtDate = (iso) => U.parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
  U.fmtDateLong = (iso) => U.parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  U.fmtDay = (iso) => U.parseISO(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  U.weekdayShort = (iso) => U.parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  U.monthLabel = (d) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  U.fmtTime = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  U.fmtRel = (ts) => {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    return U.fmtDate(U.toISO(new Date(ts)));
  };
  U.fmtDur = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

  /* ---------- validação / máscaras ---------- */
  U.validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
  U.digits = (s) => String(s || '').replace(/\D/g, '');
  U.validCPF = (cpf) => {
    const c = U.digits(cpf);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (let t = 9; t < 11; t++) {
      let sum = 0;
      for (let i = 0; i < t; i++) sum += Number(c[i]) * (t + 1 - i);
      const dv = ((sum * 10) % 11) % 10;
      if (dv !== Number(c[t])) return false;
    }
    return true;
  };
  U.validPhone = (p) => { const d = U.digits(p); return d.length === 10 || d.length === 11; };
  U.luhn = (num) => {
    const d = U.digits(num);
    if (d.length < 13 || d.length > 19) return false;
    let sum = 0, alt = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = Number(d[i]);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  };
  const masks = {
    cpf: (v) => U.digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
    phone: (v) => {
      const d = U.digits(v).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : '';
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    cep: (v) => U.digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
    date: (v) => U.digits(v).slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3'),
    card: (v) => U.digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '),
    exp: (v) => U.digits(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2'),
    money: (v) => v.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '')
  };
  U.mask = (kind, v) => (masks[kind] ? masks[kind](v) : v);
  U.parseMoney = (v) => {
    const s = String(v == null ? '' : v).trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
    return Number.isFinite(n) ? n : NaN;
  };
  U.validBirth = (br) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || '');
    if (!m) return false;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return false;
    const age = (Date.now() - d.getTime()) / (365.25 * 864e5);
    return age >= 18 && age < 100;
  };

  /* ---------- senha (demonstração) ---------- */
  U.hash = async (text) => {
    if (g.crypto && g.crypto.subtle) {
      const buf = await g.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return 'fnv' + U.hashNum(text).toString(16); // fallback quando o navegador não expõe crypto.subtle
  };

  U.pwHash = (email, pw) => U.hash(String(email || '').trim().toLowerCase() + '|' + pw + '|sa1');

  /* ---------- arquivos (backup) ---------- */
  U.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  U.download = (filename, text, mime) => {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  U.readText = (file) => new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Falha ao ler o arquivo.')); r.readAsText(file);
  });

  /* ---------- ícones ---------- */
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><circle cx="16" cy="13.5" r="1.2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    logout: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
    brush: '<rect x="4" y="3" width="13" height="6" rx="1.5"/><path d="M17 6h3v5H11v3"/><rect x="9" y="14" width="4" height="7" rx="1"/>',
    bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    sparkles: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    hammer: '<path d="M5 20l9-9"/><path d="M12 4l4-1 5 5-1 4-4 1-4-4z"/>',
    dots: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    whatsapp: '<path d="M3 21l1.6-4.8A9 9 0 1 1 8 19.6z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2.4-1.2-1 .9a4.5 4.5 0 0 1-2.2-2.2l.9-1-1.2-2.4z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    pix: '<path d="M12 3l9 9-9 9-9-9z"/><path d="M8 12l4-4 4 4-4 4z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.5 7.8A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4-.9"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
    percent: '<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    baby: '<circle cx="12" cy="13" r="8"/><path d="M9 12h.01M15 12h.01M9.5 16c1.5 1.3 3.5 1.3 5 0"/><path d="M12 5c0-1.6 1.4-2.4 2.6-1.6"/>',
    heart: '<path d="M12 20s-7.5-4.6-9-9.5A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 3.5C19.5 15.4 12 20 12 20z"/>'
  };
  U.icon = (name, size, cls) => {
    const s = size || 20;
    const fill = name === 'star' || name === 'play' ? ' fill="currentColor"' : '';
    return `<svg class="i ${cls || ''}" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(P[name] || P.dots).replace(/<path /g, fill ? '<path fill="currentColor" ' : '<path ')}</svg>`;
  };
  U.stars = (value, size) => {
    const v = Math.round(Number(value) || 0);
    let out = '<span class="stars" aria-label="' + v + ' de 5 estrelas">';
    for (let i = 1; i <= 5; i++) out += `<span class="${i <= v ? 'on' : ''}">${U.icon('star', size || 14)}</span>`;
    return out + '</span>';
  };

  /* logo (casa + pin + pessoa), igual ao protótipo */
  U.logo = (size) => `<svg class="logo-mark" width="${size || 96}" height="${size || 96}" viewBox="0 0 96 96" fill="none" aria-hidden="true">
    <path d="M10 44 48 12l38 32" stroke="#2F5BD8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18 40v38a6 6 0 0 0 6 6h48a6 6 0 0 0 6-6V40" stroke="#2F5BD8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M48 70s15-12.5 15-25a15 15 0 0 0-30 0c0 12.5 15 25 15 25z" fill="#22B573"/>
    <circle cx="48" cy="42" r="6" fill="#fff"/><path d="M38.5 56c1.7-5 5.4-7 9.5-7s7.8 2 9.5 7c-2.8 3-6 4.5-9.5 4.5S41.3 59 38.5 56z" fill="#fff"/></svg>`;

  g.U = U;
})(window);
