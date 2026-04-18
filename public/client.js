const socket = io();
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const statusDiv = document.getElementById('status');

// 🔊 Variables de voz (inicializadas como null por seguridad)
let recognition = null;
let speechSynthesis = window.speechSynthesis;

// 🎤 Inicializar reconocimiento de voz (solo si el navegador lo soporta)
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      messageInput.value = transcript;
      // Opcional: enviar automáticamente después de hablar
      // enviarMensaje(); 
    };

    recognition.onerror = (event) => {
      console.error('❌ Error de voz:', event.error);
      agregarMensaje('⚠️ No pude escuchar bien. Intenta de nuevo.', 'jarvis');
    };
  } else {
    console.warn('⚠️ Reconocimiento de voz no disponible en este navegador');
  }
}

// 🔊 Función para que Jarvis hable
function speakText(text) {
  if (speechSynthesis) {
    // Cancelar cualquier audio anterior para evitar superposiciones
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95; // Velocidad natural
    utterance.pitch = 1;
    
    // Solo hablar si la pestaña está activa (evita sorpresas)
    if (!document.hidden) {
      speechSynthesis.speak(utterance);
    }
  }
}

// 🔘 Control de voz: empezar/parar de escuchar
function toggleListening() {
  if (!recognition) {
    agregarMensaje('⚠️ Tu navegador no soporta reconocimiento de voz.', 'jarvis');
    return;
  }
  
  try {
    recognition.start();
    statusDiv.textContent = '🎤 Escuchando...';
    statusDiv.style.background = 'rgba(33, 150, 243, 0.6)';
  } catch (e) {
    // Si ya está escuchando, lo detenemos
    recognition.stop();
    statusDiv.textContent = '✅ Conectado al Centro de Control';
    statusDiv.style.background = 'rgba(76, 175, 80, 0.6)';
  }
}

// Conexión
socket.on('connect', () => {
  statusDiv.textContent = '✅ Conectado al Centro de Control';
  statusDiv.style.background = 'rgba(76, 175, 80, 0.6)';
  initVoiceRecognition(); // ✅ Inicializar voz al conectar
});

// WhatsApp listo
socket.on('whatsapp:ready', () => {
  console.log('✅ WhatsApp CONECTADO y listo');
  statusDiv.textContent = '✅ WhatsApp + Centro de Control';
  statusDiv.style.background = 'rgba(76, 175, 80, 0.8)';
});

// QR de WhatsApp
socket.on('whatsapp:qr', (qr) => {
  console.log('📱 Escanea el QR en la terminal para conectar WhatsApp');
  statusDiv.textContent = '📱 Escanea el QR en terminal';
  statusDiv.style.background = 'rgba(255, 193, 7, 0.6)';
});

// Mensaje importante detectado
socket.on('whatsapp:importante', (data) => {
  mostrarNotificacion(`🔔 ${data.analisis.razon}\n\n💡 Sugerencia: ${data.analisis.sugerencia_respuesta}`);
  agregarMensaje(`📢 ${data.analisis.razon}`, 'jarvis');
  agregarMensaje(`💡 Jarvis sugiere: "${data.analisis.sugerencia_respuesta}"`, 'jarvis');
});

// Respuesta de Jarvis ✅ AQUÍ ACTIVAMOS LA VOZ
socket.on('jarvis:respuesta', (respuesta) => {
  if (respuesta) {
    agregarMensaje(respuesta.respuesta, 'jarvis');
    agregarMensaje(`🎯 Acción sugerida: ${respuesta.accion_sugerida}`, 'jarvis');
    
    // 🔊 Jarvis te habla (solo la respuesta principal, no la acción)
    speakText(respuesta.respuesta);
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
    agregarMensaje(`⏰ Recordatorio programado: ${hora} - ${mensaje}`, 'jarvis');
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

// 🎤 Permitir Ctrl+M para activar micrófono (atajo de teclado)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'm') {
    e.preventDefault();
    toggleListening();
  }
});