import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BloodDrop } from './BloodDrop';

interface FlyEvent {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// Module-level pub/sub so any component (bet placed, hand resolved) can trigger a fly
// animation between two screen positions without prop-drilling refs through the tree --
// FlyingDropsLayer (mounted once near the app root) is the sole subscriber.
type Listener = (e: FlyEvent) => void;
let listeners: Listener[] = [];
let nextId = 1;

/** Sends `count` blood-drop icons flying from the center of `from` to the center of
    `to` (viewport-relative DOMRects, e.g. from element.getBoundingClientRect()),
    staggered slightly so they read as a small stream rather than one dot. */
export function emitDropsFly(from: DOMRect, to: DOMRect, count = 3) {
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      const e: FlyEvent = { id: nextId++, fromX, fromY, toX, toY };
      listeners.forEach((l) => l(e));
    }, i * 70);
  }
}

/** Renders whatever flying-drop events are currently in flight. Mount once, near the
    app root, so it can animate across the whole viewport regardless of which page (or
    which element within it) triggered the fly. */
export function FlyingDropsLayer() {
  const [events, setEvents] = useState<FlyEvent[]>([]);

  useEffect(() => {
    const listener: Listener = (e) => {
      setEvents((prev) => [...prev, e]);
      window.setTimeout(() => setEvents((prev) => prev.filter((x) => x.id !== e.id)), 650);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      <AnimatePresence>
        {events.map((e) =>
        <motion.span
          key={e.id}
          className="absolute text-blood"
          style={{ marginLeft: -8, marginTop: -8 }}
          initial={{ left: e.fromX, top: e.fromY, opacity: 1, scale: 1 }}
          animate={{ left: e.toX, top: e.toY, opacity: [1, 1, 0], scale: [1, 1.15, 0.6] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.3, 0.6, 0.3, 1] }}>

            <BloodDrop className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </div>);

}
