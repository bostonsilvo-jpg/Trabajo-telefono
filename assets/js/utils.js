window.FL = window.FL || {};
FL.$ = (s, r = document) => r.querySelector(s);
FL.$$ = (s, r = document) => [...r.querySelectorAll(s)];
FL.sleep = ms => new Promise(r => setTimeout(r, ms));
FL.money = n => new Intl.NumberFormat(FL.config.locale, { style: 'currency', currency: FL.config.currency, maximumFractionDigits: 0 }).format(Math.round(n));
FL.date = d => new Intl.DateTimeFormat(FL.config.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
FL.dateShort = d => new Intl.DateTimeFormat(FL.config.locale, { day: '2-digit', month: 'short' }).format(new Date(d));
FL.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
FL.daysBetween = (a, b) => Math.ceil((new Date(b).setHours(0,0,0,0) - new Date(a).setHours(0,0,0,0)) / 864e5);
FL.el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
FL.toast = (msg, kind = 'ok') => {
  const box = FL.$('#toasts'); if (!box) return;
  const t = FL.el('div', 'toast ' + kind, msg);
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
};
/* Animación de contador numérico */
FL.tween = (el, to, fmt = FL.money, ms = 380) => {
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
