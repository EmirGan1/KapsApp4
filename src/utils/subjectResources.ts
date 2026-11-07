export const SUBJECTS = ["Turkish", "Mathematics", "Physics", "Digital Society", "English", "Chemistry", "Biology", "TITC"];

export const SUBJECT_ROLE_GROUPS: Record<string, string> = {
  Turkish: "turkish",
  Mathematics: "math",
  Physics: "physics",
  "Digital Society": "digital_society",
  English: "english",
  Chemistry: "chemistry",
  Biology: "biology",
  TITC: "titc",
};

export const RESOURCE_PREVIEW_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
export const RESOURCE_FILE_LIMIT_MB = 50;

export const SUBJECT_IA_MAX: Record<string, number> = {
  Turkish: 40, // Language A individual oral
  Mathematics: 20,
  Physics: 24,
  "Digital Society": 24,
  English: 30, // Language B individual oral
  Chemistry: 24,
  Biology: 24,
  TITC: 50, // Editable default for the school-based syllabus
};

export function readIaScoreName(name: string) {
  const match = name.match(/(?:^|\s)(\d{1,3})[_/](\d{1,3})(?=\s|$)/);
  if (!match) return null;
  const points = Number(match[1]);
  const maximum = Number(match[2]);
  return maximum > 0 && points <= maximum ? { points, maximum } : null;
}
