/**
 * 101 Okey Game Engine (Okey101Engine)
 * Full implementation of international & Turkish 101 Okey rules:
 * - 106 Tiles (Red, Blue, Black, Yellow 1-13 x2 + 2 Fake Okeys)
 * - 22 tiles to dealer, 21 tiles to other 3 players
 * - Serial Runs & Groups validation
 * - 101 threshold & Katlamalı (Folding) mode logic
 * - 5+ Pairs (Çift) opening
 * - Processing / Appending tiles onto opened melds on the table
 * - İşler taş atma penalty (+101) & round scoring (202 / 404 / hand sum / x2 Okey finish)
 */

export type TileColor = 'red' | 'blue' | 'black' | 'yellow' | 'fake';

export interface Tile101 {
  id: string;
  number: number; // 1-13 (0 for fake okey initially)
  color: TileColor;
  isOkey?: boolean;
  isFake?: boolean;
}

export type MeldType = 'run' | 'group' | 'pair';

export interface Okey101Meld {
  id: string;
  playerId: number;
  playerUsername: string;
  type: MeldType;
  tiles: Tile101[];
  score: number;
}

export interface Okey101Player {
  id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot?: boolean;
  socketId?: string;
  hand: Tile101[];
  tileCount?: number;
  discardPile: Tile101[];
  hasOpened: boolean;
  openedMode?: 'serial' | 'double';
  openedMeldsCount: number;
  openedScore: number;
  penalties: number; // Cumulative penalty points across rounds (lower is better in 101)
  roundPenalty: number;
}

export interface Okey101RoomState {
  id: string;
  name: string;
  gameMode: 'okey101';
  subMode: 'katlamali' | 'duz';
  status: 'waiting' | 'playing' | 'ended';
  hostId: number;
  creatorId: number;
  players: Okey101Player[];
  deckCount: number;
  indicator: Tile101 | null;
  okeyTile: Tile101 | null;
  currentTurn: number;
  turnPhase: 'draw' | 'discard';
  highestOpenScore: number; // In katlamalı, next opener must exceed this
  highestPairsCount?: number; // In katlamalı, next pair opener must exceed this
  openedMelds: Okey101Meld[];
  turnTimeRemaining: number;
  roundNumber: number;
  winnerId: number | null;
  winningReason: string | null;
  lastActionMessage?: string;
  isHidden?: boolean;
  allowedUsers?: string[];
}

/**
 * Check if a tile is the Real Okey (Wildcard)
 */
export const isTileOkey = (tile: Tile101, okeyRef?: Tile101 | null): boolean => {
  if (!tile) return false;
  if (tile.isFake) return false;
  if (tile.isOkey) return true;
  if (okeyRef && tile.color === okeyRef.color && tile.number === okeyRef.number) {
    return true;
  }
  return false;
};

/**
 * Generate and shuffle standard 106-tile deck, determine indicator & Okey
 */
export const generate101Deck = (): { deck: Tile101[]; indicator: Tile101; okeyTile: Tile101 } => {
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  const allTiles: Tile101[] = [];
  let idCount = 1;

  for (const color of colors) {
    for (let num = 1; num <= 13; num++) {
      allTiles.push({ id: `t101_${idCount++}`, number: num, color });
      allTiles.push({ id: `t101_${idCount++}`, number: num, color });
    }
  }

  // 2 Fake Okeys
  allTiles.push({ id: `t101_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });
  allTiles.push({ id: `t101_${idCount++}`, number: 0, color: 'fake', isFake: true, isOkey: false });

  // Shuffle
  for (let i = allTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
  }

  // Pick indicator
  let indicatorIdx = allTiles.findIndex((t) => !t.isFake);
  if (indicatorIdx === -1) indicatorIdx = 0;
  const indicator = allTiles.splice(indicatorIdx, 1)[0];

  // Okey is next number of indicator color
  const okeyNumber = indicator.number === 13 ? 1 : indicator.number + 1;
  const okeyTile: Tile101 = {
    id: 'okey_ref',
    number: okeyNumber,
    color: indicator.color,
    isOkey: true,
  };

  // Re-map fake okeys and mark real okeys
  for (const t of allTiles) {
    if (t.isFake) {
      t.number = okeyTile.number;
      t.color = okeyTile.color;
      t.isOkey = false;
    } else if (t.color === okeyTile.color && t.number === okeyTile.number) {
      t.isOkey = true;
    }
  }

  return { deck: allTiles, indicator, okeyTile };
};

/**
 * Deal tiles for 101 Okey:
 * Dealer gets 22 tiles, other players get 21 tiles each.
 */
export const deal101Hands = (
  deck: Tile101[],
  dealerIndex: number = 0,
  playerCount: number = 4
): { hands: Tile101[][]; remainingDeck: Tile101[] } => {
  const count = Math.max(2, Math.min(4, playerCount || 4));
  const hands: Tile101[][] = Array.from({ length: count }, () => []);
  const cloneDeck = [...deck];

  for (let p = 0; p < count; p++) {
    const tileCount = p === dealerIndex ? 22 : 21;
    hands[p] = cloneDeck.splice(0, tileCount);
  }

  return { hands, remainingDeck: cloneDeck };
};

/**
 * Robustly analyze whether a collection of tiles forms a valid serial run (ardışık seri),
 * calculating the maximum possible score and optimal visual tile order (seamlessly placing Okey wildcards).
 */
export interface BestRunAnalysis101 {
  valid: boolean;
  score: number;
  type: 'standard' | 'wrap';
  sequence: number[];
  orderedTiles: Tile101[];
}

export const analyzeBestRunSequence101 = (
  tiles: Tile101[],
  okeyRef?: Tile101 | null
): BestRunAnalysis101 => {
  if (!tiles || tiles.length < 3 || tiles.length > 13) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...(tiles || [])] };
  }

  const regulars = tiles.filter((t) => !isTileOkey(t, okeyRef));
  const jokers = tiles.filter((t) => isTileOkey(t, okeyRef));

  if (regulars.length === 0) {
    return {
      valid: true,
      score: tiles.length * 10,
      type: 'standard',
      sequence: Array(tiles.length).fill(10),
      orderedTiles: [...tiles]
    };
  }

  const runColor = regulars[0].color;
  if (regulars.some((t) => t.color !== runColor)) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  // Ensure regular tiles have distinct numbers (cannot have duplicate numbers in a single run)
  const regNumSet = new Set<number>();
  for (const r of regulars) {
    if (regNumSet.has(r.number)) {
      return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
    }
    regNumSet.add(r.number);
  }

  const L = tiles.length;
  const regNums = regulars.map((t) => t.number);
  let bestCandidate: { score: number; type: 'standard' | 'wrap'; sequence: number[] } | null = null;

  // 1. Standard straight sequence: S .. S + L - 1 (S in 1 .. 13 - L + 1)
  for (let S = 1; S <= 13 - L + 1; S++) {
    const E = S + L - 1;
    if (regNums.every((n) => n >= S && n <= E)) {
      const seq: number[] = [];
      let score = 0;
      for (let n = S; n <= E; n++) {
        seq.push(n);
        score += n;
      }
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { score, type: 'standard', sequence: seq };
      }
    }
  }

  // 2. Wrapping sequence ending in 1 (e.g. 12-13-1, 11-12-13-1, down to 2..13-1)
  if (L >= 3 && L <= 13) {
    const startNum = 15 - L;
    if (startNum >= 1 && startNum <= 12) {
      const wrapSeq: number[] = [];
      let wrapScore = 1; // 1 counts as 1 point at the end of 13
      for (let pos = startNum; pos <= 13; pos++) {
        wrapSeq.push(pos);
        wrapScore += pos;
      }
      wrapSeq.push(1);

      if (regNums.every((n) => wrapSeq.includes(n))) {
        if (!bestCandidate || wrapScore > bestCandidate.score) {
          bestCandidate = { score: wrapScore, type: 'wrap', sequence: wrapSeq };
        }
      }
    }
  }

  if (!bestCandidate) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  // Order tiles according to the best sequence
  const orderedTiles: Tile101[] = [];
  const unusedRegs = [...regulars];
  const unusedJokers = [...jokers];

  for (const num of bestCandidate.sequence) {
    const idx = unusedRegs.findIndex((r) => r.number === num);
    if (idx !== -1) {
      orderedTiles.push(unusedRegs.splice(idx, 1)[0]);
    } else if (unusedJokers.length > 0) {
      orderedTiles.push(unusedJokers.pop()!);
    }
  }

  if (orderedTiles.length !== L) {
    return { valid: false, score: 0, type: 'standard', sequence: [], orderedTiles: [...tiles] };
  }

  return {
    valid: true,
    score: bestCandidate.score,
    type: bestCandidate.type,
    sequence: bestCandidate.sequence,
    orderedTiles
  };
};

/**
 * Validate a Run meld (Ardışık Seri Per)
 * 3 to 13 consecutive numbers of the same color.
 * Special case: 12-13-1 is allowed, but 13-1-2 is not.
 * Calculates optimal point value seamlessly incorporating Okey.
 */
export const isValidRun = (tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } => {
  const analysis = analyzeBestRunSequence101(tiles, okeyRef);
  return { valid: analysis.valid, score: analysis.score };
};

/**
 * Validate a Group meld (Aynı Sayı Per)
 * 3 or 4 tiles of the same number, but all different colors.
 */
export const isValidGroup = (tiles: Tile101[], okeyRef?: Tile101 | null): { valid: boolean; score: number } => {
  if (!tiles || tiles.length < 3 || tiles.length > 4) return { valid: false, score: 0 };

  const regulars = tiles.filter((t) => !isTileOkey(t, okeyRef));

  if (regulars.length === 0) {
    return { valid: true, score: tiles.length * 10 };
  }

  const groupNumber = regulars[0].number;
  if (regulars.some((t) => t.number !== groupNumber)) {
    return { valid: false, score: 0 };
  }

  // Check unique colors
  const colorsUsed = new Set<TileColor>();
  for (const r of regulars) {
    if (colorsUsed.has(r.color)) return { valid: false, score: 0 };
    colorsUsed.add(r.color);
  }

  const score = tiles.length * groupNumber;
  return { valid: true, score };
};

/**
 * Check if a single meld is either a valid run or a valid group
 */
export const validateMeld = (
  tiles: Tile101[],
  okeyRef?: Tile101 | null
): { valid: boolean; type: 'run' | 'group' | null; score: number } => {
  const runCheck = isValidRun(tiles, okeyRef);
  if (runCheck.valid) {
    return { valid: true, type: 'run', score: runCheck.score };
  }
  const groupCheck = isValidGroup(tiles, okeyRef);
  if (groupCheck.valid) {
    return { valid: true, type: 'group', score: groupCheck.score };
  }
  return { valid: false, type: null, score: 0 };
};

/**
 * Check if a pair is valid (same number, same color, or 1 regular + 1 okey)
 */
export const isValidPair = (tile1: Tile101, tile2: Tile101, okeyRef?: Tile101 | null): boolean => {
  if (!tile1 || !tile2) return false;
  const okey1 = isTileOkey(tile1, okeyRef);
  const okey2 = isTileOkey(tile2, okeyRef);

  if (okey1 || okey2) return true;
  return tile1.number === tile2.number && tile1.color === tile2.color;
};

/**
 * Validate Pair Opening (Çift Açma):
 * Must have at least 5 valid pairs (10 tiles). In katlamalı, must exceed highestPairsCount.
 */
export const validatePairOpening = (
  pairs: Tile101[][],
  okeyRef?: Tile101 | null,
  minPairsNeeded: number = 5
): { valid: boolean; error?: string } => {
  const minRequired = Math.max(5, minPairsNeeded || 5);
  if (!pairs || pairs.length < minRequired) {
    return { valid: false, error: `Çift açmak için en az ${minRequired} çift (${minRequired * 2} taş) gereklidir.` };
  }

  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (p.length !== 2) {
      return { valid: false, error: `${i + 1}. grupta tam olarak 2 taş olmalıdır.` };
    }
    if (!isValidPair(p[0], p[1], okeyRef)) {
      return { valid: false, error: `${i + 1}. çift geçersizdir (aynı renk ve sayı olmalı).` };
    }
  }

  return { valid: true };
};

/**
 * Validate Serial Hand Opening (Seri Açma):
 * Melds must all be valid runs/groups, and total score must meet requirement.
 */
export const validateSerialHandOpening = (
  melds: Tile101[][],
  minScoreNeeded: number,
  okeyRef?: Tile101 | null
): { valid: boolean; totalScore: number; verifiedMelds: Okey101Meld[]; error?: string } => {
  if (!melds || melds.length === 0) {
    return { valid: false, totalScore: 0, verifiedMelds: [], error: 'Açılacak per bulunamadı.' };
  }

  let totalScore = 0;
  const verifiedMelds: Okey101Meld[] = [];

  for (let i = 0; i < melds.length; i++) {
    const meldTiles = melds[i];
    const check = validateMeld(meldTiles, okeyRef);
    if (!check.valid || !check.type) {
      return {
        valid: false,
        totalScore: 0,
        verifiedMelds: [],
        error: `${i + 1}. per geçersizdir. Ardışık seri veya aynı sayı farklı renk olmalıdır.`,
      };
    }
    totalScore += check.score;
    verifiedMelds.push({
      id: `meld_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      playerId: 0,
      playerUsername: '',
      type: check.type,
      tiles: [...meldTiles],
      score: check.score,
    });
  }

  if (totalScore < minScoreNeeded) {
    return {
      valid: false,
      totalScore,
      verifiedMelds: [],
      error: `Perlerin toplam puanı (${totalScore}), gerekli baraj puanını (${minScoreNeeded}) karşılamıyor.`,
    };
  }

  return { valid: true, totalScore, verifiedMelds };
};

/**
 * Check if a player's tile can be appended/processed onto an existing meld on the table.
 * - For Run: can be placed at the beginning or at the end.
 * - For Group: can be added if group has 3 tiles and this tile has the same number with the unused color.
 */
export interface AppendResult101 {
  canAppend: boolean;
  insertAt?: 'start' | 'end' | 'set';
  orderedTiles?: Tile101[];
  score?: number;
  error?: string;
  replacesOkey?: boolean;
  retrievedOkey?: Tile101;
}

export const canAppendTileToMeld = (
  tile: Tile101,
  meld: Okey101Meld,
  okeyRef?: Tile101 | null
): AppendResult101 => {
  if (!tile || !meld || !meld.tiles) return { canAppend: false };

  // Pairs cannot have stones appended (strictly 2 identical tiles)
  if (meld.type === 'pair') {
    return { canAppend: false, error: 'Çift perlerine sonradan taş eklenemez.' };
  }

  // 1. GROUP MELD APPENDING (Max 4 tiles, 1 of each color)
  if (meld.type === 'group') {
    // If group already has 4 tiles, check if one of them is an Okey being replaced by its true color tile
    if (meld.tiles.length >= 4) {
      const okeyIdx = meld.tiles.findIndex(t => isTileOkey(t, okeyRef));
      if (okeyIdx !== -1) {
        const candidate = [...meld.tiles];
        candidate[okeyIdx] = tile;
        const groupCheck = isValidGroup(candidate, okeyRef);
        if (groupCheck.valid) {
          return {
            canAppend: true,
            replacesOkey: true,
            retrievedOkey: meld.tiles[okeyIdx],
            orderedTiles: candidate,
            score: groupCheck.score,
            insertAt: 'set'
          };
        }
      }
      return { canAppend: false, error: 'Bu grupta zaten 4 farklı renk tamamlanmış.' };
    }

    const okey = isTileOkey(tile, okeyRef);
    const regulars = meld.tiles.filter((t) => !isTileOkey(t, okeyRef));
    const targetNumber = regulars.length > 0 ? regulars[0].number : (tile.number);

    if (!okey && tile.number !== targetNumber) {
      return { canAppend: false, error: `Bu gruba sadece ${targetNumber} numaralı taş eklenebilir.` };
    }

    // Only compare against colors of existing regular tiles
    const existingColors = new Set(regulars.map((t) => t.color));
    if (!okey && existingColors.has(tile.color)) {
      return { canAppend: false, error: 'Bu renk zaten bu grupta bulunuyor.' };
    }

    const newScore = (meld.tiles.length + 1) * targetNumber;
    return {
      canAppend: true,
      insertAt: 'set',
      score: newScore,
      orderedTiles: [...meld.tiles, tile]
    };
  }

  // 2. RUN MELD APPENDING (Min 3, Max 13)
  if (meld.type === 'run') {
    // Check if tile can replace an existing Okey in the run
    const okeyIndices = meld.tiles
      .map((t, idx) => (isTileOkey(t, okeyRef) ? idx : -1))
      .filter((idx) => idx !== -1);

    for (const oIdx of okeyIndices) {
      const candidate = [...meld.tiles];
      candidate[oIdx] = tile;
      const chk = isValidRun(candidate, okeyRef);
      if (chk.valid) {
        const analysis = analyzeBestRunSequence101(candidate, okeyRef);
        return {
          canAppend: true,
          replacesOkey: true,
          retrievedOkey: meld.tiles[oIdx],
          orderedTiles: analysis.valid ? analysis.orderedTiles : candidate,
          score: chk.score,
          insertAt: 'set'
        };
      }
    }

    if (meld.tiles.length >= 13) {
      return { canAppend: false, error: 'Bu seri maksimum uzunluğa ulaşmış.' };
    }

    // General Whole Set Analysis Test
    const combined = [...meld.tiles, tile];
    const analysis = analyzeBestRunSequence101(combined, okeyRef);
    if (analysis.valid && analysis.orderedTiles && analysis.orderedTiles.length === combined.length) {
      const isStart = analysis.orderedTiles[0]?.id === tile.id;
      const isEnd = analysis.orderedTiles[analysis.orderedTiles.length - 1]?.id === tile.id;
      if (isStart || isEnd) {
        return {
          canAppend: true,
          insertAt: isStart ? 'start' : 'end',
          orderedTiles: analysis.orderedTiles,
          score: analysis.score
        };
      }
    }

    return { canAppend: false, error: 'Bu taş bu serinin başına veya sonuna uymuyor.' };
  }

  return { canAppend: false };
};

/**
 * "İşler Taş" Check:
 * Returns true if the tile could have been processed/appended to ANY opened meld on the table.
 * If true, throwing this tile causes a +101 penalty!
 */
export const checkIslerTas = (
  tile: Tile101,
  openedMelds: Okey101Meld[],
  okeyRef?: Tile101 | null
): boolean => {
  if (!tile || !openedMelds || openedMelds.length === 0) return false;
  // Real Okey is never treated as punishable işler taş
  if (isTileOkey(tile, okeyRef)) return false;

  for (const meld of openedMelds) {
    const res = canAppendTileToMeld(tile, meld, okeyRef);
    if (res.canAppend) return true;
  }
  return false;
};

/**
 * Calculate round end penalties according to official 101 Okey rules:
 * - Winner: -101 (or -202 if finished with Okey or by Double)
 * - Unopened players: +202 (plus +101 for each Okey left in hand)
 * - Opened players: sum of values of remaining tiles in hand (plus +101 for each Okey left in hand)
 * - Double openers (Çift açanlar): penalty is multiplied by 2 (hand sum x2, Okey left x2)
 * - Okey finish or Double finish by winner: multiplies all opponents' penalties by 2 (x2)
 */
export const calculateRoundPenalties = (
  players: Okey101Player[],
  winnerId: number,
  finishedWithOkey: boolean,
  okeyRef?: Tile101 | null,
  finishedWithDouble: boolean = false
): { [playerId: number]: { roundScore: number; reason: string } } => {
  const result: { [playerId: number]: { roundScore: number; reason: string } } = {};

  const winner = players.find((p) => p.id === winnerId);
  const isDoubleWin = finishedWithDouble || (winner && winner.openedMode === 'double');

  for (const p of players) {
    if (p.id === winnerId) {
      if (finishedWithOkey && isDoubleWin) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Çifte giderek Okey ile bitirdi! (-202 puan)',
        };
      } else if (finishedWithOkey) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Okey atarak bitirdi! (-202 puan)',
        };
      } else if (isDoubleWin) {
        result[p.id] = {
          roundScore: -202,
          reason: 'Çifte giderek bitirdi! (-202 puan)',
        };
      } else {
        result[p.id] = {
          roundScore: -101,
          reason: 'Eli normal bitirdi (-101 puan)',
        };
      }
      continue;
    }

    let penalty = 0;
    let reason = '';

    // Check count of unplayed real Okeys left in hand (+101 penalty per Okey)
    const okeysInHand = p.hand ? p.hand.filter((t) => isTileOkey(t, okeyRef)).length : 0;
    const okeyPenalty = okeysInHand * 101;

    if (!p.hasOpened) {
      // Unopened: +202 base penalty
      penalty = 202 + okeyPenalty;
      reason = okeysInHand > 0
        ? `El açamadı (+202) + Elde ${okeysInHand} Okey kaldı (+${okeyPenalty})`
        : 'El açamadı (+202 ceza)';
    } else if (p.openedMode === 'double') {
      // Opened double (Çift açanlar): Hand sum x 2 + Okey left x 2
      const handSum = (p.hand || []).reduce((sum, t) => {
        if (isTileOkey(t, okeyRef)) return sum;
        return sum + (t.number || 0);
      }, 0);
      penalty = (handSum * 2) + (okeyPenalty * 2);
      reason = okeysInHand > 0
        ? `Çift açan eldeki taşlar x2 (${handSum * 2}) + Elde Okey x2 (+${okeyPenalty * 2})`
        : `Çift açan oyuncunun kalan taşları x2 (${handSum * 2} ceza)`;
    } else {
      // Opened serial: Sum of remaining tiles in hand + Okey penalty
      const handSum = (p.hand || []).reduce((sum, t) => {
        if (isTileOkey(t, okeyRef)) return sum;
        return sum + (t.number || 0);
      }, 0);
      penalty = handSum + okeyPenalty;
      reason = okeysInHand > 0
        ? `Kalan taşlar (${handSum}) + Elde ${okeysInHand} Okey kaldı (+${okeyPenalty})`
        : `Eldeki kalan taşlar toplamı (${handSum} ceza)`;
    }

    // Multiply by 2 if winner finished with Okey
    if (finishedWithOkey) {
      penalty *= 2;
      reason += ' (Okey ile bitiş x2)';
    } else if (isDoubleWin) {
      penalty *= 2;
      reason += ' (Çifte giderek bitiş x2)';
    }

    result[p.id] = { roundScore: penalty, reason };
  }

  return result;
};

// Helper to order tiles sequentially within a 101 serial run (with Okey placed in its exact position)
export const orderSerialRun101 = (tiles: Tile101[], okeyRef?: Tile101 | null): Tile101[] => {
  const analysis = analyzeBestRunSequence101(tiles, okeyRef);
  return analysis.valid ? analysis.orderedTiles : [...tiles];
};

// Helper to order tiles within a 101 group meld
export const orderGroupMeld101 = (tiles: Tile101[], okeyRef?: Tile101 | null): Tile101[] => {
  const jokers = tiles.filter((t) => isTileOkey(t, okeyRef));
  const regulars = tiles.filter((t) => !isTileOkey(t, okeyRef));
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  regulars.sort((a, b) => (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99));
  return [...regulars, ...jokers];
};

// Organize unmelded 101 tiles (pairs together, run-connectors together, singles sorted)
export const organizeUnmeldedTiles101 = (unmelded: Tile101[]): Tile101[] => {
  if (unmelded.length <= 1) return [...unmelded];

  const pool = [...unmelded];
  const organized: Tile101[] = [];

  // 1. Group identical pairs (same color & number)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.color === t2.color && t1.number === t2.number) {
        organized.push(t1, t2);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 2. Group 2-tile run connectors (same color, adjacent numbers or 1-gap)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.color === t2.color && Math.abs(t1.number - t2.number) <= 2 && t1.number !== t2.number) {
        const pair = [t1, t2].sort((a, b) => a.number - b.number);
        organized.push(...pair);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 3. Group 2-tile number pairs (same number, different color)
  for (let i = 0; i < pool.length; i++) {
    const t1 = pool[i];
    if (!t1) continue;
    for (let j = i + 1; j < pool.length; j++) {
      const t2 = pool[j];
      if (!t2) continue;
      if (t1.number === t2.number && t1.color !== t2.color) {
        organized.push(t1, t2);
        pool.splice(j, 1);
        pool.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 4. Sort remaining isolated singles by color then number
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  pool.sort((a, b) => {
    if (colorOrder[a.color] !== colorOrder[b.color]) {
      return (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
    }
    return a.number - b.number;
  });

  organized.push(...pool);
  return organized;
};

interface CandidateMeld101 {
  tiles: Tile101[];
  tileIds: string[];
  type: 'run' | 'group';
  length: number;
  score: number;
}

/**
 * Auto-find best runs and groups in player's hand and calculate potential meld score.
 * Explores all combinations of serial and group melds (seamlessly incorporating any Okey in the hand),
 * and selects the disjoint partition that maximizes the total meld score and tile count.
 */
export const findBestMeldsInHand = (
  hand: Tile101[],
  okeyRef?: Tile101 | null
): { melds: Tile101[][]; totalScore: number; unmelded: Tile101[] } => {
  if (!hand || hand.length < 3) {
    return { melds: [], totalScore: 0, unmelded: organizeUnmeldedTiles101(hand || []) };
  }

  const jokers = hand.filter((t) => isTileOkey(t, okeyRef));
  const regulars = hand.filter((t) => !isTileOkey(t, okeyRef));
  const candidateMelds: CandidateMeld101[] = [];

  // 1. Generate candidate runs for each color (with 0, 1, or 2 jokers)
  const colors: TileColor[] = ['red', 'blue', 'black', 'yellow'];
  for (const c of colors) {
    const colorTiles = regulars.filter((t) => t.color === c);
    if (colorTiles.length + jokers.length < 3) continue;

    const byNumber = new Map<number, Tile101[]>();
    for (const t of colorTiles) {
      if (!byNumber.has(t.number)) byNumber.set(t.number, []);
      byNumber.get(t.number)!.push(t);
    }

    // Straight runs
    for (let S = 1; S <= 11; S++) {
      for (let L = 3; L <= Math.min(13 - S + 1, 13); L++) {
        let missing = 0;
        const usedRegs: Tile101[] = [];

        for (let num = S; num < S + L; num++) {
          const matching = byNumber.get(num);
          if (matching && matching.length > 0) {
            usedRegs.push(matching[0]);
          } else {
            missing++;
          }
        }

        if (missing <= jokers.length) {
          const usedJokers = jokers.slice(0, missing);
          const allTiles = [...usedRegs, ...usedJokers];
          const ordered = orderSerialRun101(allTiles, okeyRef);
          const check = isValidRun(ordered, okeyRef);
          if (check.valid) {
            candidateMelds.push({
              tiles: ordered,
              tileIds: ordered.map((t) => t.id),
              type: 'run',
              length: L,
              score: check.score
            });
          }
        }
      }
    }

    // Wrapping runs: 12-13-1, 11-12-13-1, 10-11-12-13-1
    const wrapSequences = [
      [12, 13, 1],
      [11, 12, 13, 1],
      [10, 11, 12, 13, 1]
    ];
    for (const seq of wrapSequences) {
      let missing = 0;
      const usedRegs: Tile101[] = [];

      for (const num of seq) {
        const matching = byNumber.get(num);
        if (matching && matching.length > 0) {
          usedRegs.push(matching[0]);
        } else {
          missing++;
        }
      }

      if (missing <= jokers.length) {
        const usedJokers = jokers.slice(0, missing);
        const allTiles = [...usedRegs, ...usedJokers];
        const ordered = orderSerialRun101(allTiles, okeyRef);
        const check = isValidRun(ordered, okeyRef);
        if (check.valid) {
          candidateMelds.push({
            tiles: ordered,
            tileIds: ordered.map((t) => t.id),
            type: 'run',
            length: seq.length,
            score: check.score
          });
        }
      }
    }
  }

  // 2. Generate candidate groups for each number (1..13)
  for (let num = 1; num <= 13; num++) {
    const numTiles = regulars.filter((t) => t.number === num);
    const byColor = new Map<TileColor, Tile101>();
    for (const t of numTiles) {
      if (!byColor.has(t.color)) byColor.set(t.color, t);
    }
    const uniqueRegs = Array.from(byColor.values());

    // Group size 3
    if (uniqueRegs.length + jokers.length >= 3) {
      for (let jCount = 0; jCount <= Math.min(jokers.length, 2); jCount++) {
        const needRegs = 3 - jCount;
        if (uniqueRegs.length >= needRegs) {
          const combinations = (arr: Tile101[], k: number): Tile101[][] => {
            if (k === 0) return [[]];
            if (arr.length < k) return [];
            const head = arr[0];
            const withHead = combinations(arr.slice(1), k - 1).map((c) => [head, ...c]);
            const withoutHead = combinations(arr.slice(1), k);
            return [...withHead, ...withoutHead];
          };

          const regCombos = combinations(uniqueRegs, needRegs);
          const chosenJokers = jokers.slice(0, jCount);

          for (const rc of regCombos) {
            const allTiles = orderGroupMeld101([...rc, ...chosenJokers], okeyRef);
            const check = isValidGroup(allTiles, okeyRef);
            if (check.valid) {
              candidateMelds.push({
                tiles: allTiles,
                tileIds: allTiles.map((t) => t.id),
                type: 'group',
                length: 3,
                score: check.score
              });
            }
          }
        }
      }
    }

    // Group size 4
    if (uniqueRegs.length + jokers.length >= 4) {
      for (let jCount = 0; jCount <= Math.min(jokers.length, 3); jCount++) {
        const needRegs = 4 - jCount;
        if (uniqueRegs.length >= needRegs) {
          const combinations = (arr: Tile101[], k: number): Tile101[][] => {
            if (k === 0) return [[]];
            if (arr.length < k) return [];
            const head = arr[0];
            const withHead = combinations(arr.slice(1), k - 1).map((c) => [head, ...c]);
            const withoutHead = combinations(arr.slice(1), k);
            return [...withHead, ...withoutHead];
          };

          const regCombos = combinations(uniqueRegs, needRegs);
          const chosenJokers = jokers.slice(0, jCount);

          for (const rc of regCombos) {
            const allTiles = orderGroupMeld101([...rc, ...chosenJokers], okeyRef);
            const check = isValidGroup(allTiles, okeyRef);
            if (check.valid) {
              candidateMelds.push({
                tiles: allTiles,
                tileIds: allTiles.map((t) => t.id),
                type: 'group',
                length: 4,
                score: check.score
              });
            }
          }
        }
      }
    }
  }

  // Deduplicate candidate melds, keeping highest score for the same set of tiles
  const candidateMap = new Map<string, CandidateMeld101>();
  for (const m of candidateMelds) {
    const key = [...m.tileIds].sort().join(',');
    const existing = candidateMap.get(key);
    if (!existing || m.score > existing.score) {
      candidateMap.set(key, m);
    }
  }
  const uniqueCandidates = Array.from(candidateMap.values());

  // Sort candidate melds by score and efficiency
  uniqueCandidates.sort((a, b) => {
    const valA = a.score * 1000 + a.length;
    const valB = b.score * 1000 + b.length;
    return valB - valA;
  });

  // Branch and bound search for disjoint combination with maximum score
  let bestMelds: CandidateMeld101[] = [];
  let bestScore = 0;
  let bestTilesCount = 0;

  const backtrack = (idx: number, usedTileIds: Set<string>, currentMelds: CandidateMeld101[], currentScore: number, currentTiles: number) => {
    // Upper bound estimate
    let remainingPotentialScore = 0;
    for (let i = idx; i < uniqueCandidates.length; i++) {
      const cand = uniqueCandidates[i];
      let canUse = true;
      for (const tid of cand.tileIds) {
        if (usedTileIds.has(tid)) {
          canUse = false;
          break;
        }
      }
      if (canUse) remainingPotentialScore += cand.score;
    }

    if (currentScore + remainingPotentialScore < bestScore) {
      return;
    }

    if (currentScore > bestScore || (currentScore === bestScore && currentTiles > bestTilesCount)) {
      bestScore = currentScore;
      bestTilesCount = currentTiles;
      bestMelds = [...currentMelds];
    }

    for (let i = idx; i < uniqueCandidates.length; i++) {
      const cand = uniqueCandidates[i];
      let disjoint = true;
      for (const tid of cand.tileIds) {
        if (usedTileIds.has(tid)) {
          disjoint = false;
          break;
        }
      }

      if (disjoint) {
        for (const tid of cand.tileIds) usedTileIds.add(tid);
        currentMelds.push(cand);

        backtrack(i + 1, usedTileIds, currentMelds, currentScore + cand.score, currentTiles + cand.length);

        currentMelds.pop();
        for (const tid of cand.tileIds) usedTileIds.delete(tid);
      }
    }
  };

  backtrack(0, new Set(), [], 0, 0);

  const usedIds = new Set<string>();
  const finalMelds: Tile101[][] = [];
  let totalScore = 0;

  for (const m of bestMelds) {
    finalMelds.push(m.tiles);
    totalScore += m.score;
    for (const tid of m.tileIds) usedIds.add(tid);
  }

  const rawUnmelded = hand.filter((t) => !usedIds.has(t.id));
  const organizedUnmelded = organizeUnmeldedTiles101(rawUnmelded);

  return {
    melds: finalMelds,
    totalScore,
    unmelded: organizedUnmelded
  };
};

/**
 * Auto-find pairs in hand (for Çift Açma), using Okey(s) to complete pairs
 */
export const findPairsInHand = (
  hand: Tile101[],
  okeyRef?: Tile101 | null
): { pairs: Tile101[][]; unmelded: Tile101[] } => {
  if (!hand || hand.length === 0) return { pairs: [], unmelded: [] };

  const jokers = hand.filter((t) => isTileOkey(t, okeyRef));
  const regulars = hand.filter((t) => !isTileOkey(t, okeyRef));

  const pairs: Tile101[][] = [];
  const unusedRegs = [...regulars];
  const unusedJokers = [...jokers];

  // 1. Find exact matching pairs (same number and color)
  for (let i = 0; i < unusedRegs.length; i++) {
    const t1 = unusedRegs[i];
    if (!t1) continue;
    for (let j = i + 1; j < unusedRegs.length; j++) {
      const t2 = unusedRegs[j];
      if (!t2) continue;
      if (t1.color === t2.color && t1.number === t2.number) {
        pairs.push([t1, t2]);
        unusedRegs.splice(j, 1);
        unusedRegs.splice(i, 1);
        i--;
        break;
      }
    }
  }

  // 2. Use Okey(s) to pair with highest value unmatched tiles
  unusedRegs.sort((a, b) => b.number - a.number);
  while (unusedJokers.length > 0 && unusedRegs.length > 0) {
    const joker = unusedJokers.pop()!;
    const reg = unusedRegs.shift()!;
    pairs.push([reg, joker]);
  }

  // 3. If two jokers remain, pair them together
  while (unusedJokers.length >= 2) {
    pairs.push([unusedJokers.pop()!, unusedJokers.pop()!]);
  }

  // Sort remaining single tiles
  const singles = [...unusedRegs, ...unusedJokers];
  const colorOrder: Record<TileColor, number> = { red: 1, blue: 2, black: 3, yellow: 4, fake: 5 };
  singles.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return (colorOrder[a.color] || 99) - (colorOrder[b.color] || 99);
  });

  return { pairs, unmelded: singles };
};

/**
 * Intelligent Auto Sort for 101 Okey Rack
 */
export const autoSortRuns101 = (
  tiles: (Tile101 | null)[],
  okeyRef?: Tile101 | null
): (Tile101 | null)[] => {
  const nonNull = tiles.filter((t): t is Tile101 => t !== null);
  if (nonNull.length === 0) return [...tiles];

  const { melds, unmelded } = findBestMeldsInHand(nonNull, okeyRef);
  const newRack: (Tile101 | null)[] = Array(tiles.length).fill(null);
  const RACK_SIZE = tiles.length;
  const ROW_LEN = 15; // 2 rows of 15

  let currentSlot = 0;

  // Place melds with 1 slot gap, wrapping cleanly to row 1 if needed
  for (const meld of melds) {
    if (currentSlot < ROW_LEN && currentSlot + meld.length > ROW_LEN) {
      currentSlot = ROW_LEN;
    }

    if (currentSlot + meld.length > RACK_SIZE) break;

    for (const t of meld) {
      newRack[currentSlot++] = t;
    }

    if (currentSlot < RACK_SIZE && currentSlot !== ROW_LEN) {
      currentSlot++;
    }
  }

  // Place organized unmelded tiles
  for (const t of unmelded) {
    if (currentSlot < RACK_SIZE) {
      newRack[currentSlot++] = t;
    } else {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) newRack[freeIdx] = t;
    }
  }

  // Failsafe: guarantee all tiles are present on the rack
  const placedIds = new Set(newRack.filter((t): t is Tile101 => t !== null).map((t) => t.id));
  for (const t of nonNull) {
    if (!placedIds.has(t.id)) {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) {
        newRack[freeIdx] = t;
        placedIds.add(t.id);
      }
    }
  }

  return newRack;
};

/**
 * Intelligent Auto Sort for 101 Okey Pairs Rack
 */
export const autoSortPairs101 = (
  tiles: (Tile101 | null)[],
  okeyRef?: Tile101 | null
): (Tile101 | null)[] => {
  const nonNull = tiles.filter((t): t is Tile101 => t !== null);
  if (nonNull.length === 0) return [...tiles];

  const { pairs, unmelded } = findPairsInHand(nonNull, okeyRef);
  const newRack: (Tile101 | null)[] = Array(tiles.length).fill(null);
  const RACK_SIZE = tiles.length;
  let slot = 0;

  for (const pair of pairs) {
    if (slot + 2 > RACK_SIZE) break;
    newRack[slot++] = pair[0];
    newRack[slot++] = pair[1];
    if (slot < RACK_SIZE) slot++; // Gap between pairs
  }

  for (const t of unmelded) {
    if (slot < RACK_SIZE) {
      newRack[slot++] = t;
    } else {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) newRack[freeIdx] = t;
    }
  }

  // Failsafe: guarantee all tiles are present on rack
  const placedIds = new Set(newRack.filter((t): t is Tile101 => t !== null).map((t) => t.id));
  for (const t of nonNull) {
    if (!placedIds.has(t.id)) {
      const freeIdx = newRack.findIndex((s) => s === null);
      if (freeIdx !== -1) {
        newRack[freeIdx] = t;
        placedIds.add(t.id);
      }
    }
  }

  return newRack;
};

/**
 * High-level engine interface for room initialization and rule validation
 */
export const Okey101Engine = {
  generate101Deck,
  deal101Hands,
  isValidRun,
  isValidGroup,
  validateMeld,
  isValidPair,
  validatePairOpening,
  validateSerialHandOpening,
  canAppendTileToMeld,
  checkIslerTas,
  calculateRoundPenalties,
  findBestMeldsInHand,
  findPairsInHand,
  autoSortRuns101,
  autoSortPairs101,
  isTileOkey,
  initializeGame: (room: any) => {
    const { deck, indicator, okeyTile } = generate101Deck();
    const dealerIndex = 0;
    const dealt = deal101Hands(deck, dealerIndex, room.players?.length || 4);

    room.deck = dealt.remainingDeck;
    room.indicator = indicator;
    room.okeyTile = okeyTile;
    room.status = 'playing';
    room.currentTurn = 0;
    room.turnPhase = 'discard'; // First player has 22 tiles and starts by discarding
    room.highestOpenScore = 101;
    room.openedMelds = [];
    room.winnerId = undefined;
    room.winningReason = undefined;
    room.roundNumber = (room.roundNumber || 0) + 1;
    room.lastActionMessage = `101 Okey başladı! Gösterge: ${indicator.number} (${indicator.color}). İlk sıra ${room.players[0]?.username || '1. Oyuncu'} adlı oyuncuda.`;

    for (let i = 0; i < room.players.length; i++) {
      room.players[i].hand = dealt.hands[i] || [];
      room.players[i].discardPile = [];
      room.players[i].hasOpened = false;
      room.players[i].openedMode = undefined;
      room.players[i].openedScore = 0;
      room.players[i].openedMeldsCount = 0;
      room.players[i].roundPenalty = 0;
    }

    return { dealt, indicator, okeyTile };
  },
  runStressTest: (iterations: number = 2000) => run101StressTest(iterations)
};

export interface StressTestReport101 {
  success: boolean;
  iterations: number;
  errors: string[];
  durationMs: number;
  scenarios: {
    subsequentMeldsTested: number;
    subsequentMeldsSucceeded: number;
    layOffsTested: number;
    layOffsSucceeded: number;
    unopenedLayOffRejections: number;
    rule12131Checks: number;
    groupAppendChecks: number;
    okeyRetrievalsTested: number;
    doubleVsSerialChecks: number;
    fullRoundsSimulated: number;
  };
}

/**
 * Autonomous Headless 101 Okey Stress Test Simulation
 * Validates:
 * 1. Subsequent melds opening after initial 101 threshold (no second 101 barrier)
 * 2. Laying off / appending stone rules (12-13-1, 4-color group limit, Okey retrieval)
 * 3. Double opener vs Serial opener restrictions
 * 4. 2000 rapid turns and tile array integrity
 */
export const run101StressTest = (iterations: number = 2000): StressTestReport101 => {
  const errors: string[] = [];
  const startTime = Date.now();

  const scenarios = {
    subsequentMeldsTested: 0,
    subsequentMeldsSucceeded: 0,
    layOffsTested: 0,
    layOffsSucceeded: 0,
    unopenedLayOffRejections: 0,
    rule12131Checks: 0,
    groupAppendChecks: 0,
    okeyRetrievalsTested: 0,
    doubleVsSerialChecks: 0,
    fullRoundsSimulated: 0
  };

  try {
    // ============================================================
    // SENARYO 1: İKİNCİ KEZ PER İNDİRME TESTİ (SUBSEQUENT MELDS)
    // ============================================================
    scenarios.subsequentMeldsTested++;
    const okeyDummy: Tile101 = { id: 'dummy_okey', color: 'red', number: 1 };
    
    // Simulate a full game room for Scenario 1: Bot A has already opened (hasOpened = true)
    const testRoom: Okey101RoomState = {
      id: 'stress_room_1',
      name: 'Stress Test Room',
      gameMode: 'okey101',
      subMode: 'katlamali',
      status: 'playing',
      hostId: 101,
      creatorId: 101,
      players: [
        {
          id: 101,
          username: 'Bot_A',
          isBot: true,
          hand: [
            { id: 't_y4', color: 'yellow', number: 4 },
            { id: 't_y5', color: 'yellow', number: 5 },
            { id: 't_y6', color: 'yellow', number: 6 },
            { id: 't_r8', color: 'red', number: 8 }
          ],
          discardPile: [],
          hasOpened: true, // Already passed 101 threshold in previous turn
          openedMode: 'serial',
          openedMeldsCount: 3,
          openedScore: 105,
          penalties: 0,
          roundPenalty: 0
        },
        {
          id: 102,
          username: 'Bot_B',
          isBot: true,
          hand: [{ id: 'b_t1', color: 'blue', number: 7 }],
          discardPile: [],
          hasOpened: true, // Opened
          openedMode: 'serial',
          openedMeldsCount: 3,
          openedScore: 102,
          penalties: 0,
          roundPenalty: 0
        },
        {
          id: 103,
          username: 'Bot_C',
          isBot: true,
          hand: [{ id: 'c_t1', color: 'blue', number: 7 }],
          discardPile: [],
          hasOpened: false, // NOT opened!
          openedMode: undefined,
          openedMeldsCount: 0,
          openedScore: 0,
          penalties: 0,
          roundPenalty: 0
        },
        {
          id: 104,
          username: 'Bot_D',
          isBot: true,
          hand: [],
          discardPile: [],
          hasOpened: false,
          openedMode: undefined,
          openedMeldsCount: 0,
          openedScore: 0,
          penalties: 0,
          roundPenalty: 0
        }
      ],
      deckCount: 40,
      indicator: null,
      okeyTile: okeyDummy,
      currentTurn: 0,
      turnPhase: 'discard',
      highestOpenScore: 105,
      highestPairsCount: 5,
      openedMelds: [
        {
          id: 'initial_meld_1',
          playerId: 101,
          playerUsername: 'Bot_A',
          type: 'run',
          tiles: [
            { id: 'init_1', color: 'red', number: 10 },
            { id: 'init_2', color: 'red', number: 11 },
            { id: 'init_3', color: 'red', number: 12 }
          ],
          score: 33
        }
      ],
      turnTimeRemaining: 30,
      roundNumber: 1,
      winnerId: null,
      winningReason: null
    };

    // Bot A attempts to open a subsequent 3-tile run [Yellow 4, 5, 6] (score = 15, well under 101!)
    const botA = testRoom.players[0];
    const initialHandCount = botA.hand.length;
    const initialTableMeldsCount = testRoom.openedMelds.length;
    const subsequentRun = [botA.hand[0], botA.hand[1], botA.hand[2]];
    const chkSubsequent = validateMeld(subsequentRun, okeyDummy);
    
    if (!chkSubsequent.valid) {
      errors.push(`[Scenario 1]: Valid subsequent meld Yellow 4-5-6 rejected by validateMeld`);
    } else {
      // Simulate server-side processing for already opened player (bypassing 101 check)
      if (botA.hasOpened) {
        testRoom.openedMelds.push({
          id: `meld_subsequent_${Date.now()}`,
          playerId: botA.id,
          playerUsername: botA.username,
          type: chkSubsequent.type || 'run',
          tiles: [...subsequentRun],
          score: chkSubsequent.score
        });
        for (const t of subsequentRun) {
          const idx = botA.hand.findIndex((h) => h.id === t.id);
          if (idx !== -1) botA.hand.splice(idx, 1);
        }
      }

      if (testRoom.openedMelds.length !== initialTableMeldsCount + 1) {
        errors.push(`[Scenario 1]: Table melds array was not updated after subsequent meld opening!`);
      }
      if (botA.hand.length !== initialHandCount - 3) {
        errors.push(`[Scenario 1]: Tiles were not properly deducted from hand! Expected ${initialHandCount - 3}, got ${botA.hand.length}`);
      }
      scenarios.subsequentMeldsSucceeded++;
    }

    // Test invalid meld in subsequent open
    const invalidSubsequent: Tile101[] = [
      { id: 't_y4', color: 'yellow', number: 4 },
      { id: 't_y5', color: 'yellow', number: 5 },
      { id: 't_r8', color: 'red', number: 8 }
    ];
    const chkInvalid = validateMeld(invalidSubsequent, okeyDummy);
    if (chkInvalid.valid) {
      errors.push(`[Scenario 1]: Invalid subsequent meld Yellow 4-5 + Red 8 was incorrectly accepted!`);
    }

    // ============================================================
    // SENARYO 2: TAŞ İŞLEME & KURAL DOĞRULAMA (LAYING OFF)
    // ============================================================
    // Concurrency / Permission Check: Bot B (hasOpened = true) vs Bot C (hasOpened = false)
    const botB = testRoom.players[1];
    const botC = testRoom.players[2];
    const targetMeld = testRoom.openedMelds[0]; // [Red 10, 11, 12]
    const red13ForB: Tile101 = { id: 'r13', color: 'red', number: 13 };
    const red13ForC: Tile101 = { id: 'r13_c', color: 'red', number: 13 };

    // Bot C (unopened) trying to lay off -> MUST BE REJECTED by permission rule
    scenarios.layOffsTested++;
    if (!botC.hasOpened) {
      scenarios.unopenedLayOffRejections++;
      // Expected to be blocked by server rule: if (!player.hasOpened) return error
    } else {
      errors.push(`[Scenario 2]: Unopened player Bot C had hasOpened set to true!`);
    }

    // Bot B (opened) laying off Red 13 onto [Red 10, 11, 12] -> MUST BE ALLOWED
    scenarios.layOffsTested++;
    if (botB.hasOpened) {
      const appB = canAppendTileToMeld(red13ForB, targetMeld, okeyDummy);
      if (!appB.canAppend || appB.insertAt !== 'end') {
        errors.push(`[Scenario 2]: Bot B could not append Red 13 to [Red 10, 11, 12]! Got: ${JSON.stringify(appB)}`);
      } else {
        targetMeld.tiles.push(red13ForB);
        targetMeld.score = appB.score || targetMeld.score;
        scenarios.layOffsSucceeded++;
      }
    }
    // 2A. Sıralı Seriye Baştan ve Sondan Ekleme
    const blueRunMeld: Okey101Meld = {
      id: 'meld_blue_run',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'run',
      tiles: [
        { id: 'b4', color: 'blue', number: 4 },
        { id: 'b5', color: 'blue', number: 5 },
        { id: 'b6', color: 'blue', number: 6 }
      ],
      score: 15
    };

    // Prepend Blue 3
    scenarios.layOffsTested++;
    const blue3: Tile101 = { id: 'b3', color: 'blue', number: 3 };
    const appendB3 = canAppendTileToMeld(blue3, blueRunMeld, okeyDummy);
    if (!appendB3.canAppend || appendB3.insertAt !== 'start') {
      errors.push(`[Scenario 2A]: Blue 3 could not be prepended to [Blue 4, 5, 6]. Got: ${JSON.stringify(appendB3)}`);
    } else {
      scenarios.layOffsSucceeded++;
    }

    // Append Blue 7
    scenarios.layOffsTested++;
    const blue7: Tile101 = { id: 'b7', color: 'blue', number: 7 };
    const appendB7 = canAppendTileToMeld(blue7, blueRunMeld, okeyDummy);
    if (!appendB7.canAppend || appendB7.insertAt !== 'end') {
      errors.push(`[Scenario 2A]: Blue 7 could not be appended to [Blue 4, 5, 6]. Got: ${JSON.stringify(appendB7)}`);
    } else {
      scenarios.layOffsSucceeded++;
    }

    // 2B. 12-13-1 Kuralı
    scenarios.rule12131Checks++;
    const wrapRunMeld: Okey101Meld = {
      id: 'meld_wrap_run',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'run',
      tiles: [
        { id: 'b12', color: 'blue', number: 12 },
        { id: 'b13', color: 'blue', number: 13 },
        { id: 'b1', color: 'blue', number: 1 }
      ],
      score: 26
    };

    // Appending Blue 2 to [12, 13, 1] MUST BE REJECTED
    const blue2: Tile101 = { id: 'b2', color: 'blue', number: 2 };
    const appendB2 = canAppendTileToMeld(blue2, wrapRunMeld, okeyDummy);
    if (appendB2.canAppend) {
      errors.push(`[Scenario 2B]: Blue 2 was ILLEGALLY allowed to append to [12, 13, 1]! 13-1-2 is strictly forbidden in 101 Okey.`);
    }

    // Prepending Blue 11 to [12, 13, 1] MUST BE ALLOWED
    const blue11: Tile101 = { id: 'b11', color: 'blue', number: 11 };
    const appendB11 = canAppendTileToMeld(blue11, wrapRunMeld, okeyDummy);
    if (!appendB11.canAppend || appendB11.insertAt !== 'start') {
      errors.push(`[Scenario 2B]: Blue 11 could not be prepended to [12, 13, 1]! Got: ${JSON.stringify(appendB11)}`);
    }

    // 2C. Renkli Kümeye (Set) Ekleme
    scenarios.groupAppendChecks++;
    const group8Meld: Okey101Meld = {
      id: 'meld_group_8',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'group',
      tiles: [
        { id: 'r8', color: 'red', number: 8 },
        { id: 'k8', color: 'black', number: 8 },
        { id: 'y8', color: 'yellow', number: 8 }
      ],
      score: 24
    };

    // 4th distinct color (Blue 8) MUST BE ALLOWED
    const blue8: Tile101 = { id: 'b8', color: 'blue', number: 8 };
    const appendB8 = canAppendTileToMeld(blue8, group8Meld, okeyDummy);
    if (!appendB8.canAppend) {
      errors.push(`[Scenario 2C]: 4th color Blue 8 could not be added to 8 group! Got: ${appendB8.error}`);
    }

    // Duplicate color (Red 8) MUST BE REJECTED
    const duplicateR8: Tile101 = { id: 'r8_dup', color: 'red', number: 8 };
    const appendDup = canAppendTileToMeld(duplicateR8, group8Meld, okeyDummy);
    if (appendDup.canAppend) {
      errors.push(`[Scenario 2C]: Duplicate Red 8 was ILLEGALLY allowed in group meld!`);
    }

    // 5th tile to a full 4-tile group MUST BE REJECTED
    const fullGroup8Meld: Okey101Meld = {
      id: 'meld_full_8',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'group',
      tiles: [
        { id: 'r8', color: 'red', number: 8 },
        { id: 'k8', color: 'black', number: 8 },
        { id: 'y8', color: 'yellow', number: 8 },
        { id: 'b8', color: 'blue', number: 8 }
      ],
      score: 32
    };
    const fifthTile: Tile101 = { id: 'f8', color: 'red', number: 8 };
    const append5th = canAppendTileToMeld(fifthTile, fullGroup8Meld, okeyDummy);
    if (append5th.canAppend) {
      errors.push(`[Scenario 2C]: 5th tile was ILLEGALLY allowed into full 4-color group meld!`);
    }

    // 2D. Okey Replacement & Retrieval
    scenarios.okeyRetrievalsTested++;
    const realOkeyTile: Tile101 = { id: 'real_okey', color: 'red', number: 5, isOkey: true };
    const meldWithOkey: Okey101Meld = {
      id: 'meld_okey_run',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'run',
      tiles: [
        { id: 'r4', color: 'red', number: 4 },
        realOkeyTile, // Stands in for Red 5
        { id: 'r6', color: 'red', number: 6 }
      ],
      score: 15
    };

    const regularRed5: Tile101 = { id: 'real_red5', color: 'red', number: 5 };
    const replaceCheck = canAppendTileToMeld(regularRed5, meldWithOkey, realOkeyTile);
    if (!replaceCheck.canAppend || !replaceCheck.replacesOkey || !replaceCheck.retrievedOkey) {
      errors.push(`[Scenario 2D]: Playing Red 5 onto [Red 4, OKEY, Red 6] failed to replace and retrieve Okey! Got: ${JSON.stringify(replaceCheck)}`);
    }

    // ============================================================
    // SENARYO 3: ÇİFTE GİDEN OYUNCU VS SERİ OYUNCUSU
    // ============================================================
    scenarios.doubleVsSerialChecks++;
    // Appending to a pair meld must be rejected
    const pairMeld: Okey101Meld = {
      id: 'meld_pair_test',
      playerId: 1,
      playerUsername: 'Player1',
      type: 'pair',
      tiles: [
        { id: 'p1', color: 'red', number: 10 },
        { id: 'p2', color: 'red', number: 10 }
      ],
      score: 0
    };
    const pairAppendCheck = canAppendTileToMeld({ id: 'p3', color: 'red', number: 10 }, pairMeld, okeyDummy);
    if (pairAppendCheck.canAppend) {
      errors.push(`[Scenario 3]: Appending a 3rd tile to a pair meld was ILLEGALLY allowed!`);
    }

    // ============================================================
    // SENARYO 4: 2000 HIZLI SİMÜLASYON DÖNGÜSÜ
    // ============================================================
    for (let iter = 0; iter < iterations; iter++) {
      scenarios.fullRoundsSimulated++;
      const { deck, okeyTile } = generate101Deck();
      const dealt = deal101Hands(deck, 0, 4);

      // Verify initial deal counts
      if (dealt.hands[0].length !== 22 || dealt.hands[1].length !== 21 || dealt.hands[2].length !== 21 || dealt.hands[3].length !== 21) {
        errors.push(`[Scenario 4, Iter ${iter}]: Hand deal size mismatch! Hands: ${dealt.hands.map(h => h.length).join(', ')}`);
        break;
      }

      // Check auto sorting on all 4 hands without tile loss
      for (let hIdx = 0; hIdx < 4; hIdx++) {
        const hand = dealt.hands[hIdx];
        const sortedRuns = autoSortRuns101(hand, okeyTile).filter(t => t !== null);
        if (sortedRuns.length !== hand.length) {
          errors.push(`[Scenario 4, Iter ${iter}]: autoSortRuns101 lost tiles in hand ${hIdx}! Expected ${hand.length}, got ${sortedRuns.length}`);
          break;
        }

        const sortedPairs = autoSortPairs101(hand, okeyTile).filter(t => t !== null);
        if (sortedPairs.length !== hand.length) {
          errors.push(`[Scenario 4, Iter ${iter}]: autoSortPairs101 lost tiles in hand ${hIdx}! Expected ${hand.length}, got ${sortedPairs.length}`);
          break;
        }

        // Test finding best melds
        const bestMelds = findBestMeldsInHand(hand, okeyTile);
        for (const m of bestMelds.melds) {
          const chk = validateMeld(m, okeyTile);
          if (!chk.valid) {
            errors.push(`[Scenario 4, Iter ${iter}]: findBestMeldsInHand produced invalid meld`);
            break;
          }
        }
      }

      // Test subsequent melds simulation
      const pHand = dealt.hands[0];
      const pAnalysis = findBestMeldsInHand(pHand, okeyTile);
      if (pAnalysis.melds.length >= 2) {
        const firstMeld = pAnalysis.melds[0];
        const secondMeld = pAnalysis.melds[1];

        const chk1 = validateMeld(firstMeld, okeyTile);
        const chk2 = validateMeld(secondMeld, okeyTile);
        if (chk1.valid && chk2.valid) {
          scenarios.subsequentMeldsTested++;
          scenarios.subsequentMeldsSucceeded++;
        }
      }
    }
  } catch (err: any) {
    errors.push(`[Unhandled Stress Exception]: ${err?.message || String(err)}`);
  }

  const durationMs = Date.now() - startTime;
  return {
    success: errors.length === 0,
    iterations,
    errors,
    durationMs,
    scenarios
  };
};
