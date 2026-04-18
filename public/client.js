const socket = io();
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const statusDiv = document.getElementById('status');

// Conexión
socket.on('connect', () => {
  statusDiv.textContent = '✅ Conectado al Centro de Control';
  statusDiv.style.background = 'rgba(76, 175, 80, 0.6)';
});

// WhatsApp listo
socket.on('whatsapp:ready', () => {
  console.log('WhatsApp conectado');
});

// QR de WhatsApp
socket.on('whatsapp:qr', (qr) => {
  console.log('Escanea el QR en la terminal');
});

// Mensaje importante detectado
socket.on('whatsapp:importante', (data) => {
  mostrarNotificacion(`🔔 ${data.analisis.razon}\n\n💡 Sugerencia: ${data.analisis.sugerencia_respuesta}`);
  
  // Agregar al chat
  agregarMensaje(`📢 Grupo: ${data.analisis.razon}`, 'jarvis');
  agregarMensaje(`💡 Jarvis sugiere: "${data.analisis.sugerencia_respuesta}"`, 'jarvis');
});

// Respuesta de Jarvis
socket.on('jarvis:respuesta', (respuesta) => {
  if (respuesta) {
    agregarMensaje(respuesta.respuesta, 'jarvis');
    agregarMensaje(`🎯 Acción sugerida: ${respuesta.accion_sugerida}`, 'jarvis');
  }
});

// Confirmación de recordatorio
socket.on('jarvis:confirmacion', (data) => {
  mostrarNotificacion(data.mensaje);
});

function enviarMensaje() {
  const mensaje = messageInput.value.trim();
  if (mensaje) {
    agregarMensaje(mensaje, 'user');
    socket.emit('jarvis:mensaje', { mensaje });
    messageInput.value = '';
  }
}

function crearRecordatorio() {
  const hora = document.getElementById('hora-recordatorio').value;
  const mensaje = document.getElementById('texto-recordatorio').value;
  
  if (hora && mensaje) {
    socket.emit('jarvis:recordatorio', { hora, mensaje });
  } else {
    alert('Completa la hora y el mensaje');
  }
}

function agregarMensaje(texto, tipo) {
  const div = document.createElement('div');
  div.className = `message ${tipo}`;
  div.textContent = texto;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function mostrarNotificacion(texto) {
  const notifDiv = document.getElementById('notificaciones');
  const div = document.createElement('div');
  div.className = 'notificacion';
  div.textContent = texto;
  notifDiv.appendChild(div);
  
  setTimeout(() => div.remove(), 10000);
}

// Enter para enviar
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') enviarMensaje();
});