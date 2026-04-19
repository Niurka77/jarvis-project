// public/audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channel0 = input[0];
      const newBuffer = new Float32Array(this.buffer.length + channel0.length);
      newBuffer.set(this.buffer);
      newBuffer.set(channel0, this.buffer.length);
      this.buffer = newBuffer;
      
      // Enviar cada 2048 samples (~128ms a 16kHz)
      if (this.buffer.length >= 2048) {
        this.port.postMessage(this.buffer.slice(0, 2048).buffer);
        this.buffer = this.buffer.slice(2048);
      }
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);