import { model } from '../config/gemini.js';

// === 🗄️ CACHE PARA REDUCIR LLAMADAS A GEMINI (evita error 429) ===
const geminiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

export async function generarRespuestaSugerida(mensaje, contexto = '') {
  const maxIntentos = 3;
  let ultimoError = null;
  
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      // 🔍 Verificar caché primero
      const cacheKey = `${mensaje.toLowerCase().trim()}|${contexto}`;
      const cached = geminiCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('📦 Respuesta desde caché Gemini');
        return cached.data;
      }
      
      console.log(`🔄 Intento ${intento}/${maxIntentos} llamando a Gemini API...`);
      
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
      
      // 🧹 Limpieza inteligente de caché: eliminar entradas expiradas primero
      for (const [key, value] of geminiCache.entries()) {
        if (Date.now() - value.timestamp > CACHE_TTL) {
          geminiCache.delete(key);
        }
      }
      // Si aún está muy lleno, remover el más antiguo
      if (geminiCache.size > 50) {
        const oldestKey = geminiCache.keys().next().value;
        geminiCache.delete(oldestKey);
      }
      
      return resultado;
      
    } catch (error) {
      ultimoError = error;
      console.warn(`⚠️ Intento ${intento} falló: ${error.message}`);
      
      // Si es error 503, esperar antes de reintentar
      if (error.status === 503 || error.message?.includes('503')) {
        const espera = intento * 2000; // 2s, 4s, 6s
        console.log(`⏳ Esperando ${espera/1000}s antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, espera));
      } else {
        // Si es otro error, no esperar tanto
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Si todos los intentos fallaron, usar fallback inteligente
  console.error('❌ Todos los intentos a Gemini fallaron. Usando fallback.');
  
  // Fallback más inteligente basado en el mensaje
  const mensajeLower = mensaje.toLowerCase();
  
  if (mensajeLower.includes('mensaje') || mensajeLower.includes('nuevo')) {
    return {
      respuesta: "📬 Para ver tus mensajes nuevos, dime 'lee los de [nombre]' o '¿tengo mensajes pendientes?'",
      accion_sugerida: "Consultar mensajes pendientes",
      prioridad: "media"
    };
  }
  
  if (mensajeLower.includes('grupo')) {
    return {
      respuesta: "👥 Para revisar grupos, di 'mis grupos' o 'lista de grupos'",
      accion_sugerida: "Listar grupos",
      prioridad: "baja"
    };
  }
  
  return {
    respuesta: "🤖 La IA está temporalmente ocupada, pero sigo funcionando. Intenta de nuevo en unos minutos o usa comandos directos como 'lee los de [nombre]' o 'mis grupos'.",
    accion_sugerida: "Reintentar o usar comandos directos",
    prioridad: "media"
  };
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