export const ACTIVITY_NAMES = {
  okey: 'Okey', okey101: '101 Okey', uno: 'UNO', drawguess: 'Çiz ve Bil',
  blackjack: 'Blackjack', batak: 'Batak', poker: 'Poker', battleroyale: 'Battle Royale',
  party: 'Party Mode', billiards: 'Bilardo', kapstorial: 'Kapstorial',
  dungeon: 'Dungeon', kapsstrike: 'KapsStrike', 'gece-nobeti': 'Gece Nöbeti',
  'ayvalik-games': 'Ayvalık Gezi Oyunları', 'ayvalik-rooms': 'Ayvalık Oda Seçimi',
} as const;

export type Activity = keyof typeof ACTIVITY_NAMES;
export type ActivityInvite = { id: string; activity: Activity; sender: string; room?: string; roomName?: string };
export function isActivity(value: unknown): value is Activity {
  return typeof value === 'string' && Object.hasOwn(ACTIVITY_NAMES, value);
}
