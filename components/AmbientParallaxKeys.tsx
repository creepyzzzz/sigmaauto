'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function AmbientParallaxKeys() {
  // Localized proximity motion values for Left & Right keys
  const leftStrength = useMotionValue(0);
  const leftTiltXVal = useMotionValue(0);
  const leftTiltYVal = useMotionValue(0);

  const rightStrength = useMotionValue(0);
  const rightTiltXVal = useMotionValue(0);
  const rightTiltYVal = useMotionValue(0);

  // Responsive spring configs for natural inertia
  const springConfig = { damping: 28, stiffness: 85, mass: 0.9 };
  const smoothLeft = useSpring(leftStrength, springConfig);
  const smoothLeftTiltX = useSpring(leftTiltXVal, springConfig);
  const smoothLeftTiltY = useSpring(leftTiltYVal, springConfig);

  const smoothRight = useSpring(rightStrength, springConfig);
  const smoothRightTiltX = useSpring(rightTiltXVal, springConfig);
  const smoothRightTiltY = useSpring(rightTiltYVal, springConfig);

  // Left Key Transforms (Only active when cursor is on the left half of the screen)
  const leftX = useTransform(smoothLeft, [0, 1], [0, -32]);
  const leftY = useTransform(smoothLeft, [0, 1], [0, -22]);
  const leftRotate = useTransform(smoothLeft, [0, 1], [-45, -35]);
  const leftTiltX = useTransform(smoothLeftTiltX, [-1, 1], [14, -14]);
  const leftTiltY = useTransform(smoothLeftTiltY, [-1, 1], [-14, 14]);

  // Right Key Transforms (Only active when cursor is on the right half of the screen)
  const rightX = useTransform(smoothRight, [0, 1], [0, 34]);
  const rightY = useTransform(smoothRight, [0, 1], [0, -24]);
  const rightRotate = useTransform(smoothRight, [0, 1], [-115, -100]);
  const rightTiltX = useTransform(smoothRightTiltX, [-1, 1], [14, -14]);
  const rightTiltY = useTransform(smoothRightTiltY, [-1, 1], [14, -14]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // Bottom-Left key anchor position roughly (0, innerHeight)
      const leftDistX = mouseX;
      const leftDistY = innerHeight - mouseY;
      const leftRadius = Math.hypot(leftDistX, leftDistY);
      const maxRadius = Math.max(innerWidth * 0.65, 500);

      // Proximity intensity (1 at close distance, 0 when far away)
      const leftFactor = Math.max(0, 1 - leftRadius / maxRadius);
      leftStrength.set(Math.pow(leftFactor, 1.5));
      leftTiltXVal.set(leftFactor * ((mouseY / innerHeight) * 2 - 1));
      leftTiltYVal.set(leftFactor * ((mouseX / (innerWidth * 0.5)) * 2 - 1));

      // Bottom-Right key anchor position roughly (innerWidth, innerHeight)
      const rightDistX = innerWidth - mouseX;
      const rightDistY = innerHeight - mouseY;
      const rightRadius = Math.hypot(rightDistX, rightDistY);

      const rightFactor = Math.max(0, 1 - rightRadius / maxRadius);
      rightStrength.set(Math.pow(rightFactor, 1.5));
      rightTiltXVal.set(rightFactor * ((mouseY / innerHeight) * 2 - 1));
      rightTiltYVal.set(rightFactor * (((mouseX - innerWidth * 0.5) / (innerWidth * 0.5)) * 2 - 1));
    };

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const normGamma = Math.max(-1, Math.min(1, e.gamma / 35));
        if (normGamma < 0) {
          leftStrength.set(Math.abs(normGamma));
          rightStrength.set(0);
        } else {
          rightStrength.set(normGamma);
          leftStrength.set(0);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [leftStrength, rightStrength, leftTiltXVal, leftTiltYVal, rightTiltXVal, rightTiltYVal]);

  return (
    <>
      {/* Bottom-Left Ambient Key with Proximity-Based 3D Physics */}
      <motion.div
        style={{
          x: leftX,
          y: leftY,
          rotate: leftRotate,
          rotateX: leftTiltX,
          rotateY: leftTiltY,
          transformPerspective: 1000,
        }}
        className="pointer-events-none absolute -bottom-6 -left-6 w-48 sm:w-80 lg:w-[360px] aspect-square opacity-70 sm:opacity-75 select-none z-0 blur-[6px] sm:blur-[9px] drop-shadow-[0_0_45px_rgba(56,189,248,0.65)] will-change-transform"
      >
        <img src="/images/key.webp" alt="" className="w-full h-full object-contain" />
      </motion.div>

      {/* Bottom-Right Ambient Key with Proximity-Based 3D Physics */}
      <motion.div
        style={{
          x: rightX,
          y: rightY,
          rotate: rightRotate,
          rotateX: rightTiltX,
          rotateY: rightTiltY,
          transformPerspective: 1000,
        }}
        className="pointer-events-none absolute -bottom-8 -right-8 w-52 sm:w-88 lg:w-[400px] aspect-square opacity-70 sm:opacity-75 select-none z-0 blur-[6px] sm:blur-[9px] drop-shadow-[0_0_45px_rgba(56,189,248,0.65)] will-change-transform"
      >
        <img src="/images/key.webp" alt="" className="w-full h-full object-contain" />
      </motion.div>
    </>
  );
}
