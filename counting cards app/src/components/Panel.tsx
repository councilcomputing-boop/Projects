import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
  label?: string;
  ariaLabel?: string;
}

export function Panel({ children, className = '', as = 'section', label, ariaLabel }: PanelProps) {
  const Tag = as;
  return (
    <Tag aria-label={ariaLabel ?? label} className={`rounded-2xl bg-parch p-5 text-charcoal shadow-panel ${className}`}>
      {label && <PanelLabel>{label}</PanelLabel>}
      {children}
    </Tag>);

}

export function PanelLabel({ children }: {children: React.ReactNode;}) {
  return (
    <h2 className="mb-4 font-serif text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">{children}</h2>);

}