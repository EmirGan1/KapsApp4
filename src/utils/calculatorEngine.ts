import { Subject, GradeBoundary } from '../types';
import { getComponentStructure } from '../data/gradeBoundaries';

export interface EvaluatedComponent {
  id: string; // 'p1', 'p2', 'ia', etc.
  name: string;
  maxScore: number;
  achievedScore: number;
  originalWeight: number; // e.g. 35
  normalizedWeight: number; // e.g. 50 (if re-weighted)
  isActive: boolean;
  isIA: boolean;
  scorePercentage: number; // (achieved / max) * 100
  weightedContribution: number; // (achieved / max) * normalizedWeight
}

export interface SubjectCalculationResult {
  id: string;
  percentage: number; // Final weighted percentage (0 - 100)
  grade: number; // 1 - 7
  totalActiveWeight: number; // Sum of original weights of active components (e.g. 80)
  totalOriginalWeight: number; // Usually 100
  isPartialEvaluation: boolean; // true if any component is inactive or totalActiveWeight < totalOriginalWeight
  activeComponentsCount: number;
  totalComponentsCount: number;
  components: EvaluatedComponent[];
  projections?: {
    low: number;
    avg: number;
    high: number;
    minIANeeded?: {
      targetGrade: number;
      targetMinPct: number;
      raw: number;
      isPossible: boolean;
    } | null;
  } | null;
}

/**
 * DİNAMİK AĞIRLIK NORMALİZASYONU (RE-WEIGHTING MOTORU):
 * 
 * 1. totalActiveWeight = Σ(aktif bileşenlerin orijinal ağırlıkları)
 * 2. Her aktif bileşen için:
 *    normalizedWeight = (originalWeight / totalActiveWeight) * 100
 * 3. Total Score (%) = Σ ( (userScore / maxScore) * normalizedWeight )
 * 
 * Eksik veya sıfır aktif bileşen durumunda Division by Zero hatasına karşı güvenli fallback (%0).
 */
export function calculateSubjectFinalPercentage(subject: Subject): SubjectCalculationResult {
  const evaluatedComponents: EvaluatedComponent[] = [];
  let totalOriginalWeight = 0;

  // 1. Collect and map Papers
  (subject.papers || []).forEach(p => {
    const origWeight = Number(p.weight) || 0;
    const maxScore = typeof p.maxScore === 'number' && p.maxScore > 0 ? p.maxScore : 1;
    const userScore = typeof p.achievedScore === 'number' ? Math.max(0, p.achievedScore) : 0;
    const isActive = p.isActive !== false;

    totalOriginalWeight += origWeight;
    evaluatedComponents.push({
      id: p.id,
      name: p.name,
      maxScore,
      achievedScore: userScore,
      originalWeight: origWeight,
      normalizedWeight: origWeight,
      isActive,
      isIA: false,
      scorePercentage: maxScore > 0 ? (userScore / maxScore) * 100 : 0,
      weightedContribution: 0
    });
  });

  // 2. Collect and map IA / Oral component
  if (subject.ia) {
    const origWeight = Number(subject.ia.weight) || 20;
    const maxScore = typeof subject.ia.maxScore === 'number' && subject.ia.maxScore > 0 ? subject.ia.maxScore : 24;
    const userScore = typeof subject.ia.achievedScore === 'number' ? Math.max(0, subject.ia.achievedScore) : 0;
    const isActive = subject.ia.isActive !== false;

    totalOriginalWeight += origWeight;
    evaluatedComponents.push({
      id: 'ia',
      name: subject.ia.name || 'Internal Assessment (IA)',
      maxScore,
      achievedScore: userScore,
      originalWeight: origWeight,
      normalizedWeight: origWeight,
      isActive,
      isIA: true,
      scorePercentage: maxScore > 0 ? (userScore / maxScore) * 100 : 0,
      weightedContribution: 0
    });
  }

  // 3. Filter active components and sum their weights
  const activeComponents = evaluatedComponents.filter(c => c.isActive);
  const totalActiveWeight = activeComponents.reduce((sum, c) => sum + c.originalWeight, 0);

  let finalPercentage = 0;

  // Division by zero protection: if totalActiveWeight <= 0, final percentage is 0
  if (totalActiveWeight > 0 && activeComponents.length > 0) {
    evaluatedComponents.forEach(comp => {
      if (comp.isActive) {
        // Scaled / Normalized Weight: (Original Weight / totalActiveWeight) * 100
        comp.normalizedWeight = (comp.originalWeight / totalActiveWeight) * 100;
        
        // Component contribution: (Alınan Puan / Max Puan) * normalizedWeight
        const contrib = (comp.achievedScore / comp.maxScore) * comp.normalizedWeight;
        comp.weightedContribution = contrib;
        finalPercentage += contrib;
      } else {
        comp.normalizedWeight = 0;
        comp.weightedContribution = 0;
      }
    });
  } else {
    evaluatedComponents.forEach(comp => {
      comp.normalizedWeight = 0;
      comp.weightedContribution = 0;
    });
    finalPercentage = 0;
  }

  // Round final score percentage to 1 decimal place
  const roundedPercentage = Math.round(finalPercentage * 10) / 10;

  // 4. Determine grade using strict null check (null !== 0)
  const validBoundaries = (subject.boundaries || []).filter(b => b.min !== null);
  const boundary = validBoundaries.find(b => roundedPercentage >= (b.min as number));
  const grade = boundary ? boundary.grade : 1;

  // 5. Partial evaluation status
  const isPartialEvaluation = evaluatedComponents.some(c => !c.isActive) || 
    (totalOriginalWeight > 0 && Math.abs(totalActiveWeight - totalOriginalWeight) > 0.01);

  // 6. Projections for IA if IA is active but user has "Henüz Belli Değil" (!sub.ia.enabled)
  let projections = null;
  const iaComp = evaluatedComponents.find(c => c.isIA);
  if (iaComp && iaComp.isActive && !subject.ia.enabled && activeComponents.length > 1) {
    const nonIAActiveWeight = activeComponents
      .filter(c => !c.isIA)
      .reduce((sum, c) => sum + c.originalWeight, 0);

    if (nonIAActiveWeight > 0) {
      let paperWeightedPart = 0;
      activeComponents.filter(c => !c.isIA).forEach(c => {
        paperWeightedPart += (c.achievedScore / c.maxScore) * c.originalWeight;
      });

      const iaOrigWeight = iaComp.originalWeight;
      const getGradeForPct = (pct: number) => {
        const b = validBoundaries.find(item => pct >= (item.min as number));
        return b ? b.grade : 1;
      };

      const lowTotal = paperWeightedPart + (0.35 * iaOrigWeight);
      const avgTotal = paperWeightedPart + (0.65 * iaOrigWeight);
      const highTotal = paperWeightedPart + (0.90 * iaOrigWeight);

      // Raw score needed for next boundary
      const nextBoundary = validBoundaries.slice().reverse().find(b => b.grade > grade && b.min !== null);
      let minIANeeded = null;

      if (nextBoundary && nextBoundary.min !== null && iaComp.maxScore > 0) {
        const targetTotal = nextBoundary.min as number;
        const neededIAContrib = targetTotal - paperWeightedPart;
        const requiredIAPct = (neededIAContrib / iaOrigWeight) * 100;
        const rawNeeded = Math.ceil((requiredIAPct / 100) * iaComp.maxScore);

        minIANeeded = {
          targetGrade: nextBoundary.grade,
          targetMinPct: targetTotal,
          raw: Math.max(0, Math.min(rawNeeded, iaComp.maxScore)),
          isPossible: rawNeeded <= iaComp.maxScore
        };
      }

      projections = {
        low: getGradeForPct(lowTotal),
        avg: getGradeForPct(avgTotal),
        high: getGradeForPct(highTotal),
        minIANeeded
      };
    }
  }

  return {
    id: subject.id,
    percentage: roundedPercentage,
    grade,
    totalActiveWeight,
    totalOriginalWeight: totalOriginalWeight || 100,
    isPartialEvaluation,
    activeComponentsCount: activeComponents.length,
    totalComponentsCount: evaluatedComponents.length,
    components: evaluatedComponents,
    projections
  };
}

/**
 * Restores all papers and IA to active state and ensures official curriculum components are loaded
 */
export function restoreSubjectDefaultComponents(subject: Subject): Subject {
  const subjectKey = subject.id.replace(/-(sl|hl)$/, '');
  const structures = getComponentStructure(subjectKey, subject.level) || [];

  const paperStructures = structures.filter(s => !s.isIA);
  const iaStructure = structures.find(s => s.isIA);

  // Map existing papers or restore missing ones
  const existingPaperMap = new Map((subject.papers || []).map(p => [p.id, p]));

  const restoredPapers = paperStructures.map(ps => {
    const existing = existingPaperMap.get(ps.id);
    return {
      id: ps.id,
      name: ps.name,
      maxScore: ps.maxMarks,
      achievedScore: existing ? existing.achievedScore : '',
      weight: ps.weight,
      isActive: true
    };
  });

  // Restore IA
  const restoredIA = {
    ...subject.ia,
    weight: iaStructure ? iaStructure.weight : (subject.ia.weight || 20),
    maxScore: iaStructure ? iaStructure.maxMarks : (subject.ia.maxScore || 24),
    isActive: true
  };

  return {
    ...subject,
    papers: restoredPapers,
    ia: restoredIA
  };
}
