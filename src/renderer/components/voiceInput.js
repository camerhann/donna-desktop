/**
 * Voice Input Component
 * Phase 5: Voice Input
 * Microphone button, waveform animation, transcription preview
 */

class VoiceInputManager {
  constructor(options = {}) {
    this.options = {
      pushToTalkKey: 'KeyV', // Cmd+Shift+V
      toggleContinuousKey: 'KeyM', // Cmd+Shift+M
      ...options
    };

    this.recognition = null;
    this.isListening = false;
    this.mode = 'push-to-talk';
    this.currentTranscript = '';
    this.button = null;
    this.waveformElement = null;
    this.previewElement = null;

    this.init();
  }

  init() {
    this.setupSpeechRecognition();
    this.setupKeyboardShortcuts();
    this.addStyles();
  }

  /**
   * Setup Web Speech API
   */
  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.currentTranscript = finalTranscript || interimTranscript;
      this.updatePreview(this.currentTranscript, !finalTranscript);

      // Send to main process for correction
      if (finalTranscript) {
        window.donnaVoice?.processTranscription(finalTranscript, true);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.stopListening();
    };

    this.recognition.onend = () => {
      if (this.isListening && this.mode === 'continuous') {
        // Restart in continuous mode
        this.recognition.start();
      } else {
        this.isListening = false;
        this.updateButtonState();
      }
    };
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd+Shift+V - Push to talk (hold)
      if (e.code === this.options.pushToTalkKey && e.metaKey && e.shiftKey) {
        e.preventDefault();
        if (!this.isListening) {
          this.mode = 'push-to-talk';
          this.startListening();
        }
      }

      // Cmd+Shift+M - Toggle continuous mode
      if (e.code === this.options.toggleContinuousKey && e.metaKey && e.shiftKey) {
        e.preventDefault();
        this.mode = 'continuous';
        if (this.isListening) {
          this.stopListening();
        } else {
          this.startListening();
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      // Release push to talk
      if (e.code === this.options.pushToTalkKey && this.mode === 'push-to-talk' && this.isListening) {
        this.stopListening();
      }
    });
  }

  /**
   * Create microphone button
   */
  createButton(container) {
    this.button = document.createElement('button');
    this.button.className = 'voice-input-btn';
    this.button.title = 'Voice Input (⌘⇧V hold, ⌘⇧M toggle)';
    this.button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1a3 3 0 00-3 3v5a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M13 8v1a4 4 0 01-8 0V8M9 13v4M6 17h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;

    this.button.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.mode = 'push-to-talk';
        this.startListening();
      }
    });

    // Create waveform animation
    this.waveformElement = document.createElement('div');
    this.waveformElement.className = 'voice-waveform';
    this.waveformElement.innerHTML = `
      <span></span><span></span><span></span><span></span><span></span>
    `;

    // Create preview element
    this.previewElement = document.createElement('div');
    this.previewElement.className = 'voice-preview';

    container.appendChild(this.button);
    container.appendChild(this.waveformElement);
    container.appendChild(this.previewElement);

    return this.button;
  }

  /**
   * Start listening
   */
  startListening() {
    if (!this.recognition) {
      console.error('Speech recognition not available');
      return;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      this.currentTranscript = '';
      this.updateButtonState();
      window.donnaVoice?.startListening({ mode: this.mode });
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (!this.recognition) return;

    try {
      this.recognition.stop();
      this.isListening = false;
      this.updateButtonState();
      window.donnaVoice?.stopListening();

      // Return final transcript
      if (this.currentTranscript) {
        this.emit('transcription', { text: this.currentTranscript });
      }
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
    }
  }

  /**
   * Update button visual state
   */
  updateButtonState() {
    if (!this.button) return;

    this.button.classList.toggle('listening', this.isListening);
    this.waveformElement?.classList.toggle('active', this.isListening);

    if (!this.isListening) {
      this.previewElement.style.display = 'none';
    }
  }

  /**
   * Update transcription preview
   */
  updatePreview(text, isInterim = false) {
    if (!this.previewElement) return;

    if (text) {
      this.previewElement.textContent = text;
      this.previewElement.classList.toggle('interim', isInterim);
      this.previewElement.style.display = 'block';
    } else {
      this.previewElement.style.display = 'none';
    }
  }

  /**
   * Get current transcript
   */
  getTranscript() {
    return this.currentTranscript;
  }

  /**
   * Event emitter
   */
  emit(event, data) {
    window.dispatchEvent(new CustomEvent(`voice:${event}`, { detail: data }));
  }

  /**
   * Add styles
   */
  addStyles() {
    if (document.getElementById('voice-input-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'voice-input-styles';
    styles.textContent = `
      .voice-input-btn {
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        color: #a1a1aa;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        flex-shrink: 0;
      }

      .voice-input-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #e4e4e7;
      }

      .voice-input-btn.listening {
        background: rgba(239, 68, 68, 0.2);
        border-color: rgba(239, 68, 68, 0.5);
        color: #ef4444;
        animation: voicePulse 1.5s ease-in-out infinite;
      }

      @keyframes voicePulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }

      .voice-waveform {
        display: none;
        align-items: center;
        gap: 2px;
        height: 20px;
        margin-left: 8px;
      }

      .voice-waveform.active {
        display: flex;
      }

      .voice-waveform span {
        width: 3px;
        height: 8px;
        background: #ef4444;
        border-radius: 2px;
        animation: waveformBounce 0.5s ease-in-out infinite;
      }

      .voice-waveform span:nth-child(2) { animation-delay: 0.1s; }
      .voice-waveform span:nth-child(3) { animation-delay: 0.2s; }
      .voice-waveform span:nth-child(4) { animation-delay: 0.3s; }
      .voice-waveform span:nth-child(5) { animation-delay: 0.4s; }

      @keyframes waveformBounce {
        0%, 100% { height: 8px; }
        50% { height: 16px; }
      }

      .voice-preview {
        display: none;
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        margin-bottom: 8px;
        padding: 8px 12px;
        background: #27272a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        font-size: 13px;
        color: #e4e4e7;
        white-space: pre-wrap;
        max-height: 100px;
        overflow-y: auto;
      }

      .voice-preview.interim {
        color: #a1a1aa;
        font-style: italic;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Export
window.VoiceInputManager = VoiceInputManager;
