/**
 * Wikilink Parser - Parse Obsidian wikilinks and frontmatter
 * Phase 7: Obsidian Vault Integration
 */

/**
 * Parse wikilinks from markdown content
 * Supports [[link]], [[link|alias]], and [[link#heading]]
 * @param {string} content - Markdown content
 * @returns {Array} Array of { raw, target, alias, heading }
 */
function parseWikilinks(content) {
  const links = [];
  const regex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    links.push({
      raw: match[0],
      target: match[1].trim(),
      heading: match[2]?.trim() || null,
      alias: match[3]?.trim() || null,
      index: match.index
    });
  }

  return links;
}

/**
 * Extract frontmatter from markdown content
 * @param {string} content - Full markdown content
 * @returns {Object} { frontmatter: {}, content: string }
 */
function extractFrontmatter(content) {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const frontmatterStr = match[1];
  const restContent = content.slice(match[0].length);

  // Parse YAML-like frontmatter
  const frontmatter = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Handle arrays (simple case)
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) ||
             (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Handle booleans
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // Handle numbers
    else if (/^-?\d+(\.\d+)?$/.test(value)) {
      value = parseFloat(value);
    }

    if (key) {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: restContent };
}

/**
 * Convert wikilinks in content to standard markdown links
 * @param {string} content - Content with wikilinks
 * @param {Function} resolver - Function to resolve wikilink to URL
 * @returns {string} Content with standard markdown links
 */
function convertWikilinksToMarkdown(content, resolver) {
  return content.replace(
    /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (match, target, heading, alias) => {
      const displayText = alias || target;
      const url = resolver(target, heading);
      return `[${displayText}](${url})`;
    }
  );
}

/**
 * Extract all headings from markdown content
 * @param {string} content - Markdown content
 * @returns {Array} Array of { level, text, slug }
 */
function extractHeadings(content) {
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim();
    headings.push({
      level: match[1].length,
      text,
      slug: text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    });
  }

  return headings;
}

/**
 * Extract tags from content
 * @param {string} content - Markdown content
 * @returns {Array} Array of tag strings (without #)
 */
function extractTags(content) {
  const tags = new Set();
  const regex = /#([\w-]+)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1]);
  }

  return [...tags];
}

module.exports = {
  parseWikilinks,
  extractFrontmatter,
  convertWikilinksToMarkdown,
  extractHeadings,
  extractTags
};
