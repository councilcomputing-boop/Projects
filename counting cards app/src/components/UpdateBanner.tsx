import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Replaces the live app's hand-rolled raw-HTML-diff polling update checker, which
 * stopped being viable once the app has a real (Vite/hashed) build — most deploys now
 * only change hashed JS/CSS bundle filenames, not index.html itself, so diffing the page
 * text would silently stop catching most real updates. This ties into the actual service
 * worker update lifecycle instead, which is strictly more correct.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-maroon-900 px-4 py-2.5 text-parch shadow-lg">
      <span className="text-xs font-semibold">A new version is available.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-maroon-900">
          Reload
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-parch/70">
          Dismiss
        </button>
      </div>
    </div>);

}
