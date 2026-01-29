/**
 * Voice Manager - Coordinates voice input lifecycle
 * Phase 5: Voice Input
 */
const { getSpeechPatterns } = require('./speechPatterns');

class VoiceManager {
  constructor(options = {}) {
    this.options = {
      silenceTimeout: 1500, // ms of silence before auto-send in continuous mode
      maxRecordingTime: 60000, // 60 seconds max
      ...options
    };

    this.state = 'idle'; // idle, listening, processing
    this.mode = 'push-to-talk'; // push-to-talk or continuous
    this.listeners = new Map();
    this.currentTranscription = '';
  }

  /**
   * Start listening for voice input
   * @param {Object} options - { mode: 'push-to-talk' | 'continuous' }
   */
  start(options = {}) {
    if (this.state !== 'idle') {
      return { success: false, error: 'Already listening' };
    }

    this.mode = options.mode || 'push-to-talk';
    this.state = 'listening';
    this.currentTranscription = '';

    this.emit('stateChange', { state: this.state, mode: this.mode });

    return { success: true, mode: this.mode };
  }

  /**
   * Stop listening
   */
  stop() {
    if (this.state === 'idle') {
      return { success: false, error: 'Not listening' };
    }

    const previousState = this.state;
    this.state = 'idle';

    this.emit('stateChange', { state: this.state });

    // Return the transcription if we were listening
    if (previousState === 'listening' && this.currentTranscription) {
      const finalText = this.applyCorrections(this.currentTranscription);
      this.emit('transcriptionComplete', { text: finalText });
      return { success: true, text: finalText };
    }

    return { success: true };
  }

  /**
   * Process incoming transcription text
   * @param {string} text - Raw transcription
   * @param {boolean} isFinal - Whether this is the final result
   */
  processTranscription(text, isFinal = false) {
    if (this.state !== 'listening') return;

    this.currentTranscription = text;

    // Emit interim result
    this.emit('transcription', {
      text,
      isFinal,
      corrected: isFinal ? this.applyCorrections(text) : null
    });

    // In continuous mode, auto-send on final result
    if (isFinal && this.mode === 'continuous') {
      const correctedText = this.applyCorrections(text);
      this.emit('transcriptionComplete', { text: correctedText });
    }
  }

  /**
   * Apply learned speech corrections
   * @param {string} text - Raw text
   * @returns {string} Corrected text
   */
  applyCorrections(text) {
    const patterns = getSpeechPatterns();
    const result = patterns.applyPatterns(text);
    return result.corrected;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      mode: this.mode,
      currentTranscription: this.currentTranscription
    };
  }

  /**
   * Set voice mode
   * @param {string} mode - 'push-to-talk' or 'continuous'
   */
  setMode(mode) {
    if (!['push-to-talk', 'continuous'].includes(mode)) {
      return { success: false, error: 'Invalid mode' };
    }
    this.mode = mode;
    return { success: true, mode };
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (e) {
          console.error(`Voice event handler error (${event}):`, e);
        }
      }
    }
  }
}

// Singleton
let instance = null;

function getVoiceManager() {
  if (!instance) {
    instance = new VoiceManager();
  }
  return instance;
}

module.exports = { VoiceManager, getVoiceManager };
