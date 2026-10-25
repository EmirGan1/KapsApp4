import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MAP_WIDTH, MAP_HEIGHT, TOTAL_PIXELS } from '../../../utils/kapstorialMaps';

export interface CanvasPlayerInfo {
  id: number;
  userId: number;
  username: string;
  color: string;
  troops: number;
  pixels: number;
  centroidX: number;
  centroidY: number;
  isAlive: boolean;
  spawnPixel: number | null;
  attackPercentage?: number;
}

export interface CanvasBoatInfo {
  id: string;
  ownerId: number;
  troops: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface CanvasEmojiInfo {
  id: string;
  ownerId: number;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
  expiresAt: number;
}

interface KapstorialCanvasProps {
  terrain: Uint8Array | null;
  owners: Uint16Array | null;
  players: CanvasPlayerInfo[];
  boats: CanvasBoatInfo[];
  emojis: CanvasEmojiInfo[];
  myPlayerId: number | null;
  gameStatus: 'waiting' | 'spawn_phase' | 'running' | 'game_over';
  selectedSpawnPixel: number | null;
  onSelectSpawn?: (pixelIndex: number) => void;
  onMapClick?: (pixelIndex: number, ownerId: number, screenX: number, screenY: number) => void;
}

// Helper to parse hex color '#rrggbb' into [r, g, b]
function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) || 100;
  const g = parseInt(clean.substring(2, 4), 16) || 100;
  const b = parseInt(clean.substring(4, 6), 16) || 100;
  return [r, g, b];
}

function darkenRgb(rgb: [number, number, number], factor = 0.65): [number, number, number] {
  return [
    Math.round(rgb[0] * factor),
    Math.round(rgb[1] * factor),
    Math.round(rgb[2] * factor)
  ];
}

// Pre-defined Terrain RGB Colors
const WATER_COLOR_A: [number, number, number] = [15, 23, 42];     // #0f172a (Deep Navy)
const WATER_COLOR_B: [number, number, number] = [30, 41, 59];     // #1e293b (Ocean Wave)
const NEUTRAL_LAND_COLOR: [number, number, number] = [180, 190, 205]; // Clear Neutral Gray/Beige
const MOUNTAIN_COLOR: [number, number, number] = [51, 65, 85];    // #334155 (Dark Mountain)
const SPAWN_PREVIEW_COLOR: [number, number, number] = [56, 189, 248]; // #38bdf8 (Sky Blue)

export default function KapstorialCanvas({
  terrain,
  owners,
  players,
  boats,
  emojis,
  myPlayerId,
  gameStatus,
  selectedSpawnPixel,
  onSelectSpawn,
  onMapClick
}: KapstorialCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera Transformation (Pan & Zoom)
  const [camera, setCamera] = useState<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1
  });

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const didDragRef = useRef<boolean>(false);

  // Hovered Pixel for Reticle
  const [hoveredPixel, setHoveredPixel] = useState<{
    x: number;
    y: number;
    pixelIdx: number;
    ownerId: number;
    terrain: number;
  } | null>(null);

  const offscreenImageDataRef = useRef<ImageData | null>(null);
  const playerRgbMapRef = useRef<Map<number, { normal: [number, number, number]; border: [number, number, number] }>>(new Map());

  useEffect(() => {
    const map = new Map<number, { normal: [number, number, number]; border: [number, number, number] }>();
    for (const p of players) {
      const normal = hexToRgb(p.color);
      const border = darkenRgb(normal, 0.6);
      map.set(p.id, { normal, border });
    }
    playerRgbMapRef.current = map;
  }, [players]);

  // Initialize Offscreen Canvas
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      const oc = document.createElement('canvas');
      oc.width = MAP_WIDTH;
      oc.height = MAP_HEIGHT;
      offscreenCanvasRef.current = oc;
      const ctx = oc.getContext('2d');
      if (ctx) {
        offscreenImageDataRef.current = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
      }
    }
  }, []);

  // Center camera on initial load
  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const initialZoom = Math.min(w / MAP_WIDTH, h / MAP_HEIGHT) * 0.92;
    const initialX = (w - MAP_WIDTH * initialZoom) / 2;
    const initialY = (h - MAP_HEIGHT * initialZoom) / 2;
    setCamera({ x: initialX, y: initialY, zoom: initialZoom });
  }, []);

  const screenToMap = useCallback((screenX: number, screenY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0, pixelIdx: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = screenX - rect.left - camera.x;
    const cy = screenY - rect.top - camera.y;
    const mx = Math.floor(cx / camera.zoom);
    const my = Math.floor(cy / camera.zoom);
    const clampedX = Math.max(0, Math.min(MAP_WIDTH - 1, mx));
    const clampedY = Math.max(0, Math.min(MAP_HEIGHT - 1, my));
    return {
      x: clampedX,
      y: clampedY,
      pixelIdx: clampedY * MAP_WIDTH + clampedX
    };
  }, [camera]);

  // Main Render Loop (60 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offscreen = offscreenCanvasRef.current;
    const offscreenCtx = offscreen?.getContext('2d');
    const imageData = offscreenImageDataRef.current;
    if (!offscreen || !offscreenCtx || !imageData) return;

    let animId: number;

    const render = () => {
      const data = imageData.data;
      const colorMap = playerRgbMapRef.current;
      const hasTerrain = terrain && terrain.length === TOTAL_PIXELS;
      const hasOwners = owners && owners.length === TOTAL_PIXELS;

      // Fill pixel buffer safely using RGBA
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const yOffset = y * MAP_WIDTH;
        for (let x = 0; x < MAP_WIDTH; x++) {
          const idx = yOffset + x;
          const pixelPtr = idx * 4;

          const t = hasTerrain ? terrain[idx] : 0;
          const o = hasOwners ? owners[idx] : 0;

          let r = 20, g = 30, b = 50; // default deep water

          if (t === 0) {
            // Ocean Water
            const waterColor = (x + y) % 16 === 0 ? WATER_COLOR_B : WATER_COLOR_A;
            r = waterColor[0];
            g = waterColor[1];
            b = waterColor[2];
          } else if (t === 2) {
            // Mountain
            r = MOUNTAIN_COLOR[0];
            g = MOUNTAIN_COLOR[1];
            b = MOUNTAIN_COLOR[2];
          } else if (o === 0) {
            // Neutral Land
            r = NEUTRAL_LAND_COLOR[0];
            g = NEUTRAL_LAND_COLOR[1];
            b = NEUTRAL_LAND_COLOR[2];
          } else {
            // Owned Territory
            const pColor = colorMap.get(o);
            if (!pColor) {
              r = NEUTRAL_LAND_COLOR[0];
              g = NEUTRAL_LAND_COLOR[1];
              b = NEUTRAL_LAND_COLOR[2];
            } else {
              // Border detection
              let isBorder = false;
              if (hasOwners) {
                if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
                  isBorder = true;
                } else {
                  const up = owners[idx - MAP_WIDTH];
                  const down = owners[idx + MAP_WIDTH];
                  const left = owners[idx - 1];
                  const right = owners[idx + 1];
                  if (up !== o || down !== o || left !== o || right !== o) {
                    isBorder = true;
                  }
                }
              }

              const rgb = isBorder ? pColor.border : pColor.normal;
              r = rgb[0];
              g = rgb[1];
              b = rgb[2];
            }
          }

          // Highlight spawn selection
          if (gameStatus === 'spawn_phase' && selectedSpawnPixel === idx) {
            r = SPAWN_PREVIEW_COLOR[0];
            g = SPAWN_PREVIEW_COLOR[1];
            b = SPAWN_PREVIEW_COLOR[2];
          }

          data[pixelPtr] = r;
          data[pixelPtr + 1] = g;
          data[pixelPtr + 2] = b;
          data[pixelPtr + 3] = 255; // Alpha
        }
      }

      offscreenCtx.putImageData(imageData, 0, 0);

      // Render onto main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0);

      // Render Boats
      if (boats.length > 0) {
        for (const boat of boats) {
          const owner = players.find(p => p.id === boat.ownerId);
          const boatColor = owner ? owner.color : '#ffffff';

          ctx.save();
          ctx.translate(boat.x, boat.y);
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(-4, -2.5, 8, 5, 2);
          ctx.fill();

          ctx.fillStyle = boatColor;
          ctx.beginPath();
          ctx.arc(0, 0, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 3px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const tText = boat.troops > 1000 ? `${(boat.troops / 1000).toFixed(1)}K` : `${boat.troops}`;
          ctx.fillText(tText, 0, -4.5);
          ctx.restore();
        }
      }

      // Render Centroid Labels & Troop Counts
      if (gameStatus === 'running' || gameStatus === 'game_over') {
        const sortedPlayers = [...players].sort((a, b) => b.pixels - a.pixels);
        const leaderId = sortedPlayers[0]?.id;

        for (const p of players) {
          if (!p.isAlive || p.pixels < 8) continue;

          const scaleFactor = Math.min(2.8, Math.max(0.9, Math.sqrt(p.pixels) * 0.1));
          const nameFontSize = Math.round(4.5 * scaleFactor);
          const troopsFontSize = Math.round(5.5 * scaleFactor);

          const cx = p.centroidX;
          const cy = p.centroidY;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          let troopsFormatted = `${p.troops}`;
          if (p.troops >= 1_000_000) {
            troopsFormatted = `${(p.troops / 1_000_000).toFixed(2)}M`;
          } else if (p.troops >= 1_000) {
            troopsFormatted = `${(p.troops / 1_000).toFixed(1)}K`;
          }

          if (p.id === leaderId && p.pixels > 30) {
            ctx.font = `${Math.round(nameFontSize * 1.3)}px sans-serif`;
            ctx.fillText('👑', cx, cy - nameFontSize - 2.5);
          }

          ctx.font = `900 ${nameFontSize}px system-ui, -apple-system, sans-serif`;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.lineWidth = 1.6;
          ctx.strokeText(p.username, cx, cy - 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(p.username, cx, cy - 2);

          ctx.font = `900 ${troopsFontSize}px system-ui, -apple-system, sans-serif`;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.lineWidth = 1.8;
          ctx.strokeText(troopsFormatted, cx, cy + troopsFontSize * 0.7);

          const softCap = p.pixels * 100;
          const hardCap = p.pixels * 150;
          let troopFill = '#ffffff';
          if (p.troops >= hardCap * 0.95) troopFill = '#f87171';
          else if (p.troops >= softCap) troopFill = '#fde047';

          ctx.fillStyle = troopFill;
          ctx.fillText(troopsFormatted, cx, cy + troopsFontSize * 0.7);
          ctx.restore();
        }
      }

      // Render Emojis
      const now = Date.now();
      for (const emoji of emojis) {
        if (emoji.expiresAt <= now) continue;
        const age = now - emoji.createdAt;
        const progress = age / (emoji.expiresAt - emoji.createdAt);
        const floatY = emoji.y - progress * 12;
        const alpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji.emoji, emoji.x, floatY);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [terrain, owners, players, boats, emojis, camera, gameStatus, selectedSpawnPixel]);

  // Handle Resize with window.innerWidth / window.innerHeight
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.max(0.5, Math.min(10, camera.zoom * zoomFactor));

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
    const newY = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);

    setCamera({ x: newX, y: newY, zoom: newZoom });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    cameraStartRef.current = { x: camera.x, y: camera.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true;
        setCamera({
          ...camera,
          x: cameraStartRef.current.x + dx,
          y: cameraStartRef.current.y + dy
        });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;

    if (!didDragRef.current && e.button === 0) {
      const mapPos = screenToMap(e.clientX, e.clientY);

      if (gameStatus === 'spawn_phase') {
        if (terrain && terrain[mapPos.pixelIdx] === 1 && onSelectSpawn) {
          onSelectSpawn(mapPos.pixelIdx);
        }
      } else if (gameStatus === 'running' && onMapClick && owners) {
        onMapClick(mapPos.pixelIdx, owners[mapPos.pixelIdx] || 0, e.clientX, e.clientY);
      }
    }
  };

  // Touch Support
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartCameraRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      isDraggingRef.current = true;
      didDragRef.current = false;
      dragStartRef.current = { x: t.clientX, y: t.clientY };
      cameraStartRef.current = { x: camera.x, y: camera.y };
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartCameraRef.current = { ...camera };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragStartRef.current.x;
      const dy = t.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDragRef.current = true;
        setCamera({
          ...camera,
          x: cameraStartRef.current.x + dx,
          y: cameraStartRef.current.y + dy
        });
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = currentDist / touchStartDistRef.current;
      const newZoom = Math.max(0.5, Math.min(10, touchStartCameraRef.current.zoom * ratio));
      setCamera({
        ...camera,
        zoom: newZoom
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!didDragRef.current && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const mapPos = screenToMap(t.clientX, t.clientY);

      if (gameStatus === 'spawn_phase') {
        if (terrain && terrain[mapPos.pixelIdx] === 1 && onSelectSpawn) {
          onSelectSpawn(mapPos.pixelIdx);
        }
      } else if (gameStatus === 'running' && onMapClick && owners) {
        onMapClick(mapPos.pixelIdx, owners[mapPos.pixelIdx] || 0, t.clientX, t.clientY);
      }
    }
    isDraggingRef.current = false;
    touchStartDistRef.current = null;
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute top-0 left-0 w-screen h-screen z-0 bg-slate-950 overflow-hidden select-none cursor-crosshair touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full block"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {gameStatus === 'spawn_phase' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-sky-950/90 backdrop-blur-md border border-sky-500/50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse pointer-events-none z-10">
          <span className="text-xl">📍</span>
          <span className="text-xs sm:text-sm font-bold text-sky-200">
            {selectedSpawnPixel !== null
              ? 'Konumunuz seçildi! Süre bitene kadar haritaya tıklayarak değiştirebilirsiniz.'
              : 'Başlamak istediğiniz kara parçasına tıklayarak spawn noktanızı seçin!'}
          </span>
        </div>
      )}
    </div>
  );
}
