import { CEFR_META, studyLevels, type CefrLevel } from '../../shared/germanActivities';
import type { CurriculumCategoryNode, CurriculumUnitNode, OverviewResponse } from './types';

// Older API responses use level arrays and current/review/available status names.
// Normalize once at the boundary so display IDs also work in session filters.
export function normalizeOverview(data: OverviewResponse | any): OverviewResponse {
  const raw = data.curriculumHierarchy;
  const curriculumHierarchy = {} as Record<CefrLevel, CurriculumCategoryNode[]>;
  const status = (item: any): CurriculumUnitNode['status'] => {
    if (item.status === 'completed' || (item.totalWords > 0 && item.masteredWords >= item.totalWords)) return 'completed';
    if (item.status === 'in_progress' || item.learningWords > 0 || item.almostMasteredWords > 0 || item.mistakeWords > 0 || item.masteredWords > 0) return 'in_progress';
    return 'not_started';
  };
  for (const level of studyLevels) {
    const categories = Array.isArray(raw) ? raw.find(h => h.level === level)?.categories : raw?.[level];
    curriculumHierarchy[level] = (Array.isArray(categories) ? categories : []).map((cat: any) => {
      const id = cat.categoryId || String(cat.id).replace(new RegExp(`^${level}:`), '');
      const units = (Array.isArray(cat.units) ? cat.units : []).map((unit: any) => ({
        ...unit, categoryId: id, level, status: status(unit),
      }));
      return { ...cat, id, level, accentColor: cat.accentColor || CEFR_META[level].accent,
        totalUnits: cat.totalUnits ?? cat.unitCount ?? units.length,
        completedUnits: cat.completedUnits ?? units.filter((u: any) => u.status === 'completed').length,
        status: status(cat), units };
    });
  }
  return { ...data, curriculumHierarchy };
}
