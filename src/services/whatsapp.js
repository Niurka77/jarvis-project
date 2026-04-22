// src/services/whatsapp.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import qrcode from 'qrcode-terminal';
import { analizarMensajeGrupo } from './ai.js';

let client;
let io;

// === 📬 MONITOREO DE MENSAJES EN TIEMPO REAL ===
const chatsConNuevosMensajes = new Map(); // chatId -> { count, lastMessage, timestamp, nombreChat }

export function inicializarWhatsApp(socketIO) {
  io = socketIO;
  
  client = new Client({
    authStrategy: new LocalAuth({ clientId: 'jarvis-session' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    }
  });

  client.on('qr', (qr) => {
    console.log('📱 Escanea este QR con WhatsApp:');
    qrcode.generate(qr, { small: true });
    if (io) io.emit('whatsapp:qr', qr);
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp está listo y conectado');
    if (io) io.emit('whatsapp:ready', true);
  });

  // === 🎯 NUEVO: LISTENER DE MENSAJES EN TIEMPO REAL ===
  client.on('message', async (message) => {
    if (message.fromMe || message.from === 'status@broadcast') return;
    
    const chatId = message.from;
    const esGrupo = chatId.includes('@g.us');
    
    try {
      const chat = await message.getChat();
      const nombreChat = chat.name || chat.pushname || (esGrupo ? 'un grupo' : 'alguien');
      const remitente = esGrupo ? (message.author?.split('@')[0] || 'Alguien') : nombreChat;
      
      // Guardar en el mapa de mensajes pendientes
      const estadoActual = chatsConNuevosMensajes.get(chatId) || { 
        count: 0, 
        mensajes: [],
        ultimoMensaje: '',
        timestamp: Date.now(),
        nombreChat: nombreChat,
        esGrupo: esGrupo
      };
      
      estadoActual.count++;
      estadoActual.mensajes.push({
        de: remitente,
        texto: message.body,
        hora: new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'}),
        timestamp: message.timestamp
      });
      estadoActual.ultimoMensaje = message.body;
      estadoActual.timestamp = Date.now();
      
      chatsConNuevosMensajes.set(chatId, estadoActual);
      
      console.log(`📩 Nuevo mensaje de ${nombreChat}: ${message.body.substring(0, 50)}...`);
      
      // Notificar al frontend EN TIEMPO REAL
      if (io) {
        const preview = message.body.length > 80 ? message.body.substring(0, 80) + '...' : message.body;
        
        io.emit('jarvis:notificacion_tiempo_real', {
          tipo: 'nuevo_mensaje',
          chatId: chatId,
          de: nombreChat,
          remitente: remitente,
          preview: preview,
          count: estadoActual.count,
          es_grupo: esGrupo,
          mensaje_completo: message.body,
          timestamp: message.timestamp
        });
        
        // Si es mensaje privado (no grupo), notificar inmediatamente
        if (!esGrupo) {
          io.emit('jarvis:respuesta', {
            respuesta: `🔔 Tienes un mensaje nuevo de *${nombreChat}*:\n\n"${preview}"\n\n¿Quieres que te lea todos los mensajes de ${nombreChat} o que responda algo?`,
            prioridad: 'alta',
            accion_sugerida: 'Leer o responder'
          });
        }
      }
      
      // Analizar si es importante (solo para grupos)
      if (esGrupo) {
        const analisis = await analizarMensajeGrupo(message.body);
        
        if (analisis.es_importante) {
          console.log(`🔔 MENSAJE IMPORTANTE: ${analisis.razon}`);
          if (io) {
            io.emit('whatsapp:importante', {
              grupo: chatId,
              mensaje: message.body,
              de: remitente,
              analisis: analisis
            });
          }
        }
      }
      
    } catch (err) {
      console.error('❌ Error procesando mensaje entrante:', err);
    }
  });

  client.on('disconnected', (reason) => {
    console.log('🔌 WhatsApp desconectado:', reason);
    if (io) io.emit('whatsapp:disconnected', { reason });
  });

  client.initialize();
  return client;
}

// === 📬 FUNCIONES PARA GESTIONAR MENSAJES PENDIENTES ===

export function obtenerMensajesPendientes() {
  const pendientes = Array.from(chatsConNuevosMensajes.entries()).map(([chatId, data]) => ({
    chatId,
    nombre: data.nombreChat,
    count: data.count,
    ultimo: data.ultimoMensaje,
    timestamp: data.timestamp,
    esGrupo: data.esGrupo,
    mensajes: data.mensajes
  }));
  
  // Limpiar mensajes antiguos (más de 10 minutos)
  const ahora = Date.now();
  for (const [chatId, data] of chatsConNuevosMensajes.entries()) {
    if (ahora - data.timestamp > 10 * 60 * 1000) {
      chatsConNuevosMensajes.delete(chatId);
    }
  }
  
  return pendientes;
}

export function limpiarMensajesLeidos(chatId) {
  chatsConNuevosMensajes.delete(chatId);
}

export function getMensajePendiente(chatId) {
  return chatsConNuevosMensajes.get(chatId);
}

// ✅ VERSIÓN SIMPLIFICADA Y FUNCIONAL
export function isWhatsAppReady() {
  return client?.info?.wid !== undefined;
}

// ✅ Función para obtener el cliente
export function getClient() {
  return client;
}