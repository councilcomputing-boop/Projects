import { useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { FlyingDropsLayer } from './FlyingDrops';
import { useDrops } from '../contexts/DropsContext';

interface PhoneShellProps {
  children: React.ReactNode;
}

/** The tab bar only belongs to the four top-level destinations, plus Rules. */
const NAV_ROUTES = ['/', '/store', '/card-backs', '/profile', '/rules'];

export function PhoneShell({ children }: PhoneShellProps) {
  const { pathname } = useLocation();
  const showNav = NAV_ROUTES.includes(pathname);
  const { drops } = useDrops();

  return (
    <div className="card-field flex h-full w-full justify-center bg-ink">
      <div className="flex h-full w-full max-w-[420px] flex-col overflow-hidden bg-ink-800/90 shadow-panel">
        <AppHeader drops={drops.toLocaleString()} />
        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</main>
        {showNav && <BottomNav />}
      </div>
      <FlyingDropsLayer />
    </div>);

}