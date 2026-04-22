// src/utils/apiMonitor.js
let requestCount = 0;
let errorCount = 0;
let lastReset = Date.now();

export function registrarLlamada(success = true) {
  requestCount++;
  if (!success) errorCount++;
  
  // Resetear cada hora
  if (Date.now() - lastReset > 60 * 60 * 1000) {
    requestCount = 0;
    errorCount = 0;
    lastReset = Date.now();
  }
}

export function getStats() {
  return {
    total: requestCount,
    errores: errorCount,
    tasaExito: ((requestCount - errorCount) / requestCount * 100).toFixed(2) + '%',
    desde: new Date(lastReset).toLocaleTimeString()
  };
}