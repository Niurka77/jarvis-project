import { model } from '../config/gemini.js';

export async function generarRespuestaSugerida(mensaje, contexto = '') {
  const prompt = `Eres un asistente inteligente llamado Jarvis. 
  Contexto: ${contexto}
  
  Mensaje recibido: "${mensaje}"
  
  Responde ÚNICAMENTE en JSON:
  {
    "respuesta": "tu respuesta natural y útil",
    "accion_sugerida": "qué debería hacer el usuario",
    "prioridad": "alta|media|baja"
  }`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const texto = response.text();
    
    // Limpiar JSON
    const inicio = texto.indexOf('{');
    const fin = texto.lastIndexOf('}') + 1;
    return JSON.parse(texto.substring(inicio, fin));
  } catch (error) {
    console.error("❌ Error en IA:", error.message);
    return null;
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