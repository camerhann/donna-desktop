/**
 * Jest Test Setup for Donna Desktop
 *
 * This file runs before each test suite to set up mocks and utilities
 * needed for testing Electron main process code.
 */

// ============================================================================
// Electron API Mocks
// ============================================================================

/**
 * Mock BrowserWindow class
 * Simulates Electron's BrowserWindow for testing window management
 */
class MockBrowserWindow {
  constructor(options = {}) {
    this.options = options;
    this.webContents = {
      send: jest.fn(),
      openDevTools: jest.fn(),
      on: jest.fn(),
      once: jest.fn()
    };
    this._isDestroyed = false;
  }

  loadFile(filePath) {
    this._loadedFile = filePath;
    return Promise.resolve();
  }

  loadURL(url) {
    this._loadedURL = url;
    return Promise.resolve();
  }

  isDestroyed() {
    return this._isDestroyed;
  }

  destroy() {
    this._isDestroyed = true;
  }

  close() {
    this._isDestroyed = true;
  }

  show() {}
  hide() {}
  minimize() {}
  maximize() {}
  restore() {}
  focus() {}

  static getAllWindows() {
    return [];
  }
}

/**
 * Mock ipcMain for testing IPC handlers
 */
const mockIpcMain = {
  _handlers: new Map(),
  _listeners: new Map(),

  handle(channel, handler) {
    this._handlers.set(channel, handler);
  },

  handleOnce(channel, handler) {
    this._handlers.set(channel, handler);
  },

  removeHandler(channel) {
    this._handlers.delete(channel);
  },

  on(channel, listener) {
    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, []);
    }
    this._listeners.get(channel).push(listener);
  },

  once(channel, listener) {
    this.on(channel, listener);
  },

  removeListener(channel, listener) {
    const listeners = this._listeners.get(channel) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  },

  removeAllListeners(channel) {
    if (channel) {
      this._listeners.delete(channel);
    } else {
      this._listeners.clear();
    }
  },

  // Test helper to invoke a handler
  async invoke(channel, event, ...args) {
    const handler = this._handlers.get(channel);
    if (handler) {
      return await handler(event, ...args);
    }
    throw new Error(`No handler registered for channel: ${channel}`);
  },

  // Test helper to emit to listeners
  emit(channel, event, ...args) {
    const listeners = this._listeners.get(channel) || [];
    listeners.forEach(listener => listener(event, ...args));
  },

  // Reset all handlers and listeners
  reset() {
    this._handlers.clear();
    this._listeners.clear();
  }
};

/**
 * Mock ipcRenderer for testing renderer process code
 */
const mockIpcRenderer = {
  _listeners: new Map(),
  _invokeResults: new Map(),

  invoke: jest.fn(async (channel, ...args) => {
    const result = mockIpcRenderer._invokeResults.get(channel);
    if (typeof result === 'function') {
      return result(...args);
    }
    return result;
  }),

  send: jest.fn(),
  sendSync: jest.fn(),

  on(channel, listener) {
    if (!this._listeners.has(channel)) {
      this._listeners.set(channel, []);
    }
    this._listeners.get(channel).push(listener);
    return this;
  },

  once(channel, listener) {
    this.on(channel, listener);
    return this;
  },

  removeListener(channel, listener) {
    const listeners = this._listeners.get(channel) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    return this;
  },

  removeAllListeners(channel) {
    if (channel) {
      this._listeners.delete(channel);
    } else {
      this._listeners.clear();
    }
    return this;
  },

  // Test helper to simulate receiving a message
  emit(channel, event, ...args) {
    const listeners = this._listeners.get(channel) || [];
    listeners.forEach(listener => listener(event, ...args));
  },

  // Test helper to set invoke results
  setInvokeResult(channel, result) {
    this._invokeResults.set(channel, result);
  },

  // Reset all state
  reset() {
    this._listeners.clear();
    this._invokeResults.clear();
    this.invoke.mockClear();
    this.send.mockClear();
    this.sendSync.mockClear();
  }
};

/**
 * Mock app object
 */
const mockApp = {
  whenReady: jest.fn(() => Promise.resolve()),
  on: jest.fn(),
  quit: jest.fn(),
  getPath: jest.fn((name) => {
    const paths = {
      home: '/mock/home',
      userData: '/mock/userData',
      temp: '/mock/temp',
      desktop: '/mock/desktop',
      documents: '/mock/documents'
    };
    return paths[name] || `/mock/${name}`;
  }),
  getName: jest.fn(() => 'donna-desktop-test'),
  getVersion: jest.fn(() => '0.1.0-test')
};

/**
 * Mock shell object
 */
const mockShell = {
  openPath: jest.fn(() => Promise.resolve('')),
  openExternal: jest.fn(() => Promise.resolve()),
  showItemInFolder: jest.fn()
};

// ============================================================================
// node-pty Mock
// ============================================================================

/**
 * Mock PTY process for testing terminal functionality
 */
class MockPtyProcess {
  constructor(file, args, options) {
    this.file = file;
    this.args = args;
    this.options = options;
    this.pid = Math.floor(Math.random() * 10000) + 1000;
    this._onDataCallbacks = [];
    this._onExitCallbacks = [];
    this._killed = false;
  }

  onData(callback) {
    this._onDataCallbacks.push(callback);
  }

  onExit(callback) {
    this._onExitCallbacks.push(callback);
  }

  write(data) {
    if (this._killed) {
      throw new Error('Cannot write to killed process');
    }
    // Echo back for testing
    this._emitData(data);
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
  }

  kill(signal) {
    if (!this._killed) {
      this._killed = true;
      this._onExitCallbacks.forEach(cb => cb({ exitCode: signal === 'SIGKILL' ? 137 : 0 }));
    }
  }

  // Test helper to simulate data output
  _emitData(data) {
    this._onDataCallbacks.forEach(cb => cb(data));
  }

  // Test helper to simulate process exit
  _emitExit(exitCode = 0) {
    this._killed = true;
    this._onExitCallbacks.forEach(cb => cb({ exitCode }));
  }
}

const mockPty = {
  spawn: jest.fn((file, args, options) => new MockPtyProcess(file, args, options))
};

// ============================================================================
// Global Mocks Setup
// ============================================================================

// Make mocks available globally for tests
global.mockElectron = {
  app: mockApp,
  BrowserWindow: MockBrowserWindow,
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer,
  shell: mockShell
};

global.mockPty = mockPty;
global.MockPtyProcess = MockPtyProcess;

// ============================================================================
// Jest Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  mockIpcMain.reset();
  mockIpcRenderer.reset();
});

afterEach(() => {
  // Clean up any timers
  jest.useRealTimers();
});

// ============================================================================
// Custom Matchers
// ============================================================================

expect.extend({
  /**
   * Check if a path is safe (no traversal, absolute, within allowed directories)
   */
  toBeASecurePath(received, allowedPaths = []) {
    const path = require('path');
    const resolved = path.resolve(received);

    // Check for path traversal patterns
    if (received.includes('..')) {
      return {
        message: () => `Expected path "${received}" to not contain path traversal patterns`,
        pass: false
      };
    }

    // If allowed paths specified, check containment
    if (allowedPaths.length > 0) {
      const isAllowed = allowedPaths.some(allowed => resolved.startsWith(path.resolve(allowed)));
      if (!isAllowed) {
        return {
          message: () => `Expected path "${resolved}" to be within allowed paths: ${allowedPaths.join(', ')}`,
          pass: false
        };
      }
    }

    return {
      message: () => `Expected path "${received}" to be insecure`,
      pass: true
    };
  },

  /**
   * Check if a value matches expected IPC response format
   */
  toBeValidIpcResponse(received) {
    const hasSuccess = typeof received === 'object' && 'success' in received;
    const hasErrorIfFailed = received.success === false ? 'error' in received : true;

    if (!hasSuccess) {
      return {
        message: () => `Expected IPC response to have "success" property, got: ${JSON.stringify(received)}`,
        pass: false
      };
    }

    if (!hasErrorIfFailed) {
      return {
        message: () => `Expected failed IPC response to have "error" property, got: ${JSON.stringify(received)}`,
        pass: false
      };
    }

    return {
      message: () => `Expected value to not be a valid IPC response`,
      pass: true
    };
  }
});

// ============================================================================
// Console Suppression (optional, comment out for debugging)
// ============================================================================

// Suppress console.error and console.warn in tests to reduce noise
// Comment these out when debugging test failures
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
