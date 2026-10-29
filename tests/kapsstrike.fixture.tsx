import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { StrikeRenderer } from "../src/games/kapsstrike/renderer";
import { MAPS } from "../src/games/kapsstrike/maps";
import React from "react";
import { createRoot } from "react-dom/client";
import KapsStrikeGame from "../src/components/games/kapsstrike/KapsStrikeGame";
import { StrikeController } from "../src/games/kapsstrike/controller";
import { DEFAULT_SETTINGS } from "../src/games/kapsstrike/config";
import { MapId, StrikeSettings } from "../src/games/kapsstrike/types";
const query = new URLSearchParams(location.search);
if (query.get("mode") === "engine") {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100vw;height:100vh;display:block";
  document.body.append(canvas);
  const start = document.createElement("button");
  start.textContent = "Start test";
  start.style.cssText = "position:fixed;top:0;left:0;z-index:5";
  document.body.append(start);
  let engine: StrikeController | null = null;
  start.onclick = () => {
    engine?.dispose();
    const injected =
      query.get("renderer") === "null"
        ? new StrikeRenderer(
            canvas,
            MAPS[(query.get("map") || "warehouse") as MapId],
            {
              ...DEFAULT_SETTINGS,
              quality: (query.get("quality") ||
                "low") as StrikeSettings["quality"],
            },
            new NullEngine(),
          )
        : undefined;
    engine = new StrikeController(
      canvas,
      (query.get("map") || "warehouse") as MapId,
      {
        ...DEFAULT_SETTINGS,
        quality: (query.get("quality") || "low") as StrikeSettings["quality"],
      },
      (s) => ((window as any).hud = s),
      (reason) => ((window as any).paused = reason || true),
      injected,
    );
    (window as any).strike = engine;
    engine.start();
  };
} else
  createRoot(document.getElementById("root")!).render(
    <KapsStrikeGame
      onBack={() => {
        document.getElementById("root")!.textContent = "Exited";
      }}
    />,
  );
