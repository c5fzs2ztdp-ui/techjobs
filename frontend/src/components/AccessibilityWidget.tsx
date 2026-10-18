/**
 * @fileoverview AccessibilityWidget component provides accessibility controls
 * for users to customize their viewing experience including text size,
 * contrast, link highlighting, and cursor size.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Accessibility, X, ZoomIn, ZoomOut, Contrast, MousePointer2, Minus, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

/**
 * Interface defining the accessibility settings that can be customized by users.
 * @interface AccessibilitySettings
 * @property {number} fontSize - The font size percentage (80-150%)
 * @property {boolean} highContrast - Whether high contrast mode is enabled
 * @property {boolean} highlightLinks - Whether links should be highlighted
 * @property {boolean} bigCursor - Whether to use a larger cursor
 */
interface AccessibilitySettings {
  fontSize: number;
  highContrast: boolean;
  highlightLinks: boolean;
  bigCursor: boolean;
}

/**
 * Default accessibility settings used when no saved settings exist
 * or when the user resets to defaults.
 * @constant {AccessibilitySettings}
 */
const defaultSettings: AccessibilitySettings = {
  fontSize: 100,
  highContrast: false,
  highlightLinks: false,
  bigCursor: false,
};

/**
 * AccessibilityWidget component that provides a floating accessibility panel
 * allowing users to adjust text size, toggle high contrast mode,
 * highlight links, and enable a larger cursor.
 * 
 * Settings are persisted to localStorage and applied to the document root.
 * The widget is positioned at the bottom-right corner of the screen.
 * 
 * @returns {JSX.Element} The accessibility widget with toggle button and settings panel
 * @example
 * // Usage in a layout component:
 * <AccessibilityWidget />
 */
export default function AccessibilityWidget() {
  const [isOpen, setIsOpen] = useState(false);
  
  const { dialogRef, triggerRef, closeAndReturnFocus } = useDialogAccessibility({
    isOpen,
    onClose: () => setIsOpen(false),
  });

  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('accessibility-settings');
        if (!saved) return defaultSettings;
        // Valid JSON can still be the wrong shape (null, {}, stale schema) -
        // validate each field so a corrupted entry cannot crash the widget.
        const parsed: unknown = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object') return defaultSettings;
        const p = parsed as Partial<AccessibilitySettings>;
        return {
          fontSize: typeof p.fontSize === 'number' && p.fontSize >= 80 && p.fontSize <= 150 ? p.fontSize : 100,
          highContrast: p.highContrast === true,
          highlightLinks: p.highlightLinks === true,
          bigCursor: p.bigCursor === true,
        };
      } catch (e) {
        // If JSON is corrupted, return defaults
        if (import.meta.env.DEV) {
          console.warn('Failed to parse accessibility settings from localStorage:', e);
        }
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = `${settings.fontSize}%`;
    
    // Use classList.toggle for cleaner code
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('highlight-links', settings.highlightLinks);
    root.classList.toggle('big-cursor', settings.bigCursor);
    
    // Save to localStorage
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    } catch (e) {
      // localStorage may be unavailable in private browsing or quota exceeded
      if (import.meta.env.DEV) {
        console.warn('Failed to save accessibility settings to localStorage:', e);
      }
    }
  }, [settings]);

  /**
   * Increases the font size by 10%, up to a maximum of 150%.
   * @returns {void}
   */
  const increaseFontSize = () => {
    setSettings(prev => ({
      ...prev,
      fontSize: Math.min(prev.fontSize + 10, 150)
    }));
  };

  /**
   * Decreases the font size by 10%, down to a minimum of 80%.
   * @returns {void}
   */
  const decreaseFontSize = () => {
    setSettings(prev => ({
      ...prev,
      fontSize: Math.max(prev.fontSize - 10, 80)
    }));
  };

  /**
   * Resets all accessibility settings to their default values.
   * @returns {void}
   */
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  /**
   * Toggles the high contrast mode on or off.
   * @returns {void}
   */
  const toggleHighContrast = () => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  };

  /**
   * Toggles the highlight links feature on or off.
   * @returns {void}
   */
  const toggleHighlightLinks = () => {
    setSettings(prev => ({ ...prev, highlightLinks: !prev.highlightLinks }));
  };

  /**
   * Toggles the big cursor feature on or off.
   * @returns {void}
   */
  const toggleBigCursor = () => {
    setSettings(prev => ({ ...prev, bigCursor: !prev.bigCursor }));
  };

  return (
    <>
      {/* Accessibility Toggle Button */}
      <Button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-iris-600 hover:bg-iris-700 text-white shadow-lg"
        aria-label={isOpen ? 'Close accessibility menu' : 'Open accessibility menu'}
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
      </Button>

      {/* Accessibility Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-[100] md:hidden"
              onClick={closeAndReturnFocus}
              aria-hidden="true"
            />

            <motion.div
              ref={dialogRef}
              id="accessibility-panel"
              tabIndex={-1}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 z-[101] w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-warm-200"
              role="dialog"
              aria-modal="true"
              aria-label="Accessibility settings"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-warm-200">
                <div className="flex items-center gap-2">
                  <Accessibility className="w-5 h-5 text-iris-600" aria-hidden="true" />
                  <h2 className="font-semibold text-warm-900">Accessibility Settings</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeAndReturnFocus}
                  aria-label="Close accessibility menu"
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>

              {/* Options */}
              <div className="p-4 space-y-4">
                {/* Font Size */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-warm-700">
                    Text Size (<span role="status" aria-live="polite">{settings.fontSize}%</span>)
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decreaseFontSize}
                      disabled={settings.fontSize <= 80}
                      aria-label="Decrease text size"
                      className="flex-1"
                    >
                      <ZoomOut className="w-4 h-4 mr-1" aria-hidden="true" />
                      Smaller
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={increaseFontSize}
                      disabled={settings.fontSize >= 150}
                      aria-label="Increase text size"
                      className="flex-1"
                    >
                      <ZoomIn className="w-4 h-4 mr-1" aria-hidden="true" />
                      Larger
                    </Button>
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="space-y-2">
                  <Button
                    variant={settings.highContrast ? "default" : "outline"}
                    size="sm"
                    onClick={toggleHighContrast}
                    className="w-full justify-start gap-2"
                    aria-pressed={settings.highContrast}
                  >
                    <Contrast className="w-4 h-4" aria-hidden="true" />
                    High Contrast
                  </Button>

                  <Button
                    variant={settings.highlightLinks ? "default" : "outline"}
                    size="sm"
                    onClick={toggleHighlightLinks}
                    className="w-full justify-start gap-2"
                    aria-pressed={settings.highlightLinks}
                  >
                    <Link2 className="w-4 h-4" aria-hidden="true" />
                    Highlight Links
                  </Button>

                  <Button
                    variant={settings.bigCursor ? "default" : "outline"}
                    size="sm"
                    onClick={toggleBigCursor}
                    className="w-full justify-start gap-2"
                    aria-pressed={settings.bigCursor}
                  >
                    <MousePointer2 className="w-4 h-4" aria-hidden="true" />
                    Large Cursor
                  </Button>
                </div>

                {/* Reset */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSettings}
                  className="w-full text-warm-500 hover:text-warm-700"
                  aria-label="Reset all accessibility settings"
                >
                  <Minus className="w-4 h-4 mr-1" aria-hidden="true" />
                  Reset Settings
                </Button>

                {/* Link to full accessibility statement */}
                <div className="pt-2 border-t border-warm-200">
                  <Link
                    to={createPageUrl("AccessibilityStatement")}
                    className="text-sm text-iris-600 hover:text-iris-700 underline flex items-center gap-1"
                    onClick={closeAndReturnFocus}
                  >
                    <Accessibility className="w-3 h-3" aria-hidden="true" />
                    Full Accessibility Statement
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
