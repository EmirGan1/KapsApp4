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
}
