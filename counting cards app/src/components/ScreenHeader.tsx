import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  subtitle: string;
  backTo?: string;
}

export function ScreenHeader({ title, subtitle, backTo }: ScreenHeaderProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 className="font-serif text-2xl leading-none text-gold-soft">{title}</h1>
        <p className="mt-1.5 font-serif text-xs italic text-parch/50">{subtitle}</p>
      </div>
      {backTo &&
      <Link
        to={backTo}
        className="flex items-center gap-1.5 rounded-full bg-maroon-700 px-3 py-2 font-serif text-sm font-semibold text-gold-soft transition-colors hover:bg-maroon-600">
        
          <ArrowLeftIcon size={14} strokeWidth={2} aria-hidden="true" />
          Home
        </Link>
      }
    </div>);

}