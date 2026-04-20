// src/index.js
import 'dotenv/config';  // ← PRIMERO cargar variables
import app from './server.js';

const PORT = process.env.PORT || 3000;
console.log('✅ Variables de entorno cargadas');
console.log('🔑 GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Configurada ✓' : '❌ NO configurada');