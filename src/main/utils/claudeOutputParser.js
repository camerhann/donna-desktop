/**
 * ClaudeOutputParser - PTY Stream Parser for Claude Code Output
 *
 * Parses raw terminal data from Claude Code into structured chat messages.
 * Handles ANSI escape codes, message boundaries, code blocks, tool calls,
 * and streaming buffer management.
 *
 * This parser intercepts PTY data before xterm renders it and emits
 * structured events that can be used to build a chat interface.
 *
 * @example
 * const parser = new ClaudeOutputParser();
 * parser.on('assistantChunk', (data) => console.log('Claude says:', data.content));
 * parser.on('codeBlock', (data) => console.log('Code:', data.language, data.code));
 * parser.write(ptyData);
 */

const { EventEmitter } = require('events');

/**
 * ANSI escape code patterns for stripping/parsing terminal output
 */
const ANSI_PATTERNS = {
  // CSI (Control Sequence Introducer) sequences: ESC [ ... final_byte
  CSI: /\x1b\[[0-9;]*[A-Za-z]/g,
  // OSC (Operating System Command) sequences: ESC ] ... BEL or ESC ] ... ST
  OSC: /\x1b\](?:[^\x07\x1b]|\x1b[^\\])*(?:\x07|\x1b\\)/g,
  // SGR (Select Graphic Rendition) - subset of CSI for colors/styles
  SGR: /\x1b\[[0-9;]*m/g,
  // Simple escape sequences: ESC followed by single character
  SIMPLE: /\x1b[^[\]]/g,
  // DCS (Device Control String) sequences
  DCS: /\x1bP[^\x1b]*\x1b\\/g,
  // APC (Application Program Command) sequences
  APC: /\x1b_[^\x1b]*\x1b\\/g,
  // PM (Privacy Message) sequences
  PM: /\x1b\^[^\x1b]*\x1b\\/g,
  // All ANSI patterns combined
  ALL: /\x1b(?:\[[0-9;]*[A-Za-z]|\](?:[^\x07\x1b]|\x1b[^\\])*(?:\x07|\x1b\\)|[^[\]]|P[^\x1b]*\x1b\\|_[^\x1b]*\x1b\\|\^[^\x1b]*\x1b\\)/g
};

/**
 * Claude Code specific markers and patterns
 */
const CLAUDE_PATTERNS = {
  // User prompt indicators (shell prompt characters)
  USER_PROMPT: /^(?:.*?[❯>$#%]\s*)/m,

  // Claude's filled circle tool marker (Unicode: U+2B24)
  TOOL_MARKER: /⏺/,

  // Tool call patterns - matches "⏺ ToolName" or "⏺ ToolName (details)"
  TOOL_CALL: /⏺\s+(\w+)(?:\s+\(([^)]+)\))?/,

  // Common tool names from Claude Code
  TOOL_NAMES: [
    'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
    'WebFetch', 'WebSearch', 'Task', 'TodoRead', 'TodoWrite',
    'mcp_', 'NotebookEdit', 'Agent'
  ],

  // Code block start: ```language or just ```
  CODE_BLOCK_START: /^```(\w*)\s*$/,

  // Code block end
  CODE_BLOCK_END: /^```\s*$/,

  // Thinking block markers (if Claude shows reasoning)
  THINKING_START: /<thinking>/i,
  THINKING_END: /<\/thinking>/i,

  // Horizontal separator (often marks section boundaries)
  SEPARATOR: /^[-─═]{3,}$/,

  // Claude's status indicators
  STATUS_WORKING: /(?:Thinking|Working|Processing)\.{2,}/i,
  STATUS_COMPLETE: /(?:Done|Complete|Finished)/i,

  // File path patterns (for context detection)
  FILE_PATH: /(?:\/[\w.-]+)+(?:\.\w+)?/,

  // Line continuation (when output wraps)
  LINE_CONTINUATION: /\\$/
};

/**
 * Parser states for the state machine
 */
const ParserState = {
  IDLE: 'idle',                    // Waiting for input
  USER_INPUT: 'user_input',        // Receiving user input
  ASSISTANT_RESPONSE: 'assistant', // Claude is responding
  CODE_BLOCK: 'code_block',        // Inside a code block
  TOOL_CALL: 'tool_call',          // Processing a tool call
  THINKING: 'thinking',            // Inside a thinking block
  WAITING: 'waiting'               // Waiting for Claude to respond
};

/**
 * Content types for parsed chunks
 */
const ContentType = {
  TEXT: 'text',
  CODE: 'code',
  TOOL: 'tool',
  THINKING: 'thinking',
  STATUS: 'status',
  ERROR: 'error'
};

/**
 * ClaudeOutputParser Class
 *
 * Parses Claude Code terminal output into structured messages.
 * Uses a state machine to track context and emit appropriate events.
 */
class ClaudeOutputParser extends EventEmitter {
  /**
   * Create a new parser instance
   * @param {Object} options - Configuration options
   * @param {number} options.pauseThreshold - Milliseconds of silence to detect message end (default: 500)
   * @param {boolean} options.stripAnsi - Whether to strip ANSI codes from output (default: true)
   * @param {boolean} options.detectToolCalls - Whether to detect tool calls (default: true)
   * @param {boolean} options.detectCodeBlocks - Whether to detect code blocks (default: true)
   * @param {number} options.bufferFlushInterval - How often to flush buffer in ms (default: 100)
   */
  constructor(options = {}) {
    super();

    // Configuration
    this.options = {
      pauseThreshold: options.pauseThreshold ?? 500,
      stripAnsi: options.stripAnsi ?? true,
      detectToolCalls: options.detectToolCalls ?? true,
      detectCodeBlocks: options.detectCodeBlocks ?? true,
      bufferFlushInterval: options.bufferFlushInterval ?? 100
    };

    // State machine
    this.state = ParserState.IDLE;
    this.previousState = null;

    // Buffers
    this.buffer = '';           // Raw input buffer
    this.lineBuffer = '';       // Current line being processed
    this.contentBuffer = '';    // Accumulated content for current message

    // Code block tracking
    this.codeBlockLanguage = '';
    this.codeBlockContent = '';

    // Tool call tracking
    this.currentToolCall = null;

    // Thinking block tracking
    this.thinkingContent = '';

    // Message tracking
    this.currentMessageId = null;
    this.messageStartTime = null;
    this.lastDataTime = null;

    // Pause detection timer
    this.pauseTimer = null;

    // Buffer flush timer
    this.flushTimer = null;

    // Statistics
    this.stats = {
      bytesProcessed: 0,
      messagesEmitted: 0,
      codeBlocksDetected: 0,
      toolCallsDetected: 0
    };
  }

  /**
   * Feed raw PTY data into the parser
   * This is the main entry point for processing terminal output
   *
   * @param {string|Buffer} data - Raw data from PTY
   */
  write(data) {
    // Convert Buffer to string if needed
    const str = Buffer.isBuffer(data) ? data.toString('utf8') : data;

    // Update timing
    this.lastDataTime = Date.now();
    this.stats.bytesProcessed += str.length;

    // Reset pause timer
    this.resetPauseTimer();

    // Add to buffer
    this.buffer += str;

    // Schedule buffer processing
    this.scheduleFlush();
  }

  /**
   * Schedule buffer flush (debounced processing)
   * @private
   */
  scheduleFlush() {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.processBuffer();
    }, this.options.bufferFlushInterval);
  }

  /**
   * Force immediate buffer flush
   * Useful when you need to ensure all data is processed
   */
  flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.processBuffer();
  }

  /**
   * Process the accumulated buffer
   * Handles line splitting and state transitions
   * @private
   */
  processBuffer() {
    if (!this.buffer) return;

    // Split buffer into lines, keeping partial lines in buffer
    const lines = this.buffer.split(/\r?\n/);

    // Last element might be incomplete line
    this.buffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      this.processLine(line);
    }

    // If buffer has content, it's a partial line - process it
    if (this.buffer) {
      this.processPartialLine(this.buffer);
    }
  }

  /**
   * Process a complete line of output
   * @private
   * @param {string} line - Complete line (without newline)
   */
  processLine(line) {
    // Optionally strip ANSI codes
    const cleanLine = this.options.stripAnsi ? this.stripAnsi(line) : line;

    // Detect state transitions based on line content
    this.detectStateTransition(cleanLine);

    // Process line based on current state
    switch (this.state) {
      case ParserState.IDLE:
        this.handleIdleLine(cleanLine, line);
        break;

      case ParserState.USER_INPUT:
        this.handleUserInputLine(cleanLine, line);
        break;

      case ParserState.ASSISTANT_RESPONSE:
        this.handleAssistantLine(cleanLine, line);
        break;

      case ParserState.CODE_BLOCK:
        this.handleCodeBlockLine(cleanLine, line);
        break;

      case ParserState.TOOL_CALL:
        this.handleToolCallLine(cleanLine, line);
        break;

      case ParserState.THINKING:
        this.handleThinkingLine(cleanLine, line);
        break;

      case ParserState.WAITING:
        this.handleWaitingLine(cleanLine, line);
        break;
    }
  }

  /**
   * Process partial line (line without newline, still being received)
   * @private
   * @param {string} partial - Partial line content
   */
  processPartialLine(partial) {
    const cleanPartial = this.options.stripAnsi ? this.stripAnsi(partial) : partial;

    // Emit streaming chunk if in assistant response state
    if (this.state === ParserState.ASSISTANT_RESPONSE) {
      this.emit('assistantChunk', {
        content: cleanPartial,
        raw: partial,
        partial: true,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Detect if current line triggers a state transition
   * @private
   * @param {string} line - Clean line (ANSI stripped)
   */
  detectStateTransition(line) {
    const trimmedLine = line.trim();

    // Check for code block boundaries
    if (this.options.detectCodeBlocks) {
      const codeStartMatch = trimmedLine.match(CLAUDE_PATTERNS.CODE_BLOCK_START);
      if (codeStartMatch && this.state !== ParserState.CODE_BLOCK) {
        this.transitionTo(ParserState.CODE_BLOCK);
        this.codeBlockLanguage = codeStartMatch[1] || 'text';
        this.codeBlockContent = '';
        return;
      }

      if (CLAUDE_PATTERNS.CODE_BLOCK_END.test(trimmedLine) && this.state === ParserState.CODE_BLOCK) {
        // Emit code block event before transitioning out
        this.emitCodeBlock();
        this.transitionTo(ParserState.ASSISTANT_RESPONSE);
        return;
      }
    }

    // Check for tool call markers
    if (this.options.detectToolCalls && CLAUDE_PATTERNS.TOOL_MARKER.test(line)) {
      const toolMatch = line.match(CLAUDE_PATTERNS.TOOL_CALL);
      if (toolMatch) {
        this.transitionTo(ParserState.TOOL_CALL);
        this.currentToolCall = {
          name: toolMatch[1],
          details: toolMatch[2] || null,
          output: '',
          startTime: Date.now()
        };
        this.emitToolCallStart();
        return;
      }
    }

    // Check for thinking block boundaries
    if (CLAUDE_PATTERNS.THINKING_START.test(line) && this.state !== ParserState.THINKING) {
      this.transitionTo(ParserState.THINKING);
      this.thinkingContent = '';
      return;
    }

    if (CLAUDE_PATTERNS.THINKING_END.test(line) && this.state === ParserState.THINKING) {
      this.emitThinkingBlock();
      this.transitionTo(ParserState.ASSISTANT_RESPONSE);
      return;
    }

    // Check for user prompt (indicates end of assistant response)
    if (CLAUDE_PATTERNS.USER_PROMPT.test(line) && this.state === ParserState.ASSISTANT_RESPONSE) {
      this.endCurrentMessage();
      this.transitionTo(ParserState.IDLE);
      return;
    }

    // If idle and we get non-prompt text, assume assistant is responding
    if (this.state === ParserState.IDLE && trimmedLine && !CLAUDE_PATTERNS.USER_PROMPT.test(line)) {
      this.transitionTo(ParserState.ASSISTANT_RESPONSE);
      this.startNewMessage();
    }
  }

  /**
   * Transition to a new parser state
   * @private
   * @param {string} newState - New state from ParserState enum
   */
  transitionTo(newState) {
    this.previousState = this.state;
    this.state = newState;

    this.emit('stateChange', {
      from: this.previousState,
      to: newState,
      timestamp: Date.now()
    });
  }

  /**
   * Handle line in IDLE state
   * @private
   */
  handleIdleLine(cleanLine, rawLine) {
    // In idle state, we're looking for the start of user input or assistant response
    // User input typically follows a prompt character
    if (CLAUDE_PATTERNS.USER_PROMPT.test(cleanLine)) {
      // This is a prompt line, may be followed by user input
      this.emit('prompt', {
        content: cleanLine,
        raw: rawLine,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle line during user input
   * @private
   */
  handleUserInputLine(cleanLine, rawLine) {
    this.emit('userInput', {
      content: cleanLine,
      raw: rawLine,
      timestamp: Date.now()
    });
  }

  /**
   * Handle line during assistant response
   * @private
   */
  handleAssistantLine(cleanLine, rawLine) {
    // Accumulate content
    this.contentBuffer += cleanLine + '\n';

    // Emit streaming chunk
    this.emit('assistantChunk', {
      content: cleanLine,
      raw: rawLine,
      partial: false,
      timestamp: Date.now()
    });
  }

  /**
   * Handle line inside a code block
   * @private
   */
  handleCodeBlockLine(cleanLine, rawLine) {
    // Don't include the closing ``` in the code content
    if (!CLAUDE_PATTERNS.CODE_BLOCK_END.test(cleanLine.trim())) {
      this.codeBlockContent += cleanLine + '\n';
    }
  }

  /**
   * Handle line during tool call
   * @private
   */
  handleToolCallLine(cleanLine, rawLine) {
    if (this.currentToolCall) {
      // Check if this is a new tool marker (tool call ended)
      if (CLAUDE_PATTERNS.TOOL_MARKER.test(cleanLine)) {
        this.emitToolCallEnd();

        // Check if new tool call is starting
        const toolMatch = cleanLine.match(CLAUDE_PATTERNS.TOOL_CALL);
        if (toolMatch) {
          this.currentToolCall = {
            name: toolMatch[1],
            details: toolMatch[2] || null,
            output: '',
            startTime: Date.now()
          };
          this.emitToolCallStart();
        } else {
          this.transitionTo(ParserState.ASSISTANT_RESPONSE);
        }
      } else {
        // Accumulate tool output
        this.currentToolCall.output += cleanLine + '\n';
      }
    }
  }

  /**
   * Handle line inside thinking block
   * @private
   */
  handleThinkingLine(cleanLine, rawLine) {
    // Don't include the closing tag in content
    if (!CLAUDE_PATTERNS.THINKING_END.test(cleanLine)) {
      this.thinkingContent += cleanLine + '\n';
    }
  }

  /**
   * Handle line while waiting for response
   * @private
   */
  handleWaitingLine(cleanLine, rawLine) {
    // Check for status updates
    if (CLAUDE_PATTERNS.STATUS_WORKING.test(cleanLine)) {
      this.emit('status', {
        type: 'working',
        content: cleanLine,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start a new message
   * @private
   */
  startNewMessage() {
    this.currentMessageId = this.generateMessageId();
    this.messageStartTime = Date.now();
    this.contentBuffer = '';

    this.emit('messageStart', {
      messageId: this.currentMessageId,
      timestamp: this.messageStartTime
    });
  }

  /**
   * End the current message
   * @private
   */
  endCurrentMessage() {
    if (!this.currentMessageId) return;

    const content = this.contentBuffer.trim();
    if (content) {
      this.emit('messageEnd', {
        messageId: this.currentMessageId,
        content: content,
        duration: Date.now() - this.messageStartTime,
        timestamp: Date.now()
      });

      this.stats.messagesEmitted++;
    }

    this.currentMessageId = null;
    this.contentBuffer = '';
  }

  /**
   * Emit a code block event
   * @private
   */
  emitCodeBlock() {
    const content = this.codeBlockContent.replace(/\n$/, ''); // Remove trailing newline

    this.emit('codeBlock', {
      language: this.codeBlockLanguage,
      code: content,
      timestamp: Date.now()
    });

    // Also add to content buffer for the complete message
    this.contentBuffer += '```' + this.codeBlockLanguage + '\n' + content + '\n```\n';

    this.codeBlockLanguage = '';
    this.codeBlockContent = '';
    this.stats.codeBlocksDetected++;
  }

  /**
   * Emit tool call start event
   * @private
   */
  emitToolCallStart() {
    if (!this.currentToolCall) return;

    this.emit('toolCall', {
      type: 'start',
      name: this.currentToolCall.name,
      details: this.currentToolCall.details,
      timestamp: Date.now()
    });
  }

  /**
   * Emit tool call end event
   * @private
   */
  emitToolCallEnd() {
    if (!this.currentToolCall) return;

    this.emit('toolCall', {
      type: 'end',
      name: this.currentToolCall.name,
      details: this.currentToolCall.details,
      output: this.currentToolCall.output.trim(),
      duration: Date.now() - this.currentToolCall.startTime,
      timestamp: Date.now()
    });

    this.currentToolCall = null;
    this.stats.toolCallsDetected++;
  }

  /**
   * Emit thinking block event
   * @private
   */
  emitThinkingBlock() {
    const content = this.thinkingContent.trim();
    if (content) {
      this.emit('thinking', {
        content: content,
        timestamp: Date.now()
      });
    }
    this.thinkingContent = '';
  }

  /**
   * Reset the pause detection timer
   * @private
   */
  resetPauseTimer() {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
    }

    this.pauseTimer = setTimeout(() => {
      this.handlePause();
    }, this.options.pauseThreshold);
  }

  /**
   * Handle detected pause (silence in output)
   * @private
   */
  handlePause() {
    this.pauseTimer = null;

    // If we were receiving assistant response, the pause might indicate message end
    if (this.state === ParserState.ASSISTANT_RESPONSE && this.contentBuffer.trim()) {
      this.emit('pause', {
        state: this.state,
        contentLength: this.contentBuffer.length,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Strip ANSI escape codes from text
   * @param {string} text - Text with ANSI codes
   * @returns {string} Clean text without ANSI codes
   */
  stripAnsi(text) {
    return text.replace(ANSI_PATTERNS.ALL, '');
  }

  /**
   * Parse ANSI codes and extract style information
   * Useful for preserving formatting while removing escape sequences
   *
   * @param {string} text - Text with ANSI codes
   * @returns {Array<{text: string, style: Object}>} Parsed segments with styles
   */
  parseAnsiStyles(text) {
    const segments = [];
    let currentStyle = {};
    let lastIndex = 0;

    // Match SGR (style) sequences
    const regex = /\x1b\[([0-9;]*)m/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before this escape sequence
      if (match.index > lastIndex) {
        segments.push({
          text: text.slice(lastIndex, match.index),
          style: { ...currentStyle }
        });
      }

      // Parse the style codes
      const codes = match[1].split(';').map(c => parseInt(c, 10) || 0);
      currentStyle = this.parseStyleCodes(codes, currentStyle);

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.slice(lastIndex),
        style: { ...currentStyle }
      });
    }

    return segments;
  }

  /**
   * Parse ANSI SGR codes into style object
   * @private
   * @param {number[]} codes - Array of SGR codes
   * @param {Object} currentStyle - Current style state
   * @returns {Object} Updated style object
   */
  parseStyleCodes(codes, currentStyle) {
    const style = { ...currentStyle };

    for (const code of codes) {
      switch (code) {
        case 0: // Reset
          return {};
        case 1:
          style.bold = true;
          break;
        case 2:
          style.dim = true;
          break;
        case 3:
          style.italic = true;
          break;
        case 4:
          style.underline = true;
          break;
        case 7:
          style.inverse = true;
          break;
        case 9:
          style.strikethrough = true;
          break;
        case 22:
          style.bold = false;
          style.dim = false;
          break;
        case 23:
          style.italic = false;
          break;
        case 24:
          style.underline = false;
          break;
        case 27:
          style.inverse = false;
          break;
        case 29:
          style.strikethrough = false;
          break;
        case 30: case 31: case 32: case 33:
        case 34: case 35: case 36: case 37:
          style.foreground = code - 30;
          break;
        case 39:
          delete style.foreground;
          break;
        case 40: case 41: case 42: case 43:
        case 44: case 45: case 46: case 47:
          style.background = code - 40;
          break;
        case 49:
          delete style.background;
          break;
        case 90: case 91: case 92: case 93:
        case 94: case 95: case 96: case 97:
          style.foreground = code - 90 + 8; // Bright colors
          break;
        case 100: case 101: case 102: case 103:
        case 104: case 105: case 106: case 107:
          style.background = code - 100 + 8; // Bright colors
          break;
      }
    }

    return style;
  }

  /**
   * Generate a unique message ID
   * @private
   * @returns {string} Unique message identifier
   */
  generateMessageId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Get current parser state
   * @returns {Object} Current state information
   */
  getState() {
    return {
      state: this.state,
      previousState: this.previousState,
      currentMessageId: this.currentMessageId,
      contentBufferLength: this.contentBuffer.length,
      isInCodeBlock: this.state === ParserState.CODE_BLOCK,
      isInToolCall: this.state === ParserState.TOOL_CALL,
      currentToolCall: this.currentToolCall ? {
        name: this.currentToolCall.name,
        details: this.currentToolCall.details
      } : null,
      stats: { ...this.stats }
    };
  }

  /**
   * Reset parser to initial state
   * Clears all buffers and resets state machine
   */
  reset() {
    // Clear timers
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Reset state
    this.state = ParserState.IDLE;
    this.previousState = null;

    // Clear buffers
    this.buffer = '';
    this.lineBuffer = '';
    this.contentBuffer = '';

    // Reset code block state
    this.codeBlockLanguage = '';
    this.codeBlockContent = '';

    // Reset tool call state
    this.currentToolCall = null;

    // Reset thinking state
    this.thinkingContent = '';

    // Reset message tracking
    this.currentMessageId = null;
    this.messageStartTime = null;
    this.lastDataTime = null;

    this.emit('reset', { timestamp: Date.now() });
  }

  /**
   * Destroy the parser and clean up resources
   */
  destroy() {
    this.reset();
    this.removeAllListeners();
  }
}

/**
 * Factory function to create a pre-configured parser for Claude Code
 * @param {Object} options - Configuration options
 * @returns {ClaudeOutputParser} Configured parser instance
 */
function createClaudeParser(options = {}) {
  return new ClaudeOutputParser({
    pauseThreshold: 500,
    stripAnsi: true,
    detectToolCalls: true,
    detectCodeBlocks: true,
    bufferFlushInterval: 100,
    ...options
  });
}

// Export the class and factory
module.exports = {
  ClaudeOutputParser,
  createClaudeParser,
  ParserState,
  ContentType,
  ANSI_PATTERNS,
  CLAUDE_PATTERNS
};
