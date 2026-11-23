/**
 * SyncCord Voice Processing Settings — Domain Entity
 * Hexagonal Architecture - Domain Layer
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'synccord_audio_settings_v1';

  const DEFAULT_SETTINGS = {
    // Noise Suppression (Supressor de Ruído)
    noiseSuppression: true,
    noiseSuppressionMode: 'krisp', // 'krisp' (AI-style spectral gate) | 'dsp' | 'off'
    noiseGateThreshold: -45, // dB threshold for background noise cutoff (-60dB to -20dB)
    noiseReductionAmount: 18, // dB attenuation of background noise

    // Anti-Ducking & High Fidelity (Solves YouTube / Video audio muffled issue)
    antiDucking: true, // Prevents Windows from lowering/muffling YouTube and other applications
    highFidelity: true, // 48kHz studio audio rate, full frequency bandwidth
    echoCancellation: false, // Default false to prevent Windows communications mode when using headphones
    autoGainControl: false, // Default false at browser level; managed cleanly by DSP compressor

    // Volumes
    inputVolume: 100, // 0 - 100%
    outputVolume: 100, // 0 - 200%
    attenuation: 0, // Discord Attenuation setting (0% = don't lower other apps)

    // Hardware devices
    selectedInputId: 'default',
    selectedOutputId: 'default',
  };

  class AudioSettings {
    constructor() {
      this.state = this.load();
    }

    load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(stored));
        }
      } catch (err) {
        console.warn('[AudioSettings] Error loading stored settings:', err);
      }
      return Object.assign({}, DEFAULT_SETTINGS);
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn('[AudioSettings] Error saving settings:', err);
      }
    }

    get(key) {
      return this.state[key];
    }

    set(key, value) {
      this.state[key] = value;
      this.save();
    }

    getAll() {
      return Object.assign({}, this.state);
    }

    update(partial) {
      Object.assign(this.state, partial);
      this.save();
      return this.getAll();
    }
  }

  global.SyncCordAudioSettings = new AudioSettings();
})(typeof window !== 'undefined' ? window : this);
