import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { inicializarWhatsApp } from './services/whatsapp.js';
import { generarRespuestaSugerida } from './services/ai.js';
import { crearRecordatorio } from './services/scheduler.js';
import { supabase } from './config/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws'; // ✅ Import corregido (arriba del todo)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// === VARIABLES DE VOSK ===
let voiceSocket = null;
const VOSK_WS_URL = 'ws://localhost:5001';

// === FUNCIÓN PARA CONECTAR AL SERVICIO DE VOZ ===
function connectToVoiceService() {
  try {
    voiceSocket = new WebSocket(VOSK_WS_URL);
    
    voiceSocket.on('open', () => {
      console.log('✅ Conectado al servicio de voz Vosk');
      voiceSocket.send(JSON.stringify({ type: 'config', sampleRate: 16000 }));
    });
    
    voiceSocket.on('message', async (data) => {
  try {
    const result = JSON.parse(data.toString());
    if (result.final && result.text) {
      const textoReconocido = result.text.trim();
      console.log(`🎯 Voz reconocida: "${textoReconocido}"`);
      
      // ✅ 1. Emitir al frontend para que se muestre en el chat
      io.emit('voice:resultado', { text: textoReconocido });
      
      // ✅ 2. Procesar con IA como si fuera un mensaje normal
      const respuesta = await generarRespuestaSugerida(textoReconocido);
      
      // ✅ 3. Guardar en Supabase
      if (respuesta) {
        await supabase.from('jarvis_memory').insert([{
          content: textoReconocido,
          category: 'voice',
          metadata: { respuesta: respuesta.respuesta }
        }]);
      }
      
      // ✅ 4. Emitir respuesta al frontend (para que Jarvis "hable")
      io.emit('jarvis:respuesta', respuesta);
    }
  } catch (e) {
    console.error('❌ Error procesando voz:', e);
  }
});
    
    voiceSocket.on('error', (err) => {
      console.error('❌ Error en conexión Vosk:', err.message);
      console.log('💡 Asegúrate de ejecutar: python src/voice-service.py');
    });
    
    voiceSocket.on('close', () => {
      console.log('🔌 Desconectado de Vosk. Reconectando en 5s...');
      setTimeout(connectToVoiceService, 5000);
    });
    
  } catch (err) {
    console.error('❌ No se pudo conectar al servicio de voz:', err);
  }
}

// ✅ FUNCIÓN PARA RECIBIR AUDIO DEL FRONTEND Y ENVIARLO A VOSK
export function sendAudioToVosk(audioBuffer) {
  if (voiceSocket && voiceSocket.readyState === WebSocket.OPEN) {
    voiceSocket.send(audioBuffer);
    return true;
  }
  return false;
}

// Socket.io
io.on('connection', (socket) => {
  console.log(' Cliente conectado al Centro de Control');
  
  // Recibir mensaje del usuario
  socket.on('jarvis:mensaje', async (data) => {
    const { mensaje } = data;
    
    // Procesar con IA
    const respuesta = await generarRespuestaSugerida(mensaje);
    
    // Guardar en Supabase
    if (respuesta) {
      await supabase.from('jarvis_memory').insert([{
        content: mensaje,
        category: 'chat',
        metadata: { respuesta: respuesta.respuesta }
      }]);
    }
    
    socket.emit('jarvis:respuesta', respuesta);
  });
  
  // ✅ RECIBIR AUDIO DEL FRONTEND
  socket.on('voice:audio', (audioBuffer) => {
    sendAudioToVosk(audioBuffer);
  });
  
  // Crear recordatorio
  socket.on('jarvis:recordatorio', async (data) => {
    const { hora, mensaje } = data;
    const cliente = await import('./services/whatsapp.js').then(m => m.getClient());
    
    crearRecordatorio({ hora, mensaje, cliente });
    
    socket.emit('jarvis:confirmacion', {
      mensaje: `✅ Recordatorio creado para las ${hora}`
    });
  });
});

// ✅ CONECTAR AL SERVICIO DE VOZ AL INICIAR
connectToVoiceService();

// Inicializar WhatsApp
inicializarWhatsApp(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Centro de Control Jarvis corriendo en http://localhost:${PORT}`);
  console.log(`🎤 Servicio de voz: ${voiceSocket ? 'Conectando...' : 'Iniciando...'}`);
});

export default app;