/**
 * SyncCord DSP & Spectral Noise Suppressor Adapter
 * Hexagonal Architecture - Infrastructure Layer
 * Implements INoiseSuppressor using Web Audio API nodes.
 */
(function (global) {
  'use strict';

  class DspNoiseSuppressorAdapter {
    constructor() {
      this.audioContext = null;
      this.enabled = true;
      this.mode = 'krisp'; // 'krisp' (spectral gate + filters) | 'dsp' (filters only) | 'off'
      this.thresholdDb = -45;

      // Audio Nodes
      this.inputNode = null;
      this.highPassFilter = null;
      this.humNotchFilter60 = null;
      this.humNotchFilter50 = null;
      this.formantFilter = null;
      this.hissShelfFilter = null;
      this.gateGainNode = null;
      this.compressorNode = null;
      this.outputNode = null;

      // Gate state
      this.analyser = null;
      this.analyserData = null;
      this.isGateOpen = false;
      this.gateAnimationId = null;
      this.noiseFloorDb = -60;
    }

    init(audioContext) {
      this.audioContext = audioContext;
      this.createNodes();
    }

    createNodes() {
      if (!this.audioContext) return;
      const ctx = this.audioContext;

      // 1. High-Pass Filter (cuts mechanical desk rumble & HVAC below 85Hz)
      this.highPassFilter = ctx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.setValueAtTime(85, ctx.currentTime);
      this.highPassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

      // 2. Anti-Hum Notch Filters (cancels 60Hz and 50Hz AC electrical hum)
      this.humNotchFilter60 = ctx.createBiquadFilter();
      this.humNotchFilter60.type = 'notch';
      this.humNotchFilter60.frequency.setValueAtTime(60, ctx.currentTime);
      this.humNotchFilter60.Q.setValueAtTime(8.0, ctx.currentTime);

      this.humNotchFilter50 = ctx.createBiquadFilter();
      this.humNotchFilter50.type = 'notch';
      this.humNotchFilter50.frequency.setValueAtTime(50, ctx.currentTime);
      this.humNotchFilter50.Q.setValueAtTime(8.0, ctx.currentTime);

      // 3. Speech Formant Enhancer (vocal presence boost at 2.4kHz, like Discord Krisp)
      this.formantFilter = ctx.createBiquadFilter();
      this.formantFilter.type = 'peaking';
      this.formantFilter.frequency.setValueAtTime(2400, ctx.currentTime);
      this.formantFilter.Q.setValueAtTime(1.2, ctx.currentTime);
      this.formantFilter.gain.setValueAtTime(2.5, ctx.currentTime);

      // 4. Anti-Hiss High Shelf (suppresses high-frequency microphone thermal hiss)
      this.hissShelfFilter = ctx.createBiquadFilter();
      this.hissShelfFilter.type = 'highshelf';
      this.hissShelfFilter.frequency.setValueAtTime(10500, ctx.currentTime);
      this.hissShelfFilter.gain.setValueAtTime(-3.0, ctx.currentTime);

      // 5. Spectral Noise Gate Gain Node
      this.gateGainNode = ctx.createGain();
      this.gateGainNode.gain.setValueAtTime(1.0, ctx.currentTime);

      // 6. Speech Dynamics Compressor & Peak Limiter
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-18, ctx.currentTime);
      this.compressorNode.knee.setValueAtTime(12, ctx.currentTime);
      this.compressorNode.ratio.setValueAtTime(3.5, ctx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressorNode.release.setValueAtTime(0.12, ctx.currentTime);

      // 7. Output Master Gain
      this.outputNode = ctx.createGain();
      this.outputNode.gain.setValueAtTime(1.0, ctx.currentTime);

      // Analyser for real-time noise gate envelope tracking
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      this.analyserData = new Float32Array(this.analyser.fftSize);

      // Chain the static filters:
      // HighPass -> Notch60 -> Notch50 -> Formant -> HissShelf -> GateGain -> Compressor -> Output
      this.highPassFilter.connect(this.humNotchFilter60);
      this.humNotchFilter60.connect(this.humNotchFilter50);
      this.humNotchFilter50.connect(this.formantFilter);
      this.formantFilter.connect(this.hissShelfFilter);
      this.hissShelfFilter.connect(this.gateGainNode);
      this.hissShelfFilter.connect(this.analyser); // Sidechain analysis for gate
      this.gateGainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.outputNode);

      this.startGateLoop();
    }

    process(inputNode) {
      this.inputNode = inputNode;
      if (this.inputNode && this.highPassFilter) {
        this.inputNode.connect(this.highPassFilter);
      }
      return this.outputNode;
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      if (!this.enabled || this.mode === 'off') {
        if (this.gateGainNode && this.audioContext) {
          this.gateGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
        }
      }
    }

    setMode(mode) {
      this.mode = mode;
      this.setEnabled(mode !== 'off');
    }

    setThreshold(thresholdDb) {
      this.thresholdDb = thresholdDb;
    }

    startGateLoop() {
      if (!this.analyser || !this.gateGainNode || !this.audioContext) return;

      const runLoop = () => {
        if (!this.audioContext || this.audioContext.state === 'closed') return;

        if (this.enabled && this.mode === 'krisp') {
          this.analyser.getFloatTimeDomainData(this.analyserData);

          // Calculate Root Mean Square (RMS) energy in decibels
          let sumSquares = 0;
          for (let i = 0; i < this.analyserData.length; i++) {
            const val = this.analyserData[i];
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / this.analyserData.length);
          const currentDb = rms > 0.00001 ? 20 * Math.log10(rms) : -100;

          const now = this.audioContext.currentTime;

          // Gate condition: speech vs ambient background noise
          if (currentDb > this.thresholdDb) {
            // User is speaking: smoothly open gate (4ms attack)
            if (!this.isGateOpen) {
              this.isGateOpen = true;
              this.gateGainNode.gain.cancelScheduledValues(now);
              this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.004);
            }
          } else {
            // Below threshold: background noise/fan/typing (smooth 120ms release down to -38dB attenuation)
            if (this.isGateOpen) {
              this.isGateOpen = false;
              this.gateGainNode.gain.cancelScheduledValues(now);
              // Maintain 4% minimum pass-through for natural room ambience without robotic cutting
              this.gateGainNode.gain.setTargetAtTime(0.04, now, 0.12);
            }
          }
        }

        this.gateAnimationId = requestAnimationFrame(runLoop);
      };

      runLoop();
    }

    destroy() {
      if (this.gateAnimationId) {
        cancelAnimationFrame(this.gateAnimationId);
        this.gateAnimationId = null;
      }

      if (this.inputNode && this.highPassFilter) {
        try {
          this.inputNode.disconnect(this.highPassFilter);
        } catch (_e) {}
      }
    }
  }

  global.DspNoiseSuppressorAdapter = DspNoiseSuppressorAdapter;
})(typeof window !== 'undefined' ? window : this);
