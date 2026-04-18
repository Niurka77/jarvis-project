// src/index.js
// PRIMERO: cargar variables de entorno
import dotenv from 'dotenv';
dotenv.config();

// SEGUNDO: ahora sí importar el servidor
import('./server.js').then(() => {
  console.log('🚀 Jarvis iniciado correctamente');
}).catch(err => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});