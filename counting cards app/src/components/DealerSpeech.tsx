import React from 'react';

export const DEALER_PORTRAIT_URL = "/2f2a54be-5634-4360-9649-d2f3b5747e1e.jpg";


interface DealerSpeechProps {
  message: string;
  tone?: 'neutral' | 'good' | 'bad';
}

/** Large dealer portrait plus his hint bubble, sized for the table's side rail. */
export function DealerSpeech({ message, tone = 'neutral' }: DealerSpeechProps) {
  const toneClass =
  tone === 'good' ?
  'text-felt ring-felt/50' :
  tone === 'bad' ?
  'text-blood-deep ring-blood-deep/40' :
  'text-charcoal ring-parch-line';

  return (
    <div className="flex flex-col">
      <img
        src={DEALER_PORTRAIT_URL}
        alt="Count Dracula, the dealer"
        className="aspect-square w-full rounded-xl object-cover ring-1 ring-gold/50" />
      
      <p
        className={`mt-2 flex min-h-[72px] items-center rounded-lg bg-white px-2 py-2 text-center font-serif text-[11px] font-semibold leading-snug ring-1 ${toneClass}`}>
        
        {message}
      </p>
    </div>);

}