# 🗣️ Jarvis Project

Asistente de voz y automatización conversacional con **Gemini AI**, mensajería por **WhatsApp**, calendario y tareas programadas. Interactúa por voz o por chat, y responde usando IA en tiempo real.

## ✨ Funcionalidades

- 🎙️ **Comandos por voz** — servicios de voz en tiempo real (`voice-service.py`)
- 💬 **Respuestas con IA** — integración con Gemini (`gemini.js`)
- 📲 **Integración con WhatsApp** — envía y responde mensajes automáticamente
- ⏰ **Tareas programadas** — automatizaciones con `node-cron` y recordatorios
- 🗄️ **Persistencia** — base de datos con Supabase (`supabase.js`)

## 🚀 Instalación

```bash
npm install
# Si quieres usar los servicios de voz:
pip install -r requirements.txt  # voz
```

## 🧪 Uso

```bash
# Servidor principal
npm start

# Solo servicios de voz (Python)
npm run voice

# Ambos en desarrollo
npm run dev
```

## 🔑 Variables de entorno

Crea un archivo `.env` en la raíz:

```
GEMINI_API_KEY=tu_api_key_aqui
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## 🛠️ Stack

`Node.js` · `Express` · `Socket.io` · `Gemini AI` · `Supabase` · `WhatsApp Web` · `node-cron` · `Python` (voz)

---

Desarrollado por **Niurka Guevara** · Ingeniería de Software con IA · enfocado en ecosistemas digitales inteligentes.