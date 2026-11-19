import { useEffect, useRef, useState } from "react";
import { MapPinned, ExternalLink } from "lucide-react";
import type { TravelEntry } from "../../shared/travel";
import { bySchedule, distanceKm } from "../../shared/travel";
import "leaflet/dist/leaflet.css";

export default function TravelMap({
  places,
  onOpen,
}: {
  places: TravelEntry[];
  onOpen: (entry: TravelEntry) => void;
}) {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const pins = places.filter((p) => p.data.lat !== null && p.data.lng !== null);
  const ordered = [...pins].filter((p) => p.data.date).sort(bySchedule);
  useEffect(() => {
    if (!enabled || !container.current) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        map = L.map(container.current, { scrollWheelZoom: false }).setView(
          [47.499, 19.05],
          13,
        );
        const tiles = L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          },
        ).addTo(map);
        tiles.on("tileerror", () =>
          setError(
            "Harita zemini yüklenemedi. Koordinat listesi ve rota bağlantıları kullanılabilir.",
          ),
        );
        pins.forEach((p) => {
          const marker = L.circleMarker([p.data.lat!, p.data.lng!], {
            radius: p.data.done ? 7 : 10,
            color: "#fff",
            fillColor: p.data.done ? "#8b9a8a" : "#264c3e",
            fillOpacity: 1,
            weight: 3,
          }).addTo(map!);
          // DOM text prevents titles from becoming executable popup HTML.
          const label = document.createElement("button");
          label.textContent = p.data.title;
          label.addEventListener("click", () => onOpen(p));
          marker.bindPopup(label);
        });
        const days = [...new Set(ordered.map((p) => p.data.date))];
        days.forEach((day, i) => {
          const route = ordered.filter((p) => p.data.date === day);
          if (route.length > 1)
            L.polyline(
              route.map((p) => [p.data.lat!, p.data.lng!] as [number, number]),
              {
                color: ["#b17b39", "#264c3e", "#628e97"][i % 3],
                dashArray: "5 7",
                weight: 3,
              },
            ).addTo(map!);
        });
        if (pins.length)
          map.fitBounds(
            L.latLngBounds(
              pins.map((p) => [p.data.lat!, p.data.lng!] as [number, number]),
            ),
            { padding: [35, 35], maxZoom: 14 },
          );
        const observer = new ResizeObserver(() => map?.invalidateSize());
        observer.observe(container.current);
        map.once("unload", () => observer.disconnect());
      })
      .catch(() =>
        setError("Harita açılamadı. Koordinat listesinden devam edebilirsin."),
      );
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [enabled, places, onOpen]);
  return (
    <>
      {!enabled ? (
        <div className="t-map-consent t-panel">
          <MapPinned size={38} />
          <h3>Gezinizi haritada görün</h3>
          <p>
            İşaretler ve günlük rotalar aynı yerde. Harita yüklendiğinde
            OpenStreetMap, IP adresinizi ve görüntülenen harita alanını alır.
          </p>
          <button
            className="t-button t-primary"
            onClick={() => setEnabled(true)}
          >
            Haritayı yükle
          </button>
        </div>
      ) : (
        <div
          className="t-map"
          ref={container}
          aria-label="Gezinin etkileşimli haritası"
        />
      )}
      {error && (
        <p className="t-error" role="status">
          {error}
        </p>
      )}
      <p className="t-hint">
        Çizgiler günlük durakları sırayla birleştirir. Mesafe kuş uçuşudur.
        Yürüyüş tahmini mesafenin 1,25 katı ve saatte 4,5 km varsayımıyla
        hesaplanır; yol, trafik ve eğim hesaba katılmaz.
      </p>
      <div className="t-route-list">
        {ordered.map((p, i) => {
          const previous = ordered[i - 1];
          const km =
            previous?.data.date === p.data.date
              ? distanceKm(previous.data, p.data)
              : null;
          return (
            <div key={p.id} className="t-route-stop">
              {km !== null && (
                <p className="t-hint">
                  {km.toFixed(1)} km kuş uçuşu · yaklaşık{" "}
                  {Math.max(1, Math.round(((km * 1.25) / 4.5) * 60))} dk yürüyüş
                </p>
              )}
              <button className="t-text-button" onClick={() => onOpen(p)}>
                {p.data.time || "Saat serbest"} · {p.data.title}
              </button>
              <a
                className="t-external"
                target="_blank"
                rel="noopener noreferrer"
                href={
                  "https://www.google.com/maps/dir/?api=1&destination=" +
                  encodeURIComponent(p.data.lat + "," + p.data.lng) +
                  (km !== null
                    ? "&origin=" +
                      encodeURIComponent(
                        previous.data.lat + "," + previous.data.lng,
                      )
                    : "") +
                  "&travelmode=walking"
                }
                aria-label={p.data.title + " yol tarifi"}
              >
                <ExternalLink size={15} /> Yol tarifi
              </a>
            </div>
          );
        })}
      </div>
      {pins.length < places.length && (
        <p className="t-hint">
          {places.length - pins.length} yerin koordinatı eksik. Haritada
          göstermek için yer kaydını düzenle.
        </p>
      )}
      {pins.length === 0 && (
        <p className="t-empty">
          Yer eklerken enlem ve boylam gir. Kaydettiğin konumlar burada
          görünsün.
        </p>
      )}
      <div className="t-grid">
        {pins
          .filter((p) => !p.data.date)
          .map((p) => (
            <button
              className="t-panel t-list-button"
              key={p.id}
              onClick={() => onOpen(p)}
            >
              {p.data.title}
              <span>Güne atanmamış</span>
            </button>
          ))}
      </div>
    </>
  );
}
