/**
 * Donna Desktop - File Sandbox Security Utility
 * Prevents path traversal attacks by constraining file operations to allowed directories.
 *
 * Security measures:
 * - Resolves all paths to absolute form (prevents ../ traversal)
 * - Resolves symlinks to their real paths (prevents symlink escapes)
 * - Validates that resolved paths fall within allowed directory boundaries
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class FileSandbox {
  /**
   * Create a new FileSandbox instance
   * @param {string[]} allowedPaths - Array of directory paths that are allowed for file operations
   */
  constructor(allowedPaths = []) {
    // Normalize and resolve all allowed paths at construction time
    this.allowedPaths = new Set();
    for (const dirPath of allowedPaths) {
      this.addAllowedPath(dirPath);
    }
  }

  /**
   * Add a directory path to the list of allowed paths
   * @param {string} dirPath - Directory path to allow
   * @returns {boolean} True if the path was added successfully
   */
  addAllowedPath(dirPath) {
    if (!dirPath || typeof dirPath !== 'string') {
      return false;
    }

    try {
      // Resolve to absolute path
      let resolvedPath = path.resolve(dirPath);

      // Try to resolve symlinks if the path exists
      if (fs.existsSync(resolvedPath)) {
        try {
          resolvedPath = fs.realpathSync(resolvedPath);
        } catch (symlinkError) {
          // If symlink resolution fails, use the resolved path
          console.warn(`FileSandbox: Could not resolve symlinks for ${dirPath}:`, symlinkError.message);
        }
      }

      // Normalize to ensure consistent trailing slash handling
      this.allowedPaths.add(path.normalize(resolvedPath));
      return true;
    } catch (error) {
      console.error(`FileSandbox: Failed to add allowed path ${dirPath}:`, error.message);
      return false;
    }
  }

  /**
   * Remove a directory path from the allowed paths
   * @param {string} dirPath - Directory path to remove
   * @returns {boolean} True if the path was removed
   */
  removeAllowedPath(dirPath) {
    const resolvedPath = path.normalize(path.resolve(dirPath));
    return this.allowedPaths.delete(resolvedPath);
  }

  /**
   * Get all currently allowed paths
   * @returns {string[]} Array of allowed directory paths
   */
  getAllowedPaths() {
    return Array.from(this.allowedPaths);
  }

  /**
   * Check if a file path is within the allowed directories
   * @param {string} filePath - File path to check
   * @returns {boolean} True if the path is allowed
   */
  isPathAllowed(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      // Resolve to absolute path first
      let resolvedPath = path.resolve(filePath);

      // Try to resolve symlinks if the path exists
      // This prevents symlink attacks where a symlink points outside allowed dirs
      if (fs.existsSync(resolvedPath)) {
        try {
          resolvedPath = fs.realpathSync(resolvedPath);
        } catch (symlinkError) {
          // If we can't resolve symlinks, be conservative and deny access
          // This handles cases like broken symlinks or permission issues
          console.warn(`FileSandbox: Could not resolve symlinks for ${filePath}:`, symlinkError.message);
          return false;
        }
      } else {
        // For non-existent files, resolve the parent directory's symlinks
        // to ensure the eventual file location is within bounds
        const parentDir = path.dirname(resolvedPath);
        if (fs.existsSync(parentDir)) {
          try {
            const realParent = fs.realpathSync(parentDir);
            resolvedPath = path.join(realParent, path.basename(resolvedPath));
          } catch (parentError) {
            console.warn(`FileSandbox: Could not resolve parent directory for ${filePath}:`, parentError.message);
          }
        }
      }

      // Normalize the path for consistent comparison
      resolvedPath = path.normalize(resolvedPath);

      // Check if the resolved path starts with any allowed path
      for (const allowedPath of this.allowedPaths) {
        // Ensure we're checking directory containment, not just prefix matching
        // e.g., /Users/allowed-secret should NOT match /Users/allowed
        if (resolvedPath === allowedPath || resolvedPath.startsWith(allowedPath + path.sep)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // On any error, deny access to be safe
      console.error(`FileSandbox: Error checking path ${filePath}:`, error.message);
      return false;
    }
  }

  /**
   * Validate that a file path is allowed and throw an error if not
   * @param {string} filePath - File path to validate
   * @param {string} operation - Description of the operation (for error messages)
   * @throws {Error} If the path is not within allowed directories
   * @returns {string} The resolved, validated path
   */
  validateAccess(filePath, operation = 'access') {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error(`FileSandbox: Invalid file path provided for ${operation} operation`);
    }

    if (!this.isPathAllowed(filePath)) {
      // Get the resolved path for the error message (but don't expose internals)
      const resolvedPath = path.resolve(filePath);
      throw new Error(
        `FileSandbox: Access denied. Attempted to ${operation} file outside allowed directories: ${resolvedPath}`
      );
    }

    // Return the resolved path for convenience
    let resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      try {
        resolvedPath = fs.realpathSync(resolvedPath);
      } catch (error) {
        // Already validated, so use the resolved path
      }
    }
    return resolvedPath;
  }

  /**
   * Validate and sanitize a relative path within a base directory
   * Useful for user-provided filenames that should stay within a specific folder
   * @param {string} basePath - The base directory (must be in allowed paths)
   * @param {string} relativePath - User-provided relative path/filename
   * @param {string} operation - Description of the operation
   * @returns {string} The full validated path
   * @throws {Error} If the path escapes the base directory
   */
  validateRelativePath(basePath, relativePath, operation = 'access') {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new Error(`FileSandbox: Invalid relative path provided for ${operation} operation`);
    }

    // Normalize the relative path to catch ../ sequences
    const normalizedRelative = path.normalize(relativePath);

    // Check for obvious traversal attempts
    if (normalizedRelative.startsWith('..') || path.isAbsolute(normalizedRelative)) {
      throw new Error(`FileSandbox: Path traversal attempt detected in ${operation} operation`);
    }

    // Build the full path and validate it
    const fullPath = path.join(basePath, normalizedRelative);
    return this.validateAccess(fullPath, operation);
  }
}

// Create a default instance with common Donna directories
const defaultAllowedPaths = [
  path.join(os.homedir(), '.donna-desktop'),
];

const defaultSandbox = new FileSandbox(defaultAllowedPaths);

module.exports = {
  FileSandbox,
  defaultSandbox
};
