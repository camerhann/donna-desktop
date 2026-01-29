/**
 * StreamManager - Centralized stream management utility
 *
 * Standardizes the streaming pattern used across the application for:
 * - Model streaming (models:streamStart)
 * - Orchestrator task streaming (orchestrator:streamTask)
 * - Chat message streaming (chat:streamMessage)
 *
 * Features:
 * - Stream lifecycle management with auto-cleanup
 * - Abort support with AbortController
 * - Timeout handling (5 minute default)
 * - Helper for running async generators with abort support
 */

const { randomBytes } = require('crypto');

class StreamManager {
  constructor() {
    this.streams = new Map();
    this.STREAM_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate a unique stream ID
   * Uses timestamp + random bytes for collision resistance
   * @returns {string} Unique stream identifier
   */
  generateStreamId() {
    return Date.now().toString(36) + randomBytes(4).toString('hex');
  }

  /**
   * Create a new managed stream
   * @param {Object} options - Additional stream options to store
   * @returns {Object} Stream object with id, abortController, etc.
   */
  createStream(options = {}) {
    const streamId = this.generateStreamId();
    const stream = {
      id: streamId,
      createdAt: Date.now(),
      aborted: false,
      abortController: new AbortController(),
      timeout: setTimeout(() => this.cleanup(streamId), this.STREAM_TIMEOUT),
      ...options
    };
    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Get a stream by ID
   * @param {string} streamId - The stream identifier
   * @returns {Object|undefined} Stream object or undefined if not found
   */
  getStream(streamId) {
    return this.streams.get(streamId);
  }

  /**
   * Abort a stream and trigger cleanup
   * @param {string} streamId - The stream identifier
   */
  abort(streamId) {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.aborted = true;
      stream.abortController.abort();
      this.cleanup(streamId);
    }
  }

  /**
   * Clean up a stream (remove from tracking, clear timeout)
   * @param {string} streamId - The stream identifier
   */
  cleanup(streamId) {
    const stream = this.streams.get(streamId);
    if (stream) {
      clearTimeout(stream.timeout);
      this.streams.delete(streamId);
    }
  }

  /**
   * Clean up all active streams
   * Useful for graceful shutdown
   */
  cleanupAll() {
    for (const [streamId, stream] of this.streams) {
      stream.aborted = true;
      stream.abortController.abort();
      clearTimeout(stream.timeout);
    }
    this.streams.clear();
  }

  /**
   * Check if a stream has been aborted
   * @param {string} streamId - The stream identifier
   * @returns {boolean} True if aborted or not found
   */
  isAborted(streamId) {
    const stream = this.streams.get(streamId);
    return stream ? stream.aborted : true;
  }

  /**
   * Get the number of active streams
   * @returns {number} Count of active streams
   */
  get activeCount() {
    return this.streams.size;
  }

  /**
   * Helper for running async generators with abort support
   * Handles the common pattern of iterating a generator and sending chunks
   *
   * @param {string} streamId - The stream identifier
   * @param {AsyncGenerator} generator - The async generator to iterate
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onChunk - Called for each chunk
   * @param {Function} callbacks.onComplete - Called when stream completes
   * @param {Function} callbacks.onError - Called on error
   */
  async runStream(streamId, generator, { onChunk, onComplete, onError }) {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    try {
      for await (const chunk of generator) {
        if (this.isAborted(streamId)) break;
        await onChunk(chunk);
      }
      if (!this.isAborted(streamId)) {
        await onComplete();
      }
    } catch (error) {
      if (!this.isAborted(streamId)) {
        await onError(error);
      }
    } finally {
      this.cleanup(streamId);
    }
  }

  /**
   * Wrap an existing stream ID for tracking
   * Useful when stream ID is provided externally (e.g., from renderer)
   *
   * @param {string} streamId - Externally provided stream ID
   * @param {Object} options - Additional stream options
   * @returns {Object} Stream object
   */
  trackStream(streamId, options = {}) {
    if (this.streams.has(streamId)) {
      return this.streams.get(streamId);
    }

    const stream = {
      id: streamId,
      createdAt: Date.now(),
      aborted: false,
      abortController: new AbortController(),
      timeout: setTimeout(() => this.cleanup(streamId), this.STREAM_TIMEOUT),
      ...options
    };
    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Extend the timeout for a stream
   * Useful for long-running streams
   *
   * @param {string} streamId - The stream identifier
   * @param {number} additionalMs - Additional milliseconds to add
   */
  extendTimeout(streamId, additionalMs = this.STREAM_TIMEOUT) {
    const stream = this.streams.get(streamId);
    if (stream) {
      clearTimeout(stream.timeout);
      stream.timeout = setTimeout(() => this.cleanup(streamId), additionalMs);
    }
  }
}

// Export singleton instance
module.exports = new StreamManager();
