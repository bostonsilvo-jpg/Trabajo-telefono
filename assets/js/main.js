/* Punto de entrada: inicializa módulos y comportamientos globales. */
(function () {
  const { $, $$ } = FL;
  document.addEventListener('DOMContentLoaded', () => {
    FL.simulator.init();
    FL.wizard.init();
    FL.payments.init();
    FL.faq.init();
    FL.chatbot.init();

    // Enlaces de WhatsApp (flotante + footer)
    $$('[data-wa]').forEach(a => {
      a.href = FL.chatbot.waLink(FL.config.whatsapp.message); a.target = '_blank'; a.rel = 'noopener';
    });

    // Menú móvil
    const btn = $('#menu-btn'), menu = $('#mobile-menu');
    btn.addEventListener('click', () => { const o = menu.hidden; menu.hidden = !o; btn.setAttribute('aria-expanded', String(o)); });
    $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }));

    // Header con blur al hacer scroll
    const header = $('#site-header');
    const onScroll = () => header.classList.toggle('scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // Animaciones de entrada
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
      $$('.reveal').forEach(el => io.observe(el));
    } else $$('.reveal').forEach(el => el.classList.add('in'));

    $('#year').textContent = new Date().getFullYear();
  });
})();
