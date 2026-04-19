// 🔊 Variables de voz
let mediaRecorder = null;
let isListening = false;
let voiceEnabled = true;
const SAMPLE_RATE = 16000;

// Referencias al DOM (ajusta según tus IDs reales)
const messageInput = document.getElementById('message-input');
const voiceBtn = document.getElementById('voice-btn');
const statusDiv = document.getElementById('status-div');

// 🔊 Función para que Jarvis hable
function speakText(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  
  if (!document.hidden) {
    window.speechSynthesis.speak(utterance);
  }
}

// ✅ CONEXIÓN SOCKET.IO (ya deberías tenerla, pero la incluyo por si acaso)
const socket = io();

socket.on('connect', () => {
  console.log('✅ Conectado al servidor Jarvis');
});

// ✅ ESCUCHAR RESULTADOS DE VOZ DEL SERVIDOR
socket.on('voice:resultado', (data) => {
  console.log(`🎯 Reconocido: "${data.text}"`);
  
  if (messageInput) {
    messageInput.value = data.text;
  }
  
  agregarMensaje(`🎤 Dijiste: "${data.text}"`, 'user');
  
  // Enviar automáticamente después de 500ms
  setTimeout(() => {
    if (messageInput && messageInput.value.trim()) {
      enviarMensaje();
    }
  }, 500);
});

// 🎤 Iniciar grabación de voz
async function startListening() {
  if (!voiceEnabled) {
    agregarMensaje('🔇 La voz está silenciada. Presiona Ctrl+Shift+M para activar.', 'jarvis');
    return;
  }
  
  if (isListening) {
    stopListening();
    return;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true
      } 
    });
    
    // Crear MediaRecorder
    mediaRecorder = new MediaRecorder(stream, { 
      mimeType: 'audio/webm;codecs=opus' 
    });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // ✅ ENVIAR AUDIO AL SERVIDOR VÍA SOCKET.IO
        event.data.arrayBuffer().then(buffer => {
          socket.emit('voice:audio', buffer);
        });
      }
    };
    
    mediaRecorder.start(200); // Enviar chunks cada 200ms
    isListening = true;
    
    // Actualizar UI
    if (voiceBtn) {
      voiceBtn.classList.add('listening');
      voiceBtn.innerHTML = '🔴';
    }
    if (statusDiv) {
      statusDiv.textContent = '🎤 Escuchando...';
    }
    agregarMensaje('🎤 Habla ahora, Niurka. Te escucho...', 'jarvis');
    
  } catch (err) {
    console.error('❌ Error al acceder al micrófono:', err);
    agregarMensaje('⛔ No pude acceder al micrófono. Verifica los permisos.', 'jarvis');
  }
}

// ⏹️ Detener grabación
function stopListening() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  isListening = false;
  
  // Resetear UI
  if (voiceBtn) {
    voiceBtn.classList.remove('listening');
    voiceBtn.innerHTML = '🎤';
  }
  if (statusDiv) {
    statusDiv.textContent = '✅ WhatsApp + Centro de Control';
  }
}

// 🔘 Control de voz (toggle)
function toggleListening() {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

// Función para agregar mensajes al chat
function agregarMensaje(texto, tipo) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const mensajeDiv = document.createElement('div');
  mensajeDiv.classList.add('mensaje', tipo);
  
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  
  mensajeDiv.innerHTML = `
    <div class="mensaje-hora">${hora}</div>
    <div class="mensaje-texto">${texto}</div>
  `;
  
  chatMessages.appendChild(mensajeDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Función para enviar mensajes
function enviarMensaje() {
  const messageInput = document.getElementById('message-input');
  if (!messageInput || !messageInput.value.trim()) return;
  
  const mensaje = messageInput.value.trim();
  
  // Agregar al chat
  agregarMensaje(mensaje, 'user');
  
  // Enviar al servidor
  if (typeof socket !== 'undefined') {
    socket.emit('jarvis:mensaje', { mensaje });
  }
  
  // Limpiar input
  messageInput.value = '';
}
// ✅ Función para el botón "INICIAR JARVIS"
async function iniciarJarvis() {
  console.log(' Iniciando Jarvis...');
  
  // Solicitar permiso del micrófono
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop()); // Cerrar el stream después de obtener permiso
    
    // Habilitar voz
    voiceEnabled = true;
    
    // Ocultar el overlay
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    // Mensaje de bienvenida
    agregarMensaje('🤖 ¡Hola Niurka! Jarvis está listo. Presiona el micrófono 🎤 o Ctrl+M para hablar.', 'jarvis');
    
    // Decir algo con voz
    speakText('Bienvenida Niurka. Jarvis está listo para ayudarte.');
    
  } catch (err) {
    console.error('❌ Error al acceder al micrófono:', err);
    alert('⛔ Necesito acceso al micrófono para funcionar. Por favor permite el acceso.');
  }
}

// Hacer la función global (para que el HTML la pueda llamar)
window.iniciarJarvis = iniciarJarvis;
window.toggleListening = toggleListening;
window.enviarMensaje = enviarMensaje;
window.agregarMensaje = agregarMensaje;
window.speakText = speakText;
function enviarMensaje() {
  // Tu implementación actual
  if (messageInput && messageInput.value.trim()) {
    socket.emit('jarvis:mensaje', { mensaje: messageInput.value });
    messageInput.value = '';
  }
}

// Atajo de teclado Ctrl+M
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'm') {
    e.preventDefault();
    toggleListening();
  }
});