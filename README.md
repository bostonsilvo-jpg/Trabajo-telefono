# Nubo · Plataforma de préstamos digitales (frontend + backend simulado)

Sitio estático mobile-first, modo oscuro, sin paso de build. Ábrelo con doble clic en `index.html`
o sírvelo: `python3 -m http.server 8080` → http://localhost:8080

## Estructura
```
index.html              Maquetación semántica, SEO (meta/OG/JSON-LD), Tailwind vía CDN
assets/css/styles.css   Componentes y animaciones (sliders, stepper, chat, modal…)
assets/js/config.js     Marca, tasas, límites, número de WhatsApp  ← edita aquí
assets/js/utils.js      Helpers (moneda COP, fechas, toasts, tween numérico)
assets/js/api.js        Backend simulado (cotización, OTP, motor de decisión, cuentas, pagos) + localStorage
assets/js/simulator.js  Simulador: sliders y desglose en tiempo real
assets/js/wizard.js     Solicitud en 3 pasos, validaciones, biometría simulada, análisis y aprobación
assets/js/payments.js   Pago rápido, estado de cuenta en vivo, métodos PSE/Nequi/DaviPlata/tarjeta/global
assets/js/faq.js        Acordeón accesible
assets/js/chatbot.js    Chatbot por reglas + escalamiento a WhatsApp
assets/js/main.js       Arranque, menú, animaciones de scroll
```

## Pruebas rápidas
- Cuenta demo para pagos: cédula `1000000001`.
- OTP: en modo demo el código se muestra bajo el campo.
- Cambia el número de WhatsApp en `config.js` (`573001234567`).

## Pasar a producción
`api.js` es la única capa a reemplazar: cada método mapea a un endpoint REST
(`POST /v1/quotes`, `/v1/otp`, `/v1/applications`, `GET /v1/accounts/:id`, `POST /v1/payments`).
Notas: la cotización, la decisión de crédito, el OTP y los pagos deben calcularse **en servidor**;
usar pasarela certificada (PSE/Wompi/PayU/etc.) para tarjetas; completar textos legales (razón social,
tasa máxima legal vigente, PQR). Todas las cifras de este repo son ilustrativas.
Para optimizar velocidad: compilar Tailwind (purge) en lugar del CDN y minificar JS/CSS.
