/* Acordeón accesible de preguntas frecuentes. */
window.FL = window.FL || {};
FL.faq = {
  init() {
    FL.$$('.faq-item').forEach(item => {
      const btn = FL.$('button', item), panel = FL.$('.faq-panel', item);
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        FL.$$('.faq-item').forEach(o => {
          FL.$('button', o).setAttribute('aria-expanded', 'false');
          FL.$('.faq-panel', o).style.maxHeight = null;
        });
        if (!open) { btn.setAttribute('aria-expanded', 'true'); panel.style.maxHeight = panel.scrollHeight + 'px'; }
      });
    });
  }
};
