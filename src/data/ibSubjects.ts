import { Subject, GradeBoundary } from '../types';
import { 
  getFinalBoundaries, 
  getComponentStructure, 
  getHistoricalAverage 
} from './gradeBoundaries';

/**
 * Helper to build a Subject object from defined gradeBoundaries data
 */
export function createSubjectFromData(
  id: string,
  subjectKey: string,
  name: string,
  level: 'SL' | 'HL',
  defaultSession: 'M26' | 'M25' = 'M26',
  defaultTimezone: any = 'TZ1'
): Subject {
  const boundaryData = getFinalBoundaries(subjectKey, level, defaultSession, defaultTimezone) || 
                       getFinalBoundaries(subjectKey, level);
  const structures = getComponentStructure(subjectKey, level) || [];
  const historical = getHistoricalAverage(subjectKey, level);

  const boundaries: GradeBoundary[] = [];
  if (boundaryData) {
    for (let g = 7; g >= 1; g--) {
      const minVal = boundaryData.boundaries[g as keyof typeof boundaryData.boundaries];
      boundaries.push({
        grade: g,
        min: minVal !== undefined ? minVal : null
      });
    }
  } else {
    // Fallback boundaries
    boundaries.push(
      { grade: 7, min: 75 },
      { grade: 6, min: 65 },
      { grade: 5, min: 50 },
      { grade: 4, min: 40 },
      { grade: 3, min: 25 },
      { grade: 2, min: 12 },
      { grade: 1, min: 0 }
    );
  }

  const paperStructures = structures.filter(s => !s.isIA);
  const iaStructure = structures.find(s => s.isIA);

  // Terminology determination for Oral / IA
  let officialIAName = 'Internal Assessment (IA)';
  if (id.includes('turkish')) {
    officialIAName = 'Bireysel Sözlü (Individual Oral)';
  } else if (id.includes('english')) {
    officialIAName = 'Individual Oral';
  } else if (id.includes('digital-society')) {
    officialIAName = 'Inquiry Project (IA)';
  } else if (iaStructure?.name) {
    officialIAName = iaStructure.name;
  }

  return {
    id,
    name,
    level,
    session: boundaryData?.session || defaultSession,
    timezone: boundaryData?.timezone || defaultTimezone,
    source: boundaryData?.source || 'Provisional',
    historicalAverages: historical || null,
    boundaries,
    papers: paperStructures.map(p => ({
      id: p.id,
      name: p.name,
      maxScore: p.maxMarks,
      achievedScore: '',
      weight: p.weight
    })),
    ia: {
      name: officialIAName,
      maxScore: iaStructure ? iaStructure.maxMarks : 24,
      achievedScore: '',
      weight: iaStructure ? iaStructure.weight : 20,
      enabled: false
    }
  };
}

/**
 * Standard 6 subjects for typical Turkish IB Diploma candidate
 */
export const initialIBSubjects: Subject[] = [
  createSubjectFromData('turkish-a-lit-sl', 'turkish-a-lit', 'Turkish A Literature SL', 'SL', 'M25', 'unconfirmed'),
  createSubjectFromData('english-b-hl', 'english-b', 'English B HL', 'HL', 'M26', 'TZ1'),
  createSubjectFromData('titc-sl', 'titc', 'Turkey in the 20th Century SL', 'SL', 'M25', 'unconfirmed'),
  createSubjectFromData('math-aa-hl', 'math-aa', 'Math AA HL', 'HL', 'M25', 'unconfirmed'),
  createSubjectFromData('physics-sl', 'physics', 'Physics SL (New Syllabus 2025+)', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('digital-society-hl', 'digital-society', 'Digital Society HL', 'HL', 'M26', 'TZ1')
];

/**
 * All 16 subjects documented in IB_Grade_Boundaries_Updated_Clastify_Check_2026
 */
export const ALL_IB_SUBJECTS_CATALOG: Subject[] = [
  createSubjectFromData('turkish-a-lit-sl', 'turkish-a-lit', 'Turkish A Literature SL', 'SL', 'M25', 'unconfirmed'),
  createSubjectFromData('turkish-a-lit-hl', 'turkish-a-lit', 'Turkish A Literature HL', 'HL', 'M25', 'unconfirmed'),
  createSubjectFromData('english-b-hl', 'english-b', 'English B HL', 'HL', 'M26', 'TZ1'),
  createSubjectFromData('titc-sl', 'titc', 'Turkey in the 20th Century SL', 'SL', 'M25', 'unconfirmed'),
  createSubjectFromData('math-aa-sl', 'math-aa', 'Math AA SL', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('math-aa-hl', 'math-aa', 'Math AA HL', 'HL', 'M25', 'unconfirmed'),
  createSubjectFromData('physics-sl', 'physics', 'Physics SL', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('physics-hl', 'physics', 'Physics HL', 'HL', 'M25', 'TZ1'),
  createSubjectFromData('chemistry-sl', 'chemistry', 'Chemistry SL', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('chemistry-hl', 'chemistry', 'Chemistry HL', 'HL', 'M26', 'TZ1'),
  createSubjectFromData('biology-sl', 'biology', 'Biology SL', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('biology-hl', 'biology', 'Biology HL', 'HL', 'M26', 'TZ1'),
  createSubjectFromData('digital-society-sl', 'digital-society', 'Digital Society SL', 'SL', 'M25', 'unspecified'),
  createSubjectFromData('digital-society-hl', 'digital-society', 'Digital Society HL', 'HL', 'M26', 'TZ1'),
  createSubjectFromData('psychology-sl', 'psychology', 'Psychology SL', 'SL', 'M26', 'TZ1'),
  createSubjectFromData('psychology-hl', 'psychology', 'Psychology HL', 'HL', 'M26', 'TZ1')
];

/**
 * Map user profile roles to matching IB subjects
 */
export function matchRolesToIBSubjects(userRoles: string[]): Subject[] {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return initialIBSubjects;
  }

  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const matchedSubjects: Subject[] = [];
  const addedSubjectKeys = new Set<string>();

  const roleKeywordsMapping: Array<{
    keywords: string[];
    defaultId: string;
    hlId?: string;
    slId?: string;
  }> = [
    {
      keywords: ['turkish a', 'türkçe a', 'turkish lit', 'edebiyat', 'turkish'],
      defaultId: 'turkish-a-lit-sl',
      hlId: 'turkish-a-lit-hl',
      slId: 'turkish-a-lit-sl'
    },
    {
      keywords: ['english b', 'ingilizce b', 'english'],
      defaultId: 'english-b-hl',
      hlId: 'english-b-hl',
      slId: 'english-b-hl'
    },
    {
      keywords: ['math aa', 'matematik aa', 'mathematics aa', 'matematik', 'math'],
      defaultId: 'math-aa-hl',
      hlId: 'math-aa-hl',
      slId: 'math-aa-sl'
    },
    {
      keywords: ['physics', 'fizik'],
      defaultId: 'physics-sl',
      hlId: 'physics-hl',
      slId: 'physics-sl'
    },
    {
      keywords: ['chemistry', 'kimya'],
      defaultId: 'chemistry-sl',
      hlId: 'chemistry-hl',
      slId: 'chemistry-sl'
    },
    {
      keywords: ['biology', 'biyoloji'],
      defaultId: 'biology-sl',
      hlId: 'biology-hl',
      slId: 'biology-sl'
    },
    {
      keywords: ['digital society', 'dijital toplum', 'ds'],
      defaultId: 'digital-society-hl',
      hlId: 'digital-society-hl',
      slId: 'digital-society-sl'
    },
    {
      keywords: ['psychology', 'psikoloji'],
      defaultId: 'psychology-hl',
      hlId: 'psychology-hl',
      slId: 'psychology-sl'
    },
    {
      keywords: ['titc', 'turkey in the 20th', 'türkiye cumhuriyeti inkılap', 'inkılap'],
      defaultId: 'titc-sl',
      slId: 'titc-sl'
    }
  ];

  for (const role of normalizedRoles) {
    for (const mapping of roleKeywordsMapping) {
      const isMatch = mapping.keywords.some(kw => role.includes(kw));
      if (isMatch) {
        let chosenId = mapping.defaultId;
        const isHL = role.includes('hl') || role.includes('yüksek');
        const isSL = role.includes('sl') || role.includes('standart');

        if (isHL && mapping.hlId) {
          chosenId = mapping.hlId;
        } else if (isSL && mapping.slId) {
          chosenId = mapping.slId;
        }

        const baseGroup = chosenId.replace(/-(hl|sl)$/, '');
        if (!addedSubjectKeys.has(baseGroup)) {
          const catalogItem = ALL_IB_SUBJECTS_CATALOG.find(s => s.id === chosenId);
          if (catalogItem) {
            matchedSubjects.push(JSON.parse(JSON.stringify(catalogItem)));
            addedSubjectKeys.add(baseGroup);
          }
        }
      }
    }
  }

  // If at least one course matched from user roles:
  if (matchedSubjects.length > 0) {
    // If fewer than 6, fill up from initialIBSubjects to give a complete 6-course diploma package
    if (matchedSubjects.length < 6) {
      for (const defSub of initialIBSubjects) {
        const baseGroup = defSub.id.replace(/-(hl|sl)$/, '');
        if (!addedSubjectKeys.has(baseGroup) && matchedSubjects.length < 6) {
          matchedSubjects.push(JSON.parse(JSON.stringify(defSub)));
          addedSubjectKeys.add(baseGroup);
        }
      }
    }
    return matchedSubjects;
  }

  return initialIBSubjects;
}

/**
 * Switch a subject's level between SL and HL
 */
export function switchSubjectLevel(subject: Subject, targetLevel: 'SL' | 'HL'): Subject {
  const baseKey = subject.id.replace(/-(sl|hl)$/, '');
  const targetId = `${baseKey}-${targetLevel.toLowerCase()}`;

  const catalogItem = ALL_IB_SUBJECTS_CATALOG.find(s => s.id === targetId);
  if (catalogItem) {
    // Preserve any existing paper achievements where ids match
    const newSubject = JSON.parse(JSON.stringify(catalogItem)) as Subject;
    newSubject.papers = newSubject.papers.map(np => {
      const existing = subject.papers.find(ep => ep.id === np.id);
      if (existing) {
        return {
          ...np,
          achievedScore: existing.achievedScore
        };
      }
      return np;
    });

    if (subject.ia) {
      newSubject.ia.achievedScore = subject.ia.achievedScore;
      newSubject.ia.enabled = subject.ia.enabled;
    }

    return newSubject;
  }

  return subject;
}
