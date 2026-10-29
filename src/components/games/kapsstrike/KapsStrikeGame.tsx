import React, { useEffect, useRef, useState } from "react";
import {
  StrikeController,
  StrikeHUD,
} from "../../../games/kapsstrike/controller";
import {
  DEFAULT_SETTINGS,
  cleanSettings,
  WEAPONS,
  WEAPON_ORDER,
} from "../../../games/kapsstrike/config";
import { MapId, StrikeSettings } from "../../../games/kapsstrike/types";
import { MAPS } from "../../../games/kapsstrike/maps";
import "./kapsstrike.css";
export default function KapsStrikeGame({ onBack }: { onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef<StrikeController | null>(null);
  const [map, setMap] = useState<MapId>("warehouse"),
    [settings, setSettings] = useState<StrikeSettings>(() => {
      try {
        return cleanSettings(
          JSON.parse(localStorage.getItem("kapsstrike-settings") || "{}"),
        );
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }),
    [view, setView] = useState<"menu" | "play" | "pause">("menu"),
    [panel, setPanel] = useState<"settings" | "controls" | null>(null),
    [hud, setHUD] = useState<StrikeHUD | null>(null),
    [error, setError] = useState(""),
    [returnFire, setReturnFire] = useState(false),
    [supported, setSupported] = useState(true);
  useEffect(() => {
    const c = document.createElement("canvas");
    const probe = c.getContext("webgl2") || c.getContext("webgl");
    setSupported(
      !!probe && "requestPointerLock" in HTMLCanvasElement.prototype,
    );
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    return () => {
      game.current?.dispose();
      game.current = null;
    };
  }, []);
  const start = () => {
    setPanel(null);
    setError("");
    try {
      localStorage.setItem("kapsstrike-settings", JSON.stringify(settings));
    } catch {}
    try {
      game.current?.dispose();
      game.current = new StrikeController(
        canvas.current!,
        map,
        settings,
        setHUD,
        (reason) => {
          setView("pause");
          if (reason) setError(reason);
        },
      );
      game.current.setReturnFire(returnFire);
      setView("play");
      game.current.start();
    } catch (e) {
      game.current?.dispose();
      game.current = null;
      setView("menu");
      setError(e instanceof Error ? e.message : "WebGL başlatılamadı.");
    }
  };
  const resume = () => {
    setError("");
    setPanel(null);
    setView("play");
    game.current?.start();
  };
  const exit = () => {
    game.current?.dispose();
    game.current = null;
    setHUD(null);
    setView("menu");
    setPanel(null);
  };
  const setting = (patch: Partial<StrikeSettings>) =>
    setSettings((old) => cleanSettings({ ...old, ...patch }));
  return (
    <section className="ks-root" aria-label="KapsStrike antrenman">
      <canvas
        ref={canvas}
        className="ks-canvas"
        aria-label="KapsStrike 3D oyun alanı"
        tabIndex={-1}
      />
      {view === "play" && hud && (
        <div className="ks-hud" aria-live="off">
          <div className="ks-top">
            <div>
              <strong>KAPSSTRIKE</strong>
              <span>{MAPS[map].name} · ANTRENMAN</span>
            </div>
            <div>
              <b>
                {Math.floor(hud.seconds / 60)}:
                {String(Math.floor(hud.seconds) % 60).padStart(2, "0")}
              </b>
              <span>
                {hud.score} hedef · {Math.round(hud.dps)} DPS ·{" "}
                {Math.round(hud.damage)} hasar
              </span>
            </div>
          </div>
          <div className="ks-crosshair">
            <i />
            <i />
            {hud.hit && hud.hit.until > hud.tick && (
              <span className={hud.hit.head ? "head" : ""}>
                ✕
                <b>
                  {hud.hit.head ? "KAFA · " : ""}
                  {Math.round(hud.hit.damage)}
                </b>
              </span>
            )}
          </div>
          <div className="ks-bottom">
            <div className="ks-health">
              <small>CAN {hud.protection > 0 ? "· KORUMA" : ""}</small>
              <strong>
                {Math.ceil(hud.hp)} <span>/ 100</span>
              </strong>
              <meter min={0} max={100} value={hud.hp} aria-label="Can" />
              <span>
                {hud.speed.toFixed(1)} m/s ·{" "}
                {hud.stance === "slide"
                  ? "KAYMA"
                  : hud.stance === "crouch"
                    ? "ÇÖMELME"
                    : "AYAKTA"}
              </span>
            </div>
            <div className="ks-ammo">
              <small>{WEAPONS[hud.weapon].name}</small>
              <strong>
                {hud.ammo} <span>/ {hud.capacity}</span>
              </strong>
              <span>
                {hud.reload > 0
                  ? `ŞARJÖR · ${hud.reload.toFixed(1)} sn`
                  : "R · Yenile | 1–5 · Silah"}
              </span>
            </div>
          </div>
          <div className="ks-perf">
            {Math.round(hud.fps)} FPS · {hud.drawCalls} çizim ·{" "}
            {hud.activeMeshes}/{hud.meshes} mesh · Yerel antrenman, bağlantı yok
            · ESC Menü
          </div>
          {hud.hurt && hud.hurt.until > hud.tick && (
            <div
              className="ks-hurt"
              style={{ transform: `rotate(${hud.hurt.direction}rad)` }}
            >
              ▲
            </div>
          )}
          {hud.dead && (
            <div className="ks-death">
              <h2>Yeniden hazırlan.</h2>
              <p>{hud.respawn.toFixed(1)} saniye sonra doğacaksın.</p>
              <span>ESC ile duraklatabilirsin.</span>
            </div>
          )}
        </div>
      )}
      {view !== "play" && (
        <div className="ks-overlay">
          <div className="ks-menu">
            <header>
              <div className="ks-eyebrow">KAPSAPP · ÖZGÜN 3D FPS</div>
              <h1>
                KAPS<span>STRIKE</span>
              </h1>
              <p>Hızını bul. Nişanını geliştir.</p>
              <div className="ks-status">
                AŞAMA 1 · YEREL ANTRENMAN · SUNUCU GEREKTİRMEZ
              </div>
            </header>
            {error && (
              <p className="ks-error" role="alert">
                {error}
              </p>
            )}
            {!supported && (
              <p className="ks-error">
                Bu oyun WebGL ve fare kilidi destekli bir masaüstü tarayıcı
                gerektiriyor. Dokunmatik kontrol bu aşamada yok.
              </p>
            )}
            {view === "pause" && !panel ? (
              <div className="ks-paused">
                <h2>Duraklatıldı</h2>
                <p>
                  Simülasyon ve render döngüsü durdu. Ayar değişiklikleri
                  yeniden başlatmada uygulanır.
                </p>
                <button className="ks-primary" onClick={resume}>
                  Oyuna dön
                </button>
                <button onClick={start}>Haritayı yeniden başlat</button>
              </div>
            ) : null}
            {view === "menu" && !panel && (
              <>
                <div className="ks-maps">
                  {Object.values(MAPS).map((m) => (
                    <button
                      key={m.id}
                      className={map === m.id ? "selected" : ""}
                      onClick={() => setMap(m.id)}
                    >
                      <span className={`ks-map-art ${m.id}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <b>{m.name}</b>
                      <small>{m.subtitle}</small>
                    </button>
                  ))}
                </div>
                <label className="ks-check">
                  <input
                    type="checkbox"
                    checked={returnFire}
                    onChange={(e) => setReturnFire(e.target.checked)}
                  />{" "}
                  Kuklalar karşı ateş açsın · canlandırma ve yönsel hasar
                  antrenmanı
                </label>
                <p className="ks-hint">
                  Turuncu kuklaları vur. Kırmızı zemin tehlike bölgesidir.
                  Kuklalar 3 saniye sonra geri gelir.
                </p>
                <button
                  className="ks-primary"
                  disabled={!supported}
                  onClick={start}
                >
                  Antrenmanı başlat
                </button>
              </>
            )}
            {panel === "settings" && (
              <div className="ks-settings">
                <h2>Ayarlar</h2>
                <label>
                  Grafik kalitesi
                  <select
                    value={settings.quality}
                    onChange={(e) =>
                      setting({
                        quality: e.target.value as StrikeSettings["quality"],
                      })
                    }
                  >
                    <option value="low">Low · düşük yük</option>
                    <option value="medium">Medium · dengeli</option>
                    <option value="high">High · gölgeler</option>
                  </select>
                </label>
                <label>
                  Çözünürlük ölçeği · {settings.scale.toFixed(2)}×
                  <input
                    type="range"
                    min=".5"
                    max="1.5"
                    step=".05"
                    value={settings.scale}
                    onChange={(e) => setting({ scale: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Mouse sensitivity · {settings.sensitivity.toFixed(2)}
                  <input
                    type="range"
                    min=".15"
                    max="3"
                    step=".05"
                    value={settings.sensitivity}
                    onChange={(e) =>
                      setting({ sensitivity: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  FOV · {settings.fov}°
                  <input
                    type="range"
                    min="65"
                    max="115"
                    step="1"
                    value={settings.fov}
                    onChange={(e) => setting({ fov: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Oyun sesi · {Math.round(settings.volume * 100)}%
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={settings.volume}
                    onChange={(e) =>
                      setting({ volume: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="ks-check">
                  <input
                    type="checkbox"
                    checked={settings.invertY}
                    onChange={(e) => setting({ invertY: e.target.checked })}
                  />{" "}
                  Dikey fareyi ters çevir
                </label>
                <p>
                  Sesli sohbetin ses düzeyi değiştirilmez. Ayarlar yeni
                  antrenmanda uygulanır.
                </p>
                <button onClick={() => setPanel(null)}>Geri</button>
              </div>
            )}
            {panel === "controls" && (
              <div className="ks-controls">
                <h2>Kontroller</h2>
                <dl>
                  {[
                    ["W A S D", "Hareket"],
                    ["Fare", "Bakış ve nişan"],
                    ["Space", "Zıpla · yeniden zıplamak için bırakıp bas"],
                    ["Shift", "Koş"],
                    ["Ctrl / C", "Çömel · koşarken kay"],
                    ["Sol tık", "Ateş"],
                    ["Sağ tık", "ADS"],
                    ["R", "Şarjör yenile"],
                    ["1–5 / Tekerlek", "Silah seç"],
                    ["ESC", "Duraklat / fareyi bırak"],
                  ].map(([k, v]) => (
                    <React.Fragment key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <p>
                  Havada kontrollü yönlendirme ve zamanlamalı bunny hop vardır.
                  Hız sınırı 13 m/s. Şarjörler sınırlıdır; antrenmanda yedek
                  mühimmat sınırsızdır.
                </p>
                <p>
                  {WEAPON_ORDER.map(
                    (id) =>
                      `${WEAPONS[id].name}: ${WEAPONS[id].capacity} mermi`,
                  ).join(" · ")}
                </p>
                <button onClick={() => setPanel(null)}>Geri</button>
              </div>
            )}
            <footer>
              <button
                onClick={() =>
                  setPanel(panel === "settings" ? null : "settings")
                }
              >
                Ayarlar
              </button>
              <button
                onClick={() =>
                  setPanel(panel === "controls" ? null : "controls")
                }
              >
                Kontroller
              </button>
              <button
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else
                    void document
                      .querySelector(".ks-root")
                      ?.requestFullscreen()
                      .catch(() => setError("Tam ekran açılamadı."));
                }}
              >
                Tam ekran
              </button>
              {view === "pause" && <button onClick={exit}>Ana menü</button>}
              <button
                onClick={() => {
                  exit();
                  onBack();
                }}
              >
                Oyundan çık
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
