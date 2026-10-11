import { Express, Request, Response } from "express";

export function registerAgendaController(app: Express, client: any) {
  // Official Saturday Support Schedule Endpoint
  app.get("/api/agenda/saturday-schedule", async (req: Request, res: Response) => {
    try {
      const dateQuery = req.query.date as string; // YYYY-MM-DD
      const targetDate = dateQuery || new Date().toISOString().split("T")[0];

      // Official 12-IB DP Weekend Academic Support Table (1. Term 2026-2027)
      const officialMap: Record<string, any> = {
        "2026-10-10": {
          displayDate: "10.10.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "PHYSICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "PHYSICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "PHYSICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-10-17": {
          displayDate: "17.10.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "MATHEMATICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "MATHEMATICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "MATHEMATICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "BIOLOGY SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "BIOLOGY SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "BIOLOGY SL-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-10-24": {
          displayDate: "24.10.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "TURKISH A-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-11-14": {
          displayDate: "14.11.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-12-05": {
          displayDate: "05.12.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "MATHEMATICS SL-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-12-12": {
          displayDate: "12.12.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-12-19": {
          displayDate: "19.12.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "MATHEMATICS SL-HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "CHEMISTRY SL-HL / TURKISH A-HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2026-12-26": {
          displayDate: "26.12.2026",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "MATHEMATICS HL", blockLabel: "Öğle Bloğu" }
          ]
        },
        "2027-01-16": {
          displayDate: "16.01.2027",
          periods: [
            { periodNumber: 1, startTime: "08:30", endTime: "09:10", subject: "TITC", blockLabel: "Sabah Bloğu" },
            { periodNumber: 2, startTime: "09:20", endTime: "10:00", subject: "TITC", blockLabel: "Sabah Bloğu" },
            { periodNumber: 3, startTime: "10:10", endTime: "10:50", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Sabah Bloğu" },
            { periodNumber: 4, startTime: "11:00", endTime: "11:40", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 5, startTime: "11:45", endTime: "12:25", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Öğle Bloğu" },
            { periodNumber: 6, startTime: "12:35", endTime: "13:15", subject: "BIOLOGY SL-HL / PHYSICS HL", blockLabel: "Öğle Bloğu" }
          ]
        }
      };

      const entry = officialMap[targetDate];
      if (entry) {
        return res.json({
          hasOfficialStudy: true,
          date: targetDate,
          displayDate: entry.displayDate,
          periods: entry.periods
        });
      }

      return res.json({
        hasOfficialStudy: false,
        date: targetDate,
        message: "Bu hafta sonu için planlanmış resmi etüt bulunmuyor",
        periods: []
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Ensure mock_exams table exists
  client.execute(`CREATE TABLE IF NOT EXISTS mock_exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    level TEXT DEFAULT 'HL',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    target_roles TEXT,
    target_courses TEXT,
    room TEXT,
    description TEXT,
    created_at TEXT
  )`).catch(() => {});

  // GET: Mock Exams Endpoint (Query by date or get entire two-week period)
  app.get(["/api/agenda/mock-exams", "/api/mock-exams"], async (req: Request, res: Response) => {
    try {
      const date = req.query.date as string | undefined;

      // Try database first
      let dbExams: any[] = [];
      try {
        if (date) {
          const r = await client.execute({ sql: "SELECT * FROM mock_exams WHERE date = ? ORDER BY start_time ASC", args: [date] });
          dbExams = r.rows || [];
        } else {
          const r = await client.execute("SELECT * FROM mock_exams ORDER BY date ASC, start_time ASC");
          dbExams = r.rows || [];
        }
      } catch (e) {}

      let examsToReturn = dbExams.map((r: any) => ({
        id: String(r.id),
        title: String(r.title),
        subject: String(r.subject),
        level: r.level || "HL",
        date: String(r.date),
        startTime: String(r.start_time),
        endTime: String(r.end_time),
        targetRoles: r.target_roles ? (typeof r.target_roles === "string" ? JSON.parse(r.target_roles) : r.target_roles) : [],
        targetCourses: r.target_courses ? (typeof r.target_courses === "string" ? JSON.parse(r.target_courses) : r.target_courses) : [r.subject],
        room: String(r.room || "Ana Salon"),
        description: r.description || ""
      }));

      // If mock_exams table has no rows, check agenda_events table where event_type = 'exam'
      if (examsToReturn.length === 0) {
        try {
          let eventRows: any[] = [];
          if (date) {
            const evR = await client.execute({
              sql: "SELECT * FROM agenda_events WHERE event_type = 'exam' AND event_date = ? ORDER BY event_time ASC",
              args: [date]
            });
            eventRows = evR.rows || [];
          } else {
            const evR = await client.execute("SELECT * FROM agenda_events WHERE event_type = 'exam' ORDER BY event_date ASC, event_time ASC");
            eventRows = evR.rows || [];
          }

          if (eventRows.length > 0) {
            examsToReturn = eventRows.map((row: any) => {
              const times = (row.event_time || "08:50 - 10:20").split("-").map((t: string) => t.trim());
              const cleanTitle = (row.title || "").replace(/^Sınav:\s*/i, "").trim();
              let subject = "General";
              if (cleanTitle.includes("Chemistry")) subject = "Chemistry";
              else if (cleanTitle.includes("Digital Society")) subject = "Digital Society";
              else if (cleanTitle.includes("Physics")) subject = "Physics";
              else if (cleanTitle.includes("Biology")) subject = "Biology";
              else if (cleanTitle.includes("English")) subject = "English A";
              else if (cleanTitle.includes("Math")) subject = "Mathematics";
              else if (cleanTitle.includes("Turkish")) subject = "Turkish A";
              else if (cleanTitle.includes("German")) subject = "German B";
              else if (cleanTitle.includes("French")) subject = "French B";
              else if (cleanTitle.includes("TITC")) subject = "TITC";

              const level = cleanTitle.includes("HL") ? "HL" : (cleanTitle.includes("SL") ? "SL" : "HL");
              let roles: string[] = [];
              try {
                if (row.target_roles) {
                  roles = typeof row.target_roles === "string" ? JSON.parse(row.target_roles) : row.target_roles;
                }
              } catch {}

              return {
                id: `agenda_exam_${row.id}`,
                title: cleanTitle,
                subject,
                level,
                date: String(row.event_date),
                startTime: times[0] || "08:50",
                endTime: times[1] || "10:20",
                targetRoles: roles,
                targetCourses: [subject],
                room: "Sınav Salonu (302)",
                description: row.description || ""
              };
            });
          }
        } catch (e) {}
      }

      return res.json({
        success: true,
        period: {
          startDate: "2026-10-12",
          endDate: "2026-10-26",
          title: "IB DP 2027 Pre-Mock 3 Deneme Sınav Takvimi"
        },
        exams: examsToReturn
      });
    } catch (err: any) {
      console.error("GET /api/agenda/mock-exams error:", err);
      return res.status(500).json({ error: "Sınav takvimi alınamadı." });
    }
  });
}
