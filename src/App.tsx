import { useCallback, useEffect, useRef, useState } from "react";
import { CHARACTERS, GameEngine, LEVELS, type CharId, type HudData } from "./game/engine";
import HUD, { type ToastItem } from "./components/HUD";
import { MenuScreen, PauseScreen, EndScreen, type SaveData } from "./components/Screens";

const SAVE_KEY = "fanagh-save-v1";

const loadSave = (): SaveData => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<SaveData>;
      return {
        unlocked: typeof p.unlocked === "number" ? Math.min(2, Math.max(0, p.unlocked)) : 0,
        stars: p.stars && typeof p.stars === "object" ? p.stars : {},
        char: p.char === "wolf" || p.char === "bear" ? p.char : "fox",
      };
    }
  } catch {
    /* corrupted save — start fresh */
  }
  return { unlocked: 0, stars: {}, char: "fox" };
};

const initialHud: HudData = {
  phase: "menu",
  crystals: 0,
  total: LEVELS[0].crystals,
  hearts: CHARACTERS[0].hearts,
  maxHearts: CHARACTERS[0].hearts,
  time: LEVELS[0].time,
  score: 0,
  portalOpen: false,
  lostReason: null,
  timeBonus: 0,
  heartsBonus: 0,
  kills: 0,
  killsRequired: LEVELS[0].killsRequired,
  levelId: 0,
  levelName: LEVELS[0].title,
  charName: CHARACTERS[0].name,
  bossHp: 0,
  bossMax: 0,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudData>(initialHud);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [muted, setMuted] = useState(false);
  const [save, setSave] = useState<SaveData>(loadSave);
  const [charId, setCharId] = useState<CharId>(save.char);
  const [levelId, setLevelId] = useState(Math.min(save.unlocked, LEVELS.length - 1));
  const toastId = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const engine = new GameEngine(el, {
      onHud: (d) => setHud(d),
      onToast: (text, tone) => {
        const id = ++toastId.current;
        setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
        window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
      },
      onMuteToggle: () =>
        setMuted((prev) => {
          engine.setMuted(!prev);
          return !prev;
        }),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const minimapRef = useCallback((canvas: HTMLCanvasElement | null) => {
    engineRef.current?.attachMinimap(canvas);
  }, []);

  const eng = () => engineRef.current;

  // persist progress when a mission is won
  useEffect(() => {
    if (hud.phase !== "won") return;
    setSave((s) => {
      const ratio = hud.hearts / Math.max(1, hud.maxHearts);
      const earned = ratio >= 0.999 ? 3 : ratio >= 0.5 ? 2 : 1;
      const next: SaveData = {
        unlocked: Math.max(s.unlocked, Math.min(hud.levelId + 1, LEVELS.length - 1)),
        stars: { ...s.stars, [hud.levelId]: Math.max(s.stars[hud.levelId] ?? 0, earned) },
        char: s.char,
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      } catch {
        /* private mode — ignore */
      }
      return next;
    });
  }, [hud.phase, hud.levelId, hud.hearts, hud.maxHearts]);

  const starsForEnd =
    hud.hearts >= hud.maxHearts ? 3 : hud.hearts >= Math.ceil(hud.maxHearts / 2) ? 2 : 1;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-night-950" dir="rtl">
      {/* 3D world mounts here */}
      <div ref={containerRef} className="absolute inset-0" />
      <div className="vignette pointer-events-none absolute inset-0 z-[5]" />

      {(hud.phase === "playing" || hud.phase === "paused") && (
        <HUD
          hud={hud}
          toasts={toasts}
          muted={muted}
          onTogglePause={() => eng()?.togglePause()}
          onToggleMute={() =>
            setMuted((prev) => {
              eng()?.setMuted(!prev);
              return !prev;
            })
          }
          minimapRef={minimapRef}
        />
      )}

      {hud.phase === "menu" && (
        <MenuScreen
          charId={charId}
          levelId={levelId}
          save={save}
          onSelectChar={(id) => {
            setCharId(id);
            setSave((s) => {
              const next = { ...s, char: id };
              try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(next));
              } catch {
                /* ignore */
              }
              return next;
            });
            eng()?.setCharacter(id);
          }}
          onSelectLevel={(lv) => setLevelId(lv)}
          onStart={() => eng()?.start(charId, levelId)}
        />
      )}

      {hud.phase === "paused" && (
        <PauseScreen
          onResume={() => eng()?.resume()}
          onRestart={() => eng()?.restart()}
          onMenu={() => eng()?.toMenu()}
        />
      )}

      {(hud.phase === "won" || hud.phase === "lost") && (
        <EndScreen
          hud={hud}
          stars={starsForEnd}
          hasNext={hud.phase === "won" && hud.levelId < LEVELS.length - 1}
          onRestart={() => eng()?.restart()}
          onNext={() => {
            const n = Math.min(hud.levelId + 1, LEVELS.length - 1);
            setLevelId(n);
            eng()?.start(charId, n);
          }}
          onMenu={() => eng()?.toMenu()}
        />
      )}
    </div>
  );
}
