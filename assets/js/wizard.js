/* Asistente de solicitud en 3 pasos + análisis simulado + aprobación. */
window.FL = window.FL || {};
FL.wizard = (function () {
  const { $, $$ } = FL;
  const data = { income: null, job: null, purpose: null, otpOk: false, front: false, back: false, bio: false };
  let step = 1;

  /* ---------- helpers de validación ---------- */
  function setError(input, msg) {
    const wrap = input.closest('.field') || input.parentElement;
    let e = $('.err', wrap);
    if (!e) { e = FL.el('p', 'err'); e.setAttribute('role', 'alert'); wrap.appendChild(e); }
    e.textContent = msg || '';
    input.classList.toggle('invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  const age = v => { const b = new Date(v), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

  const rules = {
    name: v => v.trim().split(/\s+/).length >= 2 && v.trim().length >= 5 ? '' : 'Escribe tu nombre y apellido completos.',
    doc: v => /^\d{6,10}$/.test(v) ? '' : 'Documento de 6 a 10 dígitos, sin puntos.',
    birth: v => !v ? 'Indica tu fecha de nacimiento.' : (age(v) < 18 ? 'Debes ser mayor de 18 años.' : (age(v) > 80 ? 'Revisa la fecha ingresada.' : '')),
    phone: v => /^3\d{9}$/.test(v) ? '' : 'Celular colombiano de 10 dígitos (ej. 3001234567).',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Ingresa un correo válido.'
  };

  function validateStep1() {
    let ok = true;
    [['f-name', 'name'], ['f-doc', 'doc'], ['f-birth', 'birth'], ['f-phone', 'phone'], ['f-email', 'email']].forEach(([id, r]) => {
      const i = $('#' + id); ok = setError(i, rules[r](i.value)) && ok;
    });
    if (!data.otpOk) { setError($('#f-otp'), 'Verifica tu celular con el código SMS.'); ok = false; }
    const c = $('#f-consent');
    if (!c.checked) { setError(c, 'Debes autorizar el tratamiento de datos para continuar.'); ok = false; } else setError(c, '');
    return ok;
  }
  function validateStep2() {
    const missing = ['income', 'job', 'purpose'].filter(k => !data[k]);
    $$('.chip-group').forEach(g => {
      const bad = missing.includes(g.dataset.field);
      g.classList.toggle('group-invalid', bad);
    });
    if (missing.length) FL.toast('Selecciona una opción en cada pregunta.', 'warn');
    return !missing.length;
  }
  function validateStep3() {
    if (!data.front || !data.back) { FL.toast('Sube el frente y el dorso de tu documento.', 'warn'); return false; }
    if (!data.bio) { FL.toast('Completa la verificación facial para continuar.', 'warn'); return false; }
    return true;
  }

  /* ---------- navegación ---------- */
  function go(n) {
    step = n;
    $$('.wiz-panel').forEach(p => p.hidden = Number(p.dataset.step) !== n);
    $$('.step-dot').forEach(d => {
      const k = Number(d.dataset.step);
      d.classList.toggle('active', k === n); d.classList.toggle('done', k < n);
      d.setAttribute('aria-current', k === n ? 'step' : 'false');
    });
    $('#wiz-bar').style.width = ((n - 1) / 2 * 100) + '%';
    $('#wiz-prev').hidden = n === 1;
    $('#wiz-next-label').textContent = n === 3 ? 'Enviar solicitud' : 'Continuar';
    const first = $('.wiz-panel:not([hidden]) input, .wiz-panel:not([hidden]) button.chip');
    if (first && matchMedia('(min-width: 768px)').matches) first.focus({ preventScroll: true });
  }

  async function next() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3) { if (!validateStep3()) return; return submit(); }
    go(step + 1);
    $('#solicitud').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- OTP simulado ---------- */
  async function sendOtp() {
    const phone = $('#f-phone');
    if (!setError(phone, rules.phone(phone.value))) return;
    const btn = $('#otp-send'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const r = await FL.api.sendOtp(phone.value);
      $('#otp-box').hidden = false;
      $('#otp-hint').textContent = 'Modo demo: tu código es ' + r.demoCode;
      FL.toast('Código enviado por SMS (demo).');
      $('#f-otp').focus();
    } catch (e) { setError(phone, e.message); }
    btn.disabled = false; btn.textContent = 'Reenviar código';
  }
  async function verifyOtp() {
    const i = $('#f-otp');
    const ok = await FL.api.verifyOtp(i.value.trim());
    data.otpOk = ok;
    setError(i, ok ? '' : 'Código incorrecto. Intenta de nuevo.');
    if (ok) { $('#otp-status').hidden = false; $('#otp-box').hidden = true; $('#otp-send').hidden = true; FL.toast('Celular verificado ✓'); }
  }

  /* ---------- carga de documentos ---------- */
  function bindUpload(side) {
    const input = $('#f-' + side), pv = $('#pv-' + side), zone = input.closest('.dropzone');
    const handle = file => {
      if (!file) return;
      if (!/^image\//.test(file.type) || file.size > 8 * 1024 * 1024) { FL.toast('Sube una imagen (JPG/PNG) de máximo 8 MB.', 'warn'); return; }
      const url = URL.createObjectURL(file);
      pv.style.backgroundImage = `url("${url}")`;
      zone.classList.add('has-file');
      $('.dz-name', zone).textContent = file.name;
      data[side] = true;
    };
    input.addEventListener('change', () => handle(input.files[0]));
    ['dragover', 'dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', e => { input.files = e.dataTransfer.files; handle(e.dataTransfer.files[0]); });
  }

  async function runBiometric() {
    const btn = $('#bio-start'), st = $('#bio-status'), ring = $('#bio-ring');
    if (!data.front || !data.back) { FL.toast('Primero sube tu documento (frente y dorso).', 'warn'); return; }
    btn.disabled = true; ring.classList.add('scanning');
    const msgs = ['Detectando rostro…', 'Verificando prueba de vida…', 'Comparando con tu documento…', 'Cifrando evidencia…'];
    for (const m of msgs) { st.textContent = m; await FL.sleep(850); }
    ring.classList.remove('scanning'); ring.classList.add('ok');
    st.textContent = 'Identidad verificada · coincidencia 98 %';
    btn.textContent = 'Verificación completada'; data.bio = true;
  }

  /* ---------- envío, análisis y resultado ---------- */
  async function submit() {
    $('#wiz-form').hidden = true; $('#wiz-analyzing').hidden = false;
    $('#solicitud').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const stages = ['Validando identidad y documento', 'Consultando fuentes de información', 'Analizando perfil de riesgo…', 'Calculando tu mejor oferta'];
    const list = $('#an-list'); list.textContent = '';
    const items = stages.map(s => { const li = FL.el('li', 'an-item', s); list.appendChild(li); return li; });
    const sim = FL.simulator.get();
    const payload = {
      fullName: $('#f-name').value.trim(), docNumber: $('#f-doc').value.trim(), phone: $('#f-phone').value,
      income: data.income, job: data.job, purpose: data.purpose, amount: sim.amount, days: sim.days
    };
    const req = FL.api.submitApplication(payload);
    for (let i = 0; i < items.length; i++) {
      items[i].classList.add('run'); $('#an-bar').style.width = ((i + 1) / items.length * 100) + '%';
      await FL.sleep(1050); items[i].classList.remove('run'); items[i].classList.add('done');
    }
    const r = await req;
    showResult(r, payload);
  }

  function showResult(r, p) {
    $('#wiz-analyzing').hidden = true; $('#wiz-result').hidden = false;
    const q = r.quote;
    $('#res-name').textContent = p.fullName.split(' ')[0];
    FL.tween($('#res-amount'), q.amount, FL.money, 900);
    $('#res-total').textContent = FL.money(q.total);
    $('#res-days').textContent = q.days + ' días';
    $('#res-due').textContent = FL.date(q.dueDate);
    $('#res-rate').textContent = (q.monthlyRate * 100).toFixed(1).replace('.', ',') + ' % mensual';
    $('#res-id').textContent = r.loanId;
    $('#res-note').textContent = r.adjusted
      ? `Ajustamos tu oferta de ${FL.money(r.requested)} a ${FL.money(q.amount)} según tu capacidad de pago. Puedes volver a pedir más cuando pagues a tiempo.`
      : 'Tu solicitud fue aprobada por el monto que pediste. Sin letra pequeña.';
    $('#res-pay').dataset.doc = p.docNumber;
    launchConfetti();
  }

  function launchConfetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = $('#confetti'); box.textContent = '';
    const colors = ['#2ee6a6', '#22d3ee', '#a3e635', '#ffffff'];
    for (let i = 0; i < 38; i++) {
      const s = FL.el('i'); s.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % 4]};animation-delay:${Math.random() * .6}s;animation-duration:${1.6 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)`;
      box.appendChild(s);
    }
    setTimeout(() => box.textContent = '', 3500);
  }

  function reset() {
    Object.assign(data, { income: null, job: null, purpose: null, otpOk: false, front: false, back: false, bio: false });
    $('#wiz-form').reset(); $$('.chip[aria-pressed="true"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    $$('.dropzone').forEach(z => { z.classList.remove('has-file'); $('.dz-preview', z).style.backgroundImage = ''; });
    $('#otp-status').hidden = true; $('#otp-send').hidden = false; $('#otp-send').textContent = 'Enviar código';
    $('#bio-start').disabled = false; $('#bio-start').textContent = 'Iniciar verificación facial'; $('#bio-ring').classList.remove('ok');
    $('#bio-status').textContent = 'Necesitaremos tu cámara o una selfie.';
    $('#wiz-result').hidden = true; $('#wiz-analyzing').hidden = true; $('#wiz-form').hidden = false; $('#an-bar').style.width = '0';
    go(1);
  }

  function init() {
    // inputs numéricos solo dígitos
    ['f-doc', 'f-phone', 'f-otp'].forEach(id => $('#' + id).addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '')));
    // validación en vivo al salir del campo
    [['f-name', 'name'], ['f-doc', 'doc'], ['f-birth', 'birth'], ['f-phone', 'phone'], ['f-email', 'email']].forEach(([id, r]) =>
      $('#' + id).addEventListener('blur', e => e.target.value && setError(e.target, rules[r](e.target.value))));
    $('#f-birth').max = FL.addDays(new Date(), -365 * 18).toISOString().slice(0, 10);

    $$('.chip-group').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      $$('.chip', g).forEach(c => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true'); data[g.dataset.field] = b.dataset.value; g.classList.remove('group-invalid');
    }));

    $('#otp-send').addEventListener('click', sendOtp);
    $('#otp-verify').addEventListener('click', verifyOtp);
    $('#f-otp').addEventListener('input', e => e.target.value.length === 6 && verifyOtp());
    bindUpload('front'); bindUpload('back');
    $('#bio-start').addEventListener('click', runBiometric);
    $('#wiz-next').addEventListener('click', next);
    $('#wiz-prev').addEventListener('click', () => go(step - 1));
    $('#wiz-form').addEventListener('submit', e => { e.preventDefault(); next(); });
    $('#res-restart').addEventListener('click', reset);
    $('#res-pay').addEventListener('click', e => {
      document.dispatchEvent(new CustomEvent('fl:goto-payment', { detail: e.currentTarget.dataset.doc }));
    });
    document.addEventListener('fl:quote', e => {
      const q = e.detail;
      $('#wiz-sum').textContent = `${FL.money(q.amount)} · ${q.days} días · pagas ${FL.money(q.total)}`;
    });
    go(1);
  }
  return { init };
})();
