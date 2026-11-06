/* Configuración central. Cambia aquí marca, tasas y canales. */
window.FL = window.FL || {};
FL.config = {
  brand: 'Nubo',
  currency: 'COP',
  locale: 'es-CO',
  whatsapp: {
    phone: '573001234567', // <-- reemplaza por tu número (código país + número)
    message: '¡Hola! Quiero asesoría para un préstamo rápido'
  },
  loan: {
    minAmount: 100000,
    maxAmount: 2000000,
    stepAmount: 50000,
    minDays: 7,
    maxDays: 90,
    monthlyRate: 0.019,     // 1,9 % mensual (ilustrativo)
    serviceFeePct: 0.04,    // 4 % del capital
    serviceFeeMin: 6000,
    vatPct: 0.19            // IVA sobre tarifa de servicio
  },
  lateFeeDailyPct: 0.0008,  // recargo de mora ilustrativo por día
  demoAccount: '1000000001'
};
