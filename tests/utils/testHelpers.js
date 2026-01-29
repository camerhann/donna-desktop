/**
 * Test Helpers for Donna Desktop
 *
 * Utility functions for creating mock IPC events, testing async handlers,
 * and testing streaming responses.
 */

const EventEmitter = require('events');

// ============================================================================
// IPC Event Helpers
// ============================================================================

/**
 * Creates a mock IPC event object
 * @param {Object} options - Options for the event
 * @param {number} options.frameId - Frame ID for the event
 * @param {Object} options.sender - Mock webContents sender
 * @returns {Object} Mock IPC event
 */
function createMockIpcEvent(options = {}) {
  return {
    frameId: options.frameId || 1,
    sender: options.sender || {
      id: 1,
      send: jest.fn(),
      sendSync: jest.fn(),
      isDestroyed: jest.fn(() => false),
      getURL: jest.fn(() => 'file:///mock/index.html'),
      getTitle: jest.fn(() => 'Donna Desktop')
    },
    reply: jest.fn(),
    returnValue: undefined
  };
}

/**
 * Creates a mock webContents object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock webContents
 */
function createMockWebContents(overrides = {}) {
  return {
    id: 1,
    send: jest.fn(),
    sendSync: jest.fn(),
    isDestroyed: jest.fn(() => false),
    getURL: jest.fn(() => 'file:///mock/index.html'),
    getTitle: jest.fn(() => 'Donna Desktop'),
    openDevTools: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    ...overrides
  };
}

// ============================================================================
// Async Handler Testing
// ============================================================================

/**
 * Tests an async IPC handler
 * @param {Function} handler - The IPC handler function
 * @param {Object} params - Parameters to pass to the handler
 * @param {Object} event - Optional custom event object
 * @returns {Promise<Object>} The handler result
 */
async function testAsyncHandler(handler, params, event = null) {
  const mockEvent = event || createMockIpcEvent();
  return await handler(mockEvent, params);
}

/**
 * Tests that an async handler rejects with expected error
 * @param {Function} handler - The IPC handler function
 * @param {Object} params - Parameters to pass to the handler
 * @param {string|RegExp} expectedError - Expected error message or pattern
 */
async function expectAsyncHandlerToFail(handler, params, expectedError) {
  const mockEvent = createMockIpcEvent();
  const result = await handler(mockEvent, params);

  expect(result.success).toBe(false);
  if (expectedError instanceof RegExp) {
    expect(result.error).toMatch(expectedError);
  } else {
    expect(result.error).toContain(expectedError);
  }
}

/**
 * Tests that an async handler succeeds
 * @param {Function} handler - The IPC handler function
 * @param {Object} params - Parameters to pass to the handler
 * @returns {Promise<Object>} The result data (excluding success flag)
 */
async function expectAsyncHandlerToSucceed(handler, params) {
  const mockEvent = createMockIpcEvent();
  const result = await handler(mockEvent, params);

  expect(result.success).toBe(true);
  expect(result.error).toBeUndefined();

  const { success, ...data } = result;
  return data;
}

// ============================================================================
// Streaming Response Testing
// ============================================================================

/**
 * Mock stream collector for testing streaming responses
 * Collects all chunks emitted during a stream operation
 */
class StreamCollector extends EventEmitter {
  constructor() {
    super();
    this.chunks = [];
    this.errors = [];
    this.completed = false;
    this._promise = null;
  }

  /**
   * Collects a chunk
   * @param {any} chunk - The chunk data
   */
  collect(chunk) {
    this.chunks.push(chunk);
    this.emit('chunk', chunk);
  }

  /**
   * Marks stream as completed
   */
  complete() {
    this.completed = true;
    this.emit('complete');
  }

  /**
   * Records an error
   * @param {Error|string} error - The error
   */
  error(error) {
    this.errors.push(error);
    this.emit('error', error);
  }

  /**
   * Waits for stream completion
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  waitForCompletion(timeout = 5000) {
    if (this._promise) return this._promise;

    this._promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Stream did not complete within ${timeout}ms`));
      }, timeout);

      this.once('complete', () => {
        clearTimeout(timer);
        resolve();
      });

      this.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    return this._promise;
  }

  /**
   * Gets the concatenated content from all chunks
   * @returns {string}
   */
  getContent() {
    return this.chunks
      .filter(c => c && c.content)
      .map(c => c.content)
      .join('');
  }

  /**
   * Resets the collector
   */
  reset() {
    this.chunks = [];
    this.errors = [];
    this.completed = false;
    this._promise = null;
    this.removeAllListeners();
  }
}

/**
 * Creates a mock streaming IPC setup
 * @param {Object} mainWindow - Mock main window
 * @returns {Object} Stream testing utilities
 */
function createStreamTestSetup(mainWindow = null) {
  const collector = new StreamCollector();
  const mockWindow = mainWindow || {
    webContents: {
      send: jest.fn((channel, data) => {
        if (channel.includes('Chunk')) {
          collector.collect(data);
        } else if (channel.includes('End') || channel.includes('Complete')) {
          collector.complete();
        } else if (channel.includes('Error')) {
          collector.error(data.error || data);
        }
      }),
      isDestroyed: jest.fn(() => false)
    },
    isDestroyed: jest.fn(() => false)
  };

  return {
    collector,
    mainWindow: mockWindow,
    getSentChunks: () => mockWindow.webContents.send.mock.calls
      .filter(([channel]) => channel.includes('Chunk'))
      .map(([, data]) => data),
    reset: () => {
      collector.reset();
      mockWindow.webContents.send.mockClear();
    }
  };
}

/**
 * Tests an async generator (streaming function)
 * @param {AsyncGenerator} generator - The async generator to test
 * @param {Object} options - Test options
 * @returns {Promise<Array>} All yielded values
 */
async function collectAsyncGenerator(generator, options = {}) {
  const { timeout = 5000, maxChunks = 1000 } = options;
  const chunks = [];
  const startTime = Date.now();

  for await (const chunk of generator) {
    chunks.push(chunk);

    if (chunks.length >= maxChunks) {
      throw new Error(`Generator exceeded max chunks (${maxChunks})`);
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(`Generator timed out after ${timeout}ms`);
    }
  }

  return chunks;
}

// ============================================================================
// File System Test Helpers
// ============================================================================

/**
 * Creates a mock file system for testing
 * @param {Object} structure - File structure as nested object
 * @returns {Object} Mock fs module methods
 */
function createMockFileSystem(structure = {}) {
  const files = new Map();
  const directories = new Set(['/']);

  // Helper to normalize paths
  const normalizePath = (p) => {
    const path = require('path');
    return path.resolve(p);
  };

  // Build initial structure
  const buildStructure = (obj, basePath = '/') => {
    for (const [name, content] of Object.entries(obj)) {
      const fullPath = require('path').join(basePath, name);
      if (typeof content === 'object' && content !== null && !Buffer.isBuffer(content)) {
        directories.add(normalizePath(fullPath));
        buildStructure(content, fullPath);
      } else {
        files.set(normalizePath(fullPath), content);
        // Ensure parent directories exist
        let dir = require('path').dirname(fullPath);
        while (dir !== '/' && dir !== '.') {
          directories.add(normalizePath(dir));
          dir = require('path').dirname(dir);
        }
      }
    }
  };

  buildStructure(structure);

  return {
    existsSync: jest.fn((p) => {
      const np = normalizePath(p);
      return files.has(np) || directories.has(np);
    }),

    readFileSync: jest.fn((p, options) => {
      const np = normalizePath(p);
      if (!files.has(np)) {
        const error = new Error(`ENOENT: no such file or directory, open '${p}'`);
        error.code = 'ENOENT';
        throw error;
      }
      const content = files.get(np);
      if (options === 'utf-8' || options?.encoding === 'utf-8') {
        return typeof content === 'string' ? content : content.toString();
      }
      return content;
    }),

    writeFileSync: jest.fn((p, content) => {
      const np = normalizePath(p);
      files.set(np, content);
    }),

    mkdirSync: jest.fn((p, options) => {
      const np = normalizePath(p);
      if (options?.recursive) {
        let dir = np;
        while (dir !== '/' && dir !== '.') {
          directories.add(dir);
          dir = require('path').dirname(dir);
        }
      } else {
        directories.add(np);
      }
    }),

    statSync: jest.fn((p) => {
      const np = normalizePath(p);
      if (directories.has(np)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false
        };
      }
      if (files.has(np)) {
        return {
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false
        };
      }
      const error = new Error(`ENOENT: no such file or directory, stat '${p}'`);
      error.code = 'ENOENT';
      throw error;
    }),

    lstatSync: jest.fn((p) => {
      // Same as statSync for basic mock
      const np = normalizePath(p);
      if (directories.has(np)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false
        };
      }
      if (files.has(np)) {
        return {
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false
        };
      }
      const error = new Error(`ENOENT: no such file or directory, lstat '${p}'`);
      error.code = 'ENOENT';
      throw error;
    }),

    realpathSync: jest.fn((p) => normalizePath(p)),

    readdirSync: jest.fn((p) => {
      const np = normalizePath(p);
      if (!directories.has(np)) {
        const error = new Error(`ENOENT: no such file or directory, scandir '${p}'`);
        error.code = 'ENOENT';
        throw error;
      }
      const results = [];
      const prefix = np.endsWith('/') ? np : np + '/';

      for (const dir of directories) {
        if (dir.startsWith(prefix) && dir !== np) {
          const relative = dir.slice(prefix.length);
          const firstPart = relative.split('/')[0];
          if (firstPart && !results.includes(firstPart)) {
            results.push(firstPart);
          }
        }
      }

      for (const file of files.keys()) {
        if (file.startsWith(prefix)) {
          const relative = file.slice(prefix.length);
          const firstPart = relative.split('/')[0];
          if (firstPart && !results.includes(firstPart)) {
            results.push(firstPart);
          }
        }
      }

      return results;
    }),

    // Test helpers
    _files: files,
    _directories: directories,
    _addFile: (p, content) => files.set(normalizePath(p), content),
    _addDirectory: (p) => directories.add(normalizePath(p)),
    _clear: () => {
      files.clear();
      directories.clear();
      directories.add('/');
    }
  };
}

// ============================================================================
// Timing Helpers
// ============================================================================

/**
 * Waits for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {Object} options - Options
 * @returns {Promise<void>}
 */
async function waitFor(condition, options = {}) {
  const { timeout = 5000, interval = 50, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Advances Jest fake timers and flushes promises
 * @param {number} ms - Milliseconds to advance
 */
async function advanceTimersAndFlush(ms) {
  jest.advanceTimersByTime(ms);
  // Flush pending promises
  await Promise.resolve();
  await Promise.resolve();
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // IPC helpers
  createMockIpcEvent,
  createMockWebContents,

  // Async handler testing
  testAsyncHandler,
  expectAsyncHandlerToFail,
  expectAsyncHandlerToSucceed,

  // Streaming testing
  StreamCollector,
  createStreamTestSetup,
  collectAsyncGenerator,

  // File system helpers
  createMockFileSystem,

  // Timing helpers
  waitFor,
  advanceTimersAndFlush
};
