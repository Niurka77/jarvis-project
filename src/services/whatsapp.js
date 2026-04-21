// src/services/whatsapp.js
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import qrcode from 'qrcode-terminal';
import { analizarMensajeGrupo } from './ai.js';

let client;
let io;

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

  client.on('message', async (message) => {
    if (message.fromMe || message.from === 'status@broadcast') return;
    
    if (message.from.includes('@g.us')) {
      const analisis = await analizarMensajeGrupo(message.body);
      
      if (analisis.es_importante) {
        console.log(`🔔 MENSAJE IMPORTANTE: ${analisis.razon}`);
        if (io) {
          io.emit('whatsapp:importante', {
            grupo: message.from,
            mensaje: message.body,
            de: message.author || 'Desconocido',
            analisis: analisis
          });
        }
      }
    }
  });

  client.on('disconnected', (reason) => {
    console.log('🔌 WhatsApp desconectado:', reason);
    if (io) io.emit('whatsapp:disconnected', { reason });
  });

  client.initialize();
  return client;
}

// ✅ FUNCIÓN CORREGIDA PARA VERIFICAR CONEXIÓN WHATSAPP
export function isWhatsAppReady() {
  // Verificación real compatible con whatsapp-web.js:
  const hasClient = client !== undefined;
  const hasInfo = client?.info !== undefined;
  const hasWid = client?.info?.wid !== undefined;
  const isAuthenticated = client?.isAuthenticated === true;
  
  const ready = hasClient && hasInfo && hasWid && isAuthenticated;
  
  if (!ready) {
    console.log(`🔍 Debug WhatsApp Ready: 
      hasClient: ${hasClient}, 
      hasInfo: ${hasInfo}, 
      hasWid: ${hasWid}, 
      isAuthenticated: ${isAuthenticated}`);
  }
  
  return ready;
}

// ✅ Función para obtener el cliente
export function getClient() {
  return client;
}