export const UNIVERSITY_API = "/api/university-vault";
export const UNIVERSITY_SECTIONS: Record<string, string> = {
  cv: "CV ve özgeçmiş",
  certificates: "Sertifikalar",
  activities: "Etkinlikler ve projeler",
  education: "Diploma ve transkript",
  languages: "Dil belgeleri",
  letters: "Niyet ve referans mektupları",
  applications: "Üniversite başvuruları",
  identity: "Kimlik ve diğer resmî belgeler",
  other: "Diğer belgeler",
};
export const CV_FIELDS = {
  contact: "İletişim",
  profile: "Profil",
  education: "Eğitim",
  experience: "Deneyim ve gönüllülük",
  projects: "Projeler ve başarılar",
  skills: "Beceriler",
  languages: "Diller",
};
export const emptyUniversityData = () => ({
  title: "",
  category: "other",
  institution: "",
  date: "",
  deadline: "",
  status: "draft",
  language: "",
  tags: "",
  text: "",
  url: "",
  program: "",
  country: "",
  requirementIds: [] as string[],
  cv: Object.fromEntries(Object.keys(CV_FIELDS).map((k) => [k, ""])) as Record<
    string,
    string
  >,
});
export type UniversityData = ReturnType<typeof emptyUniversityData>;
export type UniversityItem = {
  id: string;
  parentId: string | null;
  kind: "folder" | "record";
  data: UniversityData;
  version: number;
  updatedAt: string;
  file: { name: string; size: number; hash: string } | null;
};
export const UNIVERSITY_STATUSES: Record<string, string> = {
  draft: "Taslak",
  preparing: "Hazırlanıyor",
  ready: "Hazır",
  submitted: "Gönderildi",
  accepted: "Kabul",
  rejected: "Ret",
};
