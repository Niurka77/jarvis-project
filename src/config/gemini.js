// src/config/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Modelo estable + configuración compatible
export const model = genAI.getGenerativeModel({ 
  model: "gemini-flash-latest",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.7,
  }
});

export default genAI;
