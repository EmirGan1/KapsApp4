import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import {
  ArrowLeft,
  Coins,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Flame,
  Award,
  Clock,
  Shield,
  Zap,
} from 'lucide-react';
import PlayingCard, { Card } from './PlayingCard';
import Avatar from './Avatar';
import { CreateTableOptions } from './CardTableLobbyModal';
import { getApiUrl } from '../utils/api';
import { pokerAudio } from '../utils/pokerAudio';
import { createStandardDeck, shuffleDeck } from '../utils/cardDeck';
import {
  PokerPlayerSeat,
  PokerStage,
  PokerAction,
  HandTier,
  HandEvaluation,
  evaluateBestHand,
  decideBotAction,
  BOT_PLAYERS_POOL,
  TIER_NAMES_TR,
} from '../utils/pokerEngine';

interface TexasHoldemPokerGameProps {
  socket?: Socket | null;
  currentUserId?: number;
  username?: string;
  avatar?: string | null;
  color?: string;
  tableId?: string | null;
  tableOptions?: CreateTableOptions | null;
  onBackToHub: () => void;
}

export default function TexasHoldemPokerGame({
  socket,
  currentUserId = 1,
  username = 'Sen',
  avatar = null,
  color = '#3b82f6',
  tableId,
  tableOptions,
  onBackToHub,
}: TexasHoldemPokerGameProps) {
  // --- Audio State ---
  const [isMuted, setIsMuted] = useState<boolean>(pokerAudio.getMuted());
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    pokerAudio.setMuted(next);
  };

  // --- Real DB Chips / Wallet Sync ---
  const [currentUserChips, setCurrentUserChips] = useState<number>(() => {
    const cached = localStorage.getItem('lan_user_chips');
    return cached ? Number(cached) : 2500;
  });
  const [isRefilling, setIsRefilling] = useState<boolean>(false);

  // Table Configuration
  const minBet = tableOptions?.minBet || 50;
  const smallBlind = Math.max(10, Math.floor(minBet / 2));
  const bigBlind = Math.max(20, minBet);
  const tableTitle = tableOptions?.title || `${username}'in Poker Masası`;

  // --- Game State ---
  const [handNumber, setHandNumber] = useState<number>(1);
  const [stage, setStage] = useState<PokerStage>('preflop');
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState<number>(0);
  const [currentHighestBet, setCurrentHighestBet] = useState<number>(bigBlind);
  const [minRaise, setMinRaise] = useState<number>(bigBlind * 2);

  // Dealer and Positions (0 = Human, 1..4 = Bots)
  const [dealerIdx, setDealerIdx] = useState<number>(0);
  const [activeTurnIdx, setActiveTurnIdx] = useState<number>(-1);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(15);

  // Seats State
  const [seats, setSeats] = useState<PokerPlayerSeat[]>(() => {
    const initialHumanChips = currentUserChips > 0 ? currentUserChips : 2500;
    const initialSeats: PokerPlayerSeat[] = [
      {
        id: currentUserId,
        userId: currentUserId,
        name: username,
        avatar,
        color,
        chips: initialHumanChips,
        holeCards: [],
        currentBet: 0,
        totalHandBet: 0,
        folded: false,
        isAllIn: false,
        lastAction: null,
        isBot: false,
        seatIndex: 0,
      },
    ];

    // Add 4 bots from the pool
    for (let i = 1; i <= 4; i++) {
      const botProfile = BOT_PLAYERS_POOL[i - 1];
      initialSeats.push({
        id: `bot_${i}`,
        name: botProfile.name,
        avatar: null,
        color: botProfile.color,
        chips: Math.max(3000, bigBlind * 40 + Math.floor(Math.random() * 1500)),
        holeCards: [],
        currentBet: 0,
        totalHandBet: 0,
        folded: false,
        isAllIn: false,
        lastAction: null,
        isBot: true,
        botPersonality: botProfile.personality,
        seatIndex: i,
      });
    }

    return initialSeats;
  });

  // Winners announcement & Showdown State
  const [winnersList, setWinnersList] = useState<
    { seatIndex: number; name: string; amount: number; description: string; best5: Card[] }[] | null
  >(null);
  const [winningCardIds, setWinningCardIds] = useState<string[]>([]);
  const [showdownNotice, setShowdownNotice] = useState<string | null>(null);

  // Deck State
  const deckRef = useRef<Card[]>([]);

  // Raise Input Slider State for Human
  const [customRaiseAmount, setCustomRaiseAmount] = useState<number>(bigBlind * 2);

  // Timer Ref for clean unmount
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextHandTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References for latest state inside async loops
  const stateRef = useRef({
    seats,
    stage,
    pot,
    currentHighestBet,
    activeTurnIdx,
    dealerIdx,
    communityCards,
  });
  stateRef.current = {
    seats,
    stage,
    pot,
    currentHighestBet,
    activeTurnIdx,
    dealerIdx,
    communityCards,
  };

  // --- Fetch User Chips from DB on Mount & Sync via Socket ---
  useEffect(() => {
    const token = localStorage.getItem('lan_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    fetch(getApiUrl('/api/leaderboard?type=chips'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          const me = list.find((u: any) => u.id === currentUserId || u.username === username);
          if (me && me.chips !== undefined) {
            const dbChips = Number(me.chips);
            setCurrentUserChips(dbChips);
            localStorage.setItem('lan_user_chips', String(dbChips));
            setSeats((prev) =>
              prev.map((s) => (s && s.seatIndex === 0 ? { ...s, chips: Math.max(s.chips, dbChips) } : s))
            );
          }
        }
      })
      .catch(() => {});

    // Listen to real-time chips updates
    if (socket) {
      const handleChipsUpdated = (data: { userId: number; chips: number; message?: string }) => {
        if (data.userId === currentUserId) {
          const newChips = Number(data.chips);
          setCurrentUserChips(newChips);
          localStorage.setItem('lan_user_chips', String(newChips));
          setSeats((prev) =>
            prev.map((s) => (s && s.seatIndex === 0 ? { ...s, chips: newChips } : s))
          );
        }
      };
      socket.on('chips_updated', handleChipsUpdated);
      return () => {
        socket.off('chips_updated', handleChipsUpdated);
      };
    }
  }, [socket, currentUserId, username]);

  // Clean unmount timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (autoNextHandTimerRef.current) clearTimeout(autoNextHandTimerRef.current);
    };
  }, []);

  // --- Real-time Chip / Wallet Sync Helper (Socket + HTTP Fallback) ---
  const syncDelta = (delta: number) => {
    if (!delta || isNaN(delta) || delta === 0) return;

    // 1. Socket emit if connected
    if (socket && socket.connected) {
      socket.emit('update_game_chips', { delta, gameType: 'poker' });
    }

    // 2. HTTP sync as guarantee/fallback
    const token = localStorage.getItem('lan_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    fetch(getApiUrl('/api/chips/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ delta, gameType: 'poker' }),
    }).catch(() => {});

    // 3. Immediate local UI update
    setCurrentUserChips((prev) => {
      const next = Math.max(0, prev + delta);
      localStorage.setItem('lan_user_chips', String(next));
      return next;
    });
  };

  // --- Start a New Hand ---
  const startNewHand = () => {
    if (autoNextHandTimerRef.current) clearTimeout(autoNextHandTimerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Refresh deck
    const newDeck = shuffleDeck(createStandardDeck(1));
    deckRef.current = newDeck;

    // Reset winner notices
    setWinnersList(null);
    setWinningCardIds([]);
    setShowdownNotice(null);

    // Filter alive players (chips > 0, or auto-rebuy bots)
    const currentSeats = stateRef.current.seats.map((s) => {
      if (s.isBot && s.chips <= bigBlind * 2) {
        return { ...s, chips: Math.max(3000, bigBlind * 40) }; // Bot rebuy
      }
      return s;
    });

    const humanSeat = currentSeats[0];
    if (humanSeat.chips < bigBlind && humanSeat.chips <= 0) {
      // User is completely out of chips
      setShowdownNotice('Bakiyeniz tükendi! Lütfen yukarıdaki "Ücretsiz Çip Al" butonuna basarak çip yükleyin.');
      return;
    }

    // Advance Dealer button
    const nextDealerIdx = (stateRef.current.dealerIdx + 1) % currentSeats.length;
    setDealerIdx(nextDealerIdx);

    // Determine Small Blind and Big Blind seats
    const sbIdx = (nextDealerIdx + 1) % currentSeats.length;
    const bbIdx = (nextDealerIdx + 2) % currentSeats.length;

    // Deal 2 cards to each player & post blinds
    let handPot = 0;
    const dealtSeats = currentSeats.map((seat, idx) => {
      const c1 = deckRef.current.pop()!;
      const c2 = deckRef.current.pop()!;
      let seatChips = seat.chips;
      let currentBet = 0;
      let actionTag: string | null = null;
      let isAllIn = false;

      // Small blind
      if (idx === sbIdx) {
        const sbAmt = Math.min(seatChips, smallBlind);
        seatChips -= sbAmt;
        currentBet = sbAmt;
        handPot += sbAmt;
        actionTag = `Küçük Kör (+${sbAmt})`;
        if (seatChips === 0) isAllIn = true;
        if (idx === 0 && sbAmt > 0) {
          syncDelta(-sbAmt);
        }
      }
      // Big blind
      else if (idx === bbIdx) {
        const bbAmt = Math.min(seatChips, bigBlind);
        seatChips -= bbAmt;
        currentBet = bbAmt;
        handPot += bbAmt;
        actionTag = `Büyük Kör (+${bbAmt})`;
        if (seatChips === 0) isAllIn = true;
        if (idx === 0 && bbAmt > 0) {
          syncDelta(-bbAmt);
        }
      }

      return {
        ...seat,
        chips: seatChips,
        holeCards: [c1, c2],
        currentBet,
        totalHandBet: currentBet,
        folded: false,
        isAllIn,
        lastAction: actionTag,
        evaluation: undefined,
      };
    });

    // Play deal sound
    pokerAudio.playCardDeal();

    setSeats(dealtSeats);
    setCommunityCards([]);
    setPot(handPot);
    setStage('preflop');
    setCurrentHighestBet(bigBlind);
    setMinRaise(bigBlind * 2);
    setCustomRaiseAmount(bigBlind * 2);
    setHandNumber((prev) => prev + 1);

    // In preflop, first action is Under The Gun (UTG = BB + 1)
    const utgIdx = (bbIdx + 1) % dealtSeats.length;
    setActiveTurnIdx(utgIdx);
    setTurnTimeLeft(15);
  };

  // Start initial hand on mount
  useEffect(() => {
    startNewHand();
  }, []);

  // --- Live Human Hand Evaluation ---
  const mySeat = seats[0];
  const myLiveEvaluation = useMemo(() => {
    if (!mySeat || mySeat.holeCards.length === 0) return null;
    const allAvailable = [...mySeat.holeCards, ...communityCards];
    return evaluateBestHand(allAvailable);
  }, [mySeat?.holeCards, communityCards]);

  // --- Turn Timer & Bot Action Trigger ---
  useEffect(() => {
    if (stage === 'showdown' || stage === 'ended' || activeTurnIdx < 0) return;

    const activeSeat = seats[activeTurnIdx];
    if (!activeSeat || activeSeat.folded || activeSeat.isAllIn) {
      // Skip inactive player immediately
      advanceTurn(activeTurnIdx);
      return;
    }

    // If it's a Bot's turn, trigger decision with natural casino delay
    if (activeSeat.isBot) {
      const botDelay = 700 + Math.random() * 800; // 0.7s - 1.5s delay
      timerRef.current = setTimeout(() => {
        handleBotTurn(activeTurnIdx);
      }, botDelay);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    // If it's Human turn, start 15s turn countdown
    const interval = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-check or auto-fold on timeout
          const callAmount = currentHighestBet - (seats[0]?.currentBet || 0);
          if (callAmount <= 0) {
            handlePlayerAction('check');
          } else {
            handlePlayerAction('fold');
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTurnIdx, stage, currentHighestBet]);

  // --- Bot Turn Logic ---
  const handleBotTurn = (seatIdx: number) => {
    const currentSeats = [...stateRef.current.seats];
    const botSeat = currentSeats[seatIdx];
    if (!botSeat || botSeat.folded || botSeat.isAllIn) {
      advanceTurn(seatIdx);
      return;
    }

    const activePlayersCount = currentSeats.filter((s) => !s.folded).length;
    const botDecision = decideBotAction(
      botSeat,
      stateRef.current.communityCards,
      stateRef.current.pot,
      stateRef.current.currentHighestBet,
      bigBlind,
      minRaise,
      stateRef.current.stage,
      activePlayersCount
    );

    executeAction(seatIdx, botDecision.action, botDecision.amount, botDecision.message);
  };

  // --- Execute Any Action (Human or Bot) ---
  const executeAction = (seatIdx: number, action: PokerAction, raiseAmt = 0, customMessage?: string) => {
    const currentSeats = [...stateRef.current.seats];
    const seat = { ...currentSeats[seatIdx] };
    let newPot = stateRef.current.pot;
    let newHighestBet = stateRef.current.currentHighestBet;
    let newMinRaise = minRaise;

    const callCost = Math.max(0, newHighestBet - seat.currentBet);

    if (action === 'fold') {
      seat.folded = true;
      seat.lastAction = 'PAS';
      pokerAudio.playFold();
    } else if (action === 'check') {
      seat.lastAction = 'KONTROL';
      pokerAudio.playCheckTap();
    } else if (action === 'call') {
      const payAmount = Math.min(seat.chips, callCost);
      seat.chips -= payAmount;
      seat.currentBet += payAmount;
      seat.totalHandBet += payAmount;
      newPot += payAmount;
      if (seat.chips === 0) seat.isAllIn = true;
      seat.lastAction = seat.isAllIn ? 'ALL-IN' : `GÖRDÜ (${seat.currentBet})`;
      pokerAudio.playChipBet();
      if (seatIdx === 0 && payAmount > 0) {
        syncDelta(-payAmount);
      }
    } else if (action === 'raise' || action === 'allin') {
      // Calculate true raise
      const targetBet = Math.min(seat.currentBet + seat.chips, Math.max(newHighestBet + bigBlind, raiseAmt));
      const payAmount = targetBet - seat.currentBet;
      seat.chips -= payAmount;
      seat.currentBet = targetBet;
      seat.totalHandBet += payAmount;
      newPot += payAmount;

      if (seat.chips === 0) seat.isAllIn = true;

      const raiseDiff = targetBet - newHighestBet;
      newHighestBet = targetBet;
      newMinRaise = targetBet + Math.max(bigBlind, raiseDiff);

      seat.lastAction = seat.isAllIn ? `ALL-IN (${targetBet})` : `ARTIRDI (${targetBet})`;
      pokerAudio.playChipBet();
      if (seatIdx === 0 && payAmount > 0) {
        syncDelta(-payAmount);
      }
    }

    if (customMessage && !seat.isAllIn && action !== 'fold') {
      seat.lastAction = customMessage;
    }

    currentSeats[seatIdx] = seat;
    setSeats(currentSeats);
    setPot(newPot);
    setCurrentHighestBet(newHighestBet);
    setMinRaise(newMinRaise);

    // If only 1 player remains not folded, hand is over immediately!
    const activeNonFolded = currentSeats.filter((s) => !s.folded);
    if (activeNonFolded.length === 1) {
      settleLoneSurvivor(activeNonFolded[0], newPot, currentSeats);
      return;
    }

    // Otherwise, advance turn
    advanceTurn(seatIdx, currentSeats, newHighestBet);
  };

  // --- Advance Turn or Complete Betting Round ---
  const advanceTurn = (
    lastSeatIdx: number,
    currentSeats = stateRef.current.seats,
    highestBet = stateRef.current.currentHighestBet
  ) => {
    // Check if betting round is settled:
    // Round is complete if all active (non-folded) players have either:
    // 1. Matched the highest bet, OR
    // 2. Are All-in
    // AND everyone has had at least one turn to act!
    const eligibleToAct = currentSeats.filter((s) => !s.folded && !s.isAllIn);

    // If 0 or 1 player can act (e.g. everyone is all-in), run out the board!
    if (eligibleToAct.length <= 1) {
      const allEqualBets = eligibleToAct.every((s) => s.currentBet === highestBet);
      if (allEqualBets || eligibleToAct.length === 0) {
        advanceStreet(currentSeats);
        return;
      }
    }

    // Find next player
    let nextIdx = (lastSeatIdx + 1) % currentSeats.length;
    let checkedCount = 0;

    while (checkedCount < currentSeats.length) {
      const cand = currentSeats[nextIdx];
      if (!cand.folded && !cand.isAllIn) {
        // Found eligible next player
        // Check if round should end instead
        const allActedAndMatched = currentSeats
          .filter((s) => !s.folded && !s.isAllIn)
          .every((s) => s.lastAction !== null && s.currentBet === highestBet);

        if (allActedAndMatched) {
          advanceStreet(currentSeats);
          return;
        }

        setActiveTurnIdx(nextIdx);
        setTurnTimeLeft(15);
        return;
      }
      nextIdx = (nextIdx + 1) % currentSeats.length;
      checkedCount++;
    }

    // If nobody left to act, advance street
    advanceStreet(currentSeats);
  };

  // --- Advance Street (Preflop -> Flop -> Turn -> River -> Showdown) ---
  const advanceStreet = (currentSeats: PokerPlayerSeat[]) => {
    const currentStage = stateRef.current.stage;

    // Reset current street bets
    const resetSeats = currentSeats.map((s) => ({
      ...s,
      currentBet: 0,
      lastAction: s.folded ? 'PAS' : s.isAllIn ? 'ALL-IN' : null,
    }));

    setCurrentHighestBet(0);
    setMinRaise(bigBlind);
    setCustomRaiseAmount(bigBlind);

    if (currentStage === 'preflop') {
      // Deal Flop: Burn 1 card, deal 3 community cards
      deckRef.current.pop(); // Burn card
      const f1 = deckRef.current.pop()!;
      const f2 = deckRef.current.pop()!;
      const f3 = deckRef.current.pop()!;
      const newComm = [f1, f2, f3];
      setCommunityCards(newComm);
      setStage('flop');
      pokerAudio.playCardDeal();

      // First to act post-flop is first active seat after dealer
      setSeats(resetSeats);
      routePostFlopFirstTurn(resetSeats, newComm, 'flop');
    } else if (currentStage === 'flop') {
      // Deal Turn: Burn 1 card, deal 1 card
      deckRef.current.pop();
      const turnCard = deckRef.current.pop()!;
      const newComm = [...stateRef.current.communityCards, turnCard];
      setCommunityCards(newComm);
      setStage('turn');
      pokerAudio.playCardDeal();

      setSeats(resetSeats);
      routePostFlopFirstTurn(resetSeats, newComm, 'turn');
    } else if (currentStage === 'turn') {
      // Deal River: Burn 1 card, deal 1 card
      deckRef.current.pop();
      const riverCard = deckRef.current.pop()!;
      const newComm = [...stateRef.current.communityCards, riverCard];
      setCommunityCards(newComm);
      setStage('river');
      pokerAudio.playCardDeal();

      setSeats(resetSeats);
      routePostFlopFirstTurn(resetSeats, newComm, 'river');
    } else if (currentStage === 'river') {
      // Showdown!
      handleShowdown(resetSeats, stateRef.current.communityCards);
    }
  };

  // Helper to set first player after dealer on Flop/Turn/River
  const routePostFlopFirstTurn = (
    currentSeats: PokerPlayerSeat[],
    commCards: Card[],
    nextStage: PokerStage
  ) => {
    // If all but 1 are all-in, fast-forward remaining cards to showdown!
    const activeCanAct = currentSeats.filter((s) => !s.folded && !s.isAllIn);
    if (activeCanAct.length <= 1) {
      setTimeout(() => {
        if (nextStage === 'flop' || nextStage === 'turn') {
          advanceStreet(currentSeats);
        } else {
          handleShowdown(currentSeats, commCards);
        }
      }, 1000);
      setActiveTurnIdx(-1);
      return;
    }

    const dIdx = stateRef.current.dealerIdx;
    let nextIdx = (dIdx + 1) % currentSeats.length;
    let count = 0;
    while (count < currentSeats.length) {
      if (!currentSeats[nextIdx].folded && !currentSeats[nextIdx].isAllIn) {
        setActiveTurnIdx(nextIdx);
        setTurnTimeLeft(15);
        return;
      }
      nextIdx = (nextIdx + 1) % currentSeats.length;
      count++;
    }
    handleShowdown(currentSeats, commCards);
  };

  // --- Lone Survivor Settlement (Everyone else folded) ---
  const settleLoneSurvivor = (winner: PokerPlayerSeat, totalPot: number, currentSeats: PokerPlayerSeat[]) => {
    setStage('ended');
    setActiveTurnIdx(-1);

    const winnerSeatIdx = winner.seatIndex;
    const isHuman = winnerSeatIdx === 0;

    // Award pot to winner
    const updatedSeats = currentSeats.map((s) => {
      if (s.seatIndex === winnerSeatIdx) {
        return {
          ...s,
          chips: s.chips + totalPot,
          lastAction: 'KAZANDI! 🏆',
        };
      }
      return s;
    });

    setSeats(updatedSeats);
    setPot(0);
    pokerAudio.playWinPot();

    // Persist real DB chips if human was the lone winner
    if (isHuman) {
      syncDelta(totalPot);
    }
    // If human folded/lost, bets were already deducted in real time as they were placed!

    setShowdownNotice(`🏆 ${winner.name} diğer tüm oyuncular çekildiği için potu kazandı! (+${totalPot.toLocaleString()} 🪙)`);

    // Auto next hand after 3.8s
    autoNextHandTimerRef.current = setTimeout(() => {
      startNewHand();
    }, 3800);
  };

  // --- Side Pot & Pot Distribution Algorithm ---
  const distributePots = (
    allSeats: PokerPlayerSeat[],
    evaluations: Map<number, HandEvaluation>
  ): Map<number, number> => {
    const payouts = new Map<number, number>();
    allSeats.forEach((s) => payouts.set(s.seatIndex, 0));

    // Get all contributions
    const contributions = allSeats.map((s) => ({
      seatIndex: s.seatIndex,
      folded: s.folded,
      bet: s.totalHandBet,
      eval: evaluations.get(s.seatIndex),
    }));

    // Find all unique bet levels > 0, sorted ascending
    const distinctLevels = Array.from(
      new Set(contributions.map((c) => c.bet).filter((b) => b > 0))
    ).sort((a, b) => a - b);

    let prevLevel = 0;
    for (const level of distinctLevels) {
      const tierContribution = level - prevLevel;
      if (tierContribution <= 0) continue;

      let tierPot = 0;
      const eligibleWinners: typeof contributions = [];

      for (const c of contributions) {
        if (c.bet >= level) {
          tierPot += tierContribution;
          if (!c.folded && c.eval) {
            eligibleWinners.push(c);
          }
        } else if (c.bet > prevLevel) {
          tierPot += c.bet - prevLevel;
        }
      }

      if (eligibleWinners.length > 0 && tierPot > 0) {
        let bestEval = eligibleWinners[0].eval!;
        for (let i = 1; i < eligibleWinners.length; i++) {
          if (compareEvaluations(eligibleWinners[i].eval!, bestEval) > 0) {
            bestEval = eligibleWinners[i].eval!;
          }
        }

        const tierWinners = eligibleWinners.filter(
          (w) => compareEvaluations(w.eval!, bestEval) === 0
        );

        const share = Math.floor(tierPot / tierWinners.length);
        const remainder = tierPot % tierWinners.length;

        tierWinners.forEach((w, idx) => {
          const currentPayout = payouts.get(w.seatIndex) || 0;
          payouts.set(w.seatIndex, currentPayout + share + (idx === 0 ? remainder : 0));
        });
      }

      prevLevel = level;
    }

    return payouts;
  };

  // --- Showdown Evaluation & Pot Distribution ---
  const handleShowdown = (finalSeats: PokerPlayerSeat[], commCards: Card[]) => {
    setStage('showdown');
    setActiveTurnIdx(-1);

    const activePlayers = finalSeats.filter((s) => !s.folded);

    // Evaluate hand for every active player
    const evalMap = new Map<number, HandEvaluation>();
    const evaluatedPlayers = activePlayers.map((p) => {
      const all7 = [...p.holeCards, ...commCards];
      const evaluation = evaluateBestHand(all7);
      evalMap.set(p.seatIndex, evaluation);
      return {
        ...p,
        evaluation,
      };
    });

    // Update seats with evaluations so UI can display their best hands
    setSeats((prev) =>
      prev.map((s) => {
        const found = evaluatedPlayers.find((ep) => ep.seatIndex === s.seatIndex);
        return found ? found : s;
      })
    );

    // Calculate side pots and payouts
    const payouts = distributePots(finalSeats, evalMap);

    // Find winners who received > 0 chips
    const winningSeats = finalSeats.filter((s) => (payouts.get(s.seatIndex) || 0) > 0);
    const primaryWinner = winningSeats[0] || activePlayers[0];
    const bestEval = evalMap.get(primaryWinner.seatIndex);

    const winCardIds = bestEval ? bestEval.best5Cards.map((c) => c.id || `${c.suit}_${c.rank}`) : [];
    setWinningCardIds(winCardIds);

    const winnersSummary = winningSeats.map((w) => ({
      seatIndex: w.seatIndex,
      name: w.name,
      amount: payouts.get(w.seatIndex) || 0,
      description: evalMap.get(w.seatIndex)?.descriptionTr || '',
      best5: evalMap.get(w.seatIndex)?.best5Cards || [],
    }));

    setWinnersList(winnersSummary);
    pokerAudio.playWinPot();

    // Distribute payouts to seats
    const updatedSeats = finalSeats.map((s) => {
      const payout = payouts.get(s.seatIndex) || 0;
      if (payout > 0) {
        return {
          ...s,
          chips: s.chips + payout,
          lastAction: winningSeats.length > 1 ? `BÖLÜŞTÜ (+${payout})` : `KAZANDI (+${payout})`,
        };
      }
      return {
        ...s,
        lastAction: s.folded ? 'PAS' : 'KAYBETTİ',
      };
    });

    setSeats(updatedSeats);
    setPot(0);

    // Real-time synchronization of human winnings
    const humanPayout = payouts.get(0) || 0;
    if (humanPayout > 0) {
      syncDelta(humanPayout);
    }
    // If human did not win, their bets were already deducted in real time when placed!

    if (winningSeats.length > 1) {
      setShowdownNotice(`🤝 Beraberlik / Yan Potlar! Kazananlar: ${winningSeats.map((w) => `${w.name} (+${payouts.get(w.seatIndex)?.toLocaleString()} 🪙)`).join(', ')}`);
    } else if (winningSeats.length === 1) {
      const w = winningSeats[0];
      const desc = evalMap.get(w.seatIndex)?.descriptionTr || '';
      setShowdownNotice(`🏆 KAZANAN: ${w.name} — ${desc} (+${payouts.get(w.seatIndex)?.toLocaleString()} 🪙)`);
    }

    // Auto next hand after 4.8s
    autoNextHandTimerRef.current = setTimeout(() => {
      startNewHand();
    }, 4800);
  };

  const netGainSafe = (n: number) => (isNaN(n) ? 0 : n);

  const compareEvaluations = (a: HandEvaluation, b: HandEvaluation) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const maxLen = Math.max(a.tiebreakers.length, b.tiebreakers.length);
    for (let i = 0; i < maxLen; i++) {
      const valA = a.tiebreakers[i] ?? 0;
      const valB = b.tiebreakers[i] ?? 0;
      if (valA !== valB) return valA - valB;
    }
    return 0;
  };

  // --- Human Action Handlers ---
  const handlePlayerAction = (action: PokerAction, amt = 0) => {
    if (activeTurnIdx !== 0 || stage === 'showdown' || stage === 'ended') return;
    executeAction(0, action, amt);
  };

  // --- Free Chips Refill (Under 100 chips) ---
  const handleRefillChips = async () => {
    if (isRefilling) return;
    setIsRefilling(true);
    try {
      const token = localStorage.getItem('lan_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
      const res = await fetch(getApiUrl('/api/chips/refill'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserChips(500);
        localStorage.setItem('lan_user_chips', '500');
        setSeats((prev) =>
          prev.map((s) => (s && s.seatIndex === 0 ? { ...s, chips: 500 } : s))
        );
        pokerAudio.playWinPot();
      } else {
        alert(data.error || 'Çip yüklenemedi.');
      }
    } catch {
      alert('Sunucu bağlantı hatası.');
    } finally {
      setIsRefilling(false);
    }
  };

  // Dynamic calculations for human controls
  const myCurrentBet = mySeat?.currentBet || 0;
  const myChips = mySeat?.chips || 0;
  const callAmount = Math.max(0, currentHighestBet - myCurrentBet);
  const canCheck = callAmount === 0;
  const canRaise = myChips > callAmount && stage !== 'showdown' && stage !== 'ended';
  const minRaiseTarget = Math.min(myCurrentBet + myChips, Math.max(currentHighestBet + bigBlind, minRaise));
  const maxRaiseTarget = myCurrentBet + myChips;

  // Preset Raise Values
  const handlePresetRaise = (multiplier: number | 'halfPot' | 'pot' | 'allin') => {
    if (multiplier === 'allin') {
      setCustomRaiseAmount(maxRaiseTarget);
    } else if (multiplier === 'halfPot') {
      const target = Math.min(maxRaiseTarget, Math.max(minRaiseTarget, currentHighestBet + Math.round(pot / 2)));
      setCustomRaiseAmount(target);
    } else if (multiplier === 'pot') {
      const target = Math.min(maxRaiseTarget, Math.max(minRaiseTarget, currentHighestBet + pot));
      setCustomRaiseAmount(target);
    } else {
      const target = Math.min(maxRaiseTarget, Math.max(minRaiseTarget, currentHighestBet + bigBlind * multiplier));
      setCustomRaiseAmount(target);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-slate-950 text-white select-none overflow-hidden font-sans">
      {/* ====================================================================== */}
      {/* 1. TOP HEADER & WALLET BAR */}
      {/* ====================================================================== */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Lobiye Dön</span>
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                {tableTitle}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] sm:text-xs font-mono font-black">
                SB {smallBlind} / BB {bigBlind}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400">
              <span>El #{handNumber}</span>
              <span>•</span>
              <span className="uppercase font-bold text-emerald-400 tracking-wider">
                {stage === 'preflop' ? 'Pre-Flop' : stage === 'flop' ? 'Flop' : stage === 'turn' ? 'Turn' : stage === 'river' ? 'River' : 'El Sonu'}
              </span>
            </div>
          </div>
        </div>

        {/* User Balance Wallet & Audio Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Free Refill Chips button if low balance */}
          {(mySeat?.chips || currentUserChips) <= 100 && (
            <button
              onClick={handleRefillChips}
              disabled={isRefilling}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
              title="Ücretsiz 500 Çip Al"
            >
              <PlusCircle size={15} />
              <span>+500 🪙</span>
            </button>
          )}

          {/* Chips Wallet Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-inner">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs">
              🪙
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Cüzdan</span>
              <span className="font-mono font-black text-xs sm:text-sm text-amber-300">
                {(mySeat ? mySeat.chips : currentUserChips).toLocaleString()} 🪙
              </span>
            </div>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={toggleMute}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* ====================================================================== */}
      {/* 2. MAIN FELT POKER TABLE AREA */}
      {/* ====================================================================== */}
      <main className="flex-1 relative w-full flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Luxury Casino Table Rim and Felt */}
        <div
          className="relative w-full max-w-5xl h-full max-h-[640px] rounded-[60px] sm:rounded-[120px] p-3 sm:p-6 border-[8px] sm:border-[14px] border-[#2d1b0d] shadow-2xl flex flex-col justify-between items-center overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at center, #0d4a2d 0%, #062b1a 60%, #03140c 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.9)',
          }}
        >
          {/* Subtle Felt Texture Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Golden Table Border Line */}
          <div className="absolute inset-3 sm:inset-6 rounded-[48px] sm:rounded-[100px] border border-amber-500/25 pointer-events-none shadow-inner" />

          {/* ------------------------------------------------------------------ */}
          {/* TOP SEATS ROW (Bots 2 and 3) */}
          {/* ------------------------------------------------------------------ */}
          <div className="w-full flex justify-around items-center z-10 pt-1">
            {seats[2] && <PokerSeatNode seat={seats[2]} isTurn={activeTurnIdx === 2} isDealer={dealerIdx === 2} winningCardIds={winningCardIds} />}
            {seats[3] && <PokerSeatNode seat={seats[3]} isTurn={activeTurnIdx === 3} isDealer={dealerIdx === 3} winningCardIds={winningCardIds} />}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* CENTER TABLE: POT & COMMUNITY CARDS & WINNER BANNER */}
          {/* ------------------------------------------------------------------ */}
          <div className="w-full flex flex-col items-center justify-center my-auto z-10 space-y-2 sm:space-y-3">
            {/* Total Pot Display Box */}
            <div className="flex items-center gap-2.5 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-slate-950/80 border border-amber-500/40 shadow-xl backdrop-blur-md animate-in zoom-in-95">
              <span className="text-amber-400 font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5">
                <Coins size={16} className="text-amber-400 animate-spin-slow" />
                TOPLAM POT:
              </span>
              <span className="font-mono font-black text-base sm:text-xl text-yellow-300">
                {pot.toLocaleString()} 🪙
              </span>
            </div>

            {/* 5 Community Cards Area */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-3 p-2 rounded-2xl bg-black/30 border border-emerald-500/20 backdrop-blur-xs min-h-[90px] sm:min-h-[110px]">
              {[0, 1, 2, 3, 4].map((slotIdx) => {
                const card = communityCards[slotIdx];
                const isWinningCard = card && winningCardIds.includes(card.id || `${card.suit}_${card.rank}`);
                return (
                  <div key={`comm-slot-${slotIdx}`} className="relative transition-all duration-300">
                    {card ? (
                      <div className={`transition-all duration-300 transform ${isWinningCard ? 'scale-105 ring-4 ring-amber-400 rounded-xl shadow-lg shadow-amber-500/50' : ''}`}>
                        <PlayingCard card={card} size="sm" />
                      </div>
                    ) : (
                      <div className="w-11 h-16 sm:w-14 sm:h-20 rounded-lg sm:rounded-xl border-2 border-dashed border-emerald-600/30 bg-emerald-950/20 flex flex-col items-center justify-center text-[10px] text-emerald-400/50 font-bold select-none">
                        <span>{slotIdx < 3 ? 'FLOP' : slotIdx === 3 ? 'TURN' : 'RIVER'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Announcement / Showdown Winner Banner */}
            {showdownNotice && (
              <div className="px-4 py-2 rounded-xl bg-slate-950/90 border border-amber-400 text-amber-300 font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95 max-w-lg text-center">
                <Sparkles size={18} className="text-amber-400 shrink-0 animate-bounce" />
                <span>{showdownNotice}</span>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* MID / BOTTOM ROW: Left Bot 1, Human (Center), Right Bot 4 */}
          {/* ------------------------------------------------------------------ */}
          <div className="w-full flex justify-between items-end z-10 pb-1 sm:pb-2 px-2 sm:px-8">
            {/* Left Bot 1 */}
            {seats[1] && <PokerSeatNode seat={seats[1]} isTurn={activeTurnIdx === 1} isDealer={dealerIdx === 1} winningCardIds={winningCardIds} />}

            {/* Center: Human Seat (Seat 0) */}
            {seats[0] && (
              <div className="flex flex-col items-center">
                {/* Dealer button for human if dealer */}
                {dealerIdx === 0 && (
                  <div className="mb-1 w-6 h-6 rounded-full bg-white text-slate-950 font-black text-xs flex items-center justify-center shadow-lg border border-amber-400 animate-pulse">
                    D
                  </div>
                )}
                {/* Active Street Bet chip */}
                {seats[0].currentBet > 0 && (
                  <div className="mb-1.5 px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-mono font-black shadow-md flex items-center gap-1">
                    🪙 {seats[0].currentBet.toLocaleString()}
                  </div>
                )}

                {/* Human Cards */}
                <div className="flex items-center gap-2 mb-2">
                  {seats[0].holeCards.map((card, cIdx) => {
                    const isWinningCard = card && winningCardIds.includes(card.id || `${card.suit}_${card.rank}`);
                    return (
                      <div
                        key={`human-card-${cIdx}`}
                        className={`transition-all duration-300 transform hover:-translate-y-2 ${
                          isWinningCard ? 'scale-105 ring-4 ring-amber-400 rounded-xl shadow-xl shadow-amber-500/60' : ''
                        }`}
                      >
                        <PlayingCard card={card} size="md" />
                      </div>
                    );
                  })}
                </div>

                {/* Human Player Info Pill */}
                <div
                  className={`flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/90 border shadow-xl backdrop-blur-md transition-all ${
                    activeTurnIdx === 0
                      ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-500/20'
                      : 'border-slate-800'
                  }`}
                >
                  <Avatar
                    url={avatar}
                    name={username}
                    color={color}
                    size={9}
                    className="ring-2 ring-emerald-400/40"
                  />
                  <div className="flex flex-col">
                    <span className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5">
                      {username}
                      {seats[0].lastAction && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                          {seats[0].lastAction}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-amber-300 font-bold">
                      {seats[0].chips.toLocaleString()} 🪙
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Right Bot 4 */}
            {seats[4] && <PokerSeatNode seat={seats[4]} isTurn={activeTurnIdx === 4} isDealer={dealerIdx === 4} winningCardIds={winningCardIds} />}
          </div>
        </div>
      </main>

      {/* ====================================================================== */}
      {/* 3. DOCK CONTROLS & LIVE HAND STRENGTH */}
      {/* ====================================================================== */}
      <footer className="w-full bg-slate-900/95 border-t border-slate-800 p-2 sm:p-4 shrink-0 z-30 shadow-2xl flex flex-col items-center gap-2">
        {/* Live Hand Strength Indicator Badge */}
        {myLiveEvaluation && (
          <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-300 font-bold shadow-inner">
            <span className="text-emerald-400 flex items-center gap-1">
              <Award size={15} />
              Mevcut El Gücü:
            </span>
            <span className="text-white font-extrabold">{myLiveEvaluation.descriptionTr}</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono uppercase">
              {myLiveEvaluation.tierNameTr}
            </span>
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Quick Presets Slider / Buttons */}
          {activeTurnIdx === 0 && canRaise && (
            <div className="w-full sm:w-auto flex flex-col gap-1.5 items-center sm:items-start">
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => handlePresetRaise(2)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-black text-slate-300 transition-colors cursor-pointer"
                >
                  Min (+{minRaiseTarget - currentHighestBet})
                </button>
                <button
                  onClick={() => handlePresetRaise('halfPot')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-black text-slate-300 transition-colors cursor-pointer"
                >
                  1/2 Pot
                </button>
                <button
                  onClick={() => handlePresetRaise('pot')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-black text-slate-300 transition-colors cursor-pointer"
                >
                  Pot (+{pot})
                </button>
                <button
                  onClick={() => handlePresetRaise('allin')}
                  className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-[11px] font-black text-rose-300 transition-colors cursor-pointer border border-rose-500/40"
                >
                  ALL-IN ({maxRaiseTarget})
                </button>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  type="range"
                  min={minRaiseTarget}
                  max={maxRaiseTarget}
                  step={bigBlind}
                  value={customRaiseAmount}
                  onChange={(e) => setCustomRaiseAmount(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                />
                <span className="font-mono text-xs font-black text-amber-300 shrink-0">
                  {customRaiseAmount.toLocaleString()} 🪙
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
            {activeTurnIdx === 0 ? (
              <>
                {/* FOLD Button */}
                <button
                  onClick={() => handlePlayerAction('fold')}
                  className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-rose-600/90 hover:bg-rose-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-rose-950/40 transition-all cursor-pointer border border-rose-400/40"
                >
                  PAS (FOLD)
                </button>

                {/* CHECK or CALL Button */}
                {canCheck ? (
                  <button
                    onClick={() => handlePlayerAction('check')}
                    className="flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-950/40 transition-all cursor-pointer border border-emerald-400/40"
                  >
                    KONTROL (CHECK)
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlayerAction('call')}
                    className="flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-950/40 transition-all cursor-pointer border border-blue-400/40"
                  >
                    {myChips <= callAmount
                      ? `ALL-IN (${myChips.toLocaleString()} 🪙)`
                      : `GÖR (${callAmount.toLocaleString()} 🪙)`}
                  </button>
                )}

                {/* RAISE Button */}
                {canRaise && (
                  <button
                    onClick={() => handlePlayerAction('raise', customRaiseAmount)}
                    className="flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950/40 transition-all cursor-pointer border border-yellow-300"
                  >
                    ARTIR ({customRaiseAmount.toLocaleString()} 🪙)
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm font-bold py-2">
                <Clock size={16} className="text-amber-400 animate-spin" />
                <span>
                  Sıra bekleniyor...{' '}
                  <span className="text-white">
                    {seats[activeTurnIdx]?.name || 'Diğer oyuncular'} düşünüyor ({turnTimeLeft}s)
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// BOT & OPPONENT SEAT NODE COMPONENT
// ============================================================================
interface PokerSeatNodeProps {
  seat: PokerPlayerSeat;
  isTurn: boolean;
  isDealer: boolean;
  winningCardIds: string[];
}

function PokerSeatNode({ seat, isTurn, isDealer, winningCardIds }: PokerSeatNodeProps) {
  const isFolded = seat.folded;

  return (
    <div
      className={`relative flex flex-col items-center transition-all duration-300 ${
        isFolded ? 'opacity-40 grayscale-[50%]' : ''
      }`}
    >
      {/* Dealer Puck Button */}
      {isDealer && (
        <div className="absolute -top-3 -right-2 w-5 h-5 rounded-full bg-white text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-amber-400 z-20">
          D
        </div>
      )}

      {/* Street Bet Chip Indicator in front of seat */}
      {seat.currentBet > 0 && (
        <div className="mb-1 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-mono font-black shadow-md flex items-center gap-1 z-10">
          🪙 {seat.currentBet.toLocaleString()}
        </div>
      )}

      {/* Opponent Hole Cards */}
      <div className="flex items-center gap-1 mb-1">
        {seat.holeCards.length === 2 && (
          <>
            {/* If folded or showdown not reached: face down. If Showdown reached: REVEAL CARDS! */}
            {seat.evaluation ? (
              seat.holeCards.map((card, i) => {
                const isWin = winningCardIds.includes(card.id || `${card.suit}_${card.rank}`);
                return (
                  <div
                    key={`hole-${seat.seatIndex}-${i}`}
                    className={`transition-all duration-300 transform ${
                      isWin ? 'scale-105 ring-2 ring-amber-400 rounded-lg shadow-md' : ''
                    }`}
                  >
                    <PlayingCard card={card} size="xs" />
                  </div>
                );
              })
            ) : (
              <>
                <PlayingCard faceDown size="xs" />
                <PlayingCard faceDown size="xs" />
              </>
            )}
          </>
        )}
      </div>

      {/* Player Pill */}
      <div
        className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-2xl bg-slate-900/90 border shadow-lg backdrop-blur-md transition-all ${
          isTurn
            ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-500/30'
            : 'border-slate-800'
        }`}
      >
        <Avatar
          url={seat.avatar}
          name={seat.name}
          color={seat.color}
          size={7}
          className="ring-1 ring-slate-700"
        />
        <div className="flex flex-col text-left">
          <span className="font-extrabold text-[11px] sm:text-xs text-white truncate max-w-[90px] sm:max-w-[120px]">
            {seat.name}
          </span>
          <span className="font-mono text-[10px] sm:text-xs text-amber-300 font-bold">
            {seat.chips.toLocaleString()} 🪙
          </span>
        </div>
      </div>

      {/* Action Tag Badge */}
      {seat.lastAction && (
        <div
          className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shadow tracking-wider ${
            seat.lastAction.includes('PAS')
              ? 'bg-rose-900/80 text-rose-300 border border-rose-700/50'
              : seat.lastAction.includes('ALL-IN')
              ? 'bg-purple-900/80 text-purple-300 border border-purple-600/50'
              : seat.lastAction.includes('KAZANDI')
              ? 'bg-amber-500 text-slate-950 font-black animate-bounce'
              : 'bg-emerald-900/80 text-emerald-300 border border-emerald-700/50'
          }`}
        >
          {seat.lastAction}
        </div>
      )}
    </div>
  );
}
