export const TRAVEL_PATH = "/gezi-planlama";
export const TRAVEL_API = "/api/private-travel";
export const ENTRY_KINDS = [
  "place",
  "task",
  "expense",
  "booking",
  "note",
  "decision",
  "comment",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export type TripData = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  currency: string;
  budget: number;
  description: string;
  archived: boolean;
  timezone: string;
  interests: string;
};
export type EntryData = {
  title: string;
  category: string;
  tags: string;
  text: string;
  url: string;
  date: string;
  time: string;
  duration: number;
  order: number;
  done: boolean;
  priority: number;
  favorite: boolean;
  must: string;
  address: string;
  area: string;
  lat: number | null;
  lng: number | null;
  estimated: number;
  actual: number | null;
  assignee: number | null;
  reference: string;
  endDate: string;
  status: string;
  options: string[];
  parentId: string;
};
export type Versioned<T> = {
  id: string;
  version: number;
  data: T;
  updatedAt: string;
  updatedBy: number;
  createdBy: number;
};
export type TravelTrip = Versioned<TripData> & {
  revision: number;
  summary?: {
    places: number;
    visited: number;
    planned: number;
    tasks: number;
    taskDone: number;
  };
};
export type TravelEntry = Versioned<EntryData> & {
  tripId: string;
  kind: EntryKind;
};
export type TravelMember = { id: number; name: string };
export type TravelVote = { entryId: string; userId: number; choice: string };
export type TravelChange = {
  id: number;
  name: string;
  actor: number;
  action: string;
  at: string;
};
export type TripSnapshot = {
  trip: TravelTrip;
  entries: TravelEntry[];
  votes: TravelVote[];
  changes: TravelChange[];
};
export const emptyTrip = (): TripData => ({
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
  currency: "EUR",
  budget: 0,
  description: "",
  archived: false,
  timezone: "Europe/Budapest",
  interests: "",
});
export const emptyEntry = (): EntryData => ({
  title: "",
  category: "",
  tags: "",
  text: "",
  url: "",
  date: "",
  time: "",
  duration: 60,
  order: 0,
  done: false,
  priority: 1,
  favorite: false,
  must: "",
  address: "",
  area: "",
  lat: null,
  lng: null,
  estimated: 0,
  actual: null,
  assignee: null,
  reference: "",
  endDate: "",
  status: "idea",
  options: [],
  parentId: "",
});
export const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const tripDay = (date: string) =>
  date
    ? new Date(date + "T12:00:00Z").toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
      })
    : "Tarih belirlenmedi";
export function dayKeys(start: string, end: string) {
  if (!start || !end) return [];
  const days: string[] = [];
  for (
    let t = Date.parse(start + "T12:00:00Z");
    t <= Date.parse(end + "T12:00:00Z") && days.length < 366;
    t += 86400000
  ) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}
export function distanceKm(a: EntryData, b: EntryData) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null)
    return null;
  const rad = Math.PI / 180;
  const value =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
export const bySchedule = (a: TravelEntry, b: TravelEntry) =>
  a.data.date.localeCompare(b.data.date) ||
  a.data.time.localeCompare(b.data.time) ||
  a.data.order - b.data.order ||
  a.id.localeCompare(b.id);
export function tripStats(entries: TravelEntry[]) {
  const places = entries.filter((e) => e.kind === "place");
  const tasks = entries.filter((e) => e.kind === "task");
  const expenses = entries.filter((e) => e.kind === "expense");
  const planned = places.filter((e) => e.data.date);
  const taskDone = tasks.filter((e) => e.data.done).length;
  const visited = places.filter((e) => e.data.done).length;
  return {
    places,
    tasks,
    expenses,
    planned,
    visited,
    taskDone,
    complete:
      places.length + tasks.length
        ? Math.round(
            ((planned.length + taskDone) / (places.length + tasks.length)) *
              100,
          )
        : 0,
    estimated: expenses.reduce((total, e) => total + e.data.estimated, 0),
    actual: expenses.reduce((total, e) => total + (e.data.actual ?? 0), 0),
    outstanding: tasks.filter((e) => !e.data.done).sort(bySchedule),
  };
}
