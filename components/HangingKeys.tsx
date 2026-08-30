'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function HangingKeys() {
  const [isHanging, setIsHanging] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const triggerFallWithAutoRaise = () => {
    setIsHanging(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Auto-raise back up after 2.8 seconds
    timerRef.current = setTimeout(() => {
      setIsHanging(false);
    }, 2800);
  };

  const handleMouseEnter = () => {
    // Only trigger hover on non-touch devices
    if (window.matchMedia('(hover: hover)').matches) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(true);
    }
  };

  const handleMouseLeave = () => {
    // Only handle mouse leave on non-touch devices
    if (window.matchMedia('(hover: hover)').matches) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(false);
    }
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isHanging) {
      // If already hanging, click raises it back immediately
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsHanging(false);
    } else {
      triggerFallWithAutoRaise();
    }
  };

  return (
    <span 
      className="relative inline-block select-none cursor-pointer group align-baseline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onTouchEnd={handleClick}
    >
      {/* Invisible expanded hit area so hovering/tapping remains active during the swinging motion */}
      <span className="absolute -inset-x-6 -inset-y-8 z-0 pointer-events-auto" />

      {/* Motion Box hinged at Top-Left (0% 0%) Wall Anchor with 10deg default tilt */}
      <motion.span
        className="relative inline-block px-1.5 py-0 z-10 selection-box-wrap"
        initial={{ rotate: 10 }}
        animate={{ 
          rotate: isHanging ? 70 : 10,
          y: isHanging ? 3 : 0,
        }}
        transition={
          isHanging
            ? {
                // Realistic Damped Pendulum Swing Physics
                type: 'spring',
                stiffness: 75,
                damping: 5.2,
                mass: 1.4,
                restDelta: 0.001,
              }
            : {
                // Return Spring (Snappy restoration to 10deg resting tilt)
                type: 'spring',
                stiffness: 180,
                damping: 15,
                mass: 0.9,
              }
        }
        style={{
          transformOrigin: '0% 0%',
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

        {/* Top-Right Loose Pin (Falls along with box) */}
        <span className={`absolute -top-[5px] -right-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none transition-opacity duration-150 ${isHanging ? 'opacity-50' : 'opacity-100'}`} />

        {/* Bottom-Right Handle Pin (Swings with box) */}
        <span className="absolute -bottom-[5px] -right-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none" />

        {/* Bottom-Left Handle Pin (Swings with box) */}
        <span className="absolute -bottom-[5px] -left-[6px] w-[9px] h-[9px] rounded-full bg-white pointer-events-none" />

        {/* The Text 'keys' */}
        <span className="relative z-10 text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-bold tracking-tight text-white drop-shadow-sm inline-block">
          keys
        </span>
      </motion.span>

      {/* Fixed Wall Anchor Pivot Pin (Top-Left Nail that stays on the wall) */}
      <span 
        className="absolute -top-[5px] -left-[6px] w-[10px] h-[10px] rounded-full bg-white pointer-events-none z-30 shadow-[0_0_10px_rgba(255,255,255,0.8)]" 
      />
    </span>
  );
}
