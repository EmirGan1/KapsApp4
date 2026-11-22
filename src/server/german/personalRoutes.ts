import { randomUUID } from "node:crypto";
import express from "express";
import multer from "multer";
import type { Client } from "@libsql/client";
import {
  isPersonalCefrLevel,
  isPersonalExerciseMode,
  type PersonalCefrLevel,
  type PersonalDirection,
  type PersonalExerciseModeId,
  type PersonalQuestion,
  type PersonalQuestionResult,
  type PersonalVocabItemDTO,
} from "../../shared/germanPersonal";
import {
  advanceComprehensiveBatch,
  buildComprehensiveReport,
  createComprehensiveTestSession,
  hydratePersonalSession,
} from "./personalComprehensive";
import {
  evaluatePersonalAnswer,
  generatePersonalPracticeQuestions,
  recordPersonalQuestionHistory,
} from "./personalExercises";
import {
  disconnectPersonalGoogleOAuth,
  fetchPersonalGoogleDoc,
  getPersonalGoogleConnectionStatus,
  parseGoogleDocId,
  startPersonalGoogleOAuth,
  syncPersonalGoogleDocSource,
} from "./personalGoogleSync";
import {
  MAX_RAW_TEXT_CHARS,
  MAX_UPLOAD_BYTES,
  computeCefrSummary,
  extractAndAnalyzePersonalNotes,
  extractTextFromUploadedFile,
  sanitizeUntrustedText,
  upsertParsedSourceItemsTx,
} from "./personalParser";
import {
  applyPersonalMasteryAttemptTx,
  buildPersonalSenseKey,
  canonicalPersonalKey,
  listUserPersonalSources,
  loadUserPersonalVocab,
  sha256Text,
} from "./personalStore";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

function sortAdaptiveVocab(items: PersonalVocabItemDTO[]): PersonalVocabItemDTO[] {
  const nowMs = Date.now();
  return [...items].sort((a, b) => {
    const score = (w: PersonalVocabItemDTO) => {
      let s = 0;
      if (w.mastery.needsReview) s -= 40;
      if (w.mastery.masteryStatus === "mastered") s += 100;
      else if (w.mastery.masteryStatus === "almost_mastered") s -= 15;
      else if (w.mastery.masteryStatus === "learning") s -= 8;
      if (w.mastery.nextReviewAt && Date.parse(w.mastery.nextReviewAt) <= nowMs) s -= 20;
      if (w.mastery.totalIncorrect > 0 && w.mastery.consecutiveCorrect === 0) s -= 25;
      return s;
    };
    return score(a) - score(b);
  });
}

export function registerPersonalGermanRoutes(router: express.Router, db: Client) {
  const personal = express.Router();

  const wrap =
    (
      fn: (req: express.Request, res: express.Response) => Promise<unknown>,
    ): express.RequestHandler =>
    (req, res) => {
      void fn(req, res).catch((err) => {
        if (res.headersSent) return;
        const msg =
          err instanceof Error && err.message
            ? err.message
            : "Kişisel çalışma işlemi tamamlanamadı.";
        const status =
          err && typeof (err as any).httpStatus === "number"
            ? Math.min(503, Math.max(400, Number((err as any).httpStatus)))
            : /bulunamadı/iu.test(msg)
              ? 404
              : /desteklenmeyen|boş|geçersiz|en az|sınır|fazla/iu.test(msg)
                ? 400
                : 500;
        res.status(status).json({ error: msg });
      });
    };

  // ==================== OVERVIEW ====================
  personal.get(
    "/overview",
    wrap(async (_req, res) => {
      const userId = Number(res.locals.germanUser);
      const [sources, allActiveVocab, googleStatus, sessionsRes] = await Promise.all([
        listUserPersonalSources(db, userId),
        loadUserPersonalVocab(db, userId, { activeOnly: true, includeExcluded: false }),
        getPersonalGoogleConnectionStatus(db, userId),
        db.execute({
          sql: `SELECT id, kind, mode, direction, source_ids_json, status, total_targets,
                       covered_vocab_ids_json, current_batch, total_batches, updated_at, completed_at
                FROM german_personal_sessions
                WHERE user_id=?
                ORDER BY updated_at DESC LIMIT 20`,
          args: [userId],
        }),
      ]);

      const totalUnique = allActiveVocab.length;
      const totalMastered = allActiveVocab.filter(
        (v) => v.mastery.masteryStatus === "mastered",
      ).length;
      const totalAlmost = allActiveVocab.filter(
        (v) => v.mastery.masteryStatus === "almost_mastered",
      ).length;
      const totalLearning = allActiveVocab.filter(
        (v) => v.mastery.masteryStatus === "learning",
      ).length;
      const totalNeedsReview = allActiveVocab.filter(
        (v) => v.mastery.needsReview || (v.mastery.totalIncorrect > 0 && v.mastery.masteryStatus !== "mastered"),
      ).length;
      const overallCefr = computeCefrSummary(allActiveVocab);

      const sessions = sessionsRes.rows.map((r) => {
        const covered = JSON.parse(String(r.covered_vocab_ids_json || "[]")) as string[];
        const total = Number(r.total_targets ?? 0);
        return {
          id: String(r.id),
          kind: String(r.kind),
          mode: String(r.mode),
          direction: String(r.direction),
          sourceIds: JSON.parse(String(r.source_ids_json || "[]")) as string[],
          status: String(r.status),
          totalTargets: total,
          coveredCount: covered.length,
          coveragePercent: total > 0 ? Math.min(100, Math.round((covered.length / total) * 1000) / 10) : 0,
          currentBatch: Number(r.current_batch ?? 1),
          totalBatches: Number(r.total_batches ?? 1),
          updatedAt: String(r.updated_at),
          completedAt: r.completed_at ? String(r.completed_at) : null,
        };
      });

      res.json({
        sources,
        googleStatus,
        summary: {
          totalSources: sources.length,
          totalUniqueWords: totalUnique,
          masteredWords: totalMastered,
          almostMasteredWords: totalAlmost,
          learningWords: totalLearning,
          needsReviewWords: totalNeedsReview,
          completionPercent:
            totalUnique > 0 ? Math.round((totalMastered / totalUnique) * 1000) / 10 : 0,
          cefrSummary: overallCefr,
        },
        sessions,
      });
    }),
  );

  // ==================== SOURCE 1: PASTE / EDIT TEXT ====================
  personal.post(
    "/sources/text",
    express.json({ limit: "512kb" }),
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const title = String(req.body?.title ?? "").trim().slice(0, 120) || "Kişisel Metin Notu";
      const rawText = sanitizeUntrustedText(String(req.body?.text ?? "")).slice(0, MAX_RAW_TEXT_CHARS);
      const useAI = req.body?.useAI !== false;

      if (rawText.length < 3) {
        return res.status(400).json({ error: "Lütfen analiz edilecek Almanca notlarını veya kelime listesini yapıştır." });
      }

      const analyzed = await extractAndAnalyzePersonalNotes(db, { userId, rawText, useAI });
      if (!analyzed.items.length) {
        return res.status(422).json({
          error:
            "Bu metinden eşleştirilebilir Almanca–Türkçe kelime çıkarılamadı. Örnek biçim: 'der Termin — randevu' veya 'Erfahrung = deneyim'.",
        });
      }

      const sourceId = randomUUID();
      const nowIso = new Date().toISOString();
      const contentHash = sha256Text(rawText);

      const tx = await db.transaction("write");
      let diff = { added: 0, updated: 0, removed: 0, totalActive: 0 };
      try {
        await tx.execute({
          sql: `INSERT INTO german_personal_sources(
                  id, user_id, title, source_type, raw_text, content_hash,
                  sync_status, cefr_summary_json, created_at, updated_at
                ) VALUES(?,?,?,'text',?,?,'synced',?,?,?)`,
          args: [
            sourceId,
            userId,
            title,
            rawText,
            contentHash,
            JSON.stringify(analyzed.cefrSummary),
            nowIso,
            nowIso,
          ],
        });
        diff = await upsertParsedSourceItemsTx(tx, {
          userId,
          sourceId,
          items: analyzed.items,
          contentHash,
          cefrSummary: analyzed.cefrSummary,
          nowIso,
        });
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }

      const sources = await listUserPersonalSources(db, userId);
      const created = sources.find((s) => s.id === sourceId);
      res.status(201).json({
        source: created,
        diff,
        aiUsed: analyzed.aiUsed,
        warnings: analyzed.warnings,
      });
    }),
  );

  personal.put(
    "/sources/:id/text",
    express.json({ limit: "512kb" }),
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = String(req.params.id);
      const existing = (
        await db.execute({
          sql: "SELECT id, title FROM german_personal_sources WHERE id=? AND user_id=? AND deleted_at IS NULL",
          args: [sourceId, userId],
        })
      ).rows[0];
      if (!existing) return res.status(404).json({ error: "Kaynak bulunamadı." });

      const title =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim().slice(0, 120)
          : String(existing.title);
      const rawText = sanitizeUntrustedText(String(req.body?.text ?? "")).slice(0, MAX_RAW_TEXT_CHARS);
      const useAI = req.body?.useAI !== false;
      if (rawText.length < 3) {
        return res.status(400).json({ error: "Metin boş bırakılamaz." });
      }

      const analyzed = await extractAndAnalyzePersonalNotes(db, { userId, rawText, useAI });
      if (!analyzed.items.length) {
        return res.status(422).json({
          error: "Güncellenen metinden çıkarılabilir kelime bulunamadı.",
        });
      }

      const nowIso = new Date().toISOString();
      const contentHash = sha256Text(rawText);

      const tx = await db.transaction("write");
      let diff = { added: 0, updated: 0, removed: 0, totalActive: 0 };
      try {
        await tx.execute({
          sql: "UPDATE german_personal_sources SET title=?, raw_text=?, updated_at=? WHERE id=? AND user_id=?",
          args: [title, rawText, nowIso, sourceId, userId],
        });
        diff = await upsertParsedSourceItemsTx(tx, {
          userId,
          sourceId,
          items: analyzed.items,
          contentHash,
          cefrSummary: analyzed.cefrSummary,
          nowIso,
        });
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }

      const sources = await listUserPersonalSources(db, userId);
      res.json({
        source: sources.find((s) => s.id === sourceId),
        diff,
        aiUsed: analyzed.aiUsed,
        warnings: analyzed.warnings,
      });
    }),
  );

  // ==================== SOURCE 2: FILE UPLOAD (TXT, MD, DOCX, PDF) ====================
  personal.post(
    "/sources/upload",
    (req, res, next) => {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          const msg =
            err.code === "LIMIT_FILE_SIZE"
              ? "Dosya boyutu en fazla 5 MB olabilir."
              : "Dosya yüklenemedi. Desteklenen türler: TXT, MD, DOCX, PDF.";
          return res.status(400).json({ error: msg });
        }
        next();
      });
    },
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Lütfen bir TXT, MD, DOCX veya PDF dosyası seç." });
      }

      const extracted = await extractTextFromUploadedFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });

      const title =
        (typeof req.body?.title === "string" && req.body.title.trim()) ||
        file.originalname.replace(/\.[^.]+$/u, "").slice(0, 120) ||
        "Yüklenen Belge";
      const useAI = req.body?.useAI !== "false" && req.body?.useAI !== false;

      const analyzed = await extractAndAnalyzePersonalNotes(db, {
        userId,
        rawText: extracted.text,
        useAI,
      });
      if (!analyzed.items.length) {
        return res.status(422).json({
          error:
            "Dosyadan Almanca–Türkçe kelime çifti çıkarılamadı. Belgede kelime–anlam satırları veya Almanca notlar olduğundan emin ol.",
        });
      }

      const sourceId = randomUUID();
      const nowIso = new Date().toISOString();
      const contentHash = sha256Text(extracted.text);

      const tx = await db.transaction("write");
      let diff = { added: 0, updated: 0, removed: 0, totalActive: 0 };
      try {
        await tx.execute({
          sql: `INSERT INTO german_personal_sources(
                  id, user_id, title, source_type, raw_text, file_name, file_mime, file_size,
                  content_hash, sync_status, cefr_summary_json, created_at, updated_at
                ) VALUES(?,?,?,'file',?,?,?,?,?,'synced',?,?,?)`,
          args: [
            sourceId,
            userId,
            title.slice(0, 120),
            extracted.text,
            file.originalname.slice(0, 180),
            file.mimetype.slice(0, 120),
            file.size,
            contentHash,
            JSON.stringify(analyzed.cefrSummary),
            nowIso,
            nowIso,
          ],
        });
        diff = await upsertParsedSourceItemsTx(tx, {
          userId,
          sourceId,
          items: analyzed.items,
          contentHash,
          cefrSummary: analyzed.cefrSummary,
          nowIso,
        });
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }

      const sources = await listUserPersonalSources(db, userId);
      res.status(201).json({
        source: sources.find((s) => s.id === sourceId),
        format: extracted.format,
        diff,
        aiUsed: analyzed.aiUsed,
        warnings: [...extracted.warnings, ...analyzed.warnings],
      });
    }),
  );

  // ==================== SOURCE 3: GOOGLE DOCS OAUTH & SYNC ====================
  personal.get(
    "/google/status",
    wrap(async (_req, res) => {
      const userId = Number(res.locals.germanUser);
      res.json(await getPersonalGoogleConnectionStatus(db, userId));
    }),
  );

  personal.post(
    "/google/start",
    wrap(async (_req, res) => {
      const userId = Number(res.locals.germanUser);
      const started = await startPersonalGoogleOAuth(db, userId);
      res.json(started);
    }),
  );

  personal.post(
    "/google/disconnect",
    wrap(async (_req, res) => {
      const userId = Number(res.locals.germanUser);
      await disconnectPersonalGoogleOAuth(db, userId);
      res.json({ ok: true });
    }),
  );

  personal.post(
    "/sources/gdoc",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const rawUrl = String(req.body?.url ?? "").trim();
      const parsed = parseGoogleDocId(rawUrl);
      if (!parsed) {
        return res.status(400).json({
          error: "Geçerli bir Google Docs bağlantısı veya belge kimliği gir. (Örn: https://docs.google.com/document/d/...)",
        });
      }

      const customTitle =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim().slice(0, 120)
          : "";
      const autoSyncEnabled = req.body?.autoSyncEnabled !== false;
      const syncIntervalMin = Math.max(5, Math.min(1440, Number(req.body?.syncIntervalMin ?? 15) || 15));
      const useAI = req.body?.useAI !== false;
      const clientAccessToken =
        typeof req.headers["x-google-access-token"] === "string"
          ? req.headers["x-google-access-token"].trim()
          : null;

      // Check if user already connected this docId
      const dupRes = await db.execute({
        sql: "SELECT id FROM german_personal_sources WHERE user_id=? AND gdoc_id=? AND deleted_at IS NULL",
        args: [userId, parsed.docId],
      });
      if (dupRes.rows[0]) {
        const existingId = String(dupRes.rows[0].id);
        const synced = await syncPersonalGoogleDocSource(db, {
          userId,
          sourceId: existingId,
          clientAccessToken,
          force: true,
          useAI,
        });
        const sources = await listUserPersonalSources(db, userId);
        return res.json({
          source: sources.find((s) => s.id === existingId),
          alreadyConnected: true,
          sync: synced,
        });
      }

      // Fetch and validate Google Doc access before creating source
      const doc = await fetchPersonalGoogleDoc(db, {
        userId,
        docId: parsed.docId,
        clientAccessToken,
      });

      const analyzed = await extractAndAnalyzePersonalNotes(db, {
        userId,
        rawText: doc.text,
        useAI,
      });
      if (!analyzed.items.length) {
        return res.status(422).json({
          error:
            "Google Docs belgesi okundu ancak Almanca–Türkçe kelime çifti çıkarılamadı. Belgede kelime–anlam satırları veya tablo bulunduğundan emin ol.",
        });
      }

      const sourceId = randomUUID();
      const now = new Date();
      const nowIso = now.toISOString();
      const nextSyncAt = autoSyncEnabled
        ? new Date(now.getTime() + syncIntervalMin * 60_000).toISOString()
        : null;
      const contentHash = sha256Text(doc.text);
      const finalTitle = customTitle || doc.title || "Google Docs Belgesi";

      const tx = await db.transaction("write");
      let diff = { added: 0, updated: 0, removed: 0, totalActive: 0 };
      try {
        await tx.execute({
          sql: `INSERT INTO german_personal_sources(
                  id, user_id, title, source_type, raw_text, gdoc_id, gdoc_url, gdoc_revision_id,
                  content_hash, auto_sync_enabled, sync_interval_min, sync_status,
                  last_synced_at, next_sync_at, cefr_summary_json, created_at, updated_at
                ) VALUES(?,?,?,'gdoc',?,?,?,?,?,?,?,'synced',?,?,?,?,?)`,
          args: [
            sourceId,
            userId,
            finalTitle,
            doc.text.slice(0, MAX_RAW_TEXT_CHARS),
            parsed.docId,
            parsed.normalizedUrl,
            doc.revisionId,
            contentHash,
            autoSyncEnabled ? 1 : 0,
            syncIntervalMin,
            nowIso,
            nextSyncAt,
            JSON.stringify(analyzed.cefrSummary),
            nowIso,
            nowIso,
          ],
        });
        diff = await upsertParsedSourceItemsTx(tx, {
          userId,
          sourceId,
          items: analyzed.items,
          revisionId: doc.revisionId,
          contentHash,
          cefrSummary: analyzed.cefrSummary,
          nowIso,
        });
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }

      const sources = await listUserPersonalSources(db, userId);
      res.status(201).json({
        source: sources.find((s) => s.id === sourceId),
        accessMethod: doc.accessMethod,
        diff,
        aiUsed: analyzed.aiUsed,
        warnings: analyzed.warnings,
      });
    }),
  );

  personal.post(
    "/sources/:id/sync",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = String(req.params.id);
      const clientAccessToken =
        typeof req.headers["x-google-access-token"] === "string"
          ? req.headers["x-google-access-token"].trim()
          : null;
      const result = await syncPersonalGoogleDocSource(db, {
        userId,
        sourceId,
        clientAccessToken,
        force: Boolean(req.body?.force),
        useAI: req.body?.useAI !== false,
      });
      const sources = await listUserPersonalSources(db, userId);
      res.json({
        sync: result,
        source: sources.find((s) => s.id === sourceId) ?? null,
      });
    }),
  );

  // ==================== SOURCE DETAILS, SETTINGS, DELETE ====================
  personal.get(
    "/sources/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = String(req.params.id);
      const srcRow = (
        await db.execute({
          sql: "SELECT * FROM german_personal_sources WHERE id=? AND user_id=? AND deleted_at IS NULL",
          args: [sourceId, userId],
        })
      ).rows[0];
      if (!srcRow) return res.status(404).json({ error: "Kaynak bulunamadı." });

      const [sources, items, versionsRes] = await Promise.all([
        listUserPersonalSources(db, userId),
        loadUserPersonalVocab(db, userId, {
          sourceIds: [sourceId],
          activeOnly: true,
          includeExcluded: true,
        }),
        db.execute({
          sql: "SELECT * FROM german_personal_source_versions WHERE source_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20",
          args: [sourceId, userId],
        }),
      ]);

      res.json({
        source: sources.find((s) => s.id === sourceId),
        rawText: String(srcRow.raw_text ?? ""),
        items,
        versions: versionsRes.rows.map((v) => ({
          id: String(v.id),
          revisionId: v.revision_id ? String(v.revision_id) : null,
          addedCount: Number(v.added_count ?? 0),
          updatedCount: Number(v.updated_count ?? 0),
          removedCount: Number(v.removed_count ?? 0),
          totalActive: Number(v.total_active ?? 0),
          createdAt: String(v.created_at),
        })),
      });
    }),
  );

  personal.patch(
    "/sources/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = String(req.params.id);
      const row = (
        await db.execute({
          sql: "SELECT id, title, auto_sync_enabled, sync_interval_min FROM german_personal_sources WHERE id=? AND user_id=? AND deleted_at IS NULL",
          args: [sourceId, userId],
        })
      ).rows[0];
      if (!row) return res.status(404).json({ error: "Kaynak bulunamadı." });

      const nextTitle =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim().slice(0, 120)
          : String(row.title);
      const nextAuto =
        typeof req.body?.autoSyncEnabled === "boolean"
          ? req.body.autoSyncEnabled
          : Number(row.auto_sync_enabled ?? 0) === 1;
      const nextInterval =
        Number.isFinite(Number(req.body?.syncIntervalMin))
          ? Math.max(5, Math.min(1440, Number(req.body.syncIntervalMin)))
          : Number(row.sync_interval_min ?? 15);
      const nextSyncAt = nextAuto
        ? new Date(Date.now() + nextInterval * 60_000).toISOString()
        : null;

      await db.execute({
        sql: "UPDATE german_personal_sources SET title=?, auto_sync_enabled=?, sync_interval_min=?, next_sync_at=?, updated_at=? WHERE id=? AND user_id=?",
        args: [nextTitle, nextAuto ? 1 : 0, nextInterval, nextSyncAt, new Date().toISOString(), sourceId, userId],
      });

      const sources = await listUserPersonalSources(db, userId);
      res.json({ source: sources.find((s) => s.id === sourceId) });
    }),
  );

  personal.delete(
    "/sources/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = String(req.params.id);
      const nowIso = new Date().toISOString();
      const out = await db.execute({
        sql: "UPDATE german_personal_sources SET deleted_at=?, auto_sync_enabled=0, updated_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL",
        args: [nowIso, nowIso, sourceId, userId],
      });
      if (!out.rowsAffected) return res.status(404).json({ error: "Kaynak bulunamadı." });
      res.json({ ok: true });
    }),
  );

  // ==================== UNIFIED PERSONAL VOCABULARY LIBRARY ====================
  personal.get(
    "/vocabulary",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceId = typeof req.query.sourceId === "string" ? req.query.sourceId.trim() : "";
      const cefr = typeof req.query.cefr === "string" ? req.query.cefr.trim() : "ALL";
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "all";
      const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 120) : "";
      const sort = typeof req.query.sort === "string" ? req.query.sort : "updated";
      const includeExcluded = req.query.includeExcluded === "1";

      let items = await loadUserPersonalVocab(db, userId, {
        sourceIds: sourceId && sourceId !== "ALL" ? [sourceId] : undefined,
        activeOnly: true,
        includeExcluded,
      });

      const qLower = q.toLocaleLowerCase("tr");
      items = items.filter((w) => {
        if (cefr !== "ALL" && w.cefrLevel !== cefr) return false;
        if (status === "mastered" && w.mastery.masteryStatus !== "mastered") return false;
        if (status === "almost_mastered" && w.mastery.masteryStatus !== "almost_mastered") return false;
        if (status === "learning" && w.mastery.masteryStatus !== "learning") return false;
        if (status === "not_learned" && w.mastery.masteryStatus !== "not_learned") return false;
        if (status === "unmastered" && w.mastery.masteryStatus === "mastered") return false;
        if (status === "mistakes" && !(w.mastery.needsReview || w.mastery.totalIncorrect > 0)) return false;
        if (status === "uncertain" && !w.uncertain) return false;
        if (qLower) {
          const hay = `${w.de} ${w.tr} ${w.category} ${w.exampleDe} ${w.exampleTr} ${w.notes}`.toLocaleLowerCase("tr");
          if (!hay.includes(qLower)) return false;
        }
        return true;
      });

      if (sort === "alpha") {
        items.sort((a, b) => a.de.localeCompare(b.de, "de"));
      } else if (sort === "streak_asc") {
        items.sort((a, b) => a.mastery.consecutiveCorrect - b.mastery.consecutiveCorrect);
      } else if (sort === "streak_desc") {
        items.sort((a, b) => b.mastery.consecutiveCorrect - a.mastery.consecutiveCorrect);
      } else if (sort === "mistakes") {
        items.sort((a, b) => b.mastery.totalIncorrect - a.mastery.totalIncorrect);
      }

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 40) || 40));
      const total = items.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, totalPages);

      res.json({
        items: items.slice((safePage - 1) * limit, safePage * limit),
        total,
        page: safePage,
        limit,
        totalPages,
      });
    }),
  );

  personal.patch(
    "/vocabulary/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const vocabId = String(req.params.id);
      const row = (
        await db.execute({
          sql: "SELECT * FROM german_personal_vocab WHERE id=? AND user_id=?",
          args: [vocabId, userId],
        })
      ).rows[0];
      if (!row) return res.status(404).json({ error: "Kelime bulunamadı." });

      const nextDe =
        typeof req.body?.de === "string" && req.body.de.trim()
          ? req.body.de.trim().slice(0, 220)
          : String(row.de);
      const nextTr =
        typeof req.body?.tr === "string" && req.body.tr.trim()
          ? req.body.tr.trim().slice(0, 320)
          : String(row.tr);
      const nextArticle =
        typeof req.body?.article === "string" ? req.body.article.trim().slice(0, 12) : String(row.article ?? "");
      const nextPlural =
        typeof req.body?.plural === "string" ? req.body.plural.trim().slice(0, 120) : String(row.plural ?? "");
      const nextPos =
        typeof req.body?.partOfSpeech === "string"
          ? req.body.partOfSpeech.trim().slice(0, 40)
          : String(row.part_of_speech ?? "");
      const nextExampleDe =
        typeof req.body?.exampleDe === "string"
          ? req.body.exampleDe.trim().slice(0, 400)
          : String(row.example_de ?? "");
      const nextExampleTr =
        typeof req.body?.exampleTr === "string"
          ? req.body.exampleTr.trim().slice(0, 400)
          : String(row.example_tr ?? "");
      const nextNotes =
        typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : String(row.notes ?? "");
      const nextCategory =
        typeof req.body?.category === "string" && req.body.category.trim()
          ? req.body.category.trim().slice(0, 60)
          : String(row.category ?? "Genel");
      const nextCefr: PersonalCefrLevel = isPersonalCefrLevel(req.body?.cefrLevel)
        ? req.body.cefrLevel
        : (String(row.cefr_level) as PersonalCefrLevel);
      const cefrChanged = isPersonalCefrLevel(req.body?.cefrLevel) && req.body.cefrLevel !== String(row.cefr_level);
      const nextUncertain =
        typeof req.body?.uncertain === "boolean" ? (req.body.uncertain ? 1 : 0) : 0;

      const ck = canonicalPersonalKey(nextDe);
      const sk = buildPersonalSenseKey(nextDe, nextTr);
      const nowIso = new Date().toISOString();

      await db.execute({
        sql: `UPDATE german_personal_vocab SET
                de=?, tr=?, canonical_key=?, sense_key=?, article=?, plural=?, part_of_speech=?,
                example_de=?, example_tr=?, notes=?, category=?, cefr_level=?,
                cefr_source=CASE WHEN ? THEN 'manual' ELSE cefr_source END,
                cefr_confidence=CASE WHEN ? THEN 1.0 ELSE cefr_confidence END,
                uncertain=?, updated_at=?
              WHERE id=? AND user_id=?`,
        args: [
          nextDe,
          nextTr,
          ck,
          sk,
          nextArticle,
          nextPlural,
          nextPos,
          nextExampleDe,
          nextExampleTr,
          nextNotes,
          nextCategory,
          nextCefr,
          cefrChanged ? 1 : 0,
          cefrChanged ? 1 : 0,
          nextUncertain,
          nowIso,
          vocabId,
          userId,
        ],
      });

      // Recalculate CEFR summaries for affected sources if CEFR changed
      if (cefrChanged) {
        const affected = await db.execute({
          sql: "SELECT DISTINCT source_id FROM german_personal_source_items WHERE vocab_id=? AND user_id=? AND active=1",
          args: [vocabId, userId],
        });
        for (const a of affected.rows) {
          const sid = String(a.source_id);
          const srcItems = await loadUserPersonalVocab(db, userId, {
            sourceIds: [sid],
            activeOnly: true,
            includeExcluded: false,
          });
          await db.execute({
            sql: "UPDATE german_personal_sources SET cefr_summary_json=?, updated_at=? WHERE id=? AND user_id=?",
            args: [JSON.stringify(computeCefrSummary(srcItems)), nowIso, sid, userId],
          });
        }
      }

      const updatedList = await loadUserPersonalVocab(db, userId, { activeOnly: false, includeExcluded: true });
      res.json({ item: updatedList.find((w) => w.id === vocabId) });
    }),
  );

  personal.post(
    "/vocabulary/:id/exclude",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const vocabId = String(req.params.id);
      const sourceId = typeof req.body?.sourceId === "string" ? req.body.sourceId.trim() : "";
      const excluded = Boolean(req.body?.excluded);
      const nowIso = new Date().toISOString();

      if (sourceId) {
        await db.execute({
          sql: "UPDATE german_personal_source_items SET excluded=?, updated_at=? WHERE source_id=? AND vocab_id=? AND user_id=?",
          args: [excluded ? 1 : 0, nowIso, sourceId, vocabId, userId],
        });
      } else {
        await db.execute({
          sql: "UPDATE german_personal_source_items SET excluded=?, updated_at=? WHERE vocab_id=? AND user_id=?",
          args: [excluded ? 1 : 0, nowIso, vocabId, userId],
        });
      }
      res.json({ ok: true, excluded });
    }),
  );

  personal.delete(
    "/vocabulary/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const vocabId = String(req.params.id);
      const sourceId = typeof req.query.sourceId === "string" ? req.query.sourceId.trim() : "";
      const nowIso = new Date().toISOString();

      if (sourceId) {
        await db.execute({
          sql: "UPDATE german_personal_source_items SET active=0, updated_at=? WHERE source_id=? AND vocab_id=? AND user_id=?",
          args: [nowIso, sourceId, vocabId, userId],
        });
      } else {
        await db.execute({
          sql: "UPDATE german_personal_source_items SET active=0, updated_at=? WHERE vocab_id=? AND user_id=?",
          args: [nowIso, vocabId, userId],
        });
      }
      res.json({ ok: true });
    }),
  );

  personal.get(
    "/vocabulary/:id/history",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const vocabId = String(req.params.id);
      const [all, attemptsRes] = await Promise.all([
        loadUserPersonalVocab(db, userId, { activeOnly: false, includeExcluded: true }),
        db.execute({
          sql: `SELECT id, session_id, mode, direction, prompt_text, user_answer, expected_answer,
                       is_correct, self_assessed, credit_granted, streak_before, streak_after,
                       mastered_now, reported, created_at
                FROM german_personal_attempts
                WHERE user_id=? AND vocab_id=?
                ORDER BY created_at DESC LIMIT 40`,
          args: [userId, vocabId],
        }),
      ]);
      const item = all.find((w) => w.id === vocabId);
      if (!item) return res.status(404).json({ error: "Kelime bulunamadı." });

      res.json({
        item,
        attempts: attemptsRes.rows.map((a) => ({
          id: String(a.id),
          sessionId: String(a.session_id),
          mode: String(a.mode),
          direction: String(a.direction),
          promptText: String(a.prompt_text),
          userAnswer: String(a.user_answer),
          expectedAnswer: String(a.expected_answer),
          isCorrect: Number(a.is_correct ?? 0) === 1,
          selfAssessed: Number(a.self_assessed ?? 0) === 1,
          creditGranted: Number(a.credit_granted ?? 0) === 1,
          streakBefore: Number(a.streak_before ?? 0),
          streakAfter: Number(a.streak_after ?? 0),
          masteredNow: Number(a.mastered_now ?? 0) === 1,
          reported: Number(a.reported ?? 0) === 1,
          createdAt: String(a.created_at),
        })),
      });
    }),
  );

  // ==================== EXERCISE SESSIONS (10 MODES + ADAPTIVE) ====================
  personal.post(
    "/sessions",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const rawMode = String(req.body?.mode ?? "adaptive");
      const mode: PersonalExerciseModeId | "adaptive" =
        rawMode === "adaptive" || isPersonalExerciseMode(rawMode) ? rawMode : "adaptive";
      const direction: PersonalDirection =
        req.body?.direction === "de_tr" || req.body?.direction === "tr_de" || req.body?.direction === "mixed"
          ? req.body.direction
          : "mixed";
      const sourceIds = Array.isArray(req.body?.sourceIds)
        ? req.body.sourceIds.filter((s: any) => typeof s === "string" && s.trim())
        : [];
      const filterStatus = typeof req.body?.filterStatus === "string" ? req.body.filterStatus : "unmastered";
      const cefrLevels = Array.isArray(req.body?.cefrLevels)
        ? req.body.cefrLevels.filter((l: any) => isPersonalCefrLevel(l))
        : [];
      const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
      const explicitVocabIds = Array.isArray(req.body?.vocabIds)
        ? req.body.vocabIds.filter((id: any) => typeof id === "string")
        : [];
      const sessionLength = Math.max(4, Math.min(60, Number(req.body?.sessionLength ?? 12) || 12));
      const useAI = req.body?.useAI !== false;

      const allPool = await loadUserPersonalVocab(db, userId, {
        sourceIds: sourceIds.length ? sourceIds : undefined,
        activeOnly: true,
        includeExcluded: false,
      });

      if (!allPool.length) {
        return res.status(409).json({
          error: "Önce en az bir metin, dosya veya Google Docs kaynağı eklemelisin.",
        });
      }

      let filtered = allPool;
      if (explicitVocabIds.length > 0) {
        const set = new Set(explicitVocabIds);
        filtered = filtered.filter((w) => set.has(w.id));
      } else {
        if (cefrLevels.length > 0) {
          const lvlSet = new Set(cefrLevels);
          filtered = filtered.filter((w) => lvlSet.has(w.cefrLevel));
        }
        if (category && category !== "ALL") {
          filtered = filtered.filter((w) => w.category === category);
        }
        if (filterStatus === "new") {
          filtered = filtered.filter((w) => w.mastery.totalCorrect === 0 && w.mastery.totalIncorrect === 0);
        } else if (filterStatus === "unmastered") {
          const unm = filtered.filter((w) => w.mastery.masteryStatus !== "mastered");
          if (unm.length > 0) filtered = unm;
        } else if (filterStatus === "mistakes") {
          filtered = filtered.filter((w) => w.mastery.needsReview || w.mastery.totalIncorrect > 0);
        } else if (filterStatus === "almost_mastered") {
          filtered = filtered.filter((w) => w.mastery.consecutiveCorrect >= 3 && w.mastery.masteryStatus !== "mastered");
        } else if (filterStatus === "mastered_review") {
          filtered = filtered.filter((w) => w.mastery.masteryStatus === "mastered");
        }
      }

      if (!filtered.length) {
        return res.status(409).json({
          error: "Seçili filtrelere uyan kelime bulunamadı. Filtreleri genişletip tekrar dene.",
        });
      }

      if (mode === "matching" && filtered.length < 2) {
        return res.status(409).json({
          error: "Kelime Eşleştirme modu için en az 2 farklı kelime gereklidir.",
        });
      }

      const prioritized = sortAdaptiveVocab(filtered).slice(0, sessionLength);
      const questions = await generatePersonalPracticeQuestions(db, {
        userId,
        targets: prioritized,
        pool: allPool,
        mode,
        direction,
        useAI,
      });

      if (!questions.length) {
        return res.status(409).json({ error: "Bu ayarlarla soru oluşturulamadı." });
      }

      await recordPersonalQuestionHistory(db, userId, questions);

      const sessionId = randomUUID();
      const nowIso = new Date().toISOString();
      const uniqueTargets = [...new Set(questions.flatMap((q) => q.vocabIds))];

      await db.execute({
        sql: `INSERT INTO german_personal_sessions(
                id, user_id, kind, mode, direction, source_ids_json, filters_json, status,
                total_targets, covered_vocab_ids_json, current_batch, total_batches, batch_size,
                extended_mode, state_json, results_json, created_at, updated_at
              ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          sessionId,
          userId,
          "practice",
          mode,
          direction,
          JSON.stringify(sourceIds.length ? sourceIds : [...new Set(allPool.flatMap((w) => w.sourceIds))]),
          JSON.stringify({ filterStatus, cefrLevels, category, sessionLength }),
          "active",
          uniqueTargets.length,
          "[]",
          1,
          1,
          questions.length,
          0,
          JSON.stringify({ questions, currentIndex: 0, targetVocabIds: uniqueTargets }),
          "{}",
          nowIso,
          nowIso,
        ],
      });

      const session = await hydratePersonalSession(db, userId, sessionId);
      res.status(201).json(session);
    }),
  );

  // ==================== COMPREHENSIVE TEST (100% FULL COVERAGE) ====================
  personal.post(
    "/comprehensive",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sourceIds = Array.isArray(req.body?.sourceIds)
        ? req.body.sourceIds.filter((s: any) => typeof s === "string" && s.trim())
        : [];
      const batchSize = Number(req.body?.batchSize ?? 50) || 50;
      const extendedMode = Boolean(req.body?.extendedMode);
      const direction: PersonalDirection =
        req.body?.direction === "de_tr" || req.body?.direction === "tr_de" || req.body?.direction === "mixed"
          ? req.body.direction
          : "mixed";

      const session = await createComprehensiveTestSession(db, {
        userId,
        sourceIds,
        batchSize,
        extendedMode,
        direction,
      });
      res.status(201).json(session);
    }),
  );

  // ==================== SESSION GET / ANSWER / NEXT BATCH / PAUSE / COMPLETE ====================
  personal.get(
    "/sessions/:id",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const session = await hydratePersonalSession(db, userId, String(req.params.id));
      res.json(session);
    }),
  );

  personal.post(
    "/sessions/:id/answer",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sessionId = String(req.params.id);
      const questionId = String(req.body?.questionId ?? "");
      const userAnswer = typeof req.body?.answer === "string" ? req.body.answer : "";
      const selfAssessment =
        req.body?.selfAssessment === "known" || req.body?.selfAssessment === "unknown"
          ? req.body.selfAssessment
          : null;
      const skip = Boolean(req.body?.skip);
      const idempotencyKey =
        typeof req.body?.idempotencyKey === "string" && req.body.idempotencyKey.trim()
          ? req.body.idempotencyKey.trim().slice(0, 120)
          : `${userId}:${sessionId}:${questionId}`;
      const useAI = req.body?.useAI !== false;

      const sRow = (
        await db.execute({
          sql: "SELECT * FROM german_personal_sessions WHERE id=? AND user_id=?",
          args: [sessionId, userId],
        })
      ).rows[0];
      if (!sRow) return res.status(404).json({ error: "Oturum bulunamadı." });
      if (String(sRow.status) === "completed") {
        return res.status(409).json({ error: "Bu oturum zaten tamamlandı." });
      }

      const kind = String(sRow.kind);
      const currentBatch = Number(sRow.current_batch ?? 1);
      const state = JSON.parse(String(sRow.state_json || "{}")) as any;
      const results = JSON.parse(String(sRow.results_json || "{}")) as Record<
        string,
        PersonalQuestionResult
      >;
      const activeQuestions: PersonalQuestion[] =
        kind === "comprehensive"
          ? state.batchQuestions?.[String(currentBatch)] ?? []
          : state.questions ?? [];

      const qIndex = activeQuestions.findIndex((q) => q.id === questionId);
      const question = activeQuestions[qIndex];
      if (!question) return res.status(400).json({ error: "Soru bu oturumda bulunamadı." });

      // Idempotent guard: already answered question in this session
      if (results[questionId]) {
        const session = await hydratePersonalSession(db, userId, sessionId);
        return res.json({
          alreadyAnswered: true,
          result: results[questionId],
          session,
        });
      }

      const graded = await evaluatePersonalAnswer(db, {
        userId,
        question,
        userAnswer,
        selfAssessment,
        skip,
        useAI,
      });

      const filters = JSON.parse(String(sRow.filters_json || "{}"));
      const isMasteredReview = filters.filterStatus === "mastered_review";

      const allVocab = await loadUserPersonalVocab(db, userId, {
        activeOnly: false,
        includeExcluded: true,
      });
      const vocabById = new Map(allVocab.map((v) => [v.id, v]));

      const coveredSet = new Set<string>(
        JSON.parse(String(sRow.covered_vocab_ids_json || "[]")) as string[],
      );

      let primaryAttemptId = "";
      let primaryCreditGranted = false;
      let primaryStreakBefore = 0;
      let primaryStreakAfter = 0;
      let primaryMasteredNow = false;

      const tx = await db.transaction("write");
      try {
        // Re-check results inside write tx to prevent concurrent double-submission race!
        const freshRow = (
          await tx.execute({
            sql: "SELECT results_json, covered_vocab_ids_json, state_json FROM german_personal_sessions WHERE id=? AND user_id=?",
            args: [sessionId, userId],
          })
        ).rows[0];
        const freshResults = JSON.parse(String(freshRow?.results_json || "{}"));
        if (freshResults[questionId]) {
          await tx.commit();
          const session = await hydratePersonalSession(db, userId, sessionId);
          return res.json({ alreadyAnswered: true, result: freshResults[questionId], session });
        }

        const targetVocabIds =
          question.mode === "matching" && question.matchingVocabIds?.length
            ? question.matchingVocabIds
            : [question.vocabId];

        for (let idx = 0; idx < targetVocabIds.length; idx++) {
          const vid = targetVocabIds[idx];
          const item = vocabById.get(vid);
          if (!item) continue;
          const pairCorrect =
            question.mode === "matching" && Array.isArray(graded.pairResults)
              ? Boolean(graded.pairResults[idx])
              : graded.isCorrect;

          const resMastery = await applyPersonalMasteryAttemptTx(tx, {
            userId,
            sessionId,
            vocabId: vid,
            canonicalKey: item.canonicalKey,
            tr: item.tr,
            cefrLevel: item.cefrLevel,
            idempotencyKey: `${idempotencyKey}:${vid}`,
            mode: question.mode,
            direction: question.direction,
            promptFingerprint: question.fingerprint,
            promptText: question.prompt,
            userAnswer: selfAssessment ? `[öz-değerlendirme:${selfAssessment}]` : userAnswer,
            expectedAnswer: question.expectedAnswer,
            isCorrect: pairCorrect,
            selfAssessed: graded.selfAssessed,
            creditEligible: graded.creditEligible,
            isMasteredReview,
            explanation: {
              feedbackTr: graded.feedbackTr,
              errorTags: graded.errorTags,
              naturalAlternative: graded.naturalAlternative,
            },
          });

          if (idx === 0) {
            primaryAttemptId = resMastery.attemptId;
            primaryCreditGranted = resMastery.creditGranted;
            primaryStreakBefore = resMastery.streakBefore;
            primaryStreakAfter = resMastery.streakAfter;
            primaryMasteredNow = resMastery.masteredNow;
          }
          if (!graded.skipped) {
            coveredSet.add(vid);
          }
        }

        const qResult: PersonalQuestionResult = {
          questionId,
          attemptId: primaryAttemptId,
          isCorrect: graded.isCorrect,
          creditGranted: primaryCreditGranted,
          selfAssessed: graded.selfAssessed,
          skipped: graded.skipped,
          userAnswer: selfAssessment ? (selfAssessment === "known" ? "Biliyordum" : "Tekrar Çalış") : userAnswer,
          expectedAnswer: question.expectedAnswer,
          feedbackTr: graded.feedbackTr,
          errorTags: graded.errorTags,
          wordBreakdown: graded.wordBreakdown,
          naturalAlternative: graded.naturalAlternative,
          pairResults: graded.pairResults,
          streakBefore: primaryStreakBefore,
          streakAfter: primaryStreakAfter,
          masteredNow: primaryMasteredNow,
          aiEvaluated: graded.aiEvaluated,
        };

        freshResults[questionId] = qResult;
        const freshState = JSON.parse(String(freshRow?.state_json || "{}"));
        freshState.currentIndex = Math.min(activeQuestions.length - 1, Math.max(0, qIndex));

        await tx.execute({
          sql: `UPDATE german_personal_sessions
                SET results_json=?, covered_vocab_ids_json=?, state_json=?, status='active', updated_at=?
                WHERE id=? AND user_id=?`,
          args: [
            JSON.stringify(freshResults),
            JSON.stringify([...coveredSet]),
            JSON.stringify(freshState),
            new Date().toISOString(),
            sessionId,
            userId,
          ],
        });
        await tx.commit();

        const session = await hydratePersonalSession(db, userId, sessionId);
        res.json({
          alreadyAnswered: false,
          result: qResult,
          session,
        });
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }
    }),
  );

  personal.post(
    "/sessions/:id/next-batch",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const session = await advanceComprehensiveBatch(db, userId, String(req.params.id));
      res.json(session);
    }),
  );

  personal.post(
    "/sessions/:id/pause",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sessionId = String(req.params.id);
      const currentIndex = Number(req.body?.currentIndex);
      const row = (
        await db.execute({
          sql: "SELECT state_json, status FROM german_personal_sessions WHERE id=? AND user_id=?",
          args: [sessionId, userId],
        })
      ).rows[0];
      if (!row) return res.status(404).json({ error: "Oturum bulunamadı." });
      if (String(row.status) === "completed") {
        return res.json(await hydratePersonalSession(db, userId, sessionId));
      }
      const state = JSON.parse(String(row.state_json || "{}"));
      if (Number.isInteger(currentIndex) && currentIndex >= 0) {
        state.currentIndex = currentIndex;
      }
      await db.execute({
        sql: "UPDATE german_personal_sessions SET status='paused', state_json=?, updated_at=? WHERE id=? AND user_id=?",
        args: [JSON.stringify(state), new Date().toISOString(), sessionId, userId],
      });
      res.json(await hydratePersonalSession(db, userId, sessionId));
    }),
  );

  personal.post(
    "/sessions/:id/complete",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const sessionId = String(req.params.id);
      const row = (
        await db.execute({
          sql: "SELECT * FROM german_personal_sessions WHERE id=? AND user_id=?",
          args: [sessionId, userId],
        })
      ).rows[0];
      if (!row) return res.status(404).json({ error: "Oturum bulunamadı." });

      const kind = String(row.kind);
      const results = JSON.parse(String(row.results_json || "{}")) as Record<string, PersonalQuestionResult>;
      const coveredIds = JSON.parse(String(row.covered_vocab_ids_json || "[]")) as string[];
      const totalTargets = Number(row.total_targets ?? 0);
      const currentBatch = Number(row.current_batch ?? 1);
      const totalBatches = Number(row.total_batches ?? 1);

      if (Object.keys(results).length === 0) {
        return res.status(422).json({
          error: "Henüz hiçbir soru yanıtlamadın. Oturumu duraklatıp daha sonra devam edebilirsin.",
        });
      }

      // STRICT INVARIANT: Comprehensive Test CANNOT complete until 100% of active unique targets & batches are covered!
      if (kind === "comprehensive") {
        if (currentBatch < totalBatches || coveredIds.length < totalTargets) {
          return res.status(409).json({
            error: `Genel Test tamamlanabilmesi için tüm aktif kelimeler değerlendirilmelidir (${coveredIds.length}/${totalTargets} kelime, Bölüm ${currentBatch}/${totalBatches}).`,
          });
        }
        const state = JSON.parse(String(row.state_json || "{}"));
        const lastBatchQs: PersonalQuestion[] = state.batchQuestions?.[String(totalBatches)] ?? [];
        const unanswered = lastBatchQs.filter((q) => !results[q.id]);
        if (unanswered.length > 0) {
          return res.status(409).json({
            error: `Son bölümde henüz yanıtlanmayan ${unanswered.length} soru var.`,
          });
        }
      }

      const nowIso = new Date().toISOString();
      await db.execute({
        sql: "UPDATE german_personal_sessions SET status='completed', completed_at=?, updated_at=? WHERE id=? AND user_id=?",
        args: [nowIso, nowIso, sessionId, userId],
      });

      const updatedRow = { ...row, status: "completed", completed_at: nowIso };
      const report = await buildComprehensiveReport(db, userId, updatedRow);
      const session = await hydratePersonalSession(db, userId, sessionId);
      res.json({ ...session, report });
    }),
  );

  // ==================== REPORT / RE-EVALUATE ANSWER (NO DUPLICATE MASTERY CREDIT) ====================
  personal.post(
    "/attempts/:id/report",
    wrap(async (req, res) => {
      const userId = Number(res.locals.germanUser);
      const attemptId = String(req.params.id);
      const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 400) : "";

      const row = (
        await db.execute({
          sql: "SELECT * FROM german_personal_attempts WHERE id=? AND user_id=?",
          args: [attemptId, userId],
        })
      ).rows[0];
      if (!row) return res.status(404).json({ error: "Deneme kaydı bulunamadı." });

      await db.execute({
        sql: "UPDATE german_personal_attempts SET reported=1, report_note=? WHERE id=? AND user_id=?",
        args: [note || "Kullanıcı değerlendirme itirazı bildirdi.", attemptId, userId],
      });

      // Mark reported in session results JSON as well (without ever awarding duplicate mastery credit)
      const sRow = (
        await db.execute({
          sql: "SELECT results_json FROM german_personal_sessions WHERE id=? AND user_id=?",
          args: [String(row.session_id), userId],
        })
      ).rows[0];
      if (sRow) {
        const results = JSON.parse(String(sRow.results_json || "{}")) as Record<
          string,
          PersonalQuestionResult
        >;
        for (const key of Object.keys(results)) {
          if (results[key]?.attemptId === attemptId) {
            results[key].reported = true;
          }
        }
        await db.execute({
          sql: "UPDATE german_personal_sessions SET results_json=?, updated_at=? WHERE id=? AND user_id=?",
          args: [JSON.stringify(results), new Date().toISOString(), String(row.session_id), userId],
        });
      }

      res.json({
        ok: true,
        messageTr: "Geri bildirimin kaydedildi. İnceleme kaydı oluşturuldu (mükerrer ustalık puanı eklenmez).",
      });
    }),
  );

  router.use("/personal", personal);
}
