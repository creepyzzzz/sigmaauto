'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartClipboardDetectorProps {
  onSelectUrl: (url: string, autoStart?: boolean) => void;
  currentUrl: string;
}

export default function SmartClipboardDetector({ onSelectUrl, currentUrl }: SmartClipboardDetectorProps) {
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [dismissedUrls, setDismissedUrls] = useState<Set<string>>(new Set());

  const isValidShortenerLink = (text: string): boolean => {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;

    const lower = trimmed.toLowerCase();
    return (
      lower.includes('lksfy') ||
      lower.includes('nanolinks') ||
      lower.includes('arolinks') ||
      lower.includes('adrinolinks') ||
      lower.includes('t.me/') ||
      lower.includes('telegram.me/')
    );
  };

  const checkClipboard = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return;
      
      const text = await navigator.clipboard.readText();
      if (text && isValidShortenerLink(text)) {
        const trimmed = text.trim();
        if (trimmed !== currentUrl && !dismissedUrls.has(trimmed)) {
          setDetectedUrl(trimmed);
        }
      }
    } catch {
      // Clipboard permission denied or not supported; fail silently
    }
  };

  useEffect(() => {
    // Check when user returns to tab
    const handleFocus = () => {
      checkClipboard();
    };

    window.addEventListener('focus', handleFocus);
    // Also listen for document visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkClipboard();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUrl, dismissedUrls]);

  const handleApply = () => {
    if (detectedUrl) {
      onSelectUrl(detectedUrl, true);
      setDetectedUrl(null);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (detectedUrl) {
      setDismissedUrls((prev) => new Set(prev).add(detectedUrl));
      setDetectedUrl(null);
    }
  };

  if (!detectedUrl) return null;

  const displayUrlShort = detectedUrl.replace(/^https?:\/\/(www\.)?/, '');

  return (
    <AnimatePresence>
      {detectedUrl && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="w-full max-w-xl mb-3 flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-white/[0.22] backdrop-blur-2xl border border-white/45 shadow-[0_8px_28px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.7)] text-white text-xs sm:text-sm select-none"
        >
          {/* Left Icon & Text */}
          <div 
            onClick={handleApply}
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer group"
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/40 shadow-sm text-sky-100">
              <i className="f7-icons text-xs">doc_on_clipboard_fill</i>
            </span>
            <div className="flex items-center gap-1 min-w-0 truncate text-[11px] sm:text-xs">
              <span className="text-sky-100/90 font-medium shrink-0">Clipboard:</span>
              <span className="text-white font-semibold truncate group-hover:underline">
                {displayUrlShort}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="bg-white hover:bg-white/95 active:scale-95 text-slate-900 font-semibold px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs shadow-[0_2px_8px_rgba(255,255,255,0.3)] flex items-center gap-1 cursor-pointer transition-all"
            >
              <span>Paste & Extract</span>
              <i className="f7-icons text-[10px] font-bold">arrow_right</i>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-white/60 hover:text-white p-1 rounded-full flex items-center cursor-pointer transition-colors"
              aria-label="Dismiss clipboard suggestion"
            >
              <i className="f7-icons text-xs sm:text-sm">xmark</i>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
