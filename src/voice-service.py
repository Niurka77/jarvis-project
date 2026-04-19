# src/voice-service.py
import asyncio
import websockets
import json
import os
import sys
from vosk import Model, KaldiRecognizer

# Configuración
MODEL_PATH = os.path.join(os.path.dirname(__file__), "vosk-models", "vosk-model-small-es-0.22")
SAMPLE_RATE = 16000

print(f"🔍 Cargando modelo desde: {MODEL_PATH}")

if not os.path.exists(MODEL_PATH):
    print(f"❌ Modelo no encontrado en {MODEL_PATH}")
    print("💡 Descarga el modelo desde: https://alphacephei.com/vosk/models")
    print("💡 Descomprímelo en: src/vosk-models/vosk-model-small-es-0.22")
    sys.exit(1)

print("⏳ Cargando modelo Vosk (esto puede tardar unos segundos)...")
model = Model(MODEL_PATH)
print("✅ Modelo Vosk cargado correctamente")

async def recognize_audio(websocket, path):
    """Recibe audio en tiempo real y devuelve texto reconocido"""
    rec = KaldiRecognizer(model, SAMPLE_RATE)
    
    print("🎤 Nuevo cliente de voz conectado")
    
    try:
        async for message in websocket:
            # Mensaje de configuración inicial
            if isinstance(message, str):
                try:
                    config = json.loads(message)
                    if config.get("type") == "config":
                        print(f"⚙️ Configuración recibida: {config}")
                        continue
                except json.JSONDecodeError:
                    pass
            
            # Datos de audio (binarios)
            if isinstance(message, bytes):
                if rec.AcceptWaveform(message):
                    result = json.loads(rec.Result())
                    text = result.get("text", "").strip()
                    if text:
                        print(f"🗣️ Reconocido: '{text}'")
                        await websocket.send(json.dumps({"text": text, "final": True}))
                else:
                    # Resultados parciales (opcional, para mostrar mientras habla)
                    partial = json.loads(rec.PartialResult())
                    if partial.get("partial"):
                        # No enviamos parciales para no saturar, pero podrías hacerlo
                        pass
    
    except websockets.exceptions.ConnectionClosed:
        print("🔌 Cliente de voz desconectado")
    except Exception as e:
        print(f"❌ Error en reconocimiento: {e}")
        import traceback
        traceback.print_exc()

async def main():
    # Servidor WebSocket en puerto 5001
    server = await websockets.serve(recognize_audio, "localhost", 5001)
    print("🚀 Servicio de voz Vosk corriendo en ws://localhost:5001")
    print("💡 Presiona Ctrl+C para detener")
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Servicio de voz detenido")