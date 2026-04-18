// src/config/gemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",  // ← ¡ESTE ES EL CORRECTO!
  generationConfig: {
    responseMimeType: "application/json",
  }
});

export default genAI;