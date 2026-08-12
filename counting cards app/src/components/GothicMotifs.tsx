import React from 'react';

interface MotifProps {
  className?: string;
}

export function BatMark({ className = '' }: MotifProps) {
  return (
    <svg viewBox="0 0 48 20" aria-hidden="true" className={className} fill="currentColor">
      <path d="M24 3.2c1.3 0 2.2 1 2.6 2.3.9-.7 1.9-1.2 3-1.2-.4.9-.5 1.8-.3 2.6 2.3-2.2 5.4-3.6 8.9-4.4-1 1.3-1.5 2.6-1.5 3.9 2.6-1.1 5.4-1.3 8.3-.7-2.3 1-4 2.3-5.3 3.9-1.6 2-3.7 3.2-6.3 3.6-2 .3-3.6 1.2-4.9 2.7L24 19l-4.5-3.1c-1.3-1.5-2.9-2.4-4.9-2.7-2.6-.4-4.7-1.6-6.3-3.6C7 8 5.3 6.7 3 5.7c2.9-.6 5.7-.4 8.3.7 0-1.3-.5-2.6-1.5-3.9 3.5.8 6.6 2.2 8.9 4.4.2-.8.1-1.7-.3-2.6 1.1 0 2.1.5 3 1.2.4-1.3 1.3-2.3 2.6-2.3z" />
    </svg>);

}

export function OrnateDivider({ className = '', tone = 'dark' }: MotifProps & {tone?: 'dark' | 'light';}) {
  const line = tone === 'dark' ? 'to-gold/30' : 'to-gold-deep/40';
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className={`h-px flex-1 bg-gradient-to-r from-transparent ${line}`} />
      <span className="h-1.5 w-1.5 rotate-45 border border-gold" />
      <span className={`h-px flex-1 bg-gradient-to-l from-transparent ${line}`} />
    </div>);

}