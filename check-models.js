import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lista de modelos comunes para probar
const modelosAProbar = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash-001"
];

async function verificarModelos() {
  for (const nombreModelo of modelosAProbar) {
    try {
      console.log(`🔄 Probando: ${nombreModelo}...`);
      const model = genAI.getGenerativeModel({ model: nombreModelo });
      const result = await model.generateContent("Di solo: OK");
      const response = await result.response;
      console.log(`✅ ÉXITO con: ${nombreModelo} -> Respuesta: ${response.text()}`);
      console.log(`\n🎯 USA ESTE MODELO en tu index.js: "${nombreModelo}"`);
      return; // Salir al encontrar el primero que funcione
    } catch (error) {
      console.log(`❌ Falló ${nombreModelo}: ${error.message.split('\n')[0]}`);
    }
  }
  console.log("\n💥 Ningún modelo funcionó. Revisa tu API Key en https://aistudio.google.com/");
}

verificarModelos();