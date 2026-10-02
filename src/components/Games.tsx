import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, Users, ChevronRight, Trophy, Sparkles, Bot, ShieldCheck, 
  Crown, Medal, RefreshCw, Palette, Search, Flame, Layers, Zap, Brain, Play, Plus,
  Coins, FileText, AlertTriangle
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import OkeyGame from './OkeyGame';
import Okey101Board from './Okey101Board';
import UnoGame from './UnoGame';
import DrawGuessGame from './DrawGuessGame';
import BlackjackGame from './BlackjackGame';
import BatakGame from './BatakGame';
import TexasHoldemPokerGame from './TexasHoldemPokerGame';
import MiniBattleRoyale from './MiniBattleRoyale';
import PartyMode from './PartyMode';
import CardTableLobbyModal, { CardTableInfo, CreateTableOptions } from './CardTableLobbyModal';
import AdminChipManagerModal from './AdminChipManagerModal';
import KvkkModal from './KvkkModal';
import PlayingCard from './PlayingCard';
import Avatar from './Avatar';
import { getApiUrl, getAuthHeaders } from '../utils/api';

interface GamesProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onUserClick?: (id: number) => void;
}

interface LeaderboardUser {
  id: number;
  username: string;
  avatar: string | null;
  color?: string | null;
  okey_wins?: number;
  okey101_wins?: number;
  uno_wins?: number;
  blackjack_wins?: number;
  batak_wins?: number;
  poker_wins?: number;
  royale_wins?: number;
  chips?: number;
}

type GameCategory = 'all' | 'cards' | 'arcade' | 'strategy' | 'active_lobbies';
type SelectedGameType = 'hub' | 'okey' | 'okey101' | 'uno' | 'drawguess' | 'blackjack' | 'batak' | 'poker' | 'battleroyale' | 'party';

export default function Games({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onUserClick
}: GamesProps) {
  const [selectedGame, setSelectedGame] = useState<SelectedGameType>('hub');
  const [activeCategory, setActiveCategory] = useState<GameCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active room counters
  const [okeyRoomCount, setOkeyRoomCount] = useState<number>(0);
  const [okey101RoomCount, setOkey101RoomCount] = useState<number>(0);
  const [unoRoomCount, setUnoRoomCount] = useState<number>(0);
  const [drawguessRoomCount, setDrawguessRoomCount] = useState<number>(0);
  const [blackjackRoomCount, setBlackjackRoomCount] = useState<number>(0);
  const [batakRoomCount, setBatakRoomCount] = useState<number>(0);

  // Active open tables list (Only real user tables, no fake bot tables)
  const [activeTables, setActiveTables] = useState<CardTableInfo[]>([]);
  const [selectedGameTableId, setSelectedGameTableId] = useState<string | null>(null);

  // Modal for creating/browsing card tables
  const [lobbyModalGame, setLobbyModalGame] = useState<'blackjack' | 'batak' | 'poker' | null>(null);
  const [lobbyInitialTab, setLobbyInitialTab] = useState<'create' | 'browse'>('create');
  const [playMenuGame, setPlayMenuGame] = useState<'blackjack' | 'batak' | 'poker' | null>(null);
  const [blackjackTableOptions, setBlackjackTableOptions] = useState<CreateTableOptions | null>(null);
  const [pokerTableOptions, setPokerTableOptions] = useState<CreateTableOptions | null>(null);

  // Leaderboard state
  const [leaderboardTab, setLeaderboardTab] = useState<'chips' | 'okey' | 'uno' | 'blackjack' | 'batak' | 'poker' | 'royale'>('chips');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [showAdminChipsModal, setShowAdminChipsModal] = useState<boolean>(false);
  const [showKvkkModal, setShowKvkkModal] = useState<boolean>(false);

  const isEmirgan = username?.toLowerCase().trim() === 'emirgan';

  // Fetch leaderboard data
  const fetchLeaderboard = (tab: 'chips' | 'okey' | 'uno' | 'blackjack' | 'batak' | 'poker' | 'royale') => {
    setLoadingLeaderboard(true);
    if (socket && socket.connected) {
      socket.emit("get_leaderboard", { type: tab }, (rows: LeaderboardUser[]) => {
        setLeaderboardData(rows || []);
        setLoadingLeaderboard(false);
      });
    } else {
      fetch(getApiUrl(`/api/leaderboard?type=${tab}`), { credentials: 'include', headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLeaderboardData(data);
          setLoadingLeaderboard(false);
        })
        .catch(() => setLoadingLeaderboard(false));
    }
  };

  useEffect(() => {
    fetchLeaderboard(leaderboardTab);
  }, [leaderboardTab, socket]);

  useEffect(() => {
    if (!socket) return;
    const onLbUpdate = () => fetchLeaderboard(leaderboardTab);
    socket.on("leaderboard_updated", onLbUpdate);
    socket.on("chips_updated", onLbUpdate);
    return () => {
      socket.off("leaderboard_updated", onLbUpdate);
      socket.off("chips_updated", onLbUpdate);
    };
  }, [socket, leaderboardTab]);

  // Android Hardware Back Button integration for Games
  useEffect(() => {
    const handleBack = (e: any) => {
      if (showKvkkModal) {
        setShowKvkkModal(false);
        if (e.detail) e.detail.handled = true;
        return;
      }
      if (showAdminChipsModal) {
        setShowAdminChipsModal(false);
        if (e.detail) e.detail.handled = true;
        return;
      }
      if (lobbyModalGame) {
        setLobbyModalGame(null);
        if (e.detail) e.detail.handled = true;
        return;
      }
      if (selectedGame !== 'hub') {
        setSelectedGame('hub');
        if (e.detail) e.detail.handled = true;
        return;
      }
    };
    window.addEventListener("kaps:hardware_back", handleBack);
    return () => {
      window.removeEventListener("kaps:hardware_back", handleBack);
    };
  }, [showKvkkModal, showAdminChipsModal, lobbyModalGame, selectedGame]);

  // Auto-detect room events on mount
  useEffect(() => {
    if (!socket) return;

    const onOkeyRooms = (rooms: any[]) => setOkeyRoomCount(rooms?.length || 0);
    const onOkey101Rooms = (rooms: any[]) => setOkey101RoomCount(rooms?.length || 0);
    const onUnoRooms = (rooms: any[]) => setUnoRoomCount(rooms?.length || 0);
    const onDrawGuessRooms = (rooms: any[]) => setDrawguessRoomCount(rooms?.length || 0);
    const onActiveTables = (tables: CardTableInfo[]) => {
      if (Array.isArray(tables)) {
        setActiveTables(tables);
        setBlackjackRoomCount(tables.filter(t => t.gameType === 'blackjack').length);
        setBatakRoomCount(tables.filter(t => t.gameType === 'batak').length);
        setOkeyRoomCount(tables.filter(t => t.gameType === 'okey').length);
        setOkey101RoomCount(tables.filter(t => t.gameType === 'okey101').length);
        setUnoRoomCount(tables.filter(t => t.gameType === 'uno').length);
        setDrawguessRoomCount(tables.filter(t => t.gameType === 'drawguess').length);
      }
    };

    const onTableChange = () => {
      socket.emit("get_active_tables", (tables: CardTableInfo[]) => onActiveTables(tables));
    };

    socket.on("okey_rooms_list", onOkeyRooms);
    socket.on("okey101_rooms_list", onOkey101Rooms);
    socket.on("uno_rooms_list", onUnoRooms);
    socket.on("drawguess_rooms_list", onDrawGuessRooms);
    socket.on("active_tables_updated", onActiveTables);
    socket.on("table:created", onTableChange);
    socket.on("table:updated", onTableChange);
    socket.on("table:deleted", onTableChange);

    socket.emit("get_okey_rooms");
    socket.emit("get_okey101_rooms");
    socket.emit("get_uno_rooms");
    socket.emit("get_drawguess_rooms");
    socket.emit("get_active_tables", (tables: CardTableInfo[]) => onActiveTables(tables));

    // HTTP Fallback
    fetch(getApiUrl("/api/active-tables"))
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tables)) {
          onActiveTables(data.tables);
        }
      })
      .catch(() => {});

    return () => {
      socket.off("okey_rooms_list", onOkeyRooms);
      socket.off("okey101_rooms_list", onOkey101Rooms);
      socket.off("uno_rooms_list", onUnoRooms);
      socket.off("drawguess_rooms_list", onDrawGuessRooms);
      socket.off("active_tables_updated", onActiveTables);
      socket.off("table:created", onTableChange);
      socket.off("table:updated", onTableChange);
      socket.off("table:deleted", onTableChange);
    };
  }, [socket]);

  // Total active tables count
  const totalActiveTablesCount = okeyRoomCount + okey101RoomCount + unoRoomCount + drawguessRoomCount + blackjackRoomCount + batakRoomCount;

  // Route: Okey
  if (selectedGame === 'okey') {
    return (
      <OkeyGame 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        targetRoomId={selectedGameTableId}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Route: 101 Okey
  if (selectedGame === 'okey101') {
    return (
      <Okey101Board 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        targetRoomId={selectedGameTableId}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Route: UNO
  if (selectedGame === 'uno') {
    return (
      <UnoGame 
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        targetRoomId={selectedGameTableId || undefined}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Route: Draw & Guess
  if (selectedGame === 'drawguess') {
    return (
      <DrawGuessGame
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onBackToHub={() => setSelectedGame('hub')}
      />
    );
  }

  // Route: Texas Hold'em Poker
  if (selectedGame === 'poker') {
    return (
      <TexasHoldemPokerGame
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color || '#3b82f6'}
        tableId={selectedGameTableId}
        tableOptions={pokerTableOptions}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
          setPokerTableOptions(null);
        }}
      />
    );
  }

  // Route: Blackjack 21
  if (selectedGame === 'blackjack') {
    return (
      <BlackjackGame
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        tableId={selectedGameTableId}
        tableOptions={blackjackTableOptions}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
          setBlackjackTableOptions(null);
        }}
      />
    );
  }

  // Route: Batak (NEW)
  if (selectedGame === 'batak') {
    return (
      <BatakGame
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        tableId={selectedGameTableId}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Route: Mini Battle Royale (2D)
  if (selectedGame === 'battleroyale') {
    return (
      <MiniBattleRoyale
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        targetTableId={selectedGameTableId}
        onBackToHub={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Route: Party Mode (2-10 Players Tournament)
  if (selectedGame === 'party') {
    return (
      <PartyMode
        socket={socket}
        currentUserId={currentUserId}
        username={username}
        avatar={avatar}
        color={color}
        onUserClick={onUserClick}
        onBack={() => {
          setSelectedGame('hub');
          setSelectedGameTableId(null);
        }}
      />
    );
  }

  // Games definition list
  const allGames = [
    {
      id: 'blackjack',
      title: 'Blackjack (21)',
      subtitle: 'VIP Casino Masası • Krupiyeli & Bot Destekli',
      category: ['cards'],
      badge: 'YENİ CASINO',
      badgeColor: 'bg-amber-500 text-slate-950',
      gradient: 'from-amber-600 via-yellow-500 to-amber-700',
      icon: '🃏',
      capacity: '1-5 Oyuncu & Bot',
      activeRooms: blackjackRoomCount,
      features: [
        '6 Destelik Shoe & Fisher-Yates karıştırma',
        'Hit, Stand, Double Down & Split seçenekleri',
        'As (Soft/Hard) dinamik hesaplama ve 3:2 Blackjack ödemesi'
      ],
      preview: (
        <div className="flex items-center justify-center -space-x-3 py-1">
          <PlayingCard card={{ suit: 'spades', rank: 'A' }} size="xs" />
          <PlayingCard card={{ suit: 'hearts', rank: 'K' }} size="xs" />
          <PlayingCard card={{ suit: 'diamonds', rank: '10' }} size="xs" />
        </div>
      ),
      actionPrimary: 'Oyna',
      onClick: () => setPlayMenuGame('blackjack'),
      onOpenLobby: () => setLobbyModalGame('blackjack')
    },
    {
      id: 'poker',
      title: 'Texas Hold\'em Poker',
      subtitle: 'VIP Canlı Masalar • Yüksek Bahis & Bot Desteği',
      category: ['cards'],
      badge: 'POPÜLER CASINO',
      badgeColor: 'bg-red-500 text-white',
      gradient: 'from-red-600 via-rose-500 to-red-800',
      icon: '♠️',
      capacity: '2-6 Oyuncu & Bot',
      activeRooms: activeTables.filter(t => t.gameType === 'poker').length,
      features: [
        'Texas Hold\'em Kuralları & Canlı Masa Seçimi',
        'Flop, Turn, River ve Pot Hesaplama',
        'Bot Rakipler & Gerçek Zamanlı Sohbet'
      ],
      preview: (
        <div className="flex items-center justify-center -space-x-3 py-1">
          <PlayingCard card={{ suit: 'spades', rank: 'A' }} size="xs" />
          <PlayingCard card={{ suit: 'hearts', rank: 'A' }} size="xs" />
          <PlayingCard card={{ suit: 'diamonds', rank: 'K' }} size="xs" />
        </div>
      ),
      actionPrimary: 'Oyna',
      onClick: () => setPlayMenuGame('poker'),
      onOpenLobby: () => setLobbyModalGame('poker')
    },
    {
      id: 'batak',
      title: 'Batak (İhaleli & Koz Maça)',
      subtitle: 'Geleneksel 4 Kişilik İskambil Klasiği',
      category: ['cards', 'strategy'],
      badge: 'YENİ OYUN',
      badgeColor: 'bg-emerald-500 text-white',
      gradient: 'from-emerald-600 via-teal-500 to-emerald-700',
      icon: '♠️',
      capacity: '4 Kişilik (İnsan & Bot)',
      activeRooms: batakRoomCount,
      features: [
        'Koz Çıkması, Renge Uyma ve Büyütme Kuralları',
        'İhale & Koz Belirleme Fazı ve Akıllı Bot Stratejisi',
        'Detaylı Skor Tablosu ve Batma Cezası Hesabı'
      ],
      preview: (
        <div className="flex items-center justify-center -space-x-3 py-1">
          <PlayingCard card={{ suit: 'spades', rank: 'A' }} size="xs" />
          <PlayingCard card={{ suit: 'spades', rank: 'K' }} size="xs" />
          <PlayingCard card={{ suit: 'hearts', rank: 'A' }} size="xs" />
        </div>
      ),
      actionPrimary: 'Oyna',
      onClick: () => setPlayMenuGame('batak'),
      onOpenLobby: () => setLobbyModalGame('batak')
    },
    {
      id: 'okey',
      title: 'Klasik Okey',
      subtitle: 'Geleneksel 4 Kişilik Düz Okey Masası',
      category: ['cards', 'strategy'],
      badge: 'POPÜLER',
      badgeColor: 'bg-emerald-600 text-white',
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      icon: '🀄',
      capacity: '4 Kişi',
      activeRooms: okeyRoomCount,
      features: [
        'Standart 106 Taş ve Sahte Okeyler',
        'Akıllı Istaka: Otomatik Seri ve Çift Dizme',
        'Gerçek Zamanlı Gösterge ve Çanak Puanlama'
      ],
      preview: (
        <div className="flex items-center justify-center gap-1 py-1">
          {['1', '2', '3', '7', '★'].map((n, i) => (
            <div key={i} className="w-6 h-9 rounded bg-amber-50 dark:bg-[#fff9e6] border border-amber-300 shadow text-[10px] font-black text-red-600 flex items-center justify-center">
              {n}
            </div>
          ))}
        </div>
      ),
      actionPrimary: 'Okey Lobisine Gir',
      onClick: () => setSelectedGame('okey')
    },
    {
      id: 'okey101',
      title: '101 Okey (Yüzbir)',
      subtitle: 'Katlamalı & Katlamasız Çoklu Masalar',
      category: ['cards', 'strategy'],
      badge: 'STRATEJİ',
      badgeColor: 'bg-amber-600 text-white',
      gradient: 'from-amber-500 via-orange-500 to-rose-500',
      icon: '💯',
      capacity: '4 Kişi',
      activeRooms: okey101RoomCount,
      features: [
        '101 Puan ve 5 Çift Masaya El Açma Barajı',
        'Masadaki Perlere Taş İşleme ve Yan Taştan Açma',
        'Katlamalı Mod ve Ceza Puanı Kontrolleri'
      ],
      preview: (
        <div className="flex items-center justify-center gap-1 py-1">
          {['10', '11', '12'].map((n, i) => (
            <div key={i} className="w-6 h-9 rounded bg-amber-50 dark:bg-[#fff9e6] border border-amber-300 shadow text-[10px] font-black text-blue-600 flex items-center justify-center">
              {n}
            </div>
          ))}
        </div>
      ),
      actionPrimary: '101 Lobisine Gir',
      onClick: () => setSelectedGame('okey101')
    },
    {
      id: 'uno',
      title: 'UNO Klasiği',
      subtitle: '2-4 Kişilik • Çok Oyunculu & Bot Destekli',
      category: ['arcade', 'cards'],
      badge: 'HIZLI TEMPO',
      badgeColor: 'bg-rose-500 text-white',
      gradient: 'from-rose-600 via-amber-500 to-sky-500',
      icon: '🎴',
      capacity: '2-4 Kişi & Bot',
      activeRooms: unoRoomCount,
      features: [
        '108 Kartlık Standart Deste (+2, Pas, Yön, +4 Joker)',
        'Akıllı Bot Desteği ile kesintisiz oyun',
        'Parlayan UNO Butonu ve ceza mekanikleri'
      ],
      preview: (
        <div className="flex items-center justify-center gap-1 py-1">
          <div className="w-6 h-9 rounded bg-rose-600 text-white text-[10px] font-black flex items-center justify-center shadow">7</div>
          <div className="w-6 h-9 rounded bg-sky-600 text-white text-[10px] font-black flex items-center justify-center shadow">+2</div>
          <div className="w-6 h-9 rounded bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">🚫</div>
        </div>
      ),
      actionPrimary: 'UNO Lobisine Gir',
      onClick: () => setSelectedGame('uno')
    },
    {
      id: 'drawguess',
      title: 'Çiz & Tahmin Et',
      subtitle: 'Gartic & Skribbl tarzı çizim kapışması',
      category: ['arcade'],
      badge: 'PARTİ OYUNU',
      badgeColor: 'bg-fuchsia-600 text-white',
      gradient: 'from-amber-500 via-violet-500 to-fuchsia-500',
      icon: '🎨',
      capacity: '2-10 Oyuncu',
      activeRooms: drawguessRoomCount,
      features: [
        'HTML5 Dokunmatik Tuval, Renkler ve Silgi',
        'Canlı Süre ve Türkçe Kelime Seçimi',
        'Eğlence dolu çok oyunculu tahmin sohbeti'
      ],
      preview: (
        <div className="flex items-center justify-center gap-1.5 py-1">
          <span className="text-xl">✏️</span>
          <span className="text-xl">🎨</span>
          <span className="text-xl">💡</span>
        </div>
      ),
      actionPrimary: 'Çizim Lobisine Gir',
      onClick: () => setSelectedGame('drawguess')
    },
    {
      id: 'battleroyale',
      title: 'Mini Battle Royale (2D)',
      subtitle: '2-4 Kişilik Kuşbakışı Çatışma • Daralan Güvenli Çember & Büyük Pot',
      category: ['arcade'],
      badge: '🔥 YENİ ARENA',
      badgeColor: 'bg-gradient-to-r from-red-600 to-amber-500 text-white font-bold',
      gradient: 'from-rose-600 via-orange-500 to-amber-600',
      icon: '🎯',
      capacity: '2-4 Kişi & Bot',
      activeRooms: activeTables.filter(t => t.gameType === 'royale' || t.gameType === 'battleroyale').length,
      features: [
        'Kuşbakışı Gerçek Zamanlı Çok Oyunculu Çatışma (Surviv.io Stili)',
        'Daralan Gaz Çemberi, Silah Sandıkları & Zırh/Can Eşyaları',
        'Tablet ve Mobilde Sanal Joystick, PC ve Tablette Klavye & Fare Desteği'
      ],
      preview: (
        <div className="flex items-center justify-center gap-2 py-1">
          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold border border-rose-500/30">🔫 Tabanca</span>
          <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-mono font-bold border border-orange-500/30">💥 Pompalı</span>
          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold border border-sky-500/30">⚡ Tüfek</span>
        </div>
      ),
      actionPrimary: 'Arenaya Gir',
      onClick: () => {
        setSelectedGameTableId(null);
        setSelectedGame('battleroyale');
      }
    },
    {
      id: 'party',
      title: 'Party Mode Turnuva (10 Mini Oyun)',
      subtitle: '2-10 Kişilik Çok Oyunculu • Tank Savaşları, Araba Yarışı, Lav & Sumo',
      category: ['arcade', 'strategy'],
      badge: '🎉 DEV TURNUVA',
      badgeColor: 'bg-gradient-to-r from-amber-500 via-pink-500 to-indigo-500 text-white font-black animate-pulse',
      gradient: 'from-amber-500 via-pink-600 to-indigo-600',
      icon: '🏆',
      capacity: '2-10 Kişi & Bot',
      activeRooms: 0,
      features: [
        'Mario & Pummel Party Stili 10 Farklı Mini Oyun Havuzu',
        'Tank Savaşları (Seken Mermi Fiziği) ve Tepeden Araba Yarışı (Drift)',
        'Lobi Özelleştirmesi: 2-10 Oyuncu Kapasitesi ve 3/5/7/10 Tur Seçimi',
        'Gelişmiş Skor Tablosu, Animasyonlu Oyun İntrosu ve Şampiyonluk Kürsüsü'
      ],
      preview: (
        <div className="flex items-center justify-center gap-1.5 py-1 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">🛡️ Tank</span>
          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold border border-blue-500/30">🏎️ Yarış</span>
          <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-mono font-bold border border-orange-500/30">🔥 Lav</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold border border-cyan-500/30">🧊 Sumo</span>
        </div>
      ),
      actionPrimary: 'Parti Lobisine Gir',
      onClick: () => {
        setSelectedGameTableId(null);
        setSelectedGame('party');
      }
    }
  ];

  // Filtering by category & search query
  const filteredGames = allGames.filter((game) => {
    const matchesCategory = 
      activeCategory === 'all' || 
      (activeCategory === 'active_lobbies' && game.activeRooms > 0) ||
      game.category.includes(activeCategory as any);

    const matchesSearch = 
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.subtitle.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* --- Lounge Hub Header --- */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-2 border border-emerald-500/20">
              <Sparkles size={14} /> Arcade & Casino Lounge
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <Gamepad2 className="text-emerald-500" size={36} /> Oyunlar & Kağıt Masaları
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Blackjack 21, Batak, Klasik Okey, 101, UNO ve Çiz Bakalım masalarında gerçek oyuncularla veya botlarla oyna!
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{totalActiveTablesCount} Canlı Masa Açık</span>
            </div>
          </div>
        </div>

        {/* --- Top Filter Bar & Search Input --- */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Horizontal scrollable category pill tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1 sm:pb-0 w-full sm:w-auto">
            {[
              { id: 'all', label: '🔥 Tümü' },
              { id: 'cards', label: '🃏 Kağıt & Masa' },
              { id: 'arcade', label: '⚡ Hızlı & Arcade' },
              { id: 'strategy', label: '🧠 Strateji & Zeka' },
              { id: 'active_lobbies', label: `🟢 Aktif Masalar (${totalActiveTablesCount})` }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as GameCategory)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20 scale-105'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Oyun veya masa ara..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm"
            />
          </div>
        </div>

        {/* --- Open Live Tables Banner (Açık Lobiler) --- */}
        {activeTables.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 border border-emerald-500/30 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-black text-sm">
                <Users size={18} className="text-emerald-400" />
                <span>Katılınabilir Canlı Masalar</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400">
                {activeTables.length} Açık Masa
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeTables.map((t) => {
                const gameMeta = 
                  t.gameType === 'okey' ? { icon: '🀄', label: 'Klasik Okey', badge: 'bg-emerald-500/20 text-emerald-300' } :
                  t.gameType === 'okey101' ? { icon: '💯', label: '101 Okey', badge: 'bg-amber-500/20 text-amber-300' } :
                  t.gameType === 'uno' ? { icon: '🎴', label: 'UNO', badge: 'bg-rose-500/20 text-rose-300' } :
                  t.gameType === 'blackjack' ? { icon: '🃏', label: 'Blackjack 21', badge: 'bg-yellow-500/20 text-yellow-300' } :
                  t.gameType === 'batak' ? { icon: '♠️', label: 'Batak', badge: 'bg-teal-500/20 text-teal-300' } :
                  t.gameType === 'drawguess' ? { icon: '🎨', label: 'Çiz Bakalım', badge: 'bg-fuchsia-500/20 text-fuchsia-300' } :
                  t.gameType === 'royale' || t.gameType === 'battleroyale' ? { icon: '🎯', label: 'Battle Royale', badge: 'bg-rose-500/20 text-rose-300' } :
                  { icon: '🎮', label: 'Oyun', badge: 'bg-blue-500/20 text-blue-300' };

                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-black/40 border border-emerald-500/20 flex items-center justify-between gap-3 hover:border-emerald-500/50 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-xl shrink-0 shadow-inner">
                        {gameMeta.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-white truncate">{t.title}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${gameMeta.badge}`}>
                            {gameMeta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Kurucu: <span className="text-slate-300 font-semibold">{t.hostName}</span> • {t.playerCount}/{t.maxPlayers} Oyuncu {t.botCount > 0 ? `(${t.botCount} Bot)` : ''} • <span className={t.status === 'Oyunda' ? 'text-amber-400 font-bold' : 'text-emerald-400'}>{t.status}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setBlackjackTableOptions(null);
                        setSelectedGameTableId(t.id);
                        if (socket && socket.connected) {
                          socket.emit('join_table', { tableId: t.id, gameType: t.gameType });
                        }
                        const targetRoute: SelectedGameType = 
                          t.gameType === 'poker' ? 'poker' :
                          t.gameType === 'okey101' ? 'okey101' :
                          t.gameType === 'okey' ? 'okey' :
                          t.gameType === 'uno' ? 'uno' :
                          t.gameType === 'batak' ? 'batak' :
                          t.gameType === 'drawguess' ? 'drawguess' :
                          t.gameType === 'royale' || t.gameType === 'battleroyale' ? 'battleroyale' :
                          'blackjack';
                        setSelectedGame(targetRoute);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shrink-0 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
                    >
                      Masaya Katıl
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Bento Grid Games Selection --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              className="group relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-md hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between overflow-hidden transform hover:-translate-y-1 active:scale-[0.99]"
            >
              {/* Top Accent Gradient */}
              <div className={`h-2.5 bg-gradient-to-r ${game.gradient}`} />

              <div className="p-5 sm:p-6 space-y-4">
                
                {/* Header inside card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {game.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {game.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${game.badgeColor} shadow-sm shrink-0`}>
                    {game.badge}
                  </span>
                </div>

                {/* Visual preview mockup */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 flex items-center justify-center shadow-inner">
                  {game.preview}
                </div>

                {/* Features List */}
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                  {game.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Users size={14} /> {game.capacity}
                </span>

                <div className="flex items-center gap-1.5">
                  {game.onOpenLobby && (
                    <button
                      onClick={game.onOpenLobby}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                      title="Masa Kur veya Masalara Göz At"
                    >
                      + Masa
                    </button>
                  )}
                  <button
                    onClick={game.onClick}
                    className="px-4 py-2 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-md shadow-emerald-900/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{game.actionPrimary}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>

        {/* --- Leaderboard Component --- */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center">
                <Trophy size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {leaderboardTab === 'chips' ? '🏆 En Yüksek Sanal Çip Sıralaması (Zenginler Kulübü)' : 'Liderlik Sıralaması (Top 10)'}
                  </h3>
                  {isEmirgan && (
                    <button
                      onClick={() => setShowAdminChipsModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-600 hover:text-white dark:text-amber-400 text-xs font-black transition-all flex items-center gap-1 cursor-pointer border border-amber-500/30 shadow-sm"
                      title="Emirgan Özel Sanal Bakiye Yönetim Paneli"
                    >
                      <Zap size={12} />
                      <span>⚡ Bakiye Yönet</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {leaderboardTab === 'chips' 
                    ? 'KapsApp platformunda en yüksek sanal çip birikimine sahip kullanıcılar (Sadece eğlence/simülasyon amaçlıdır)'
                    : 'Oyunlarda en çok galibiyet alan şampiyonlar'}
                </p>
              </div>
            </div>

            {/* Tab Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                {[
                  { id: 'chips', label: '🪙 Sanal Çip' },
                  { id: 'okey', label: '🀄 Okey' },
                  { id: 'uno', label: '🎴 UNO' },
                  { id: 'blackjack', label: '🃏 21' },
                  { id: 'poker', label: '♠️ Poker' },
                  { id: 'batak', label: '♣️ Batak' },
                  { id: 'royale', label: '🎯 Royale' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLeaderboardTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      leaderboardTab === tab.id
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchLeaderboard(leaderboardTab)}
                disabled={loadingLeaderboard}
                title="Sıralamayı Güncelle"
                className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingLeaderboard ? 'animate-spin text-blue-500' : ''} />
              </button>
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="p-4 sm:p-6">
            {loadingLeaderboard && leaderboardData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                Sıralama yükleniyor...
              </div>
            ) : leaderboardData.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                <Trophy size={40} className="mx-auto mb-2 opacity-30 text-amber-500" />
                <p className="font-semibold text-sm">Henüz kayıtlı sıralama verisi bulunmuyor.</p>
                <p className="text-xs text-slate-400 mt-1">İlk masayı sen kur ve zirveye yerleş!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {leaderboardData.map((userRow, index) => {
                  const rank = index + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const isChips = leaderboardTab === 'chips';
                  const chipVal = Number(userRow.chips ?? 1000);
                  const wins = 
                    leaderboardTab === 'uno' ? (userRow.uno_wins || 0) :
                    leaderboardTab === 'blackjack' ? (userRow.blackjack_wins || 0) :
                    leaderboardTab === 'batak' ? (userRow.batak_wins || 0) :
                    leaderboardTab === 'poker' ? (userRow.poker_wins || 0) :
                    leaderboardTab === 'royale' ? (userRow.royale_wins || 0) :
                    (userRow.okey_wins || 0);

                  return (
                    <div
                      key={userRow.id}
                      onClick={() => onUserClick && onUserClick(userRow.id)}
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl transition-all duration-200 cursor-pointer ${
                        isTop1
                          ? 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 hover:border-amber-500/60 shadow-sm'
                          : isTop2
                          ? 'bg-gradient-to-r from-slate-300/20 dark:from-slate-700/30 via-slate-200/5 to-transparent border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                          : isTop3
                          ? 'bg-gradient-to-r from-amber-700/15 via-orange-600/5 to-transparent border border-amber-700/30 hover:border-amber-700/50'
                          : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="w-8 sm:w-10 flex items-center justify-center shrink-0">
                          {isTop1 ? (
                            <div className="flex flex-col items-center">
                              <Crown size={18} className="text-amber-500 drop-shadow animate-bounce" />
                              <span className="text-xs font-black text-amber-600 dark:text-amber-400">1</span>
                            </div>
                          ) : isTop2 ? (
                            <div className="flex flex-col items-center">
                              <Medal size={17} className="text-slate-400 dark:text-slate-300" />
                              <span className="text-xs font-black text-slate-600 dark:text-slate-300">2</span>
                            </div>
                          ) : isTop3 ? (
                            <div className="flex flex-col items-center">
                              <Medal size={17} className="text-amber-700 dark:text-amber-500" />
                              <span className="text-xs font-black text-amber-700 dark:text-amber-500">3</span>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
                              #{rank}
                            </span>
                          )}
                        </div>

                        <div className="relative shrink-0">
                          <Avatar
                            url={userRow.avatar}
                            name={userRow.username}
                            color={userRow.color || undefined}
                            size={10}
                          />
                          {isTop1 && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shadow-sm font-bold border-2 border-white dark:border-slate-900">
                              👑
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 truncate">
                          <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-200 block truncate">
                            {userRow.username}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {isTop1 ? '🏆 1. Sıra Şampiyonu' : `${rank}. Sıra`}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 pl-3">
                        {isChips ? (
                          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 flex items-center gap-1.5">
                            <Coins size={14} className="text-slate-950" />
                            <span>{chipVal.toLocaleString()} 🪙</span>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20">
                            {wins} Galibiyet
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* --- Legal Disclaimer & Safety Footer Banner --- */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                ⚠️ Eğlence & Simülasyon Bildirimi:
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                KapsApp içerisindeki tüm kağıt ve masa oyunları (Blackjack 21, Batak, Okey vb.) tamamen ücretsiz, arkadaş ortamında eğlence ve simülasyon amaçlıdır. Kullanılan tüm çipler sanaldır, gerçek para değeri taşımaz ve paraya çevrilemez. Platformda hiçbir surette kumar veya bahis oynatılmaz.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowKvkkModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold transition-all text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
          >
            <FileText size={14} className="text-emerald-500" />
            <span>⚖️ KVKK & Yasal Metin</span>
          </button>
        </div>

        {/* --- Safety & Stats footer banner --- */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-emerald-500 shrink-0" size={18} />
            <span>Kesintisiz bağlantı garantisi: Ağ dalgalanmasında otomatik yeniden bağlanma desteği aktiftir.</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 font-semibold text-slate-700 dark:text-slate-300">
            <span>🃏 Blackjack</span>
            <span>♠️ Batak</span>
            <span>🀄 Okey</span>
            <span>💯 101</span>
            <span>🎴 UNO</span>
            <span>🎨 Çizim</span>
          </div>
        </div>

      </div>

      {/* --- Game Option Selection Modal (Oyna -> Odalar vs Oda Oluştur) --- */}
      {playMenuGame && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl shadow-lg">
              {playMenuGame === 'blackjack' ? '🃏' : playMenuGame === 'poker' ? '♠️' : '♣️'}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-white capitalize">
                {playMenuGame === 'blackjack' ? 'Blackjack 21' : playMenuGame === 'poker' ? 'Texas Hold\'em Poker' : 'Batak'}
              </h2>
              <p className="text-xs text-slate-400">
                Lütfen oyuna başlamak için bir seçenek belirleyin:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Option 1: Odalar */}
              <button
                onClick={() => {
                  setLobbyModalGame(playMenuGame);
                  setLobbyInitialTab('browse');
                  setPlayMenuGame(null);
                }}
                className="w-full py-4 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm sm:text-base border border-slate-700 flex items-center justify-between transition-all cursor-pointer transform hover:scale-[1.02] shadow-md group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <Users size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-black">Odalar (Açık Masalar)</div>
                    <div className="text-[11px] text-slate-400 font-medium">Mevcut canlı masalara göz atın ve katılın</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-white" />
              </button>

              {/* Option 2: Oda Oluştur */}
              <button
                onClick={() => {
                  setLobbyModalGame(playMenuGame);
                  setLobbyInitialTab('create');
                  setPlayMenuGame(null);
                }}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm sm:text-base flex items-center justify-between transition-all cursor-pointer transform hover:scale-[1.02] shadow-lg shadow-emerald-950/40 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/20 text-white border border-white/30">
                    <Plus size={20} />
                  </div>
                  <div className="text-left">
                    <div className="font-black">Oda Oluştur</div>
                    <div className="text-[11px] text-emerald-100 font-medium">Özel veya genel yeni bir masa açın</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-emerald-100" />
              </button>
            </div>

            <button
              onClick={() => setPlayMenuGame(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* --- Universal Card Table Lobby / Creator Modal --- */}
      {lobbyModalGame && (
        <CardTableLobbyModal
          gameType={lobbyModalGame}
          isOpen={Boolean(lobbyModalGame)}
          initialTab={lobbyInitialTab}
          onClose={() => setLobbyModalGame(null)}
          currentUsername={username}
          activeTables={activeTables}
          onCreateTable={(opts) => {
            if (lobbyModalGame === 'poker') {
              setPokerTableOptions(opts);
              setSelectedGame('poker');
            } else if (lobbyModalGame === 'batak') {
              setSelectedGame('batak');
            } else {
              setBlackjackTableOptions(opts);
              setSelectedGame('blackjack');
            }
            setLobbyModalGame(null);
          }}
          onJoinTable={(tableId) => {
            setSelectedGameTableId(tableId);
            if (socket && socket.connected && lobbyModalGame) {
              socket.emit('join_table', { tableId, gameType: lobbyModalGame });
            }
            if (lobbyModalGame === 'poker') {
              setPokerTableOptions(null);
              setSelectedGame('poker');
            } else if (lobbyModalGame === 'batak') {
              setSelectedGame('batak');
            } else {
              setBlackjackTableOptions(null);
              setSelectedGame('blackjack');
            }
            setLobbyModalGame(null);
          }}
        />
      )}

      {/* --- Admin (Emirgan) Chip Manager Modal --- */}
      {showAdminChipsModal && (
        <AdminChipManagerModal
          socket={socket}
          isOpen={showAdminChipsModal}
          onClose={() => setShowAdminChipsModal(false)}
          currentUsername={username}
          onSuccess={() => fetchLeaderboard(leaderboardTab)}
        />
      )}

      {/* --- KVKK & Legal Disclaimer Modal --- */}
      {showKvkkModal && (
        <KvkkModal
          isOpen={showKvkkModal}
          onClose={() => setShowKvkkModal(false)}
        />
      )}
    </div>
  );
}
