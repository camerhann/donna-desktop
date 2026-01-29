/**
 * Donna Desktop - Theme Manager
 * Manages light/dark mode with system preference detection
 * Issue #14: Light/dark mode support
 */

class ThemeManager {
  constructor() {
    // Theme options: 'system', 'light', 'dark'
    this.currentTheme = 'system';
    this.effectiveTheme = 'dark';
    this.mediaQuery = null;
    this.listeners = new Set();
    this.xtermInstances = new Set();

    this.init();
  }

  /**
   * Initialize theme manager
   */
  async init() {
    // Load saved preference from config
    try {
      const config = await window.donnaTerminal?.getTerminalConfig?.();
      if (config?.appearance?.theme) {
        this.currentTheme = config.appearance.theme;
      }
    } catch (e) {
      console.warn('Failed to load theme preference:', e);
    }

    // Setup system preference detection
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQuery.addEventListener('change', (e) => this.handleSystemThemeChange(e));

    // Apply initial theme
    this.applyTheme(this.currentTheme);

    // Setup keyboard shortcut for quick theme toggle (Cmd/Ctrl+Shift+L)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /**
   * Handle system theme preference change
   */
  handleSystemThemeChange(e) {
    if (this.currentTheme === 'system') {
      this.effectiveTheme = e.matches ? 'dark' : 'light';
      this.applyEffectiveTheme();
    }
  }

  /**
   * Get the system's preferred color scheme
   */
  getSystemTheme() {
    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  /**
   * Set and apply a theme
   * @param {'system' | 'light' | 'dark'} theme - The theme to apply
   */
  async setTheme(theme) {
    if (!['system', 'light', 'dark'].includes(theme)) {
      console.warn('Invalid theme:', theme);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);

    // Persist to config
    try {
      await window.donnaTerminal?.updateFeatureSettings?.('appearance', { theme });
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Apply theme based on setting
   */
  applyTheme(theme) {
    if (theme === 'system') {
      this.effectiveTheme = this.getSystemTheme();
    } else {
      this.effectiveTheme = theme;
    }
    this.applyEffectiveTheme();
  }

  /**
   * Apply the effective theme to the document
   */
  applyEffectiveTheme() {
    // Set data-theme attribute on document root
    document.documentElement.setAttribute('data-theme', this.effectiveTheme);

    // Update all registered xterm instances
    this.updateXtermThemes();
  }

  /**
   * Get the current theme setting
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Get the effective theme (resolved system preference)
   */
  getEffectiveTheme() {
    return this.effectiveTheme;
  }

  /**
   * Register an xterm instance for theme updates
   * @param {object} terminal - DonnaTerminal instance with term property
   */
  registerXterm(terminal) {
    this.xtermInstances.add(terminal);
    // Apply current theme immediately
    this.updateXtermTheme(terminal);
  }

  /**
   * Unregister an xterm instance
   */
  unregisterXterm(terminal) {
    this.xtermInstances.delete(terminal);
  }

  /**
   * Update all xterm instance themes
   */
  updateXtermThemes() {
    for (const terminal of this.xtermInstances) {
      this.updateXtermTheme(terminal);
    }
  }

  /**
   * Update a single xterm instance theme
   */
  updateXtermTheme(terminal) {
    if (!terminal?.term) return;

    const theme = this.effectiveTheme === 'dark'
      ? this.getDarkXtermTheme()
      : this.getLightXtermTheme();

    terminal.term.options.theme = theme;
  }

  /**
   * Get dark theme colors for xterm
   */
  getDarkXtermTheme() {
    return {
      background: '#16161a',
      foreground: '#e4e4e7',
      cursor: '#a78bfa',
      cursorAccent: '#16161a',
      selectionBackground: 'rgba(167, 139, 250, 0.3)',
      selectionForeground: '#ffffff',
      selectionInactiveBackground: 'rgba(167, 139, 250, 0.15)',
      black: '#27272a',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#e4e4e7',
      brightBlack: '#52525b',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fcd34d',
      brightBlue: '#93c5fd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#fafafa'
    };
  }

  /**
   * Get light theme colors for xterm
   */
  getLightXtermTheme() {
    return {
      background: '#ffffff',
      foreground: '#18181b',
      cursor: '#8b5cf6',
      cursorAccent: '#ffffff',
      selectionBackground: 'rgba(139, 92, 246, 0.25)',
      selectionForeground: '#18181b',
      selectionInactiveBackground: 'rgba(139, 92, 246, 0.1)',
      black: '#18181b',
      red: '#dc2626',
      green: '#16a34a',
      yellow: '#ca8a04',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#d4d4d8',
      brightBlack: '#52525b',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#f4f4f5'
    };
  }

  /**
   * Add a theme change listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of theme change
   */
  notifyListeners() {
    for (const callback of this.listeners) {
      try {
        callback({
          theme: this.currentTheme,
          effectiveTheme: this.effectiveTheme
        });
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    }
  }

  /**
   * Toggle between light and dark (skips system)
   */
  toggle() {
    const newTheme = this.effectiveTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }
}

// Create singleton instance
window.themeManager = new ThemeManager();
