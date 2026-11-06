/* Centro de pagos: pago rápido, estado de cuenta en vivo, métodos locales. */
window.FL = window.FL || {};
FL.payments = (function () {
  const { $, $$ } = FL;
  let account = null, method = null, mode = 'cuota', syncedAt = null;

  const METHODS = {
    pse:    { label: 'PSE',        hint: 'Débito desde tu banco', fields: 'bank' },
    nequi:  { label: 'Nequi',      hint: 'Aprueba en tu app',     fields: 'phone' },
    daviplata: { label: 'DaviPlata', hint: 'Aprueba en tu app',   fields: 'phone' },
    card:   { label: 'Tarjeta',    hint: 'Débito o crédito',      fields: 'card' },
    global: { label: 'Pasarela global', hint: 'Apple Pay · Google Pay · PayPal', fields: 'wallet' }
  };
  const BANKS = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco Popular', 'Banco de Occidente', 'Scotiabank Colpatria', 'Nu Colombia'];

  /* ---------- cálculo de montos ---------- */
  function pending() { return account.installments.filter(i => i.status !== 'paid'); }
  function owed(i) { return i.amount + FL.api.accrued(i); }
  function amountToPay() {
    const p = pending(); if (!p.length) return 0;
    return mode === 'total' ? p.reduce((s, i) => s + owed(i), 0) : owed(p[0]);
  }

  /* ---------- render estado de cuenta ---------- */
  function renderAccount() {
    $('#acc-empty').hidden = true; $('#acc-panel').hidden = false;
    const p = pending(), all = account.installments;
    $('#acc-name').textContent = account.name;
    $('#acc-ref').textContent = 'Crédito ' + account.ref;
    const balance = p.reduce((s, i) => s + owed(i), 0);
    FL.tween($('#acc-balance'), balance);
    const paid = all.filter(i => i.status === 'paid').length;
    $('#acc-progress').style.width = (paid / all.length * 100) + '%';
    $('#acc-progress-txt').textContent = `${paid} de ${all.length} cuotas pagadas`;

    const next = p[0];
    const nxt = $('#acc-next');
    if (next) {
      const d = FL.daysBetween(new Date(), next.due);
      nxt.textContent = d < 0 ? `Vencida hace ${-d} ${-d === 1 ? 'día' : 'días'}` : d === 0 ? 'Vence hoy' : `Vence en ${d} ${d === 1 ? 'día' : 'días'} · ${FL.date(next.due)}`;
      nxt.className = 'pill ' + (d < 0 ? 'pill-bad' : d <= 3 ? 'pill-warn' : 'pill-ok');
    } else { nxt.textContent = '¡Al día! Sin saldo pendiente'; nxt.className = 'pill pill-ok'; }

    const ul = $('#acc-installments'); ul.textContent = '';
    all.forEach(i => {
      const li = FL.el('li', 'inst');
      const left = FL.el('div'); left.append(FL.el('p', 'inst-t', 'Cuota ' + i.n), FL.el('p', 'inst-s', FL.date(i.due)));
      const right = FL.el('div', 'text-right');
      const late = FL.api.accrued(i);
      right.append(FL.el('p', 'inst-t', FL.money(i.amount + late)), FL.el('p', 'inst-s ' + (i.status === 'paid' ? 'text-emerald-400' : late ? 'text-rose-400' : ''), i.status === 'paid' ? 'Pagada ✓' : late ? `Incluye mora ${FL.money(late)}` : 'Pendiente'));
      li.append(left, right); ul.appendChild(li);
    });

    const hist = $('#acc-history'); hist.textContent = '';
    if (!account.history.length) hist.appendChild(FL.el('li', 'inst-s', 'Aún no tienes pagos registrados.'));
    account.history.slice(0, 4).forEach(h => {
      const li = FL.el('li', 'inst');
      const l = FL.el('div'); l.append(FL.el('p', 'inst-t', `${h.concept} · ${h.method}`), FL.el('p', 'inst-s', `${FL.date(h.date)} · ${h.receipt}`));
      li.append(l, FL.el('p', 'inst-t text-emerald-400', '− ' + FL.money(h.amount))); hist.appendChild(li);
    });
    renderPayBox();
  }

  function renderPayBox() {
    const amt = amountToPay();
    $('#pay-amount').textContent = FL.money(amt);
    $$('.mode-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('#pay-now').disabled = !amt || !method;
    $('#pay-now-label').textContent = !amt ? 'Sin saldo pendiente' : method ? `Pagar ${FL.money(amt)} con ${METHODS[method].label}` : 'Elige un método de pago';
    $('#mode-total').hidden = pending().length < 2;
  }

  /* ---------- sincronización "en tiempo real" ---------- */
  setInterval(() => {
    if (!account) return;
    const s = Math.floor((Date.now() - syncedAt) / 1000);
    $('#acc-sync').textContent = s < 5 ? 'Actualizado ahora' : `Actualizado hace ${s} s`;
    if (s >= 30) refresh(true);
  }, 5000);

  async function refresh(silent) {
    try { account = await FL.api.getAccount(account.id); syncedAt = Date.now(); renderAccount(); $('#acc-sync').textContent = 'Actualizado ahora'; }
    catch (e) { if (!silent) FL.toast(e.message, 'bad'); }
  }

  /* ---------- búsqueda / pago rápido ---------- */
  async function lookup(value, autoscroll = true) {
    const input = $('#quick-id'), btn = $('#quick-btn');
    const v = String(value || '').trim();
    if (!v) { FL.toast('Ingresa tu cédula o referencia del crédito.', 'warn'); input.focus(); return; }
    btn.disabled = true; $('#quick-label').textContent = 'Buscando…';
    try {
      account = await FL.api.getAccount(v); syncedAt = Date.now(); mode = 'cuota';
      try { localStorage.setItem('nubo.session', account.id); } catch {}
      renderAccount(); $('#session-chip').hidden = false; $('#session-name').textContent = account.name.split(' ')[0];
      if (autoscroll) $('#acc-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { FL.toast(e.message, 'bad'); }
    btn.disabled = false; $('#quick-label').textContent = 'Pagar ahora';
  }

  /* ---------- modal de pago ---------- */
  function openModal() {
    const m = METHODS[method], body = $('#pm-body'); body.textContent = '';
    $('#pm-title').textContent = 'Pagar con ' + m.label;
    $('#pm-amount').textContent = FL.money(amountToPay());
    const add = (label, node) => { const f = FL.el('div', 'field'); const l = FL.el('label', 'lbl', label); node.id = 'pm-f-' + body.children.length; l.htmlFor = node.id; f.append(l, node); body.appendChild(f); return node; };
    const input = (ph, attrs = {}) => { const i = FL.el('input', 'inp'); i.placeholder = ph; Object.assign(i, attrs); return i; };
    if (m.fields === 'bank') {
      const s = FL.el('select', 'inp'); BANKS.forEach(b => s.appendChild(new Option(b, b))); add('Tu banco', s);
      const t = FL.el('select', 'inp'); t.append(new Option('Persona natural', 'n'), new Option('Persona jurídica', 'j')); add('Tipo de persona', t);
    } else if (m.fields === 'phone') {
      const i = add('Número de celular ' + m.label, input('3001234567', { inputMode: 'numeric', maxLength: 10 }));
      i.addEventListener('input', () => i.value = i.value.replace(/\D/g, ''));
      body.appendChild(FL.el('p', 'inst-s', 'Recibirás una notificación push para aprobar el pago.'));
    } else if (m.fields === 'card') {
      const n = add('Número de tarjeta', input('0000 0000 0000 0000', { inputMode: 'numeric', maxLength: 19, autocomplete: 'off' }));
      n.addEventListener('input', () => n.value = n.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim());
      const row = FL.el('div', 'grid grid-cols-2 gap-3');
      body.appendChild(row);
      const mk = (lab, ph, len) => { const f = FL.el('div', 'field'); const l = FL.el('label', 'lbl', lab); const i = input(ph, { inputMode: 'numeric', maxLength: len, autocomplete: 'off', id: 'pm-c-' + lab.length }); l.htmlFor = i.id; i.addEventListener('input', () => { i.value = i.value.replace(/[^\d/]/g, ''); }); f.append(l, i); row.appendChild(f); return i; };
      mk('Vence (MM/AA)', 'MM/AA', 5); mk('CVV', '123', 4);
      body.appendChild(FL.el('p', 'inst-s', '🔒 Demo: los datos de tarjeta no se envían ni se almacenan.'));
    } else {
      const g = FL.el('div', 'grid gap-2');
      ['Apple Pay', 'Google Pay', 'PayPal'].forEach((w, k) => { const b = FL.el('button', 'chip', w); b.type = 'button'; b.setAttribute('aria-pressed', String(k === 0)); b.addEventListener('click', () => $$('.chip', g).forEach(c => c.setAttribute('aria-pressed', String(c === b)))); g.appendChild(b); });
      body.appendChild(g);
    }
    $('#pm-confirm').hidden = false; $('#pm-confirm').disabled = false;
    $('#pm-form').hidden = false; $('#pm-proc').hidden = true; $('#pm-ok').hidden = true;
    $('#pay-modal').hidden = false; document.body.classList.add('modal-open');
    const f = $('#pm-body input, #pm-body select, #pm-body .chip'); f && f.focus();
  }
  function closeModal() { $('#pay-modal').hidden = true; document.body.classList.remove('modal-open'); }

  function validateModal() {
    const m = METHODS[method];
    if (m.fields === 'phone') { const v = $('#pm-body input').value; if (!/^3\d{9}$/.test(v)) return 'Ingresa un celular válido de 10 dígitos.'; }
    if (m.fields === 'card') {
      const [n, e, c] = $$('#pm-body input');
      if (n.value.replace(/\s/g, '').length < 15) return 'Número de tarjeta incompleto.';
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(e.value)) return 'Fecha de vencimiento inválida (MM/AA).';
      if (c.value.length < 3) return 'CVV inválido.';
    }
    return '';
  }

  async function confirmPay() {
    const err = validateModal(); if (err) { FL.toast(err, 'warn'); return; }
    $('#pm-form').hidden = true; $('#pm-proc').hidden = false;
    try {
      const r = await FL.api.pay({ id: account.id, amount: amountToPay(), method: METHODS[method].label });
      account = r.account; syncedAt = Date.now();
      $('#pm-proc').hidden = true; $('#pm-ok').hidden = false;
      $('#rc-amount').textContent = FL.money(r.amount); $('#rc-method').textContent = r.method;
      $('#rc-id').textContent = r.receipt; $('#rc-date').textContent = new Intl.DateTimeFormat(FL.config.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.date));
      renderAccount();
    } catch (e) { closeModal(); FL.toast(e.message, 'bad'); }
  }

  function init() {
    $('#quick-form').addEventListener('submit', e => { e.preventDefault(); lookup($('#quick-id').value); });
    $('#quick-demo').addEventListener('click', () => { $('#quick-id').value = FL.config.demoAccount; lookup(FL.config.demoAccount); });
    $$('.method').forEach(b => b.addEventListener('click', () => {
      method = b.dataset.method; $$('.method').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (account) renderPayBox(); else { FL.toast('Primero consulta tu crédito con tu cédula.', 'warn'); $('#quick-id').focus(); }
    }));
    $$('.mode-btn').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; renderPayBox(); }));
    $('#pay-now').addEventListener('click', openModal);
    $('#pm-confirm').addEventListener('click', confirmPay);
    $$('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
    document.addEventListener('keydown', e => e.key === 'Escape' && !$('#pay-modal').hidden && closeModal());
    $('#acc-refresh').addEventListener('click', () => refresh(false));
    $('#acc-logout').addEventListener('click', () => {
      account = null; try { localStorage.removeItem('nubo.session'); } catch {}
      $('#acc-panel').hidden = true; $('#acc-empty').hidden = false; $('#session-chip').hidden = true; method = null;
      $$('.method').forEach(x => x.setAttribute('aria-pressed', 'false'));
    });
    document.addEventListener('fl:goto-payment', e => {
      $('#quick-id').value = e.detail; document.getElementById('pagos').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => lookup(e.detail, false), 500);
    });
    // sesión previa
    let s = null; try { s = localStorage.getItem('nubo.session'); } catch {}
    if (s) { $('#quick-id').value = s; lookup(s, false); }
  }
  return { init };
})();
