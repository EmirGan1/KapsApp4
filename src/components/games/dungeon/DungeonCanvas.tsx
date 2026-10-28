import React, { useEffect, useRef } from "react";
import { Run, Point, Tile } from "../../../games/dungeon/types";
import { CLASSES, ENEMIES } from "../../../games/dungeon/definitions";
const GLYPHS: Record<Tile, string> = {
  "#": "▓",
  ".": "·",
  "+": "+",
  D: "▣",
  ">": "⇩",
  C: "▤",
  H: "♥",
  M: "✦",
  "^": "^",
  "~": "≈",
  "!": "♨",
  S: "◈",
  U: "◇",
  K: "⚿",
};
export default function DungeonCanvas({
  run,
  userId,
  target,
  onTarget,
  contrast = false,
}: {
  run: Run;
  userId: number;
  target: Point;
  onTarget: (p: Point) => void;
  contrast?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(run),
    previous = useRef(run),
    received = useRef(performance.now()),
    camera = useRef({ x: 0, y: 0, size: 28, width: 0, height: 0 });
  useEffect(() => {
    previous.current = latest.current;
    latest.current = run;
    received.current = performance.now();
  }, [run]);
  useEffect(() => {
    const el = canvas.current!;
    let raf = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (now: number) => {
      const r = latest.current,
        p = r.players.find((p) => p.id === userId) || r.players[0],
        ctx = el.getContext("2d");
      if (!ctx || !p) return;
      const box = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 2);
      if (
        el.width !== Math.round(box.width * dpr) ||
        el.height !== Math.round(box.height * dpr)
      ) {
        el.width = Math.round(box.width * dpr);
        el.height = Math.round(box.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#090d13";
      ctx.fillRect(0, 0, box.width, box.height);
      const size = box.width < 600 ? 26 : 32,
        cx = p.x + 0.5 - box.width / size / 2,
        cy = p.y + 0.5 - box.height / size / 2;
      camera.current = {
        x: cx,
        y: cy,
        size,
        width: box.width,
        height: box.height,
      };
      const sx = (x: number) => (x - cx) * size,
        sy = (y: number) => (y - cy) * size;
      ctx.font = `${size * 0.65}px ui-monospace,monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (
        let y = Math.max(0, Math.floor(cy));
        y < Math.min(r.floor.height, cy + box.height / size + 1);
        y++
      )
        for (
          let x = Math.max(0, Math.floor(cx));
          x < Math.min(r.floor.width, cx + box.width / size + 1);
          x++
        ) {
          const idx = y * r.floor.width + x;
          if (!r.floor.explored[idx]) continue;
          const t = r.floor.tiles[idx];
          ctx.fillStyle =
            t === "#"
              ? contrast
                ? "#667387"
                : "#29313e"
              : r.depth === 2
                ? "#172332"
                : r.depth === 3
                  ? "#281b21"
                  : "#17201f";
          ctx.fillRect(sx(x), sy(y), size - 1, size - 1);
          ctx.fillStyle =
            t === "#"
              ? "#7c899b"
              : t === "."
                ? "#49595d"
                : t === "!" || t === "^"
                  ? "#ff9286"
                  : t === "H"
                    ? "#8ef0b8"
                    : t === "M"
                      ? "#8ddcff"
                      : "#f3d78b";
          ctx.fillText(GLYPHS[t] || "·", sx(x + 0.5), sy(y + 0.5));
        }
      for (const z of r.zones) {
        ctx.fillStyle =
          z.kind === "heal"
            ? "#4ade8038"
            : z.owner === "hero"
              ? "#a78bfa55"
              : "#fb5d6055";
        ctx.strokeStyle = z.owner === "hero" ? "#c4b5fd" : "#ff8b8b";
        ctx.setLineDash(z.at > r.tick ? [5, 4] : []);
        ctx.beginPath();
        ctx.arc(sx(z.x + 0.5), sy(z.y + 0.5), z.radius * size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        ctx.fillText(
          z.owner === "enemy" ? "!" : "✦",
          sx(z.x + 0.5),
          sy(z.y + 0.5),
        );
      }
      for (const l of r.loot.filter((l) => l.owner === userId)) {
        ctx.fillStyle = "#f4cf77";
        ctx.fillText("◆", sx(l.x + 0.5), sy(l.y + 0.5));
      }
      const blend = Math.min(1, (now - received.current) / 100);
      for (const e of r.enemies) {
        const old =
          previous.current.depth === r.depth
            ? previous.current.enemies.find((a) => a.id === e.id)
            : undefined;
        const x = old && !reduced ? old.x + (e.x - old.x) * blend : e.x,
          y = old && !reduced ? old.y + (e.y - old.y) * blend : e.y;
        ctx.fillStyle = e.boss ? "#ffcc73" : "#ff9c91";
        ctx.font = `bold ${e.boss ? size * 0.95 : size * 0.75}px ui-monospace,monospace`;
        ctx.fillText(ENEMIES[e.kind].symbol, sx(x + 0.5), sy(y + 0.5));
        ctx.fillStyle = "#54303a";
        ctx.fillRect(sx(x), sy(y) - 2, size, 3);
        ctx.fillStyle = "#ff887a";
        ctx.fillRect(sx(x), sy(y) - 2, (size * e.hp) / e.maxHp, 3);
        if (e.effects.length) {
          ctx.font = "10px monospace";
          ctx.fillText(
            e.effects
              .map((a) =>
                a.kind === "freeze" ? "❄" : a.kind === "burn" ? "*" : "!",
              )
              .join(""),
            sx(x + 0.5),
            sy(y + 1),
          );
        }
      }
      for (const a of r.players) {
        if (a.dead) continue;
        ctx.font = `bold ${size * 0.8}px ui-monospace,monospace`;
        ctx.fillStyle = a.connected ? CLASSES[a.hero].color : "#77808d";
        ctx.fillText(
          a.hp > 0 ? CLASSES[a.hero].symbol : "†",
          sx(a.x + 0.5),
          sy(a.y + 0.5),
        );
        if (a.id === userId) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(sx(a.x) + 2, sy(a.y) + 2, size - 4, size - 4);
        }
        ctx.font = "10px ui-monospace,monospace";
        ctx.fillStyle = "#eef2f6";
        ctx.fillText(a.name.slice(0, 12), sx(a.x + 0.5), sy(a.y) - 6);
        if (a.ping && a.ping.until > r.tick) {
          ctx.fillStyle = "#ffe2a1";
          ctx.fillText(a.ping.text, sx(a.x + 0.5), sy(a.y + 1) + 7);
        }
        if (a.revive) {
          ctx.fillStyle = "#7befbc";
          ctx.fillText("Canlandırıyor…", sx(a.x + 0.5), sy(a.y + 1) + 9);
        }
      }
      for (const b of r.projectiles) {
        ctx.fillStyle = b.owner === "hero" ? "#c9baff" : "#ffab80";
        ctx.beginPath();
        ctx.arc(sx(b.x + 0.5), sy(b.y + 0.5), 4, 0, 7);
        ctx.fill();
      }
      ctx.strokeStyle = "#f6de92";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx(target.x) + 1, sy(target.y) + 1, size - 2, size - 2);
      // Explored mini-map, including party dots; no hidden enemies or objectives revealed.
      const scale = 1.5,
        mx = box.width - r.floor.width * scale - 10,
        my = 10;
      ctx.fillStyle = "#000b";
      ctx.fillRect(
        mx - 4,
        my - 4,
        r.floor.width * scale + 8,
        r.floor.height * scale + 8,
      );
      for (let i = 0; i < r.floor.tiles.length; i++)
        if (r.floor.explored[i] && r.floor.tiles[i] !== "#") {
          ctx.fillStyle = "#758477";
          ctx.fillRect(
            mx + (i % r.floor.width) * scale,
            my + Math.floor(i / r.floor.width) * scale,
            scale,
            scale,
          );
        }
      for (const a of r.players) {
        ctx.fillStyle = CLASSES[a.hero].color;
        ctx.fillRect(mx + a.x * scale - 1, my + a.y * scale - 1, 3, 3);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [userId, target.x, target.y, contrast]);
  return (
    <canvas
      ref={canvas}
      className="ds-canvas"
      aria-label="Zindan haritası. W A S D veya yön tuşlarıyla hareket et; hedef seçmek için haritaya dokun."
      onPointerDown={(e) => {
        const b = e.currentTarget.getBoundingClientRect(),
          c = camera.current;
        const x = Math.floor((e.clientX - b.left) / c.size + c.x),
          y = Math.floor((e.clientY - b.top) / c.size + c.y);
        if (x >= 0 && y >= 0 && x < run.floor.width && y < run.floor.height)
          onTarget({ x, y });
      }}
    />
  );
}
