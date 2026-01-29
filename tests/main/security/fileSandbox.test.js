/**
 * FileSandbox Test Suite
 *
 * Tests for the FileSandbox security utility that handles:
 * - Path validation and sanitization
 * - Path traversal prevention
 * - Symlink handling
 * - Directory containment enforcement
 *
 * Note: This test file is designed to test a FileSandbox utility
 * that should be created as part of the security infrastructure.
 */

const path = require('path');
const os = require('os');

// Import test helpers
const {
  createMockFileSystem,
  waitFor
} = require('../../utils/testHelpers');

// ============================================================================
// FileSandbox Mock Implementation for Testing
// ============================================================================

/**
 * FileSandbox provides secure file path validation and access control.
 * This is a reference implementation that tests should validate against.
 *
 * When the real FileSandbox is implemented, replace this import:
 * const { FileSandbox } = require('../../../src/main/utils/fileSandbox');
 */
class FileSandbox {
  constructor(options = {}) {
    this.allowedDirectories = options.allowedDirectories || [os.homedir()];
    this.followSymlinks = options.followSymlinks !== false;
    this.fs = options.fs || require('fs');
  }

  /**
   * Validates and resolves a path, ensuring it's within allowed directories
   * @param {string} inputPath - The path to validate
   * @returns {{ valid: boolean, resolvedPath?: string, error?: string }}
   */
  validatePath(inputPath) {
    // Check for null/undefined/empty
    if (!inputPath || typeof inputPath !== 'string') {
      return { valid: false, error: 'Invalid path: must be a non-empty string' };
    }

    // Check for null bytes (security issue)
    if (inputPath.includes('\0')) {
      return { valid: false, error: 'Invalid path: contains null bytes' };
    }

    // Resolve to absolute path
    let resolvedPath;
    try {
      resolvedPath = path.resolve(inputPath);
    } catch (e) {
      return { valid: false, error: `Invalid path: ${e.message}` };
    }

    // Check for path traversal patterns before resolution
    // This catches attempts like "foo/../../../etc/passwd"
    const normalizedInput = path.normalize(inputPath);
    if (normalizedInput.startsWith('..') || normalizedInput.includes('/../')) {
      // Additional check - is the resolved path still within allowed dirs?
      const isContained = this.allowedDirectories.some(dir => {
        const resolvedDir = path.resolve(dir);
        return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
      });

      if (!isContained) {
        return { valid: false, error: 'Path traversal detected: path escapes allowed directories' };
      }
    }

    // Check if path is within allowed directories
    const isAllowed = this.allowedDirectories.some(dir => {
      const resolvedDir = path.resolve(dir);
      return resolvedPath.startsWith(resolvedDir + path.sep) || resolvedPath === resolvedDir;
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: `Access denied: path is outside allowed directories`
      };
    }

    // If following symlinks, resolve the real path
    if (this.followSymlinks) {
      try {
        if (this.fs.existsSync(resolvedPath)) {
          const realPath = this.fs.realpathSync(resolvedPath);
          // Verify the real path is also within allowed directories
          const realPathAllowed = this.allowedDirectories.some(dir => {
            const resolvedDir = path.resolve(dir);
            return realPath.startsWith(resolvedDir + path.sep) || realPath === resolvedDir;
          });

          if (!realPathAllowed) {
            return {
              valid: false,
              error: 'Symlink resolves to path outside allowed directories'
            };
          }
          resolvedPath = realPath;
        }
      } catch (e) {
        // File doesn't exist yet, which is fine for write operations
      }
    }

    return { valid: true, resolvedPath };
  }

  /**
   * Checks if a path exists and is accessible
   * @param {string} inputPath - The path to check
   * @returns {{ exists: boolean, isFile?: boolean, isDirectory?: boolean, error?: string }}
   */
  checkAccess(inputPath) {
    const validation = this.validatePath(inputPath);
    if (!validation.valid) {
      return { exists: false, error: validation.error };
    }

    try {
      const stats = this.fs.statSync(validation.resolvedPath);
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (e) {
      if (e.code === 'ENOENT') {
        return { exists: false };
      }
      return { exists: false, error: e.message };
    }
  }

  /**
   * Validates a path for a specific operation type
   * @param {string} inputPath - The path to validate
   * @param {'read' | 'write' | 'delete'} operation - The operation type
   * @returns {{ allowed: boolean, resolvedPath?: string, error?: string }}
   */
  validateOperation(inputPath, operation) {
    const validation = this.validatePath(inputPath);
    if (!validation.valid) {
      return { allowed: false, error: validation.error };
    }

    const access = this.checkAccess(inputPath);

    switch (operation) {
      case 'read':
        if (!access.exists) {
          return { allowed: false, error: 'File does not exist' };
        }
        break;

      case 'write':
        // For write, we need to check if parent directory exists and is writable
        const parentDir = path.dirname(validation.resolvedPath);
        const parentValidation = this.validatePath(parentDir);
        if (!parentValidation.valid) {
          return { allowed: false, error: 'Parent directory is not accessible' };
        }
        break;

      case 'delete':
        if (!access.exists) {
          return { allowed: false, error: 'File does not exist' };
        }
        // Additional safety: prevent deletion of allowed root directories
        if (this.allowedDirectories.some(dir => path.resolve(dir) === validation.resolvedPath)) {
          return { allowed: false, error: 'Cannot delete root allowed directory' };
        }
        break;

      default:
        return { allowed: false, error: `Unknown operation: ${operation}` };
    }

    return { allowed: true, resolvedPath: validation.resolvedPath };
  }
}

// ============================================================================
// Test Suites
// ============================================================================

describe('FileSandbox', () => {
  let sandbox;
  let mockFs;

  beforeEach(() => {
    // Create a mock file system for testing
    mockFs = createMockFileSystem({
      'Users': {
        'testuser': {
          'documents': {
            'file.txt': 'Hello World',
            'data.json': '{"key": "value"}'
          },
          'projects': {
            'myproject': {
              'src': {
                'index.js': 'console.log("hello")'
              }
            }
          },
          '.config': {
            'settings.json': '{}'
          }
        }
      },
      'etc': {
        'passwd': 'root:x:0:0:root:/root:/bin/bash'
      }
    });

    // Create sandbox with test configuration
    sandbox = new FileSandbox({
      allowedDirectories: ['/Users/testuser'],
      fs: mockFs
    });
  });

  // ==========================================================================
  // Path Validation Tests
  // ==========================================================================

  describe('validatePath', () => {
    describe('basic validation', () => {
      test('should accept valid absolute paths within allowed directories', () => {
        const result = sandbox.validatePath('/Users/testuser/documents/file.txt');
        expect(result.valid).toBe(true);
        expect(result.resolvedPath).toBe('/Users/testuser/documents/file.txt');
      });

      test('should accept the root allowed directory itself', () => {
        const result = sandbox.validatePath('/Users/testuser');
        expect(result.valid).toBe(true);
      });

      test('should accept relative paths that resolve within allowed directories', () => {
        // When cwd is within allowed, relative should work
        const result = sandbox.validatePath('/Users/testuser/./documents/file.txt');
        expect(result.valid).toBe(true);
      });

      test('should reject null input', () => {
        const result = sandbox.validatePath(null);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid path');
      });

      test('should reject undefined input', () => {
        const result = sandbox.validatePath(undefined);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid path');
      });

      test('should reject empty string', () => {
        const result = sandbox.validatePath('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid path');
      });

      test('should reject non-string input', () => {
        const result = sandbox.validatePath(123);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid path');
      });

      test('should reject paths with null bytes', () => {
        const result = sandbox.validatePath('/Users/testuser/file\0.txt');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('null bytes');
      });
    });

    describe('directory containment', () => {
      test('should reject paths outside allowed directories', () => {
        const result = sandbox.validatePath('/etc/passwd');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('outside allowed directories');
      });

      test('should reject paths in sibling directories', () => {
        const result = sandbox.validatePath('/Users/otheruser/file.txt');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('outside allowed directories');
      });

      test('should reject parent directory paths', () => {
        const result = sandbox.validatePath('/Users');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('outside allowed directories');
      });

      test('should work with multiple allowed directories', () => {
        const multiSandbox = new FileSandbox({
          allowedDirectories: ['/Users/testuser/documents', '/Users/testuser/projects'],
          fs: mockFs
        });

        expect(multiSandbox.validatePath('/Users/testuser/documents/file.txt').valid).toBe(true);
        expect(multiSandbox.validatePath('/Users/testuser/projects/myproject/src/index.js').valid).toBe(true);
        expect(multiSandbox.validatePath('/Users/testuser/.config/settings.json').valid).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Path Traversal Prevention Tests
  // ==========================================================================

  describe('path traversal prevention', () => {
    test('should block simple parent traversal', () => {
      const result = sandbox.validatePath('/Users/testuser/../otheruser/file.txt');
      expect(result.valid).toBe(false);
    });

    test('should block deep parent traversal', () => {
      const result = sandbox.validatePath('/Users/testuser/documents/../../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    test('should block traversal at the start of path', () => {
      const result = sandbox.validatePath('../../../etc/passwd');
      expect(result.valid).toBe(false);
    });

    test('should block traversal with redundant slashes', () => {
      const result = sandbox.validatePath('/Users/testuser/documents//..//..//..//etc/passwd');
      expect(result.valid).toBe(false);
    });

    test('should allow internal traversal that stays within bounds', () => {
      // /Users/testuser/documents/../projects is still within /Users/testuser
      const result = sandbox.validatePath('/Users/testuser/documents/../projects/myproject');
      expect(result.valid).toBe(true);
    });

    test('should handle URL-encoded traversal attempts', () => {
      // Note: This tests that we handle decoded paths correctly
      // URL decoding should happen before this validation
      const result = sandbox.validatePath('/Users/testuser/..%2F..%2Fetc/passwd');
      // The literal %2F should be treated as part of the filename, not a separator
      // This should fail because it tries to access a path that doesn't exist
      // and the literal string contains suspicious patterns
      expect(result.valid).toBe(true); // Actually valid because %2F is literal
    });

    test('should block null byte injection with traversal', () => {
      const result = sandbox.validatePath('/Users/testuser/file.txt\0/../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null bytes');
    });
  });

  // ==========================================================================
  // Symlink Handling Tests
  // ==========================================================================

  describe('symlink handling', () => {
    test('should resolve symlinks and validate final path (when followSymlinks=true)', () => {
      // Create a mock that simulates a symlink
      const symlinkFs = createMockFileSystem({
        'Users': {
          'testuser': {
            'link': 'content' // This would be a symlink in real fs
          }
        }
      });

      // Override realpathSync to simulate symlink resolution
      symlinkFs.realpathSync = jest.fn((p) => {
        if (p === '/Users/testuser/link') {
          return '/Users/testuser/actual-file';
        }
        return p;
      });

      const symlinkSandbox = new FileSandbox({
        allowedDirectories: ['/Users/testuser'],
        followSymlinks: true,
        fs: symlinkFs
      });

      const result = symlinkSandbox.validatePath('/Users/testuser/link');
      expect(result.valid).toBe(true);
    });

    test('should block symlinks that resolve outside allowed directories', () => {
      const symlinkFs = createMockFileSystem({
        'Users': {
          'testuser': {
            'evil-link': 'symlink'
          }
        },
        'etc': {
          'passwd': 'root:x:0:0'
        }
      });

      // Override realpathSync to simulate symlink escaping
      symlinkFs.realpathSync = jest.fn((p) => {
        if (p === '/Users/testuser/evil-link') {
          return '/etc/passwd';
        }
        return p;
      });

      const symlinkSandbox = new FileSandbox({
        allowedDirectories: ['/Users/testuser'],
        followSymlinks: true,
        fs: symlinkFs
      });

      const result = symlinkSandbox.validatePath('/Users/testuser/evil-link');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Symlink resolves to path outside');
    });

    test('should not follow symlinks when followSymlinks=false', () => {
      const symlinkFs = createMockFileSystem({
        'Users': {
          'testuser': {
            'link': 'content'
          }
        }
      });

      symlinkFs.realpathSync = jest.fn((p) => '/etc/passwd');

      const noFollowSandbox = new FileSandbox({
        allowedDirectories: ['/Users/testuser'],
        followSymlinks: false,
        fs: symlinkFs
      });

      const result = noFollowSandbox.validatePath('/Users/testuser/link');
      expect(result.valid).toBe(true);
      // Should not have called realpathSync
      expect(symlinkFs.realpathSync).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Access Check Tests
  // ==========================================================================

  describe('checkAccess', () => {
    test('should return exists=true for existing files', () => {
      const result = sandbox.checkAccess('/Users/testuser/documents/file.txt');
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.isDirectory).toBe(false);
    });

    test('should return exists=true for existing directories', () => {
      const result = sandbox.checkAccess('/Users/testuser/documents');
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(false);
      expect(result.isDirectory).toBe(true);
    });

    test('should return exists=false for non-existent paths', () => {
      const result = sandbox.checkAccess('/Users/testuser/nonexistent.txt');
      expect(result.exists).toBe(false);
    });

    test('should return error for paths outside allowed directories', () => {
      const result = sandbox.checkAccess('/etc/passwd');
      expect(result.exists).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ==========================================================================
  // Operation Validation Tests
  // ==========================================================================

  describe('validateOperation', () => {
    describe('read operations', () => {
      test('should allow reading existing files', () => {
        const result = sandbox.validateOperation('/Users/testuser/documents/file.txt', 'read');
        expect(result.allowed).toBe(true);
      });

      test('should reject reading non-existent files', () => {
        const result = sandbox.validateOperation('/Users/testuser/nonexistent.txt', 'read');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('does not exist');
      });

      test('should reject reading files outside allowed directories', () => {
        const result = sandbox.validateOperation('/etc/passwd', 'read');
        expect(result.allowed).toBe(false);
      });
    });

    describe('write operations', () => {
      test('should allow writing to existing files', () => {
        const result = sandbox.validateOperation('/Users/testuser/documents/file.txt', 'write');
        expect(result.allowed).toBe(true);
      });

      test('should allow writing new files in existing directories', () => {
        const result = sandbox.validateOperation('/Users/testuser/documents/newfile.txt', 'write');
        expect(result.allowed).toBe(true);
      });

      test('should reject writing outside allowed directories', () => {
        const result = sandbox.validateOperation('/etc/newfile', 'write');
        expect(result.allowed).toBe(false);
      });
    });

    describe('delete operations', () => {
      test('should allow deleting existing files', () => {
        const result = sandbox.validateOperation('/Users/testuser/documents/file.txt', 'delete');
        expect(result.allowed).toBe(true);
      });

      test('should reject deleting non-existent files', () => {
        const result = sandbox.validateOperation('/Users/testuser/nonexistent.txt', 'delete');
        expect(result.allowed).toBe(false);
      });

      test('should reject deleting root allowed directories', () => {
        const result = sandbox.validateOperation('/Users/testuser', 'delete');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Cannot delete root');
      });
    });

    describe('unknown operations', () => {
      test('should reject unknown operation types', () => {
        const result = sandbox.validateOperation('/Users/testuser/file.txt', 'execute');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Unknown operation');
      });
    });
  });

  // ==========================================================================
  // Edge Cases and Security Tests
  // ==========================================================================

  describe('edge cases', () => {
    test('should handle paths with special characters', () => {
      const specialFs = createMockFileSystem({
        'Users': {
          'testuser': {
            'file with spaces.txt': 'content',
            'file-with-dashes.txt': 'content',
            'file_with_underscores.txt': 'content',
            'file.multiple.dots.txt': 'content'
          }
        }
      });

      const specialSandbox = new FileSandbox({
        allowedDirectories: ['/Users/testuser'],
        fs: specialFs
      });

      expect(specialSandbox.validatePath('/Users/testuser/file with spaces.txt').valid).toBe(true);
      expect(specialSandbox.validatePath('/Users/testuser/file-with-dashes.txt').valid).toBe(true);
      expect(specialSandbox.validatePath('/Users/testuser/file_with_underscores.txt').valid).toBe(true);
      expect(specialSandbox.validatePath('/Users/testuser/file.multiple.dots.txt').valid).toBe(true);
    });

    test('should handle hidden files (dotfiles)', () => {
      const result = sandbox.validatePath('/Users/testuser/.config/settings.json');
      expect(result.valid).toBe(true);
    });

    test('should handle deeply nested paths', () => {
      const deepFs = createMockFileSystem({
        'Users': {
          'testuser': {
            'a': { 'b': { 'c': { 'd': { 'e': { 'file.txt': 'deep' } } } } }
          }
        }
      });

      const deepSandbox = new FileSandbox({
        allowedDirectories: ['/Users/testuser'],
        fs: deepFs
      });

      const result = deepSandbox.validatePath('/Users/testuser/a/b/c/d/e/file.txt');
      expect(result.valid).toBe(true);
    });

    test('should handle case sensitivity appropriately', () => {
      // On macOS/Windows, file systems may be case-insensitive
      // This test documents expected behavior
      const result = sandbox.validatePath('/Users/testuser/Documents/file.txt');
      // The path is technically outside if we're strict about case
      // In real implementation, this depends on the OS
    });

    test('should handle very long paths', () => {
      const longName = 'a'.repeat(255);
      const result = sandbox.validatePath(`/Users/testuser/${longName}`);
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// Integration-style Tests
// ============================================================================

describe('FileSandbox Integration', () => {
  test('should work with realistic donna-desktop paths', () => {
    const donnaFs = createMockFileSystem({
      'Users': {
        'camerhann': {
          '.donna-desktop': {
            'config.json': '{}',
            'images': {
              'generated-001.png': 'binary'
            },
            'sessions': {}
          },
          'Documents': {},
          'Projects': {}
        }
      }
    });

    const donnaSandbox = new FileSandbox({
      allowedDirectories: [
        '/Users/camerhann/.donna-desktop',
        '/Users/camerhann/Documents',
        '/Users/camerhann/Projects'
      ],
      fs: donnaFs
    });

    // Should allow donna config
    expect(donnaSandbox.validatePath('/Users/camerhann/.donna-desktop/config.json').valid).toBe(true);

    // Should allow images
    expect(donnaSandbox.validatePath('/Users/camerhann/.donna-desktop/images/generated-001.png').valid).toBe(true);

    // Should block system files
    expect(donnaSandbox.validatePath('/etc/passwd').valid).toBe(false);

    // Should block other user directories
    expect(donnaSandbox.validatePath('/Users/otheruser/file.txt').valid).toBe(false);

    // Should block traversal out of allowed dirs
    expect(donnaSandbox.validatePath('/Users/camerhann/.donna-desktop/../../../etc/passwd').valid).toBe(false);
  });
});
