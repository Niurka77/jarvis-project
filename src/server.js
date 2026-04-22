// ===== VARIABLES GLOBALES =====
let jarvisEstaHablando = false;
import 'dotenv/config';

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { inicializarWhatsApp, getClient, isWhatsAppReady, obtenerMensajesPendientes, limpiarMensajesLeidos } from './services/whatsapp.js';
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
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// === 🧠 ESTADO CONVERSACIONAL POR USUARIO ===
const estadoUsuario = new Map();

// === VARIABLES DE VOSK ===
let voiceSocket = null;
const VOSK_WS_URL = 'ws://localhost:5001';

// === 🧰 FUNCIONES AUXILIARES ===

function normalizarTexto(texto) {
  if (!texto) return '';
  return texto.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function buscarContactoFuzzy(nombreBuscado, chats) {
  const buscado = normalizarTexto(nombreBuscado);
  if (!buscado) return null;
  
  let resultado = chats.find(c => 
    normalizarTexto(c.name) === buscado || 
    normalizarTexto(c.pushname) === buscado
  );
  if (resultado) return resultado;
  
  resultado = chats.find(c => 
    normalizarTexto(c.name)?.includes(buscado) || 
    normalizarTexto(c.pushname)?.includes(buscado)
  );
  if (resultado) return resultado;
  
  const palabrasBuscado = buscado.split(/\s+/).filter(p => p.length > 2);
  if (palabrasBuscado.length > 0) {
    resultado = chats.find(c => {
      const nombreNorm = normalizarTexto(c.name || c.pushname || '');
      return palabrasBuscado.every(p => nombreNorm.includes(p));
    });
    if (resultado) return resultado;
  }
  
  resultado = chats.find(c => c.id._serialized?.includes(nombreBuscado));
  return resultado || null;
}

async function refinarMensajeParaEnviar(mensajeOriginal, contextoContacto = '') {
  try {
    const prompt = `Eres la secretaria de Niurka. Tu trabajo:
1. Corregir ortografía y gramática
2. Mantener el tono original
3. Hacerlo claro y respetuoso
4. NO cambiar la intención

Mensaje original: "${mensajeOriginal}"
Para: ${contextoContacto || 'contacto de WhatsApp'}

Responde SOLO con el mensaje refinado.`;

    const { model } = await import('../config/gemini.js');
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch (e) {
    console.warn('⚠️ No se pudo refinar mensaje');
    return mensajeOriginal;
  }
}

// === 🔍 FUNCIÓN MEJORADA PARA LEER MENSAJES (SIN waitForChatLoading) ===
async function leerMensajesDeChat(chat, limite = 10) {
  try {
    // Intento 1: fetchMessages normal
    const messages = await chat.fetchMessages({ limit });
    if (messages.length > 0) return messages;
    
    // Intento 2: Usar último mensaje conocido
    if (chat.lastMessage) {
      console.log('📦 Usando último mensaje conocido');
      return [chat.lastMessage];
    }
    
    // Intento 3: Forzar recarga
    const client = getClient();
    const chatsActualizados = await client.getChats();
    const chatRefrescado = chatsActualizados.find(c => 
      c.id._serialized === chat.id._serialized
    );
    
    if (chatRefrescado) {
      const messages = await chatRefrescado.fetchMessages({ limit });
      return messages;
    }
    
    return [];
  } catch (err) {
    console.warn(`⚠️ Error leyendo mensajes: ${err.message}`);
    return [];
  }
}

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
          if (jarvisEstaHablando) return;
          
          const frasesDeJarvis = ['hola niurka', 'te escucho fuerte y claro', 'estoy a tu disposición', 'en qué puedo ayudarte', 'es un gusto saludarte', 'jarvis está listo'];
          if (frasesDeJarvis.some(f => textoReconocido.toLowerCase().includes(f))) return;
          
          console.log(`🎯 Voz reconocida: "${textoReconocido}"`);
          io.emit('voice:resultado', { text: textoReconocido });
          
          const respuesta = await generarRespuestaSugerida(textoReconocido);
          if (respuesta) {
            await supabase.from('jarvis_memory').insert([{ content: textoReconocido, category: 'voice', metadata: { respuesta: respuesta.respuesta } }]);
          }
          
          jarvisEstaHablando = true;
          io.emit('jarvis:respuesta', respuesta);
          setTimeout(() => { jarvisEstaHablando = false; }, 5000);
        }
      } catch (e) { console.error('❌ Error procesando voz:', e); }
    });
    
    voiceSocket.on('error', (err) => console.error('❌ Error Vosk:', err.message));
    voiceSocket.on('close', () => setTimeout(connectToVoiceService, 5000));
  } catch (err) { console.error('❌ No se pudo conectar a Vosk:', err); }
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
  
  // === 🛠️ COMANDOS DE DEBUG ===
  socket.on('debug:whatsapp', () => import('./debug.js').then(({ debugWhatsApp }) => debugWhatsApp()));
  socket.on('debug:chats', () => import('./debug.js').then(({ debugChats }) => debugChats()));
  
  // === 📬 CONSULTAR MENSAJES PENDIENTES ===
  socket.on('whatsapp:mensajes_pendientes', async () => {
    try {
      const pendientes = obtenerMensajesPendientes();
      
      if (pendientes.length === 0) {
        socket.emit('jarvis:respuesta', {
          respuesta: '✅ No tienes mensajes nuevos sin leer.',
          prioridad: 'baja'
        });
        return;
      }
      
      const resumen = pendientes.map(p => 
        `• ${p.nombre}: ${p.count} mensaje${p.count > 1 ? 's' : ''} nuevo${p.count > 1 ? 's' : ''}\n  Último: "${p.ultimo.substring(0, 60)}${p.ultimo.length > 60 ? '...' : ''}"`
      ).join('\n\n');
      
      socket.emit('jarvis:respuesta', {
        respuesta: `📬 Tienes mensajes nuevos:\n\n${resumen}\n\n¿De cuál quieres que te lea los mensajes?`,
        prioridad: 'alta'
      });
      
    } catch (err) {
      console.error('❌ Error consultando pendientes:', err);
    }
  });
  
  // === 🎯 MENSAJES DE TEXTO - CON DETECCIÓN INTELIGENTE ===
  socket.on('jarvis:mensaje', async (data) => {
    const { mensaje } = data;
    const userId = socket.id;
    const estado = estadoUsuario.get(userId) || {};
    
    console.log(`💬 Mensaje recibido: "${mensaje}" | Estado: ${estado.contexto || 'ninguno'}`);
    // 🔍 COMANDO PARA VERIFICAR ESTADO DE GEMINI
if (/estado gemini|gemini status|api status|verificar ia/i.test(mensaje)) {
  try {
    const { model } = await import('../config/gemini.js');
    
    // Hacer una prueba rápida
    const testPrompt = "Responde solo OK";
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    
    socket.emit('jarvis:respuesta', {
      respuesta: '✅ Gemini API está funcionando correctamente.',
      prioridad: 'baja'
    });
  } catch (err) {
    socket.emit('jarvis:respuesta', {
      respuesta: `⚠️ Gemini API tiene problemas: ${err.message}. Es probable que sea saturación temporal. Intenta de nuevo en 5-10 minutos.`,
      prioridad: 'alta'
    });
  }
  return;
}
    // 🔍 1. ¿El usuario pregunta si hay MÁS mensajes?
    if (estado.contexto === 'leyendo_mensajes' && /hay más|otros|hay otros|algo más|más mensajes/i.test(mensaje)) {
      console.log(`🔄 Continuando lectura de ${estado.contacto}`);
      try {
        if (!isWhatsAppReady()) { 
          socket.emit('jarvis:respuesta', { respuesta: '⏳ WhatsApp inicializando...', prioridad: 'alta' }); 
          return; 
        }
        
        const messages = await estado.ultimoChat.fetchMessages({ limit: 10 });
        const nuevos = messages.filter(m => !estado.mensajesLeidos?.includes(m.id._serialized));
        
        if (nuevos.length === 0) {
          socket.emit('jarvis:respuesta', { 
            respuesta: `✅ No hay más mensajes nuevos de ${estado.contacto}.`, 
            prioridad: 'baja' 
          });
          estadoUsuario.delete(userId);
          return;
        }
        
        const textos = nuevos.slice(-3).map(m => {
          const hora = new Date(m.timestamp * 1000).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          const de = m.fromMe ? 'Tú' : (m.author?.split('@')[0] || 'Alguien');
          return `• [${hora}] ${de}: ${m.body.substring(0, 100)}${m.body.length > 100 ? '...' : ''}`;
        }).join('\n');
        
        estado.mensajesLeidos = [...(estado.mensajesLeidos || []), ...nuevos.map(m => m.id._serialized)];
        estadoUsuario.set(userId, estado);
        
        socket.emit('jarvis:respuesta', {
          respuesta: `💬 Sí, hay más:\n${textos}\n\n¿Quieres que lea los demás o responda algo?`,
          prioridad: 'media'
        });
      } catch (err) {
        console.error('❌ Error leyendo más mensajes:', err);
        socket.emit('jarvis:respuesta', { respuesta: '⚠️ No pude cargar más mensajes.', prioridad: 'alta' });
        estadoUsuario.delete(userId);
      }
      return;
    }
    
    // 🔍 2. DETECTAR ENVÍO DE MENSAJES
    const matchEnvio = mensaje.match(
      /(?:enviar|manda|escribe|envíale|manda un mensaje|escribir|dile|avísale|dile algo a)\s+(?:a\s+|al\s+|a la\s+)?([^:;,]+?)\s*(?:[:;,]|de|que|para|k|xq|pa|por\s+que)\s+(.+)/i
    );
    
    if (matchEnvio) {
      const [, contactoRaw, textoRaw] = matchEnvio;
      const contacto = contactoRaw.trim();
      const textoOriginal = textoRaw.trim();
      
      console.log(`📤 Detectado envío: "${contacto}" -> "${textoOriginal}"`);
      
      try {
        if (!isWhatsAppReady()) {
          socket.emit('jarvis:respuesta', { respuesta: '⏳ WhatsApp inicializando...', prioridad: 'alta' });
          return;
        }
        
        const client = getClient();
        const chats = await client.getChats();
        const destino = buscarContactoFuzzy(contacto, chats);
        
        if (!destino) {
          const sugerencias = chats.slice(0, 5).map(c => c.name || c.pushname).filter(Boolean).join(', ');
          socket.emit('jarvis:respuesta', {
            respuesta: `❌ No encontré "${contacto}". ¿Quizás: ${sugerencias}?`,
            prioridad: 'alta'
          });
          return;
        }
        
        const textoRefinado = await refinarMensajeParaEnviar(textoOriginal, destino.name || destino.pushname);
        console.log(`✍️ Refinado: "${textoOriginal}" → "${textoRefinado}"`);
        
        await destino.sendMessage(textoRefinado);
        
        socket.emit('jarvis:respuesta', {
          respuesta: `✅ Enviado a ${destino.name || destino.pushname}:\n"${textoRefinado}"`,
          prioridad: 'media'
        });
      } catch (err) {
        console.error('❌ Error enviando:', err);
        socket.emit('jarvis:respuesta', { respuesta: '⚠️ Error al enviar.', prioridad: 'alta' });
      }
      return;
    }
    
    // 🔍 3. DETECTAR LECTURA DE MENSAJES (CON FIX)
    const matchLeer = mensaje.match(/(?:dime|qué|que|lee|leer|revisa|ver|muéstrame)\s+(?:qué|que)\s+(?:me\s+)?(?:escribió|envió|mandó|dijo|hay en|hay de)\s+(?:el\s+grupo\s+de\s+|la\s+|de\s+)?([^.,;!?]+)/i);

    if (matchLeer) {
      const [, contactoRaw] = matchLeer;
      const contacto = contactoRaw.trim();
      console.log(`📖 Detectado lectura: "${contacto}"`);
      
      try {
        if (!isWhatsAppReady()) { 
          socket.emit('jarvis:respuesta', { respuesta: '⏳ WhatsApp inicializando...', prioridad: 'alta' }); 
          return; 
        }
        
        const client = getClient();
        const chats = await client.getChats();
        const chatEncontrado = buscarContactoFuzzy(contacto, chats);
        
        if (!chatEncontrado) {
          const sugerencias = chats.slice(0, 10).map(c => c.name || c.pushname).filter(Boolean).join(', ');
          socket.emit('jarvis:respuesta', {
            respuesta: `❌ No encontré "${contacto}". Chats disponibles: ${sugerencias}`,
            prioridad: 'alta'
          });
          return;
        }
        
        console.log(`✅ Chat encontrado: ${chatEncontrado.name || chatEncontrado.pushname}`);
        
        // 🔄 USAR FUNCIÓN MEJORADA
        const messages = await leerMensajesDeChat(chatEncontrado, 10);
        
        if (!messages || messages.length === 0) {
          socket.emit('jarvis:respuesta', {
            respuesta: `📭 No hay mensajes recientes de ${chatEncontrado.name || chatEncontrado.pushname}.`,
            prioridad: 'baja'
          });
          return;
        }
        
        // Guardar estado para flujo conversacional
        estadoUsuario.set(userId, {
          contexto: 'leyendo_mensajes',
          contacto: chatEncontrado.name || chatEncontrado.pushname || contacto,
          ultimoChat: chatEncontrado,
          mensajesLeidos: messages.map(m => m.id._serialized)
        });
        
        const ultimos = messages.slice(-5).map(m => {
          const fecha = new Date(m.timestamp * 1000);
          const hora = fecha.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
          const de = m.fromMe ? 'Tú' : (m.author?.split('@')[0] || chatEncontrado.name?.split('@')[0] || 'Alguien');
          return `• [${hora}] ${de}: ${m.body.substring(0, 150)}${m.body.length > 150 ? '...' : ''}`;
        }).join('\n');
        
        const totalMensajes = messages.length;
        const hayMas = totalMensajes >= 10;
        
        socket.emit('jarvis:respuesta', {
          respuesta: `💬 Últimos de ${chatEncontrado.name || chatEncontrado.pushname}:\n${ultimos}\n\n${hayMas ? `📬 Hay más mensajes (mostrando los últimos ${totalMensajes}). ` : '✅ Esos son todos los mensajes recientes. '}¿Quieres que responda algo?`,
          prioridad: 'media'
        });
        
        // Limpiar mensajes leídos del mapa
        limpiarMensajesLeidos(chatEncontrado.id._serialized);
        
      } catch (err) {
        console.error('❌ Error leyendo mensajes:', err);
        socket.emit('jarvis:respuesta', { 
          respuesta: `⚠️ No pude leer los mensajes. Error: ${err.message}. Intenta abrir el chat en WhatsApp Web primero.`, 
          prioridad: 'alta' 
        });
      }
      return;
    }
    
    // 🔍 4. CONSULTAR MENSAJES NUEVOS
    if (/tengo mensajes|hay mensajes|qué hay de nuevo|mensajes nuevos|sin leer/i.test(mensaje)) {
      socket.emit('whatsapp:mensajes_pendientes');
      return;
    }
    
    // 🔍 5. COMANDOS BÁSICOS DE WHATSAPP
    if (/mis grupos|lista de grupos|chats recientes|estado whatsapp/i.test(mensaje)) {
      try {
        if (!isWhatsAppReady()) { 
          socket.emit('jarvis:respuesta', { respuesta: '⏳ WhatsApp no listo', prioridad: 'alta' }); 
          return; 
        }
        const client = getClient();
        const chats = await client.getChats();
        if (mensaje.toLowerCase().includes('grupos')) {
          const grupos = chats.filter(c => c.isGroup).slice(0, 10);
          socket.emit('jarvis:respuesta', { 
            respuesta: grupos.length ? `📱 Grupos:\n${grupos.map(g=>`• ${g.name}`).join('\n')}` : '📭 Sin grupos', 
            prioridad: 'media' 
          });
        } else {
          const recientes = chats.filter(c => !c.isGroup).slice(0, 5);
          socket.emit('jarvis:respuesta', { 
            respuesta: recientes.length ? `💬 Chats:\n${recientes.map(c=>`• ${c.name||c.pushname}`).join('\n')}` : '📭 Sin chats', 
            prioridad: 'media' 
          });
        }
      } catch (e) { 
        socket.emit('jarvis:respuesta', { respuesta: '⚠️ Error listando', prioridad: 'alta' }); 
      }
      return;
    }
    
    // 🔍 6. SI NO ES COMANDO → GEMINI NORMAL
    const respuesta = await generarRespuestaSugerida(mensaje);
    if (respuesta) {
      await supabase.from('jarvis_memory').insert([{ content: mensaje, category: 'chat', metadata: { respuesta: respuesta.respuesta } }]);
    }
    socket.emit('jarvis:respuesta', respuesta);
  });
  
  // === AUDIO DE VOZ ===
  socket.on('voice:audio', (audioBuffer) => sendAudioToVosk(audioBuffer));
  
  // === CREAR RECORDATORIO ===
  socket.on('jarvis:recordatorio', async (data) => {
    const { hora, mensaje } = data;
    crearRecordatorio({ hora, mensaje, cliente: getClient() });
    socket.emit('jarvis:confirmacion', { mensaje: `✅ Recordatorio para las ${hora}` });
  });
  
  // === CONSULTAS WHATSAPP BÁSICAS ===
  socket.on('whatsapp:consulta', async (data) => {
    const { comando } = data;
    let respuesta = '', hablar = true;
    try {
      if (!isWhatsAppReady()) { 
        respuesta = '⏳ WhatsApp inicializando...'; 
        socket.emit('whatsapp:respuesta', { mensaje: respuesta, hablar }); 
        return; 
      }
      const client = getClient();
      if (!client?.info?.wid) { 
        respuesta = '❌ WhatsApp no conectado'; 
      } else {
        switch(comando.toLowerCase()) {
          case 'estado': respuesta = '✅ WhatsApp conectado'; break;
          case 'grupos': case 'mis grupos':
            const chats = await client.getChats();
            const grupos = chats.filter(c => c.isGroup).slice(0,10);
            respuesta = grupos.length ? `📱 Grupos:\n${grupos.map(g=>`• ${g.name}`).join('\n')}` : '📭 Sin grupos';
            break;
          case 'chats': case 'últimos chats':
            const chats2 = await client.getChats();
            const recientes = chats2.filter(c => !c.isGroup).slice(0,5);
            respuesta = recientes.length ? `💬 Chats:\n${recientes.map(c=>`• ${c.name||c.pushname}`).join('\n')}` : '📭 Sin chats';
            break;
          case 'mi número': case 'mi whatsapp':
            const info = client.info;
            respuesta = `📱 ${info?.pushname||'Usuario'} | ${info?.wid?.user||'N/A'}`;
            break;
          default: 
            respuesta = '❓ Comandos: "estado", "mis grupos", "últimos chats", "mi número"'; 
            hablar=false;
        }
      }
    } catch(err) { 
      console.error('❌ Error WhatsApp:', err); 
      respuesta = '⚠️ Error consultando WhatsApp'; 
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

// === 🩺 DIAGNÓSTICO EN TERMINAL ===
process.stdin.resume();
process.stdin.on('data', async (input) => {
  const cmd = input.toString().trim().toLowerCase();
  if (cmd === 'debug-whatsapp') {
    console.log('\n🔍 === DIAGNÓSTICO WHATSAPP ===');
    const { getClient, isWhatsAppReady } = await import('./services/whatsapp.js');
    const client = getClient();
    console.log('isWhatsAppReady():', isWhatsAppReady());
    console.log('client?.info?.wid:', client?.info?.wid ? '✅' : '❌');
    if (client?.info?.wid) console.log(`📱 ${client.info.wid.user} | 👤 ${client.info.pushname}`);
    console.log('=============================\n');
  }
});

export default app;