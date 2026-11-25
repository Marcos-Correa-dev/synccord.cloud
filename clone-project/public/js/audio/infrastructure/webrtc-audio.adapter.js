/**
 * SyncCord WebRTC Audio Constraints & Device Adapter
 * Hexagonal Architecture - Infrastructure Layer
 * Solves the muffled/ducked audio issue when entering voice channels.
 */
(function (global) {
  'use strict';

  class WebRtcAudioAdapter {
    /**
     * Builds browser audio constraints avoiding Windows Communications ducking & HFP degradation.
     * When antiDucking or highFidelity is enabled, native AEC is avoided so Windows doesn't lower
     * YouTube or other background applications by 80%.
     *
     * @param {Object} settings AudioSettings state
     * @param {string} deviceId Target microphone deviceId
     * @returns {MediaStreamConstraints}
     */
    static buildCaptureConstraints(settings, deviceId) {
      const isAntiDuckingActive = settings.antiDucking !== false;
      const isHighFidelity = settings.highFidelity !== false;
      const isKrispActive = settings.noiseSuppression !== false && settings.noiseSuppressionMode !== 'off';
      const isVoiceIsolationActive = settings.voiceIsolation !== false;
      const useHardwareNoiseCancel = isKrispActive || isVoiceIsolationActive;

      // Base audio constraints:
      // Windows CoreAudio eCommunications ducking is ONLY triggered by echoCancellation: true.
      // Enabling native C++ WebRTC RNNoise (noiseSuppression) & voiceIsolation gives hardware-level
      // noise cancellation before our Web Audio Krisp Spectral Gate + Voice Isolation DSP stage runs!
      const audioConstraints = {
        sampleRate: { ideal: 48000 },
        sampleSize: { ideal: 16 },
        channelCount: { ideal: isVoiceIsolationActive ? 1 : 2 },
        echoCancellation: isAntiDuckingActive ? (settings.echoCancellation || false) : true,
        noiseSuppression: useHardwareNoiseCancel,
        voiceIsolation: isVoiceIsolationActive,
        autoGainControl: Boolean(settings.autoGainControl),
        latency: { ideal: 0.01 },
      };

      // Chrome/Edge/WebView2 extended constraints
      if (isAntiDuckingActive || isHighFidelity) {
        audioConstraints.googEchoCancellation = settings.echoCancellation || false;
        audioConstraints.googAutoGainControl = Boolean(settings.autoGainControl);
        audioConstraints.googNoiseSuppression = useHardwareNoiseCancel;
        audioConstraints.googNoiseSuppression2 = useHardwareNoiseCancel;
        audioConstraints.googHighpassFilter = useHardwareNoiseCancel;
        audioConstraints.googTypingNoiseDetection = useHardwareNoiseCancel;
        audioConstraints.suppressLocalAudioPlayback = true;
      }

      if (deviceId && deviceId !== 'default') {
        audioConstraints.deviceId = { ideal: deviceId };
      }

      return { audio: audioConstraints, video: false };
    }

    /**
     * Detects if a device is likely a Bluetooth headset operating in Hands-Free Profile (HFP).
     * @param {MediaDeviceInfo} device
     * @returns {boolean}
     */
    static isBluetoothDevice(device) {
      if (!device || !device.label) return false;
      const label = device.label.toLowerCase();
      return (
        label.includes('bluetooth') ||
        label.includes('hands-free') ||
        label.includes('handsfree') ||
        label.includes('hfp') ||
        label.includes('airpods') ||
        label.includes('galaxy buds') ||
        label.includes('wh-1000') ||
        label.includes('wf-1000') ||
        label.includes('wireless headset') ||
        label.includes('headset')
      );
    }

    /**
     * Checks if current input/output configuration might trigger Bluetooth HFP quality degradation.
     * @param {MediaDeviceInfo[]} devices
     * @param {string} selectedInputId
     * @param {string} selectedOutputId
     * @returns {{ hasBluetoothIssue: boolean, warningMessage: string, recommendedInputId: string | null }}
     */
    static checkBluetoothConflict(devices, selectedInputId, selectedOutputId) {
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      const selectedOut = audioOutputs.find((d) => d.deviceId === selectedOutputId) || audioOutputs[0];
      const selectedIn = audioInputs.find((d) => d.deviceId === selectedInputId) || audioInputs[0];

      const isOutBluetooth = this.isBluetoothDevice(selectedOut);
      const isInBluetooth = this.isBluetoothDevice(selectedIn);

      // If both input and output are the Bluetooth headset, Windows switches Bluetooth to 8kHz/16kHz HFP!
      if (isOutBluetooth && isInBluetooth) {
        // Find an alternative non-bluetooth microphone (e.g., built-in PC mic or webcam)
        const altInput = audioInputs.find((d) => !this.isBluetoothDevice(d) && d.deviceId !== selectedIn.deviceId);

        return {
          hasBluetoothIssue: true,
          warningMessage:
            'Aviso de Fidelidade: Seu fone Bluetooth está selecionado como microfone e saída. ' +
            'No Windows, isso força o modo telefone (16kHz mono), deixando vídeos e músicas abafados. ' +
            'Recomendamos selecionar o microfone integrado do PC/Webcam como entrada para manter som estúdio no fone!',
          recommendedInputId: altInput ? altInput.deviceId : null,
        };
      }

      return {
        hasBluetoothIssue: false,
        warningMessage: '',
        recommendedInputId: null,
      };
    }
  }

  global.WebRtcAudioAdapter = WebRtcAudioAdapter;
})(typeof window !== 'undefined' ? window : this);
