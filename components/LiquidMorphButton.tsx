'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiquidMorphButtonProps {
  hasUrl: boolean;
  loading: boolean;
  onClick: (e: React.FormEvent) => void;
}

export default function LiquidMorphButton({ hasUrl, loading, onClick }: LiquidMorphButtonProps) {
  return (
    <>
      {/* SVG Liquid Gooey Filter Definition (Hidden, purely for pixel-melt threshold) */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="liquidGooFilter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feColorMatrix 
              in="blur" 
              mode="matrix" 
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" 
              result="goo" 
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="relative overflow-hidden bg-white hover:bg-white/95 active:scale-95 text-slate-900 font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm shadow-[0_2px_12px_rgba(255,255,255,0.22)] hover:shadow-[0_3px_16px_rgba(255,255,255,0.35)] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer shrink-0 min-h-[36px] sm:min-h-[42px]"
      >
        {/* In-place Gooey Liquid Morphing Container */}
        <div 
          className="relative flex items-center justify-center min-h-[20px]"
          style={{ filter: 'url(#liquidGooFilter)' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {hasUrl ? (
              <motion.div
                key="extract-state"
                initial={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
                transition={{
                  duration: 0.42,
                  ease: [0.4, 0, 0.2, 1], // Smooth organic liquid threshold
                }}
                className="flex items-center gap-1 sm:gap-1.5"
              >
                <span>Extract Key</span>
                <i className="f7-icons text-[11px] sm:text-xs text-slate-900 leading-none font-bold">
                  chevron_right
                </i>
              </motion.div>
            ) : (
              <motion.div
                key="auto-state"
                initial={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
                transition={{
                  duration: 0.42,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className="flex items-center"
              >
                <span>Auto-Generate</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </>
  );
}
