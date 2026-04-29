// CatTab popup — interactive 320x420 prototype.

const { useState, useEffect, useRef } = React;

function StatBar({ label, value, color, hint }) {
  return (
    <div className="ct-stat">
      <div className="ct-stat-label">{label}</div>
      <div className="ct-stat-track">
        <div
          className="ct-stat-fill"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
          }}
        />
      </div>
      <div className="ct-stat-value">{Math.round(value)}<span className="ct-stat-pct">%</span></div>
    </div>
  );
}

function ChunkyButton({ label, icon, onClick, tone = "orange", busy }) {
  const tones = {
    orange: { bg: "#FCE5D4", border: "#F2C9A8", text: "#7A3D1A" },
    pink:   { bg: "#FBDDE6", border: "#F0BFCF", text: "#7A2F46" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="ct-btn"
      style={{
        background: t.bg,
        borderColor: t.border,
        color: t.text,
        opacity: busy ? 0.6 : 1,
        cursor: busy ? "default" : "pointer",
      }}
    >
      <span className="ct-btn-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="ct-toggle"
      style={{
        background: on ? "#E89464" : "#E5DED4",
      }}
    >
      <span
        className="ct-toggle-knob"
        style={{ transform: on ? "translateX(18px)" : "translateX(0)" }}
      />
    </button>
  );
}

function Floatie({ children, x, y, color }) {
  return (
    <div
      className="ct-floatie"
      style={{ left: x, top: y, color }}
    >
      {children}
    </div>
  );
}

function CatTabPopup() {
  const [stats, setStats] = useState({ hunger: 64, happiness: 78, energy: 52 });
  const [variant, setVariant] = useState("idle");
  const [showOnSite, setShowOnSite] = useState(true);
  const [busy, setBusy] = useState(null);
  const [floaties, setFloaties] = useState([]);
  const [purr, setPurr] = useState(false);
  const idRef = useRef(0);

  // Slow decay for liveliness
  useEffect(() => {
    const t = setInterval(() => {
      setStats((s) => ({
        hunger: Math.max(0, s.hunger - 0.4),
        happiness: Math.max(0, s.happiness - 0.25),
        energy: Math.max(0, s.energy - 0.2),
      }));
    }, 1200);
    return () => clearInterval(t);
  }, []);

  const addFloatie = (text, color) => {
    const id = ++idRef.current;
    const x = 110 + Math.random() * 80;
    setFloaties((f) => [...f, { id, text, color, x, y: 60 }]);
    setTimeout(() => {
      setFloaties((f) => f.filter((fl) => fl.id !== id));
    }, 1100);
  };

  const handleFeed = () => {
    if (busy) return;
    setBusy("feed");
    setVariant("eat");
    addFloatie("+18", "#C46A2D");
    setStats((s) => ({
      ...s,
      hunger: Math.min(100, s.hunger + 18),
      energy: Math.min(100, s.energy + 4),
    }));
    setTimeout(() => {
      setVariant("idle");
      setBusy(null);
    }, 900);
  };

  const handlePlay = () => {
    if (busy) return;
    setBusy("play");
    setVariant("play");
    addFloatie("+22", "#C75A7A");
    setPurr(true);
    setStats((s) => ({
      ...s,
      happiness: Math.min(100, s.happiness + 22),
      energy: Math.max(0, s.energy - 8),
      hunger: Math.max(0, s.hunger - 4),
    }));
    setTimeout(() => {
      setVariant("idle");
      setBusy(null);
      setPurr(false);
    }, 900);
  };

  return (
    <div className="ct-popup">
      {/* Header */}
      <div className="ct-header">
        <div className="ct-name-row">
          <div className="ct-name-badge">
            <PixelCatTiny size={18} />
          </div>
          <div className="ct-name-stack">
            <div className="ct-name">Cheeto</div>
            <div className="ct-mood">
              {variant === "eat" && "munching..."}
              {variant === "play" && "pouncing!"}
              {variant === "idle" && (purr ? "purring" : moodFromStats(stats))}
            </div>
          </div>
        </div>
        <div className="ct-level">
          <span className="ct-level-num">Lv 4</span>
        </div>
      </div>

      {/* Cat stage */}
      <div className="ct-stage">
        <div className="ct-stage-bg" />
        <div className="ct-cat-wrap" style={{ transform: busy === "play" ? "translateY(-4px)" : "none" }}>
          <PixelCat variant={variant} scale={5} />
          <div className="ct-cat-shadow" />
        </div>
        {floaties.map((f) => (
          <Floatie key={f.id} x={f.x} y={f.y} color={f.color}>
            {f.text}
          </Floatie>
        ))}
      </div>

      {/* Stats */}
      <div className="ct-stats">
        <StatBar label="Hunger"    value={stats.hunger}    color="#E89464" />
        <StatBar label="Happiness" value={stats.happiness} color="#E8A0B5" />
        <StatBar label="Energy"    value={stats.energy}    color="#E8C766" />
      </div>

      {/* Actions */}
      <div className="ct-actions">
        <ChunkyButton label="Feed" icon="🍖" tone="orange" onClick={handleFeed} busy={busy === "feed"} />
        <ChunkyButton label="Play" icon="🎾" tone="pink"   onClick={handlePlay} busy={busy === "play"} />
      </div>

      {/* Footer toggle + settings */}
      <div className="ct-footer">
        <div className="ct-toggle-row">
          <div className="ct-toggle-label">
            <div className="ct-toggle-title">Show on this site</div>
            <div className="ct-toggle-sub">example.com</div>
          </div>
          <Toggle on={showOnSite} onChange={setShowOnSite} />
        </div>
        <a className="ct-settings-link" href="#" onClick={(e) => e.preventDefault()}>
          Settings
        </a>
      </div>
    </div>
  );
}

function moodFromStats(s) {
  const avg = (s.hunger + s.happiness + s.energy) / 3;
  if (avg > 75) return "content";
  if (avg > 50) return "alright";
  if (avg > 30) return "needs care";
  return "feed me!";
}

window.CatTabPopup = CatTabPopup;
