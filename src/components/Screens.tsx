import type { CSSProperties } from "react";
import type { CharId, HudData } from "../game/engine";
import { CHARACTERS, LEVELS, fa } from "../game/engine";
import { fmtTime } from "./HUD";

export interface SaveData {
  unlocked: number;
  stars: Record<number, number>;
  char: CharId;
}

const GemIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path d="M12 2 21 9 12 22 3 9z" fill="#35e0c2" stroke="#b8fff1" strokeWidth="1.3" />
    <path d="M12 2 15.5 9 12 22 8.5 9z" fill="#8ff2de" opacity="0.7" />
  </svg>
);
const PortalIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <ellipse cx="12" cy="12" rx="7" ry="9.5" stroke="#ffb43a" strokeWidth="2.4" />
    <ellipse cx="12" cy="12" rx="3.4" ry="5.4" stroke="#ffd98f" strokeWidth="1.6" opacity="0.8" />
  </svg>
);
const SkullIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#ff5d73" aria-hidden>
    <path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5.3 4 6.7V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3c2.4-1.4 4-3.7 4-6.7a8 8 0 0 0-8-8zM8.5 12.5A1.8 1.8 0 1 1 10.3 10.7 1.8 1.8 0 0 1 8.5 12.5zm7 0a1.8 1.8 0 1 1 1.8-1.8 1.8 1.8 0 0 1-1.8 1.8zM12 14l1.2 2.4h-2.4z" />
  </svg>
);
const LockIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#8a93c4" aria-hidden>
    <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" />
  </svg>
);
const StarIcon = ({ on, delay, small }: { on: boolean; delay?: number; small?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`${small ? "h-4 w-4" : "h-12 w-12"} ${on ? (small ? "" : "anim-star") : "opacity-25"}`}
    style={on && !small && delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    aria-hidden
  >
    <path
      d="M12 1.8l3.1 6.4 7 1-5 5 1.2 7L12 17.9l-6.3 3.3 1.2-7-5-5 7-1z"
      fill={on ? "#ffb43a" : "#3a4480"}
      stroke={on ? "#ffe3ad" : "#3a4480"}
      strokeWidth="1"
    />
  </svg>
);

const KeyRow = ({ keys, label }: { keys: string[]; label: string }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-sm text-moon/85">{label}</span>
    <span className="flex gap-1" dir="ltr">
      {keys.map((k) => (
        <span key={k} className="kbd-chip">
          {k}
        </span>
      ))}
    </span>
  </div>
);

const StatPips = ({ value, color }: { value: number; color: string }) => (
  <span className="flex gap-0.5" dir="ltr">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="inline-block h-1.5 w-3 rounded-[2px]"
        style={{ background: i < value ? color : "#2b335f" }}
      />
    ))}
  </span>
);

/* ================= menu (lobby) ================= */

interface MenuProps {
  charId: CharId;
  levelId: number;
  save: SaveData;
  onSelectChar: (id: CharId) => void;
  onSelectLevel: (lv: number) => void;
  onStart: () => void;
}

export function MenuScreen({ charId, levelId, save, onSelectChar, onSelectLevel, onStart }: MenuProps) {
  const level = LEVELS[levelId];
  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-gradient-to-l from-night-950/88 via-night-950/15 to-night-950/88 px-5 py-6 md:px-10">
      {/* title row */}
      <div className="anim-rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="panel-cut-sm inline-flex items-center gap-2 bg-night-700/80 px-3 py-1.5 text-xs font-bold text-gem ring-1 ring-night-line">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gem" />
            بازی سه‌بعدیِ مأموریتی — جزیره‌های شناور
          </div>
          <h1 className="font-display title-shadow mt-2 text-5xl leading-[1.02] text-star md:text-6xl">
            فندق <span className="text-3xl text-moon md:text-4xl">و بلورهای گمشده</span>
          </h1>
        </div>
        <p className="max-w-sm text-[13px] leading-6 text-moon/75">
          سایه‌وارها بیدار شده‌اند و بلورهای آسمان در گرگ‌ومیش گم شده‌اند. قهرمانت را انتخاب کن، بلورها را
          جمع کن، دشمنان وحشی را شکار کن و از <b className="text-star">دروازهٔ نور</b> بگذر.
        </p>
      </div>

      <div className="mt-5 grid flex-1 content-start gap-4 lg:grid-cols-[1fr_1.15fr]">
        {/* character select */}
        <section className="anim-rise" style={{ animationDelay: "80ms" }}>
          <h2 className="font-display text-2xl text-gem">انتخاب قهرمان</h2>
          <div className="mt-2 grid grid-cols-3 gap-2.5">
            {CHARACTERS.map((c) => {
              const sel = c.id === charId;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectChar(c.id)}
                  className={`hud-panel panel-cut cursor-pointer p-3 text-right transition hover:brightness-125 ${
                    sel ? "ring-2" : "opacity-80"
                  }`}
                  style={sel ? ({ "--tw-ring-color": c.accent } as CSSProperties) : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full ring-2 ring-night-line" style={{ background: c.accent }} />
                    <span className="font-display text-xl leading-none text-moon">{c.name}</span>
                  </div>
                  <div className="mt-1 font-display text-[13px] leading-tight text-star">{c.title}</div>
                  <div className="mt-2 space-y-1 text-[10.5px] text-moon/70">
                    <div className="flex items-center justify-between">
                      <span>سرعت</span>
                      <StatPips value={c.id === "wolf" ? 3 : c.id === "fox" ? 2 : 1} color={c.accent} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>پرش</span>
                      <StatPips value={c.id === "wolf" ? 3 : c.id === "fox" ? 2 : 1} color={c.accent} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>جان</span>
                      <StatPips value={c.id === "bear" ? 3 : c.id === "fox" ? 2 : 1} color="#ff5d73" />
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-moon/55">{c.desc}</p>
                </button>
              );
            })}
          </div>

          {/* controls card */}
          <div className="hud-panel panel-cut mt-4 p-4">
            <h3 className="font-display text-lg text-star">کنترل‌ها</h3>
            <KeyRow keys={["W", "A", "S", "D"]} label="حرکت (مطابق جهت‌های صفحه)" />
            <KeyRow keys={["Space"]} label="پرش روی سر دشمن = شکار" />
            <KeyRow keys={["Shift"]} label="جهش سریع" />
            <KeyRow keys={["P", "M"]} label="توقف / صدا" />
          </div>
        </section>

        {/* mission select */}
        <section className="anim-rise" style={{ animationDelay: "160ms" }}>
          <h2 className="font-display text-2xl text-gem">انتخاب مأموریت</h2>
          <div className="mt-2 flex flex-col gap-2.5">
            {LEVELS.map((lv) => {
              const locked = lv.id > save.unlocked;
              const sel = lv.id === levelId;
              const stars = save.stars[lv.id] ?? 0;
              return (
                <button
                  key={lv.id}
                  onClick={() => !locked && onSelectLevel(lv.id)}
                  className={`hud-panel panel-cut relative cursor-pointer p-3.5 text-right transition ${
                    locked ? "cursor-not-allowed opacity-55" : "hover:brightness-125"
                  } ${sel && !locked ? "ring-2 ring-star" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-display text-3xl leading-none text-star">{fa(lv.id + 1)}</span>
                      <div>
                        <div className="font-display text-xl leading-tight text-moon">{lv.title}</div>
                        <div className="text-[11px] font-bold text-gem/90">{lv.region}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {locked ? (
                        <LockIcon />
                      ) : (
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map((i) => (
                            <StarIcon key={i} small on={i < stars} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-moon/65">{lv.desc}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-moon/80">
                    <span className="flex items-center gap-1.5">
                      <GemIcon className="h-3.5 w-3.5" />
                      {fa(lv.crystals)} بلور
                    </span>
                    {lv.killsRequired > 0 && (
                      <span className="flex items-center gap-1.5 text-ember">
                        <SkullIcon className="h-3.5 w-3.5" />
                        شکار {fa(lv.killsRequired)} دشمن
                      </span>
                    )}
                    {lv.hasBoss && <span className="text-ember">+ باس: سایه‌شاه</span>}
                    <span className="text-moon/55">زمان: {fmtTime(lv.time)}</span>
                  </div>
                  {locked && (
                    <div className="mt-1 text-[10.5px] font-bold text-moon/50">
                      با تکمیل مأموریت قبلی باز می‌شود
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={onStart}
            className="btn-game mt-4 w-full bg-gradient-to-b from-star to-star-deep px-8 py-4 text-3xl text-night-950 shadow-[0_7px_0_#6b4310,0_14px_28px_rgba(255,180,58,0.35)]"
          >
            شروع مأموریت «{level.title}»
          </button>
          <p className="mt-2 text-center text-xs text-moon/50">
            یا <span className="kbd-chip">Enter</span> — دوربین ثابت است: W همیشه به عمق تصویر می‌رود
          </p>
        </section>
      </div>
    </div>
  );
}

/* ================= pause ================= */

interface PauseProps {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

export function PauseScreen({ onResume, onRestart, onMenu }: PauseProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-night-950/70 backdrop-blur-[2px]">
      <div className="anim-pop hud-panel panel-cut w-80 p-7 text-center">
        <h2 className="font-display title-shadow text-5xl text-star">توقف</h2>
        <p className="mt-2 text-sm text-moon/70">نفسی تازه کن — جزیره منتظر توست…</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onResume}
            className="btn-game bg-gradient-to-b from-gem to-gem-deep px-6 py-3 text-2xl text-night-950 shadow-[0_5px_0_#0b5a4a]"
          >
            ادامهٔ بازی
          </button>
          <button
            onClick={onRestart}
            className="btn-game bg-night-700 px-6 py-2.5 text-xl text-moon ring-1 ring-night-line shadow-[0_5px_0_rgba(4,7,22,0.6)]"
          >
            شروع دوباره
          </button>
          <button
            onClick={onMenu}
            className="btn-game bg-night-800 px-6 py-2.5 text-xl text-moon/80 ring-1 ring-night-line shadow-[0_5px_0_rgba(4,7,22,0.6)]"
          >
            منوی اصلی
          </button>
        </div>
        <p className="mt-4 text-xs text-moon/50">
          <span className="kbd-chip">P</span> یا <span className="kbd-chip">Esc</span> برای ادامه
        </p>
      </div>
    </div>
  );
}

/* ================= end (win / lose) ================= */

interface EndProps {
  hud: HudData;
  stars: number;
  hasNext: boolean;
  onRestart: () => void;
  onNext: () => void;
  onMenu: () => void;
}

export function EndScreen({ hud, stars, hasNext, onRestart, onNext, onMenu }: EndProps) {
  const won = hud.phase === "won";
  const reasonText =
    hud.lostReason === "time" ? "تاریکی فرا رسید — زمان تمام شد!" : "سایه‌وارها قهرمانت را از پا درآوردند!";
  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center ${won ? "bg-night-950/60" : "bg-[#1a0a18]/75"}`}>
      <div className="anim-pop hud-panel panel-cut w-[27rem] max-w-[92vw] p-7 text-center">
        <h2 className={`font-display title-shadow text-6xl ${won ? "text-star" : "text-ember"}`}>
          {won ? "پیروزی!" : "شکست!"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-moon/80">
          {won
            ? `مأموریت «${hud.levelName}» کامل شد — دروازهٔ نور درخشید و آسمان دوباره ستاره گرفت!`
            : reasonText}
        </p>

        {won ? (
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} on={i < stars} delay={200 + i * 220} />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex justify-center">
            <SkullIcon className="anim-float h-12 w-12" />
          </div>
        )}

        <div className="mt-5 space-y-1.5 text-sm">
          <div className="flex justify-between border-b border-night-line/60 pb-1.5">
            <span className="text-moon/70">بلورهای جمع‌شده</span>
            <b className="text-gem">
              {fa(hud.crystals)} از {fa(hud.total)}
            </b>
          </div>
          <div className="flex justify-between border-b border-night-line/60 pb-1.5">
            <span className="text-moon/70">دشمنان شکارشده</span>
            <b className="text-ember">{fa(hud.kills)}</b>
          </div>
          {won && (
            <>
              <div className="flex justify-between border-b border-night-line/60 pb-1.5">
                <span className="text-moon/70">پاداش زمان باقی‌مانده</span>
                <b className="text-star">{fa(hud.timeBonus)}</b>
              </div>
              <div className="flex justify-between border-b border-night-line/60 pb-1.5">
                <span className="text-moon/70">پاداش جان‌ها</span>
                <b className="text-star">{fa(hud.heartsBonus)}</b>
              </div>
            </>
          )}
          <div className="flex justify-between pt-1">
            <span className="font-display text-lg text-moon">امتیاز نهایی</span>
            <span key={hud.score} className="anim-pop font-display text-2xl text-star">
              {fa(hud.score)}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {won && hasNext ? (
            <button
              onClick={onNext}
              className="btn-game bg-gradient-to-b from-star to-star-deep px-6 py-3 text-2xl text-night-950 shadow-[0_5px_0_#6b4310]"
            >
              مأموریت بعدی
            </button>
          ) : (
            <button
              onClick={onRestart}
              className={`btn-game px-6 py-3 text-2xl text-night-950 ${
                won
                  ? "bg-gradient-to-b from-star to-star-deep shadow-[0_5px_0_#6b4310]"
                  : "bg-gradient-to-b from-gem to-gem-deep shadow-[0_5px_0_#0b5a4a]"
              }`}
            >
              {won ? "بازی دوباره" : "تلاش دوباره"}
            </button>
          )}
          {won && hasNext && (
            <button
              onClick={onRestart}
              className="btn-game bg-night-700 px-6 py-2.5 text-xl text-moon ring-1 ring-night-line shadow-[0_5px_0_rgba(4,7,22,0.6)]"
            >
              بازی دوبارهٔ این مأموریت
            </button>
          )}
          <button
            onClick={onMenu}
            className="btn-game bg-night-800 px-6 py-2.5 text-xl text-moon/80 ring-1 ring-night-line shadow-[0_5px_0_rgba(4,7,22,0.6)]"
          >
            منوی اصلی
          </button>
        </div>
        <p className="mt-3 text-xs text-moon/50">
          <span className="kbd-chip">Enter</span> برای شروع دوباره
        </p>
      </div>
    </div>
  );
}
