/**
 * Donna Desktop - Security Utilities
 * Central export point for all security-related modules.
 *
 * Available utilities:
 * - FileSandbox: Prevents path traversal attacks for file operations
 * - urlValidator: Prevents SSRF attacks for external URL fetching
 */

const { FileSandbox, defaultSandbox } = require('./fileSandbox');
const urlValidator = require('./urlValidator');

module.exports = {
  // File sandbox for path traversal prevention
  FileSandbox,
  defaultSandbox,

  // URL validation for SSRF prevention
  urlValidator,

  // Convenience re-exports of commonly used functions
  isPrivateIP: urlValidator.isPrivateIP,
  validateUrl: urlValidator.validateUrl,
};
