/**
 * Link Preview IPC Handlers
 * Phase 2: Rich Link Previews
 */
const { ipcMain } = require('electron');
const { LinkPreviewFetcher } = require('../links/linkPreview');
const { getLinkCache } = require('../links/linkCache');

function registerLinkHandlers() {
  const fetcher = new LinkPreviewFetcher();
  const cache = getLinkCache();

  // Get preview for a URL
  ipcMain.handle('links:getPreview', async (event, { url }) => {
    if (!url) {
      return { success: false, error: 'URL required' };
    }

    // Check cache first
    const cached = cache.get(url);
    if (cached) {
      return { success: true, ...cached };
    }

    // Fetch preview
    const result = await fetcher.fetchPreview(url);

    // Cache successful results
    if (result.success) {
      cache.set(url, result);
    }

    return result;
  });

  // Get multiple previews
  ipcMain.handle('links:getMultiplePreviews', async (event, { urls }) => {
    if (!urls || !Array.isArray(urls)) {
      return { success: false, error: 'URLs array required' };
    }

    const results = {};
    const fetchPromises = [];

    for (const url of urls) {
      // Check cache first
      const cached = cache.get(url);
      if (cached) {
        results[url] = cached;
      } else {
        fetchPromises.push(
          fetcher.fetchPreview(url).then(result => {
            if (result.success) {
              cache.set(url, result);
            }
            results[url] = result;
          })
        );
      }
    }

    await Promise.all(fetchPromises);
    return { success: true, previews: results };
  });

  // Clear cache
  ipcMain.handle('links:clearCache', () => {
    cache.clear();
    return { success: true };
  });

  // Get cache stats
  ipcMain.handle('links:getCacheStats', () => {
    return { success: true, stats: cache.getStats() };
  });
}

module.exports = { registerLinkHandlers };
