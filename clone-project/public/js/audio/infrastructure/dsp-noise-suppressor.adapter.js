/**
 * SyncCord DSP & Spectral Noise Suppressor Adapter (Krisp AI + Voice Isolation)
 * Hexagonal Architecture - Infrastructure Layer
 * Implements INoiseSuppressor using Web Audio API spectral voice-band analysis and gating.
 */
(function (global) {
  'use strict';

  class DspNoiseSuppressorAdapter {
    constructor() {
      this.audioContext = null;
      this.enabled = true;
      this.mode = 'krisp'; // 'krisp' (spectral gate + filters) | 'dsp' (filters only) | 'off'
      this.voiceIsolation = true; // Discord Voice Isolation flag
      this.thresholdDb = -38;
      this.inputGainMultiplier = 1.0; // 0.0 to 2.0 (0% - 200%)

      // Audio Nodes
      this.inputNode = null;
      this.highPassFilter = null;
      this.humNotchFilter60 = null;
      this.humNotchFilter50 = null;
      this.mudCutFilter = null;
      this.formantFilter = null;
      this.lowPassFilter = null;
      this.hissShelfFilter = null;
      this.gateGainNode = null;
      this.compressorNode = null;
      this.outputNode = null;

      // Spectral & Gate state
      this.analyser = null;
      this.analyserData = null;
      this.freqData = null;
      this.isGateOpen = false;
      this.lastVoiceDetectedTime = 0;
      this.gateHoldMs = 85;
      this.gateAnimationId = null;
      this.adaptiveNoiseFloorDb = -52;
    }

    init(audioContext) {
      this.audioContext = audioContext;
      this.createNodes();
    }

    createNodes() {
      if (!this.audioContext) return;
      const ctx = this.audioContext;

      // 1. High-Pass Filter (cuts fan rumble, HVAC, breath pops & desk thumps)
      this.highPassFilter = ctx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';

      // 2. Anti-Hum Notch Filters (cancels 60Hz and 50Hz AC electrical hum)
      this.humNotchFilter60 = ctx.createBiquadFilter();
      this.humNotchFilter60.type = 'notch';
      this.humNotchFilter60.frequency.setValueAtTime(60, ctx.currentTime);
      this.humNotchFilter60.Q.setValueAtTime(10.0, ctx.currentTime);

      this.humNotchFilter50 = ctx.createBiquadFilter();
      this.humNotchFilter50.type = 'notch';
      this.humNotchFilter50.frequency.setValueAtTime(50, ctx.currentTime);
      this.humNotchFilter50.Q.setValueAtTime(10.0, ctx.currentTime);

      // 3. Low-Mid Boxy/Room Mud Cut Filter (260Hz)
      this.mudCutFilter = ctx.createBiquadFilter();
      this.mudCutFilter.type = 'peaking';
      this.mudCutFilter.frequency.setValueAtTime(260, ctx.currentTime);
      this.mudCutFilter.Q.setValueAtTime(1.4, ctx.currentTime);

      // 4. Speech Formant Enhancer (vocal presence boost at 2.2kHz, like Discord Krisp)
      this.formantFilter = ctx.createBiquadFilter();
      this.formantFilter.type = 'peaking';
      this.formantFilter.frequency.setValueAtTime(2200, ctx.currentTime);
      this.formantFilter.Q.setValueAtTime(1.2, ctx.currentTime);

      // 5. Steep High-Frequency Noise/Keyboard/Hiss Low-Pass Filter
      this.lowPassFilter = ctx.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

      // 6. Anti-Hiss High Shelf (suppresses high-frequency microphone thermal hiss & air noise)
      this.hissShelfFilter = ctx.createBiquadFilter();
      this.hissShelfFilter.type = 'highshelf';

      // 7. Spectral Noise Gate Gain Node
      // Starts CLOSED at silence floor when Krisp/Voice Isolation is active so background noise is immediately blocked
      this.gateGainNode = ctx.createGain();
      const shouldGate = (this.enabled && this.mode === 'krisp') || this.voiceIsolation;
      this.isGateOpen = !shouldGate;
      this.gateGainNode.gain.setValueAtTime(shouldGate ? 0.0005 : 1.0, ctx.currentTime);

      // 8. Speech Dynamics Compressor & Peak Limiter
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-20, ctx.currentTime);
      this.compressorNode.knee.setValueAtTime(10, ctx.currentTime);
      this.compressorNode.ratio.setValueAtTime(4.0, ctx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressorNode.release.setValueAtTime(0.12, ctx.currentTime);

      // 9. Output Master Gain (supports 0% to 200% microphone input amplification)
      this.outputNode = ctx.createGain();
      this.outputNode.gain.setValueAtTime(this.inputGainMultiplier, ctx.currentTime);

      // Analyser for real-time spectral voice-band detection & noise gate envelope tracking
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.18;
      this.analyserData = new Float32Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      // Chain the filters:
      // HighPass -> Notch60 -> Notch50 -> MudCut -> Formant -> LowPass -> HissShelf -> GateGain -> Compressor -> Output
      this.highPassFilter.connect(this.humNotchFilter60);
      this.humNotchFilter60.connect(this.humNotchFilter50);
      this.humNotchFilter50.connect(this.mudCutFilter);
      this.mudCutFilter.connect(this.formantFilter);
      this.formantFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.hissShelfFilter);
      this.hissShelfFilter.connect(this.gateGainNode);
      this.hissShelfFilter.connect(this.analyser); // Sidechain pre-gate spectral analysis
      this.gateGainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.outputNode);

      this.applyFilterTuning();
      this.startGateLoop();
    }

    applyFilterTuning() {
      if (!this.audioContext || !this.highPassFilter) return;
      const now = this.audioContext.currentTime;
      const isKrispOrDsp = this.enabled && this.mode !== 'off';
      const isIso = !!this.voiceIsolation;

      if (isIso) {
        // Strict Discord Voice Isolation Bandpass (135Hz - 3900Hz vocal core)
        this.highPassFilter.frequency.setTargetAtTime(135, now, 0.015);
        this.highPassFilter.Q.setTargetAtTime(0.85, now, 0.015);
        this.mudCutFilter.gain.setTargetAtTime(-4.0, now, 0.015);
        this.formantFilter.gain.setTargetAtTime(4.0, now, 0.015);
        this.lowPassFilter.frequency.setTargetAtTime(3900, now, 0.015);
        this.hissShelfFilter.frequency.setTargetAtTime(3600, now, 0.015);
        this.hissShelfFilter.gain.setTargetAtTime(-14.0, now, 0.015);
      } else if (isKrispOrDsp) {
        // Krisp AI / DSP Full Voice Clarity (110Hz - 6200Hz)
        this.highPassFilter.frequency.setTargetAtTime(110, now, 0.015);
        this.highPassFilter.Q.setTargetAtTime(0.707, now, 0.015);
        this.mudCutFilter.gain.setTargetAtTime(-2.0, now, 0.015);
        this.formantFilter.gain.setTargetAtTime(2.8, now, 0.015);
        this.lowPassFilter.frequency.setTargetAtTime(6200, now, 0.015);
        this.hissShelfFilter.frequency.setTargetAtTime(5200, now, 0.015);
        this.hissShelfFilter.gain.setTargetAtTime(-9.0, now, 0.015);
      } else {
        // Bypass / Raw Studio Input
        this.highPassFilter.frequency.setTargetAtTime(20, now, 0.015);
        this.highPassFilter.Q.setTargetAtTime(0.707, now, 0.015);
        this.mudCutFilter.gain.setTargetAtTime(0.0, now, 0.015);
        this.formantFilter.gain.setTargetAtTime(0.0, now, 0.015);
        this.lowPassFilter.frequency.setTargetAtTime(20000, now, 0.015);
        this.hissShelfFilter.frequency.setTargetAtTime(12000, now, 0.015);
        this.hissShelfFilter.gain.setTargetAtTime(0.0, now, 0.015);
      }

      const shouldGate = (this.enabled && this.mode === 'krisp') || isIso;
      if (!shouldGate && this.gateGainNode) {
        this.isGateOpen = true;
        this.gateGainNode.gain.cancelScheduledValues(now);
        this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.01);
      }
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
      this.applyFilterTuning();
    }

    setMode(mode) {
      this.mode = mode;
      this.enabled = mode !== 'off';
      this.applyFilterTuning();
    }

    setVoiceIsolation(enabled) {
      this.voiceIsolation = !!enabled;
      this.applyFilterTuning();
    }

    setThreshold(thresholdDb) {
      this.thresholdDb = Number(thresholdDb);
    }

    setInputGain(gainMultiplier) {
      const clamped = Math.max(0.0, Math.min(2.0, Number(gainMultiplier)));
      this.inputGainMultiplier = isNaN(clamped) ? 1.0 : clamped;
      if (this.outputNode && this.audioContext) {
        this.outputNode.gain.setTargetAtTime(this.inputGainMultiplier, this.audioContext.currentTime, 0.015);
      }
    }

    startGateLoop() {
      if (!this.analyser || !this.gateGainNode || !this.audioContext) return;

      const runLoop = () => {
        if (!this.audioContext || this.audioContext.state === 'closed') return;

        const isKrispGateActive = (this.enabled && this.mode === 'krisp') || this.voiceIsolation;
        if (isKrispGateActive) {
          this.analyser.getFloatTimeDomainData(this.analyserData);
          this.analyser.getByteFrequencyData(this.freqData);

          // 1. Time-domain RMS energy in dB
          let sumSquares = 0;
          for (let i = 0; i < this.analyserData.length; i++) {
            const val = this.analyserData[i];
            sumSquares += val * val;
          }
          const rms = Math.sqrt(sumSquares / this.analyserData.length);
          const currentDb = rms > 0.00001 ? 20 * Math.log10(rms) : -100;

          // 2. Spectral Voice-Band Energy (140Hz - 3400Hz) vs Non-Vocal Noise (Rumble <100Hz & Clicks/Hiss >4200Hz)
          // At 48000Hz & fftSize 1024, each bin is ~46.875Hz:
          // Voice bins: 3..72 (~140Hz..3375Hz)
          let voiceSum = 0;
          for (let b = 3; b <= 72; b++) {
            voiceSum += this.freqData[b];
          }
          const voiceAvg = voiceSum / 70;

          // High noise bins: 90..220 (~4200Hz..10300Hz) + Low rumble bins: 0..2
          let noiseSum = this.freqData[0] + this.freqData[1] + this.freqData[2];
          for (let b = 90; b <= 200; b++) {
            noiseSum += this.freqData[b];
          }
          const noiseAvg = noiseSum / 114;

          // 3. Adaptive Noise Floor Tracking during non-speech frames
          if (currentDb < this.thresholdDb && currentDb > -85) {
            this.adaptiveNoiseFloorDb = this.adaptiveNoiseFloorDb * 0.985 + currentDb * 0.015;
          }

          // Effective gate threshold adapts above constant fan/room noise floor
          const adaptiveMargin = this.voiceIsolation ? 7 : 5;
          const effectiveThresholdDb = Math.max(
            this.thresholdDb,
            Math.min(-22, this.adaptiveNoiseFloorDb + adaptiveMargin),
          );

          // Human voice has dominant energy in the 140Hz-3400Hz band compared to high-frequency hiss/clicks
          const minVoiceRatio = this.voiceIsolation ? 1.35 : 1.15;
          const MinVoiceBinEnergy = this.voiceIsolation ? 18 : 12;
          const hasVocalFormants = voiceAvg >= MinVoiceBinEnergy && voiceAvg >= noiseAvg * minVoiceRatio;

          const now = this.audioContext.currentTime;
          const perfNow = performance.now();

          if (currentDb > effectiveThresholdDb && hasVocalFormants) {
            this.lastVoiceDetectedTime = perfNow;
            if (!this.isGateOpen) {
              this.isGateOpen = true;
              this.gateGainNode.gain.cancelScheduledValues(now);
              // Fast 3ms attack so first syllable is never clipped
              this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.003);
            }
          } else if (perfNow - this.lastVoiceDetectedTime > this.gateHoldMs) {
            // Below threshold or non-vocal noise (fan, keyboard typing, mouse clicks, breathing)
            const closedFloor = this.voiceIsolation ? 0.0002 : 0.001; // -74dB / -60dB deep noise cancellation
            if (this.isGateOpen || this.gateGainNode.gain.value > closedFloor * 2) {
              this.isGateOpen = false;
              this.gateGainNode.gain.cancelScheduledValues(now);
              this.gateGainNode.gain.setTargetAtTime(closedFloor, now, 0.045);
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
