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

// ✅ Funciones auxiliares (asegúrate de tenerlas en tu archivo)
function agregarMensaje(texto, tipo) {
  // Tu implementación actual
  console.log(`[${tipo}]: ${texto}`);
}

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