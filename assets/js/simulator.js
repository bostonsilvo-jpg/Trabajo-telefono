/* Simulador de crédito: sliders + desglose en tiempo real. */
window.FL = window.FL || {};
FL.simulator = (function () {
  const { $, $$ } = FL;
  const state = { amount: 500000, days: 30, quote: null };
  let els;

  function setFill(input) {
    const p = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--p', p + '%');
  }

  function render() {
    const q = state.quote = FL.api.quote(state.amount, state.days);
    FL.tween(els.amountOut, q.amount);
    els.daysOut.textContent = q.days + (q.days === 1 ? ' día' : ' días');
    els.monthsOut.textContent = q.days >= 30 ? '≈ ' + (q.days / 30).toFixed(1).replace('.', ',') + ' meses' : 'menos de 1 mes';
    FL.tween(els.capital, q.amount);
    FL.tween(els.interest, q.interest);
    FL.tween(els.fee, q.fee);
    FL.tween(els.total, q.total, FL.money, 450);
    els.rate.textContent = (q.monthlyRate * 100).toFixed(1).replace('.', ',') + ' % mensual';
    els.due.textContent = FL.date(q.dueDate);
    $$('.term-chip').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.days) === state.days)));
    setFill(els.amount); setFill(els.days);
    document.dispatchEvent(new CustomEvent('fl:quote', { detail: q }));
  }

  function init() {
    const L = FL.config.loan;
    els = {
      amount: $('#sim-amount'), days: $('#sim-days'),
      amountOut: $('#out-amount'), daysOut: $('#out-days'), monthsOut: $('#out-months'),
      capital: $('#bk-capital'), interest: $('#bk-interest'), fee: $('#bk-fee'),
      total: $('#bk-total'), rate: $('#bk-rate'), due: $('#bk-due')
    };
    Object.assign(els.amount, { min: L.minAmount, max: L.maxAmount, step: L.stepAmount, value: state.amount });
    Object.assign(els.days, { min: L.minDays, max: L.maxDays, step: 1, value: state.days });
    $('#min-amount').textContent = FL.money(L.minAmount);
    $('#max-amount').textContent = FL.money(L.maxAmount);

    els.amount.addEventListener('input', e => { state.amount = +e.target.value; render(); });
    els.days.addEventListener('input', e => { state.days = +e.target.value; render(); });
    $$('.term-chip').forEach(c => c.addEventListener('click', () => { state.days = +c.dataset.days; els.days.value = state.days; render(); }));
    $('#sim-cta').addEventListener('click', () => { document.getElementById('solicitud').scrollIntoView({ behavior: 'smooth' }); });
    render();
  }

  return { init, get: () => ({ ...state }) };
})();
