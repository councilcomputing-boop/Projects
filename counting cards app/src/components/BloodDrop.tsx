import React from 'react';

export function BloodDrop({ className = '' }: {className?: string;}) {
  return (
    <svg viewBox="0 0 16 20" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0c3.4 4.4 8 8.1 8 12a8 8 0 1 1-16 0C0 8.1 4.6 4.4 8 0z" />
    </svg>);

}