const socket = io();
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const statusDiv = document.getElementById('status');
const voiceBtn = document.getElementById('voice-btn');

// 🔊 Variables de voz
let recognition = null;
let speechSynthesis = window.speechSynthesis;
let isListening = false;
let voiceEnabled = true;

// 🎤 Inicializar reconocimiento de voz - VERSIÓN RESISTENTE
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('⚠️ Reconocimiento de voz no disponible');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // 🔁 Reintentos automáticos
  let retryCount = 0;
  const MAX_RETRIES = 3;

  recognition.onstart = () => {
    isListening = true;
    if (voiceBtn) {
      voiceBtn.classList.add('listening');
      voiceBtn.innerHTML = '🔴';
    }
    statusDiv.textContent = '🎤 Escuchando...';
  };

  recognition.onresult = (event) => {
    retryCount = 0; // Resetear reintentos al tener éxito
    const transcript = event.results[0][0].transcript;
    
    if (transcript.trim()) {
      messageInput.value = transcript;
      agregarMensaje(`🎤 Dijiste: "${transcript}"`, 'user');
      
      // Auto-enviar después de 800ms
      setTimeout(() => enviarMensaje(), 800);
    }
  };

  recognition.onerror = (event) => {
    console.error('❌ Error de voz:', event.error);
    isListening = false;
    
    // Resetear UI
    if (voiceBtn) {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '🎤';
    }
    statusDiv.textContent = '✅ WhatsApp + Centro de Control';

    // Manejo inteligente de errores
    if (event.error === 'network') {
      retryCount++;
      if (retryCount <= MAX_RETRIES) {
        console.log(`🔄 Reintentando (${retryCount}/${MAX_RETRIES})...`);
        agregarMensaje(`⏳ Intentando de nuevo... (${retryCount}/${MAX_RETRIES})`, 'jarvis');
        
        // Esperar y reintentar
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.log('No se pudo reintentar');
          }
        }, 1500 * retryCount); // Espera progresiva
      } else {
        agregarMensaje('❌ Error de red persistente. Prueba en Edge o verifica tu internet.', 'jarvis');
      }
      
    } else if (event.error === 'no-speech') {
      agregarMensaje('🤔 No escuché nada. Habla más fuerte o acerca el micrófono.', 'jarvis');
    } else if (event.error === 'audio-capture') {
      agregarMensaje('🎤 Verifica que el micrófono esté conectado y permitido.', 'jarvis');
    } else if (event.error === 'not-allowed') {
      agregarMensaje('⛔ Permiso de micrófono denegado. Haz clic en 🔒 y permite el micrófono.', 'jarvis');
    } else {
      agregarMensaje(`⚠️ Error: ${event.error}`, 'jarvis');
    }
  };

  recognition.onend = () => {
    // Solo resetear si no está en modo escucha activa
    if (!isListening) {
      if (voiceBtn) {
        voiceBtn.classList.remove('listening');
        voiceBtn.innerHTML = '🎤';
      }
      statusDiv.textContent = '✅ WhatsApp + Centro de Control';
    }
  };
}

// 🔊 Función para que Jarvis hable
function speakText(text) {
  if (!voiceEnabled || !speechSynthesis) return;
  
  // Cancelar audio anterior
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  // Hablar solo si la pestaña está activa
  if (!document.hidden) {
    speechSynthesis.speak(utterance);
  }
}

// 🔘 Control de voz
function toggleListening() {
  if (!recognition) {
    agregarMensaje('⚠️ Tu navegador no soporta reconocimiento de voz.', 'jarvis');
    return;
  }
  
  try {
    if (isListening) {
      recognition.stop();
      isListening = false;
    } else {
      recognition.start();
    }
  } catch (e) {
    console.error('Error al controlar voz:', e);
    isListening = false;
  }
}

// Conexión establecida
socket.on('connect', () => {
  console.log('✅ Conectado al Centro de Control');
  statusDiv.textContent = '✅ Conectado al Centro de Control';
  statusDiv.style.background = 'rgba(76, 175, 80, 0.6)';
  
  // Inicializar voz
  initVoiceRecognition();
  
  // 🎉 SALUDO INICIAL DE JARVIS (después de 1 segundo)
  setTimeout(() => {
    const saludo = "Hola Niurka. Soy Jarvis, tu asistente personal. Estoy conectado a tu WhatsApp y listo para ayudarte. ¿En qué puedo ayudarte hoy?";
    
    // Mostrar en chat
    agregarMensaje('🤖 ' + saludo, 'jarvis');
    
    // Decirlo en voz alta
    speakText(saludo);
    
  }, 1000);
});

// WhatsApp listo
socket.on('whatsapp:ready', () => {
  console.log('✅ WhatsApp CONECTADO y listo');
  statusDiv.textContent = '✅ WhatsApp + Centro de Control';
  statusDiv.style.background = 'rgba(76, 175, 80, 0.8)';
});

// QR de WhatsApp
socket.on('whatsapp:qr', (qr) => {
  console.log('📱 Escanea el QR en la terminal');
  statusDiv.textContent = '📱 Escanea el QR en terminal';
  statusDiv.style.background = 'rgba(255, 193, 7, 0.6)';
});

// Mensaje importante detectado
socket.on('whatsapp:importante', (data) => {
  mostrarNotificacion(`🔔 ${data.analisis.razon}\n\n💡 Sugerencia: ${data.analisis.sugerencia_respuesta}`);
  agregarMensaje(`📢 ${data.analisis.razon}`, 'jarvis');
  agregarMensaje(`💡 Jarvis sugiere: "${data.analisis.sugerencia_respuesta}"`, 'jarvis');
  speakText(`Tienes un mensaje importante: ${data.analisis.razon}`);
});

// Respuesta de Jarvis
socket.on('jarvis:respuesta', (respuesta) => {
  if (respuesta) {
    agregarMensaje(respuesta.respuesta, 'jarvis');
    agregarMensaje(`🎯 Acción sugerida: ${respuesta.accion_sugerida}`, 'jarvis');
    
    // Jarvis habla
    speakText(respuesta.respuesta);
  }
});

// Confirmación de recordatorio
socket.on('jarvis:confirmacion', (data) => {
  mostrarNotificacion(data.mensaje);
  speakText(data.mensaje);
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
// 🚀 Iniciar Jarvis (requiere interacción del usuario)
function iniciarJarvis() {
  // Ocultar overlay
  const overlay = document.getElementById('start-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }
  
  // Saludo inicial CON VOZ
  const saludo = "Hola Niurka. Soy Jarvis, tu asistente personal. Estoy conectado a tu WhatsApp y listo para ayudarte. ¿En qué puedo ayudarte hoy?";
  
  // Mostrar en chat
  agregarMensaje('🤖 ' + saludo, 'jarvis');
  
  // Decirlo en voz alta (ahora sí funcionará porque hubo un clic)
  setTimeout(() => {
    speakText(saludo);
  }, 500);
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

// Atajos de teclado
document.addEventListener('keydown', (e) => {
  // Ctrl+M: Activar micrófono
  if (e.ctrlKey && e.key === 'm') {
    e.preventDefault();
    toggleListening();
  }
  
  // Ctrl+Shift+M: Silenciar/activar voz
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    voiceEnabled = !voiceEnabled;
    agregarMensaje(voiceEnabled ? '🔊 Voz activada' : '🔇 Voz silenciada', 'jarvis');
  }
});