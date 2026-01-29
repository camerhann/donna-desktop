/**
 * Donna Desktop - URL Validator Security Utility
 * Prevents SSRF (Server-Side Request Forgery) attacks by validating URLs
 * before fetching external resources like link previews.
 *
 * Security measures:
 * - Protocol allowlist (only http/https)
 * - DNS resolution to detect private IP addresses
 * - Blocks RFC 1918, localhost, link-local, and IPv6 private ranges
 */

const dns = require('dns');
const { URL } = require('url');

// IPv4 private ranges (RFC 1918 and special-use)
const PRIVATE_IPV4_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },           // Class A private
  { start: '172.16.0.0', end: '172.31.255.255' },         // Class B private
  { start: '192.168.0.0', end: '192.168.255.255' },       // Class C private
  { start: '127.0.0.0', end: '127.255.255.255' },         // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' },       // Link-local
  { start: '0.0.0.0', end: '0.255.255.255' },             // Current network
  { start: '100.64.0.0', end: '100.127.255.255' },        // Shared address space (CGNAT)
  { start: '192.0.0.0', end: '192.0.0.255' },             // IETF protocol assignments
  { start: '192.0.2.0', end: '192.0.2.255' },             // TEST-NET-1
  { start: '198.51.100.0', end: '198.51.100.255' },       // TEST-NET-2
  { start: '203.0.113.0', end: '203.0.113.255' },         // TEST-NET-3
  { start: '224.0.0.0', end: '239.255.255.255' },         // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' },         // Reserved for future use
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Convert an IPv4 address string to a numeric value for range comparison
 * @param {string} ip - IPv4 address string (e.g., '192.168.1.1')
 * @returns {number} Numeric representation of the IP
 */
function ipv4ToNumber(ip) {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IPv4 address is within a private range
 * @param {string} ip - IPv4 address to check
 * @returns {boolean} True if the IP is private/internal
 */
function isPrivateIPv4(ip) {
  const ipNum = ipv4ToNumber(ip);

  for (const range of PRIVATE_IPV4_RANGES) {
    const startNum = ipv4ToNumber(range.start);
    const endNum = ipv4ToNumber(range.end);

    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an IPv6 address is private/internal
 * @param {string} ip - IPv6 address to check
 * @returns {boolean} True if the IP is private/internal
 */
function isPrivateIPv6(ip) {
  const normalizedIP = ip.toLowerCase();

  // Loopback (::1)
  if (normalizedIP === '::1' || normalizedIP === '0:0:0:0:0:0:0:1') {
    return true;
  }

  // Unique local addresses (fc00::/7 - includes fd00::/8)
  if (normalizedIP.startsWith('fc') || normalizedIP.startsWith('fd')) {
    return true;
  }

  // Link-local addresses (fe80::/10)
  if (normalizedIP.startsWith('fe8') || normalizedIP.startsWith('fe9') ||
      normalizedIP.startsWith('fea') || normalizedIP.startsWith('feb')) {
    return true;
  }

  // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  // These need special handling as they embed IPv4 addresses
  const ipv4MappedMatch = normalizedIP.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4MappedMatch) {
    return isPrivateIPv4(ipv4MappedMatch[1]);
  }

  // Unspecified address (::)
  if (normalizedIP === '::' || normalizedIP === '0:0:0:0:0:0:0:0') {
    return true;
  }

  return false;
}

/**
 * Check if an IP address (v4 or v6) is private/internal
 * @param {string} ip - IP address to check
 * @returns {boolean} True if the IP is private/internal
 */
function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') {
    return true; // Treat invalid IPs as private (deny by default)
  }

  // Determine if IPv4 or IPv6
  if (ip.includes(':')) {
    return isPrivateIPv6(ip);
  } else {
    return isPrivateIPv4(ip);
  }
}

/**
 * Check if a URL uses an allowed protocol
 * @param {string|URL} url - URL string or URL object to check
 * @returns {boolean} True if the protocol is allowed
 */
function isAllowedProtocol(url) {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return ALLOWED_PROTOCOLS.includes(urlObj.protocol);
  } catch (error) {
    return false;
  }
}

/**
 * Check if a hostname looks like an IP address
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if it looks like an IP address
 */
function isIPAddress(hostname) {
  // IPv4 pattern
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  // IPv6 pattern (simplified check - presence of colons)
  if (hostname.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Validate a URL for safe external fetching
 * Performs protocol validation and DNS resolution to block private IPs.
 *
 * @param {string} urlString - URL to validate
 * @returns {Promise<{valid: boolean, error?: string, resolvedIP?: string, url?: URL}>}
 */
async function validateUrl(urlString) {
  // Basic input validation
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Invalid URL: URL must be a non-empty string' };
  }

  // Parse the URL
  let url;
  try {
    url = new URL(urlString);
  } catch (parseError) {
    return { valid: false, error: `Invalid URL format: ${parseError.message}` };
  }

  // Check protocol
  if (!isAllowedProtocol(url)) {
    return {
      valid: false,
      error: `Protocol not allowed: ${url.protocol}. Only http and https are permitted.`
    };
  }

  // Get the hostname
  const hostname = url.hostname;

  if (!hostname) {
    return { valid: false, error: 'Invalid URL: No hostname found' };
  }

  // If the hostname is already an IP address, check it directly
  if (isIPAddress(hostname)) {
    // Remove brackets from IPv6 addresses
    const cleanIP = hostname.replace(/^\[|\]$/g, '');

    if (isPrivateIP(cleanIP)) {
      return {
        valid: false,
        error: `Access to private IP addresses is not allowed: ${cleanIP}`,
        resolvedIP: cleanIP
      };
    }
    return { valid: true, resolvedIP: cleanIP, url };
  }

  // Resolve the hostname to an IP address
  try {
    // Use dns.promises.lookup to resolve hostname
    // This resolves both A (IPv4) and AAAA (IPv6) records
    const result = await dns.promises.lookup(hostname, { all: true });

    // Check all resolved addresses
    for (const address of result) {
      if (isPrivateIP(address.address)) {
        return {
          valid: false,
          error: `Hostname ${hostname} resolves to private IP address: ${address.address}`,
          resolvedIP: address.address
        };
      }
    }

    // Return the first resolved IP for logging/audit purposes
    const primaryIP = result[0]?.address;
    return { valid: true, resolvedIP: primaryIP, url };

  } catch (dnsError) {
    // DNS resolution failed
    if (dnsError.code === 'ENOTFOUND') {
      return {
        valid: false,
        error: `Hostname not found: ${hostname}`
      };
    }
    if (dnsError.code === 'ENODATA') {
      return {
        valid: false,
        error: `No DNS records found for: ${hostname}`
      };
    }
    return {
      valid: false,
      error: `DNS resolution failed for ${hostname}: ${dnsError.message}`
    };
  }
}

/**
 * Validate a URL synchronously (without DNS resolution)
 * Use this for quick checks when you don't need IP validation.
 * Note: This is less secure than validateUrl() as it doesn't detect DNS rebinding.
 *
 * @param {string} urlString - URL to validate
 * @returns {{valid: boolean, error?: string, url?: URL}}
 */
function validateUrlSync(urlString) {
  // Basic input validation
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Invalid URL: URL must be a non-empty string' };
  }

  // Parse the URL
  let url;
  try {
    url = new URL(urlString);
  } catch (parseError) {
    return { valid: false, error: `Invalid URL format: ${parseError.message}` };
  }

  // Check protocol
  if (!isAllowedProtocol(url)) {
    return {
      valid: false,
      error: `Protocol not allowed: ${url.protocol}. Only http and https are permitted.`
    };
  }

  // Get the hostname
  const hostname = url.hostname;

  if (!hostname) {
    return { valid: false, error: 'Invalid URL: No hostname found' };
  }

  // If the hostname is an IP address, check it directly
  if (isIPAddress(hostname)) {
    const cleanIP = hostname.replace(/^\[|\]$/g, '');

    if (isPrivateIP(cleanIP)) {
      return {
        valid: false,
        error: `Access to private IP addresses is not allowed: ${cleanIP}`
      };
    }
  }

  return { valid: true, url };
}

module.exports = {
  isPrivateIP,
  isPrivateIPv4,
  isPrivateIPv6,
  isAllowedProtocol,
  validateUrl,
  validateUrlSync,
  ALLOWED_PROTOCOLS,
};
