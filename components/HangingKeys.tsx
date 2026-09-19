'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HangingKeys() {
  const [isHanging, setIsHanging] = useState(false);
  const [fallState, setFallState] = useState<'attached' | 'falling' | 'dropping_in'>('attached');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const raiseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);
    };
  }, []);

  const triggerFallWithAutoRaise = () => {
    if (fallState !== 'attached') return;
    setIsHanging(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Auto-raise back up after 3.2 seconds if not broken
    timerRef.current = setTimeout(() => {
      setIsHanging(false);
    }, 3200);
  };

  const handleMouseEnter = () => {
    if (fallState !== 'attached') return;
    if (window.matchMedia('(hover: hover)').matches) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(true);
    }
  };

  const handleMouseLeave = () => {
    if (fallState !== 'attached') return;
    if (window.matchMedia('(hover: hover)').matches) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(false);
    }
  };

  const handleBoxClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (fallState !== 'attached') return;

    if (isHanging) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(false);
    } else {
      triggerFallWithAutoRaise();
    }
  };

  // Break hinge and execute full physical cycle
  const handleHingeClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (fallState !== 'attached') return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (raiseTimerRef.current) clearTimeout(raiseTimerRef.current);

    // 1. Free fall downward with full opacity
    setFallState('falling');

    // 2. After dropping off-screen (1.4s), drop down from top and latch onto pivot with SHM
    resetTimerRef.current = setTimeout(() => {
      setFallState('dropping_in');

      // 3. After SHM oscillations damp out and come to a complete rest (2.6s), lift against gravity back to 10°
      raiseTimerRef.current = setTimeout(() => {
        setFallState('attached');
        setIsHanging(false);
      }, 2600);
    }, 1400);
  };

  return (
    <span 
      className="relative inline-block select-none align-baseline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expanded hit area for normal state */}
      {fallState === 'attached' && (
        <span 
          className="absolute -inset-x-6 -inset-y-8 z-0 pointer-events-auto cursor-pointer"
          onClick={handleBoxClick}
          onTouchEnd={handleBoxClick}
        />
      )}

      {/* Motion Box with Physics Simulation */}
      <motion.span
        key={fallState}
        className="relative inline-block px-1.5 py-0 z-10 selection-box-wrap cursor-pointer"
        onClick={handleBoxClick}
        onTouchEnd={handleBoxClick}
        initial={
          fallState === 'falling'
            ? { rotate: isHanging ? 70 : 10, y: isHanging ? 3 : 0, x: 0, opacity: 1 }
            : fallState === 'dropping_in'
            ? { rotate: 5, y: -450, x: 0, opacity: 1 }
            : { rotate: 70, y: 3, x: 0, opacity: 1 }
        }
        animate={
          fallState === 'falling'
            ? { 
                y: 1200,
                x: 80,
                rotate: 150,
                opacity: 1, // 100% solid opacity during fall
              }
            : fallState === 'dropping_in'
            ? { 
                y: 3,
                rotate: 70, // Settles at natural hanging angle after SHM oscillations
                opacity: 1,
              }
            : { 
                // Return against gravity back to original 10deg resting tilt
                rotate: isHanging ? 70 : 10,
                y: isHanging ? 3 : 0,
                x: 0,
                opacity: 1,
              }
        }
        transition={
          fallState === 'falling'
            ? {
                // Free fall gravitational acceleration
                duration: 1.0,
                ease: [0.45, 0, 0.9, 0.4],
              }
            : fallState === 'dropping_in'
            ? {
                // Drop & catch pivot: rapid vertical drop, then pure SHM pendulum oscillations
                y: {
                  duration: 0.32,
                  ease: [0.33, 0, 0.67, 1],
                },
                rotate: {
                  type: 'spring',
                  stiffness: 48, // Low stiffness for natural wide pendulum swing
                  damping: 3.8,  // Low damping allows multiple SHM back-and-forth cycles
                  mass: 1.8,     // Heavy mass for realistic inertia
                  restDelta: 0.001,
                },
              }
            : isHanging
            ? {
                // Interactive hanging spring
                type: 'spring',
                stiffness: 75,
                damping: 5.2,
                mass: 1.4,
                restDelta: 0.001,
              }
            : {
                // Move against gravity: smooth, controlled upward lift back to resting 10deg
                type: 'spring',
                stiffness: 120,
                damping: 14,
                mass: 1.1,
              }
        }
        style={{
          transformOrigin: fallState === 'falling' ? '30% 50%' : '0% 0%',
          display: 'inline-block',
        }}
      >
        {/* Dashed Selection Border */}
        <span 
          className="absolute -inset-x-1 -inset-y-0.5 pointer-events-none rounded-[2px]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='rgba(255, 255, 255, 0.85)' stroke-width='1.5' stroke-dasharray='8%2c 5' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e")`,
          }}
        />

        {/* Top-Right Loose Pin */}
        <span className={`absolute -top-[5px] -right-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none transition-opacity duration-150 ${isHanging || fallState === 'dropping_in' ? 'opacity-50' : 'opacity-100'}`} />

        {/* Bottom-Right Handle Pin */}
        <span className="absolute -bottom-[5px] -right-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none" />

        {/* Bottom-Left Handle Pin */}
        <span className="absolute -bottom-[5px] -left-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none" />

        {/* The Text 'keys' */}
        <span className="relative z-10 text-[2.1rem] xs:text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-tight text-white drop-shadow-sm inline-block">
          keys
        </span>
      </motion.span>

      {/* Fixed Wall Anchor Pivot Pin (Pure white, exact same 9px size) */}
      <AnimatePresence>
        {fallState !== 'falling' && (
          <motion.button
            type="button"
            onClick={handleHingeClick}
            onTouchEnd={handleHingeClick}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute -top-[5px] -left-[6px] w-[9px] h-[9px] rounded-full bg-white z-30 cursor-pointer pointer-events-auto shadow-[0_0_10px_rgba(255,255,255,0.85)] active:scale-90 transition-transform"
            aria-label="Click hinge to break"
          >
            {/* Expanded click target */}
            <span className="absolute -inset-3.5 z-40" />
          </motion.button>
        )}
      </AnimatePresence>
    </span>
  );
}
