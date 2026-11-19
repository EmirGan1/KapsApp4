import { useEffect, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { X, Loader2, ArrowUpRight } from "lucide-react";
import type {
  EntryData,
  EntryKind,
  TravelEntry,
  TravelMember,
  TravelTrip,
  TripData,
} from "../../shared/travel";
import { emptyEntry, emptyTrip } from "../../shared/travel";

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="travel-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="travel-icon"
          aria-label="Pencereyi kapat"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? "t-field t-wide" : "t-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Submit({ busy, error }: { busy: boolean; error: string }) {
  return (
    <div className="t-wide t-form-footer">
      {error && (
        <p role="alert" className="t-error">
          {error}
        </p>
      )}
      <button className="t-button t-primary" disabled={busy}>
        {busy ? (
          <Loader2 className="t-spin" size={17} />
        ) : (
          <ArrowUpRight size={17} />
        )}{" "}
        Kaydet
      </button>
    </div>
  );
}
export function TripForm({
  trip,
  onSave,
}: {
  trip?: TravelTrip;
  onSave: (data: TripData) => Promise<void>;
}) {
  const [value, setValue] = useState(trip?.data ?? emptyTrip());
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key: keyof TripData, val: unknown) =>
    setValue((v) => ({ ...v, [key]: val }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="t-form">
      <Field label="Gezi adı" full>
        <input
          required
          maxLength={100}
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Birlikte Budapeşte"
        />
      </Field>
      <Field label="Şehir / ülke">
        <input
          maxLength={150}
          value={value.destination}
          onChange={(e) => set("destination", e.target.value)}
          placeholder="Budapeşte, Macaristan"
        />
      </Field>
      <Field label="Saat dilimi">
        <select
          value={value.timezone}
          onChange={(e) => set("timezone", e.target.value)}
        >
          {[
            ...new Set([
              value.timezone,
              "Europe/Budapest",
              "Europe/Istanbul",
              "UTC",
              ...Intl.supportedValuesOf("timeZone"),
            ]),
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Gidiş tarihi">
        <input
          type="date"
          min="2000-01-01"
          max="2100-12-31"
          value={value.startDate}
          onChange={(e) => set("startDate", e.target.value)}
        />
      </Field>
      <Field label="Dönüş tarihi">
        <input
          type="date"
          min={value.startDate || "2000-01-01"}
          max="2100-12-31"
          value={value.endDate}
          onChange={(e) => set("endDate", e.target.value)}
        />
      </Field>
      <Field label="Toplam bütçe">
        <input
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          value={value.budget / 100}
          onChange={(e) =>
            set("budget", Math.round(Number(e.target.value) * 100))
          }
        />
      </Field>
      <Field label="Para birimi">
        <select
          value={value.currency}
          onChange={(e) => set("currency", e.target.value)}
        >
          {[
            ...new Set([
              value.currency,
              "EUR",
              "HUF",
              "TRY",
              "USD",
              "GBP",
              "CHF",
            ]),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="İlgi alanlarımız" full>
        <input
          maxLength={300}
          value={value.interests}
          onChange={(e) => set("interests", e.target.value)}
          placeholder="Tarih, manzara, termal, kahve…"
        />
      </Field>
      <Field label="Bu geziden beklentimiz" full>
        <textarea
          rows={3}
          maxLength={5000}
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      {trip && (
        <label className="t-check t-wide">
          <input
            type="checkbox"
            checked={value.archived}
            onChange={(e) => set("archived", e.target.checked)}
          />{" "}
          Geziyi arşivle
        </label>
      )}
      <p className="t-hint t-wide">
        Tutarlar seçilen para birimindedir. Tarih ve saatler gezinin saat
        dilimine göre planlanır. En fazla 366 gün.
      </p>
      <Submit busy={busy} error={error} />
    </form>
  );
}
export const KIND_LABELS: Record<EntryKind, string> = {
  place: "Yer / deneyim",
  task: "Hazırlık",
  expense: "Bütçe kalemi",
  booking: "Rezervasyon",
  note: "Not",
  decision: "Ortak karar",
  comment: "Yorum",
};
export function EntryForm({
  kind,
  entry,
  initial,
  members,
  currency,
  onSave,
}: {
  kind: EntryKind;
  entry?: TravelEntry;
  initial?: Partial<EntryData>;
  members: TravelMember[];
  currency: string;
  onSave: (data: EntryData) => Promise<void>;
}) {
  const [value, setValue] = useState(
    entry?.data ?? { ...emptyEntry(), ...initial },
  );
  const [options, setOptions] = useState(value.options.join("\n"));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key: keyof EntryData, val: unknown) =>
    setValue((v) => ({ ...v, [key]: val }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        ...value,
        options:
          kind === "decision"
            ? options
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="t-form">
      <Field label="Başlık" full>
        <input
          autoFocus
          required
          maxLength={200}
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      {kind !== "comment" && (
        <>
          <Field label="Kategori">
            <input
              maxLength={60}
              list="travel-categories"
              value={value.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder={
                kind === "task" ? "Hazırlık veya Bavul" : "Kendi kategorini yaz"
              }
            />
            <datalist id="travel-categories">
              {[
                "Manzara",
                "Tarih",
                "Yeme içme",
                "Deneyim",
                "Konaklama",
                "Ulaşım",
                "Bilet",
                "Hazırlık",
                "Bavul",
                "Bilgi",
              ].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Etiketler">
            <input
              maxLength={300}
              value={value.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="Virgülle ayır"
            />
          </Field>
        </>
      )}
      {["place", "task", "booking"].includes(kind) && (
        <>
          <Field label={kind === "task" ? "Son tarih" : "Tarih"}>
            <input
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={value.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Saat">
            <input
              type="time"
              value={value.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
        </>
      )}
      {kind === "place" && (
        <>
          <Field label="Süre (dakika)">
            <input
              type="number"
              min="0"
              max="1440"
              value={value.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
            />
          </Field>
        </>
      )}
      {kind === "place" && (
        <>
          <Field label={"Tahminî toplam maliyet · " + currency}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.estimated / 100}
              onChange={(e) =>
                set("estimated", Math.round(Number(e.target.value) * 100))
              }
            />
          </Field>
          <Field label="Bölge">
            <input
              maxLength={100}
              value={value.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="Buda · Kale Tepesi"
            />
          </Field>
          <Field label="Adres" full>
            <input
              maxLength={300}
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
          <Field label="Enlem">
            <input
              type="number"
              min="-90"
              max="90"
              step="any"
              value={value.lat ?? ""}
              onChange={(e) =>
                set(
                  "lat",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Boylam">
            <input
              type="number"
              min="-180"
              max="180"
              step="any"
              value={value.lng ?? ""}
              onChange={(e) =>
                set(
                  "lng",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label="Listemiz">
            <select
              value={value.must}
              onChange={(e) => set("must", e.target.value)}
            >
              <option value="">Keşfedilecek</option>
              <option value="visit">Must Visit</option>
              <option value="do">Must Do</option>
            </select>
          </Field>
          <Field label="Öncelik">
            <select
              value={value.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
            >
              <option value="1">Olursa güzel</option>
              <option value="2">Önemli</option>
              <option value="3">Vazgeçilmez</option>
            </select>
          </Field>
          <label className="t-check">
            <input
              type="checkbox"
              checked={value.favorite}
              onChange={(e) => set("favorite", e.target.checked)}
            />{" "}
            Favorimiz
          </label>
          <label className="t-check">
            <input
              type="checkbox"
              checked={value.done}
              onChange={(e) => set("done", e.target.checked)}
            />{" "}
            Ziyaret edildi / tamamlandı
          </label>
        </>
      )}
      {kind === "expense" && (
        <>
          <Field label={"Tahminî tutar · " + currency}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.estimated / 100}
              onChange={(e) =>
                set("estimated", Math.round(Number(e.target.value) * 100))
              }
            />
          </Field>
          <Field label={"Gerçek tutar · " + currency}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.actual === null ? "" : value.actual / 100}
              onChange={(e) =>
                set(
                  "actual",
                  e.target.value === ""
                    ? null
                    : Math.round(Number(e.target.value) * 100),
                )
              }
              placeholder="Henüz ödenmedi"
            />
          </Field>
        </>
      )}
      {["expense", "task", "booking"].includes(kind) && (
        <Field label={kind === "expense" ? "Ödeyen" : "Sorumlu"}>
          <select
            aria-label={kind === "expense" ? "Ödeyen" : "Sorumlu"}
            value={value.assignee ?? ""}
            onChange={(e) =>
              set("assignee", e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">
              {kind === "expense" ? "Eşit / ortak ödeme" : "Birlikte"}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {kind === "task" && (
        <label className="t-check">
          <input
            type="checkbox"
            checked={value.done}
            onChange={(e) => set("done", e.target.checked)}
          />{" "}
          Tamamlandı
        </label>
      )}
      {kind === "booking" && (
        <>
          <Field label="Çıkış / bitiş tarihi">
            <input
              type="date"
              min={value.date || "2000-01-01"}
              max="2100-12-31"
              value={value.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>
          <Field label="Rezervasyon numarası">
            <input
              maxLength={200}
              value={value.reference}
              onChange={(e) => set("reference", e.target.value)}
            />
          </Field>
          <Field label="Durum">
            <select
              value={value.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="idea">Araştırılıyor</option>
              <option value="confirmed">Onaylandı</option>
              <option value="cancelled">İptal edildi</option>
            </select>
          </Field>
          <Field label="Adres" full>
            <input
              maxLength={300}
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </Field>
        </>
      )}
      {kind === "decision" && (
        <Field label="Seçenekler · her satıra bir seçenek (2–8)" full>
          <textarea
            required
            rows={4}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
          />
        </Field>
      )}
      <Field label={kind === "comment" ? "Yorum" : "Notlar ve ayrıntılar"} full>
        <textarea
          rows={4}
          maxLength={10000}
          value={value.text}
          onChange={(e) => set("text", e.target.value)}
        />
      </Field>
      {kind !== "comment" && (
        <Field label="Kaynak / rezervasyon bağlantısı" full>
          <input
            type="url"
            maxLength={2048}
            value={value.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://"
          />
        </Field>
      )}
      <Submit busy={busy} error={error} />
    </form>
  );
}
