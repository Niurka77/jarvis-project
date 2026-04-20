// ===== VARIABLES GLOBALES =====
let jarvisEstaHablando = false;
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { inicializarWhatsApp, getClient, isWhatsAppReady } from './services/whatsapp.js';
import { generarRespuestaSugerida } from './services/ai.js';
import { crearRecordatorio } from './services/scheduler.js';
import { supabase } from './config/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

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
          
          if (jarvisEstaHablando) {
            console.log('⏸️ Ignorando audio (Jarvis está hablando)');
            return;
          }
          
          const frasesDeJarvis = [
            'hola niurka', 'te escucho fuerte y claro', 'estoy a tu disposición',
            'en qué puedo ayudarte', 'es un gusto saludarte', 'jarvis está listo'
          ];
          
          const esFraseDeJarvis = frasesDeJarvis.some(frase => 
            textoReconocido.toLowerCase().includes(frase)
          );
          
          if (esFraseDeJarvis) {
            console.log('⏸️ Ignorando eco de Jarvis');
            return;
          }
          
          console.log(`🎯 Voz reconocida: "${textoReconocido}"`);
          io.emit('voice:resultado', { text: textoReconocido });
          
          const respuesta = await generarRespuestaSugerida(textoReconocido);
          
          if (respuesta) {
            await supabase.from('jarvis_memory').insert([{
              content: textoReconocido,
              category: 'voice',
              metadata: { respuesta: respuesta.respuesta }
            }]);
          }
          
          jarvisEstaHablando = true;
          io.emit('jarvis:respuesta', respuesta);
          
          setTimeout(() => {
            jarvisEstaHablando = false;
            console.log('✅ Jarvis terminó de hablar, micrófono activo');
          }, 5000);
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

export function sendAudioToVosk(audioBuffer) {
  if (voiceSocket && voiceSocket.readyState === WebSocket.OPEN) {
    voiceSocket.send(audioBuffer);
    return true;
  }
  return false;
}

// ===== CONEXIONES SOCKET.IO =====
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado al Centro de Control');
  
  // === MENSAJES DE TEXTO ===
  socket.on('jarvis:mensaje', async (data) => {
    const { mensaje } = data;
    const respuesta = await generarRespuestaSugerida(mensaje);
    
    if (respuesta) {
      await supabase.from('jarvis_memory').insert([{
        content: mensaje,
        category: 'chat',
        metadata: { respuesta: respuesta.respuesta }
      }]);
    }
    
    socket.emit('jarvis:respuesta', respuesta);
  });
  
  // === AUDIO DE VOZ ===
  socket.on('voice:audio', (audioBuffer) => {
    sendAudioToVosk(audioBuffer);
  });
  
  // === CREAR RECORDATORIO ===
  socket.on('jarvis:recordatorio', async (data) => {
    const { hora, mensaje } = data;
    const cliente = getClient();
    
    crearRecordatorio({ hora, mensaje, cliente });
    
    socket.emit('jarvis:confirmacion', {
      mensaje: `✅ Recordatorio creado para las ${hora}`
    });
  });
  
  // === ✅ CONSULTAS WHATSAPP ===
  socket.on('whatsapp:consulta', async (data) => {
    const { comando } = data;
    let respuesta = '';
    let hablar = true;
    
    try {
      // Verificar si WhatsApp está listo
      if (!isWhatsAppReady()) {
        respuesta = '⏳ WhatsApp aún se está inicializando... Escanea el QR en la terminal si es necesario.';
        socket.emit('whatsapp:respuesta', { mensaje: respuesta, hablar });
        return;
      }
      
      const client = getClient();
      
      if (!client?.info?.wid) {
        respuesta = '❌ WhatsApp no está conectado. Escanea el QR si es necesario.';
      } else {
        switch(comando.toLowerCase()) {
          case 'estado':
            respuesta = '✅ WhatsApp está conectado y funcionando correctamente.';
            break;
            
          case 'grupos':
          case 'mis grupos':
            const chats = await client.getChats();
            const grupos = chats.filter(c => c.isGroup).slice(0, 10);
            if (grupos.length > 0) {
              const nombres = grupos.map(g => `• ${g.name}`).join('\n');
              respuesta = `📱 Tus grupos (primeros 10):\n${nombres}`;
            } else {
              respuesta = '📭 No se encontraron grupos o aún no se han sincronizado.';
            }
            break;
            
          case 'chats':
          case 'últimos chats':
          case 'mis chats':
            const chats2 = await client.getChats();
            const recientes = chats2.filter(c => !c.isGroup).slice(0, 5);
            if (recientes.length > 0) {
              const lista = recientes.map(c => `• ${c.name || c.pushname || 'Contacto'}`).join('\n');
              respuesta = `💬 Últimos chats:\n${lista}`;
            } else {
              respuesta = '📭 No hay chats recientes disponibles.';
            }
            break;
            
          case 'mensajes nuevos':
          case 'nuevos mensajes':
          case 'hay mensajes':
            respuesta = '🔍 Revisando bandeja de entrada... (requiere configuración adicional)';
            break;
            
          case 'mi número':
          case 'mi whatsapp':
            const info = client.info;
            respuesta = `📱 Tu WhatsApp: ${info?.pushname || 'Usuario'}\nNúmero: ${info?.wid?.user || 'No disponible'}`;
            break;
            
          // === 🆕 COMANDO PARA ENVIAR MENSAJES ===
          case 'enviar mensaje':
          case 'mandar whatsapp':
          case 'escribir a':
            respuesta = '📝 Para enviar: "Jarvis, enviar a [nombre/número]: [tu mensaje]"';
            hablar = false;
            break;
            
          default:
            // Detectar si es comando de envío: "enviar a [contacto]: [mensaje]"
            const matchEnvio = comando.match(/(?:enviar|mandar|escribir)\s+(?:a\s+)?([^:]+):\s*(.+)/i);
            if (matchEnvio) {
              const [, contacto, texto] = matchEnvio;
              try {
                const client = getClient();
                const chats = await client.getChats();
                // Buscar contacto por nombre o número
                const destino = chats.find(c => 
                  (c.name?.toLowerCase().includes(contacto.trim().toLowerCase())) || 
                  (c.pushname?.toLowerCase().includes(contacto.trim().toLowerCase())) ||
                  c.id._serialized.includes(contacto.trim())
                );
                
                if (destino) {
                  await destino.sendMessage(texto.trim());
                  respuesta = `✅ Mensaje enviado a ${destino.name || destino.pushname || contacto}`;
                } else {
                  respuesta = `❌ No encontré "${contacto}" en tus chats. Prueba con el número completo.`;
                }
              } catch (err) {
                console.error('❌ Error enviando mensaje:', err);
                respuesta = '⚠️ Error al enviar. Verifica que el contacto exista.';
              }
            } else {
              respuesta = '❓ Comandos: "estado", "mis grupos", "últimos chats", "mi número", "enviar a [contacto]: [mensaje]"';
              hablar = false;
            }
        }
      }
    } catch (err) {
      console.error('❌ Error consultando WhatsApp:', err);
      respuesta = '⚠️ Error al consultar WhatsApp. Revisa la consola.';
    }
    
    socket.emit('whatsapp:respuesta', { mensaje: respuesta, hablar });
  });
});

// ===== INICIALIZACIÓN =====
connectToVoiceService();
inicializarWhatsApp(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Centro de Control Jarvis: http://localhost:${PORT}`);
  console.log(`🎤 Servicio de voz: ${voiceSocket ? 'Conectando...' : 'Iniciando...'}`);
});

export default app;