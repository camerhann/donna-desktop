/**
 * Link Preview - Fetch and parse Open Graph metadata from URLs
 * Phase 2: Rich Link Previews
 */
const { net } = require('electron');
const cheerio = require('cheerio');

class LinkPreviewFetcher {
  constructor(options = {}) {
    this.options = {
      timeout: 5000,
      maxRedirects: 3,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...options
    };
  }

  /**
   * Fetch preview metadata for a URL
   * @param {string} url - The URL to fetch
   * @returns {Promise<Object>} Preview metadata
   */
  async fetchPreview(url) {
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }

      const html = await this.fetchHtml(url);
      const metadata = this.parseMetadata(html, url);

      return {
        success: true,
        ...metadata
      };
    } catch (error) {
      console.error('Link preview fetch failed:', error.message);
      return {
        success: false,
        url,
        error: error.message,
        title: this.getTitleFromUrl(url),
        description: null,
        image: null,
        siteName: this.getSiteNameFromUrl(url),
        favicon: this.getFaviconUrl(url)
      };
    }
  }

  /**
   * Fetch HTML content from URL
   */
  fetchHtml(url) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.options.timeout);

      const request = net.request({
        url,
        method: 'GET',
        redirect: 'follow'
      });

      request.setHeader('User-Agent', this.options.userAgent);
      request.setHeader('Accept', 'text/html,application/xhtml+xml');

      let data = '';

      request.on('response', (response) => {
        // Only process HTML responses
        const contentType = response.headers['content-type']?.[0] || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          clearTimeout(timeoutId);
          reject(new Error('Not an HTML page'));
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
          // Limit data size to prevent memory issues
          if (data.length > 500000) {
            request.abort();
          }
        });

        response.on('end', () => {
          clearTimeout(timeoutId);
          resolve(data);
        });

        response.on('error', (err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });

      request.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });

      request.end();
    });
  }

  /**
   * Parse HTML and extract metadata
   */
  parseMetadata(html, url) {
    const $ = cheerio.load(html);

    // Extract Open Graph metadata
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');

    // Fallbacks
    const title = ogTitle
      || $('meta[name="twitter:title"]').attr('content')
      || $('title').text()
      || this.getTitleFromUrl(url);

    const description = ogDescription
      || $('meta[name="twitter:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || null;

    const image = this.resolveUrl(
      ogImage
        || $('meta[name="twitter:image"]').attr('content')
        || $('link[rel="image_src"]').attr('href'),
      url
    );

    const siteName = ogSiteName || this.getSiteNameFromUrl(url);

    // Get favicon
    const faviconLink = $('link[rel="icon"]').attr('href')
      || $('link[rel="shortcut icon"]').attr('href')
      || $('link[rel="apple-touch-icon"]').attr('href');
    const favicon = this.resolveUrl(faviconLink, url) || this.getFaviconUrl(url);

    return {
      url,
      title: title?.trim()?.slice(0, 200),
      description: description?.trim()?.slice(0, 500),
      image,
      siteName,
      favicon
    };
  }

  /**
   * Resolve relative URL to absolute
   */
  resolveUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return null;
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      return null;
    }
  }

  /**
   * Get title from URL as fallback
   */
  getTitleFromUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Get site name from URL
   */
  getSiteNameFromUrl(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace('www.', '');
      // Capitalize first letter
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    } catch {
      return null;
    }
  }

  /**
   * Get default favicon URL
   */
  getFaviconUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}/favicon.ico`;
    } catch {
      return null;
    }
  }
}

module.exports = { LinkPreviewFetcher };
