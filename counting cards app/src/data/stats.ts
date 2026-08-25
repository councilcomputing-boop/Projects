import { SessionRecord } from '../types/blackjack';

export const weeklyAccuracy: {day: string;value: number;}[] = [
{ day: 'M', value: 72 },
{ day: 'T', value: 78 },
{ day: 'W', value: 69 },
{ day: 'T', value: 84 },
{ day: 'F', value: 91 },
{ day: 'S', value: 88 },
{ day: 'S', value: 94 }];


export const recentSessions: SessionRecord[] = [
{ id: 's-1', label: 'Speed Drill · 1 deck', accuracy: 94, cardsPerMinute: 118, date: 'Today, 21:40' },
{ id: 's-2', label: 'Speed Drill · 1 deck', accuracy: 88, cardsPerMinute: 104, date: 'Yesterday, 23:12' },
{ id: 's-3', label: 'Speed Drill · 2 decks', accuracy: 76, cardsPerMinute: 96, date: 'Tue, 22:05' },
{ id: 's-4', label: 'Speed Drill · 1 deck', accuracy: 91, cardsPerMinute: 112, date: 'Mon, 20:31' }];