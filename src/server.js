import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { inicializarWhatsApp } from './services/whatsapp.js';
import { generarRespuestaSugerida } from './services/ai.js';
import { crearRecordatorio } from './services/scheduler.js';
import { supabase } from './config/supabase.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Socket.io
io.on('connection', (socket) => {
  console.log(' Cliente conectado al Centro de Control');
  
  // Recibir mensaje del usuario
  socket.on('jarvis:mensaje', async (data) => {
    const { mensaje } = data;
    
    // Procesar con IA
    const respuesta = await generarRespuestaSugerida(mensaje);
    
    // Guardar en Supabase
    if (respuesta) {
      await supabase.from('jarvis_memory').insert([{
        content: mensaje,
        category: 'chat',
        metadata: { respuesta: respuesta.respuesta }
      }]);
    }
    
    socket.emit('jarvis:respuesta', respuesta);
  });
  
  // Crear recordatorio
  socket.on('jarvis:recordatorio', async (data) => {
    const { hora, mensaje } = data;
    const cliente = await import('./services/whatsapp.js').then(m => m.getClient());
    
    crearRecordatorio({ hora, mensaje, cliente });
    
    socket.emit('jarvis:confirmacion', {
      mensaje: `✅ Recordatorio creado para las ${hora}`
    });
  });
});

// Inicializar WhatsApp
inicializarWhatsApp(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Centro de Control Jarvis corriendo en http://localhost:${PORT}`);
});

export default app;