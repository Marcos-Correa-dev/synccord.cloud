/**
 * SyncCord Noise Suppressor Port
 * Hexagonal Architecture - Ports Layer
 * Defines the contract that any noise suppression algorithm must implement.
 */
(function (global) {
  'use strict';

  class INoiseSuppressor {
    /**
     * Initializes the suppressor with an active AudioContext
     * @param {AudioContext} _audioContext
     */
    init(_audioContext) {
      throw new Error('Not implemented');
    }

    /**
     * Attaches suppressor nodes to the audio graph
     * @param {AudioNode} _inputNode
     * @returns {AudioNode} outputNode
     */
    process(_inputNode) {
      throw new Error('Not implemented');
    }

    /**
     * Toggles suppression on or off
     * @param {boolean} _enabled
     */
    setEnabled(_enabled) {
      throw new Error('Not implemented');
    }

    /**
     * Sets operating mode: 'krisp' | 'dsp' | 'off'
     * @param {string} _mode
     */
    setMode(_mode) {
      throw new Error('Not implemented');
    }

    /**
     * Adjusts sensitivity threshold in dB
     * @param {number} _thresholdDb
     */
    setThreshold(_thresholdDb) {
      throw new Error('Not implemented');
    }

    /**
     * Toggles Discord-style Voice Isolation flag
     * @param {boolean} _enabled
     */
    setVoiceIsolation(_enabled) {
      throw new Error('Not implemented');
    }

    /**
     * Adjusts input microphone gain multiplier (0.0 to 2.0 for 0% - 200%)
     * @param {number} _gainMultiplier
     */
    setInputGain(_gainMultiplier) {
      throw new Error('Not implemented');
    }

    /**
     * Destroys and cleans up audio nodes
     */
    destroy() {
      throw new Error('Not implemented');
    }
  }

  global.INoiseSuppressor = INoiseSuppressor;
})(typeof window !== 'undefined' ? window : this);
