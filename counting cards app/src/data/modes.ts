import { BookOpenIcon, DivideIcon, EyeIcon, HelpCircleIcon, LayersIcon, ZapIcon } from 'lucide-react';

export const gameModes = [
{ to: '/manual', label: 'Manual', meta: 'Count a real deck', Icon: LayersIcon },
{ to: '/peek', label: 'Classic / Peek', meta: 'Play hands, peek allowed', Icon: EyeIcon },
{ to: '/quiz', label: 'Quiz Practice', meta: 'Count stays hidden', Icon: HelpCircleIcon },
{ to: '/deck-math', label: 'Deck Math', meta: 'Running → true count', Icon: DivideIcon },
{ to: '/drill', label: 'Speed Drill', meta: 'Beat the clock', Icon: ZapIcon },
{ to: '/rules', label: 'Rules', meta: 'Learn the Hi-Lo system', Icon: BookOpenIcon }];