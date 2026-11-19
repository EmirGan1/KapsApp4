import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  MapPin,
  CalendarDays,
  Wallet,
  Check,
  CheckCheck,
  CheckSquare,
  Compass,
  Bookmark,
  MessageCircle,
  Vote,
  Heart,
  MoreHorizontal,
  X,
  Search,
  Loader2,
  ExternalLink,
  Clock,
  Luggage,
  RefreshCw,
  Download,
  SlidersHorizontal,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Route,
  Landmark,
} from "lucide-react";
import type {
  EntryData,
  EntryKind,
  TravelEntry,
  TravelTrip,
  TripData,
  TripSnapshot,
  TravelMember,
} from "../../shared/travel";
import {
  TRAVEL_PATH,
  emptyEntry,
  money,
  tripDay,
  dayKeys,
  bySchedule,
  distanceKm,
  tripStats,
} from "../../shared/travel";
import { rankedRecommendations } from "../../shared/travelRecommendations";
import { Dialog, TripForm, EntryForm, KIND_LABELS } from "./TravelForms";
import { travelRequest, useTravel } from "./useTravel";
import "./travel.css";
const TravelMap = lazy(() => import("./TravelMap"));
const sections = [
  { id: "overview", label: "Genel bakış", icon: Compass },
  { id: "places", label: "Yerler & deneyimler", icon: MapPin },
  { id: "itinerary", label: "Günlük program", icon: CalendarDays },
  { id: "map", label: "Harita & rotalar", icon: Route },
  { id: "budget", label: "Bütçe", icon: Wallet },
  { id: "checklists", label: "Hazırlık & bavul", icon: Luggage },
  { id: "bookings", label: "Rezervasyonlar", icon: Bookmark },
  { id: "together", label: "Notlar & kararlar", icon: MessageCircle },
  { id: "discover", label: "Keşfet", icon: Landmark },
];
type Editor = {
  kind: EntryKind;
  entry?: TravelEntry;
  initial?: Partial<EntryData>;
};
const percent = (a: number, b: number) =>
  b ? Math.min(100, Math.round((a / b) * 100)) : 0;
const isBudapest = (destination: string) =>
  /budape[sş]t|budapest/i.test(destination);
function Empty({
  title,
  text,
  onAdd,
}: {
  title: string;
  text: string;
  onAdd?: () => void;
}) {
  return (
    <div className="t-empty">
      <Compass size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onAdd && (
        <button className="t-button t-primary" onClick={onAdd}>
          <Plus size={16} /> İlk kaydı ekle
        </button>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="t-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="t-section-heading">
      <div>
        {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
function SafeLink({
  url,
  label = "Kaynağı aç",
}: {
  url: string;
  label?: string;
}) {
  return /^https?:\/\//i.test(url) ? (
    <a
      className="t-external"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink size={14} />
      {label}
    </a>
  ) : null;
}
export default function TravelPlanner() {
  const location = useLocation(),
    navigate = useNavigate();
  const parts = location.pathname
    .slice(TRAVEL_PATH.length)
    .split("/")
    .filter(Boolean);
  const tripId = parts[0];
  const section = sections.some((s) => s.id === parts[1])
    ? parts[1]
    : "overview";
  const travel = useTravel(tripId);
  const { snapshot, access, trips } = travel;
  const [editor, setEditor] = useState<Editor | null>(null),
    [tripEditor, setTripEditor] = useState<TravelTrip | "new" | null>(null);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("priority");
  const [day, setDay] = useState(""),
    [showArchive, setShowArchive] = useState(false);
  const [detail, setDetail] = useState<TravelEntry | null>(null);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const openEditor = useCallback((entry: TravelEntry) => {
    setDetail(null);
    setEditor({ kind: entry.kind, entry });
  }, []);
  const add = (kind: EntryKind, initial?: Partial<EntryData>) => {
    setDraftId(crypto.randomUUID());
    setEditor({ kind, initial });
  };
  const go = (id: string) => {
    setQuery("");
    setFilter("all");
    navigate(TRAVEL_PATH + "/" + tripId + "/" + id);
  };
  const action = async (body: unknown) => {
    setBusy(true);
    setActionError("");
    try {
      await travel.mutate(body);
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const update = (entry: TravelEntry, changes: Partial<EntryData>) =>
    action({
      operation: "update",
      id: entry.id,
      version: entry.version,
      data: { ...entry.data, ...changes },
    });
  const deleteEntry = async (entry: TravelEntry) => {
    if (
      window.confirm(
        "“" + entry.data.title + "” ve bağlı yorumları silinsin mi?",
      )
    ) {
      if (
        await action({
          operation: "delete",
          id: entry.id,
          version: entry.version,
        })
      ) {
        setDetail(null);
        setEditor(null);
      }
    }
  };
  const saveEntry = async (data: EntryData) => {
    if (!editor) return;
    await travel.mutate({
      operation: editor.entry ? "update" : "create",
      id: editor.entry?.id ?? draftId,
      version: editor.entry?.version,
      kind: editor.kind,
      data,
    });
    setEditor(null);
  };
  const saveTrip = async (data: TripData) => {
    if (tripEditor && tripEditor !== "new")
      await travel.mutate({
        operation: "trip",
        version: tripEditor.version,
        data,
      });
    else {
      const result = await travelRequest<{ trip: TravelTrip }>("/trips", {
        id: draftId,
        data,
      });
      navigate(TRAVEL_PATH + "/" + result.trip.id + "/overview");
    }
    setTripEditor(null);
  };
  const stats = useMemo(() => tripStats(snapshot?.entries ?? []), [snapshot]);
  useEffect(() => {
    setDetail((previous) =>
      previous
        ? (snapshot?.entries.find((e) => e.id === previous.id) ?? null)
        : null,
    );
  }, [snapshot]);
  if (travel.denied)
    return (
      <div className="travel t-access">
        <AlertCircle size={30} />
        <h1>Bu alan özeldir</h1>
        <p role="alert">{travel.denied}</p>
        <Link to="/sohbetler" className="t-button">
          Sohbetlere dön
        </Link>
      </div>
    );
  if (!access)
    return (
      <div className="travel t-access">
        <Loader2 className="t-spin" size={26} />
        <p role="status">Erişim doğrulanıyor…</p>
      </div>
    );
  const entries = snapshot?.entries ?? [],
    data = snapshot?.trip.data;
  const filteredTrips = trips.filter(
    (t) =>
      t.data.archived === showArchive &&
      (t.data.name + t.data.destination)
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const memberName = (id: number) =>
    access.members.find((m) => m.id === id)?.name ?? "Gezgin";
  const placeCards = entries
    .filter((e) => e.kind === "place")
    .filter((e) => {
      const needle = query.toLocaleLowerCase("tr");
      return (
        (!needle ||
          [e.data.title, e.data.area, e.data.category, e.data.tags, e.data.text]
            .join(" ")
            .toLocaleLowerCase("tr")
            .includes(needle)) &&
        (filter === "all" ||
          (filter === "favorite" && e.data.favorite) ||
          (filter === "visit" && e.data.must === "visit") ||
          (filter === "do" && e.data.must === "do") ||
          (filter === "visited" && e.data.done) ||
          (filter === "saved" && !e.data.date) ||
          (filter === "food" &&
            /yeme|içme|restoran|kafe|café/i.test(e.data.category)) ||
          filter === e.data.category)
      );
    })
    .sort((a, b) =>
      sort === "cost"
        ? a.data.estimated - b.data.estimated
        : sort === "name"
          ? a.data.title.localeCompare(b.data.title, "tr")
          : b.data.priority - a.data.priority || bySchedule(a, b),
    );
  const dates = [
    ...new Set([
      ...dayKeys(data?.startDate ?? "", data?.endDate ?? ""),
      ...stats.planned.map((e) => e.data.date),
    ]),
  ].sort();
  const selectedDay = dates.includes(day) ? day : (dates[0] ?? "");
  const dayPlaces = stats.planned
    .filter((e) => e.data.date === selectedDay)
    .sort(bySchedule);
  const lastMapped = [...dayPlaces].reverse().find((p) => p.data.lat !== null);
  const nearby = lastMapped
    ? stats.places
        .filter((p) => !p.data.date && p.data.lat !== null)
        .map((p) => ({ place: p, km: distanceKm(lastMapped.data, p.data)! }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
    : [];
  const nowLocal = data
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: data.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date())
    : "";
  const upcoming = stats.planned
    .filter((e) => !e.data.done && e.data.date >= nowLocal)
    .sort(bySchedule);
  const reminders = stats.outstanding.filter(
    (e) => e.data.date && e.data.date <= nowLocal,
  );
  const headerAction = (
    kind: EntryKind,
    title = "Yeni ekle",
    initial?: Partial<EntryData>,
  ) => (
    <button
      className="t-button t-primary"
      disabled={busy}
      onClick={() => add(kind, initial)}
    >
      <Plus size={16} /> {title}
    </button>
  );
  const renderPlace = (entry: TravelEntry) => (
    <div className="t-place-card t-panel" key={entry.id}>
      <div className="t-place-top">
        <span className="t-category">
          {entry.data.category || "Keşif"}
          {entry.data.must &&
            " · " + (entry.data.must === "visit" ? "Must Visit" : "Must Do")}
        </span>
        <button
          className={"travel-icon " + (entry.data.favorite ? "t-favorite" : "")}
          aria-label={entry.data.title + " favori"}
          aria-pressed={entry.data.favorite}
          disabled={busy}
          onClick={() => void update(entry, { favorite: !entry.data.favorite })}
        >
          <Heart
            size={18}
            fill={entry.data.favorite ? "currentColor" : "none"}
          />
        </button>
      </div>
      <button className="t-place-title" onClick={() => setDetail(entry)}>
        <h3>{entry.data.title}</h3>
      </button>
      <p className="t-location">
        <MapPin size={13} />{" "}
        {entry.data.area || entry.data.address || "Konum eklenmedi"}
      </p>
      {entry.data.text && <p className="t-clamp">{entry.data.text}</p>}
      <div className="t-place-meta">
        <span>
          <Clock size={13} /> {entry.data.duration} dk
        </span>
        <span>
          {entry.data.estimated
            ? money(entry.data.estimated, data!.currency)
            : "Maliyet belirlenmedi"}
        </span>
      </div>
      <div className="t-place-bottom">
        <span>
          {entry.data.date ? tripDay(entry.data.date) : "Kaydedilenler"}
          {entry.data.time && " · " + entry.data.time}
        </span>
        <button
          className={"t-small-button " + (entry.data.done ? "is-done" : "")}
          disabled={busy}
          onClick={() => void update(entry, { done: !entry.data.done })}
        >
          <Check size={14} />
          {entry.data.done ? "Ziyaret edildi" : "Ziyaret ettik"}
        </button>
      </div>
    </div>
  );
  function exportCalendar() {
    if (!data) return;
    const escape = (s: string) =>
      s
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const dateTime = (date: string, time: string) =>
      date.replaceAll("-", "") + "T" + time.replace(":", "") + "00";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//KapsApp//Travel//TR",
      "CALSCALE:GREGORIAN",
    ];
    for (const p of stats.planned) {
      if (!p.data.time) continue;
      // UTC arithmetic keeps the event duration independent from the device timezone.
      const end = new Date(p.data.date + "T" + p.data.time + ":00Z");
      end.setUTCMinutes(end.getUTCMinutes() + p.data.duration);
      lines.push(
        "BEGIN:VEVENT",
        "UID:" + p.id + "@kapsapp",
        "DTSTAMP:" +
          new Date().toISOString().replace(/[-:]/g, "").split(".")[0] +
          "Z",
        "DTSTART;TZID=" +
          data.timezone +
          ":" +
          dateTime(p.data.date, p.data.time),
        "DTEND;TZID=" +
          data.timezone +
          ":" +
          end.toISOString().replace(/[-:]/g, "").split(".")[0],
        "SUMMARY:" + escape(p.data.title),
        "LOCATION:" + escape(p.data.address),
        "DESCRIPTION:" + escape(p.data.text),
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    const url = URL.createObjectURL(
      new Blob([lines.join("\r\n") + "\r\n"], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gezi-programi.ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="travel" data-travel-root>
      <div className="t-scroll">
        <header className="t-topbar">
          <Link className="t-back" to={tripId ? TRAVEL_PATH : "/sohbetler"}>
            <ArrowLeft size={16} />
            {tripId ? "Tüm geziler" : "Sohbetlere dön"}
          </Link>
          <span className="t-wordmark">
            KapsApp <span>journeys</span>
          </span>
          <div className="t-people" aria-label="Dido ve Emirgan">
            <span>D</span>
            <span>E</span>
          </div>
        </header>
        {travel.error && (
          <div role="alert" className="t-banner t-error">
            {travel.error}
            <button
              className="t-text-button"
              onClick={() => void travel.refresh(true)}
            >
              Tekrar dene
            </button>
          </div>
        )}
        {actionError && (
          <div role="alert" className="t-banner t-error">
            {actionError}
            <button
              aria-label="Hata mesajını kapat"
              className="travel-icon"
              onClick={() => setActionError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!tripId ? (
          <>
            <section className="t-landing-hero">
              <div>
                <p className="t-eyebrow">Dido & Emirgan</p>
                <h1>
                  Birlikte gideceğimiz
                  <br />
                  <em>daha çok yer var.</em>
                </h1>
                <p>
                  Fikirlerden ilk adıma. Yeni rotalarımız, küçük keşiflerimiz ve
                  tüm ayrıntılarımız burada.
                </p>
                <button
                  className="t-button t-primary"
                  onClick={() => {
                    setDraftId(crypto.randomUUID());
                    setTripEditor("new");
                  }}
                >
                  <Plus size={17} /> Yeni Gezi Planı Oluştur
                </button>
              </div>
              <div className="t-landing-photo">
                <img
                  src="/travel/budapest.jpg"
                  alt="Tuna kıyısında Budapeşte Parlamento Binası"
                />
                <span>Budapeşte · Macaristan</span>
              </div>
            </section>
            <main className="t-content">
              <SectionHeading
                eyebrow="Ortak koleksiyonumuz"
                title="Yeni bir hikâyeye doğru"
                action={
                  <label className="t-check">
                    <input
                      type="checkbox"
                      checked={showArchive}
                      onChange={(e) => setShowArchive(e.target.checked)}
                    />{" "}
                    Arşiv
                  </label>
                }
              />
              <label className="t-search">
                <Search size={17} />
                <input
                  aria-label="Gezilerde ara"
                  placeholder="Bir gezi veya şehir bul…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="t-trip-grid">
                {filteredTrips.map((t) => (
                  <Link
                    key={t.id}
                    to={TRAVEL_PATH + "/" + t.id + "/overview"}
                    className="t-trip-card"
                  >
                    <div
                      className={
                        "t-trip-cover " +
                        (isBudapest(t.data.destination) ? "t-budapest" : "")
                      }
                    >
                      {isBudapest(t.data.destination) && (
                        <img src="/travel/budapest.jpg" alt="" />
                      )}
                      <span>
                        <MapPin size={14} />
                        {t.data.destination || "Yeni bir rota"}
                      </span>
                      <ArrowUpRight size={22} />
                    </div>
                    <div className="t-trip-card-body">
                      <p className="t-eyebrow">
                        {t.data.startDate
                          ? tripDay(t.data.startDate) +
                            " — " +
                            tripDay(t.data.endDate)
                          : "Tarihleri birlikte seçelim"}
                      </p>
                      <h3>{t.data.name}</h3>
                      <p>
                        {t.data.description ||
                          "Bu hikâyeyi birlikte planlayın."}
                      </p>
                      {t.summary && (
                        <>
                          <p className="t-hint">
                            {t.summary.places} yer · {t.summary.visited} ziyaret
                            ·{" "}
                            {percent(
                              t.summary.planned + t.summary.taskDone,
                              t.summary.places + t.summary.tasks,
                            )}
                            % plan hazır
                          </p>
                          <div className="t-progress">
                            <i
                              style={{
                                width:
                                  percent(
                                    t.summary.planned + t.summary.taskDone,
                                    t.summary.places + t.summary.tasks,
                                  ) + "%",
                              }}
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <span>
                          {t.data.budget
                            ? money(t.data.budget, t.data.currency) + " bütçe"
                            : "Bütçe belirlenmedi"}
                        </span>
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {!filteredTrips.length && (
                <Empty
                  title={
                    query
                      ? "Aramanıza uyan gezi bulunamadı"
                      : showArchive
                        ? "Arşiv henüz boş"
                        : "İlk rotamız bizi bekliyor"
                  }
                  text={
                    query
                      ? "Gezi adını veya şehir aramasını değiştirebilirsiniz."
                      : "Geziye bir ad verin; tüm planlarınız ikinize de açık olsun."
                  }
                />
              )}
            </main>
          </>
        ) : !snapshot ? (
          <div className="t-access">
            {!travel.error && <Loader2 className="t-spin" size={24} />}
            <p role="status">Gezi yükleniyor…</p>
          </div>
        ) : (
          <>
            <section
              className={
                "t-trip-hero " +
                (isBudapest(data!.destination) ? "has-photo" : "")
              }
            >
              {isBudapest(data!.destination) && (
                <img
                  src="/travel/budapest.jpg"
                  alt=""
                  className="t-hero-image"
                />
              )}
              <div className="t-hero-copy">
                <p className="t-eyebrow">
                  <MapPin size={13} />
                  {data!.destination || "Yeni bir keşif"}
                </p>
                <h1>{data!.name}</h1>
                <div className="t-hero-details">
                  <span>
                    <CalendarDays size={15} />{" "}
                    {data!.startDate
                      ? tripDay(data!.startDate) +
                        " — " +
                        tripDay(data!.endDate)
                      : "Tarihler henüz açık"}
                  </span>
                  <span>Dido & Emirgan</span>
                </div>
              </div>
              <button
                className="t-button t-glass"
                onClick={() => setTripEditor(snapshot.trip)}
              >
                <SlidersHorizontal size={16} /> Gezi ayarları
              </button>
            </section>
            <nav className="t-nav" aria-label="Gezi bölümleri">
              {sections.map((s) => (
                <Link
                  key={s.id}
                  to={TRAVEL_PATH + "/" + tripId + "/" + s.id}
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                  className={s.id === section ? "active" : ""}
                  aria-current={s.id === section ? "page" : undefined}
                >
                  <s.icon size={16} />
                  {s.label}
                </Link>
              ))}
            </nav>
            <main className="t-content">
              <div className="t-sync" role="status">
                <span
                  className={
                    travel.syncing ? "t-sync-dot updating" : "t-sync-dot"
                  }
                />
                {travel.syncing
                  ? "Senkronize ediliyor…"
                  : travel.lastSync
                    ? "Son kontrol " +
                      travel.lastSync.toLocaleTimeString("tr-TR")
                    : "Bağlanıyor…"}
                <span>{data!.timezone}</span>
              </div>
              {section === "overview" && (
                <>
                  <SectionHeading
                    eyebrow="Yolculuğun tamamı, bir bakışta"
                    title="Planımız şekilleniyor."
                    action={
                      <button
                        className="t-button"
                        onClick={() => go("itinerary")}
                      >
                        Programı aç <ArrowUpRight size={16} />
                      </button>
                    }
                  />
                  <div className="t-metrics">
                    <Metric
                      label="Keşfedilecek yer"
                      value={stats.places.length}
                      hint={
                        stats.visited +
                        " ziyaret edildi · " +
                        (stats.places.length - stats.visited) +
                        " kaldı"
                      }
                    />
                    <Metric
                      label="Günlere yerleşen"
                      value={stats.planned.length}
                      hint={dates.length + " günlük rota"}
                    />
                    <Metric
                      label="Tahminî gider"
                      value={money(stats.estimated, data!.currency)}
                      hint="Bütçe bölümündeki kalemler"
                    />
                    <Metric
                      label="Kaydedilmiş ödeme"
                      value={money(stats.actual, data!.currency)}
                      hint={
                        data!.budget
                          ? money(data!.budget - stats.actual, data!.currency) +
                            " kalan bütçe"
                          : "Toplam bütçe belirlenmedi"
                      }
                    />
                  </div>
                  <div className="t-dashboard-grid">
                    <section className="t-panel t-readiness">
                      <div
                        className="t-ring"
                        style={{
                          background:
                            "conic-gradient(var(--t-green) " +
                            stats.complete +
                            "%,var(--t-line) 0)",
                        }}
                      >
                        <div>
                          <strong>{stats.complete}%</strong>
                          <span>plan hazır</span>
                        </div>
                      </div>
                      <div>
                        <p className="t-eyebrow">Adım adım</p>
                        <h3>Program ve hazırlık durumu.</h3>
                        <p>
                          {stats.planned.length}/{stats.places.length} yer bir
                          güne atandı.
                          <br />
                          {stats.taskDone}/{stats.tasks.length} hazırlık
                          tamamlandı.
                        </p>
                        <button
                          className="t-text-button"
                          onClick={() => go("checklists")}
                        >
                          Hazırlıklara git <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </section>
                    <section className="t-panel t-next">
                      <p className="t-eyebrow">Sıradaki keşif</p>
                      {upcoming[0] ? (
                        <>
                          <h3>{upcoming[0].data.title}</h3>
                          <p>
                            {tripDay(upcoming[0].data.date)} ·{" "}
                            {upcoming[0].data.time || "Saat serbest"}
                          </p>
                          <button
                            className="t-text-button"
                            onClick={() => setDetail(upcoming[0])}
                          >
                            Ayrıntıları aç <ArrowUpRight size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <h3>Programda boş bir sayfa.</h3>
                          <p>İlk deneyimi bir güne yerleştirin.</p>
                          {headerAction("place", "Bir deneyim ekle")}
                        </>
                      )}
                    </section>
                  </div>
                  <div className="t-dashboard-grid">
                    <section className="t-panel">
                      <SectionHeading title="Gün gün, birlikte" />
                      {dates.slice(0, 5).map((date) => {
                        const places = stats.planned.filter(
                          (p) => p.data.date === date,
                        );
                        return (
                          <button
                            className="t-day-preview"
                            key={date}
                            onClick={() => {
                              setDay(date);
                              go("itinerary");
                            }}
                          >
                            <div>
                              <strong>{tripDay(date)}</strong>
                              <span>
                                {places.length
                                  ? places.length +
                                    " durak · " +
                                    places.reduce(
                                      (m, p) => m + p.data.duration,
                                      0,
                                    ) +
                                    " dk etkinlik"
                                  : "Planlamaya açık"}
                              </span>
                            </div>
                            <ChevronRight size={17} />
                          </button>
                        );
                      })}
                      {!dates.length && (
                        <p className="t-muted">
                          Gezi ayarlarından tarihleri belirleyerek günlük
                          programı başlatın.
                        </p>
                      )}
                    </section>
                    <section className="t-panel">
                      <SectionHeading title="Aklımızda olsun" />
                      {reminders.slice(0, 3).map((t) => (
                        <button
                          className="t-reminder"
                          key={t.id}
                          onClick={() => openEditor(t)}
                        >
                          <AlertCircle size={16} />
                          <span>
                            {t.data.title}
                            <small>
                              {tripDay(t.data.date)} ·{" "}
                              {t.data.assignee
                                ? memberName(t.data.assignee)
                                : "Birlikte"}
                            </small>
                          </span>
                        </button>
                      ))}
                      {stats.places
                        .filter((p) => p.data.priority === 3 && !p.data.date)
                        .slice(0, 2)
                        .map((p) => (
                          <button
                            className="t-reminder"
                            key={p.id}
                            onClick={() => openEditor(p)}
                          >
                            <Heart size={16} />
                            <span>
                              {p.data.title}
                              <small>
                                Vazgeçilmez · henüz bir güne atanmadı
                              </small>
                            </span>
                          </button>
                        ))}
                      {!reminders.length &&
                        !stats.places.some(
                          (p) => p.data.priority === 3 && !p.data.date,
                        ) && (
                          <p className="t-muted">
                            Tarihli hazırlıklar ve program bekleyen öncelikli
                            yerler burada görünür.
                          </p>
                        )}
                      {data!.budget > 0 && stats.actual > data!.budget && (
                        <p className="t-error">
                          Bütçe{" "}
                          {money(stats.actual - data!.budget, data!.currency)}{" "}
                          aşıldı.
                        </p>
                      )}
                    </section>
                  </div>
                  <SectionHeading title="Her ayrıntının bir yeri var" />
                  <div className="t-shortcuts">
                    {sections.slice(1).map((s) => (
                      <button key={s.id} onClick={() => go(s.id)}>
                        <s.icon size={21} />
                        <span>{s.label}</span>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </div>
                  {!!snapshot.changes.length && (
                    <section className="t-activity t-panel">
                      <h3>Birlikte son dokunuşlar</h3>
                      {snapshot.changes.slice(0, 6).map((c) => (
                        <p key={c.id}>
                          <span className="t-avatar">
                            {memberName(c.actor).slice(0, 1)}
                          </span>
                          <span>
                            <strong>{memberName(c.actor)}</strong> · {c.action}
                            <small>{c.name}</small>
                          </span>
                          <time>{new Date(c.at).toLocaleString("tr-TR")}</time>
                        </p>
                      ))}
                    </section>
                  )}
                </>
              )}
              {section === "places" && (
                <>
                  <SectionHeading
                    eyebrow="Küçük keşifler, büyük anılar"
                    title="Gitmek istediğimiz yerler"
                    action={headerAction("place", "Yer veya deneyim ekle")}
                  />
                  <div className="t-toolbar">
                    <label className="t-search">
                      <Search size={17} />
                      <input
                        aria-label="Yerlerde ara"
                        placeholder="Yer, bölge, kategori, etiket…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Yerleri sırala"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="priority">Önceliğe göre</option>
                      <option value="name">Ada göre</option>
                      <option value="cost">Maliyete göre</option>
                    </select>
                  </div>
                  <div className="t-filters">
                    {[
                      ["all", "Hepsi"],
                      ["visit", "Must Visit"],
                      ["do", "Must Do"],
                      ["favorite", "Favoriler"],
                      ["food", "Yeme içme"],
                      ["saved", "Sonrası için"],
                      ["visited", "Ziyaret edilenler"],
                      ...[
                        ...new Set(
                          stats.places
                            .map((e) => e.data.category)
                            .filter(Boolean),
                        ),
                      ].map((c) => [c, c]),
                    ].map(([id, label], i) => (
                      <button
                        key={id + i}
                        aria-pressed={filter === id}
                        className={filter === id ? "active" : ""}
                        onClick={() => setFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="t-grid">{placeCards.map(renderPlace)}</div>
                  {!placeCards.length && (
                    <Empty
                      title="Yeni bir keşfe yer açın"
                      text="Yer, restoran, kafe veya bir deneyim ekleyin. Tarihsiz kayıtlar daha sonrası için saklanır."
                      onAdd={() => add("place")}
                    />
                  )}
                  {placeCards.length > 0 && (
                    <section className="t-panel t-comparison">
                      <h3>Seçenekleri karşılaştır</h3>
                      <div className="t-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Yer</th>
                              <th>Bölge</th>
                              <th>Süre</th>
                              <th>Tahminî toplam</th>
                              <th>Öncelik</th>
                            </tr>
                          </thead>
                          <tbody>
                            {placeCards.map((p) => (
                              <tr key={p.id}>
                                <td>{p.data.title}</td>
                                <td>{p.data.area || "—"}</td>
                                <td>{p.data.duration} dk</td>
                                <td>
                                  {money(p.data.estimated, data!.currency)}
                                </td>
                                <td>{p.data.priority}/3</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="t-hint">
                        Yer maliyetleri karşılaştırma içindir. Toplam bütçeye
                        dahil etmek için Bütçe bölümüne gider ekleyin.
                      </p>
                    </section>
                  )}
                </>
              )}
              {section === "itinerary" && (
                <>
                  <SectionHeading
                    eyebrow="Acele etmeden, hiçbir şeyi kaçırmadan"
                    title="Günlük programımız"
                    action={headerAction("place", "Programa ekle", {
                      date: selectedDay,
                    })}
                  />
                  <div className="t-itinerary-tools">
                    <div className="t-days" aria-label="Gün seçimi">
                      {dates.map((date, i) => (
                        <button
                          key={date}
                          className={date === selectedDay ? "active" : ""}
                          onClick={() => setDay(date)}
                        >
                          <small>{i + 1}. GÜN</small>
                          <strong>{tripDay(date)}</strong>
                        </button>
                      ))}
                    </div>
                    <button
                      className="t-button"
                      onClick={exportCalendar}
                      disabled={!stats.planned.some((p) => p.data.time)}
                    >
                      <Download size={16} /> Takvime aktar
                    </button>
                  </div>
                  {!dates.length && (
                    <Empty
                      title="İlk güne başlayalım"
                      text="Gezi ayarlarında tarihleri seçin veya bir yeri tarihlendirerek programa ekleyin."
                      onAdd={() => add("place")}
                    />
                  )}
                  <div className="t-itinerary-layout">
                    <section className="t-panel">
                      <h3>
                        {selectedDay ? tripDay(selectedDay) : "Program"}{" "}
                        <span className="t-muted">
                          · {dayPlaces.length} durak
                        </span>
                      </h3>
                      {dayPlaces.map((p, i) => {
                        const previous = dayPlaces[i - 1],
                          km = previous
                            ? distanceKm(previous.data, p.data)
                            : null;
                        const minutes = (s: string) =>
                          Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
                        const clash =
                          previous?.data.time &&
                          p.data.time &&
                          minutes(p.data.time) <
                            minutes(previous.data.time) +
                              previous.data.duration;
                        return (
                          <div className="t-timeline-row" key={p.id}>
                            <div className="t-timeline-time">
                              {p.data.time || "Serbest"}
                              <span>{p.data.duration} dk</span>
                            </div>
                            <div className="t-timeline-dot" />
                            <div className="t-timeline-copy">
                              {km !== null && (
                                <small className="t-leg">
                                  {km.toFixed(1)} km kuş uçuşu · ~
                                  {Math.max(
                                    1,
                                    Math.round(((km * 1.25) / 4.5) * 60),
                                  )}{" "}
                                  dk yürüyüş
                                </small>
                              )}
                              <button
                                onClick={() => openEditor(p)}
                                className="t-place-title"
                              >
                                <h3>{p.data.title}</h3>
                              </button>
                              <p>{p.data.area || p.data.category}</p>
                              {clash && (
                                <p className="t-error">
                                  Önceki etkinlikle saat çakışması var.
                                </p>
                              )}
                              <button
                                className="t-text-button"
                                onClick={() => openEditor(p)}
                              >
                                Saati veya günü düzenle{" "}
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {selectedDay && !dayPlaces.length && (
                        <p className="t-empty">Bu günü birlikte dolduralım.</p>
                      )}
                      <p className="t-hint">
                        Saatler {data!.timezone} içindir. Yol süreleri yaklaşık
                        yürüyüş tahminidir.
                      </p>
                    </section>
                    <aside>
                      <section className="t-panel">
                        <h3>Güne dair</h3>
                        <Metric
                          label="Etkinlik süresi"
                          value={
                            dayPlaces.reduce(
                              (sum, p) => sum + p.data.duration,
                              0,
                            ) + " dk"
                          }
                        />
                        <Metric
                          label="Yer maliyeti tahmini"
                          value={money(
                            dayPlaces.reduce(
                              (sum, p) => sum + p.data.estimated,
                              0,
                            ),
                            data!.currency,
                          )}
                        />
                        {dayPlaces.reduce(
                          (sum, p) => sum + p.data.duration,
                          0,
                        ) > 480 && (
                          <p className="t-error">
                            Bu gün yoğun görünüyor. Yemek ve ulaşım için boşluk
                            bırakın.
                          </p>
                        )}
                        {[
                          ...new Set(
                            dayPlaces.map((p) => p.data.area).filter(Boolean),
                          ),
                        ].length > 3 && (
                          <p className="t-muted">
                            Dörtten fazla bölge var. Birbirine yakın durakları
                            aynı güne toplamayı düşünün.
                          </p>
                        )}
                      </section>
                      {!!nearby.length && (
                        <section className="t-panel">
                          <h3>Bu rotaya yakın</h3>
                          <p className="t-hint">
                            Son konumlu durağa kuş uçuşu mesafeye göre.
                          </p>
                          {nearby.map(({ place, km }) => (
                            <div className="t-day-preview" key={place.id}>
                              <div>
                                <strong>{place.data.title}</strong>
                                <span>{km.toFixed(1)} km</span>
                              </div>
                              <button
                                className="t-small-button"
                                disabled={busy}
                                onClick={() =>
                                  void update(place, {
                                    date: selectedDay,
                                    time: "",
                                  })
                                }
                              >
                                <Plus size={13} /> Güne ekle
                              </button>
                            </div>
                          ))}
                        </section>
                      )}
                      <section className="t-panel">
                        <h3>Henüz bir günü yok</h3>
                        {stats.places
                          .filter((p) => !p.data.date)
                          .slice(0, 10)
                          .map((p) => (
                            <button
                              className="t-day-preview"
                              key={p.id}
                              onClick={() =>
                                setEditor({ kind: "place", entry: p })
                              }
                            >
                              {p.data.title}
                              <Plus size={15} />
                            </button>
                          ))}
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {section === "map" && (
                <>
                  <SectionHeading
                    eyebrow="Birbirine yakın keşifler"
                    title="Harita & rotalar"
                  />
                  <Suspense
                    fallback={<p role="status">Harita hazırlanıyor…</p>}
                  >
                    <TravelMap places={stats.places} onOpen={openEditor} />
                  </Suspense>
                </>
              )}
              {section === "budget" && (
                <Budget
                  snapshot={snapshot}
                  members={access.members}
                  onAdd={() => add("expense")}
                  onEdit={openEditor}
                />
              )}
              {section === "checklists" && (
                <>
                  <SectionHeading
                    eyebrow="İyi bir yolculuk, küçük hazırlıklarla başlar"
                    title="Hazırlık & bavul"
                    action={headerAction("task", "Hazırlık ekle")}
                  />
                  <div className="t-metrics">
                    <Metric
                      label="Tamamlanan"
                      value={stats.taskDone + " / " + stats.tasks.length}
                    />
                    <Metric
                      label="Hazırlık durumu"
                      value={percent(stats.taskDone, stats.tasks.length) + "%"}
                    />
                    <Metric label="Tarihi gelen" value={reminders.length} />
                  </div>
                  <div className="t-filters">
                    {[
                      ["all", "Hepsi"],
                      ["todo", "Yapılacak"],
                      ["done", "Tamamlanan"],
                      ["mine", "Bana ait"],
                      ["packing", "Bavul"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={filter === id ? "active" : ""}
                        onClick={() => setFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="t-panel t-tasks">
                    {stats.tasks
                      .filter(
                        (t) =>
                          filter === "all" ||
                          (filter === "todo" && !t.data.done) ||
                          (filter === "done" && t.data.done) ||
                          (filter === "mine" &&
                            t.data.assignee === access.userId) ||
                          (filter === "packing" &&
                            /bavul/i.test(t.data.category)),
                      )
                      .sort(bySchedule)
                      .map((t) => (
                        <div key={t.id} className="t-task">
                          <input
                            type="checkbox"
                            aria-label={t.data.title + " tamamlandı"}
                            checked={t.data.done}
                            disabled={busy}
                            onChange={() =>
                              void update(t, { done: !t.data.done })
                            }
                          />
                          <button
                            className={t.data.done ? "done" : ""}
                            onClick={() => openEditor(t)}
                          >
                            <strong>{t.data.title}</strong>
                            <span>
                              {t.data.category || "Hazırlık"} ·{" "}
                              {t.data.assignee
                                ? memberName(t.data.assignee)
                                : "Birlikte"}
                              {t.data.date && " · " + tripDay(t.data.date)}
                            </span>
                          </button>
                        </div>
                      ))}
                    {!stats.tasks.length && (
                      <Empty
                        title="Hazırlıklar burada toparlanır"
                        text="Belgeler, rezervasyon işleri, şarj aletleri, bavul… Her işi birinize atayabilirsiniz."
                        onAdd={() => add("task")}
                      />
                    )}
                  </div>
                </>
              )}
              {section === "bookings" && (
                <>
                  <SectionHeading
                    eyebrow="Doğru bilgi, tam zamanında"
                    title="Rezervasyonlarımız"
                    action={headerAction("booking", "Rezervasyon ekle")}
                  />
                  <div className="t-grid">
                    {entries
                      .filter((e) => e.kind === "booking")
                      .sort(bySchedule)
                      .map((b) => (
                        <section className="t-panel t-booking" key={b.id}>
                          <p className="t-eyebrow">
                            {b.data.category || "Rezervasyon"} ·{" "}
                            {b.data.status === "confirmed"
                              ? "Onaylandı"
                              : b.data.status === "cancelled"
                                ? "İptal edildi"
                                : "Araştırılıyor"}
                          </p>
                          <h3>{b.data.title}</h3>
                          <p>
                            {tripDay(b.data.date)} {b.data.time}
                            {b.data.endDate && " — " + tripDay(b.data.endDate)}
                          </p>
                          <p>{b.data.address}</p>
                          {b.data.reference && (
                            <p className="t-booking-code">{b.data.reference}</p>
                          )}
                          <p className="t-pre-wrap">{b.data.text}</p>
                          <div className="t-card-actions">
                            <SafeLink
                              url={b.data.url}
                              label="Rezervasyon bağlantısı"
                            />
                            <button
                              className="t-text-button"
                              onClick={() => setDetail(b)}
                            >
                              Ayrıntılar <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </section>
                      ))}
                  </div>
                  {!entries.some((e) => e.kind === "booking") && (
                    <Empty
                      title="Biletler ve konaklama aynı yerde"
                      text="Uçuş, otel, restoran ve deneyim rezervasyonlarını ekleyin. Referans numaraları yalnızca ikinize görünür."
                      onAdd={() => add("booking")}
                    />
                  )}
                </>
              )}
              {section === "together" && (
                <>
                  <SectionHeading
                    eyebrow="İki kişi, ortak bir rota"
                    title="Fikirlerimiz & kararlarımız"
                    action={
                      <div className="t-card-actions">
                        <button
                          className="t-button"
                          onClick={() => add("decision")}
                        >
                          <Vote size={16} /> Karar aç
                        </button>
                        {headerAction("note", "Not ekle")}
                      </div>
                    }
                  />
                  <div className="t-grid">
                    {entries
                      .filter((e) => e.kind === "note" || e.kind === "decision")
                      .map((e) => (
                        <section className="t-panel t-note" key={e.id}>
                          <p className="t-eyebrow">
                            {e.kind === "decision"
                              ? "Ortak karar"
                              : e.data.category || "Not"}{" "}
                            · {memberName(e.createdBy)}
                          </p>
                          <h3>{e.data.title}</h3>
                          <p className="t-pre-wrap">{e.data.text}</p>
                          {e.kind === "decision" && (
                            <div className="t-votes">
                              {e.data.options.map((option) => {
                                const votes = snapshot.votes.filter(
                                  (v) =>
                                    v.entryId === e.id && v.choice === option,
                                );
                                const selected = votes.some(
                                  (v) => v.userId === access.userId,
                                );
                                return (
                                  <button
                                    key={option}
                                    className={selected ? "active" : ""}
                                    aria-pressed={selected}
                                    disabled={busy}
                                    onClick={() =>
                                      void action({
                                        operation: "vote",
                                        id: e.id,
                                        choice: option,
                                      })
                                    }
                                  >
                                    <span>
                                      {option}
                                      <small>
                                        {votes
                                          .map((v) => memberName(v.userId))
                                          .join(" · ") || "Henüz oy yok"}
                                      </small>
                                    </span>
                                    <strong>{votes.length}/2</strong>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="t-card-actions">
                            <SafeLink url={e.data.url} />
                            <button
                              className="t-text-button"
                              onClick={() => setDetail(e)}
                            >
                              <MessageCircle size={14} /> Yorumlar (
                              {
                                entries.filter(
                                  (c) =>
                                    c.kind === "comment" &&
                                    c.data.parentId === e.id,
                                ).length
                              }
                              )
                            </button>
                            <button
                              className="t-text-button"
                              onClick={() => openEditor(e)}
                            >
                              Düzenle
                            </button>
                          </div>
                        </section>
                      ))}
                  </div>
                  {!entries.some(
                    (e) => e.kind === "note" || e.kind === "decision",
                  ) && (
                    <Empty
                      title="Bir fikrin mi var?"
                      text="Not bırakın veya seçenekleri oylamaya açın. Oylar kişi başına bir kez sayılır; tercih değiştirilebilir."
                      onAdd={() => add("note")}
                    />
                  )}
                </>
              )}
              {section === "discover" && (
                <>
                  <SectionHeading
                    eyebrow="Bize göre bir gezi"
                    title="İlhamı rotaya dönüştür"
                  />
                  {isBudapest(data!.destination) ? (
                    <>
                      <p className="t-intro">
                        Resmî Budapeşte turizm kaynaklarından seçilmiş fikirler.{" "}
                        {data!.interests
                          ? "“" +
                            data!.interests +
                            "” ilgi alanlarınıza uyan seçenekler önce gösterilir."
                          : "İlgi alanlarınızı gezi ayarlarından ekleyerek sıralamayı kişiselleştirin."}
                      </p>
                      <div className="t-grid">
                        {rankedRecommendations(data!.interests).map((r) => {
                          const saved = stats.places.some(
                            (p) => p.data.title === r.data.title,
                          );
                          return (
                            <section className="t-panel t-discover" key={r.id}>
                              <span className="t-category">
                                {r.data.must === "visit"
                                  ? "Must Visit"
                                  : "Must Do"}{" "}
                                · {r.data.area}
                              </span>
                              <h3>{r.data.title}</h3>
                              <p>{r.why}</p>
                              <p className="t-muted">{r.data.text}</p>
                              <div className="t-card-actions">
                                <SafeLink url={r.source} label="Resmî kaynak" />
                                <button
                                  className="t-button"
                                  disabled={saved}
                                  onClick={() => add("place", r.data)}
                                >
                                  {saved ? (
                                    <Check size={15} />
                                  ) : (
                                    <Plus size={15} />
                                  )}
                                  {saved ? "Planımızda" : "Planımıza ekle"}
                                </button>
                              </div>
                            </section>
                          );
                        })}
                      </div>
                      <p className="t-hint">
                        İçerik 19 Kasım 2026 tarihinde kontrol edildi. Canlı
                        müsaitlik veya fiyat bilgisi içermez. Ziyaret ve bilet
                        koşullarını kaynaklardan doğrulayın. Koordinatlar
                        yaklaşık konumlardır.
                      </p>
                    </>
                  ) : (
                    <Empty
                      title="Kendi keşif rehberinizi oluşturun"
                      text="Bu şehir için hazır bir rehber bulunmuyor. Resmî şehir rehberinden beğendiğiniz yerleri kaydedin; Must Visit ve Must Do listelerinizi birlikte oluşturun."
                      onAdd={() => add("place")}
                    />
                  )}
                </>
              )}
            </main>
          </>
        )}
        <footer className="t-footer">
          <span>Dido & Emirgan · Ortak gezi defteri</span>
          <a
            href="https://unsplash.com/photos/NWXTcSsJX3Y"
            target="_blank"
            rel="noopener noreferrer"
          >
            Budapeşte fotoğrafı · Tomas Piachewski / Unsplash
          </a>
        </footer>
      </div>
      {tripEditor && (
        <Dialog
          title={snapshot ? "Gezimizi düzenle" : "Yeni bir geziye başlayalım"}
          onClose={() => setTripEditor(null)}
        >
          <TripForm
            trip={tripEditor === "new" ? undefined : tripEditor}
            onSave={saveTrip}
          />
        </Dialog>
      )}
      {editor && (
        <Dialog
          title={
            (editor.entry ? "Düzenle · " : "Yeni · ") + KIND_LABELS[editor.kind]
          }
          onClose={() => setEditor(null)}
        >
          <EntryForm
            key={editor.entry?.id ?? draftId}
            kind={editor.kind}
            entry={editor.entry}
            initial={editor.initial}
            members={access.members}
            currency={data?.currency ?? "EUR"}
            onSave={saveEntry}
          />
          {editor.entry && (
            <div className="t-detail">
              <button
                type="button"
                className="t-button t-danger"
                disabled={busy}
                onClick={() => void deleteEntry(editor.entry!)}
              >
                Kaydı sil
              </button>
            </div>
          )}
        </Dialog>
      )}
      {detail && snapshot && (
        <Dialog title={detail.data.title} onClose={() => setDetail(null)}>
          <div className="t-detail">
            <p className="t-eyebrow">
              {detail.data.category} · {detail.data.area}
            </p>
            <p className="t-pre-wrap">{detail.data.text}</p>
            <p>{detail.data.address}</p>
            <SafeLink url={detail.data.url} />
            <div className="t-card-actions">
              <button className="t-button" onClick={() => openEditor(detail)}>
                Düzenle
              </button>
              <button
                className="t-button t-danger"
                disabled={busy}
                onClick={() => void deleteEntry(detail)}
              >
                Kaydı sil
              </button>
            </div>
            <h3>Birlikte not düşelim</h3>
            {entries
              .filter(
                (e) => e.kind === "comment" && e.data.parentId === detail.id,
              )
              .map((c) => (
                <div className="t-comment" key={c.id}>
                  <small>
                    {memberName(c.createdBy)} ·{" "}
                    {new Date(c.updatedAt).toLocaleString("tr-TR")}
                  </small>
                  <h4>{c.data.title}</h4>
                  <p className="t-pre-wrap">{c.data.text}</p>
                  {c.createdBy === access.userId && (
                    <button
                      className="t-text-button"
                      onClick={() => void deleteEntry(c)}
                    >
                      Yorumumu sil
                    </button>
                  )}
                </div>
              ))}
            <button
              className="t-button"
              onClick={() => {
                const parentId = detail.id;
                setDetail(null);
                add("comment", { parentId });
              }}
            >
              <Plus size={15} /> Yorum ekle
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Budget({
  snapshot,
  members,
  onAdd,
  onEdit,
}: {
  snapshot: TripSnapshot;
  members: TravelMember[];
  onAdd: () => void;
  onEdit: (e: TravelEntry) => void;
}) {
  const { data } = snapshot.trip,
    stats = tripStats(snapshot.entries);
  const categories = [
    ...new Set(stats.expenses.map((e) => e.data.category || "Diğer")),
  ];
  const actualCategories = categories.map((category) => ({
    category,
    amount: stats.expenses
      .filter((e) => (e.data.category || "Diğer") === category)
      .reduce((sum, e) => sum + (e.data.actual ?? 0), 0),
  }));
  const paid = members.map((m) => ({
    ...m,
    amount: stats.expenses.reduce(
      (sum, e) =>
        sum +
        (e.data.assignee === m.id
          ? (e.data.actual ?? 0)
          : e.data.assignee === null
            ? (e.data.actual ?? 0) / 2
            : 0),
      0,
    ),
  }));
  const difference = Math.round((paid[0].amount - paid[1].amount) / 2);
  return (
    <>
      <SectionHeading
        eyebrow="Rahat bir gezi, açık bir bütçe"
        title="Bütçemiz"
        action={
          <button className="t-button t-primary" onClick={onAdd}>
            <Plus size={16} /> Gider ekle
          </button>
        }
      />
      <div className="t-metrics">
        <Metric
          label="Toplam bütçe"
          value={money(data.budget, data.currency)}
        />
        <Metric
          label="Tahminî giderler"
          value={money(stats.estimated, data.currency)}
        />
        <Metric
          label="Kaydedilmiş ödemeler"
          value={money(stats.actual, data.currency)}
        />
        <Metric
          label="Kalan bütçe"
          value={money(data.budget - stats.actual, data.currency)}
        />
      </div>
      <div className="t-dashboard-grid">
        <section className="t-panel">
          <h3>Harcamaların dağılımı</h3>
          {actualCategories.map((c) => (
            <div key={c.category} className="t-bar-row">
              <div>
                <span>{c.category}</span>
                <strong>{money(c.amount, data.currency)}</strong>
              </div>
              <div className="t-progress">
                <i style={{ width: percent(c.amount, stats.actual) + "%" }} />
              </div>
            </div>
          ))}
          {!stats.actual && (
            <p className="t-muted">
              Gerçek ödemeler girildiğinde kategori dağılımı görünür.
            </p>
          )}
        </section>
        <section className="t-panel t-split">
          <h3>İki kişilik hesap</h3>
          <p>Giderler eşit paylaşılır. Ödeyen kişinin toplamı aşağıda.</p>
          {paid.map((m) => (
            <div key={m.id}>
              <span>{m.name}</span>
              <strong>{money(m.amount, data.currency)}</strong>
            </div>
          ))}
          <p className="t-split-result">
            {difference
              ? (difference > 0
                  ? members[1].name + " → " + members[0].name
                  : members[0].name + " → " + members[1].name) +
                " · " +
                money(Math.abs(difference), data.currency)
              : "Hesap dengede."}
          </p>
          <p className="t-hint">
            “Ortak ödeme” iki kişiye eşit dağıtılır. Bu bir hesap özeti; para
            transferi gerçekleştirmez.
          </p>
        </section>
      </div>
      <section className="t-panel">
        <h3>Tahmin & gerçek</h3>
        <div className="t-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Gider</th>
                <th>Kategori</th>
                <th>Tahmin</th>
                <th>Gerçek</th>
                <th>Fark</th>
                <th>Ödeyen</th>
              </tr>
            </thead>
            <tbody>
              {stats.expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button className="t-text-button" onClick={() => onEdit(e)}>
                      {e.data.title}
                    </button>
                  </td>
                  <td>{e.data.category || "Diğer"}</td>
                  <td>{money(e.data.estimated, data.currency)}</td>
                  <td>
                    {e.data.actual === null
                      ? "Ödenmedi"
                      : money(e.data.actual, data.currency)}
                  </td>
                  <td>
                    {e.data.actual === null
                      ? "—"
                      : money(e.data.actual - e.data.estimated, data.currency)}
                  </td>
                  <td>
                    {members.find((m) => m.id === e.data.assignee)?.name ??
                      "Ortak"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!stats.expenses.length && (
          <Empty
            title="İlk gideri ekleyin"
            text="Ulaşım, konaklama, yemek ve etkinlikleri ayrı kalemlerle karşılaştırın."
            onAdd={onAdd}
          />
        )}
        <p className="t-hint">
          Tüm tutarlar {data.currency}. Farklı para birimindeki ödemeleri kendi
          kurunuzla dönüştürerek girin. Yerler bölümündeki maliyetler bu toplama
          otomatik eklenmez.
        </p>
      </section>
    </>
  );
}
