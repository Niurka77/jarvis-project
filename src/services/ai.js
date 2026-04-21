import { model } from '../config/gemini.js';

// === 🗄️ CACHE PARA REDUCIR LLAMADAS A GEMINI (evita error 429) ===
const geminiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

export async function generarRespuestaSugerida(mensaje, contexto = '') {
  try {
    // 🔍 Verificar caché primero
    const cacheKey = `${mensaje.toLowerCase().trim()}|${contexto}`;
    const cached = geminiCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Respuesta desde caché Gemini');
      return cached.data;
    }
    
    console.log('🔄 Intentando llamar a Gemini API...');
    console.log('📝 Mensaje:', mensaje);
    
    const prompt = `Eres Jarvis, asistente de Niurka. Responde en JSON:
{
  "respuesta": "tu respuesta útil y amigable",
  "accion_sugerida": "qué hacer",
  "prioridad": "alta|media|baja"
}
Mensaje: "${mensaje}"
Contexto: ${contexto}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();
    
    console.log('✅ Gemini respondió:', texto);
    
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}') + 1;
    const resultado = JSON.parse(texto.substring(inicio, fin));
    
    // 💾 Guardar en caché
    geminiCache.set(cacheKey, {
      data: resultado,
      timestamp: Date.now()
    });
    
    // 🧹 Limpiar caché antiguo (mantener máximo 50 entradas)
    if (geminiCache.size > 50) {
      const oldestKey = geminiCache.keys().next().value;
      geminiCache.delete(oldestKey);
    }
    
    return resultado;
    
  } catch (error) {
    // 🔴 LOG DETALLADO DEL ERROR
    console.error('❌ ERROR GEMINI DETALLADO:');
    console.error('📛 Message:', error.message);
    console.error('📛 Status:', error.status);
    console.error('📛 Stack:', error.stack);
    
    console.warn("⚠️ IA no disponible, usando respuesta fallback");
    
    return {
      respuesta: "🤖 Jarvis está en modo básico. La IA temporalmente no está disponible, pero sigo monitoreando tus grupos de WhatsApp.",
      accion_sugerida: "Intenta de nuevo en unos minutos o revisa la consola para detalles.",
      prioridad: "media"
    };
  }
}

export async function analizarMensajeGrupo(mensaje) {
  const prompt = `Analiza este mensaje de WhatsApp y decide si es importante para Niurka.
  Palabras clave: JNE, local de votación, capacitación, reunión, urgente, importante
  
  Mensaje: "${mensaje}"
  
  Responde en JSON:
  {
    "es_importante": true/false,
    "razon": "por qué es importante",
    "sugerencia_respuesta": "qué podría responder Niurka"
  }`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}') + 1;
    return JSON.parse(texto.substring(inicio, fin));
  } catch (error) {
    return { es_importante: false };
  }
}
