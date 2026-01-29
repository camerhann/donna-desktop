# Testing Guide

This document describes testing practices and infrastructure for Donna Desktop.

## Setup

### Install Dependencies

```bash
npm install --save-dev jest @types/jest
```

### Configure Jest

Add to `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Test Structure

```
tests/
├── setup.js              # Test configuration and mocks
├── helpers/              # Test utilities
│   ├── mockIpc.js        # IPC mocking utilities
│   └── fixtures.js       # Test data fixtures
├── main/                 # Main process tests
│   ├── security/         # Security utility tests
│   │   ├── fileSandbox.test.js
│   │   └── urlValidator.test.js
│   ├── ipc/              # IPC handler tests
│   │   ├── terminal.test.js
│   │   └── chat.test.js
│   └── utils/            # Utility tests
│       └── streamManager.test.js
└── integration/          # Integration tests (future)
```

## Writing Tests

### Unit Test Example: FileSandbox

```javascript
// tests/main/security/fileSandbox.test.js

const { FileSandbox } = require('../../../src/main/security');

describe('FileSandbox', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = new FileSandbox(['/allowed/path']);
  });

  test('allows paths within sandbox', () => {
    expect(sandbox.isPathAllowed('/allowed/path/file.txt')).toBe(true);
  });

  test('blocks path traversal', () => {
    expect(sandbox.isPathAllowed('/allowed/path/../etc/passwd')).toBe(false);
  });

  test('blocks paths outside sandbox', () => {
    expect(sandbox.isPathAllowed('/etc/passwd')).toBe(false);
  });

  test('validateAccess throws on violation', () => {
    expect(() => sandbox.validateAccess('/etc/passwd', 'read')).toThrow();
  });
});
```

### Unit Test Example: URL Validator

```javascript
// tests/main/security/urlValidator.test.js

const { validateUrl, isPrivateIP } = require('../../../src/main/security');

describe('isPrivateIP', () => {
  test('identifies private IPv4 addresses', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('127.0.0.1')).toBe(true);
  });

  test('identifies public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });
});

describe('validateUrl', () => {
  test('allows valid public URLs', async () => {
    const result = await validateUrl('https://example.com');
    expect(result.valid).toBe(true);
  });

  test('blocks private IPs', async () => {
    const result = await validateUrl('http://192.168.1.1/admin');
    expect(result.valid).toBe(false);
  });

  test('blocks non-http protocols', async () => {
    const result = await validateUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
  });
});
```

### Unit Test Example: StreamManager

```javascript
// tests/main/utils/streamManager.test.js

const streamManager = require('../../../src/main/utils/streamManager');

describe('StreamManager', () => {
  afterEach(() => {
    streamManager.cleanupAll();
  });

  test('creates stream with unique ID', () => {
    const stream1 = streamManager.createStream();
    const stream2 = streamManager.createStream();

    expect(stream1.id).not.toBe(stream2.id);
  });

  test('tracks stream lifecycle', () => {
    const stream = streamManager.createStream();

    expect(streamManager.getStream(stream.id)).toBeDefined();
    expect(streamManager.isAborted(stream.id)).toBe(false);

    streamManager.abort(stream.id);

    expect(streamManager.isAborted(stream.id)).toBe(true);
  });

  test('auto-cleans after timeout', () => {
    jest.useFakeTimers();

    const stream = streamManager.createStream();
    const streamId = stream.id;

    jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes

    expect(streamManager.getStream(streamId)).toBeUndefined();

    jest.useRealTimers();
  });
});
```

## Test Coverage

### Target Coverage
- **New code**: 80% minimum
- **Security utilities**: 95%
- **IPC handlers**: 80%

### Running Coverage

```bash
npm run test:coverage
```

## Mocking Guidelines

### Mock Electron
```javascript
jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn(() => '/tmp') }
}));
```

### Mock File System
```javascript
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  realpathSync: jest.fn(p => p),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));
```

## Priority Test Areas

Based on quality findings, prioritize tests for:

1. **Security Validation** (Critical)
   - FileSandbox path validation
   - URL validator SSRF prevention
   - Terminal ID validation

2. **Stream Management** (High)
   - StreamManager lifecycle
   - Abort handling
   - Timeout cleanup

3. **IPC Handlers** (Medium)
   - Terminal operations
   - Chat operations

## Test Writing Checklist

Before submitting tests:

- [ ] Tests are isolated (no shared state)
- [ ] Mocks are properly reset between tests
- [ ] Edge cases are covered
- [ ] Security-sensitive paths have dedicated tests
- [ ] Tests run quickly (< 10 seconds total)
- [ ] Descriptive test names
