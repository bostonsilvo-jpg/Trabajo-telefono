/*
 * Backend simulado (capa de servicios).
 * Cada método devuelve una Promise con latencia artificial, igual que lo haría fetch().
 * Para producción, reemplaza el cuerpo de cada método por una llamada REST a tu API:
 *   POST /v1/quotes · POST /v1/otp · POST /v1/applications · GET /v1/accounts/:id · POST /v1/payments
 * Persistencia demo: localStorage (clave "nubo.db"). Nunca se guardan datos de tarjeta.
 */
window.FL = window.FL || {};
(function () {
  const C = FL.config, KEY = 'nubo.db';

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };

  function demoAccount() {
    const t = new Date();
    return {
      id: C.demoAccount, name: 'Camila Rojas', ref: 'NB-48213', principal: 600000,
      installments: [
        { n: 1, due: FL.addDays(t, -27).toISOString(), amount: 232000, status: 'paid' },
        { n: 2, due: FL.addDays(t, 3).toISOString(), amount: 232000, status: 'pending' },
        { n: 3, due: FL.addDays(t, 33).toISOString(), amount: 232000, status: 'pending' }
      ],
      history: [{ date: FL.addDays(t, -28).toISOString(), concept: 'Pago cuota 1/3', method: 'Nequi', amount: 232000, receipt: 'RC-771204' }]
    };
  }

  function getDb() {
    const db = load(); db.accounts = db.accounts || {};
    if (!db.accounts[C.demoAccount]) db.accounts[C.demoAccount] = demoAccount();
    return db;
  }

  /** Cotización: interés diario sobre capital + tarifa de servicio (con IVA). */
  function quote(amount, days) {
    const L = C.loan;
    const interest = Math.round(amount * L.monthlyRate * days / 30);
    const fee = Math.max(L.serviceFeeMin, Math.round(amount * L.serviceFeePct));
    const vat = Math.round(fee * L.vatPct);
    const total = amount + interest + fee + vat;
    return { amount, days, interest, fee: fee + vat, feeNet: fee, vat, total, dueDate: FL.addDays(new Date(), days), monthlyRate: L.monthlyRate };
  }

  function accrued(inst) {
    const late = FL.daysBetween(inst.due, new Date());
    if (inst.status === 'paid' || late <= 0) return 0;
    return Math.round(inst.amount * C.lateFeeDailyPct * late);
  }

  const api = {
    quote,
    accrued,

    async sendOtp(phone) {
      await FL.sleep(700);
      if (!/^3\d{9}$/.test(phone)) throw new Error('Celular inválido');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      sessionStorage.setItem('nubo.otp', code);
      return { demoCode: code }; // En producción NUNCA se devuelve el código.
    },
    async verifyOtp(code) {
      await FL.sleep(500);
      return code === sessionStorage.getItem('nubo.otp');
    },

    /** Motor de decisión simulado: capacidad = % del ingreso mensual. */
    async submitApplication(app) {
      await FL.sleep(300);
      const mid = { lt1: 800000, '1to2': 1500000, '2to4': 3000000, gt4: 5000000 }[app.income] || 800000;
      const cap = Math.max(C.loan.minAmount, Math.floor(mid * 0.8 / C.loan.stepAmount) * C.loan.stepAmount);
      const amount = Math.min(app.amount, cap);
      const q = quote(amount, app.days);
      const loanId = 'NB-' + Math.floor(10000 + Math.random() * 89999);
      const account = {
        id: app.docNumber, name: app.fullName, ref: loanId, principal: amount,
        installments: [{ n: 1, due: q.dueDate.toISOString(), amount: q.total, status: 'pending' }],
        history: []
      };
      const db = getDb(); db.accounts[app.docNumber] = account; save(db);
      return { approved: true, adjusted: amount < app.amount, requested: app.amount, quote: q, loanId, score: 700 + Math.floor(Math.random() * 120) };
    },

    async getAccount(idOrRef) {
      await FL.sleep(650);
      const key = String(idOrRef).trim().toUpperCase();
      const db = getDb();
      const acc = Object.values(db.accounts).find(a => a.id === key || a.ref.toUpperCase() === key);
      if (!acc) throw new Error('No encontramos un crédito con ese dato. Prueba con la cédula demo ' + C.demoAccount + '.');
      return JSON.parse(JSON.stringify(acc));
    },

    /** Aplica el pago a las cuotas pendientes en orden. */
    async pay({ id, amount, method }) {
      await FL.sleep(1800);
      const db = getDb(); const acc = db.accounts[id];
      if (!acc) throw new Error('Cuenta no encontrada');
      let left = amount;
      for (const i of acc.installments) {
        if (i.status === 'paid') continue;
        const owed = i.amount + accrued(i);
        if (left >= owed) { left -= owed; i.status = 'paid'; i.paidAt = new Date().toISOString(); }
        else if (left > 0) { i.amount = owed - left; i.due = i.due; left = 0; }
      }
      const receipt = 'RC-' + Math.floor(100000 + Math.random() * 899999);
      acc.history.unshift({ date: new Date().toISOString(), concept: 'Pago de cuota', method, amount, receipt });
      save(db);
      return { receipt, amount, method, date: new Date().toISOString(), account: JSON.parse(JSON.stringify(acc)) };
    }
  };
  FL.api = api;
})();
