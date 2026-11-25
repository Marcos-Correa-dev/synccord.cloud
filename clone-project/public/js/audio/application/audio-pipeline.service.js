/**
 * SyncCord Audio Pipeline Service
 * Hexagonal Architecture - Application Layer
 * Orchestrates microphone capture, noise suppression, VAD, and WebRTC audio dispatching.
 */
(function (global) {
  'use strict';

  class AudioPipelineService {
    constructor() {
      this.settings = global.SyncCordAudioSettings;
      this.suppressor = new global.DspNoiseSuppressorAdapter();

      this.audioContext = null;
      this.rawMediaStream = null;
      this.sourceNode = null;
      this.destinationNode = null;
      this.processedMediaStream = null;

      // Analysis & VAD
      this.analyserNode = null;
      this.analyserBuffer = null;
      this.vadAnimationId = null;
      this.isSpeaking = false;
      this.speakingChangeCallbacks = [];
      this.volumeLevelCallbacks = [];

      this.isCapturing = false;
    }

    /**
     * Initializes and starts the complete audio capture & suppression pipeline
     * @param {string} deviceId Target microphone device ID
     * @returns {Promise<MediaStream>} The processed, noise-suppressed MediaStream
     */
    async start(deviceId) {
      this.stop();

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser environment.');
      }

      // 1. Initialize AudioContext at 48000Hz (Discord standard sample rate)
      this.audioContext = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {});
      }

      // 2. Build anti-ducking constraints and capture raw audio
      const currentSettings = this.settings.getAll();
      const constraints = global.WebRtcAudioAdapter.buildCaptureConstraints(currentSettings, deviceId);

      try {
        this.rawMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('[AudioPipeline] Fallback to simple audio constraints:', err);
        this.rawMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      // 3. Setup Noise Suppressor (Krisp AI + Voice Isolation + Input Gain 0-200%)
      this.suppressor.init(this.audioContext);
      this.suppressor.setEnabled(currentSettings.noiseSuppression !== false);
      this.suppressor.setMode(currentSettings.noiseSuppressionMode || 'krisp');
      this.suppressor.setVoiceIsolation(currentSettings.voiceIsolation !== false);
      this.suppressor.setThreshold(
        typeof currentSettings.noiseGateThreshold === 'number' ? currentSettings.noiseGateThreshold : -38,
      );
      const inputVolPercent = typeof currentSettings.inputVolume === 'number' ? currentSettings.inputVolume : 100;
      this.suppressor.setInputGain(inputVolPercent / 100);

      // 4. Connect Web Audio Pipeline:
      // Raw Mic Stream -> Source Node -> Noise Suppressor -> Destination Node -> Processed Stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawMediaStream);
      const suppressedOutput = this.suppressor.process(this.sourceNode);

      this.destinationNode = this.audioContext.createMediaStreamDestination();
      suppressedOutput.connect(this.destinationNode);
      this.processedMediaStream = this.destinationNode.stream;

      // 5. Connect Analyser Node for VU meter and Voice Activity Detection (VAD)
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.25;
      this.analyserBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);
      suppressedOutput.connect(this.analyserNode);

      this.isCapturing = true;
      this.startVadLoop();

      console.log('🎙️ [AudioPipeline] Audio processing pipeline active: 48kHz, Noise Suppressor: ' + currentSettings.noiseSuppressionMode);
      return this.processedMediaStream;
    }

    /**
     * Returns the active processed audio track for WebRTC transmission
     * @returns {MediaStreamTrack | null}
     */
    getOutgoingAudioTrack() {
      if (this.processedMediaStream) {
        const tracks = this.processedMediaStream.getAudioTracks();
        if (tracks.length > 0) return tracks[0];
      }
      if (this.rawMediaStream) {
        const rawTracks = this.rawMediaStream.getAudioTracks();
        if (rawTracks.length > 0) return rawTracks[0];
      }
      return null;
    }

    /**
     * Sets microphone mute status
     * @param {boolean} isMuted
     */
    setMuted(isMuted) {
      if (this.rawMediaStream) {
        this.rawMediaStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      }
      if (this.processedMediaStream) {
        this.processedMediaStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      }
    }

    /**
     * Dynamic update of noise suppression settings without re-opening microphone
     * @param {Object} partial
     */
    updateSettings(partial) {
      const updated = this.settings.update(partial);
      if (this.suppressor) {
        if ('noiseSuppression' in partial) {
          this.suppressor.setEnabled(updated.noiseSuppression);
        }
        if ('noiseSuppressionMode' in partial) {
          this.suppressor.setMode(updated.noiseSuppressionMode);
        }
        if ('voiceIsolation' in partial) {
          this.suppressor.setVoiceIsolation(updated.voiceIsolation);
        }
        if ('noiseGateThreshold' in partial) {
          this.suppressor.setThreshold(updated.noiseGateThreshold);
        }
        if ('inputVolume' in partial) {
          this.suppressor.setInputGain((Number(updated.inputVolume) || 100) / 100);
        }
      }
      if (this.rawMediaStream && ('noiseSuppression' in partial || 'noiseSuppressionMode' in partial || 'voiceIsolation' in partial)) {
        const isKrisp = updated.noiseSuppression !== false && updated.noiseSuppressionMode !== 'off';
        const isIso = updated.voiceIsolation !== false;
        const useHwNs = isKrisp || isIso;
        this.rawMediaStream.getAudioTracks().forEach((track) => {
          if (typeof track.applyConstraints === 'function') {
            track.applyConstraints({
              noiseSuppression: useHwNs,
              voiceIsolation: isIso,
            }).catch(() => {});
          }
        });
      }
    }

    /**
     * VAD loop for speaking detection and VU metering
     */
    startVadLoop() {
      const checkVad = () => {
        if (!this.isCapturing || !this.analyserNode) return;

        this.analyserNode.getByteFrequencyData(this.analyserBuffer);
        let sum = 0;
        for (let i = 0; i < this.analyserBuffer.length; i++) {
          sum += this.analyserBuffer[i];
        }
        const average = sum / this.analyserBuffer.length;

        // Dispatch volume level callback for VU meter
        this.volumeLevelCallbacks.forEach((cb) => cb(average));

        // Threshold for speaking indicator (respects Krisp / Voice Isolation gate state so background noise never triggers green ring)
        const gateAllowsSpeech = !this.suppressor || this.suppressor.isGateOpen;
        const speakingNow = gateAllowsSpeech && average > 18;
        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.speakingChangeCallbacks.forEach((cb) => cb(this.isSpeaking));
        }

        this.vadAnimationId = requestAnimationFrame(checkVad);
      };

      checkVad();
    }

    onSpeakingChange(callback) {
      this.speakingChangeCallbacks.push(callback);
    }

    onVolumeLevel(callback) {
      this.volumeLevelCallbacks.push(callback);
    }

    /**
     * Stops and tears down the audio pipeline cleanly
     */
    stop() {
      this.isCapturing = false;
      this.isSpeaking = false;

      if (this.vadAnimationId) {
        cancelAnimationFrame(this.vadAnimationId);
        this.vadAnimationId = null;
      }

      if (this.suppressor) {
        this.suppressor.destroy();
      }

      if (this.rawMediaStream) {
        this.rawMediaStream.getTracks().forEach((t) => t.stop());
        this.rawMediaStream = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }

      this.processedMediaStream = null;
      this.sourceNode = null;
      this.destinationNode = null;
      this.analyserNode = null;
    }
  }

  global.SyncCordAudioPipeline = new AudioPipelineService();
})(typeof window !== 'undefined' ? window : this);
