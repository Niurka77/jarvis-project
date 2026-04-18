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

// 🎤 Inicializar reconocimiento de voz MEJORADO
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      if (voiceBtn) {
        voiceBtn.classList.add('listening');
        voiceBtn.innerHTML = '🔴';
      }
      statusDiv.textContent = '🎤 Escuchando...';
      statusDiv.style.background = 'rgba(244, 67, 54, 0.7)';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      messageInput.value = transcript;
      agregarMensaje(`🎤 Dijiste: "${transcript}"`, 'user');
      
      // Auto-enviar después de 1 segundo (para que veas lo que captó)
      setTimeout(() => {
        if (transcript.trim()) {
          enviarMensaje();
        }
      }, 1000);
    };

    recognition.onerror = (event) => {
      console.error('❌ Error de voz:', event.error);
      isListening = false;
      
      if (voiceBtn) {
        voiceBtn.classList.remove('listening');
        voiceBtn.innerHTML = '🎤';
      }
      
      // Manejo específico de errores
      if (event.error === 'network') {
        agregarMensaje('⚠️ Error de red. Verifica tu conexión a internet.', 'jarvis');
      } else if (event.error === 'no-speech') {
        agregarMensaje('🤔 No escuché nada. Intenta de nuevo.', 'jarvis');
      } else if (event.error === 'audio-capture') {
        agregarMensaje('🎤 Verifica que el micrófono esté conectado.', 'jarvis');
      } else if (event.error === 'not-allowed') {
        agregarMensaje('⛔ Permiso de micrófono denegado.', 'jarvis');
      } else {
        agregarMensaje(`⚠️ Error: ${event.error}. Intenta de nuevo.`, 'jarvis');
      }
      
      // Reintentar automáticamente después de 2 segundos
      setTimeout(() => {
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Reconocimiento ya está activo');
          }
        }
      }, 2000);
    };

    recognition.onend = () => {
      isListening = false;
      if (voiceBtn) {
        voiceBtn.classList.remove('listening');
        voiceBtn.innerHTML = '🎤';
      }
      statusDiv.textContent = '✅ WhatsApp + Centro de Control';
      statusDiv.style.background = 'rgba(76, 175, 80, 0.8)';
    };

  } else {
    console.warn('⚠️ Reconocimiento de voz no disponible');
  }
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