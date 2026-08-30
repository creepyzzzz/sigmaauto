'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ScriptAction {
  type: 'type' | 'delete' | 'pause';
  text?: string;
  count?: number;
  duration?: number;
}

interface Scenario {
  actions: ScriptAction[];
}

const SCENARIOS: Scenario[] = [
  {
    actions: [
      { type: 'type', text: 'https://lksfy.co' },
      { type: 'type', text: 'n' }, // typo
      { type: 'pause', duration: 320 },
      { type: 'delete', count: 1 }, // fix 'n'
      { type: 'pause', duration: 180 },
      { type: 'type', text: 'm/' },
      { type: 'type', text: 'verify_tokne' }, // typo
      { type: 'pause', duration: 380 },
      { type: 'delete', count: 2 }, // delete 'ne'
      { type: 'pause', duration: 200 },
      { type: 'type', text: 'en_78941' },
      { type: 'pause', duration: 2600 },
      { type: 'delete', count: 40 }, // backspace all
      { type: 'pause', duration: 400 },
    ],
  },
  {
    actions: [
      { type: 'type', text: 'https://nano' },
      { type: 'type', text: 'linx' }, // typo
      { type: 'pause', duration: 300 },
      { type: 'delete', count: 1 }, // fix 'x'
      { type: 'pause', duration: 160 },
      { type: 'type', text: 'ks.in/direct-pass' },
      { type: 'pause', duration: 2400 },
      { type: 'delete', count: 35 },
      { type: 'pause', duration: 400 },
    ],
  },
  {
    actions: [
      { type: 'type', text: 'https://t.me/sigma' },
      { type: 'type', text: '_bot' }, // hesitated
      { type: 'pause', duration: 340 },
      { type: 'delete', count: 3 }, // delete 'bot'
      { type: 'pause', duration: 200 },
      { type: 'type', text: 'keygen_bot?start=key_9021' },
      { type: 'pause', duration: 2800 },
      { type: 'delete', count: 45 },
      { type: 'pause', duration: 400 },
    ],
  },
];

interface HumanTypingPlaceholderProps {
  isFocused?: boolean;
}

export default function HumanTypingPlaceholder({ isFocused = false }: HumanTypingPlaceholderProps) {
  const [displayText, setDisplayText] = useState('');
  const stateRef = useRef({
    scenarioIdx: 0,
    actionIdx: 0,
    charIdx: 0,
    isMounted: true,
  });

  useEffect(() => {
    stateRef.current.isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const getHumanKeystrokeDelay = (isDeleting = false) => {
      if (isDeleting) {
        // Fast backspacing with realistic jitter (35ms - 65ms)
        return Math.floor(Math.random() * 30) + 35;
      }
      // Natural typing cadence (45ms - 110ms with occasional slight hesitations)
      const base = Math.floor(Math.random() * 65) + 45;
      return Math.random() < 0.12 ? base + 120 : base;
    };

    const step = () => {
      if (!stateRef.current.isMounted) return;

      const currentScenario = SCENARIOS[stateRef.current.scenarioIdx];
      const action = currentScenario.actions[stateRef.current.actionIdx];

      if (!action) {
        // Cycle to next scenario
        stateRef.current.scenarioIdx = (stateRef.current.scenarioIdx + 1) % SCENARIOS.length;
        stateRef.current.actionIdx = 0;
        stateRef.current.charIdx = 0;
        timeoutId = setTimeout(step, 400);
        return;
      }

      if (action.type === 'type') {
        const fullText = action.text || '';
        if (stateRef.current.charIdx < fullText.length) {
          const nextChar = fullText[stateRef.current.charIdx];
          setDisplayText((prev) => prev + nextChar);
          stateRef.current.charIdx++;
          timeoutId = setTimeout(step, getHumanKeystrokeDelay(false));
        } else {
          // Finished this typing segment
          stateRef.current.actionIdx++;
          stateRef.current.charIdx = 0;
          timeoutId = setTimeout(step, 80);
        }
      } else if (action.type === 'delete') {
        const count = action.count || 1;
        if (stateRef.current.charIdx < count) {
          setDisplayText((prev) => prev.slice(0, -1));
          stateRef.current.charIdx++;
          timeoutId = setTimeout(step, getHumanKeystrokeDelay(true));
        } else {
          // Finished deleting segment
          stateRef.current.actionIdx++;
          stateRef.current.charIdx = 0;
          timeoutId = setTimeout(step, 100);
        }
      } else if (action.type === 'pause') {
        stateRef.current.actionIdx++;
        stateRef.current.charIdx = 0;
        timeoutId = setTimeout(step, action.duration || 300);
      }
    };

    timeoutId = setTimeout(step, 600);

    return () => {
      stateRef.current.isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  if (isFocused && displayText === '') {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-y-0 left-1 flex items-center overflow-hidden pr-2 select-none">
      <span className="text-xs sm:text-base text-sky-200/70 truncate font-normal tracking-normal flex items-center">
        {displayText}
        {/* iOS-style glowing smooth vertical caret indicator */}
        <span 
          className="inline-block w-[1.5px] sm:w-[2px] h-[14px] sm:h-[18px] bg-sky-200/90 ml-[1.5px] rounded-full animate-pulse align-middle shadow-[0_0_8px_rgba(186,230,253,0.8)]"
        />
      </span>
    </div>
  );
}
