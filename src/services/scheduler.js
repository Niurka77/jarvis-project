import cron from 'node-cron';
import moment from 'moment';
import { getClient } from './whatsapp.js';

const recordatorios = [];

export function crearRecordatorio({ hora, mensaje, cliente }) {
  const ahora = moment();
  const horaRecordatorio = moment(hora, 'HH:mm');
  
  // Calcular 15 minutos antes
  const horaAlerta = horaRecordatorio.clone().subtract(15, 'minutes');
  
  const tarea = cron.schedule(`${horaAlerta.minute()} ${horaAlerta.hour()} * * *`, async () => {
    console.log(`🔔 RECORDATORIO: ${mensaje}`);
    
    // Enviar por WhatsApp
    if (cliente) {
      // Enviar a tu número (ajusta el número)
      await cliente.sendMessage(`${cliente.info.wid.user}@c.us`, 
        `🔔 *Jarvis te recuerda:* ${mensaje}\n⏰ Es en 15 minutos`
      );
    }
  }, {
    scheduled: false
  });
  
  tarea.start();
  
  recordatorios.push({ hora, mensaje, tarea });
  return tarea;
}

export function listarRecordatorios() {
  return recordatorios;
}