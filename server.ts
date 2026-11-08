Warning: truncated output (original token count: 126727)
Total output lines: 12620

import express from "express";
import cors from "cors";
import path from "path";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { registerSubjectResourceRoutes } from "./src/server/subjectResourceRoutes";
import { registerCourseRoutes } from "./src/server/courseController";
import { registerPostRoutes } from "./src/server/postsController";
import { registerAdminController } from "./src/server/adminController";
import { registerAgendaController } from "./src/server/agendaController";
import { initAyvalikCasTables, registerAyvalikCasRoutes } from "./src/server/ayvalikController";
import { setupChatSocketHandlers } from "./src/server/socket";
import { initPasswordResetDb, registerPasswordResetRoutes } from "./src/server/passwordResetController";

import { 
  generateDeck, 
  checkClassicOkeyWin,
  Tile 
} from "./src/utils/okeyEngine.ts";
import {
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
  isTileOkey as isTileOkey101,
  Tile101,
  Okey101Meld,
  Okey101Player,
  Okey101RoomState,
  Okey101Engine,
  run101StressTest
} from "./src/utils/okey101Engine.ts";
import { 
  createUnoDeck, 
  isCardPlayable, 
  UnoCard, 
  UnoColor, 
  COLOR_STYLES,
  shuffleCards 
} from "./src/utils/unoEngine.ts";
import {
  GARTIC_WORDS_POOL,
  getRandomWords,
  isCloseGuess,
  containsSecretWord,
  normalizeTr
} from "./src/server/garticWords.ts";
import {
  initAgendaTable,
  seedOctoberLunchMenu,
  seedPreMockExams,
  startAgendaCronJobs
} from "./server/agendaService.ts";
import { BattleRoyaleManager, runHeadlessBattleRoyaleTest } from "./src/server/battleRoyaleServer.ts";
import { runBattleRoyaleChaosSimulation } from "./src/server/battleRoyaleChaosTest.ts";
import { PartyManager, runHeadlessPartyTest } from "./src/server/partyServer.ts";
import { BilliardsManager } from "./src/server/billiardsServer.ts";
import { DungeonManager } from "./src/server/dungeonServer.ts";
import { KapstorialManager } from "./src/server/kapstorialServer.ts";
import { KapsStrikeServerManager } from "./src/server/kapsstrikeServer.ts";

dotenv.config();

// Ensure uploads dir
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (!ext) {
      const mime = (file.mimetype || '').toLowerCase();
      if (mime.startsWith('video/') || mime === 'video/quicktime') ext = '.mp4';
      else if (mime.startsWith('image/')) {
        if (mime.includes('heic')) ext = '.heic';
        else if (mime.includes('heif')) ext = '.heif';
        else if (mime.includes('webp')) ext = '.webp';
        else if (mime.includes('png')) ext = '.png';
        else ext = '.jpg';
      }
      else if (mime.startsWith('audio/')) ext = '.mp3';
      else if (mime === 'application/pdf') ext = '.pdf';
      else ext = '.bin';
    }
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + ext);
  },
});
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 300 * 1024 * 1024, // 300MB limit for high-res video, large archives and photos
    fieldSize: 300 * 1024 * 1024, // 300MB field size limit
    files: 50 // Multi-upload up to 50 files
  }
});

// Helper to safely delete uploaded media from disk and Turso cloud database
const deleteUploadedFile = async (filenameOrUrl: string) => {
  if (!filenameOrUrl || typeof filenameOrUrl !== 'string') return;
  try {
    const cleanUrl = filenameOrUrl.split('?')[0];
    const filename = path.basename(cleanUrl);
    if (!filename || filename === '.' || filename === '/') return;

    // Try multiple possible paths to locate the file on disk
    const candidatePaths = [
      path.join(uploadsDir, filename),
      path.resolve(process.cwd(), cleanUrl.replace(/^\//, '')),
      path.resolve(process.cwd(), "uploads", filename),
      path.resolve(__dirname, '..', cleanUrl.replace(/^\//, '')),
      path.resolve(__dirname, cleanUrl.replace(/^\//, ''))
    ];

    for (const candPath of candidatePaths) {
      if (fs.existsSync(candPath)) {
        try {
          fs.unlinkSync(candPath);
        } catch (e) {
          await fs.promises.unlink(candPath).catch(() => {});
        }
      }
    }

    await client.execute({
      sql: "DELETE FROM uploaded_files WHERE filename = ? OR filename = ? OR url LIKE ?",
      args: [filename, cleanUrl, `%${filename}%`]
    }).catch(() => {});
  } catch (err) {
    console.error("Error deleting file:", err);
  }
};

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN,
});

async function initDb() {
  await client.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    avatar TEXT,
    color TEXT,
    token TEXT,
    last_seen TEXT
  )`);
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN name TEXT`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
  } catch (e) {}
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS user_daily_screen_time (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_seconds INTEGER DEFAULT 0,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date)
    )`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN okey_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN okey101_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN blackjack_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN batak_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN poker_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN chips INTEGER DEFAULT 1000`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN royale_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN royale_kills INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN royale_matches INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN kapstorial_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN strike_kills INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN strike_deaths INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN strike_wins INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN strike_matches INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await client.execute(`ALTER TABLE users ADD COLUMN strike_headshots INTEGER DEFAULT 0`);
  } catch (e) {}
  await client.execute(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1 INTEGER,
    user2 INTEGER,
    status INTEGER
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image TEXT,
    caption TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender INTEGER,
    receiver INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS global_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    creator INTEGER,
    members TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS group_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    sender INTEGER,
    type TEXT,
    content TEXT,
    reply_to INTEGER,
    reactions TEXT,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    content TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT
  )`);
  await client.execute(`CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE,
    original_name TEXT,
    mimetype TEXT,
    size INTEGER,
    data TEXT,
    created_at TEXT
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at TEXT,
    UNIQUE(follower_id, following_id)
  )`);

  // Multi-Device Sessions & Token Revocation
  await client.execute(`CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    refresh_token_hash TEXT,
    device_info TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT
  )`);

  // Secure Password Reset Requests
  await client.execute(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  )`);
  
  // Migrations for existing tables
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE messages ADD COLUMN read_at TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE group_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_name TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE global_messages ADD COLUMN file_size TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN media_type TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN subject TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE posts ADD COLUMN attachments TEXT"); } catch(e){}
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS subject_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id TEXT,
      course_id TEXT,
      filename TEXT,
      original_name TEXT,
      mimetype TEXT,
      size INTEGER,
      url TEXT,
      uploaded_by INTEGER,
      created_at TEXT
    )`);
  } catch(e) {}
  try { await client.execute("ALTER TABLE subject_files ADD COLUMN topic_tag TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE subject_files ADD COLUMN topics TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE subject_files ADD COLUMN download_count INTEGER DEFAULT 0"); } catch(e){}
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS file_downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      user_id INTEGER NULL,
      username TEXT NOT NULL,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT NULL
    )`);
    await client.execute("CREATE INDEX IF NOT EXISTS idx_file_downloads_file_id ON file_downloads(file_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_file_downloads_downloaded_at ON file_downloads(downloaded_at DESC)");
  } catch(e) {}
  try { await client.execute("ALTER TABLE users ADD COLUMN uno_wins INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN signup_ip TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN last_ip TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN isBanned INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN locationConsent INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN email TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN created_at TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN last_active TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE notifications ADD COLUMN sender_id INTEGER"); } catch(e){}
  try { await client.execute("ALTER TABLE notifications ADD COLUMN target_id INTEGER"); } catch(e){}
  try { await client.execute("ALTER TABLE notifications ADD COLUMN metadata TEXT"); } catch(e){}

  // User Approval Queue Migrations & Unlocking
  try { await client.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending'"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN approved_by TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN approved_at DATETIME"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN roles TEXT DEFAULT '[\"titc\",\"eng_b_hl\"]'"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"); } catch(e){}
  
  // 1. emirgan kullanıcısını kesin olarak approved ve admin yap
  try { await client.execute("UPDATE users SET status = 'approved', is_admin = 1 WHERE LOWER(username) = 'emirgan'"); } catch(e){}
  // 2. Geçmişte takılı kalan veya emirgan dışındaki eski kullanıcıları approved yap:
  try { await client.execute("UPDATE users SET status = 'approved' WHERE status IS NULL OR status = '' OR status = 'pending'"); } catch(e){}

  // 3. IB Ders Rolleri: Yalnızca roles alanı tamamen boş (NULL) olan yeni kullanıcılara başlangıç varsayılanı ver
  try {
    const allUsersRes = await client.execute("SELECT id, roles FROM users WHERE roles IS NULL OR roles = ''");
    for (const u of allUsersRes.rows) {
      await client.execute({
        sql: "UPDATE users SET roles = ? WHERE id = ?",
        args: [JSON.stringify(["titc", "eng_b_hl"]), u.id]
      });
    }
  } catch(e) {
    console.error("IB Course roles default seed error:", e);
  }

  // IB Predicted Grade (Tahmini Diploma Puanı) System Tables & Migration
  await client.execute(`CREATE TABLE IF NOT EXISTS predicted_pool (
    user_id INTEGER PRIMARY KEY,
    added_by TEXT DEFAULT 'emirgan',
    created_at TEXT
  )`);

  await client.execute(`CREATE TABLE IF NOT EXISTS predicted_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id INTEGER NOT NULL,
    target_user_id INTEGER NOT NULL,
    course_scores_json TEXT NOT NULL,
    tok_grade TEXT NOT NULL,
    ee_grade TEXT NOT NULL,
    core_points INTEGER NOT NULL,
    total_score REAL NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(voter_id, target_user_id)
  )`);
  try { await client.execute("ALTER TABLE users ADD COLUMN predicted_score REAL DEFAULT NULL"); } catch(e){}

  // Auto-seed emirgan into the predicted pool on first run
  try {
    const emirganUser = await client.execute("SELECT id FROM users WHERE LOWER(username) = 'emirgan'");
    if (emirganUser.rows.length > 0) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO predicted_pool (user_id, added_by, created_at) VALUES (?, 'system', ?)",
        args: [emirganUser.rows[0].id, new Date().toISOString()]
      });
    }
  } catch (e) {}

  // Announcements (Duyurular) Table
  await client.execute(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT NOT NULL,
    styles TEXT,
    target_roles TEXT,
    author_id INTEGER,
    author_username TEXT,
    created_at TEXT
  )`);
  try { await client.execute("ALTER TABLE announcements ADD COLUMN styles TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE announcements ADD COLUMN target_roles TEXT"); } catch(e){}

  // Agenda (Ajanda & Takvim) Table
  await client.execute(`CREATE TABLE IF NOT EXISTS agenda_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT,
    event_type TEXT NOT NULL,
    description TEXT,
    target_roles TEXT,
    created_by TEXT DEFAULT 'emirgan',
    created_at TEXT
  )`);
  try { await client.execute("ALTER TABLE agenda_events ADD COLUMN target_roles TEXT"); } catch(e){}

  // Seed default 1. Yarıyıl 1. Sınav Kuşağı (12 G IB) exams into agenda_events if not present
  try {
    const existingExams = await client.execute("SELECT COUNT(*) as cnt FROM agenda_events WHERE event_type = 'exam' AND event_date >= '2026-11-01' AND event_date <= '2026-11-15'");
    const cnt = Number(existingExams.rows[0]?.cnt || 0);
    if (cnt === 0) {
      const novExamsSeed = [
        {
          title: "Sınav: Türk Dili ve Edebiyatı (Yazılı)",
          event_date: "2026-11-05",
          event_time: "09:00 - 09:40",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Türk Dili ve Edebiyatı Yazılı Sınavı (2. Ders: 09:00 - 09:40). Yerine: Kimya / DigSoc / Psikoloji",
          target_roles: JSON.stringify(["all", "turkish_sl", "turkish_hl", "turkish", "edebiyat"])
        },
        {
          title: "Sınav: Türk Dili ve Edebiyatı (Uygulama)",
          event_date: "2026-11-05",
          event_time: "11:30 - 12:10",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Türk Dili ve Edebiyatı Uygulama Sınavı (5. Ders: 11:30 - 12:10). Yerine: 20. Yy Türkiye",
          target_roles: JSON.stringify(["all", "turkish_sl", "turkish_hl", "turkish", "edebiyat"])
        },
        {
          title: "Sınav: T.C. İnkılap Tarihi ve Atatürkçülük",
          event_date: "2026-11-05",
          event_time: "14:50 - 15:30",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) T.C. İnkılap Tarihi ve Atatürkçülük (8. Ders: 14:50 - 15:30). Yerine: Din Kültürü",
          target_roles: JSON.stringify(["all", "titc"])
        },
        {
          title: "Sınav: Seçmeli Matematik",
          event_date: "2026-11-06",
          event_time: "09:00 - 09:40",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Seçmeli Matematik Sınavı (2. Ders: 09:00 - 09:40). Yerine: Edebiyat",
          target_roles: JSON.stringify(["all", "math_sl", "math_hl", "math", "matematik"])
        },
        {
          title: "Sınav: S. Kimya / DigSoc / Psikoloji",
          event_date: "2026-11-06",
          event_time: "10:40 - 11:20",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) S. Kimya / Küresel Toplumda İletişim Teknolojileri (Digital Society) / Psikoloji (4. Ders: 10:40 - 11:20). Yerine: Yabancı Dil",
          target_roles: JSON.stringify(["all", "chemistry_sl", "chemistry_hl", "digital_society_sl", "digital_society_hl", "psychology_sl", "psychology_hl"])
        },
        {
          title: "Sınav: S. Biyoloji / S. Fizik",
          event_date: "2026-11-09",
          event_time: "09:00 - 09:40",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Seçmeli Biyoloji / Seçmeli Fizik (2. Ders: 09:00 - 09:40). Yerine: Fizik / Biyoloji",
          target_roles: JSON.stringify(["all", "biology_sl", "biology_hl", "physics_sl", "physics_hl"])
        },
        {
          title: "Sınav: 1. Yabancı Dil (İngilizce) - Uygulama",
          event_date: "2026-11-09",
          event_time: "11:30 - 12:10",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) 1. Yabancı Dil (İngilizce) Uygulama Sınavı (5. Ders: 11:30 - 12:10). Yerine: Matematik",
          target_roles: JSON.stringify(["all", "eng_b_hl", "english", "foreign_language"])
        },
        {
          title: "Sınav: 1. Yabancı Dil (İngilizce) - Yazılı",
          event_date: "2026-11-09",
          event_time: "14:50 - 15:30",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) 1. Yabancı Dil (İngilizce) Yazılı Sınavı (8. Ders: 14:50 - 15:30). Yerine: Din Kültürü",
          target_roles: JSON.stringify(["all", "eng_b_hl", "english", "foreign_language"])
        },
        {
          title: "Sınav: Yabancı Diller Edebiyatı / S. Coğrafya",
          event_date: "2026-11-10",
          event_time: "13:10 - 13:50",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Yabancı Diller Edebiyatı / S. Coğrafya (6. Ders: 13:10 - 13:50). Yerine: Fizik / Biyoloji",
          target_roles: JSON.stringify(["all", "foreign_language", "english", "eng_b_hl"])
        },
        {
          title: "Sınav: Din Kültürü ve Ahlak Bilgisi",
          event_date: "2026-11-10",
          event_time: "14:50 - 15:30",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Din Kültürü ve Ahlak Bilgisi (8. Ders: 14:50 - 15:30). Yerine: Matematik",
          target_roles: JSON.stringify(["all", "religion"])
        },
        {
          title: "Sınav: Klasik Ahlak Metinleri",
          event_date: "2026-11-11",
          event_time: "08:50 - 09:30",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) Klasik Ahlak Metinleri Sınavı (2. Ders: 08:50 - 09:30, Çarşamba Özel Saati). Yerine: 20. Yy Türkiye",
          target_roles: JSON.stringify(["all"])
        },
        {
          title: "Sınav: 20. Yüzyılda Türkiye",
          event_date: "2026-11-11",
          event_time: "10:30 - 11:10",
          event_type: "exam",
          description: "1. Yarıyıl 1. Sınav Kuşağı • 12 G (IB) 20. Yüzyılda Türkiye Sınavı (4. Ders: 10:30 - 11:10, Çarşamba Özel Saati). Yerine: Matematik",
          target_roles: JSON.stringify(["all", "history_20th"])
        }
      ];

      for (const ev of novExamsSeed) {
        await client.execute({
          sql: "INSERT INTO agenda_events (title, event_date, event_time, event_type, description, target_roles, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, 'emirgan', ?)",
          args: [ev.title, ev.event_date, ev.event_time, ev.event_type, ev.description, ev.target_roles, new Date().toISOString()]
        });
      }
    }
  } catch (err) {
    console.error("12G IB exams seed error:", err);
  }

  // Seed November 2026 Cafeteria Lunch Menu (FMV Özel Işık Liseleri Lise Öğle Yemeği Menüsü - Kasım 2026)
  try {
    const existingFood = await client.execute("SELECT COUNT(*) as cnt FROM agenda_events WHERE event_type = 'food' AND event_date >= '2026-11-01' AND event_date <= '2026-11-30'");
    const foodCnt = Number(existingFood.rows[0]?.cnt || 0);
    if (foodCnt === 0) {
      const novFoodSeed = [
        // Hafta 1 (02 - 06 Kasım 2026)
        {
          title: "Öğle Yemeği: Pideli İskender",
          event_date: "2026-11-02",
          event_time: "12:10 - 13:10",
          description: "• Ezogelin Çorbası\n• Pideli İskender / Yoğurt ve Sos\n• Blanjer Patates\n• Makarna: Napoliten Sos\n• Salata: Pırasa Kavurma\n• Mevsim Meyvesi (Armut)\n• Ayran"
        },
        {
          title: "Öğle Yemeği: Kıymalı Kabak Sandal Sefası",
          event_date: "2026-11-03",
          event_time: "12:10 - 13:10",
          description: "• Taneli Sebze Çorbası\n• Kıymalı Kabak Sandal Sefası\n• Yeşil Mercimek Köftesi / Bolonez Sos\n• Tel Şehriyeli Bulgur Pilavı\n• Makarna: Peynir Sos\n• Salata: Ton Balığı\n• Supangle\n• Yoğurt"
        },
        {
          title: "Öğle Yemeği: Pilav Üzeri Hindi Tiftik",
          event_date: "2026-11-04",
          event_time: "12:00 - 12:45",
          description: "• Süzme Mercimek Çorbası\n• Pilav Üzeri Hindi Tiftik\n• Sebze Buketi\n• Makarna: Bolonez Sos\n• Salata: Yoğurtlu Amerikan Salata\n• Mevsim Meyvesi (Elma)\n• Ayran"
        },
        {
          title: "Öğle Yemeği: Etli Nohut & Patates Musakka",
          event_date: "2026-11-05",
          event_time: "12:10 - 13:10",
          description: "• Naneli Yoğurt Çorbası\n• Etli Nohut\n• Patates Musakka\n• Pirinç Pilavı\n• Makarna: Sebze Sos\n• Salata: Portakallı Kereviz\n• Mevsim Meyvesi (Mandalina)\n• Cacık"
        },
        {
          title: "Öğle Yemeği: Salçalı Biftek & Püre",
          event_date: "2026-11-06",
          event_time: "12:10 - 13:10",
          description: "• Tel Şehriye Çorbası\n• Salçalı Biftek / Püre\n• Bulgur Pilavı\n• Makarna: Bolonez Sos\n• Salata Büfesi\n• Osmanlı Tulumba\n• Yoğurt"
        },

        // Hafta 2 (09 - 13 Kasım 2026)
        {
          title: "Öğle Yemeği: Bolonez Soslu Sebzeli Makarna",
          event_date: "2026-11-09",
          event_time: "12:10 - 13:10",
          description: "• Düğün Çorbası\n• Bolonez Soslu Sebzeli Makarna\n• Kıymalı Karnabahar\n• Sebze Kavurma\n• Makarna: Napoliten Soslu\n• Salata: Ton Balığı\n• Mevsim Meyvesi (Elma)\n• Komposto (Vişne)"
        },
        {
          title: "Öğle Yemeği: Atatürk'ün En Sevdiği Yemekler (10 Kasım)",
          event_date: "2026-11-10",
          event_time: "12:10 - 13:10",
          description: "• Tarhana Çorbası\n• Etli Kuru Fasulye\n• Karnıyarık\n• Pirinç Pilavı\n• Makarna: Pesto Soslu\n• Salata: Turşu Kavurma\n• İrmik Helvası\n• Cacık"
        },
        {
          title: "Öğle Yemeği: Et Fajita & Lavaş",
          event_date: "2026-11-11",
          event_time: "12:00 - 12:45",
          description: "• Tavuksuyu Çorbası\n• Et Fajita / Lavaş\n• Tel Şehriyeli Bulgur Pilavı\n• Makarna: Domates Sos\n• Salata: Patates Salatası\n• Mevsim Meyvesi (Mandalina)\n• Ayran"
        },
        {
          title: "Öğle Yemeği: Kabak Dolma & Peynirli Gül Börek",
          event_date: "2026-11-12",
          event_time: "12:10 - 13:10",
          description: "• Tel Şehriye Çorbası\n• Kabak Dolma / Yoğurt\n• Kıymalı Pırasa Yemeği\n• Peynirli Gül Börek\n• Makarna: Sebzeli Sos\n• Salata: Havuç Tarator\n• Mevsim Meyvesi (Armut)\n• Komposto (Elma)"
        },
        {
          title: "Öğle Yemeği: Güneydoğu Mutfağı Günü (Adana Kebap)",
          event_date: "2026-11-13",
          event_time: "12:10 - 13:10",
          description: "• Lebeniye Çorbası\n• Adana Kebap / Lavaş\n• Sebzeli Bulgur Pilavı\n• Makarna: Arabiatta Sos\n• Salata: Acılı Ezme, Etsiz Çiğ Köfte, Yoğurtlu Semizotu, Nohut Salatası\n• Kadayıf\n• Ayran"
        },

        // Hafta 4 (23 - 27 Kasım 2026) - (Hafta 3 Ara Tatil)
        {
          title: "Öğle Yemeği: Islama Köfte",
          event_date: "2026-11-23",
          event_time: "12:10 - 13:10",
          description: "• Ezogelin Çorbası\n• Islama Köfte / Soslu Dilim Ekmekli\n• Blanjer Patates\n• Makarna: Napoliten Sos\n• Salata: Coleslaw Salata\n• Mevsim Meyvesi (Elma)\n• Ayran"
        },
        {
          title: "Öğle Yemeği: Etli Nohut & Karnabahar Graten",
          event_date: "2026-11-24",
          event_time: "12:10 - 13:10",
          description: "• Yoğurt Çorbası\n• Etli Nohut\n• Karnabahar Graten\n• Arpa Şehriyeli Pirinç Pilavı\n• Makarna: Pesto Sos\n• Salata: Ton Balığı\n• Mevsim Meyvesi (Armut)\n• Yoğurt"
        },
        {
          title: "Öğle Yemeği: Piliç Haşlama / Izgara Köfte",
          event_date: "2026-11-25",
          event_time: "12:00 - 12:45",
          description: "• Şafak Çorbası\n• Piliç Haşlama (Kuşbaşı Bonfile Göğüs)\n• Izgara Köfte / Patates Fırın\n• Tel Şehriyeli Bulgur Pilavı\n• Makarna: Arabiatta Sos\n• Salata: Kırmızı Pancar Salatası\n• Mevsim Meyvesi (Mandalina)\n• Yoğurt"
        },
        {
          title: "Öğle Yemeği: Tavuklu Pilav & Patates Kavurma",
          event_date: "2026-11-26",
          event_time: "12:10 - 13:10",
          description: "• Balkabaklı Mercimek Çorbası\n• Tavuklu Pilav / Anaokulu İçin Hindili Pilav\n• Patates Kavurma\n• Makarna: Sebze Sos\n• Salata: Kabak Tarator\n• Mevsim Meyvesi (Armut)\n• Ayran"
        },
        {
          title: "Öğle Yemeği: Çıtır Hindi / İsveç Köfte",
          event_date: "2026-11-27",
          event_time: "12:10 - 13:10",
          description: "• Alaca Çorbası\n• Çıtır Hindi / Sebze Sote\n• İsveç Köfte / Sebze Sote\n• Patatesli Rulo Börek\n• Makarna: Peynir Sos\n• Salata: Portakallı Kereviz\n• Supangle\n• Komposto (Kuru Üzüm)"
        },

        // Hafta 5 (30 Kasım 2026)
        {
          title: "Öğle Yemeği: Soslu Hamburger & Elma Dilim Patates",
          event_date: "2026-11-30",
          event_time: "12:10 - 13:10",
          description: "• Süzme Mercimek Çorbası\n• Soslu Hamburger / Elma Dilim Patates\n• Havuçlu Fırın Brokoli\n• Makarna: Peynir Soslu\n• Salata: Yoğurtlu Amerikan Salata\n• Mozaik Pasta\n• Ayran"
        }
      ];

      for (const f of novFoodSeed) {
        await client.execute({
          sql: "INSERT INTO agenda_events (title, event_date, event_time, event_type, description, target_roles, created_by, created_at) VALUES (?, ?, ?, 'food', ?, ?, 'emirgan', ?)",
          args: [f.title, f.event_date, f.event_time, f.description, JSON.stringify(["all"]), new Date().toISOString()]
        });
      }
    }

    // Seed November 2026 1. Dönem Ara Tatili (16 - 20 Kasım 2026)
    const existingBreak = await client.execute("SELECT COUNT(*) as cnt FROM agenda_events WHERE title LIKE '%Ara Tatil%' AND event_date >= '2026-11-16' AND event_date <= '2026-11-20'");
    const breakCnt = Number(existingBreak.rows[0]?.cnt || 0);
    if (breakCnt === 0) {
      const breakDays = [
        { date: "2026-11-16", day: "Pazartesi" },
        { date: "2026-11-17", day: "Salı" },
        { date: "2026-11-18", day: "Çarşamba" },
        { date: "2026-11-19", day: "Perşembe" },
        { date: "2026-11-20", day: "Cuma" }
      ];
      for (const b of breakDays) {
        await client.execute({
          sql: "INSERT INTO agenda_events (title, event_date, event_time, event_type, description, target_roles, created_by, created_at) VALUES (?, ?, 'Tüm Gün', 'event', ?, ?, 'emirgan', ?)",
          args: [
            "🌴 Ara Tatil",
            b.date,
            `1. Yarıyıl Ara Tatili (${b.day}) • Okul kapalıdır. Ders ve yemek servisi bulunmamaktadır.`,
            JSON.stringify(["all"]),
            new Date().toISOString()
          ]
        });
      }
    }
  } catch (foodSeedErr) {
    console.error("November food and break seed error:", foodSeedErr);
  }

  // Roles & Custom Roles Table with Discord-style hierarchy
  await client.execute(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    is_custom INTEGER DEFAULT 0,
    description TEXT,
    created_at TEXT
  )`);
  try { await client.execute("ALTER TABLE roles ADD COLUMN description TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE roles ADD COLUMN position INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE roles ADD COLUMN is_custom INTEGER DEFAULT 0"); } catch(e){}

  // Custom Roles table schema (as specified in specification)
  await client.execute(`CREATE TABLE IF NOT EXISTS custom_roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(30) NOT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed default IB roles into roles table
  try {
    const defaultRolesSeed = [
      { key: "titc", name: "TITC", color: "#E11D48", position: 100, is_custom: 0, description: "Türkiye Cumhuriyeti İnkılap Tarihi ve Atatürkçülük" },
      { key: "eng_b_hl", name: "English B HL", color: "#2563EB", position: 90, is_custom: 0, description: "English B Higher Level" },
      { key: "turkish_sl", name: "Turkish A SL", color: "#F97316", position: 80, is_custom: 0, description: "Turkish A Standard Level" },
      { key: "turkish_hl", name: "Turkish A HL", color: "#EA580C", position: 79, is_custom: 0, description: "Turkish A Higher Level" },
      { key: "math_sl", name: "Mathematics SL", color: "#38BDF8", position: 70, is_custom: 0, description: "Mathematics Standard Level" },
      { key: "math_hl", name: "Mathematics HL", color: "#0284C7", position: 69, is_custom: 0, description: "Mathematics Higher Level" },
      { key: "physics_sl", name: "Physics SL", color: "#A855F7", position: 60, is_custom: 0, description: "Physics Standard Level" },
      { key: "physics_hl", name: "Physics HL", color: "#7E22CE", position: 59, is_custom: 0, description: "Physics Higher Level" },
      { key: "psychology_sl", name: "Psychology SL", color: "#EC4899", position: 50, is_custom: 0, description: "Psychology Standard Level" },
      { key: "psychology_hl", name: "Psychology HL", color: "#BE185D", position: 49, is_custom: 0, description: "Psychology Higher Level" },
      { key: "chemistry_sl", name: "Chemistry SL", color: "#14B8A6", position: 45, is_custom: 0, description: "Chemistry Standard Level" },
      { key: "chemistry_hl", name: "Chemistry HL", color: "#0F766E", position: 44, is_custom: 0, description: "Chemistry Higher Level" },
      { key: "biology_sl", name: "Biology SL", color: "#22C55E", position: 40, is_custom: 0, description: "Biology Standard Level" },
      { key: "biology_hl", name: "Biology HL", color: "#15803D", position: 39, is_custom: 0, description: "Biology Higher Level" },
      { key: "digital_society_sl", name: "Digital Society SL", color: "#06B6D4", position: 30, is_custom: 0, description: "Digital Society Standard Level" },
      { key: "digital_society_hl", name: "Digital Society HL", color: "#0891B2", position: 29, is_custom: 0, description: "Digital Society Higher Level" }
    ];
    for (const r of defaultRolesSeed) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO roles (key, name, color, position, is_custom, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [r.key, r.name, r.color, r.position, r.is_custom, r.description, new Date().toISOString()]
      });
    }
  } catch(e) {
    console.error("Roles seed error:", e);
  }

  // 5651 Sayılı Kanun Traffic & IP Access Logs Table
  await client.execute(`CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    ipAddress TEXT,
    action TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Last Known Locations Table for Cold-Start Persistence
  await client.execute(`CREATE TABLE IF NOT EXISTS last_known_locations (
    userId INTEGER PRIMARY KEY,
    username TEXT,
    avatar TEXT,
    color TEXT,
    lat REAL,
    lng REAL,
    status TEXT,
    lastSeen INTEGER
  )`);

  // Banned Hardware Table (Pure Physical Hardware / Fingerprint Ban - NO IP DEPENDENCY)
  await client.execute(`CREATE TABLE IF NOT EXISTS banned_hardware (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_fingerprint TEXT UNIQUE NOT NULL,
    banned_user_id TEXT,
    banned_by TEXT DEFAULT 'emirgan',
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Unban and reset all existing banned IPs and Hardware bans as requested
  try {
    await client.execute("DELETE FROM banned_ips;");
    await client.execute("DELETE FROM banned_hardware;");
    await client.execute("DELETE FROM banned_devices;");
    await client.execute("UPDATE users SET is_banned = 0, isBanned = 0, ban_reason = NULL, banned_at = NULL WHERE is_banned = 1 OR isBanned = 1;");
  } catch(e) {}

  // User Ban & Hardware Tracking Column Migrations
  try { await client.execute("ALTER TABLE users ADD COLUMN device_fingerprint TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN last_device_id TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN banned_at TEXT"); } catch(e){}
  try { await client.execute("ALTER TABLE users ADD COLUMN ban_reason TEXT"); } catch(e){}
  try { await client.execute("CREATE INDEX IF NOT EXISTS idx_banned_hw_fp ON banned_hardware(device_fingerprint)"); } catch(e){}

  // High Performance DB PRAGMAs & Indexing for Turso/SQLite (1GB RAM Optimization)
  try {
    await client.execute("PRAGMA cache_size = -32000;");
    await client.execute("PRAGMA synchronous = NORMAL;");
    await client.execute("PRAGMA journal_mode = WAL;");
  } catch (pragmaErr) {}

  try {
    await client.execute("ALTER TABLE messages ADD COLUMN room_id TEXT");
  } catch(e) {}

  try {
    await client.execute("CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_messages_pair_created ON messages(sender, receiver, created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_messages_direct ON messages(sender, receiver)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_global_messages_created ON global_messages(created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_posts_subject ON posts(subject)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_followers_pair ON followers(follower_id, following_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at ASC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_friends_pair ON friends(user1, user2)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_friends_u1 ON friends(user1)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_friends_u2 ON friends(user2)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_agenda_events_date ON agenda_events(event_date)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token)");
  } catch (idxErr) {
    console.error("Index creation notice:", idxErr);
  }

  // Agenda (Takvim, Etkinlik ve Yemek Menüsü) Table & Seed initialization
  try {
    await initAgendaTable(client);
    await seedOctoberLunchMenu(client);
  } catch (agendaInitErr) {
    console.error("Agenda table initialization error:", agendaInitErr);
  }

  // Ayvalık CAS 2026 Tabloları
  try {
    await initAyvalikCasTables(client);
  } catch (ayvalikInitErr) {
    console.error("Ayvalık CAS table initialization error:", ayvalikInitErr);
  }

  // Emirgan Yönetimi: Dinamik Günün Sözü Tablosu
  try {
    await client.execute(`CREATE TABLE IF NOT EXISTS daily_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_text TEXT NOT NULL,
      author TEXT,
      updated_by TEXT DEFAULT 'emirgan',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);
    
    // Seed default quote if empty
    const quoteCountRes = await client.execute("SELECT COUNT(*) as c FROM daily_quotes");
    if (Number(quoteCountRes.rows[0]?.c || 0) === 0) {
      await client.execute({
        sql: "INSERT INTO daily_quotes (quote_text, author, updated_by) VALUES (?, ?, ?)",
        args: [
          "Büyük hedeflere giden yol, bugünün küçük adımlarıyla başlar.",
          "Emirgan",
          "emirgan"
        ]
      });
    }
  } catch (quoteErr) {
    console.error("Daily quote table initialization error:", quoteErr);
  }

  // kapSAT Modülü Tasfiyesi: Eski SAT tablolarını veritabanından kaldır
  try {
    await client.execute("DROP TABLE IF EXISTS user_sat_answers;");
    await client.execute("DROP TABLE IF EXISTS sat_questions;");
  } catch (dropSatErr) {
    console.error("SAT tables drop error:", dropSatErr);
  }
}

async function startServer() {
  try {
    await initDb();
  } catch (dbErr) {
    console.error("Database initialization error (proceeding with server boot):", dbErr);
  }
  
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  
  // Production Performance & Security Headers (Disable ETag to prevent HTTP 412 Precondition Failed errors on uploads & mutations)
  app.disable("x-powered-by");
  app.set("etag", false);

  // Global Conditional Headers Sanitizer: Strips If-Match / If-None-Match headers on API/Upload requests to guarantee no 412 Precondition Failed
  app.use((req, res, next) => {
    delete req.headers["if-match"];
    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
    delete req.headers["if-unmodified-since"];
    delete req.headers["if-range"];

    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });
  
  // High-performance Gzip / Brotli compression for API responses & assets
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"] || req.path.startsWith("/api/upload")) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Reverse proxy setup for accurate client IP detection (Nginx / PM2 / Cloud)
  app.set("trust proxy", true);

  // In-Memory Query Cache with TTL for High-Concurrency Performance (1.5 GB Architecture)
  const queryCache = new Map<string, { data: any; expiresAt: number }>();
  const getCachedQuery = <T>(key: string): T | null => {
    const cached = queryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      queryCache.delete(key);
    }
    return null;
  };
  const setCachedQuery = <T>(key: string, data: T, ttlSeconds = 30): void => {
    if (queryCache.size > 5000) {
      const oldestKey = queryCache.keys().next().value;
      if (oldestKey) queryCache.delete(oldestKey);
    }
    queryCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
  };
  const invalidateCachePrefix = (prefix: string): void => {
    for (const key of queryCache.keys()) {
      if (key.startsWith(prefix)) {
        queryCache.delete(key);
      }
    }
  };

  const getClientIp = (req: express.Request): string => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].split(",")[0].trim();
    }
    return req.ip || req.socket.remoteAddress || "Bilinmiyor";
  };

  // 5651 Sayılı Kanun Asynchronous Non-blocking IP & Traffic Access Logger
  const logAccess = (userId: number | null, ipAddress: string, action: string) => {
    client.execute({
      sql: "INSERT INTO access_logs (userId, ipAddress, action, timestamp) VALUES (?, ?, ?, ?)",
      args: [userId, ipAddress || "Bilinmiyor", action, new Date().toISOString()]
    }).catch(err => console.error("Access log error:", err));
  };

  // In-Memory Fast Lookup for Banned Hardware (0ms response time - strictly hardware/fingerprint based, NO IP)
  const bannedHardwareSet = new Set<string>();

  const loadBannedHardwareRecords = async () => {
    try {
      const hwRes = await client.execute("SELECT device_fingerprint FROM banned_hardware");
      hwRes.rows.forEach((r) => {
        if (r.device_fingerprint) bannedHardwareSet.add(String(r.device_fingerprint).trim());
      });
      // Migrate / backwards compatibility with existing banned_devices if any
      try {
        const legacyRes = await client.execute("SELECT device_id FROM banned_devices");
        legacyRes.rows.forEach((r) => {
          if (r.device_id) bannedHardwareSet.add(String(r.device_id).trim());
        });
      } catch(e) {}
    } catch (e) {
      console.error("Error loading banned hardware records:", e);
    }
  };
  await loadBannedHardwareRecords();
  
  // CORS Configuration (VDS & Domain Origin List)
  const allowedOrigins = [
    "https://kapsapp.online",
    "https://www.kapsapp.online",
    "http://5.182.34.242:5000",
    "http://5.182.34.242:3000",
    "http://localhost:5173",
    "http://localhost:3000"
  ];

  // Enable high-performance HTTP compression (gzip/deflate) to drastically reduce network latency & payload sizes
  app.use(compression());

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin.endsWith(".kapsapp.online") ||
        origin.includes("5.182.34.242") ||
        origin.endsWith(".run.app")
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Hardware-Fingerprint", "X-Device-Id"]
  }));

  app.use(express.json({ limit: "300mb" }));
  app.use(express.urlencoded({ extended: true, limit: "300mb" }));

  // Helper to determine accurate content-type for media streaming
  const getMediaType = (filename: string, fallbackMime?: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.avi': 'video/x-msvideo',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip'
    };
    return mimeMap[ext] || fallbackMime || 'application/octet-stream';
  };

  // Video & Media Stream Handler with HTTP 206 (Partial Content / Accept-Ranges) Support
  const handleMediaStream = async (req: express.Request, res: express.Response) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);

    // If file is not yet on disk, attempt restoration from Turso cloud database
    if (!fs.existsSync(filePath)) {
      try {
        const fileRes = await client.execute({
          sql: "SELECT original_name, mimetype, data FROM uploaded_files WHERE filename = ?",
          args: [filename]
        });
        if (fileRes.rows.length > 0) {
          const row = fileRes.rows[0];
          const buffer = Buffer.from(row.data as string, "base64");
          try {
            fs.writeFileSync(filePath, buffer);
          } catch (e) {
            console.error("Cache write error:", e);
            if (row.mimetype) res.setHeader("Content-Type", row.mimetype as string);
            return res.send(buffer);
          }
        } else {
          return res.status(404).send("File not found");
        }
      } catch (err) {
        console.error("Error restoring file from cloud DB:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    try {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const contentType = getMediaType(filename);
      const range = req.headers.range;

      res.setHeader("Cache-Control", "public, max-age=604800, etag");

      if (range) {
        // HTTP 206 Partial Content (Range Request for smooth video playback & seeking)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
          res.status(416).set("Content-Range", `bytes */${fileSize}`).end();
          return;
        }

        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
        });

        fileStream.pipe(res);
      } else {
        // Full content stream with Accept-Ranges declared
        res.writeHead(200, {
          "Accept-Ranges": "bytes",
          "Content-Length": fileSize,
          "Content-Type": contentType,
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error("Error streaming media file:", err);
      return res.status(500).send("Error streaming file");
    }
  };

  // Health & Ping Endpoints
  app.get(["/api/health", "/api/ping"], (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  // Register on /uploads/:filename, /api/media/:filename and /api/video/:filename
  app.get(["/uploads/:filename", "/api/media/:filename", "/api/video/:filename"], handleMediaStream);

  // Global Gateway Ban Interceptor (Physical Hardware / Fingerprint Ban ONLY - NEVER CHECKS IP)
  app.use((req, res, next) => {
    // Whitelist static uploads and non-API paths
    if (req.path.startsWith("/uploads/") || req.path === "/favicon.ico" || req.path === "/api/health") {
      return next();
    }

    const rawHardwareFp = 
      req.headers["x-hardware-fingerprint"] || 
      req.headers["x-device-id"] || 
      req.query.deviceFingerprint || 
      req.query.deviceId ||
      (req.body && (req.body.deviceFingerprint || req.body.deviceId));

    const deviceFingerprint = typeof rawHardwareFp === "string" ? rawHardwareFp.trim() : "";

    const isHardwareBanned = Boolean(deviceFingerprint && bannedHardwareSet.has(deviceFingerprint));

    if (isHardwareBanned) {
      if (req.path.startsWith("/api/")) {
        return res.status(403).json({
          banned: true,
          type: "device_banned",
          error: "DEVICE_BANNED",
          message: "Bu cihaz, platform kurallarının ihlali nedeniyle kalıcı olarak yasaklanmıştır. Yeni hesap açılamaz."
        });
      }
    }
    next();
  });

  // High-performance User Cache with TTL to reduce database round-trips
  const userCache = new Map<number, { data: any; expiresAt: number }>();
  const invalidateUserCache = (id: number) => {
    userCache.delete(Number(id));
  };

  // Helper to safely parse user IB course roles array (completely flexible)
  const parseRoles = (rolesField: any): string[] => {
    if (!rolesField) return [];
    if (Array.isArray(rolesField)) {
      return Array.from(new Set(rolesField.map((r: any) => String(r).trim()).filter(Boolean)));
    }
    if (typeof rolesField === "string") {
      try {
        const parsed = JSON.parse(rolesField);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(parsed.map((r: any) => String(r).trim()).filter(Boolean)));
        }
      } catch {}
      const trimmed = rolesField.trim();
      if (trimmed && trimmed !== "[]" && trimmed !== "null") {
        return [trimmed];
      }
    }
    return [];
  };

  // Helper to parse target roles for announcements and agenda events
  const parseTargetRolesServer = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      } catch {}
      const trimmed = raw.trim();
      if (trimmed && trimmed !== "[]" && trimmed !== "all") {
        return [trimmed];
      }
    }
    return [];
  };

  // Check if an item with targetRoles is visible to a user
  const isRoleMatchServer = (
    targetRolesRaw: any,
    userRolesRaw: any,
    username?: string,
    isAdmin?: number
  ): boolean => {
    const isEmirgan = (username || "").trim().toLowerCase() === "emirgan";
    if (isEmirgan || Number(isAdmin) === 1) return true;
    const targetRoles = parseTargetRolesServer(targetRolesRaw);
    if (targetRoles.length === 0 || targetRoles.includes("all")) {
      return true;
    }
    const userRoles = parseRoles(userRolesRaw).map((r) => r.toLowerCase().trim());
    return targetRoles.some((tr) => userRoles.includes(tr.toLowerCase().trim()));
  };

  const getUser = async (id: number) => {
    const numId = Number(id);
    if (!numId) return null;
    const now = Date.now();
    const cached = userCache.get(numId);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
    try {
      const res = await client.execute({ 
        sql: "SELECT id, username, avatar, color, chips, okey_wins, uno_wins, blackjack_wins, batak_wins, signup_ip, last_ip, isBanned, locationConsent, is_admin, roles FROM users WHERE id = ?", 
        args: [numId] 
      });
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const u = {
        ...row,
        roles: parseRoles(row.roles)
      };
      userCache.set(numId, { data: u, expiresAt: now + 60000 });
      return u;
    } catch (e) {
      return null;
    }
  };

  // High-performance batch user fetcher to eliminate N+1 database queries
  const getUsersBatch = async (userIds: number[]): Promise<Map<number, any>> => {
    const userMap = new Map<number, any>();
    if (!Array.isArray(userIds) || userIds.length === 0) return userMap;

    const now = Date.now();
    const missingIds: number[] = [];

    for (const rawId of userIds) {
      const id = Number(rawId);
      if (!id) continue;
      const cached = userCache.get(id);
      if (cached && cached.expiresAt > now) {
        userMap.set(id, cached.data);
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      const uniqueMissing = Array.from(new Set(missingIds));
      const placeholders = uniqueMissing.map(() => "?").join(",");
      try {
        const res = await client.execute({
          sql: `SELECT id, username, avatar, color, chips, okey_wins, uno_wins, blackjack_wins, batak_wins, signup_ip, last_ip, isBanned, locationConsent, is_admin, roles FROM users WHERE id IN (${placeholders})`,
          args: uniqueMissing
        });
        for (const row of res.rows) {
          const u = {
            ...row,
            roles: parseRoles((row as any).roles)
          };
          const uid = Number((row as any).id);
          userCache.set(uid, { data: u, expiresAt: now + 60000 });
          userMap.set(uid, u);
        }
      } catch (err) {
        console.error("getUsersBatch error:", err);
      }
    }

    return userMap;
  };



  const httpServer = createServer(app);
  httpServer.on("connection", (socket) => {
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);
  });
  const io = new Server(httpServer, {
    cors: { 
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          origin.endsWith(".kapsapp.online") ||
          origin.includes("5.182.34.242") ||
          origin.endsWith(".run.app")
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true 
    },
    perMessageDeflate: false,
    pingTimeout: 20000,
    pingInterval: 10000,
    maxHttpBufferSize: 2e6 // 2 MB limit for balanced memory usage under 1GB RAM ceiling
  });

  // Start Agenda reminder Cron job
  try {
    startAgendaCronJobs(client, io);
  } catch (cronErr) {
    console.error("Failed to start agenda cron jobs:", cronErr);
  }

  // REST API Routes
  app.post(["/api/register", "/api/auth/register"], async (req, res) => {
    try {
      const { username, password, locationConsent, kvkkAccepted, termsAccepted } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Eksik bilgi." });
      }

      // 5651 & KVKK Mandatory Terms Validation
      if (kvkkAccepted !== true && termsAccepted !== true && kvkkAccepted !== "true" && termsAccepted !== "true") {
        return res.status(400).json({ 
          error: "Kullanım Koşulları ve KVKK Aydınlatma Metni'nin kabul edilmesi zorunludur." 
        });
      }
      
      const existing = await client.execute({
        sql: "SELECT id FROM users WHERE username = ?",
        args: [username]
      });
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Kullanıcı adı alınmış olabilir." });
      }
      
      const hash = await bcrypt.hash(password, 10);
      const token = crypto.randomUUID();
      
      let initials = "?";
      const parts = username.trim().split(/\s+/);
      if (parts.length > 1 && parts[0].length > 0 && parts[1].length > 0) {
        initials = (parts[0][0] + parts[1][0]).toUpperCase();
      } else {
        initials = username.substring(0, 2).toUpperCase();
      }

      const allUsers = await client.execute("SELECT username, color FROM users");
      const usedColors = new Set(
        allUsers.rows.filter(u => {
          let uInit = "?";
          if (u.username) {
            const p = (u.username as string).trim().split(/\s+/);
            if (p.length > 1 && p[0].length > 0 && p[1].length > 0) uInit = (p[0][0] + p[1][0]).toUpperCase();
            else uInit = (u.username as string).substring(0, 2).toUpperCase();
          }
          return uInit === initials;
        }).map(u => u.color)
      );

      const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
      const availableColors = colors.filter(c => !usedColors.has(c));
      const randomColor = availableColors.length > 0 
        ? availableColors[Math.floor(Math.random() * availableColors.length)]
        : colors[Math.floor(Math.random() * colors.length)]; // Fallback if all colors used

      const lastSeen = new Date().toISOString();
      const clientIp = getClientIp(req);
      const rawDeviceId = 
        req.headers["x-hardware-fingerprint"] || 
        req.headers["x-device-id"] || 
        req.body?.hardwareFingerprint || 
        req.body?.deviceId;
      const deviceId = typeof rawDeviceId === "string" ? rawDeviceId.trim() : "";
      const locConsentValue = (locationConsent === true || locationConsent === 1) ? 1 : 0;
      
      const defaultRoles = JSON.stringify(["titc", "eng_b_hl"]);
      const insertResult = await client.execute({
        sql: "INSERT INTO users (username, password, color, token, last_seen, signup_ip, last_ip, device_fingerprint, last_device_id, locationConsent, isBanned, is_banned, status, roles) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?)",
        args: [username, hash, randomColor, lastSeen, clientIp, clientIp, deviceId || null, deviceId || null, locConsentValue, defaultRoles]
      });

      const newUserId = Number(insertResult.lastInsertRowid);
      
      // Asynchronously log register traffic for 5651 compliance
      logAccess(newUserId, clientIp, 'register');
      
      // Notify only emirgan's panel badge and admin listeners via Socket.io (Do NOT pollute normal notifications table)
      io.emit('user:pending_approval', { userId: newUserId, username, createdAt: new Date().toISOString() });
      io.emit('pending_count_updated');
      
      res.json({ 
        success: true, 
        message: "ACCOUNT_PENDING", 
        messageTr: "Kaydınız başarıyla alındı. Hesabınız yönetici (emirgan) tarafından onaylandıktan sonra giriş yapabilirsiniz." 
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  await initPasswordResetDb(client);
  const passwordReset = registerPasswordResetRoutes(app, client, io, invalidateUserCache);

  app.post(["/api/login", "/api/auth/login"], async (req, res) => {
    try {
      const { username, password } = req.body;
      if (typeof username !== "string" || !username.trim() || (password !== undefined && typeof password !== "string")) return res.status(400).json({ error: "Geçersiz giriş bilgileri." });
      const rawDeviceId = 
        req.headers["x-hardware-fingerprint"] || 
        req.headers["x-device-id"] || 
        req.body?.hardwareFingerprint || 
        req.body?.deviceId;
      const deviceId = typeof rawDeviceId === "string" ? rawDeviceId.trim() : "";

      const userRes = await client.execute({
        sql: "SELECT id, username, password, color, avatar, isBanned, is_banned, locationConsent, is_admin, role, status FROM users WHERE LOWER(username) = LOWER(?)",
        args: [username.trim()]
      });
      
      if (userRes.rows.length > 0) {
        const user = userRes.rows[0];

        // 5651 & Emirgan Moderation: Ban Check
        if (Number(user.isBanned) === 1 || Number(user.is_banned) === 1 || user.isBanned === "1") {
          return res.status(403).json({ error: "Hesabınız kural ihlali nedeniyle askıya alınmıştır." });
        }

        // Account Approval Check
        const userStatus = user.status || 'approved';
        if (userStatus === 'pending') {
          return res.status(403).json({ 
            error: "ACCOUNT_PENDING", 
            message: "Hesabınız henüz onaylanmadı. Yönetici (emirgan) onayı bekleniyor." 
          });
        }
        if (userStatus === 'rejected') {
          return res.status(403).json({ 
            error: "ACCOUNT_REJECTED", 
            message: "Hesap kaydınız reddedilmiştir." 
          });
        }

        if (await passwordReset.interceptLogin(req, res, user)) return;
        if (!password) return res.status(400).json({ error: "Lütfen şifrenizi girin." });

        if (await bcrypt.compare(password, user.password as string)) {
          await passwordReset.cancelPending(Number(user.id));
          const token = crypto.randomUUID();
          const refreshToken = crypto.randomUUID();
          const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
          const deviceInfo = (req.headers['user-agent'] || deviceId || 'Web/Mobile Client').toString().slice(0, 255);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 gün geçerli

          let color = user.color;
          if (!color) {
            const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
            color = colors[Math.floor(Math.random() * colors.length)];
          }
          const clientIp = getClientIp(req);

          // 1. users tablosunu güncelle
          await client.execute({
            sql: "UPDATE users SET token = ?, color = ?, last_ip = ?, device_fingerprint = COALESCE(?, device_fingerprint), last_device_id = COALESCE(?, last_device_id), last_seen = ? WHERE id = ?",
            args: [token, color, clientIp, deviceId || null, deviceId || null, new Date().toISOString(), user.id]
          });

          // 2. Çoklu cihaz oturumu: user_sessions tablosuna ekle
          await client.execute({
            sql: "INSERT INTO user_sessions (user_id, token, refresh_token_hash, device_info, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
            args: [user.id, token, refreshTokenHash, deviceInfo, new Date().toISOString(), expiresAt]
          }).catch((err) => console.error("Session insert error:", err));

          // Asynchronously log login traffic for 5651 compliance
          logAccess(Number(user.id), clientIp, 'login');

          const isAdmin = (user.username as string)?.toLowerCase() === "emirgan" || String(user.role).toUpperCase() === "ROOT" || user.is_admin === 1;

          res.json({ 
            token, 
            refreshToken,
            username: user.username, 
            avatar: user.avatar, 
            id: user.id, 
            color, 
            isAdmin,
            role: user.role || "user",
            locationConsent: user.locationConsent === 1 
          });
        } else {
          res.status(401).json({ error: "Geçersiz giriş." });
        }
      } else {
        res.status(401).json({ error: "Geçersiz giriş." });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sunucu Taraflı Güvenli Çıkış (Token Revocation / Logout)
  app.post(["/api/auth/logout", "/api/logout"], async (req, res) => {
    try {
      const authHeader = req.headers.authorization?.replace("Bearer ", "") || req.body?.token;
      if (authHeader) {
        // user_sessions tablosundan oturumu revoke et
        await client.execute({
          sql: "DELETE FROM user_sessions WHERE token = ?",
          args: [authHeader]
        }).catch(() => {});

        // users tablosundaki legacy token eşleşiyorsa temizle
        await client.execute({
          sql: "UPDATE users SET token = NULL WHERE token = ?",
          args: [authHeader]
        }).catch(() => {});
      }
      res.json({ success: true, message: "Oturum başarıyla kapatıldı." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin User Approval Routes (Accessible by emirgan)
  app.get(["/api/emirgan/pending-users", "/api/emirgan/users/pending", "/api/admin/pending-users", "/api/admin/users/pending"], async (req, res) => {
    try {
      const authUser = await passwordReset.authorizeAdmin(req);
      if (!authUser) {
        return res.status(403).json({ error: "Yetkisiz erişim. Sadece emirgan onaylayabilir." });
      }
      const pendingRes = await client.execute("SELECT id, username, email, signup_ip, last_ip, created_at, status FROM users WHERE status = 'pending' ORDER BY id DESC");
      return res.json({ users: pendingRes.rows });
    } catch (err: any) {
      console.error("[EMIRGAN ADMIN] Pending users fetch error:", err);
      return res.status(500).json({ error: "Bekleyen kullanıcılar alınamadı: " + err.message });
    }
  });

  app.post(["/api/emirgan/users/:id/approve", "/api/admin/users/:id/approve", "/api/admin/users/:id/accept"], async (req, res) => {
    try {
      const authUser = await passwordReset.authorizeAdmin(req);
      if (!authUser) {
        return res.status(403).json({ error: "Yetkisiz erişim. Sadece emirgan onaylayabilir." });
      }

      const rawId = req.params.id || (req.params as any).userId;
      const strId = String(rawId);
      console.log(`[EMIRGAN ADMIN] Approving user ID: ${strId}`);

      await client.execute({
        sql: "UPDATE users SET status = 'approved', approved_by = 'emirgan', approved_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [strId]
      });

      io.emit('user:approved', { userId: Number(rawId) });
      io.emit('pending_count_updated');

      return res.json({ success: true, message: "Kullanıcı başarıyla onaylandı." });
    } catch (err: any) {
      console.error("[EMIRGAN ADMIN] Approve error:", err);
      return res.status(500).json({ error: "Kullanıcı onaylanırken veritabanı hatası oluştu: " + err.message });
    }
  });

  app.post(["/api/emirgan/users/:id/reject", "/api/admin/users/:id/reject"], async (req, res) => {
    try {
      const authUser = await passwordReset.authorizeAdmin(req);
      if (!authUser) {
        return res.status(403).json({ error: "Yetkisiz erişim. Sadece emirgan onaylayabilir." });
      }

      const rawId = req.params.id || (req.params as any).userId;
      const strId = String(rawId);
      console.log(`[EMIRGAN ADMIN] Rejecting user ID: ${strId}`);

      await client.execute({
        sql: "DELETE FROM users WHERE id = ? AND (status = 'pending' OR status IS NULL OR status = '')",
        args: [strId]
      });

      io.emit('user:rejected', { userId: Number(rawId) });
      io.emit('pending_count_updated');

      return res.json({ success: true, message: "Kullanıcı kaydı reddedildi ve silindi." });
    } catch (err: any) {
      console.error("[EMIRGAN ADMIN] Reject error:", err);
      return res.status(500).json({ error: "Kullanıcı silinirken hata oluştu: " + err.message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    if (!await authenticateToken(req)) return res.status(401).json({ error: "Oturum gerekli." });
    (upload.single("file") as any)(req, res, async (err: any) => {
      if (err) {
        console.error("Upload single error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ code: "UPLOAD_FILE_LIMIT", error: "Bir dosya en fazla 300 MB olabilir." });
        }
        return res.status(400).json({ error: err.message || "Dosya yüklenirken hata oluştu." });
      }
      if (!req.file) return res.status(400).json({ error: "Dosya bulunamadı veya yüklenemedi." });

      try {
        const filename = req.file.filename;
        const originalName = req.file.originalname;
        const mimetype = req.file.mimetype;
        const size = req.file.size;
        const filePath = req.file.path;
        const url = `/uploads/${filename}`;

        console.log(`[Server Upload Debug] Dosya yüklendi: ${originalName}, Boyut (Bytes): ${size}, MB: ${(size / (1024 * 1024)).toFixed(2)} MB, Tür: ${mimetype}`);

        // Persistent backup to Turso cloud database (so Render container restarts don't wipe files)
        if (size <= 25 * 1024 * 1024) {
          try {
            const base64 = fs.readFileSync(filePath).toString("base64");
            await client.execute({
              sql: "INSERT OR REPLACE INTO uploaded_files (filename, original_name, mimetype, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              args: [filename, originalName, mimetype, size, base64, new Date().toISOString()]
            });
          } catch (err) {
            console.error("Cloud file backup error:", err);
          }
        }

        const isVideo = mimetype.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i.test(originalName) || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i.test(filename);
        const isImage = mimetype.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|heic|heif)$/i.test(originalName);
        const isAudio = mimetype.startsWith("audio/") || /\.(webm|mp3|ogg|wav|m4a)$/i.test(originalName);

        res.json({
          url,
          filename,
          original_name: originalName,
          mimetype,
          size,
          media_type: isVideo ? "video" : isImage ? "image" : isAudio ? "voice" : "file"
        });
      } catch (e: any) {
        console.error("Upload processing error:", e);
        res.status(500).json({ error: "Dosya işlenirken hata oluştu: " + e.message });
      }
    });
  });

  // Multiple Media Upload Endpoint (Supports up to 50 files / photos / videos)
  app.post("/api/upload-multiple", async (req, res) => {
    if (!await authenticateToken(req)) return res.status(401).json({ error: "Oturum gerekli." });
    (upload.array("files", 50) as any)(req, res, async (err: any) => {
      if (err) {
        console.error("Upload multiple error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ code: "UPLOAD_FILE_LIMIT", error: "Bir dosya en fazla 300 MB olabilir." });
        }
        return res.status(400).json({ error: err.message || "Dosyalar yüklenirken hata oluştu." });
      }
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || !Array.isArray(files) || files.length === 0) {
          return res.status(400).json({ error: "Yüklenecek dosya bulunamadı." });
        }

        const uploadedResults = await Promise.all(
          files.map(async (file) => {
            const filename = file.filename;
            const originalName = file.originalname;
            const mimetype = file.mimetype;
            const size = file.size;
            const filePath = file.path;
            const url = `/uploads/${filename}`;

            console.log(`[Server Upload Debug - Multi] Dosya: ${originalName}, Boyut: ${size} Bytes (${(size / (1024 * 1024)).toFixed(2)} MB)`);

            if (size <= 25 * 1024 * 1024) {
              try {
                const base64 = fs.readFileSync(filePath).toString("base64");
                await client.execute({
                  sql: "INSERT OR REPLACE INTO uploaded_files (filename, original_name, mimetype, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                  args: [filename, originalName, mimetype, size, base64, new Date().toISOString()]
                });
              } catch (err) {
                console.error("Cloud file backup error (multi):", err);
              }
            }

            const isVideo = mimetype.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i.test(originalName) || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/i.test(filename);
            const isImage = mimetype.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|heic|heif)$/i.test(originalName);
            const isAudio = mimetype.startsWith("audio/") || /\.(webm|mp3|ogg|wav|m4a)$/i.test(originalName);

            return {
              url,
              filename,
              original_name: originalName,
              mimetype,
              size,
              media_type: isVideo ? "video" : isImage ? "image" : isAudio ? "voice" : "file"
            };
          })
        );

        res.json({ files: uploadedResults, count: uploadedResults.length });
      } catch (err: any) {
        console.error("upload-multiple error:", err);
        res.status(500).json({ error: "Çoklu dosya yüklenirken hata oluştu: " + err.message });
      }
    });
  });

  // Course / Subject Files Endpoints (PDF, DOCX, PPTX, XLSX, ZIP, etc.)
  registerCourseRoutes(app, client, upload, io, deleteUploadedFile);
  registerSubjectResourceRoutes(app, client);
  registerPostRoutes(app, client, io);

  // REST Message Pagination Route (beforeId, limit)
  app.get(["/api/messages/:roomId", "/api/chat/messages/:roomId"], async (req, res) => {
    try {
      const authUser = await authenticateToken(req);
      if (!authUser) return res.status(401).json({ error: "Oturum gerekli." });
      const { roomId } = req.params;
      const match = /^dm_(\d+)_(\d+)$/.exec(roomId);
      if (!match || !match.slice(1).some(id => Number(id) === Number(authUser.id))) return res.status(403).json({ error: "Bu konuşmaya erişiminiz yok." });
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const beforeId = req.query.before ? Number(req.query.before) : null;

      let msgRes;
      if (beforeId && !isNaN(beforeId)) {
        msgRes = await client.execute({
          sql: "SELECT * FROM messages WHERE room_id = ? AND id < ? ORDER BY id DESC LIMIT ?",
          args: [roomId, beforeId, limit]
        });
      } else {
        msgRes = await client.execute({
          sql: "SELECT * FROM messages WHERE room_id = ? ORDER BY id DESC LIMIT ?",
          args: [roomId, limit]
        });
      }

      const rows = [...msgRes.rows].reverse();
      const populated = await Promise.all(rows.map(async (r: any) => {
        const sUser = await getUser(r.sender as number);
        let replyMsg = null;
        if (r.reply_to) {
          const refRes = await client.execute({ sql: "SELECT id, sender, type, content, file_name, file_size FROM messages WHERE id = ? AND (sender = ? OR receiver = ?)", args: [r.reply_to, authUser.id, authUser.id] });
          if (refRes.rows.length > 0) {
            const refUser = await getUser(refRes.rows[0].sender as number);
            replyMsg = { ...refRes.rows[0], sender_name: refUser?.username };
          }
        }
        return {
          ...r,
          reactions: JSON.parse((r.reactions as string) || "[]"),
          sender_name: sUser?.username,
          sender_avatar: sUser?.avatar,
          sender_color: sUser?.color,
          reply_message: replyMsg,
          file_name: r.file_name,
          file_size: r.file_size
        };
      }));

      return res.json({
        messages: populated,
        hasMore: msgRes.rows.length >= limit
      });
    } catch (err: any) {
      console.error("GET /api/messages/:roomId error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // REST Folder / Subject Posts Route (Multi-media restore, supports Digital Society and all folders)
  app.get(["/api/folders/:folderId/posts", "/api/subjects/:folderId/posts"], async (req, res) => {
    try {
      const folderName = req.params.folderId;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const beforeId = req.query.before ? Number(req.query.before) : null;

      let postsRes;
      if (beforeId && !isNaN(beforeId)) {
        postsRes = await client.execute({
          sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (LOWER(subject) = LOWER(?) OR subject = ?) AND id < ? ORDER BY id DESC LIMIT ?",
          args: [folderName, folderName, beforeId, limit]
        });
      } else {
        postsRes = await client.execute({
          sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (LOWER(subject) = LOWER(?) OR subject = ?) ORDER BY id DESC LIMIT ?",
          args: [folderName, folderName, limit]
        });
      }

      const postIds = postsRes.rows.map((p: any) => p.id);
      let likesRes: any = { rows: [] };
      if (postIds.length > 0) {
        const placeholders = postIds.map(() => "?").join(",");
        likesRes = await client.execute({ sql: `SELECT id, post_id, user_id FROM likes WHERE post_id IN (${placeholders})`, args: postIds });
      }

      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string || "");
      let currentUserId = 0;
      if (token) {
        const u = await client.execute({ sql: "SELECT id FROM users WHERE token = ?", args: [token] });
        if (u.rows.length > 0) currentUserId = Number(u.rows[0].id);
      }

      const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
        const pUser = await getUser(p.user_id as number);
        const postLikes = likesRes.rows.filter((l: any) => l.post_id === p.id);
        const is_liked = currentUserId ? postLikes.some((l: any) => l.user_id === currentUserId) : false;
        const ext = (p.image as string || "").split(".").pop()?.toLowerCase();
        const media_type = p.media_type || (["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image");
        return { 
          ...p, 
          media_type,
          username: pUser?.username, 
          avatar: pUser?.avatar, 
          color: pUser?.color, 
          likes_count: postLikes.length, 
          is_liked 
        };
      }));

      return res.json({
        posts: populated,
        hasMore: postsRes.rows.length >= limit
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/feed", async (req, res) => {
    try {
      const subjectFilter = req.query.subject as string | undefined;
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const beforeId = req.query.before ? Number(req.query.before) : null;

      let postsRes;
      if (subjectFilter && subjectFilter !== "null" && subjectFilter !== "undefined") {
        if (beforeId && !isNaN(beforeId)) {
          postsRes = await client.execute({
            sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (LOWER(subject) = LOWER(?) OR subject = ?) AND id < ? ORDER BY id DESC LIMIT ?",
            args: [subjectFilter, subjectFilter, beforeId, limit]
          });
        } else {
          postsRes = await client.execute({
            sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (LOWER(subject) = LOWER(?) OR subject = ?) ORDER BY id DESC LIMIT ?",
            args: [subjectFilter, subjectFilter, limit]
          });
        }
      } else {
        if (beforeId && !isNaN(beforeId)) {
          postsRes = await client.execute({
            sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (subject IS NULL OR subject = '' OR subject = 'null') AND id < ? ORDER BY id DESC LIMIT ?",
            args: [beforeId, limit]
          });
        } else {
          postsRes = await client.execute({
            sql: "SELECT id, user_id, image, caption, media_type, subject, attachments, created_at FROM posts WHERE (subject IS NULL OR subject = '' OR subject = 'null') ORDER BY id DESC LIMIT ?",
            args: [limit]
          });
        }
      }

      const postIds = postsRes.rows.map((p: any) => p.id);
      let likesRes: any = { rows: [] };
      if (postIds.length > 0) {
        const placeholders = postIds.map(() => "?").join(",");
        likesRes = await client.execute({ sql: `SELECT id, post_id, user_id FROM likes WHERE post_id IN (${placeholders})`, args: postIds });
      }

      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.query.token as string || "");
      let currentUserId = 0;
      if (token) {
        const u = await client.execute({ sql: "SELECT id FROM users WHERE token = ?", args: [token] });
        if (u.rows.length > 0) currentUserId = Number(u.rows[0].id);
      }

      const populated = await Promise.all(postsRes.rows.map(async (p: any) => {
        const pUser = await getUser(p.user_id as number);
        const postLikes = likesRes.rows.filter((l: any) => l.post_id === p.id);
        const is_liked = currentUserId ? postLikes.some((l: any) => l.user_id === currentUserId) : false;
        const ext = (p.image as string || "").split(".").pop()?.toLowerCase();
        const media_type = p.media_type || (["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image");
        return { 
          ...p, 
          media_type,
          username: pUser?.username, 
          avatar: pUser?.avatar, 
          color: pUser?.color, 
          likes_count: postLikes.length, 
          is_liked 
        };
      }));

      return res.json(populated);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.body.token as string || req.query.token as string || "");
      if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });

      const userRes = await client.execute({ 
        sql: "SELECT id, username, avatar, color, isBanned FROM users WHERE token = ?", 
        args: [token] 
      });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });

      const authUser = userRes.rows[0];
      if (Number(authUser.isBanned) === 1 || authUser.isBanned === "1") {
        return res.status(403).json({ error: "Hesabınız askıya alınmıştır." });
      }

      const userId = Number(authUser.id);
      const rawCaption = typeof req.body.caption === "string" ? req.body.caption.trim() : "";
      const rawImage = typeof req.body.image === "string" && req.body.image.trim() ? req.body.image.trim() : null;
      const rawSubject = typeof req.body.subject === "string" && req.body.subject.trim() ? req.body.subject.trim() : null;

      if (!rawCaption && !rawImage) {
        return res.status(400).json({ error: "Gönderi metni veya görseli boş olamaz." });
      }

      let mediaType = req.body.media_type;
      if (!mediaType && rawImage) {
        const ext = rawImage.split(".").pop()?.toLowerCase();
        mediaType = ["mp4", "webm", "mov", "mkv", "avi"].includes(ext || "") ? "video" : "image";
      }
      if (!mediaType) mediaType = "image";

      const rawAttachments = typeof req.body.attachments === "string" 
        ? req.body.attachments 
        : req.body.attachments 
        ? JSON.stringify(req.body.attachments) 
        : null;

      const createdAt = new Date().toISOString();
      const insertRes = await client.execute({
        sql: "INSERT INTO posts (user_id, image, caption, media_type, subject, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [userId, rawImage, rawCaption, mediaType, rawSubject, rawAttachments, createdAt]
      });

      const newPostId = Number(insertRes.lastInsertRowid);
      const newPost = {
        id: newPostId,
        user_id: userId,
        image: rawImage,
        caption: rawCaption,
        media_type: mediaType,
        subject: rawSubject,
        attachments: rawAttachments,
        created_at: createdAt,
        username: authUser.username,
        avatar: authUser.avatar,
        color: authUser.color,
        likes_count: 0,
        is_liked: false
      };

      io.emit("feed_updated");
      io.emit("new_post", newPost);
      return res.json({ success: true, post: newPost });
    } catch (err: any) {
      console.error("POST /api/posts error:", err);
      return res.status(500).json({ error: err.message || "Gönderi paylaşılamadı." });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });
      const userRes = await client.execute({ sql: "SELECT id, username, is_admin, roles FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });
      const authUser = userRes.rows[0];

      const targetId = req.params.id;
      if (!targetId || targetId === "undefined" || targetId === "null") {
        return res.status(400).json({ error: "Geçersiz veya eksik gönderi ID'si." });
      }
      const numPostId = Number(targetId);
      const isNum = !isNaN(numPostId);

      const postRes = await client.execute({
        sql: "SELECT * FROM posts WHERE id = ? OR id = ?",
        args: [isNum ? numPostId : targetId, String(targetId)]
      });
      if (postRes.rows.length === 0) {
        return res.status(404).json({ error: "Gönderi bulunamadı." });
      }

      const item = postRes.rows[0];
      const itemUserId = item.user_id !== undefined ? item.user_id : (item as any).userId;
      const usernameStr = authUser.username ? String(authUser.username).trim().toLowerCase() : "";
      const isSuperAdmin = usernameStr === "emirgan" || authUser.is_admin === 1 || (authUser as any).role === "admin";

      if (Number(itemUserId) !== Number(authUser.id) && !isSuperAdmin) {
        return res.status(403).json({ error: "Silme yetkiniz yok." });
      }

      // 1. Delete physical photo and multi-attachments from disk and database
      const postImage = (item.image || (item as any).image_url) as string | null;
      if (postImage) {
        await deleteUploadedFile(postImage).catch(() => {});
      }
      if ((item as any).attachments) {
        try {
          const atts = typeof (item as any).attachments === 'string' ? JSON.parse((item as any).attachments) : (item as any).attachments;
          if (Array.isArray(atts)) {
            for (const att of atts) {
              const url = typeof att === 'string' ? att : att?.url;
              if (url) await deleteUploadedFile(url).catch(() => {});
            }
          }
        } catch (e) {}
      }

      // 2. Delete from database (posts, likes, comments)
      await client.execute({ sql: "DELETE FROM posts WHERE id = ? OR id = ?", args: [isNum ? numPostId : targetId, String(targetId)] });
      await client.execute({ sql: "DELETE FROM likes WHERE post_id = ? OR post_id = ?", args: [isNum ? numPostId : targetId, String(targetId)] });
      await client.execute({ sql: "DELETE FROM comments WHERE post_id = ? OR post_id = ?", args: [isNum ? numPostId : targetId, String(targetId)] });

      const resolvedId = isNum ? numPostId : targetId;
      io.emit("post_deleted", { postId: resolvedId, id: resolvedId, _id: resolvedId });
      io.emit("feed_updated");
      return res.json({ success: true, postId: resolvedId, id: resolvedId, _id: resolvedId });
    } catch (err: any) {
      console.error("DELETE /api/posts/:id error:", err);
      res.status(500).json({ error: err.message || "Gönderi silinirken hata oluştu." });
    }
  });

  // REST API: Delete file (Universal File Delete endpoint)
  app.delete(["/api/files/:id", "/api/subjects/files/:id"], async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });
      const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });
      const authUser = userRes.rows[0];

      const rawId = req.params.id;
      const numId = Number(rawId);
      const fileId = !isNaN(numId) ? numId : rawId;

      const usernameStr = authUser.username ? String(authUser.username).trim().toLowerCase() : "";
      const isEmirgan = usernameStr === "emirgan" || authUser.is_admin === 1 || (authUser as any).role === "admin";

      let fileRes = await client.execute({
        sql: "SELECT * FROM uploaded_files WHERE id = ? OR filename = ?",
        args: [fileId, String(rawId)]
      });

      if (fileRes.rows.length === 0) {
        fileRes = await client.execute({
          sql: "SELECT * FROM subject_files WHERE id = ?",
          args: [fileId]
        });
      }

      if (fileRes.rows.length === 0) {
        return res.status(404).json({ error: "Dosya bulunamadı." });
      }

      const fileObj = fileRes.rows[0];
      const ownerId = Number(fileObj.user_id || fileObj.uploaded_by || fileObj.sender_id);
      if (ownerId && ownerId !== Number(authUser.id) && !isEmirgan) {
        return res.status(403).json({ error: "Bu içeriği silme yetkiniz bulunmamaktadır." });
      }

      const filePath = (fileObj.path || fileObj.url || fileObj.filename) as string;
      if (filePath) {
        await deleteUploadedFile(filePath).catch(() => {});
      }

      await client.execute({ sql: "DELETE FROM uploaded_files WHERE id = ? OR filename = ?", args: [fileId, String(rawId)] }).catch(() => {});
      await client.execute({ sql: "DELETE FROM subject_files WHERE id = ?", args: [fileId] }).catch(() => {});

      io.emit("file:deleted", { id: fileId });
      io.emit("subjects_updated");
      return res.json({ success: true, id: fileId });
    } catch (err: any) {
      console.error("DELETE /api/files/:id error:", err);
      return res.status(500).json({ error: "Dosya silinirken hata oluştu." });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Unauthorized" });
      const userRes = await client.execute({ sql: "SELECT id, username, is_admin, roles FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Unauthorized" });
      const authUser = userRes.rows[0];
      
      const targetId = req.params.id;
      if (!targetId || targetId === "undefined" || targetId === "null") {
        return res.status(400).json({ error: "Geçersiz veya eksik mesaj ID'si." });
      }
      const numId = Number(targetId);
      const isNum = !isNaN(numId);
      
      const usernameStr = authUser.username ? String(authUser.username).trim().toLowerCase() : "";
      const isSuperAdmin = usernameStr === "emirgan" || Number(authUser.is_admin) === 1 || String(authUser.is_admin) === "1" || String((authUser as any).role || "").trim().toUpperCase() === "ROOT" || String((authUser as any).role || "").trim().toUpperCase() === "ADMIN";
      
      for (const tbl of ["messages", "global_messages", "group_messages"]) {
        try {
          const msgRes = await client.execute({ 
            sql: `SELECT * FROM ${tbl} WHERE id = ? OR id = ?`, 
            args: [isNum ? numId : targetId, String(targetId)] 
          });
          if (msgRes.rows.length > 0) {
            const item = msgRes.rows[0];
            const senderId = Number(item.sender !== undefined ? item.sender : (item as any).userId || (item as any).user_id);
            const receiverId = Number((item as any).receiver);
            
            if (senderId !== Number(authUser.id) && receiverId !== Number(authUser.id) && !isSuperAdmin) {
              return res.status(403).json({ error: "Silme yetkiniz yok." });
            }
            await client.execute({ 
              sql: `DELETE FROM ${tbl} WHERE id = ? OR id = ?`, 
              args: [isNum ? numId : targetId, String(targetId)] 
            });

            // Clean up uploaded media
            if (item.content && typeof item.content === 'string' && item.content.startsWith('/uploads/')) {
              deleteUploadedFile(item.content).catch(() => {});
            }
            if ((item as any).image_url && typeof (item as any).image_url === 'string' && (item as any).image_url.startsWith('/uploads/')) {
              deleteUploadedFile((item as any).image_url).catch(() => {});
            }
            
            const messageId = isNum ? numId : targetId;
            const payload = { 
              message_id: messageId, 
              id: messageId, 
              _id: messageId,
              messageId: messageId,
              group_id: (item as any).group_id,
              receiver: (item as any).receiver
            };
            io.emit("message_deleted", payload);
            io.emit("message:deleted", payload);
            return res.json({ success: true, message_id: messageId, messageId: messageId, id: messageId, _id: messageId });
          }
        } catch (e) {
          console.error(`Error querying ${tbl} for deletion:`, e);
        }
      }
      return res.json({ success: true, alreadyDeleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Mesaj silinemedi." });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Giriş yapmalısınız." });
      const userRes = await client.execute({ sql: "SELECT id, username, is_admin FROM users WHERE token = ?", args: [token] });
      if (userRes.rows.length === 0) return res.status(401).json({ error: "Geçersiz oturum." });
      const authUser = userRes.rows[0];

      const rawId = req.params.id;
      const numId = Number(rawId);
      const commentId = !isNaN(numId) ? numId : rawId;

      const commentRes = await client.execute({
        sql: "SELECT id, post_id, user_id FROM comments WHERE id = ? OR id = ?",
        args: [commentId, String(rawId)]
      });
      if (commentRes.rows.length === 0) {
        return res.status(404).json({ error: "Yorum bulunamadı." });
      }

      const comment = commentRes.rows[0];
      const isEmirgan = authUser.username && (authUser.username as string).trim().toLowerCase() === "emirgan";
      const isAdmin = isEmirgan || authUser.is_admin === 1 || (authUser as any).role === "admin";

      …76727 tokens truncated…UnoRoom(roomId);
      emitUnoRoomsList();
    });

    socket.on("uno_add_bot", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;
      if (room.players.length >= 4) return socket.emit("uno_error", "Masa dolu.");

      const botNames = ["Bot Aylin", "Bot Can", "Bot Deniz", "Bot Efe", "Bot Zeynep", "Bot Mert"];
      const usedNames = new Set(room.players.map((p: any) => p.username));
      const availableName = botNames.find(n => !usedNames.has(n)) || `Bot ${room.players.length + 1}`;
      const botId = -Date.now() - Math.floor(Math.random() * 1000);

      room.players.push({
        id: botId,
        username: availableName,
        avatar: null,
        color: '#6366f1',
        isBot: true,
        hand: [],
        hasCalledUno: false,
        score: 0
      });

      room.lastActionMessage = `${availableName} masaya eklendi.`;
      broadcastUnoRoom(roomId);
      emitUnoRoomsList();
    });

    socket.on("uno_remove_bot", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;

      const lastBotIdx = room.players.map((p: any) => p.isBot).lastIndexOf(true);
      if (lastBotIdx !== -1) {
        const removed = room.players.splice(lastBotIdx, 1)[0];
        room.lastActionMessage = `${removed.username} masadan çıkarıldı.`;
        broadcastUnoRoom(roomId);
        emitUnoRoomsList();
      }
    });

    socket.on("uno_start_game", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'waiting') return;
      if (room.players.length < 2) return socket.emit("uno_error", "Oyunu başlatmak için en az 2 oyuncu gerekir.");

      // Create 108 card deck
      const fullDeck = createUnoDeck();
      room.deck = fullDeck;
      room.discardPile = [];

      // Deal 7 cards to each player
      for (const p of room.players) {
        p.hand = room.deck.splice(0, 7);
        p.hasCalledUno = false;
      }

      // Flip starting top card (draw until a number card 0-9 for clean start)
      let firstCard = room.deck.pop()!;
      while (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(firstCard.value)) {
        room.deck.unshift(firstCard);
        firstCard = room.deck.pop()!;
      }

      room.topCard = firstCard;
      room.activeColor = firstCard.color;
      room.direction = 1;
      room.currentTurn = 0;
      room.status = 'playing';
      room.winnerId = null;
      room.lastActionMessage = `UNO başladı! İlk kart: ${COLOR_STYLES[firstCard.color]?.label || firstCard.color} ${firstCard.value}`;

      broadcastUnoRoom(roomId);
      emitUnoRoomsList();

      if (room.players[0]?.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_play_card", (data: { cardId: string; chosenColor?: UnoColor }) => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) {
        return socket.emit("uno_error", "Sıra sizde değil.");
      }

      const card = currentPlayer.hand.find((c: UnoCard) => c.id === data.cardId);
      if (!card) return socket.emit("uno_error", "Kart elinizde bulunamadı.");

      if (!isCardPlayable(card, room.topCard, room.activeColor)) {
        return socket.emit("uno_error", "Bu kart şu an oynanamaz! Renk veya sayı eşleşmeli.");
      }

      executePlayUnoCard(room, currentPlayer, data.cardId, data.chosenColor);
    });

    socket.on("uno_draw_card", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) {
        return socket.emit("uno_error", "Sıra sizde değil.");
      }

      const drawnCards = drawCardsFromUnoDeck(room, 1);
      if (drawnCards.length > 0) {
        const drawn = drawnCards[0];
        currentPlayer.hand.push(drawn);
        
        // If the drawn card is playable, allow player to play it or pass
        if (isCardPlayable(drawn, room.topCard, room.activeColor)) {
          room.lastActionMessage = `${currentPlayer.username} kart çekti. Oynayabilir veya Pas geçebilir!`;
          broadcastUnoRoom(roomId);
        } else {
          // If not playable, advance turn automatically
          advanceUnoTurn(room, 1);
          room.lastActionMessage = `${currentPlayer.username} kart çekti ve pas geçti.`;
          broadcastUnoRoom(roomId);

          const nextP = room.players[room.currentTurn];
          if (nextP && nextP.isBot) {
            runBotTurnUno(roomId);
          }
        }
      }
    });

    socket.on("uno_pass_turn", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const currentPlayer = room.players[room.currentTurn];
      if (!currentPlayer || currentPlayer.id !== user.id) return;

      advanceUnoTurn(room, 1);
      room.lastActionMessage = `${currentPlayer.username} pas geçti.`;
      broadcastUnoRoom(roomId);

      const nextP = room.players[room.currentTurn];
      if (nextP && nextP.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_call_uno", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.status !== 'playing') return;

      const player = room.players.find((p: any) => p.id === user.id);
      if (!player) return;

      player.hasCalledUno = true;
      room.lastActionMessage = `🔥 ${player.username}: "UNO!" 🎴`;
      broadcastUnoRoom(roomId);
    });

    socket.on("uno_restart_game", () => {
      const roomId = socket.data.currentUnoRoom;
      if (!roomId) return;
      const room = unoRooms.get(roomId);
      if (!room || room.hostId !== user.id || room.status !== 'ended') return;

      // Promote waiting spectators into active players for the new round
      if (Array.isArray(room.spectators) && room.spectators.length > 0) {
        for (let i = 0; i < room.players.length && room.spectators.length > 0; i++) {
          if (room.players[i].isBot) {
            const spec = room.spectators.shift();
            room.players[i] = {
              id: spec.id,
              username: spec.username,
              avatar: spec.avatar,
              color: spec.color,
              isBot: false,
              socketId: spec.socketId,
              hand: [],
              hasCalledUno: false,
              score: 0
            };
            if (spec.socketId) {
              io.to(spec.socketId).emit("uno_promoted_to_player", { message: "Yeni tur başladı, oyuna dahil edildiniz!" });
            }
          }
        }
        while (room.players.length < 4 && room.spectators.length > 0) {
          const spec = room.spectators.shift();
          room.players.push({
            id: spec.id,
            username: spec.username,
            avatar: spec.avatar,
            color: spec.color,
            isBot: false,
            socketId: spec.socketId,
            hand: [],
            hasCalledUno: false,
            score: 0
          });
          if (spec.socketId) {
            io.to(spec.socketId).emit("uno_promoted_to_player", { message: "Yeni tur başladı, oyuna dahil edildiniz!" });
          }
        }
      }

      const fullDeck = createUnoDeck();
      room.deck = fullDeck;
      room.discardPile = [];
      for (const p of room.players) {
        p.hand = room.deck.splice(0, 7);
        p.hasCalledUno = false;
      }
      let firstCard = room.deck.pop()!;
      while (firstCard.color === 'wild' || ['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(firstCard.value)) {
        room.deck.unshift(firstCard);
        firstCard = room.deck.pop()!;
      }
      room.topCard = firstCard;
      room.activeColor = firstCard.color;
      room.direction = 1;
      room.currentTurn = 0;
      room.status = 'playing';
      room.winnerId = null;
      room.lastActionMessage = `Yeni UNO turu başladı! İlk kart: ${COLOR_STYLES[firstCard.color]?.label || firstCard.color} ${firstCard.value}`;

      broadcastUnoRoom(roomId);
      emitUnoRoomsList();

      if (room.players[0]?.isBot) {
        runBotTurnUno(roomId);
      }
    });

    socket.on("uno_leave_room", () => {
      const roomId = socket.data.currentUnoRoom;
      if (roomId) {
        socket.leave(`uno_${roomId}`);
        const room = unoRooms.get(roomId);
        if (room) {
          const wasHost = room.hostId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);
          if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
            clearTimeout(room.botTimeout);
            unoRooms.delete(roomId);
          } else {
            if (wasHost) {
              const nextReal = room.players.find((p: any) => !p.isBot);
              if (nextReal) {
                room.hostId = nextReal.id;
                room.creatorId = nextReal.id;
                room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextReal.username}`;
              }
            }
            broadcastUnoRoom(roomId);
          }
          emitUnoRoomsList();
        }
        socket.data.currentUnoRoom = null;
      }
    });

    // --- Voice Chat Socket Handlers ---
    socket.on("get_voice_rooms", (cb?: (rooms: any[]) => void) => {
      const list = getSanitizedVoiceRoomsList();
      if (cb) cb(list);
      else socket.emit("voice_rooms_list", list);
    });

    socket.on("get_my_voice_room", (cb?: (data: any) => void) => {
      let targetRoomId = socket.data.currentVoiceRoom;
      if (!targetRoomId) {
        for (const [id, r] of voiceRooms.entries()) {
          if (r.participants.has(user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }
      if (targetRoomId) {
        const room = voiceRooms.get(targetRoomId);
        if (room) {
          socket.data.currentVoiceRoom = targetRoomId;
          socket.join(`voice_${targetRoomId}`);
          if (cb) cb({ success: true, room: getSanitizedVoiceRoom(room) });
          return;
        }
      }
      if (cb) cb({ success: false });
    });

    socket.on("create_voice_room", (data: { name: string; maxParticipants?: number }, cb?: (res: any) => void) => {
      const existingRoomId = socket.data.currentVoiceRoom;
      if (existingRoomId) {
        const oldRoom = voiceRooms.get(existingRoomId);
        if (oldRoom) {
          if (oldRoom.hostId === user.id) {
            io.to(`voice_${existingRoomId}`).emit("voice_room_closed", { reason: "Oda kurucusu yeni bir oda açtığı için bu oda kapatıldı." });
            voiceRooms.delete(existingRoomId);
          } else {
            oldRoom.participants.delete(user.id);
            socket.to(`voice_${existingRoomId}`).emit("voice_user_left", { userId: user.id, socketId: socket.id });
            broadcastVoiceRoom(existingRoomId);
          }
          socket.leave(`voice_${existingRoomId}`);
        }
      }

      const rawName = (data?.name || "").trim();
      const roomName = rawName.slice(0, 35) || `${user.username}'in Odası`;
      const maxParticipants = Math.min(MAX_VOICE_ROOM_PARTICIPANTS, Math.max(2, Number(data?.maxParticipants) || 8));
      const roomId = `vr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newParticipant: ServerVoiceParticipant = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        socketId: socket.id,
        isHost: true,
        isMuted: false,
        isSpeaking: false,
        isDeafened: false,
        isVideoOff: true,
        joinedAt: new Date().toISOString()
      };

      const newRoom: ServerVoiceRoom = {
        id: roomId,
        name: roomName,
        hostId: user.id,
        hostUsername: user.username,
        maxParticipants,
        participants: new Map([[user.id, newParticipant]]),
        createdAt: new Date().toISOString()
      };

      voiceRooms.set(roomId, newRoom);
      socket.data.currentVoiceRoom = roomId;
      socket.join(`voice_${roomId}`);

      emitVoiceRoomsList();
      const sanitized = getSanitizedVoiceRoom(newRoom);
      if (cb) cb({ success: true, room: sanitized });
    });

    socket.on("join_voice_room", (data: { roomId: string }, cb?: (res: any) => void) => {
      const { roomId } = data || {};
      if (!roomId) return cb && cb({ success: false, message: "Geçersiz oda ID." });

      const room = voiceRooms.get(roomId);
      if (!room) return cb && cb({ success: false, message: "Oda bulunamadı veya kapatılmış." });

      if (room.participants.size >= room.maxParticipants && !room.participants.has(user.id)) {
        return cb && cb({ success: false, message: "Oda maksimum kişi kapasitesine ulaştı." });
      }

      if (socket.data.currentVoiceRoom && socket.data.currentVoiceRoom !== roomId) {
        const oldRoom = voiceRooms.get(socket.data.currentVoiceRoom);
        if (oldRoom) {
          if (oldRoom.hostId === user.id) {
            io.to(`voice_${socket.data.currentVoiceRoom}`).emit("voice_room_closed", { reason: "Oda kurucusu ayrıldığı için oda kapatıldı." });
            voiceRooms.delete(socket.data.currentVoiceRoom);
          } else {
            oldRoom.participants.delete(user.id);
            socket.to(`voice_${socket.data.currentVoiceRoom}`).emit("voice_user_left", { userId: user.id, socketId: socket.id });
            broadcastVoiceRoom(socket.data.currentVoiceRoom);
          }
          socket.leave(`voice_${socket.data.currentVoiceRoom}`);
        }
      }

      const isHost = room.hostId === user.id;

      // Clear any pending disconnect grace timer if user reconnects
      const pendingGrace = voiceDisconnectGraceTimers.get(user.id);
      if (pendingGrace) {
        clearTimeout(pendingGrace);
        voiceDisconnectGraceTimers.delete(user.id);
      }

      const participant: ServerVoiceParticipant = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        socketId: socket.id,
        isHost,
        isMuted: false,
        isSpeaking: false,
        isDeafened: false,
        isVideoOff: true,
        joinedAt: new Date().toISOString()
      };

      room.participants.set(user.id, participant);
      socket.data.currentVoiceRoom = roomId;
      socket.join(`voice_${roomId}`);

      socket.to(`voice_${roomId}`).emit("voice_user_joined", participant);
      broadcastVoiceRoom(roomId);
      emitVoiceRoomsList();

      const existingPeers = Array.from(room.participants.values()).filter(p => p.id !== user.id);
      if (cb) cb({ success: true, room: getSanitizedVoiceRoom(room), existingPeers });
    });

    socket.on("leave_voice_room", (cb?: (res: any) => void) => {
      const roomId = socket.data.currentVoiceRoom;
      if (roomId) {
        socket.leave(`voice_${roomId}`);
        const room = voiceRooms.get(roomId);
        if (room) {
          if (room.hostId === user.id) {
            io.to(`voice_${roomId}`).emit("voice_room_closed", { reason: "Oda kurucusu ayrıldığı için oda kapatıldı." });
            voiceRooms.delete(roomId);
          } else {
            room.participants.delete(user.id);
            socket.to(`voice_${roomId}`).emit("voice_user_left", { userId: user.id, socketId: socket.id });
            broadcastVoiceRoom(roomId);
          }
          emitVoiceRoomsList();
        }
        socket.data.currentVoiceRoom = null;
      }
      if (cb) cb({ success: true });
    });

    socket.on("voice_kick_user", (data: { roomId: string; targetUserId: number }, cb?: (res: any) => void) => {
      const { roomId, targetUserId } = data || {};
      if (!roomId || !targetUserId) return cb && cb({ success: false, message: "Eksik parametre." });

      const room = voiceRooms.get(roomId);
      if (!room) return cb && cb({ success: false, message: "Oda bulunamadı." });
      if (room.hostId !== user.id) return cb && cb({ success: false, message: "Bu işlem için sadece oda kurucusu yetkilidir." });
      if (targetUserId === user.id) return cb && cb({ success: false, message: "Kendinizi atamazsınız." });

      const target = room.participants.get(targetUserId);
      if (!target) return cb && cb({ success: false, message: "Kullanıcı bu odada değil." });

      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit("kick_from_voice", { roomId, reason: "Oda kurucusu tarafından sesli odadan çıkarıldınız." });
        targetSocket.leave(`voice_${roomId}`);
        targetSocket.data.currentVoiceRoom = null;
      }

      room.participants.delete(targetUserId);
      socket.to(`voice_${roomId}`).emit("voice_user_left", { userId: targetUserId, socketId: target.socketId });
      broadcastVoiceRoom(roomId);
      emitVoiceRoomsList();

      if (cb) cb({ success: true });
    });

    socket.on("voice_force_mute", (data: { roomId: string; targetUserId: number }, cb?: (res: any) => void) => {
      const { roomId, targetUserId } = data || {};
      if (!roomId || !targetUserId) return cb && cb({ success: false, message: "Eksik parametre." });

      const room = voiceRooms.get(roomId);
      if (!room) return cb && cb({ success: false, message: "Oda bulunamadı." });
      if (room.hostId !== user.id) return cb && cb({ success: false, message: "Bu işlem için sadece oda kurucusu yetkilidir." });

      const target = room.participants.get(targetUserId);
      if (target) {
        target.isMuted = true;
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit("voice_force_mute_received", { roomId, reason: "Oda kurucusu mikrofonunuzu kapattı." });
        }
        broadcastVoiceRoom(roomId);
        if (cb) cb({ success: true });
      } else {
        if (cb) cb({ success: false, message: "Kullanıcı bulunamadı." });
      }
    });

    socket.on("voice_force_camera_off", (data: { roomId: string; targetUserId: number }, cb?: (res: any) => void) => {
      const { roomId, targetUserId } = data || {};
      if (!roomId || !targetUserId) return cb && cb({ success: false, message: "Eksik parametre." });

      const room = voiceRooms.get(roomId);
      if (!room) return cb && cb({ success: false, message: "Oda bulunamadı." });
      if (room.hostId !== user.id) return cb && cb({ success: false, message: "Bu işlem için sadece oda kurucusu yetkilidir." });

      const target = room.participants.get(targetUserId);
      if (target) {
        target.isVideoOff = true;
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit("voice_force_camera_off_received", { roomId, reason: "Oda kurucusu kameranızı kapattı." });
        }
        broadcastVoiceRoom(roomId);
        if (cb) cb({ success: true });
      } else {
        if (cb) cb({ success: false, message: "Kullanıcı bulunamadı." });
      }
    });

    socket.on("voice_update_status", (data: { roomId: string; isMuted?: boolean; isSpeaking?: boolean; isDeafened?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean; isScreenAudioEnabled?: boolean }) => {
      const { roomId, isMuted, isSpeaking, isDeafened, isVideoOff, isScreenSharing, isScreenAudioEnabled } = data || {};
      if (!roomId) return;
      const room = voiceRooms.get(roomId);
      if (!room) return;

      const p = room.participants.get(user.id);
      if (p) {
        if (typeof isMuted === 'boolean') p.isMuted = isMuted;
        if (typeof isSpeaking === 'boolean') p.isSpeaking = isSpeaking;
        if (typeof isDeafened === 'boolean') p.isDeafened = isDeafened;
        if (typeof isVideoOff === 'boolean') p.isVideoOff = isVideoOff;
        if (typeof isScreenSharing === 'boolean') p.isScreenSharing = isScreenSharing;
        if (typeof isScreenAudioEnabled === 'boolean') (p as any).isScreenAudioEnabled = isScreenAudioEnabled;
        io.to(`voice_${roomId}`).emit("voice_user_status_changed", {
          userId: user.id,
          socketId: socket.id,
          isMuted: p.isMuted,
          isSpeaking: p.isSpeaking,
          isDeafened: p.isDeafened,
          isVideoOff: p.isVideoOff,
          isScreenSharing: p.isScreenSharing,
          isScreenAudioEnabled: (p as any).isScreenAudioEnabled
        });
      }
    });

    socket.on("screen_share_status", (data: { roomId?: string; isSharing: boolean; isScreenAudioEnabled?: boolean }) => {
      const targetRoomId = data?.roomId || socket.data.currentVoiceRoom;
      if (!targetRoomId) return;
      const room = voiceRooms.get(targetRoomId);
      if (!room) return;

      const p = room.participants.get(user.id);
      if (p) {
        p.isScreenSharing = Boolean(data?.isSharing);
        (p as any).isScreenAudioEnabled = Boolean(data?.isScreenAudioEnabled);
        if (p.isScreenSharing) {
          p.isVideoOff = false;
        }
        io.to(`voice_${targetRoomId}`).emit("voice_user_status_changed", {
          userId: user.id,
          socketId: socket.id,
          isMuted: p.isMuted,
          isSpeaking: p.isSpeaking,
          isDeafened: p.isDeafened,
          isVideoOff: p.isVideoOff,
          isScreenSharing: p.isScreenSharing,
          isScreenAudioEnabled: (p as any).isScreenAudioEnabled
        });
        broadcastVoiceRoom(targetRoomId);
      }
    });

    // Voice Room Keepalive Heartbeat: Prevents Cloudflare / Nginx 60-second proxy timeout drops
    socket.on("voice_ping", (data: any) => {
      socket.emit("voice_pong", {
        timestamp: Date.now(),
        clientTime: data?.timestamp
      });
    });

    socket.on("voice:invite_user", (data: { targetUserId: number; roomId: string; roomName: string; inviter?: any }, cb?: any) => {
      const { targetUserId, roomId, roomName } = data || {};
      if (!targetUserId || !roomId) {
        if (cb) cb({ success: false, message: "Eksik parametre." });
        return;
      }
      const targetSocket = onlineUsers.get(Number(targetUserId));
      if (targetSocket) {
        io.to(targetSocket).emit("voice:invite_user", {
          roomId,
          roomName: roomName || "Sesli Sohbet Odası",
          inviter: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            color: user.color
          }
        });
        if (cb) cb({ success: true });
      } else {
        if (cb) cb({ success: false, message: "Kullanıcı çevrimdışı." });
      }
    });

    socket.on("voice:invite_response", (data: { accepted: boolean; roomId: string; inviterId: number }) => {
      const { accepted, roomId, inviterId } = data || {};
      if (inviterId) {
        const inviterSocket = onlineUsers.get(Number(inviterId));
        if (inviterSocket) {
          io.to(inviterSocket).emit("voice:invite_response", {
            accepted,
            roomId,
            responder: {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              color: user.color
            }
          });
        }
      }
    });

    // --- WebRTC Mesh Signaling Handlers (Direct Tunnel / Zero Memory Footprint) ---
    socket.on("voice_offer", (data: { targetSocketId: string; offer: any }) => {
      if (data?.targetSocketId) {
        socket.to(data.targetSocketId).emit("voice_offer", {
          senderSocketId: socket.id,
          senderUserId: user.id,
          offer: data.offer
        });
      }
      if (data) data.offer = null;
    });

    socket.on("voice_answer", (data: { targetSocketId: string; answer: any }) => {
      if (data?.targetSocketId) {
        socket.to(data.targetSocketId).emit("voice_answer", {
          senderSocketId: socket.id,
          senderUserId: user.id,
          answer: data.answer
        });
      }
      if (data) data.answer = null;
    });

    socket.on("voice_ice_candidate", (data: { targetSocketId: string; candidate: any }) => {
      if (data?.targetSocketId) {
        socket.to(data.targetSocketId).emit("voice_ice_candidate", {
          senderSocketId: socket.id,
          senderUserId: user.id,
          candidate: data.candidate
        });
      }
      if (data) data.candidate = null;
    });

    // ----------------------------------------------------
    // --- 1-ON-1 DIRECT VOICE CALL (DM BİREBİR SESLİ ARAMA) ---
    // ----------------------------------------------------
    socket.on("direct_call_start", async (data: { targetUserId: number }, cb?: (res: any) => void) => {
      const callerId = userIdNum;
      const receiverId = Number(data?.targetUserId);

      if (!receiverId || callerId === receiverId) {
        return cb && cb({ error: "Geçersiz arama hedefi." });
      }

      // Check if caller already in call
      if (userActiveCallId.has(callerId)) {
        return cb && cb({ error: "Zaten aktif bir görüşmeniz bulunuyor." });
      }

      // Check if receiver is online
      const receiverSocketId = onlineUsers.get(receiverId);
      if (!receiverSocketId) {
        return cb && cb({ error: "Kullanıcı şu an çevrimdışı." });
      }

      // Check if receiver is already in a call
      if (userActiveCallId.has(receiverId)) {
        return cb && cb({ error: "Kullanıcı şu an başka bir görüşmede." });
      }

      try {
        const receiverUser = await getUser(receiverId);
        if (!receiverUser) {
          return cb && cb({ error: "Kullanıcı bulunamadı." });
        }

        const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const session: DirectCallSession = {
          callId,
          callerId,
          callerUsername: user.username,
          callerAvatar: user.avatar,
          callerColor: user.color,
          receiverId,
          receiverUsername: receiverUser.username,
          receiverAvatar: receiverUser.avatar,
          receiverColor: receiverUser.color,
          status: 'ringing',
          startedAt: Date.now()
        };

        // Create timeout for 30s auto-hangup
        const timeoutTimer = setTimeout(() => {
          const s = directCalls.get(callId);
          if (s && s.status === 'ringing') {
            // Auto timeout hangup
            directCalls.delete(callId);
            userActiveCallId.delete(callerId);
            userActiveCallId.delete(receiverId);

            // Notify both of timeout
            io.to(socket.id).emit("direct_call_timeout", { callId });
            const rSocket = onlineUsers.get(receiverId);
            if (rSocket) {
              io.to(rSocket).emit("direct_call_timeout", { callId });
            }

            // Write missed call notification / system message in direct messages
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const sysMsgContent = `📞 Cevapsız Sesli Arama • ${timeStr}`;
            
            client.execute({
              sql: "INSERT INTO messages (sender_id, receiver_id, content, created_at, read_status) VALUES (?, ?, ?, ?, ?)",
              args: [callerId, receiverId, sysMsgContent, now.toISOString(), 0]
            }).then((res) => {
              const msgId = Number(res.lastInsertRowid);
              const payload = {
                id: msgId,
                sender: callerId,
                receiver: receiverId,
                type: "text",
                content: sysMsgContent,
                reactions: "{}",
                created_at: now.toISOString(),
                sender_name: user.username,
                sender_avatar: user.avatar,
                sender_color: user.color
              };
              socket.emit("receive_direct_message", payload);
              if (rSocket) {
                io.to(rSocket).emit("receive_direct_message", payload);
              }
            }).catch(() => {});
          }
        }, 30000);

        session.timeoutTimer = timeoutTimer;

        directCalls.set(callId, session);
        userActiveCallId.set(callerId, callId);
        userActiveCallId.set(receiverId, callId);

        // Emit direct_call_incoming to the receiver
        io.to(receiverSocketId).emit("direct_call_incoming", {
          callId,
          callerId,
          callerUsername: user.username,
          callerAvatar: user.avatar,
          callerColor: user.color
        });

        if (cb) {
          cb({
            success: true,
            callId,
            callerId,
            receiverId,
            receiverUsername: receiverUser.username,
            receiverAvatar: receiverUser.avatar,
            receiverColor: receiverUser.color,
            status: 'ringing'
          });
        }
      } catch (err) {
        console.error("Error starting direct call:", err);
        if (cb) cb({ error: "Arama başlatılamadı." });
      }
    });

    socket.on("direct_call_accept", (data: { callId: string }, cb?: (res: any) => void) => {
      const session = directCalls.get(data?.callId);
      if (!session) {
        return cb && cb({ error: "Arama bulunamadı veya sonlandırıldı." });
      }

      if (session.receiverId !== userIdNum) {
        return cb && cb({ error: "Bu aramayı kabul etme yetkiniz yok." });
      }

      // Stop ringing timeout
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
      }

      session.status = 'connected';
      session.connectedAt = Date.now();

      // Notify caller and receiver of acceptance
      const callerSocketId = onlineUsers.get(session.callerId);
      const receiverSocketId = onlineUsers.get(session.receiverId);

      if (callerSocketId) {
        io.to(callerSocketId).emit("direct_call_accepted", {
          callId: session.callId,
          peerId: session.receiverId,
          peerUsername: session.receiverUsername,
          peerAvatar: session.receiverAvatar,
          peerColor: session.receiverColor
        });
      }

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("direct_call_accepted", {
          callId: session.callId,
          peerId: session.callerId,
          peerUsername: session.callerUsername,
          peerAvatar: session.callerAvatar,
          peerColor: session.callerColor
        });
      }

      if (cb) cb({ success: true });
    });

    socket.on("direct_call_reject", (data: { callId: string }) => {
      const session = directCalls.get(data?.callId);
      if (!session) return;

      if (session.receiverId !== userIdNum) return;

      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
      }

      directCalls.delete(session.callId);
      userActiveCallId.delete(session.callerId);
      userActiveCallId.delete(session.receiverId);

      // Notify caller that call was rejected
      const callerSocketId = onlineUsers.get(session.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit("direct_call_rejected", {
          callId: session.callId,
          reason: "dm_call_rejected"
        });
      }
    });

    socket.on("direct_call_end", (data: { callId: string }) => {
      const session = directCalls.get(data?.callId);
      if (!session) return;

      if (session.callerId !== userIdNum && session.receiverId !== userIdNum) return;

      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer);
        session.timeoutTimer = null;
      }

      directCalls.delete(session.callId);
      userActiveCallId.delete(session.callerId);
      userActiveCallId.delete(session.receiverId);

      const targetId = session.callerId === userIdNum ? session.receiverId : session.callerId;
      const targetSocketId = onlineUsers.get(targetId);

      if (targetSocketId) {
        io.to(targetSocketId).emit("direct_call_ended", { callId: session.callId });
      }
    });

    socket.on("direct_call_signal_offer", (data: { callId: string; offer: any }) => {
      const session = directCalls.get(data?.callId);
      if (!session) return;
      if (session.callerId !== userIdNum && session.receiverId !== userIdNum) return;

      const targetId = session.callerId === userIdNum ? session.receiverId : session.callerId;
      const targetSocketId = onlineUsers.get(targetId);

      if (targetSocketId) {
        io.to(targetSocketId).emit("direct_call_signal_offer", {
          callId: session.callId,
          offer: data.offer
        });
      }
      if (data) data.offer = null;
    });

    socket.on("direct_call_signal_answer", (data: { callId: string; answer: any }) => {
      const session = directCalls.get(data?.callId);
      if (!session) return;
      if (session.callerId !== userIdNum && session.receiverId !== userIdNum) return;

      const targetId = session.callerId === userIdNum ? session.receiverId : session.callerId;
      const targetSocketId = onlineUsers.get(targetId);

      if (targetSocketId) {
        io.to(targetSocketId).emit("direct_call_signal_answer", {
          callId: session.callId,
          answer: data.answer
        });
      }
      if (data) data.answer = null;
    });

    socket.on("direct_call_signal_ice", (data: { callId: string; candidate: any }) => {
      const session = directCalls.get(data?.callId);
      if (!session) return;
      if (session.callerId !== userIdNum && session.receiverId !== userIdNum) return;

      const targetId = session.callerId === userIdNum ? session.receiverId : session.callerId;
      const targetSocketId = onlineUsers.get(targetId);

      if (targetSocketId) {
        io.to(targetSocketId).emit("direct_call_signal_ice", {
          callId: session.callId,
          candidate: data.candidate
        });
      }
      if (data) data.candidate = null;
    });

    // --- Draw & Guess (Çiz & Tahmin Et) Socket Handlers ---
    socket.on("get_drawguess_rooms", (cb?: (rooms: any[]) => void) => {
      const list = getSanitizedDrawGuessRoomsList();
      if (cb) cb(list);
      else socket.emit("drawguess_rooms_list", list);
    });

    socket.on("get_my_drawguess_room", (cb?: (data: any) => void) => {
      let targetRoomId = socket.data.currentDrawGuessRoom;
      if (!targetRoomId) {
        for (const [id, r] of drawGuessRooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }
      if (targetRoomId) {
        const room = drawGuessRooms.get(targetRoomId);
        if (room) {
          socket.data.currentDrawGuessRoom = targetRoomId;
          socket.join(`drawguess_${targetRoomId}`);
          if (cb) cb({ success: true, room: getSanitizedDrawGuessRoom(room, user.id) });
          return;
        }
      }
      if (cb) cb({ success: false });
    });

    socket.on("create_drawguess_room", (data: { name: string; maxPlayers?: number; totalRounds?: number }, cb?: (res: any) => void) => {
      const { name, maxPlayers = 6, totalRounds = 3 } = data || {};
      if (!name || !name.trim()) {
        return cb && cb({ success: false, message: "Oda adı geçerli değil." });
      }

      const roomId = `dg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const creatorPlayer = {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        score: 0,
        roundScore: 0,
        hasGuessed: false,
        isDrawing: false,
        isHost: true,
        socketId: socket.id
      };

      const newRoom = {
        id: roomId,
        name: name.trim().substring(0, 30),
        hostId: user.id,
        hostUsername: user.username,
        maxPlayers: Math.max(2, Math.min(10, Number(maxPlayers) || 6)),
        totalRounds: Math.max(2, Math.min(5, Number(totalRounds) || 3)),
        currentRound: 1,
        currentDrawerIndex: 0,
        drawerId: null,
        drawerUsername: null,
        status: 'lobby',
        currentWord: '',
        wordChoices: [],
        usedWords: new Set<string>(),
        timer: 0,
        roundDuration: 70,
        players: [creatorPlayer],
        chatMessages: [
          {
            id: 'dg_init_' + Date.now(),
            userId: 0,
            username: 'Sistem',
            text: `🎨 ${user.username} odayı kurdu. Hoş geldiniz!`,
            isSystem: true,
            createdAt: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString()
      };

      drawGuessRooms.set(roomId, newRoom);
      socket.data.currentDrawGuessRoom = roomId;
      socket.join(`drawguess_${roomId}`);

      emitDrawGuessRoomsList();
      if (cb) cb({ success: true, room: getSanitizedDrawGuessRoom(newRoom, user.id) });
    });

    socket.on("join_drawguess_room", (data: { roomId: string }, cb?: (res: any) => void) => {
      const { roomId } = data || {};
      if (!roomId) return cb && cb({ success: false, message: "Oda kimliği belirtilmedi." });

      const room = drawGuessRooms.get(roomId);
      if (!room) return cb && cb({ success: false, message: "Oda bulunamadı." });

      if (room.players.length >= room.maxPlayers) {
        return cb && cb({ success: false, message: "Oda dolu." });
      }

      const existingIdx = room.players.findIndex((p: any) => p.id === user.id);
      if (existingIdx !== -1) {
        room.players[existingIdx].socketId = socket.id;
      } else {
        room.players.push({
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          score: 0,
          roundScore: 0,
          hasGuessed: false,
          isDrawing: false,
          isHost: room.hostId === user.id,
          socketId: socket.id
        });

        const joinMsg = {
          id: 'dg_join_' + Date.now() + '_' + Math.random(),
          userId: 0,
          username: 'Sistem',
          text: `👋 ${user.username} odaya katıldı.`,
          isSystem: true,
          createdAt: new Date().toISOString()
        };
        addDrawGuessChatMessage(room, joinMsg);
        io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", joinMsg);
      }

      socket.data.currentDrawGuessRoom = roomId;
      socket.join(`drawguess_${roomId}`);

      broadcastDrawGuessRoom(roomId);
      emitDrawGuessRoomsList();

      socket.emit("drawguess_chat_history", room.chatMessages || []);

      if (cb) cb({ success: true, room: getSanitizedDrawGuessRoom(room, user.id) });
    });

    socket.on("leave_drawguess_room", (cb?: (res: any) => void) => {
      const roomId = socket.data.currentDrawGuessRoom;
      if (roomId) {
        socket.leave(`drawguess_${roomId}`);
        const room = drawGuessRooms.get(roomId);
        if (room) {
          const wasHost = room.hostId === user.id;
          const wasDrawer = room.drawerId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);

          if (room.players.length === 0) {
            cleanupDrawGuessRoom(roomId);
          } else {
            if (wasHost) {
              const nextHost = room.players[0];
              room.hostId = nextHost.id;
              room.hostUsername = nextHost.username;
              nextHost.isHost = true;
              const hostMsg = {
                id: 'dg_host_' + Date.now(),
                userId: 0,
                username: 'Sistem',
                text: `👑 Oda kurucusu ayrıldı. Yeni kurucu: ${nextHost.username}`,
                isSystem: true,
                createdAt: new Date().toISOString()
              };
              addDrawGuessChatMessage(room, hostMsg);
              io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", hostMsg);
            }

            const leaveMsg = {
              id: 'dg_leave_' + Date.now(),
              userId: 0,
              username: 'Sistem',
              text: `🚪 ${user.username} odadan ayrıldı.`,
              isSystem: true,
              createdAt: new Date().toISOString()
            };
            addDrawGuessChatMessage(room, leaveMsg);
            io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", leaveMsg);

            if (room.status === 'drawing' || room.status === 'choosing') {
              if (room.players.length < 2) {
                room.status = 'lobby';
                clearInterval(room.timerInterval);
                clearTimeout(room.chooseTimeout);
                clearTimeout(room.roundEndTimeout);
                if (room.strokeHistory) room.strokeHistory.length = 0;
                const cancelMsg = {
                  id: 'dg_cancel_' + Date.now(),
                  userId: 0,
                  username: 'Sistem',
                  text: `⚠️ Yeterli oyuncu kalmadığı için oyun lobiye döndürüldü.`,
                  isSystem: true,
                  createdAt: new Date().toISOString()
                };
                addDrawGuessChatMessage(room, cancelMsg);
                io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", cancelMsg);
              } else if (wasDrawer) {
                endDrawGuessRound(roomId, "Çizen oyuncu ayrıldı.");
              }
            }

            broadcastDrawGuessRoom(roomId);
          }
          emitDrawGuessRoomsList();
        }
        socket.data.currentDrawGuessRoom = null;
      }
      if (cb) cb({ success: true });
    });

    socket.on("start_drawguess_game", (data: { roomId: string }, cb?: (res: any) => void) => {
      const { roomId } = data || {};
      if (!roomId) return;
      const room = drawGuessRooms.get(roomId);
      if (!room) return;
      if (room.hostId !== user.id) {
        return socket.emit("drawguess_error", "Yalnızca oda kurucusu oyunu başlatabilir.");
      }
      if (room.players.length < 2) {
        return socket.emit("drawguess_error", "Oyunu başlatmak için en az 2 oyuncu gereklidir.");
      }

      room.currentRound = 1;
      room.currentDrawerIndex = 0;
      if (room.strokeHistory) room.strokeHistory.length = 0;
      room.players.forEach((p: any) => {
        p.score = 0;
        p.roundScore = 0;
        p.hasGuessed = false;
      });

      const startMsg = {
        id: 'dg_start_' + Date.now(),
        userId: 0,
        username: 'Sistem',
        text: `🚀 Çiz & Tahmin Et başladı! Toplam ${room.totalRounds} tur oynanacak.`,
        isSystem: true,
        createdAt: new Date().toISOString()
      };
      addDrawGuessChatMessage(room, startMsg);
      io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", startMsg);

      startDrawGuessChoosing(room);
      emitDrawGuessRoomsList();
      if (cb) cb({ success: true });
    });

    socket.on("drawguess_kick_player", (data: { roomId: string; targetUserId: number }, cb?: (res: any) => void) => {
      const { roomId, targetUserId } = data || {};
      if (!roomId || !targetUserId) return;
      const room = drawGuessRooms.get(roomId);
      if (!room || room.hostId !== user.id || targetUserId === user.id) return;

      const targetIdx = room.players.findIndex((p: any) => p.id === targetUserId);
      if (targetIdx === -1) return;

      const targetPlayer = room.players[targetIdx];
      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      if (targetSocket) {
        targetSocket.emit("drawguess_kicked", { reason: "Oda kurucusu tarafından odadan çıkarıldınız." });
        targetSocket.leave(`drawguess_${roomId}`);
        targetSocket.data.currentDrawGuessRoom = null;
      }

      const wasDrawer = room.drawerId === targetUserId;
      room.players.splice(targetIdx, 1);

      const kickMsg = {
        id: 'dg_kick_' + Date.now(),
        userId: 0,
        username: 'Sistem',
        text: `🚫 ${targetPlayer.username} kurucu tarafından odadan atıldı.`,
        isSystem: true,
        createdAt: new Date().toISOString()
      };
      addDrawGuessChatMessage(room, kickMsg);
      io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", kickMsg);

      if (room.players.length < 2 && (room.status === 'drawing' || room.status === 'choosing')) {
        room.status = 'lobby';
        clearInterval(room.timerInterval);
        clearTimeout(room.chooseTimeout);
        clearTimeout(room.roundEndTimeout);
        if (room.strokeHistory) room.strokeHistory.length = 0;
      } else if (wasDrawer && (room.status === 'drawing' || room.status === 'choosing')) {
        endDrawGuessRound(roomId, "Çizen oyuncu odadan atıldı.");
      }

      broadcastDrawGuessRoom(roomId);
      emitDrawGuessRoomsList();
      if (cb) cb({ success: true });
    });

    socket.on("drawguess_select_word", (data: { roomId: string; word: string }) => {
      const { roomId, word } = data || {};
      if (!roomId || !word) return;
      const room = drawGuessRooms.get(roomId);
      if (!room || room.status !== 'choosing' || room.drawerId !== user.id) return;

      const choice = room.wordChoices?.find((c: any) => c.word === word) || { word, points: 150 };
      startDrawGuessDrawing(room, choice.word, choice.points);
    });

    socket.on("drawguess_draw_line", (data: { roomId: string; line: any }) => {
      const { roomId, line } = data || {};
      if (!roomId || !line) return;
      const room = drawGuessRooms.get(roomId);
      if (!room || room.status !== 'drawing' || room.drawerId !== user.id) return;

      if (!room.strokeHistory) room.strokeHistory = [];
      room.strokeHistory.push(line);
      if (room.strokeHistory.length > 500) {
        room.strokeHistory.splice(0, 100);
      }

      socket.to(`drawguess_${roomId}`).emit("drawguess_draw_line", line);
    });

    socket.on("drawguess_clear_canvas", (data: { roomId: string }) => {
      const { roomId } = data || {};
      if (!roomId) return;
      const room = drawGuessRooms.get(roomId);
      if (!room || room.status !== 'drawing' || room.drawerId !== user.id) return;

      if (room.strokeHistory) room.strokeHistory.length = 0;
      socket.to(`drawguess_${roomId}`).emit("drawguess_canvas_cleared");
    });

    socket.on("drawguess_chat_message", (data: { roomId: string; text: string }) => {
      const { roomId, text } = data || {};
      if (!roomId || !text || !text.trim()) return;

      const room = drawGuessRooms.get(roomId);
      if (!room) return;

      const trimmedText = text.trim();
      const player = room.players.find((p: any) => p.id === user.id);
      if (!player) return;

      const isDrawer = room.drawerId === user.id;
      const isDrawingStatus = room.status === 'drawing';

      // 1. Anti-Spoiler: Drawer or players who already guessed cannot reveal the word
      if (isDrawingStatus && room.currentWord && (isDrawer || player.hasGuessed)) {
        if (containsSecretWord(trimmedText, room.currentWord)) {
          socket.emit("drawguess_chat_message", {
            id: 'dg_warn_' + Date.now(),
            userId: user.id,
            username: 'Sistem',
            text: isDrawer
              ? '⚠️ Çizen oyuncu kelimeyi veya ipucunu sohbete yazamaz!'
              : '⚠️ Kelimeyi zaten bildiniz, cevabı sohbete yazamazsınız! 🤫',
            isSystem: true,
            isWarning: true,
            createdAt: new Date().toISOString()
          });
          return;
        }
      }

      // 2. Active Guessing Check
      if (isDrawingStatus && !isDrawer && !player.hasGuessed && room.currentWord) {
        // A) Exact Match
        if (normalizeTr(trimmedText) === normalizeTr(room.currentWord)) {
          player.hasGuessed = true;
          const timeRatio = Math.max(0.15, room.timer / (room.roundDuration || 70));
          const guesserPoints = Math.round((room.currentWordPoints || 150) * timeRatio) + 40;
          player.score += guesserPoints;
          player.roundScore += guesserPoints;

          const drawer = room.players.find((p: any) => p.id === room.drawerId);
          if (drawer) {
            const drawerBonus = Math.round(guesserPoints * 0.35);
            drawer.score += drawerBonus;
            drawer.roundScore += drawerBonus;
          }

          const correctMsg = {
            id: 'dg_cor_' + Date.now() + '_' + Math.random(),
            userId: user.id,
            username: user.username,
            text: `🎉 ${user.username} kelimeyi doğru bildi! (+${guesserPoints} Puan)`,
            isSystem: true,
            isCorrect: true,
            createdAt: new Date().toISOString()
          };
          addDrawGuessChatMessage(room, correctMsg);
          io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", correctMsg);

          broadcastDrawGuessRoom(roomId);

          // Check if all non-drawers guessed
          const nonDrawers = room.players.filter((p: any) => p.id !== room.drawerId);
          if (nonDrawers.length > 0 && nonDrawers.every((p: any) => p.hasGuessed)) {
            endDrawGuessRound(roomId, "Tüm oyuncular bildi!");
          }
          return;
        }

        // B) Close Guess / Typo Check (Only visible to the sender!)
        if (isCloseGuess(trimmedText, room.currentWord)) {
          socket.emit("drawguess_chat_message", {
            id: 'dg_close_' + Date.now() + '_' + Math.random(),
            userId: user.id,
            username: user.username,
            text: `🔥 "${trimmedText}" çok yakın! Neredeyse buldun!`,
            isSystem: false,
            isCloseGuess: true,
            createdAt: new Date().toISOString()
          });
          return;
        }
      }

      // 3. Regular chat message (FIFO 50 limit)
      const msg = {
        id: 'dg_msg_' + Date.now() + '_' + Math.random(),
        userId: user.id,
        username: user.username,
        text: trimmedText.substring(0, 150),
        isSystem: false,
        isCorrect: false,
        createdAt: new Date().toISOString()
      };
      addDrawGuessChatMessage(room, msg);
      io.to(`drawguess_${roomId}`).emit("drawguess_chat_message", msg);
    });

    // --- 101 Okey Socket Handlers ---
    socket.on("get_okey101_rooms", () => {
      emit101RoomsList();
    });

    socket.on("get_my_okey101_room", (cb?: any) => {
      let targetRoomId = socket.data.currentOkey101Room;
      if (!targetRoomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }

      if (targetRoomId) {
        const room = okey101Rooms.get(targetRoomId);
        if (room) {
          socket.data.currentOkey101Room = targetRoomId;
          socket.join(`okey101_${targetRoomId}`);
          const p = room.players.find((pl: any) => pl.id === user.id);
          if (p) p.socketId = socket.id;
          socket.emit("okey101_state", getSanitized101Room(room));
          if (p && p.hand) {
            socket.emit("okey101_hand", p.hand);
          }
          if (cb) cb({ success: true, room: getSanitized101Room(room) });
          return;
        }
      }
      if (cb) cb({ success: false });
    });

    socket.on("create_okey101_room", ({ name, subMode, isHidden, allowedUsers }: { name: string; subMode?: 'katlamali' | 'katlamasiz'; isHidden?: boolean; allowedUsers?: string[] }, cb?: any) => {
      const roomId = 'okey101_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const cleanAllowed = Array.isArray(allowedUsers) ? allowedUsers.map(u => String(u).trim().toLowerCase()).filter(Boolean) : [];
      const newRoom = {
        id: roomId,
        name: name || `${user.username}'in 101 Masası`,
        gameMode: 'okey101',
        subMode: subMode === 'katlamasiz' ? 'katlamasiz' : 'katlamali',
        status: 'waiting',
        hostId: user.id,
        creatorId: user.id,
        isHidden: !!isHidden,
        allowedUsers: cleanAllowed,
        players: [{
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          isBot: false,
          socketId: socket.id,
          hand: [],
          discardPile: [],
          hasOpened: false,
          openedMode: undefined,
          openedScore: 0,
          openedMeldsCount: 0,
          penalties: 0,
          roundPenalty: 0
        }],
        deck: [],
        indicator: null,
        okeyTile: null,
        currentTurn: 0,
        turnPhase: 'draw',
        highestOpenScore: 101,
        openedMelds: [],
        turnTimeRemaining: 30,
        roundNumber: 1,
        lastActionMessage: `${user.username} 101 masası oluşturdu.`
      };

      okey101Rooms.set(roomId, newRoom);
      socket.data.currentOkey101Room = roomId;
      socket.join(`okey101_${roomId}`);

      broadcast101Room(roomId);
      emit101RoomsList();
      broadcastActiveTables();
      io.emit("table:created", {
        id: roomId,
        gameType: "okey101",
        title: name || `${user.username}'in 101 Masası`,
        hostId: user.id,
        hostName: user.username,
        playerCount: 1,
        maxPlayers: 4,
        botCount: 0,
        status: "Lobi Bekliyor"
      });
      if (cb) cb({ success: true, roomId });
    });

    socket.on("okey101_update_allowed_users", ({ roomId, allowedUsers }: { roomId: string; allowedUsers: string[] }, cb?: any) => {
      const room = okey101Rooms.get(roomId);
      if (!room) return cb && cb({ error: "Masa bulunamadı." });
      if (room.hostId !== user.id && room.creatorId !== user.id) {
        return cb && cb({ error: "Yalnızca masa yöneticisi izinleri değiştirebilir." });
      }
      room.allowedUsers = Array.isArray(allowedUsers) ? allowedUsers.map(u => String(u).trim().toLowerCase()).filter(Boolean) : [];
      broadcast101Room(roomId);
      emit101RoomsList();
      if (cb) cb({ success: true, allowedUsers: room.allowedUsers });
    });

    const handleJoinOkey101 = (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      const roomId = rawRoomId || socket.data.currentOkey101Room;
      if (!roomId) {
        if (cb) cb({ error: "Masa kimliği belirtilmedi." });
        return;
      }

      const room = okey101Rooms.get(roomId);
      if (!room) {
        if (cb) cb({ error: "Masa bulunamadı." });
        return;
      }

      if (!isUserAllowedInRoom(room, user)) {
        if (cb) cb({ error: "Bu gizli masaya giriş izniniz bulunmuyor (Özel Davetli Masa)." });
        else socket.emit("okey101_error", "Bu gizli masaya giriş izniniz bulunmuyor (Özel Davetli Masa).");
        return;
      }

      const existingPlayer = room.players.find((p: any) => p.id === user.id);
      if (existingPlayer) {
        existingPlayer.socketId = socket.id;
        socket.data.currentOkey101Room = roomId;
        socket.join(`okey101_${roomId}`);
        socket.join(roomId);
        broadcast101Room(roomId);
        emit101RoomsList();
        if (cb) cb({ success: true, roomId, isSpectator: false });
        return;
      }

      // If game is already playing or table is full, join as spectator!
      if (room.status === 'playing' || room.players.length >= 4) {
        if (!room.spectators) room.spectators = [];
        if (!room.spectators.some((s: any) => s.id === user.id)) {
          room.spectators.push({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            color: user.color,
            socketId: socket.id
          });
        }
        socket.data.currentOkey101Room = roomId;
        socket.join(`okey101_${roomId}`);
        socket.join(roomId);
        broadcast101Room(roomId);
        emit101RoomsList();
        if (cb) cb({ success: true, roomId, isSpectator: true, message: "İzleyici olarak katıldınız. Yeni turda oyuna dahil edileceksiniz." });
        return;
      }

      room.players.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        isBot: false,
        socketId: socket.id,
        hand: [],
        discardPile: [],
        hasOpened: false,
        openedMode: undefined,
        openedScore: 0,
        openedMeldsCount: 0,
        penalties: 0,
        roundPenalty: 0
      });

      socket.data.currentOkey101Room = roomId;
      socket.join(`okey101_${roomId}`);
      socket.join(roomId);

      // Otomatik Başlama: 4. oyuncu katıldığında oyun motorunu doğrudan tetikle!
      if (room.players.length === 4 && room.status === 'waiting') {
        start101GameSession(roomId);
      } else {
        broadcast101Room(roomId);
      }

      emit101RoomsList();
      if (cb) cb({ success: true, roomId });
    };

    socket.on("join_okey101", handleJoinOkey101);
    socket.on("join_room", (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      if (rawRoomId && okey101Rooms.has(rawRoomId)) {
        handleJoinOkey101(data, cb);
      }
    });

    socket.on("leave_okey101", (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      const roomId = rawRoomId || socket.data.currentOkey101Room;
      const room = okey101Rooms.get(roomId);
      if (room) {
        const wasHost = room.hostId === user.id || room.creatorId === user.id;
        if (wasHost && room.status === 'waiting') {
          io.to(`okey101_${roomId}`).emit("table_closed", { tableId: roomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
          io.to(roomId).emit("table_closed", { tableId: roomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
          cleanup101Room(roomId);
          okey101Rooms.delete(roomId);
          emit101RoomsList();
          broadcastActiveTables();
          io.emit("table:deleted", { tableId: roomId });
          if (cb) cb({ success: true, closed: true });
          return;
        }

        room.players = room.players.filter((p: any) => p.id !== user.id);
        socket.leave(`okey101_${roomId}`);
        socket.leave(roomId);
        socket.data.currentOkey101Room = null;

        if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
          cleanup101Room(roomId);
          io.emit("table:deleted", { tableId: roomId });
        } else {
          if (room.hostId === user.id) {
            const nextReal = room.players.find((p: any) => !p.isBot);
            if (nextReal) {
              room.hostId = nextReal.id;
              room.creatorId = nextReal.id;
              room.lastActionMessage = `Masa yöneticisi ayrıldı. Yeni yönetici: ${nextReal.username}`;
            }
          }
          broadcast101Room(roomId);
        }
        emit101RoomsList();
        broadcastActiveTables();
      }
      if (cb) cb({ success: true });
    });

    socket.on("add_okey101_bot", (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      const roomId = rawRoomId || socket.data.currentOkey101Room;
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'waiting') {
        if (cb) cb({ error: "Yalnızca lobi aşamasında bot eklenebilir." });
        return;
      }
      if (room.players.length >= 4) {
        if (cb) cb({ error: "Masa dolu." });
        return;
      }

      const botNames = ["Ahmet (Bot)", "Zeynep (Bot)", "Can (Bot)", "Elif (Bot)", "Murat (Bot)"];
      const existingNames = new Set(room.players.map((p: any) => p.username));
      const chosenName = botNames.find(n => !existingNames.has(n)) || `Bot_${room.players.length + 1}`;
      const botId = -Math.floor(Math.random() * 1000000) - 1;

      room.players.push({
        id: botId,
        username: chosenName,
        avatar: undefined,
        color: '#10b981',
        isBot: true,
        socketId: undefined,
        hand: [],
        discardPile: [],
        hasOpened: false,
        openedMode: undefined,
        openedScore: 0,
        openedMeldsCount: 0,
        penalties: 0,
        roundPenalty: 0
      });

      // 4 oyuncuya (veya bota) ulaşıldığında oyunu otomatik başlat
      if (room.players.length === 4 && room.status === 'waiting') {
        start101GameSession(roomId);
      } else {
        broadcast101Room(roomId);
      }

      emit101RoomsList();
      if (cb) cb({ success: true });
    });

    socket.on("kick_okey101_bot", (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      const roomId = rawRoomId || socket.data.currentOkey101Room;
      const botId = data?.botId;
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'waiting') return;
      if (room.hostId !== user.id) {
        if (cb) cb({ error: "Yalnızca masa kurucusu bot çıkartabilir." });
        return;
      }

      room.players = room.players.filter((p: any) => p.id !== botId);
      broadcast101Room(roomId);
      emit101RoomsList();
      if (cb) cb({ success: true });
    });

    const handleStartOkey101 = (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      let roomId = rawRoomId || socket.data.currentOkey101Room;
      if (!roomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            roomId = id;
            break;
          }
        }
      }
      const room = okey101Rooms.get(roomId);
      if (!room) {
        if (cb) cb({ error: "Masa bulunamadı." });
        return;
      }
      if (room.hostId !== user.id) {
        if (cb) cb({ error: "Oyunu yalnızca masa yöneticisi başlatabilir." });
        return;
      }

      // 4 oyuncuya eksik koltuklar akıllı botlarla tamamlanarak derhal başlatılır
      const started = start101GameSession(roomId);
      if (cb) cb({ success: started });
    };

    socket.on("get_my_okey101_hand", (cb?: any) => {
      let targetRoomId = socket.data.currentOkey101Room;
      if (!targetRoomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.players.some((p: any) => p.id === user.id)) {
            targetRoomId = id;
            break;
          }
        }
      }
      if (targetRoomId) {
        const room = okey101Rooms.get(targetRoomId);
        if (room) {
          const p = room.players.find((pl: any) => pl.id === user.id);
          if (p && p.hand) {
            socket.emit("okey101_hand", p.hand);
            if (cb) cb({ success: true, hand: p.hand });
            return;
          }
        }
      }
      if (cb) cb({ success: false, hand: [] });
    });

    socket.on("start_okey101_game", handleStartOkey101);
    socket.on("startGame", (data: any, cb?: any) => {
      const rawRoomId = typeof data === 'object' && data !== null ? (data.roomId || data.id) : data;
      const roomId = rawRoomId || socket.data.currentOkey101Room;
      if (roomId && okey101Rooms.has(roomId)) {
        handleStartOkey101(data, cb);
      }
    });

    socket.on("okey101_draw", (data: any, cb?: any) => {
      let roomId = data?.roomId || socket.data.currentOkey101Room;
      if (!roomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.status === 'playing' && r.players.some((p: any) => p.id === user.id)) {
            roomId = id;
            socket.data.currentOkey101Room = id;
            socket.join(`okey101_${id}`);
            socket.join(id);
            break;
          }
        }
      }
      const source = data?.source || 'deck';
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'playing') {
        if (cb) cb({ error: "Oyun aktif değil." });
        return;
      }
      const playerIndex = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIndex !== room.currentTurn) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }
      if (room.turnPhase !== 'draw') {
        if (cb) cb({ error: "Zaten taş çektiniz, lütfen taş atın." });
        return;
      }

      const player = room.players[playerIndex];

      if (source === 'deck') {
        if (room.deck.length === 0) {
          end101Game(roomId, -1, false, "Destedeki tüm taşlar bitti! El berabere tamamlandı.");
          if (cb) cb({ success: true });
          return;
        }
        const drawn = room.deck.pop();
        if (drawn) {
          player.hand.push(drawn);
          room.lastActionMessage = `${player.username} desteden taş çekti.`;
        }
      } else {
        // Draw from previous player's discard pile
        const prevPlayerIndex = (room.currentTurn - 1 + room.players.length) % room.players.length;
        const prevPlayer = room.players[prevPlayerIndex];
        if (!prevPlayer || !prevPlayer.discardPile || prevPlayer.discardPile.length === 0) {
          if (cb) cb({ error: "Çekilecek yan taş bulunmuyor." });
          return;
        }

        const discardedTile = prevPlayer.discardPile.pop();
        if (discardedTile) {
          player.hand.push(discardedTile);
          room.lastActionMessage = `${player.username} yandan atılan taşı aldı.`;
        }
      }

      room.turnPhase = 'discard';
      broadcast101Room(roomId);
      if (cb) cb({ success: true });
    });

    socket.on("okey101_discard", (data: any, cb?: any) => {
      let roomId = data?.roomId || socket.data.currentOkey101Room;
      if (!roomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.status === 'playing' && r.players.some((p: any) => p.id === user.id)) {
            roomId = id;
            socket.data.currentOkey101Room = id;
            socket.join(`okey101_${id}`);
            socket.join(id);
            break;
          }
        }
      }
      const tileId = data?.tileId;
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'playing') {
        if (cb) cb({ error: "Oyun aktif değil." });
        return;
      }
      const playerIndex = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIndex !== room.currentTurn) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }
      if (room.turnPhase !== 'discard') {
        if (cb) cb({ error: "Önce desteden veya yandan taş çekmelisiniz." });
        return;
      }

      const player = room.players[playerIndex];
      const tileIdx = player.hand.findIndex((t: any) => t.id === tileId);
      if (tileIdx === -1) {
        if (cb) cb({ error: "Seçilen taş elinizde bulunamadı." });
        return;
      }

      const discardedTile = player.hand.splice(tileIdx, 1)[0];
      player.discardPile.push(discardedTile);

      // 101 Okey Rule: Discarding an "İşler Taş" penalty
      if (checkIslerTas(discardedTile, room.openedMelds, room.okeyTile)) {
        player.penalties = (player.penalties || 0) + 101;
        player.roundPenalty = (player.roundPenalty || 0) + 101;
        room.lastActionMessage = `⚠️ ${player.username} işler taş attığı için kural gereği +101 ceza aldı!`;
      } else {
        const colorName = discardedTile.color === 'red' ? 'Kırmızı' : discardedTile.color === 'blue' ? 'Mavi' : discardedTile.color === 'black' ? 'Siyah' : 'Sarı';
        room.lastActionMessage = `${player.username} ${discardedTile.number} ${colorName} attı.`;
      }

      // Check if player won by discarding final tile
      if (player.hand.length === 0) {
        const finishedWithOkey = isTileOkey101(discardedTile, room.okeyTile);
        const finishedWithDouble = player.openedMode === 'double';
        end101Game(roomId, player.id, finishedWithOkey, `${player.username} elini bitirdi ve kazandı! 🏆`, finishedWithDouble);
        if (cb) cb({ success: true });
        return;
      }

      // Next player's turn
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      room.turnPhase = 'draw';
      start101TurnTimer(roomId);
      broadcast101Room(roomId);

      const nextPlayer = room.players[room.currentTurn];
      if (nextPlayer && nextPlayer.isBot) {
        runBotTurn101(roomId);
      }
      if (cb) cb({ success: true });
    });

    socket.on("okey101_open_hand", (data: any, cb?: any) => {
      let roomId = data?.roomId || socket.data.currentOkey101Room;
      if (!roomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.status === 'playing' && r.players.some((p: any) => p.id === user.id)) {
            roomId = id;
            socket.data.currentOkey101Room = id;
            socket.join(`okey101_${id}`);
            socket.join(id);
            break;
          }
        }
      }
      const rawMelds = data?.melds;
      const mode = data?.mode || data?.type;
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'playing') {
        if (cb) cb({ error: "Oyun aktif değil." });
        return;
      }
      const playerIndex = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIndex !== room.currentTurn) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }
      const player = room.players[playerIndex];
      // Normalize melds to Tile101[][]
      let melds: Tile101[][] = [];
      if (Array.isArray(rawMelds)) {
        melds = rawMelds.map((m: any) => {
          if (Array.isArray(m)) return m;
          if (Array.isArray(m?.tileIds)) {
            return m.tileIds.map((tid: string) => player.hand.find((h: any) => h.id === tid)).filter(Boolean);
          }
          if (Array.isArray(m?.tiles)) {
            return m.tiles;
          }
          return [];
        }).filter(m => m.length > 0);
      }

      if (melds.length === 0) {
        if (cb) cb({ error: "Geçerli perler seçilmedi." });
        return;
      }

      // SUBSEQUENT MELD OPENING (Oyuncu zaten el açmışsa, sonraki turlarında yeni geçerli perler indirebilir)
      if (player.hasOpened) {
        if (player.openedMode === 'double') {
          // Çift açmış oyuncu sonraki turlarında yeni geçerli çiftler indirebilir
          for (let i = 0; i < melds.length; i++) {
            const m = melds[i];
            if (m.length !== 2 || !isValidPair(m[0], m[1], room.okeyTile)) {
              if (cb) cb({ error: `${i + 1}. çift geçersizdir.` });
              return;
            }
          }
          for (let i = 0; i < melds.length; i++) {
            const m = melds[i];
            room.openedMelds.push({
              id: `meld_${Date.now()}_${i}_${user.id}`,
              playerId: player.id,
              playerUsername: player.username,
              type: 'pair',
              tiles: [...m],
              score: 0
            });
            for (const t of m) {
              const idx = player.hand.findIndex((h: any) => h.id === t.id);
              if (idx !== -1) player.hand.splice(idx, 1);
            }
          }
          player.openedMeldsCount = (player.openedMeldsCount || 0) + melds.length;
          room.lastActionMessage = `✨ ${player.username} masaya ${melds.length} yeni çift daha indirdi!`;
          broadcast101Room(roomId);
          if (cb) cb({ success: true, subsequent: true });
          return;
        }

        // Seri açmış oyuncu: 101 barajı toplamına bakılmaksızın her yeni geçerli per (en az 3'lü) masaya indirilebilir
        let subScore = 0;
        const validSubMelds: { type: 'run' | 'group'; score: number; tiles: Tile101[] }[] = [];
        for (let i = 0; i < melds.length; i++) {
          const m = melds[i];
          const check = validateMeld(m, room.okeyTile);
          if (!check.valid || !check.type) {
            if (cb) cb({ error: `${i + 1}. per geçersizdir. Geçerli ardışık seri veya grup olmalıdır.` });
            return;
          }
          subScore += check.score;
          validSubMelds.push({ type: check.type, score: check.score, tiles: m });
        }

        for (let i = 0; i < validSubMelds.length; i++) {
          const item = validSubMelds[i];
          room.openedMelds.push({
            id: `meld_${Date.now()}_${i}_${user.id}`,
            playerId: player.id,
            playerUsername: player.username,
            type: item.type,
            tiles: [...item.tiles],
            score: item.score
          });
          for (const t of item.tiles) {
            const idx = player.hand.findIndex((h: any) => h.id === t.id);
            if (idx !== -1) player.hand.splice(idx, 1);
          }
        }

        player.openedMeldsCount = (player.openedMeldsCount || 0) + validSubMelds.length;
        player.openedScore = (player.openedScore || 0) + subScore;
        room.lastActionMessage = `🎉 ${player.username} masaya ${validSubMelds.length} yeni per (${subScore}p) daha indirdi!`;
        broadcast101Room(roomId);
        if (cb) cb({ success: true, subsequent: true, addedScore: subScore });
        return;
      }

      // FIRST TIME OPENING (İLK KEZ EL AÇMA)
      if (mode === 'double') {
        const minPairsNeeded = room.subMode === 'katlamali' && room.highestPairsCount ? room.highestPairsCount + 1 : 5;
        const validation = validatePairOpening(melds, room.okeyTile, minPairsNeeded);
        if (!validation.valid) {
          // Ceza: Hatalı çift açmaya çalışma
          player.penalties = (player.penalties || 0) + 101;
          player.roundPenalty = (player.roundPenalty || 0) + 101;
          room.lastActionMessage = `⚠️ ${player.username} hatalı çift açmaya çalıştığı için +101 ceza aldı!`;
          broadcast101Room(roomId);
          if (cb) cb({ error: validation.error || `Çift açmak için en az ${minPairsNeeded} çift gereklidir.` });
          return;
        }

        // Register opened melds
        for (let i = 0; i < melds.length; i++) {
          const m = melds[i];
          room.openedMelds.push({
            id: `meld_${Date.now()}_${i}_${user.id}`,
            playerId: player.id,
            playerUsername: player.username,
            type: 'pair',
            tiles: [...m],
            score: 0
          });
          // Remove from hand
          for (const t of m) {
            const idx = player.hand.findIndex((h: any) => h.id === t.id);
            if (idx !== -1) player.hand.splice(idx, 1);
          }
        }

        player.hasOpened = true;
        player.openedMode = 'double';
        player.openedMeldsCount = melds.length;
        if (melds.length > (room.highestPairsCount || 0)) {
          room.highestPairsCount = melds.length;
        }
        room.lastActionMessage = `✨ ${player.username} ${melds.length} Çift açarak masayı açtı!`;
        broadcast101Room(roomId);
        if (cb) cb({ success: true });
        return;
      }

      // Serial / Group melds initial opening (En az 101 puan barajı)
      const minPoints = room.subMode === 'katlamali' ? Math.max(101, room.highestOpenScore + 1) : 101;
      const validation = validateSerialHandOpening(melds, minPoints, room.okeyTile);

      if (!validation.valid) {
        // Ceza: 101 barajı altı veya geçersiz per açmaya çalışma
        player.penalties = (player.penalties || 0) + 101;
        player.roundPenalty = (player.roundPenalty || 0) + 101;
        room.lastActionMessage = `⚠️ ${player.username} barajı geçemeyen (${validation.totalScore || 0}p) per açmaya çalıştığı için +101 ceza aldı!`;
        broadcast101Room(roomId);
        if (cb) cb({ error: validation.error || `En az ${minPoints} puan değerinde geçerli perler gereklidir.` });
        return;
      }

      // Register melds onto table
      for (let i = 0; i < melds.length; i++) {
        const m = melds[i];
        const meldCheck = validateMeld(m, room.okeyTile);
        room.openedMelds.push({
          id: `meld_${Date.now()}_${i}_${user.id}`,
          playerId: player.id,
          playerUsername: player.username,
          type: meldCheck.type || 'run',
          tiles: [...m],
          score: meldCheck.score
        });
        // Remove from hand
        for (const t of m) {
          const idx = player.hand.findIndex((h: any) => h.id === t.id);
          if (idx !== -1) player.hand.splice(idx, 1);
        }
      }

      player.hasOpened = true;
      player.openedMode = 'serial';
      player.openedScore = validation.totalScore;
      player.openedMeldsCount = melds.length;

      if (validation.totalScore > room.highestOpenScore) {
        room.highestOpenScore = validation.totalScore;
      }

      room.lastActionMessage = `🎉 ${player.username} ${validation.totalScore} puan ile el açtı!`;
      broadcast101Room(roomId);
      if (cb) cb({ success: true, totalScore: validation.totalScore });
    });

    socket.on("okey101_append_tile", (data: any, cb?: any) => {
      let roomId = data?.roomId || socket.data.currentOkey101Room;
      if (!roomId) {
        for (const [id, r] of okey101Rooms.entries()) {
          if (r.status === 'playing' && r.players.some((p: any) => p.id === user.id)) {
            roomId = id;
            socket.data.currentOkey101Room = id;
            socket.join(`okey101_${id}`);
            socket.join(id);
            break;
          }
        }
      }
      const meldId = data?.meldId || data?.targetMeldId;
      const tileId = data?.tileId;
      const position = data?.position;

      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'playing') {
        if (cb) cb({ error: "Oyun aktif değil." });
        return;
      }
      const playerIndex = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIndex !== room.currentTurn) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }
      const player = room.players[playerIndex];
      if (!player.hasOpened) {
        if (cb) cb({ error: "Masaya taş işlemek için önce el açmalısınız." });
        return;
      }
      if (room.turnPhase !== 'discard') {
        if (cb) cb({ error: "Önce taş çekmelisiniz." });
        return;
      }

      const tableMeld = room.openedMelds.find((m: any) => m.id === meldId);
      if (!tableMeld) {
        if (cb) cb({ error: "Per bulunamadı." });
        return;
      }

      // 101 Rule: Double openers cannot append to serial melds
      if (player.openedMode === 'double' && tableMeld.type !== 'pair') {
        if (cb) cb({ error: "Çift açan oyuncular sadece çift perlere taş işleyebilir." });
        return;
      }

      const tileIdx = player.hand.findIndex((t: any) => t.id === tileId);
      if (tileIdx === -1) {
        if (cb) cb({ error: "Taş elinizde bulunamadı." });
        return;
      }
      const tile = player.hand[tileIdx];

      const check = canAppendTileToMeld(tile, tableMeld, room.okeyTile);
      if (!check.canAppend) {
        if (cb) cb({ error: check.error || "Bu taş seçilen pere işlenemez." });
        return;
      }

      if (check.replacesOkey && check.retrievedOkey) {
        // Player swapped regular tile for wildcard Okey in meld: retrieved Okey goes to player hand
        tableMeld.tiles = check.orderedTiles || tableMeld.tiles;
        tableMeld.score = check.score || tableMeld.score;
        player.hand.splice(tileIdx, 1, check.retrievedOkey);
        room.lastActionMessage = `⭐ ${player.username} masadaki perden Okey'i alıp yerine ${tile.number} işledi!`;
      } else {
        if (check.orderedTiles && check.orderedTiles.length > 0) {
          tableMeld.tiles = check.orderedTiles;
          tableMeld.score = check.score || tableMeld.score;
        } else {
          const insertAt = position || check.insertAt || 'end';
          if (insertAt === 'start') {
            tableMeld.tiles.unshift(tile);
          } else {
            tableMeld.tiles.push(tile);
          }
          if (check.score) {
            tableMeld.score = check.score;
          } else if (tableMeld.type === 'run') {
            tableMeld.score = (tableMeld.score || 0) + (tile.isOkey ? 10 : tile.number);
          } else if (tableMeld.type === 'group') {
            const groupNum = tableMeld.tiles.find((t: any) => !isTileOkey101(t, room.okeyTile))?.number || tile.number;
            tableMeld.score = tableMeld.tiles.length * groupNum;
          }
        }
        player.hand.splice(tileIdx, 1);
        room.lastActionMessage = `${player.username} masadaki pere taş işledi.`;
      }
      broadcast101Room(roomId);
      socket.emit("okey101_hand", player.hand);
      if (cb) cb({ success: true });
    });

    socket.on("okey101_run_stress_test", (data: any, cb?: any) => {
      const iters = typeof data?.iterations === 'number' ? data.iterations : 2000;
      const report = run101StressTest(iters);
      if (cb) cb(report);
      socket.emit("okey101_stress_test_result", report);
    });

    socket.on("okey101_declare_finish", (data: any, cb?: any) => {
      const roomId = data?.roomId || socket.data.currentOkey101Room;
      const room = okey101Rooms.get(roomId);
      if (!room || room.status !== 'playing') return;
      const playerIndex = room.players.findIndex((p: any) => p.id === user.id);
      if (playerIndex !== room.currentTurn) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }
      const player = room.players[playerIndex];
      if (player.hand.length > 1) {
        if (cb) cb({ error: `Bitirmek için elinizde sadece 1 bitiş taşı kalmalıdır (Elinizdeki taş: ${player.hand.length}).` });
        return;
      }

      const finalTile = player.hand.pop();
      if (finalTile) player.discardPile.push(finalTile);
      const finishedWithOkey = finalTile ? isTileOkey101(finalTile, room.okeyTile) : false;
      const finishedWithDouble = player.openedMode === 'double';
      end101Game(roomId, player.id, finishedWithOkey, `${player.username} elini bitirdi ve oyunu kazandı! 🏆`, finishedWithDouble);
      if (cb) cb({ success: true });
    });

    const handleOkey101Chat = (data: any) => {
      const roomId = data?.roomId || socket.data.currentOkey101Room;
      const text = data?.text || data?.message;
      if (!roomId || !text || !text.trim()) return;
      const newMsg = {
        id: `chat_${Date.now()}_${Math.random()}`,
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
        text: text.trim().substring(0, 150),
        createdAt: new Date().toISOString()
      };
      io.to(`okey101_${roomId}`).emit("okey101_new_table_message", newMsg);
      io.to(`okey101_${roomId}`).emit("okey101_chat_message", newMsg);
      io.to(roomId).emit("okey101_new_table_message", newMsg);
      io.to(roomId).emit("okey101_chat_message", newMsg);
    };

    socket.on("okey101_send_chat", handleOkey101Chat);
    socket.on("send_okey101_table_message", handleOkey101Chat);

    socket.on("disconnect", async () => {
      try {
        (socket as any).leaveAll?.();
      } catch (e) {}

      // Direct 1-on-1 Voice Call teardown on disconnect
      const activeCallId = userActiveCallId.get(userIdNum);
      if (activeCallId) {
        const session = directCalls.get(activeCallId);
        if (session) {
          if (session.timeoutTimer) {
            clearTimeout(session.timeoutTimer);
          }
          directCalls.delete(activeCallId);
          userActiveCallId.delete(session.callerId);
          userActiveCallId.delete(session.receiverId);

          const peerId = session.callerId === userIdNum ? session.receiverId : session.callerId;
          const peerSocketId = onlineUsers.get(peerId);
          if (peerSocketId) {
            io.to(peerSocketId).emit("direct_call_ended", { callId: activeCallId });
          }
        }
      }

      const drawGuessRoomId = socket.data.currentDrawGuessRoom;
      if (drawGuessRoomId) {
        const room = drawGuessRooms.get(drawGuessRoomId);
        if (room) {
          const wasHost = room.hostId === user.id;
          const wasDrawer = room.drawerId === user.id;
          room.players = room.players.filter((p: any) => p.id !== user.id);

          if (room.players.length === 0) {
            cleanupDrawGuessRoom(drawGuessRoomId);
          } else {
            if (wasHost) {
              const nextHost = room.players[0];
              room.hostId = nextHost.id;
              room.hostUsername = nextHost.username;
              nextHost.isHost = true;
            }
            if (room.status === 'drawing' || room.status === 'choosing') {
              if (room.players.length < 2) {
                room.status = 'lobby';
                clearInterval(room.timerInterval);
                clearTimeout(room.chooseTimeout);
                clearTimeout(room.roundEndTimeout);
                if (room.strokeHistory) room.strokeHistory.length = 0;
              } else if (wasDrawer) {
                endDrawGuessRound(drawGuessRoomId, "Çizen oyuncu ayrıldı.");
              }
            }
            broadcastDrawGuessRoom(drawGuessRoomId);
          }
          emitDrawGuessRoomsList();
        }
      }
      const royaleRoomId = socket.data.currentRoyaleRoom;
      if (royaleRoomId) {
        battleRoyaleManager.leaveRoom(royaleRoomId, userIdNum);
      }
      // Defensive guarantee: check all royale rooms for disconnected player
      for (const [rId, r] of battleRoyaleManager.rooms.entries()) {
        if (r.players.some(p => p.userId === userIdNum)) {
          battleRoyaleManager.leaveRoom(rId, userIdNum);
        }
      }

      const partyRoomId = socket.data.currentPartyRoom;
      if (partyRoomId) {
        partyManager.leaveRoom(partyRoomId, userIdNum);
      }
      for (const [pId, pRoom] of partyManager.rooms.entries()) {
        if (pRoom.players.some(p => p.userId === userIdNum)) {
          partyManager.leaveRoom(pId, userIdNum);
        }
      }

      const kapstorialRoomId = socket.data.currentKapstorialRoom;
      if (kapstorialRoomId) {
        kapstorialManager.leaveRoom(kapstorialRoomId, userIdNum);
      }
      for (const [kId, kRoom] of kapstorialManager.rooms.entries()) {
        if (kRoom.players.some(p => p.userId === userIdNum)) {
          kapstorialManager.leaveRoom(kId, userIdNum);
        }
      }
      kapsstrikeManager.handleDisconnect(socket, userIdNum);
      broadcastActiveTables();

      const voiceRoomId = socket.data.currentVoiceRoom;
      if (voiceRoomId) {
        // Clear any existing timer for this user
        const existingTimer = voiceDisconnectGraceTimers.get(user.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // 20-second grace period for transient network switches (Wi-Fi/4G handoffs, lockscreen, background tab)
        const graceTimer = setTimeout(() => {
          voiceDisconnectGraceTimers.delete(user.id);
          const vRoom = voiceRooms.get(voiceRoomId);
          if (vRoom) {
            const currentParticipant = vRoom.participants.get(user.id);
            // Only clean up if user has not re-joined with a new socket
            if (currentParticipant && currentParticipant.socketId === socket.id) {
              if (vRoom.hostId === user.id) {
                // If there are other participants, promote the next participant to host instead of killing the call!
                const remaining = Array.from(vRoom.participants.values()).filter(p => p.id !== user.id);
                if (remaining.length > 0) {
                  const newHost = remaining[0];
                  vRoom.hostId = newHost.id;
                  vRoom.hostUsername = newHost.username;
                  vRoom.participants.delete(user.id);
                  io.to(`voice_${voiceRoomId}`).emit("voice_user_left", { userId: user.id, socketId: socket.id });
                  broadcastVoiceRoom(voiceRoomId);
                } else {
                  io.to(`voice_${voiceRoomId}`).emit("voice_room_closed", { reason: "Oda kurucusu ayrıldığı için oda kapatıldı." });
                  voiceRooms.delete(voiceRoomId);
                }
              } else {
                vRoom.participants.delete(user.id);
                if (vRoom.participants.size === 0) {
                  voiceRooms.delete(voiceRoomId);
                } else {
                  io.to(`voice_${voiceRoomId}`).emit("voice_user_left", { userId: user.id, socketId: socket.id });
                  broadcastVoiceRoom(voiceRoomId);
                }
              }
              emitVoiceRoomsList();
            }
          }
        }, 20000);

        voiceDisconnectGraceTimers.set(user.id, graceTimer);
      }
      const unoRoomId = socket.data.currentUnoRoom;
      if (unoRoomId) {
        const room = unoRooms.get(unoRoomId);
        if (room && room.status === 'waiting') {
          const wasHost = room.hostId === user.id || room.creatorId === user.id;
          if (wasHost) {
            io.to(`uno_${unoRoomId}`).emit("table_closed", { tableId: unoRoomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            io.to(unoRoomId).emit("table_closed", { tableId: unoRoomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            cleanupUnoRoom(unoRoomId);
            emitUnoRoomsList();
            broadcastActiveTables();
            io.emit("table:deleted", { tableId: unoRoomId });
          } else {
            room.players = room.players.filter((p: any) => p.id !== user.id);
            if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
              cleanupUnoRoom(unoRoomId);
            } else {
              broadcastUnoRoom(unoRoomId);
            }
            emitUnoRoomsList();
            broadcastActiveTables();
          }
        }
      }
      const roomId = socket.data.currentOkeyRoom;
      if (roomId) {
        const room = okeyRooms.get(roomId);
        if (room && room.status === 'waiting') {
          const wasHost = room.hostId === user.id || room.creatorId === user.id;
          if (wasHost) {
            io.to(`okey_${roomId}`).emit("table_closed", { tableId: roomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            io.to(roomId).emit("table_closed", { tableId: roomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            clearTimeout(room.botTimeout);
            okeyRooms.delete(roomId);
            emitRooms();
            broadcastActiveTables();
            io.emit("table:deleted", { tableId: roomId });
          } else {
            room.players = room.players.filter((p: any) => p.id !== user.id);
            if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
              clearTimeout(room.botTimeout);
              okeyRooms.delete(roomId);
            } else {
              broadcastOkeyRoom(roomId);
            }
            emitRooms();
            broadcastActiveTables();
          }
        }
      }

      const okey101RoomId = socket.data.currentOkey101Room;
      if (okey101RoomId) {
        const room = okey101Rooms.get(okey101RoomId);
        if (room && room.status === 'waiting') {
          const wasHost = room.hostId === user.id || room.creatorId === user.id;
          if (wasHost) {
            io.to(`okey101_${okey101RoomId}`).emit("table_closed", { tableId: okey101RoomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            io.to(okey101RoomId).emit("table_closed", { tableId: okey101RoomId, reason: "Masa kurucusu ayrıldığı için masa kapatıldı.", redirectTo: "lobby" });
            cleanup101Room(okey101RoomId);
            okey101Rooms.delete(okey101RoomId);
            emit101RoomsList();
            broadcastActiveTables();
            io.emit("table:deleted", { tableId: okey101RoomId });
          } else {
            room.players = room.players.filter((p: any) => p.id !== user.id);
            if (room.players.length === 0 || room.players.every((p: any) => p.isBot)) {
              cleanup101Room(okey101RoomId);
            } else {
              broadcast101Room(okey101RoomId);
            }
            emit101RoomsList();
            broadcastActiveTables();
          }
        }
      }

      // Blackjack Disconnect & Auto Bet Refund Handling
      const currentBjTable = socket.data.currentBlackjackTable;
      if (currentBjTable) {
        const tid = String(currentBjTable);
        const tableState = blackjackRooms.get(tid);
        if (tableState && Array.isArray(tableState.seats)) {
          const userSeatIndex = tableState.seats.findIndex((s: any) => s && !s.isBot && s.userId === user.id);
          if (userSeatIndex !== -1) {
            const isMidGame = ['DEALING', 'PLAYER_TURNS', 'DEALER_TURN'].includes(tableState.phase);
            const isHost = Boolean(tableState.seats[userSeatIndex].isHost) || tableState.hostId === user.id;

            if (isMidGame) {
              await refundBlackjackTableBets(tid, `${user.username} oyundan koptu / ayrıldı.`);
            } else if (isHost) {
              await refundBlackjackTableBets(tid, `Masa kurucusu (${user.username}) ayrıldığı için masa kapatıldı.`);
            } else {
              const seat = tableState.seats[userSeatIndex];
              if (seat && seat.currentBet > 0) {
                try {
                  await client.execute({
                    sql: "UPDATE users SET chips = COALESCE(chips, 0) + ? WHERE id = ?",
                    args: [seat.currentBet, user.id]
                  });
                } catch (e) {}
              }
              tableState.seats[userSeatIndex] = null;
              const remainingHumans = tableState.seats.filter((s: any) => s && !s.isBot);
              if (remainingHumans.length === 0) {
                blackjackRooms.delete(tid);
                activeCardTablesRegistry.delete(tid);
                broadcastActiveTables();
                io.emit("table:deleted", { tableId: tid });
              } else {
                blackjackRooms.set(tid, tableState);
                io.to(`blackjack_${tid}`).emit("blackjack_state", tableState);
                broadcastActiveTables();
              }
            }
          }
        }
      }
      
      // When user disconnects, keep pin on map with inactive / last-seen status
      const existingLoc = userLiveLocations.get(userIdNum);
      if (existingLoc) {
        existingLoc.isLocationActive = false;
        existingLoc.lastSeen = Date.now();
        existingLoc.status = "Çevrimdışı";
        emitUserLocations();
        saveLastLocationToDb(existingLoc);
        io.emit("user:location_status", {
          userId: userIdNum,
          isLive: false,
          isLocationActive: false,
          lastSeen: existingLoc.lastSeen,
          lat: existingLoc.lat,
          lng: existingLoc.lng,
          status: existingLoc.status
        });
      }

      try {
        await client.execute({
          sql: "UPDATE users SET last_seen = ? WHERE id = ?",
          args: [new Date().toISOString(), user.id]
        });
      } catch (e) {}

      // 5651 Sayılı Kanun Traffic Log
      logAccess(userIdNum, socket.data?.ip || "Bilinmiyor", 'disconnect');

      // Mobile network reconnection grace period:
      // Don't drop user from online status immediately on momentary disconnect (e.g. backgrounding tab, cellular handover)
      // If user reconnects within 20 seconds, their presence is uninterrupted!
      if (onlineUsers.get(userIdNum) === socket.id) {
        const timer = setTimeout(() => {
          disconnectTimers.delete(userIdNum);
          if (onlineUsers.get(userIdNum) === socket.id) {
            onlineUsers.delete(userIdNum);
            io.emit("online_users", Array.from(onlineUsers.keys()));
          }
        }, 20000); // 20s grace period for mobile reconnection
        disconnectTimers.set(userIdNum, timer);
      }

      // Memory hygiene: Leave all rooms and remove all listeners on the disconnected socket
      try {
        if (socket.rooms && socket.rooms.size > 0) {
          socket.rooms.forEach((r) => socket.leave(r));
        }
      } catch (e) {}

      try {
        socket.removeAllListeners();
      } catch (e) {}
    });
  });

  // SEO Endpoints for Search Engine Crawlers & Googlebot
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    res.send("User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /emirgan\nDisallow: /api/\n\nSitemap: https://kapsapp.online/sitemap.xml\n");
  });

  app.get("/sitemap.xml", (req, res) => {
    res.type("application/xml");
    const sitemapPath = path.join(process.cwd(), "public", "sitemap.xml");
    if (fs.existsSync(sitemapPath)) {
      return res.sendFile(sitemapPath);
    }
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://kapsapp.online/</loc>
    <lastmod>2026-10-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://kapsapp.online/sohbetler</loc>
    <lastmod>2026-10-07</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://kapsapp.online/genel-sohbet</loc>
    <lastmod>2026-10-07</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://kapsapp.online/dersler</loc>
    <lastmod>2026-10-07</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://kapsapp.online/oyunlar</loc>
    <lastmod>2026-10-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // Get local IP
  const getLocalIP = () => {
    let interfaces: ReturnType<typeof os.networkInterfaces>;
    try { interfaces = os.networkInterfaces(); } catch { return "localhost"; }
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) return iface.address;
      }
    }
    return "localhost";
  };

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n=====================================`);
    console.log(`✅ Server running on LAN`);
    console.log(`➡️  Connect via: http://${getLocalIP()}:${PORT}`);
    console.log(`=====================================\n`);
  });
}

startServer();
