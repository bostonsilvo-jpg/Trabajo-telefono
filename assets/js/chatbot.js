/* Chatbot de atención inicial (reglas por palabras clave) con escalamiento a WhatsApp. */
window.FL = window.FL || {};
FL.chatbot = (function () {
  const { $ } = FL;

  const KB = [
    { k: ['requisito', 'necesito', 'documento', 'papeles'], a: 'Solo necesitas: ser mayor de 18 años, cédula de ciudadanía o extranjería vigente, un celular a tu nombre y una cuenta o billetera (Nequi, DaviPlata o bancaria) para recibir el dinero. Cero papeleo físico.' },
    { k: ['tasa', 'interes', 'interés', 'costo', 'cuanto cuesta', 'cuánto cuesta'], a: 'Te mostramos todo antes de aceptar: interés del ' + (FL.config.loan.monthlyRate * 100).toFixed(1).replace('.', ',') + ' % mensual + una tarifa de servicio con IVA. Lo ves desglosado en el simulador, sin costos ocultos.' },
    { k: ['mora', 'atraso', 'tarde', 'retraso'], a: 'Si te atrasas se cobra un recargo diario de mora sobre la cuota vencida y se reporta según la ley. Si prevés un retraso, escríbenos por WhatsApp antes del vencimiento: podemos ayudarte a reprogramar.' },
    { k: ['pagar', 'pago', 'pse', 'nequi', 'daviplata', 'tarjeta', 'cuota'], a: 'Paga en segundos desde “Centro de pagos”: ingresa tu cédula y elige PSE, Nequi, DaviPlata, tarjeta o pasarela global. El comprobante llega al instante.', go: '#pagos' },
    { k: ['desembolso', 'cuando llega', 'cuándo llega', 'tiempo', 'demora', 'rapido', 'rápido'], a: 'La solicitud toma ~3 minutos y la respuesta es inmediata. Si te aprueban, el desembolso se hace a tu cuenta o billetera en minutos, 24/7.' },
    { k: ['solicitar', 'prestamo', 'préstamo', 'credito', 'crédito', 'quiero'], a: '¡Perfecto! Elige monto y plazo en el simulador y pulsa “Solicitar mi préstamo en 3 minutos”.', go: '#solicitud' },
    { k: ['seguro', 'segur', 'datos', 'privacidad', 'confiable'], a: 'Tu información viaja cifrada (TLS 1.3) y se trata conforme a la Ley 1581 de 2012 de protección de datos personales. Nunca te pediremos claves ni PIN por chat.' },
    { k: ['hola', 'buenas', 'buenos', 'hey'], a: '¡Hola! 👋 Soy Nubi, el asistente virtual. ¿En qué te ayudo?' }
  ];
  const QUICK = ['¿Qué requisitos necesito?', '¿Cuánto cuesta?', '¿Cómo pago mi cuota?', '¿Y si me atraso?'];

  function bubble(text, who) {
    const b = FL.el('div', 'bub ' + who, text);
    const log = $('#chat-log'); log.appendChild(b); log.scrollTop = log.scrollHeight; return b;
  }
  function typing() {
    const t = FL.el('div', 'bub bot typing'); t.append(FL.el('i'), FL.el('i'), FL.el('i'));
    const log = $('#chat-log'); log.appendChild(t); log.scrollTop = log.scrollHeight; return t;
  }
  function waLink(text) { return `https://wa.me/${FL.config.whatsapp.phone}?text=${encodeURIComponent(text)}`; }

  function addHandoff() {
    const a = FL.el('a', 'bub-action', '💬 Hablar con un asesor por WhatsApp');
    a.href = waLink('Hola, vengo del chat del sitio y necesito hablar con un asesor.'); a.target = '_blank'; a.rel = 'noopener';
    $('#chat-log').appendChild(a); $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  }

  async function ask(text) {
    text = text.trim(); if (!text) return;
    bubble(text, 'me'); $('#chat-input').value = '';
    const t = typing(); await FL.sleep(600 + Math.random() * 500); t.remove();
    const q = text.toLowerCase();
    const hit = KB.find(e => e.k.some(w => q.includes(w)));
    if (hit) {
      bubble(hit.a, 'bot');
      if (hit.go) { const b = FL.el('a', 'bub-action', 'Ir a la sección →'); b.href = hit.go; $('#chat-log').appendChild(b); }
    } else {
      bubble('Aún estoy aprendiendo y no quiero darte información errónea. Un asesor humano puede ayudarte ahora mismo:', 'bot'); addHandoff();
    }
  }

  function toggle(open) {
    const w = $('#chat-window'); open = open ?? w.hidden;
    w.hidden = !open; $('#chat-toggle').setAttribute('aria-expanded', String(open));
    $('#chat-dot').hidden = true;
    if (open) { if (!$('#chat-log').children.length) greet(); $('#chat-input').focus(); }
  }
  function greet() {
    bubble('¡Hola! Soy Nubi 🤖, tu asistente 24/7. Resuelvo dudas al instante o te paso con un asesor.', 'bot');
    const q = $('#chat-quick'); q.textContent = '';
    QUICK.forEach(t => { const b = FL.el('button', 'chip sm', t); b.type = 'button'; b.addEventListener('click', () => ask(t)); q.appendChild(b); });
  }

  function init() {
    $('#chat-toggle').addEventListener('click', () => toggle());
    $('#chat-close').addEventListener('click', () => toggle(false));
    $('#chat-form').addEventListener('submit', e => { e.preventDefault(); ask($('#chat-input').value); });
    $('#chat-human').addEventListener('click', () => { bubble('Te conecto con un asesor humano.', 'bot'); addHandoff(); });
    document.addEventListener('keydown', e => e.key === 'Escape' && !$('#chat-window').hidden && toggle(false));
    setTimeout(() => { if ($('#chat-window').hidden) $('#chat-dot').hidden = false; }, 9000);
  }
  return { init, waLink };
})();
