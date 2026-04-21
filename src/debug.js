// src/debug.js - Comandos de diagnóstico para Jarvis
import { getClient, isWhatsAppReady } from './services/whatsapp.js';

export function debugWhatsApp() {
  const client = getClient();
  
  console.log('\n🔍 === DIAGNÓSTICO WHATSAPP ===');
  console.log('client:', client ? '✅ Existe' : '❌ No existe');
  console.log('client.info:', client?.info ? '✅ Existe' : '❌ No existe');
  console.log('client.info.wid:', client?.info?.wid ? `✅ ${client.info.wid}` : '❌ No existe');
  console.log('client.isLoggedIn:', client?.isLoggedIn);
  console.log('client.isConnected:', typeof client?.isConnected === 'function' ? client.isConnected() : 'N/A');
  console.log('isWhatsAppReady():', isWhatsAppReady());
  
  if (client?.info?.wid) {
    console.log(`\n📱 Tu número: ${client.info.wid.user}`);
    console.log(`👤 Nombre: ${client.info.pushname}`);
  }
  console.log('=============================\n');
}

export function debugChats(limit = 5) {
  const client = getClient();
  if (!client?.info?.wid) {
    console.log('❌ WhatsApp no está listo para listar chats');
    return;
  }
  
  client.getChats().then(chats => {
    console.log(`\n💬 === ÚLTIMOS ${limit} CHATS ===`);
    chats.slice(0, limit).forEach((c, i) => {
      console.log(`${i+1}. ${c.name || c.pushname || 'Sin nombre'} | ${c.id._serialized}`);
    });
    console.log('=============================\n');
  });
}