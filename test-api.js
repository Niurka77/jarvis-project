import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config();

console.log("🔑 Verificando configuración...");
console.log("API Key inicia con:", process.env.GEMINI_API_KEY?.substring(0, 10));

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ⚠️ CAMBIO CLAVE: Usar el nombre exacto del modelo disponible
// Probamos primero con gemini-1.5-flash (el estándar actual)
const model = genAI.getGenerativeModel({ 
  model: "gemini-flash-latest",
  generationConfig: {
    responseMimeType: "application/json", // Forzamos JSON nativo
  }
});

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Función principal
async function procesarComandoJarvis(comando) {
  console.log("\n🤖 Jarvis escuchando...");

  try {
    // Prompt más directo
    const prompt = `Eres un asistente que guarda datos. Responde ÚNICAMENTE con este formato JSON válido, sin markdown ni texto extra:
{
  "content": "resumen del comando",
  "category": "personal",
  "metadata": {
    "tags": ["tag1", "tag2"]
  }
}

Comando del usuario: ${comando}`;
    
    console.log("🔄 Consultando a Gemini...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textoIA = response.text();

    console.log("📩 Respuesta raw de IA:", textoIA.substring(0, 100) + "...");

    // Limpieza de JSON
    const inicio = textoIA.indexOf('{');
    const fin = textoIA.lastIndexOf('}') + 1;
    
    if (inicio === -1 || fin === 0) {
      throw new Error("La IA no devolvió un JSON válido");
    }

    const datosExtraidos = JSON.parse(textoIA.substring(inicio, fin));

    console.log("💾 Guardando en Supabase...");
    
    const { data, error } = await supabase
      .from("jarvis_memory")
      .insert([{
          content: datosExtraidos.content,
          category: datosExtraidos.category,
          metadata: datosExtraidos.metadata
      }])
      .select();

    if (error) throw error;
    console.log("✅ ¡ÉXITO! Revisa tu Table Editor en Supabase.");
    return data;

  } catch (error) {
    console.error("❌ ERROR DETECTADO:", error.message);
    console.error("Detalles completos:", error);
    
    if (error.message.includes("404")) {
      console.log("\n💡 POSIBLE CAUSA: El modelo no está disponible. Intenta cambiar 'gemini-1.5-pro' por 'gemini-pro' en el código.");
    }
    if (error.message.includes("429")) {
      console.log("💡 Tip: Espera 60 segundos, la API gratuita está saturada.");
    }
  }
}

// Ejecutar
const comando = "Jarvis, guarda que soy Niurka, Ingeniera de Software de Chiclayo y hoy empecé mi proyecto";

procesarComandoJarvis(comando)
  .then(() => {
    console.log("🌟 Proceso completado. Jarvis en espera.\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Jarvis no pudo completar la tarea.");
    process.exit(1);
  });