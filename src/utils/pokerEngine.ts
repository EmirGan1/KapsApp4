import { Card, Suit, Rank } from '../components/PlayingCard';
import { createStandardDeck, shuffleDeck } from './cardDeck';

export enum HandTier {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10,
}

export const TIER_NAMES_TR: Record<HandTier, string> = {
  [HandTier.ROYAL_FLUSH]: 'Royal Floş',
  [HandTier.STRAIGHT_FLUSH]: 'Sıralı Floş (Straight Flush)',
  [HandTier.FOUR_OF_A_KIND]: 'Kare (Four of a Kind)',
  [HandTier.FULL_HOUSE]: 'Full House',
  [HandTier.FLUSH]: 'Renk (Flush)',
  [HandTier.STRAIGHT]: 'Kent (Straight)',
  [HandTier.THREE_OF_A_KIND]: 'Üçlü (Set / Trips)',
  [HandTier.TWO_PAIR]: 'İki Per (Döper)',
  [HandTier.ONE_PAIR]: 'Per (One Pair)',
  [HandTier.HIGH_CARD]: 'Yüksek Kart (High Card)',
};

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const VALUE_TO_RANK_TR: Record<number, string> = {
  14: 'As',
  13: 'Papaz',
  12: 'Kız',
  11: 'Vale',
  10: "10'lu",
  9: "9'lu",
  8: "8'li",
  7: "7'li",
  6: "6'lı",
  5: "5'li",
  4: "4'lü",
  3: "3'lü",
  2: "2'li",
};

export interface HandEvaluation {
  tier: HandTier;
  tierNameTr: string;
  descriptionTr: string;
  tiebreakers: number[]; // Array of card values used to break ties (primary rank, secondary rank, kickers)
  best5Cards: Card[];
}

export type PokerStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';

export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface PokerPlayerSeat {
  id: string | number;
  userId?: number;
  name: string;
  avatar?: string | null;
  color?: string;
  chips: number;
  holeCards: Card[];
  currentBet: number; // Current street bet
  totalHandBet: number; // Entire hand bet
  folded: boolean;
  isAllIn: boolean;
  lastAction?: string | null;
  isBot: boolean;
  botPersonality?: 'pro' | 'shark' | 'aggressive' | 'bluffer' | 'conservative';
  seatIndex: number;
  evaluation?: HandEvaluation;
}

export interface PokerTableState {
  id: string;
  title: string;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  currentTurnSeatIndex: number;
  smallBlind: number;
  bigBlind: number;
  minBet: number;
  maxBet?: number;
  minBalance?: number;
  isPrivate?: boolean;
  pot: number;
  currentStreetHighestBet: number;
  minRaise: number;
  stage: PokerStage;
  communityCards: Card[];
  deck: Card[];
  seats: (PokerPlayerSeat | null)[];
  handNumber: number;
  winners: { seatIndex: number; name: string; amount: number; description: string; best5: Card[] }[] | null;
  isSplitPot: boolean;
}

/**
 * Evaluates exactly 5 cards according to standard Texas Hold'em hierarchy.
 */
export function evaluate5Cards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error('evaluate5Cards requires exactly 5 cards');
  }

  // Sort ranks descending
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const values = sorted.map((c) => RANK_VALUES[c.rank]);

  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  // Group frequency of ranks
  const freqMap: Record<number, number> = {};
  values.forEach((v) => {
    freqMap[v] = (freqMap[v] || 0) + 1;
  });

  const freqs = Object.entries(freqMap)
    .map(([val, count]) => ({ val: Number(val), count }))
    .sort((a, b) => b.count - a.count || b.val - a.val);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 5) {
    if (uniqueValues[0] - uniqueValues[4] === 4) {
      isStraight = true;
      straightHigh = uniqueValues[0];
    } else if (
      uniqueValues[0] === 14 &&
      uniqueValues[1] === 5 &&
      uniqueValues[2] === 4 &&
      uniqueValues[3] === 3 &&
      uniqueValues[4] === 2
    ) {
      // Wheel straight (A-2-3-4-5) - Ace counts as 1, 5 is the high card
      isStraight = true;
      straightHigh = 5;
    }
  }

  // 1. Royal Flush & Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        tier: HandTier.ROYAL_FLUSH,
        tierNameTr: TIER_NAMES_TR[HandTier.ROYAL_FLUSH],
        descriptionTr: 'Royal Floş (A-K-Q-J-10)',
        tiebreakers: [14],
        best5Cards: sorted,
      };
    }
    return {
      tier: HandTier.STRAIGHT_FLUSH,
      tierNameTr: TIER_NAMES_TR[HandTier.STRAIGHT_FLUSH],
      descriptionTr: `Sıralı Floş (${VALUE_TO_RANK_TR[straightHigh]} Yüksek)`,
      tiebreakers: [straightHigh],
      best5Cards: sorted,
    };
  }

  // 2. Four of a Kind (Kare)
  if (freqs[0].count === 4) {
    const quadVal = freqs[0].val;
    const kicker = freqs[1].val;
    return {
      tier: HandTier.FOUR_OF_A_KIND,
      tierNameTr: TIER_NAMES_TR[HandTier.FOUR_OF_A_KIND],
      descriptionTr: `Kare ${VALUE_TO_RANK_TR[quadVal]}lar`,
      tiebreakers: [quadVal, kicker],
      best5Cards: sorted,
    };
  }

  // 3. Full House
  if (freqs[0].count === 3 && freqs[1].count === 2) {
    const tripleVal = freqs[0].val;
    const pairVal = freqs[1].val;
    return {
      tier: HandTier.FULL_HOUSE,
      tierNameTr: TIER_NAMES_TR[HandTier.FULL_HOUSE],
      descriptionTr: `Full House (${VALUE_TO_RANK_TR[tripleVal]}lar ve ${VALUE_TO_RANK_TR[pairVal]}lar)`,
      tiebreakers: [tripleVal, pairVal],
      best5Cards: sorted,
    };
  }

  // 4. Flush (Renk)
  if (isFlush) {
    return {
      tier: HandTier.FLUSH,
      tierNameTr: TIER_NAMES_TR[HandTier.FLUSH],
      descriptionTr: `Renk / Flush (${VALUE_TO_RANK_TR[values[0]]} Yüksek)`,
      tiebreakers: values,
      best5Cards: sorted,
    };
  }

  // 5. Straight (Kent)
  if (isStraight) {
    return {
      tier: HandTier.STRAIGHT,
      tierNameTr: TIER_NAMES_TR[HandTier.STRAIGHT],
      descriptionTr: `Kent / Straight (${VALUE_TO_RANK_TR[straightHigh]} Yüksek)`,
      tiebreakers: [straightHigh],
      best5Cards: sorted,
    };
  }

  // 6. Three of a Kind (Üçlü / Set)
  if (freqs[0].count === 3) {
    const tripleVal = freqs[0].val;
    const kickers = freqs.slice(1).map((f) => f.val);
    return {
      tier: HandTier.THREE_OF_A_KIND,
      tierNameTr: TIER_NAMES_TR[HandTier.THREE_OF_A_KIND],
      descriptionTr: `Üçlü ${VALUE_TO_RANK_TR[tripleVal]}`,
      tiebreakers: [tripleVal, ...kickers],
      best5Cards: sorted,
    };
  }

  // 7. Two Pair (Döper)
  if (freqs[0].count === 2 && freqs[1].count === 2) {
    const highPair = Math.max(freqs[0].val, freqs[1].val);
    const lowPair = Math.min(freqs[0].val, freqs[1].val);
    const kicker = freqs[2].val;
    return {
      tier: HandTier.TWO_PAIR,
      tierNameTr: TIER_NAMES_TR[HandTier.TWO_PAIR],
      descriptionTr: `İki Per (${VALUE_TO_RANK_TR[highPair]} ve ${VALUE_TO_RANK_TR[lowPair]})`,
      tiebreakers: [highPair, lowPair, kicker],
      best5Cards: sorted,
    };
  }

  // 8. One Pair (Per)
  if (freqs[0].count === 2) {
    const pairVal = freqs[0].val;
    const kickers = freqs.slice(1).map((f) => f.val);
    return {
      tier: HandTier.ONE_PAIR,
      tierNameTr: TIER_NAMES_TR[HandTier.ONE_PAIR],
      descriptionTr: `Per (${VALUE_TO_RANK_TR[pairVal]}lar)`,
      tiebreakers: [pairVal, ...kickers],
      best5Cards: sorted,
    };
  }

  // 9. High Card (Yüksek Kart)
  return {
    tier: HandTier.HIGH_CARD,
    tierNameTr: TIER_NAMES_TR[HandTier.HIGH_CARD],
    descriptionTr: `Yüksek Kart (${VALUE_TO_RANK_TR[values[0]]})`,
    tiebreakers: values,
    best5Cards: sorted,
  };
}

/**
 * Compares two HandEvaluation objects.
 * Returns > 0 if A > B, < 0 if A < B, and 0 if strictly tied (Split Pot).
 */
export function compareHandEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  if (a.tier !== b.tier) {
    return a.tier - b.tier;
  }
  const maxLen = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = a.tiebreakers[i] ?? 0;
    const valB = b.tiebreakers[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return 0;
}

/**
 * Finds the absolute strongest 5-card combination from up to 7 cards (2 hole + 5 community).
 * Also works gracefully with 2, 3, 4, 5, 6 cards for live street strength feedback!
 */
export function evaluateBestHand(allCards: Card[]): HandEvaluation {
  if (!allCards || allCards.length === 0) {
    return {
      tier: HandTier.HIGH_CARD,
      tierNameTr: 'Kart Yok',
      descriptionTr: '-',
      tiebreakers: [0],
      best5Cards: [],
    };
  }

  // If fewer than 5 cards (e.g. Pre-Flop 2 cards or Flop with folded community)
  if (allCards.length < 5) {
    const sorted = [...allCards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
    const vals = sorted.map((c) => RANK_VALUES[c.rank]);

    if (allCards.length === 2 && vals[0] === vals[1]) {
      return {
        tier: HandTier.ONE_PAIR,
        tierNameTr: 'Cep Per (Pocket Pair)',
        descriptionTr: `Çift ${VALUE_TO_RANK_TR[vals[0]]}lar`,
        tiebreakers: [vals[0], vals[0]],
        best5Cards: sorted,
      };
    }

    if (allCards.length === 2 && allCards[0].suit === allCards[1].suit) {
      return {
        tier: HandTier.HIGH_CARD,
        tierNameTr: 'Aynı Renk (Suited)',
        descriptionTr: `${VALUE_TO_RANK_TR[vals[0]]}-${VALUE_TO_RANK_TR[vals[1]]} Aynı Renk`,
        tiebreakers: vals,
        best5Cards: sorted,
      };
    }

    return {
      tier: HandTier.HIGH_CARD,
      tierNameTr: 'Yüksek Kart',
      descriptionTr: `${VALUE_TO_RANK_TR[vals[0]]} Yüksek`,
      tiebreakers: vals,
      best5Cards: sorted,
    };
  }

  // Exactly 5 cards
  if (allCards.length === 5) {
    return evaluate5Cards(allCards);
  }

  // 6 or 7 cards: evaluate all C(n, 5) combinations to guarantee optimal hand
  let bestEval: HandEvaluation | null = null;
  const n = allCards.length;

  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const fiveCards = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
            const currentEval = evaluate5Cards(fiveCards);

            if (!bestEval || compareHandEvaluations(currentEval, bestEval) > 0) {
              bestEval = currentEval;
            }
          }
        }
      }
    }
  }

  return bestEval || evaluate5Cards(allCards.slice(0, 5));
}

/**
 * Calculates pre-flop Chen Formula score (0 - 20) for intelligent bot play
 */
export function calculateChenScore(c1: Card, c2: Card): number {
  const v1 = RANK_VALUES[c1.rank];
  const v2 = RANK_VALUES[c2.rank];
  const highVal = Math.max(v1, v2);
  const lowVal = Math.min(v1, v2);

  let score = 0;
  // High card points
  if (highVal === 14) score = 10;
  else if (highVal === 13) score = 8;
  else if (highVal === 12) score = 7;
  else if (highVal === 11) score = 6;
  else score = highVal / 2;

  // Pair multiplier
  if (v1 === v2) {
    score = Math.max(5, score * 2);
    if (v1 === 5) score = 6;
  }

  // Suited bonus
  if (c1.suit === c2.suit) {
    score += 2;
  }

  // Gap deductions
  const gap = highVal - lowVal - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

  // Connected bonus for low cards
  if (gap <= 1 && highVal < 12 && v1 !== v2) {
    score += 1;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Bot Decision Engine for Realistic No-Limit Texas Hold'em Action
 */
export function decideBotAction(
  seat: PokerPlayerSeat,
  communityCards: Card[],
  pot: number,
  currentHighestBet: number,
  bigBlind: number,
  minRaise: number,
  stage: PokerStage,
  activePlayersCount: number
): { action: PokerAction; amount: number; message: string } {
  const callCost = Math.max(0, currentHighestBet - seat.currentBet);
  const remainingChips = seat.chips;

  // If already all-in or cannot bet
  if (remainingChips <= 0) {
    return { action: 'check', amount: 0, message: 'All-In' };
  }

  // Pre-Flop Decision
  if (stage === 'preflop') {
    if (seat.holeCards.length < 2) {
      return { action: 'check', amount: 0, message: 'Kontrol' };
    }

    const chen = calculateChenScore(seat.holeCards[0], seat.holeCards[1]);
    const isFree = callCost === 0;

    // Monster Hands (AA, KK, QQ, AK suited): Chen >= 10
    if (chen >= 10) {
      const raiseAmt = Math.min(remainingChips, Math.max(minRaise, currentHighestBet + bigBlind * 3));
      if (Math.random() < 0.85 && raiseAmt > currentHighestBet) {
        return { action: 'raise', amount: raiseAmt, message: `Artırdı +${raiseAmt - currentHighestBet}` };
      }
      return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
    }

    // Strong Hands (JJ, TT, 99, AQ, AJ, KQ): Chen 7 - 9
    if (chen >= 7) {
      if (callCost <= bigBlind * 3) {
        if (Math.random() < 0.4 && remainingChips >= minRaise && callCost < bigBlind * 2) {
          const raiseAmt = Math.min(remainingChips, currentHighestBet + bigBlind * 2);
          return { action: 'raise', amount: raiseAmt, message: `Artırdı +${raiseAmt - currentHighestBet}` };
        }
        return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
      }
      if (isFree) return { action: 'check', amount: 0, message: 'Kontrol' };
      return { action: 'fold', amount: 0, message: 'Pas' };
    }

    // Playable / Speculative (Chen 5 - 6)
    if (chen >= 5) {
      if (isFree) return { action: 'check', amount: 0, message: 'Kontrol' };
      if (callCost <= bigBlind) {
        return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
      }
      return { action: 'fold', amount: 0, message: 'Pas' };
    }

    // Weak Hand (Chen < 5)
    if (isFree) {
      return { action: 'check', amount: 0, message: 'Kontrol' };
    }
    // Occasional bluff (6% chance)
    if (Math.random() < 0.06 && callCost <= bigBlind * 2 && remainingChips >= minRaise) {
      const raiseAmt = Math.min(remainingChips, currentHighestBet + bigBlind * 2);
      return { action: 'raise', amount: raiseAmt, message: `Artırdı +${raiseAmt - currentHighestBet}` };
    }
    return { action: 'fold', amount: 0, message: 'Pas' };
  }

  // Post-Flop, Turn, River Decision
  const allCards = [...seat.holeCards, ...communityCards];
  const evalResult = evaluateBestHand(allCards);
  const tier = evalResult.tier;
  const isFree = callCost === 0;

  // Monster (Straight or better: Tier >= 5)
  if (tier >= HandTier.STRAIGHT) {
    if (remainingChips > callCost && Math.random() < 0.75) {
      const sizing = Math.max(minRaise, Math.round(pot * (0.6 + Math.random() * 0.4)));
      const targetRaise = Math.min(remainingChips, currentHighestBet + sizing);
      if (targetRaise > currentHighestBet) {
        return { action: 'raise', amount: targetRaise, message: `Artırdı +${targetRaise - currentHighestBet}` };
      }
    }
    return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
  }

  // Very Strong (Three of a Kind or Two Pair: Tier 3 or 4)
  if (tier >= HandTier.TWO_PAIR) {
    if (isFree) {
      if (Math.random() < 0.65 && remainingChips >= minRaise) {
        const sizing = Math.max(minRaise, Math.round(pot * 0.5));
        const targetRaise = Math.min(remainingChips, currentHighestBet + sizing);
        return { action: 'raise', amount: targetRaise, message: `Artırdı +${targetRaise - currentHighestBet}` };
      }
      return { action: 'check', amount: 0, message: 'Kontrol' };
    }
    if (callCost <= pot * 0.75 || remainingChips <= callCost) {
      return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
    }
    return { action: 'fold', amount: 0, message: 'Pas' };
  }

  // Medium (One Pair: Tier 2)
  if (tier === HandTier.ONE_PAIR) {
    if (isFree) {
      if (Math.random() < 0.25 && remainingChips >= minRaise) {
        const targetRaise = Math.min(remainingChips, currentHighestBet + bigBlind * 2);
        return { action: 'raise', amount: targetRaise, message: `Artırdı +${targetRaise - currentHighestBet}` };
      }
      return { action: 'check', amount: 0, message: 'Kontrol' };
    }
    if (callCost <= pot * 0.35 || callCost <= bigBlind * 2) {
      return { action: 'call', amount: Math.min(remainingChips, callCost), message: 'Gördü' };
    }
    return { action: 'fold', amount: 0, message: 'Pas' };
  }

  // High Card (Tier 1)
  if (isFree) {
    return { action: 'check', amount: 0, message: 'Kontrol' };
  }

  // Bluff opportunity on Flop/Turn if pot is small
  if (stage !== 'river' && Math.random() < 0.12 && callCost <= bigBlind && remainingChips >= minRaise) {
    const targetRaise = Math.min(remainingChips, currentHighestBet + bigBlind * 2);
    return { action: 'raise', amount: targetRaise, message: `Artırdı +${targetRaise - currentHighestBet}` };
  }

  return { action: 'fold', amount: 0, message: 'Pas' };
}

export const BOT_PLAYERS_POOL = [
  { name: 'Barış (Shark)', avatar: null, color: '#3b82f6', personality: 'shark' as const },
  { name: 'Deniz (Pro)', avatar: null, color: '#10b981', personality: 'pro' as const },
  { name: 'Cemre (Agresif)', avatar: null, color: '#f59e0b', personality: 'aggressive' as const },
  { name: 'Can (Blöfçü)', avatar: null, color: '#ec4899', personality: 'bluffer' as const },
  { name: 'Efe (Temkinli)', avatar: null, color: '#8b5cf6', personality: 'conservative' as const },
  { name: 'Zeynep (VIP)', avatar: null, color: '#06b6d4', personality: 'pro' as const },
];
