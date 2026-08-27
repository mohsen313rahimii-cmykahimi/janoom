import type { HudData } from "../game/engine";
import { fa } from "../game/engine";

export interface ToastItem {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${fa(m)}:${fa(s).padStart(2, "۰")}`;
};

const IconHeart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow" aria-hidden>
    <path
      d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.2 4.9 5.7 4.3c2-.3 3.9.6 5 2.2h2.6c1.1-1.6 3-2.5 5-2.2 3.5.6 5.3 4.3 3.7 7.4C19.5 16.4 12 21 12 21z"
      transform="scale(0.92) translate(1,0)"
      fill={on ? "#ff5d73" : "#2b335f"}
      stroke={on ? "#ffd0d8" : "#3a4480"}
      strokeWidth="1.2"
    />
  </svg>
);

const IconDiamond = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${on ? "anim-gem" : ""}`} aria-hidden>
    <path
      d="M12 2 21 9 12 22 3 9z"
      fill={on ? "#35e0c2" : "#202a58"}
      stroke={on ? "#b8fff1" : "#3a4480"}
      strokeWidth="1.4"
    />
    {on && <path d="M12 2 15.5 9 12 22 8.5 9z" fill="#8ff2de" opacity="0.7" />}
  </svg>
);

const IconCheck = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <circle cx="12" cy="12" r="9" fill={on ? "#17997f" : "#202a58"} stroke={on ? "#35e0c2" : "#3a4480"} strokeWidth="1.5" />
    {on && <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#d8fff6" strokeWidth="2.4" strokeLinecap="round" />}
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <rect x="5" y="4" width="5" height="16" rx="1" />
    <rect x="14" y="4" width="5" height="16" rx="1" />
  </svg>
);
const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);
const IconSound = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
    <path d="M4 9v6h4l6 5V4L8 9H4z" />
    {off ? (
      <path d="M16 8l6 8M22 8l-6 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    ) : (
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    )}
  </svg>
);

interface HUDProps {
  hud: HudData;
  toasts: ToastItem[];
  muted: boolean;
  onTogglePause: () => void;
  onToggleMute: () => void;
  minimapRef: (el: HTMLCanvasElement | null) => void;
}

export default function HUD({ hud, toasts, muted, onTogglePause, onToggleMute, minimapRef }: HUDProps) {
  const danger = hud.time <= 30;
  const needKills = hud.killsRequired > 0;
  const crystalsDone = hud.crystals >= hud.total;
  const killsDone = hud.kills >= hud.killsRequired;
  const showBossBar = hud.bossMax > 0 && hud.bossHp > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* mission panel — right (RTL start) */}
      <div className="hud-panel panel-cut absolute top-3 right-3 w-64 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg leading-none text-star">{hud.levelName}</span>
          <span className="text-[10px] font-bold text-moon/50">{hud.charName}</span>
        </div>

        <div className="mt-2 flex items-center gap-2" dir="ltr">
          {hud.total <= 10 ? (
            Array.from({ length: hud.total }).map((_, i) => (
              <span key={i} className={i < hud.crystals ? "anim-pop" : ""}>
                <IconDiamond on={i < hud.crystals} />
              </span>
            ))
          ) : (
            <span className="font-display text-xl text-gem" dir="rtl">
              {fa(hud.crystals)} از {fa(hud.total)} بلور
            </span>
          )}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-night-950/80 ring-1 ring-night-line">
          <div
            className="h-full rounded-sm bg-gradient-to-l from-gem to-gem-deep transition-all duration-500"
            style={{ width: `${Math.min(100, (hud.crystals / hud.total) * 100)}%` }}
          />
        </div>

        {/* live objective checklist */}
        <ul className="mt-2.5 space-y-1 text-[11.5px] font-medium">
          <li className={`flex items-center gap-1.5 ${crystalsDone ? "text-gem" : "text-moon/75"}`}>
            <IconCheck on={crystalsDone} />
            <span>جمع‌آوری {fa(hud.total)} بلور ستاره‌ای</span>
          </li>
          {needKills && (
            <li className={`flex items-center gap-1.5 ${killsDone ? "text-gem" : "text-moon/75"}`}>
              <IconCheck on={killsDone} />
              <span>
                شکار {fa(hud.killsRequired)} دشمن
                <b className="mx-1 text-ember">({fa(Math.min(hud.kills, hud.killsRequired))})</b>
              </span>
            </li>
          )}
          <li className={`flex items-center gap-1.5 ${hud.portalOpen ? "anim-blink text-star" : "text-moon/45"}`}>
            <IconCheck on={hud.portalOpen} />
            <span>گذر از دروازهٔ نور</span>
          </li>
        </ul>
      </div>

      {/* timer + hearts — left */}
      <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
        <div className={`hud-panel panel-cut px-4 py-2 ${danger ? "ring-2 ring-ember" : ""}`}>
          <div className="flex items-center gap-2" dir="ltr">
            <svg viewBox="0 0 24 24" className={`h-5 w-5 ${danger ? "text-ember" : "text-moon/70"}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" strokeLinecap="round" />
            </svg>
            <span
              className={`font-display text-3xl leading-none tabular-nums ${danger ? "anim-blink text-ember" : "text-moon"}`}
            >
              {fmtTime(hud.time)}
            </span>
          </div>
        </div>
        <div className="hud-panel panel-cut-sm flex items-center gap-1 px-3 py-1.5" key={hud.hearts}>
          {Array.from({ length: hud.maxHearts }).map((_, i) => (
            <span key={i} className={i === hud.hearts ? "anim-heart" : ""}>
              <IconHeart on={i < hud.hearts} />
            </span>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={onTogglePause}
            className="hud-panel panel-cut-sm flex h-9 w-9 items-center justify-center text-moon/80 transition hover:text-star"
            title="توقف (P)"
          >
            {hud.phase === "paused" ? <IconPlay /> : <IconPause />}
          </button>
          <button
            onClick={onToggleMute}
            className="hud-panel panel-cut-sm flex h-9 w-9 items-center justify-center text-moon/80 transition hover:text-star"
            title="صدا (M)"
          >
            <IconSound off={muted} />
          </button>
        </div>
      </div>

      {/* score + boss bar — top center */}
      <div className="absolute top-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="hud-panel panel-cut px-5 py-1.5 text-center">
          <span className="text-[10px] font-bold tracking-widest text-moon/60">امتیاز</span>
          <div key={hud.score} className="anim-pop font-display text-2xl leading-tight text-star">
            {fa(hud.score)}
          </div>
        </div>
        {showBossBar && (
          <div className="hud-panel panel-cut-sm w-72 px-3 py-2">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="font-display text-sm text-ember">سایه‌شاه</span>
              <span className="text-moon/70" dir="ltr">
                {fa(hud.bossHp)} / {fa(hud.bossMax)}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-night-950/80 ring-1 ring-night-line">
              <div
                className="h-full rounded-sm bg-gradient-to-l from-ember to-[#a11f3a] transition-all duration-300"
                style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* toasts */}
      <div className="absolute top-24 left-1/2 flex w-full -translate-x-1/2 flex-col items-center gap-1.5 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-toast panel-cut-sm px-4 py-1.5 font-display text-lg leading-tight ${
              t.tone === "good"
                ? "bg-gem-deep/90 text-[#d8fff6] shadow-[0_4px_0_rgba(4,7,22,0.5)]"
                : t.tone === "bad"
                  ? "bg-[#7a2438]/90 text-[#ffd9df] shadow-[0_4px_0_rgba(4,7,22,0.5)]"
                  : "bg-night-700/90 text-moon shadow-[0_4px_0_rgba(4,7,22,0.5)]"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* minimap — bottom right */}
      <div className="hud-panel absolute right-3 bottom-3 rounded-full p-1.5">
        <canvas ref={minimapRef} width={148} height={148} className="block h-[124px] w-[124px]" />
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 panel-cut-sm whitespace-nowrap bg-night-700 px-2 py-0.5 text-[10px] font-bold text-moon/70">
          نقشه — فلش بالای سر، مسیر را نشان می‌دهد
        </div>
      </div>

      {/* controls — bottom left */}
      <div className="hud-panel panel-cut absolute bottom-3 left-3 flex flex-col gap-1.5 px-3.5 py-2.5 text-[11px] text-moon/75">
        <div className="flex items-center gap-2">
          <span className="kbd-chip">W A S D</span>
          <span>حرکت</span>
          <span className="kbd-chip">Space</span>
          <span>پرش</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="kbd-chip">Shift</span>
          <span>جهش سریع</span>
          <span className="kbd-chip">P</span>
          <span>توقف</span>
        </div>
        <p className="mt-0.5 text-[10px] text-moon/45">
          W = عمق تصویر (دور از دوربین) • روی سر دشمنان بپر تا شکارشان کنی!
        </p>
      </div>
    </div>
  );
}
