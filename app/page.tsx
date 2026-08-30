'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import HangingKeys from '@/components/HangingKeys';
import HumanTypingPlaceholder from '@/components/HumanTypingPlaceholder';
import AmbientParallaxKeys from '@/components/AmbientParallaxKeys';
import SmartClipboardDetector from '@/components/SmartClipboardDetector';
import LiquidMorphButton from '@/components/LiquidMorphButton';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Extracting key...');
  const [subStatusMessage, setSubStatusMessage] = useState('Please wait while we process your request.');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [extractedKey, setExtractedKey] = useState<string | null>(null);
  const [associatedUrl, setAssociatedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 75,
        spread: 65,
        origin: { y: 0.8 },
        colors: [
          '#ffffff', // Pure White
          '#f0f9ff', // Frosted Ice White
          '#bae6fd', // Soft Sky Blue
          '#64D2FF', // Apple Neon Cyan
          '#38BDF8', // Vivid Sky Blue
          '#007AFF', // iOS System Blue
          '#0284C7', // Deep Cobalt
        ],
      });
    } catch {}
  };

  const handleCopyKey = () => {
    if (!extractedKey) return;
    navigator.clipboard.writeText(extractedKey);
    setCopied(true);
    triggerConfetti();
    setTimeout(() => setCopied(false), 2500);
  };

  const startExtraction = async (targetUrl?: string, isAuto: boolean = false) => {
    const linkToProcess = targetUrl !== undefined ? targetUrl : url;
    
    if (!isAuto && !linkToProcess.trim()) {
      setErrorMessage('Please enter a link to extract.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setExtractedKey(null);
    setAssociatedUrl(null);
    setCountdown(10);
    setStatusMessage(isAuto ? 'Auto-Generating Key...' : 'Extracting key...');
    setSubStatusMessage('Please wait while we process your request.');

    try {
      const endpoint = isAuto ? '/api/auto-generate' : '/api/extract';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkToProcess.trim(), stream: true }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Server responded with status ${response.status}`);
      }

      if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let receivedResult = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split(/\r?\n/);
            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (line.startsWith('data:')) {
                try {
                  const jsonStr = line.slice(5).trim();
                  const data = JSON.parse(jsonStr);
                  
                  if (data.type === 'progress') {
                    if (data.step) setSubStatusMessage(data.step);
                    if (data.countdown !== undefined) {
                      setCountdown(data.countdown);
                    }
                  } else if (data.type === 'result') {
                    receivedResult = true;
                    setExtractedKey(data.key);
                    if (data.associatedUrl) setAssociatedUrl(data.associatedUrl);
                    setLoading(false);
                    setCountdown(null);
                    triggerConfetti();
                  } else if (data.type === 'error') {
                    receivedResult = true;
                    console.error('[Keyo Extraction Error]', data.error);
                    setErrorMessage(data.error || 'Failed to extract key.');
                    setLoading(false);
                    setCountdown(null);
                  }
                } catch (e) {
                  console.error('[Keyo SSE Parse Error]', e, line);
                }
              }
            }
          }
        }

        if (!receivedResult && !errorMessage) {
          setLoading(false);
          setCountdown(null);
        }
      } else {
        const data = await response.json();
        if (data.success && data.key) {
          setExtractedKey(data.key);
          if (data.associatedUrl) setAssociatedUrl(data.associatedUrl);
          triggerConfetti();
        } else {
          console.error('[Keyo Extraction Error]', data.error);
          setErrorMessage(data.error || 'Failed to extract key.');
        }
      }
    } catch (err: any) {
      console.error('[Keyo Client Exception]', err);
      setErrorMessage(err?.message || 'Failed to connect to the extraction service.');
    } finally {
      setLoading(false);
      setCountdown(null);
    }
  };

  const handleExtractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (url.trim()) {
      startExtraction(url, false);
    } else {
      startExtraction('', true);
    }
  };

  const handleAutoGenerate = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setUrl('');
    startExtraction('', true);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-between p-3.5 sm:p-6 lg:p-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-x-hidden font-sans">
      {/* 3D Mouse Parallax & Device Gyroscope Ambient Floating Keys */}
      <AmbientParallaxKeys />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between py-2 sm:py-3">
        {/* Logo Wordmark (Logo represents 'K' + 'eyo') */}
        <div className="flex items-center gap-0.5 sm:gap-1 cursor-pointer select-none">
          <img 
            src="/images/logo.png" 
            alt="Keyo" 
            className="w-7 h-7 sm:w-8.5 sm:h-8.5 object-contain shrink-0" 
          />
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-heading leading-none -ml-0.5">
            eyo
          </span>
        </div>

        {/* Feature-Relevant Nav Button */}
        <div className="flex items-center font-sans">
          <a
            href="https://t.me/Rrryomenn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-[13px] font-medium text-white/90 hover:text-white bg-white/15 hover:bg-white/25 border border-white/30 px-3.5 sm:px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <i className="f7-icons text-xs sm:text-sm leading-none text-sky-200">paperplane_fill</i>
            <span>Telegram</span>
          </a>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="relative z-10 w-full max-w-3xl flex flex-col items-center justify-center my-auto py-3 sm:py-6 px-1">
        {/* Centered Headline Container with macOS Window Dots aligned above the 'E' of Extract */}
        <div className="w-fit mx-auto flex flex-col items-start mb-1 sm:mb-2">
          {/* macOS / iOS Liquid Glass Buttons placed directly above the 'E' of Extract keys */}
          <div className="group flex items-center gap-2 mb-3 sm:mb-4 p-1 -ml-1 rounded-full">
            {/* Close / Reset Button (Red Liquid Glass) */}
            <div className="relative group/btn flex flex-col items-center">
              <button
                type="button"
                onClick={() => { setUrl(''); setExtractedKey(null); setErrorMessage(null); }}
                className="relative w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#FF5F56] to-[#E0443E] border border-black/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.12)] flex items-center justify-center transition-opacity active:opacity-80 overflow-hidden cursor-pointer"
              >
                {/* Top Glass Specular Arc */}
                <span className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
                {/* Perfectly Centered Vector SVG Close Icon */}
                <svg viewBox="0 0 8 8" className="w-2 h-2 text-[#4D0000] stroke-current stroke-[1.4] opacity-0 group-hover:opacity-100 transition-opacity duration-150 relative z-10" fill="none">
                  <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Translucent Liquid Glass Tooltip */}
              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-all duration-200 ease-out transform translate-y-1 group-hover/btn:translate-y-0 scale-95 group-hover/btn:scale-100 z-30 whitespace-nowrap">
                <div className="bg-white/20 backdrop-blur-xl border border-white/35 px-3 py-0.5 rounded-full text-[11px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.4)] font-sans">
                  <span>Reset All</span>
                </div>
              </div>
            </div>

            {/* Minimize / Dismiss Button (Silver Liquid Glass) */}
            <div className="relative group/btn flex flex-col items-center">
              <button
                type="button"
                onClick={() => { setErrorMessage(null); }}
                className="relative w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#FFFFFF] to-[#E5E7EB] border border-black/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-center transition-opacity active:opacity-80 overflow-hidden cursor-pointer"
              >
                {/* Top Glass Specular Arc */}
                <span className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-gradient-to-b from-white/70 to-transparent pointer-events-none" />
                {/* Perfectly Centered Vector SVG Minus Icon */}
                <svg viewBox="0 0 8 8" className="w-2 h-2 text-[#374151] stroke-current stroke-[1.4] opacity-0 group-hover:opacity-100 transition-opacity duration-150 relative z-10" fill="none">
                  <path d="M1.5 4H6.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Translucent Liquid Glass Tooltip */}
              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-all duration-200 ease-out transform translate-y-1 group-hover/btn:translate-y-0 scale-95 group-hover/btn:scale-100 z-30 whitespace-nowrap">
                <div className="bg-white/20 backdrop-blur-xl border border-white/35 px-3 py-0.5 rounded-full text-[11px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.4)] font-sans">
                  <span>Dismiss</span>
                </div>
              </div>
            </div>

            {/* Action / Auto-Generate Button (Cyan Aqua Liquid Glass) */}
            <div className="relative group/btn flex flex-col items-center">
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="relative w-3.5 h-3.5 rounded-full bg-gradient-to-b from-[#67E8F9] to-[#06B6D4] border border-black/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.12)] flex items-center justify-center transition-opacity active:opacity-80 overflow-hidden cursor-pointer"
              >
                {/* Top Glass Specular Arc */}
                <span className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-gradient-to-b from-white/65 to-transparent pointer-events-none" />
                {/* Perfectly Centered Vector SVG Plus Icon */}
                <svg viewBox="0 0 8 8" className="w-2 h-2 text-[#0E7490] stroke-current stroke-[1.4] opacity-0 group-hover:opacity-100 transition-opacity duration-150 relative z-10" fill="none">
                  <path d="M4 1.5V6.5M1.5 4H6.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Translucent Liquid Glass Tooltip */}
              <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-all duration-200 ease-out transform translate-y-1 group-hover/btn:translate-y-0 scale-95 group-hover/btn:scale-100 z-30 whitespace-nowrap">
                <div className="bg-white/20 backdrop-blur-xl border border-white/35 px-3 py-0.5 rounded-full text-[11px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.4)] font-sans">
                  <span>Auto-Generate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Title with Interactive Falling Keys and Clean Headline */}
          <h1 className="text-center font-bold tracking-tight text-white leading-[1.08] flex flex-col items-center font-heading">
            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold mb-0.5 sm:mb-1 tracking-tight drop-shadow-sm text-center">
              Extract{' '}
              <HangingKeys />
            </span>
            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-tight drop-shadow-sm text-center">
              instantly.
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-center text-xs sm:text-base md:text-lg text-sky-100 font-normal mt-2 sm:mt-3 mb-4 sm:mb-6 drop-shadow-sm font-sans tracking-[-0.01em]">
          Paste a link or generate a key automatically.
        </p>

        {/* Smart Clipboard Auto-Detector */}
        <SmartClipboardDetector
          currentUrl={url}
          onSelectUrl={(pastedUrl, autoStart) => {
            setUrl(pastedUrl);
            if (autoStart) {
              startExtraction(pastedUrl, false);
            }
          }}
        />

        {/* Dynamic Smart URL Input Form Pill */}
        <form onSubmit={handleExtractSubmit} className="w-full max-w-xl mb-6 sm:mb-8">
          <div className="glass-pill rounded-full p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_2px_16px_rgba(255,255,255,0.08),inset_0_1px_1px_rgba(255,255,255,0.35)] focus-within:shadow-[0_2px_20px_rgba(255,255,255,0.18),inset_0_1px_1px_rgba(255,255,255,0.5)] focus-within:ring-2 focus-within:ring-white/50">
            <div className="pl-2 sm:pl-3 text-sky-200 flex items-center shrink-0">
              <i className="f7-icons text-base sm:text-lg text-sky-200 leading-none">link</i>
            </div>
            <div className="relative flex-1 min-w-0 flex items-center">
              {!url && (
                <HumanTypingPlaceholder isFocused={isInputFocused} />
              )}
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                disabled={loading}
                className="w-full bg-transparent text-white text-xs sm:text-base outline-none px-1 py-1 font-normal disabled:opacity-50 relative z-10"
              />
            </div>
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="text-white/60 hover:text-white p-1 rounded-full flex items-center shrink-0 cursor-pointer relative z-20"
              >
                <i className="f7-icons text-sm sm:text-base text-white/70 leading-none">xmark_circle_fill</i>
              </button>
            )}
            <LiquidMorphButton
              hasUrl={!!url.trim()}
              loading={loading}
              onClick={handleExtractSubmit}
            />
          </div>
        </form>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="w-full max-w-xl glass-panel rounded-2xl p-3.5 sm:p-4 mb-4 sm:mb-5 border-red-300/40 bg-red-500/20 text-white flex items-start gap-2.5 sm:gap-3 animate-fadeIn">
            <i className="f7-icons text-base sm:text-lg text-red-200 shrink-0 mt-0.5 leading-none">exclamationmark_triangle_fill</i>
            <div className="flex-1 text-xs sm:text-sm min-w-0">
              <p className="font-semibold text-red-100">Extraction Error</p>
              <p className="text-red-200 text-[11px] sm:text-xs mt-0.5 break-words">{errorMessage}</p>
            </div>
            <button 
              onClick={() => setErrorMessage(null)} 
              className="text-red-200 hover:text-white p-1 flex items-center shrink-0 cursor-pointer"
            >
              <i className="f7-icons text-sm text-red-200 leading-none">xmark</i>
            </button>
          </div>
        )}

        {/* Live Loading & Extracted Key Cards Container */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading-card"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', damping: 26, stiffness: 340, mass: 0.7 }}
              style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
              className="w-full max-w-xl relative overflow-hidden rounded-[22px] sm:rounded-[32px] bg-white/[0.22] backdrop-blur-[36px] -webkit-backdrop-blur-[36px] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(0,0,0,0.06)] px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-3 sm:gap-6 mb-5 sm:mb-6"
            >
              {/* Top Glass Specular Arc Reflection */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-[22px] sm:rounded-t-[32px] bg-gradient-to-b from-white/40 via-white/10 to-transparent" />

              <div className="relative z-10 flex items-center gap-3 sm:gap-5 min-w-0">
                {/* Apple Liquid Glass Circular Spinner */}
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
                  <svg className="animate-spin w-full h-full" viewBox="0 0 44 44" fill="none">
                    <defs>
                      <linearGradient id="appleCleanSpinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                        <stop offset="45%" stopColor="#67E8F9" stopOpacity="0.85" />
                        <stop offset="85%" stopColor="#38BDF8" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="22"
                      cy="22"
                      r="17"
                      stroke="url(#appleCleanSpinnerGrad)"
                      strokeWidth="3.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Typography */}
                <div className="flex flex-col justify-center min-w-0">
                  <h3 className="text-white font-semibold text-[15px] sm:text-[18px] tracking-[-0.02em] leading-snug truncate drop-shadow-sm">
                    {statusMessage}
                  </h3>
                  <p className="text-sky-100/90 text-[12px] sm:text-[14px] font-normal tracking-[-0.01em] mt-0.5 truncate drop-shadow-sm">
                    {subStatusMessage}
                  </p>
                </div>
              </div>

              {/* Right Liquid Glass Countdown Circle Badge */}
              {countdown !== null && countdown > 0 && (
                <div className="relative z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/60 bg-white/20 backdrop-blur-xl flex items-center justify-center text-white font-semibold text-[14px] sm:text-[17px] tracking-[-0.01em] shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_2px_8px_rgba(0,0,0,0.1)]">
                  <span>{countdown}s</span>
                </div>
              )}
            </motion.div>
          )}

          {extractedKey && !loading && (
            <motion.div
              key="result-card"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', damping: 24, stiffness: 320, mass: 0.75 }}
              style={{ willChange: 'transform, opacity', transform: 'translateZ(0)' }}
              className="w-full max-w-xl flex flex-col gap-2 mb-5 sm:mb-6"
            >
              <div className="relative overflow-hidden w-full rounded-[22px] sm:rounded-[32px] bg-white/[0.22] backdrop-blur-[36px] -webkit-backdrop-blur-[36px] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.85),inset_0_-1px_1px_rgba(0,0,0,0.06)] px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-3 sm:gap-4">
                {/* Top Glass Specular Arc Reflection */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-[22px] sm:rounded-t-[32px] bg-gradient-to-b from-white/40 via-white/10 to-transparent" />

                <div className="relative z-10 flex items-center gap-2.5 sm:gap-4 overflow-hidden min-w-0">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/20 border border-white/50 flex items-center justify-center shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] text-white">
                    <i className="f7-icons text-base sm:text-xl text-sky-100 leading-none">lock_fill</i>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] sm:text-[11px] text-sky-200/90 uppercase font-semibold tracking-wider drop-shadow-sm truncate">Access Token</span>
                    <span className="font-mono font-bold text-xs sm:text-base md:text-lg text-white truncate tracking-wide drop-shadow-sm">
                      {extractedKey}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="relative z-10 bg-white hover:bg-white/95 active:scale-95 text-slate-900 font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm shadow-[0_2px_12px_rgba(255,255,255,0.22)] hover:shadow-[0_3px_16px_rgba(255,255,255,0.35)] transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <i className="f7-icons text-xs sm:text-sm text-emerald-600 leading-none font-bold">checkmark</i>
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <i className="f7-icons text-xs sm:text-sm text-slate-800 leading-none">doc_on_doc_fill</i>
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
              </div>

              {/* Optional Telegram / Associated URL action */}
              {associatedUrl && (
                <div className="flex items-center justify-end px-2">
                  <a
                    href={associatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] sm:text-[12px] text-sky-100 hover:text-white flex items-center gap-1 underline transition-colors"
                  >
                    <span>Open target verification URL</span>
                    <i className="f7-icons text-[11px] sm:text-xs text-sky-100 leading-none">arrow_up_right_square</i>
                  </a>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
