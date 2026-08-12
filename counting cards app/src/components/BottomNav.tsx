import { NavLink } from 'react-router-dom';
import { HomeIcon, LayoutGridIcon, UserIcon, WalletIcon } from 'lucide-react';

const items = [
{ to: '/', label: 'Home', Icon: HomeIcon },
{ to: '/store', label: 'Store', Icon: WalletIcon },
{ to: '/card-backs', label: 'Backs', Icon: LayoutGridIcon },
{ to: '/profile', label: 'Profile', Icon: UserIcon }];


export function BottomNav() {
  return (
    <nav aria-label="Primary" className="border-t border-maroon-600/70 bg-maroon-800 px-4">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, Icon }) =>
        <li key={to}>
            <NavLink
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
            `flex flex-col items-center gap-1.5 py-3.5 font-serif text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
            isActive ? 'text-gold' : 'text-parch/50 hover:text-parch/80'}`

            }>
            
              {({ isActive }) =>
            <>
                  <Icon size={20} strokeWidth={1.75} className={isActive ? 'text-blood' : ''} aria-hidden="true" />
                  {label}
                </>
            }
            </NavLink>
          </li>
        )}
      </ul>
    </nav>);

}