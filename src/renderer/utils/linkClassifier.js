/**
 * Link Classifier Utility
 * Classifies URLs by type and provides context-aware icons
 * Issue #4: Smart Link Handling
 */

/**
 * SVG icons for different link types (14x14 viewBox)
 */
const LINK_ICONS = {
  // Google Drive icon (simplified drive logo)
  googleDrive: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M4.5 1L1 7l1.5 2.5h4L5 7 4.5 1z" stroke="#4285F4" stroke-width="1.2" fill="none"/>
    <path d="M9.5 1L5 7l1.5 2.5L11 7 9.5 1z" stroke="#0F9D58" stroke-width="1.2" fill="none"/>
    <path d="M2.5 9.5L5 13h4l2.5-3.5H2.5z" stroke="#F4B400" stroke-width="1.2" fill="none"/>
  </svg>`,

  // GitHub icon (octocat simplified)
  github: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1C3.686 1 1 3.686 1 7c0 2.65 1.719 4.9 4.104 5.693.3.055.41-.13.41-.29 0-.142-.006-.52-.009-1.02-1.669.363-2.02-.805-2.02-.805-.273-.693-.666-.877-.666-.877-.545-.372.041-.365.041-.365.602.043.92.62.92.62.535.917 1.404.652 1.746.499.054-.388.21-.652.381-.802-1.333-.152-2.733-.666-2.733-2.966 0-.655.234-1.19.617-1.61-.062-.152-.267-.762.059-1.588 0 0 .503-.161 1.65.615A5.752 5.752 0 017 3.869c.51.002 1.023.069 1.503.202 1.145-.776 1.648-.615 1.648-.615.327.826.122 1.436.06 1.588.385.42.616.955.616 1.61 0 2.305-1.402 2.812-2.739 2.961.216.186.407.552.407 1.112 0 .803-.007 1.45-.007 1.648 0 .16.108.348.413.289C11.283 11.898 13 9.648 13 7c0-3.314-2.686-6-6-6z" fill="currentColor"/>
  </svg>`,

  // Google Docs icon
  googleDocs: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1" width="10" height="12" rx="1" stroke="#4285F4" stroke-width="1.2" fill="none"/>
    <line x1="4" y1="4" x2="10" y2="4" stroke="#4285F4" stroke-width="1"/>
    <line x1="4" y1="6.5" x2="10" y2="6.5" stroke="#4285F4" stroke-width="1"/>
    <line x1="4" y1="9" x2="8" y2="9" stroke="#4285F4" stroke-width="1"/>
  </svg>`,

  // Google Sheets icon
  googleSheets: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1" width="10" height="12" rx="1" stroke="#0F9D58" stroke-width="1.2" fill="none"/>
    <line x1="2" y1="5" x2="12" y2="5" stroke="#0F9D58" stroke-width="1"/>
    <line x1="2" y1="9" x2="12" y2="9" stroke="#0F9D58" stroke-width="1"/>
    <line x1="7" y1="1" x2="7" y2="13" stroke="#0F9D58" stroke-width="1"/>
  </svg>`,

  // Google Slides icon
  googleSlides: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="2" width="10" height="10" rx="1" stroke="#F4B400" stroke-width="1.2" fill="none"/>
    <rect x="4" y="4" width="6" height="4" rx="0.5" stroke="#F4B400" stroke-width="1" fill="none"/>
  </svg>`,

  // Local file icon
  localFile: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 1h5l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="#a78bfa" stroke-width="1.3"/>
    <path d="M8 1v4h4" stroke="#a78bfa" stroke-width="1.3"/>
    <circle cx="7" cy="9" r="1.5" stroke="#a78bfa" stroke-width="1"/>
  </svg>`,

  // Slack icon
  slack: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 8.5a1.5 1.5 0 110-3h3v1.5A1.5 1.5 0 014.5 8.5H3z" stroke="#E01E5A" stroke-width="1"/>
    <path d="M8.5 3a1.5 1.5 0 110 3H7V4.5A1.5 1.5 0 018.5 3z" stroke="#36C5F0" stroke-width="1"/>
    <path d="M11 5.5a1.5 1.5 0 110 3H8V7a1.5 1.5 0 011.5-1.5H11z" stroke="#2EB67D" stroke-width="1"/>
    <path d="M5.5 11a1.5 1.5 0 110-3H7v1.5A1.5 1.5 0 015.5 11z" stroke="#ECB22E" stroke-width="1"/>
  </svg>`,

  // Notion icon
  notion: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
    <path d="M4.5 3.5v7M7 3.5L4.5 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="9.5" cy="5" r="1" fill="currentColor"/>
  </svg>`,

  // Figma icon
  figma: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="3" y="1" width="4" height="4" rx="2" stroke="#F24E1E" stroke-width="1"/>
    <rect x="7" y="1" width="4" height="4" rx="2" stroke="#FF7262" stroke-width="1"/>
    <rect x="3" y="5" width="4" height="4" rx="2" stroke="#A259FF" stroke-width="1"/>
    <rect x="7" y="5" width="4" height="4" rx="2" stroke="#1ABCFE" stroke-width="1"/>
    <rect x="3" y="9" width="4" height="4" rx="2" stroke="#0ACF83" stroke-width="1"/>
  </svg>`,

  // Linear icon
  linear: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1L12 6L7 11L2 6L7 1Z" stroke="#5E6AD2" stroke-width="1.3" fill="none"/>
    <circle cx="7" cy="6" r="1.5" fill="#5E6AD2"/>
  </svg>`,

  // Jira icon
  jira: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1L12 6L7 11" stroke="#0052CC" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7 1L2 6L7 11" stroke="#2684FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Confluence icon
  confluence: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 10C4 8 5.5 7 7 7s3 1 5 3" stroke="#0052CC" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M12 4C10 6 8.5 7 7 7S4 6 2 4" stroke="#2684FF" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  // NPM icon
  npm: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="3" width="12" height="8" fill="#CB3837"/>
    <rect x="3" y="5" width="2" height="4" fill="white"/>
    <rect x="6" y="5" width="2" height="4" fill="white"/>
    <rect x="7" y="5" width="1" height="2" fill="#CB3837"/>
    <rect x="9" y="5" width="2" height="4" fill="white"/>
  </svg>`,

  // Stack Overflow icon
  stackoverflow: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M10 13H3V8" stroke="#BCBBBB" stroke-width="1.3" fill="none"/>
    <path d="M4.5 10h4M4.5 7.5l4 .5M5 5l3.5 1.5M6 3l3 2.5" stroke="#F48024" stroke-width="1.3" stroke-linecap="round"/>
  </svg>`,

  // YouTube icon
  youtube: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="3" width="12" height="8" rx="2" stroke="#FF0000" stroke-width="1.2" fill="none"/>
    <path d="M6 5.5v3l2.5-1.5L6 5.5z" fill="#FF0000"/>
  </svg>`,

  // Twitter/X icon
  twitter: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 2l4 5-4 5M12 2l-4 5 4 5M5 7h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // LinkedIn icon
  linkedin: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="#0A66C2" stroke-width="1.2" fill="none"/>
    <circle cx="4" cy="4" r="1" fill="#0A66C2"/>
    <path d="M4 6v4M7 6v4M7 8c0-1.5 1-2 2-2s2 .5 2 2v2" stroke="#0A66C2" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  // AWS icon
  aws: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 7c1.5 1.5 4 2 5 2s3.5-.5 5-2" stroke="#FF9900" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M3 5L5 9M5 9L7 4M7 4L9 9M9 9L11 5" stroke="#252F3E" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  // Vercel icon
  vercel: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 2L12 12H2L7 2Z" fill="currentColor"/>
  </svg>`,

  // Netlify icon
  netlify: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1L12 4v6l-5 3-5-3V4l5-3z" stroke="#00C7B7" stroke-width="1.3" fill="none"/>
    <path d="M7 5v4M5 7h4" stroke="#00C7B7" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  // Generic link icon (default)
  generic: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M6 8l2-2m-1.5-2.5L8 2a2.83 2.83 0 014 4l-1.5 1.5M8 6L6 8m1.5 2.5L6 12a2.83 2.83 0 01-4-4l1.5-1.5"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
};

/**
 * LinkClassifier - Classifies URLs and provides appropriate icons
 */
class LinkClassifier {
  /**
   * URL patterns for classification
   * Order matters - more specific patterns should come first
   */
  static PATTERNS = {
    // Google services (more specific first)
    googleDocs: [/docs\.google\.com\/document/i],
    googleSheets: [/docs\.google\.com\/spreadsheets/i, /sheets\.google\.com/i],
    googleSlides: [/docs\.google\.com\/presentation/i, /slides\.google\.com/i],
    googleDrive: [/drive\.google\.com/i, /docs\.google\.com/i],

    // Code & Dev tools
    github: [/github\.com/i, /gist\.github\.com/i, /raw\.githubusercontent\.com/i],
    gitlab: [/gitlab\.com/i],
    bitbucket: [/bitbucket\.org/i],
    npm: [/npmjs\.com/i, /npm\.im/i],
    stackoverflow: [/stackoverflow\.com/i, /stackexchange\.com/i],

    // Project management
    linear: [/linear\.app/i],
    jira: [/atlassian\.net.*jira/i, /jira\./i],
    confluence: [/atlassian\.net.*wiki/i, /confluence\./i],
    notion: [/notion\.so/i, /notion\.site/i],

    // Design tools
    figma: [/figma\.com/i],

    // Communication
    slack: [/slack\.com/i, /.*\.slack\.com/i],

    // Cloud & Hosting
    aws: [/aws\.amazon\.com/i, /console\.aws/i, /\.amazonaws\.com/i],
    vercel: [/vercel\.com/i, /vercel\.app/i],
    netlify: [/netlify\.com/i, /netlify\.app/i],

    // Social & Media
    youtube: [/youtube\.com/i, /youtu\.be/i],
    twitter: [/twitter\.com/i, /x\.com/i],
    linkedin: [/linkedin\.com/i],

    // Local files
    localFile: [/^file:\/\//i]
  };

  /**
   * Display names for link types
   */
  static DISPLAY_NAMES = {
    googleDocs: 'Google Docs',
    googleSheets: 'Google Sheets',
    googleSlides: 'Google Slides',
    googleDrive: 'Google Drive',
    github: 'GitHub',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    npm: 'NPM',
    stackoverflow: 'Stack Overflow',
    linear: 'Linear',
    jira: 'Jira',
    confluence: 'Confluence',
    notion: 'Notion',
    figma: 'Figma',
    slack: 'Slack',
    aws: 'AWS',
    vercel: 'Vercel',
    netlify: 'Netlify',
    youtube: 'YouTube',
    twitter: 'X (Twitter)',
    linkedin: 'LinkedIn',
    localFile: 'Local File',
    generic: 'Link'
  };

  /**
   * Classify a URL by type
   * @param {string} url - URL to classify
   * @returns {string} Link type identifier
   */
  static classify(url) {
    if (!url || typeof url !== 'string') {
      return 'generic';
    }

    // Check each pattern type
    for (const [type, patterns] of Object.entries(this.PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(url)) {
          return type;
        }
      }
    }

    return 'generic';
  }

  /**
   * Get the SVG icon for a link type
   * @param {string} type - Link type identifier
   * @returns {string} SVG markup
   */
  static getIcon(type) {
    return LINK_ICONS[type] || LINK_ICONS.generic;
  }

  /**
   * Get icon for a URL (combines classify and getIcon)
   * @param {string} url - URL to get icon for
   * @returns {string} SVG markup
   */
  static getIconForUrl(url) {
    const type = this.classify(url);
    return this.getIcon(type);
  }

  /**
   * Get display name for a link type
   * @param {string} type - Link type identifier
   * @returns {string} Human-readable name
   */
  static getDisplayName(type) {
    return this.DISPLAY_NAMES[type] || 'Link';
  }

  /**
   * Extract a meaningful display name from a URL
   * @param {string} url - URL to extract name from
   * @param {string} type - Optional pre-computed type
   * @returns {string} Display name
   */
  static extractDisplayName(url, type = null) {
    if (!url) return 'Unknown';

    const linkType = type || this.classify(url);

    try {
      const u = new URL(url);
      const pathname = u.pathname;

      // Type-specific extraction
      switch (linkType) {
        case 'github': {
          // Extract repo name or path: github.com/owner/repo -> owner/repo
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length >= 2) {
            // Could be repo, issue, PR, etc.
            if (parts.length >= 4 && (parts[2] === 'issues' || parts[2] === 'pull')) {
              return `${parts[0]}/${parts[1]} #${parts[3]}`;
            }
            return `${parts[0]}/${parts[1]}`;
          }
          return u.hostname;
        }

        case 'googleDocs':
        case 'googleSheets':
        case 'googleSlides': {
          // Just show the type since doc titles aren't in URL
          return this.DISPLAY_NAMES[linkType];
        }

        case 'googleDrive': {
          // Check for folder or file indicators
          if (pathname.includes('/folders/')) {
            return 'Drive Folder';
          }
          return 'Google Drive';
        }

        case 'linear': {
          // linear.app/team/issue-123 -> issue-123
          const parts = pathname.split('/').filter(Boolean);
          const issue = parts.find(p => /^[A-Z]+-\d+$/i.test(p));
          if (issue) return issue.toUpperCase();
          return 'Linear';
        }

        case 'jira': {
          // Extract issue key like PROJ-123
          const match = pathname.match(/([A-Z]+-\d+)/i);
          if (match) return match[1].toUpperCase();
          return 'Jira';
        }

        case 'slack': {
          // Extract channel or thread info if available
          const parts = pathname.split('/').filter(Boolean);
          if (parts.includes('archives')) {
            return 'Slack Thread';
          }
          return 'Slack';
        }

        case 'notion': {
          // Notion URLs have page IDs, just show Notion
          return 'Notion Page';
        }

        case 'figma': {
          // figma.com/file/xxx/Name -> Name
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length >= 3 && parts[0] === 'file') {
            return decodeURIComponent(parts[2]).replace(/-/g, ' ');
          }
          return 'Figma';
        }

        case 'npm': {
          // npmjs.com/package/name -> name
          const parts = pathname.split('/').filter(Boolean);
          const pkgIdx = parts.indexOf('package');
          if (pkgIdx !== -1 && parts[pkgIdx + 1]) {
            return parts.slice(pkgIdx + 1).join('/');
          }
          return 'NPM Package';
        }

        case 'youtube': {
          // Just show YouTube since title isn't in URL
          return 'YouTube';
        }

        case 'localFile': {
          // file:///path/to/file.txt -> file.txt
          return pathname.split('/').pop() || 'Local File';
        }

        default: {
          // Generic: hostname + truncated path
          const host = u.hostname.replace('www.', '');
          if (pathname && pathname !== '/') {
            const shortPath = pathname.length > 25
              ? pathname.slice(0, 25) + '...'
              : pathname;
            return host + shortPath;
          }
          return host;
        }
      }
    } catch {
      // Invalid URL, return truncated
      return url.length > 40 ? url.slice(0, 40) + '...' : url;
    }
  }

  /**
   * Get full classification info for a URL
   * @param {string} url - URL to classify
   * @returns {Object} Classification result with type, icon, displayName
   */
  static getFullInfo(url) {
    const type = this.classify(url);
    return {
      type,
      icon: this.getIcon(type),
      typeName: this.getDisplayName(type),
      displayName: this.extractDisplayName(url, type),
      url
    };
  }
}

// Export for use in other modules
window.LinkClassifier = LinkClassifier;
window.LINK_ICONS = LINK_ICONS;
