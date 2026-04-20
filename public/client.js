// 🔊 Variables de voz
let audioContext = null;
let mediaStream = null;
let audioProcessor = null;
let sourceNode = null;
let isListening = false;
let voiceEnabled = true;
const SAMPLE_RATE = 16000;

// Referencias al DOM
const messageInput = document.getElementById('message-input');
const voiceBtn = document.getElementById('voice-btn');
const statusDiv = document.getElementById('status-div');

// Socket.IO
const socket = io();

socket.on('connect', () => {
  console.log('✅ Conectado al servidor Jarvis');
});

// Escuchar respuestas de Jarvis (texto + voz)
socket.on('jarvis:respuesta', (data) => {
  if (data?.respuesta) {
    // Mostrar en chat
    agregarMensaje(data.respuesta, 'jarvis');
    
    // Hablar con síntesis de voz
    speakText(data.respuesta);
  }
});

// Escuchar texto reconocido por voz (para mostrarlo antes de enviar)
socket.on('voice:resultado', (data) => {
  console.log(`🎤 Texto reconocido: "${data.text}"`);
  
  // Mostrar en input y enviar automáticamente
  if (messageInput) {
    messageInput.value = data.text;
  }
  
  // Agregar al chat como mensaje del usuario
  agregarMensaje(`🎤 Dijiste: "${data.text}"`, 'user');
  
  // Enviar a Jarvis después de 300ms
  setTimeout(() => {
    if (messageInput?.value.trim()) {
      enviarMensaje(); // Esto emitirá 'jarvis:mensaje' y disparará la respuesta
    }
  }, 300);
});

// 🎤 Iniciar grabación de voz CON AUDIO CONVERSION
async function startListening() {
  if (!voiceEnabled) {
    agregarMensaje('🔇 La voz está silenciada.', 'jarvis');
    return;
  }
  
  if (isListening) {
    stopListening();
    return;
  }
  
  try {
    // Crear AudioContext
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    
    // Cargar el AudioWorklet
    await audioContext.audioWorklet.addModule('audio-processor.js');
    
    // Obtener micrófono
    mediaStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        channelCount: 1,
        sampleRate: SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true
      } 
    });
    
    // Crear nodos
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    audioProcessor = new AudioWorkletNode(audioContext, 'audio-processor');
    
    // Conectar nodos
    sourceNode.connect(audioProcessor);
    
    // Escuchar datos de audio
    audioProcessor.port.onmessage = (event) => {
      if (socket.connected) {
        // Convertir Float32Array a Int16Array (PCM)
        const floatData = new Float32Array(event.data);
        const int16Data = new Int16Array(floatData.length);
        
        for (let i = 0; i < floatData.length; i++) {
          const s = Math.max(-1, Math.min(1, floatData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Enviar al servidor
        socket.emit('voice:audio', int16Data.buffer);
      }
    };
    
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
    agregarMensaje('⛔ No pude acceder al micrófono.', 'jarvis');
  }
}

// ⏹️ Detener grabación
function stopListening() {
  if (audioProcessor) {
    audioProcessor.port.close();
    audioProcessor = null;
  }
  
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
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

// 🔘 Control de voz
function toggleListening() {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

// Función para agregar mensajes
function agregarMensaje(texto, tipo) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const mensajeDiv = document.createElement('div');
  mensajeDiv.classList.add('mensaje', tipo);
  
  const hora = new Date().toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  mensajeDiv.innerHTML = `
    <div class="mensaje-hora">${hora}</div>
    <div class="mensaje-texto">${texto}</div>
  `;
  
  chatMessages.appendChild(mensajeDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Función para enviar mensajes
function enviarMensaje() {
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

// Función para que Jarvis hable
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
// Cuando Jarvis vaya a hablar:
function hablarRespuesta(respuesta) {
  // 🔴 PAUSAR el reconocimiento mientras habla
  if (recognition) {
    recognition.stop();
  }
  
  const utterance = new SpeechSynthesisUtterance(respuesta);
  utterance.lang = 'es-ES';
  utterance.rate = 1.0;
  
  utterance.onend = () => {
    console.log('✅ Jarvis terminó de hablar');
    // 🔴 REANUDAR después de 1 segundo
    setTimeout(() => {
      if (recognition) {
        recognition.start();
      }
    }, 1000);
  };
  
  speechSynthesis.speak(utterance);
}
// Función INICIAR JARVIS
async function iniciarJarvis() {
  console.log('🚀 Iniciando Jarvis...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    
    voiceEnabled = true;
    
    const overlay = document.getElementById('start-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    agregarMensaje('🤖 ¡Hola Niurka! Jarvis está listo. Presiona el micrófono 🎤 o Ctrl+M para hablar.', 'jarvis');
    speakText('Bienvenida Niurka. Jarvis está listo para ayudarte.');
    
  } catch (err) {
    console.error('❌ Error al acceder al micrófono:', err);
    alert('⛔ Necesito acceso al micrófono para funcionar.');
  }
}

// Hacer funciones globales
window.iniciarJarvis = iniciarJarvis;
window.toggleListening = toggleListening;
window.enviarMensaje = enviarMensaje;
window.agregarMensaje = agregarMensaje;
window.speakText = speakText;

// Atajo de teclado Ctrl+M
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'm') {
    e.preventDefault();
    toggleListening();
  }
});