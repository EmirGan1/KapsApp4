// KapsApp Akıllı Boşluk & Teneffüs Yakalayıcı (Gap & Break Slicing Engine)
// Genel "dinlenme/serbest zaman" yerine okulun gerçek ders programını ve teneffüs saatlerini referans alarak
// boşlukları gerçekçi eğitim akışına göre parçalar.

import { 
  WEEKLY_SCHEDULE, 
  resolveSubjectByRole, 
  getLunchBreakForDay,
  DaySchedule,
  SchedulePeriod
} from "./scheduleData";
import { OFFICIAL_SATURDAY_BELL_TIMES } from "./saturdayScheduleData";

export interface ScheduleGapItem {
  id: string;
  isGap: true;
  startTime: string; // "11:05"
  endTime: string;   // "11:15"
  durationMinutes: number;
  type: 'partial_lesson' | 'official_recess' | 'lunch';
  title: string;     // "Matematik (Son 10 dk)" veya "☕ Teneffüs (15 dk)"
  subtitle?: string; // "Derslik: 302 — Normal ders devam ediyor"
  originalCourse?: {
    name: string;
    room: string;
    teacher?: string;
    icon?: string;
    color?: string;
    bgColor?: string;
    borderColor?: string;
  };
  nextCourse?: {
    name: string;
    startTime: string;
  };
}

// Geriye dönük uyumluluk takma adı (type alias)
export type ScheduleGap = ScheduleGapItem;
export type ScheduleItemWithGap<T> = T | ScheduleGapItem;

export function isScheduleGap(item: any): item is ScheduleGapItem {
  return Boolean(item && typeof item === 'object' && item.isGap === true);
}

/**
 * Converts "HH:mm" time string to minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.trim().split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
}

/**
 * Converts minutes from midnight to "HH:mm"
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface MasterInterval {
  startMin: number;
  endMin: number;
  startTime: string; // "10:40"
  endTime: string;   // "11:20"
  type: 'lesson' | 'official_recess' | 'lunch';
  course?: {
    name: string;
    room: string;
    teacher?: string;
    icon?: string;
    color?: string;
    bgColor?: string;
    borderColor?: string;
  };
  nextCourse?: {
    name: string;
    startTime: string;
  };
}

/**
 * Okulun o günkü standart ders ve zil saatlerini (base curriculum)
 * kronolojik ardışık dilimler (dersler, teneffüsler ve öğle arası) halinde üretir.
 */
export function getMasterScheduleIntervals(
  dayIndex: number = 1,
  userRoles: string[] = []
): MasterInterval[] {
  const intervals: MasterInterval[] = [];

  // Cumartesi etüt çizelgesi
  if (dayIndex === 6) {
    for (let i = 0; i < OFFICIAL_SATURDAY_BELL_TIMES.length; i++) {
      const b = OFFICIAL_SATURDAY_BELL_TIMES[i];
      const startMin = timeToMinutes(b.startTime);
      const endMin = timeToMinutes(b.endTime);

      intervals.push({
        startMin,
        endMin,
        startTime: b.startTime,
        endTime: b.endTime,
        type: 'lesson',
        course: {
          name: `${b.periodNumber}. Etüt Dersi`,
          room: "Etüt Salonu",
          icon: "📚"
        }
      });

      // Teneffüs
      if (i < OFFICIAL_SATURDAY_BELL_TIMES.length - 1) {
        const nextB = OFFICIAL_SATURDAY_BELL_TIMES[i + 1];
        const recessStartMin = endMin;
        const recessEndMin = timeToMinutes(nextB.startTime);
        if (recessEndMin > recessStartMin) {
          intervals.push({
            startMin: recessStartMin,
            endMin: recessEndMin,
            startTime: b.endTime,
            endTime: nextB.startTime,
            type: 'official_recess',
            nextCourse: {
              name: `${nextB.periodNumber}. Etüt Dersi`,
              startTime: nextB.startTime
            }
          });
        }
      }
    }
    return intervals;
  }

  // Hafta içi standart çizelge
  const daySchedule: DaySchedule | undefined = WEEKLY_SCHEDULE.find((d) => d.dayIndex === dayIndex);
  if (!daySchedule || !daySchedule.periods || daySchedule.periods.length === 0) {
    return intervals;
  }

  const periods = [...daySchedule.periods].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const lunch = getLunchBreakForDay(dayIndex);
  const lunchStartMin = timeToMinutes(lunch.start);
  const lunchEndMin = timeToMinutes(lunch.end);

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
    const startMin = timeToMinutes(period.startTime);
    const endMin = timeToMinutes(period.endTime);

    const courseObj = {
      name: resolved.name || period.defaultName,
      room: period.roomOrNote || "Standart Derslik",
      icon: resolved.icon || "📚",
      color: resolved.color,
      bgColor: resolved.bgColor,
      borderColor: resolved.borderColor
    };

    // 1. Ders dilimi
    intervals.push({
      startMin,
      endMin,
      startTime: period.startTime,
      endTime: period.endTime,
      type: 'lesson',
      course: courseObj
    });

    // 2. Bir sonraki derse kadar olan mola / teneffüs dilimi
    if (i < periods.length - 1) {
      const nextPeriod = periods[i + 1];
      const nextResolved = resolveSubjectByRole(nextPeriod.subjectKey, userRoles);
      const recessStartMin = endMin;
      const recessEndMin = timeToMinutes(nextPeriod.startTime);

      if (recessEndMin > recessStartMin) {
        const diffMin = recessEndMin - recessStartMin;
        // Öğle arası kontrolü (35 dk ve üzeri, öğle penceresiyle kesişen)
        const isLunch =
          diffMin >= 35 &&
          ((recessStartMin >= lunchStartMin - 15 && recessStartMin < lunchEndMin) ||
           (recessEndMin > lunchStartMin && recessEndMin <= lunchEndMin + 15));

        intervals.push({
          startMin: recessStartMin,
          endMin: recessEndMin,
          startTime: period.endTime,
          endTime: nextPeriod.startTime,
          type: isLunch ? 'lunch' : 'official_recess',
          nextCourse: {
            name: nextResolved.name || nextPeriod.defaultName,
            startTime: nextPeriod.startTime
          }
        });
      }
    }
  }

  return intervals;
}

/**
 * Tespit edilen bir boşluk aralığını (gapStart - gapEnd)
 * okulun masterSchedule tablosuyla kesiştirerek mantıklı ve gerçekçi parçalara (slices) ayırır.
 */
export function sliceGapByMasterSchedule(
  gapStart: string,
  gapEnd: string,
  masterIntervals: MasterInterval[],
  gapIndex: number = 0,
  upcomingItem?: { startTime: string; title?: string; defaultName?: string; resolved?: any }
): ScheduleGapItem[] {
  const gapStartMin = timeToMinutes(gapStart);
  const gapEndMin = timeToMinutes(gapEnd);

  if (gapEndMin - gapStartMin < 5) return [];

  const slices: ScheduleGapItem[] = [];

  // Master intervals ile çakışan dilimleri bul
  const overlapping = masterIntervals.filter(
    (inter) => inter.endMin > gapStartMin && inter.startMin < gapEndMin
  );

  if (overlapping.length > 0) {
    overlapping.forEach((inter, subIdx) => {
      const sliceStartMin = Math.max(gapStartMin, inter.startMin);
      const sliceEndMin = Math.min(gapEndMin, inter.endMin);
      const sliceDuration = sliceEndMin - sliceStartMin;

      if (sliceDuration < 3) return; // 3 dakikadan kısa anlamsız ufak kalıntıları atla

      const startTimeStr = minutesToTime(sliceStartMin);
      const endTimeStr = minutesToTime(sliceEndMin);
      const id = `gap_${gapStart.replace(':', '')}_${gapEnd.replace(':', '')}_${gapIndex}_${subIdx}`;

      // DURUM A: Devam Eden Normal Dersin Kalan Süresi
      if (inter.type === 'lesson' && inter.course) {
        // Dersin bitişine kalan süre
        const remainingMinutes = inter.endMin - sliceStartMin;

        slices.push({
          id,
          isGap: true,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationMinutes: sliceDuration,
          type: 'partial_lesson',
          title: `📐 ${inter.course.name} (Son ${remainingMinutes} dk)`,
          subtitle: `Derslik: ${inter.course.room || '302'} — Sınavın erken bitti; sınıfta normal ders işleniyor olabilir (Bitiş: ${inter.endTime})`,
          originalCourse: inter.course,
          nextCourse: inter.nextCourse || (upcomingItem ? {
            name: upcomingItem.resolved?.name || upcomingItem.defaultName || upcomingItem.title || "Ders",
            startTime: upcomingItem.startTime
          } : undefined)
        });
      }
      // DURUM B: Teneffüs
      else if (inter.type === 'official_recess') {
        const nextCourseInfo = inter.nextCourse || (upcomingItem ? {
          name: upcomingItem.resolved?.name || upcomingItem.defaultName || upcomingItem.title || "Ders",
          startTime: upcomingItem.startTime
        } : undefined);

        slices.push({
          id,
          isGap: true,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationMinutes: sliceDuration,
          type: 'official_recess',
          title: `☕ Teneffüs (${sliceDuration} dk)`,
          subtitle: nextCourseInfo 
            ? `Sonraki Ders: ${nextCourseInfo.name} (${nextCourseInfo.startTime})`
            : `Ders arası dinlenme (${endTimeStr}'a kadar)`,
          nextCourse: nextCourseInfo
        });
      }
      // DURUM C: Resmi Öğle Arası & Yemekhane
      else if (inter.type === 'lunch') {
        const nextCourseInfo = inter.nextCourse || (upcomingItem ? {
          name: upcomingItem.resolved?.name || upcomingItem.defaultName || upcomingItem.title || "Ders",
          startTime: upcomingItem.startTime
        } : undefined);

        slices.push({
          id,
          isGap: true,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationMinutes: sliceDuration,
          type: 'lunch',
          title: "🍽️ Öğle Arası & Yemekhane",
          subtitle: nextCourseInfo 
            ? `Yemekhane servisi açık • Sonraki: ${nextCourseInfo.name} (${nextCourseInfo.startTime})`
            : `Yemekhane servisi ve öğle molası (${endTimeStr}'a kadar)`,
          nextCourse: nextCourseInfo
        });
      }
    });
  }

  // Eğer master schedule ile hiç çakışmadıysa (örneğin okul saatleri dışı veya tanımlanmamış blok)
  if (slices.length === 0) {
    const totalDuration = gapEndMin - gapStartMin;
    const isLunchHour = totalDuration >= 35 && gapStartMin >= 690 && gapEndMin <= 810;
    const id = `gap_fallback_${gapStart.replace(':', '')}_${gapEnd.replace(':', '')}_${gapIndex}`;

    slices.push({
      id,
      isGap: true,
      startTime: gapStart,
      endTime: gapEnd,
      durationMinutes: totalDuration,
      type: isLunchHour ? 'lunch' : 'official_recess',
      title: isLunchHour ? "🍽️ Öğle Arası & Yemekhane" : `☕ Teneffüs (${totalDuration} dk)`,
      subtitle: upcomingItem 
        ? `Sonraki Ders: ${upcomingItem.resolved?.name || upcomingItem.defaultName || upcomingItem.title || 'Ders'} (${upcomingItem.startTime})`
        : `Dersler arası mola süresi`
    });
  }

  return slices;
}

/**
 * Verilen sıralı etkinlik listesinde (items) her iki komşu eleman arasındaki
 * zaman farkını analiz eder. Eğer fark >= 5 dakika ise okulun master curriculum'uyla
 * kesiştirip araya parçalanmış ScheduleGapItem elemanlarını yerleştirir.
 */
export function insertScheduleGaps<T extends { startTime: string; endTime: string }>(
  items: T[],
  dayIndex: number = 1,
  userRoles: string[] = []
): ScheduleItemWithGap<T>[] {
  if (!items || items.length === 0) return [];

  const masterIntervals = getMasterScheduleIntervals(dayIndex, userRoles);
  const result: ScheduleItemWithGap<T>[] = [];

  for (let i = 0; i < items.length; i++) {
    result.push(items[i]);

    if (i < items.length - 1) {
      const currentItem = items[i];
      const nextItem = items[i + 1];

      const currentEndMin = timeToMinutes(currentItem.endTime);
      const nextStartMin = timeToMinutes(nextItem.startTime);

      const diffMinutes = nextStartMin - currentEndMin;

      // >= 5 dakika boşluk varsa master schedule ile dilimle
      if (diffMinutes >= 5) {
        const gapSlices = sliceGapByMasterSchedule(
          currentItem.endTime,
          nextItem.startTime,
          masterIntervals,
          i,
          nextItem as any
        );

        for (const slice of gapSlices) {
          result.push(slice);
        }
      }
    }
  }

  return result;
}

/**
 * Canlı Durum ve Bilgilendirme Metinleri:
 * Sayacın "Moladasınız" yerine tam ve pedagojik bilgi üretmesini sağlar.
 */
export function getGapLiveStatus(
  gap: ScheduleGapItem,
  isToday: boolean,
  now: Date
): {
  isActive: boolean;
  isPast: boolean;
  isNext: boolean;
  remainingMinutes: number;
  progressPercent: number;
  liveStatusText: string;
  countdownBadge: string;
} {
  if (!isToday) {
    return {
      isActive: false,
      isPast: false,
      isNext: false,
      remainingMinutes: 0,
      progressPercent: 0,
      liveStatusText: gap.title,
      countdownBadge: `${gap.durationMinutes} dk`
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(gap.startTime);
  const endMinutes = timeToMinutes(gap.endTime);

  if (currentMinutes < startMinutes) {
    const minUntil = startMinutes - currentMinutes;
    return {
      isActive: false,
      isPast: false,
      isNext: minUntil <= 15,
      remainingMinutes: 0,
      progressPercent: 0,
      liveStatusText: `${gap.title} (${minUntil} dk sonra)`,
      countdownBadge: `${gap.durationMinutes} dk`
    };
  }

  if (currentMinutes >= endMinutes) {
    return {
      isActive: false,
      isPast: true,
      isNext: false,
      remainingMinutes: 0,
      progressPercent: 100,
      liveStatusText: `${gap.title} (Bitti)`,
      countdownBadge: `Bitti`
    };
  }

  // Şu an bu dilimin içindeyiz
  const total = endMinutes - startMinutes;
  const elapsed = currentMinutes - startMinutes;
  const remainingMinutes = Math.max(0, endMinutes - currentMinutes);
  const progressPercent = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;

  // Canlı Bildirim Metinleri (Bölüm 4 gereksinimi)
  let liveStatusText = "";
  let countdownBadge = "";

  if (gap.type === 'partial_lesson') {
    const courseName = gap.originalCourse?.name || "Ders";
    liveStatusText = `Şu an ${courseName} dersinin son ${remainingMinutes} dakikası`;
    countdownBadge = `Dersin bitmesine ${remainingMinutes} dk kaldı`;
  } else if (gap.type === 'official_recess') {
    liveStatusText = `Şu an teneffüstesiniz (Ders ziline ${remainingMinutes} dk)`;
    countdownBadge = `Zile ${remainingMinutes} dk kaldı`;
  } else if (gap.type === 'lunch') {
    liveStatusText = `Şu an Öğle Arasındasınız (${remainingMinutes} dk kaldı)`;
    countdownBadge = `Öğle arası (${remainingMinutes} dk kaldı)`;
  } else {
    liveStatusText = `${gap.title} (${remainingMinutes} dk kaldı)`;
    countdownBadge = `${remainingMinutes} dk kaldı`;
  }

  return {
    isActive: true,
    isPast: false,
    isNext: false,
    remainingMinutes,
    progressPercent,
    liveStatusText,
    countdownBadge
  };
}
