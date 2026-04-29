// Context menu prototype.
// LMB on cat = pet (cat reacts with a heart + happy bounce).
// RMB on cat = open the action menu.

const { useState: useStateCM, useRef: useRefCM, useEffect: useEffectCM } = React;

const MENU_ITEMS = [
  { id: "feed",     icon: "🍖", label: "Feed" },
  { id: "play",     icon: "🎾", label: "Play" },
  { id: "sleep",    icon: "💤", label: "Sleep" },
  { id: "hide",     icon: "🙈", label: "Hide" },
  { id: "settings", icon: "⚙️", label: "Settings", divider: true },
];

function ContextMenuPrototype() {
  const [menu, setMenu] = useStateCM(null); // {x,y} or null
  const [active, setActive] = useStateCM(null);
  const [lastAction, setLastAction] = useStateCM(null);
  const [variant, setVariant] = useStateCM("idle");
  const [hidden, setHidden] = useStateCM(false);
  const [petting, setPetting] = useStateCM(false);
  const [hearts, setHearts] = useStateCM([]);
  const stageRef = useRefCM(null);
  const heartIdRef = useRefCM(0);

  useEffectCM(() => {
    const close = (e) => {
      if (e.target.closest && e.target.closest(".cm-menu")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // RMB → open menu next to cat
  const openMenuAtCat = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const stageRect = stageRef.current.getBoundingClientRect();
    const catRect = e.currentTarget.getBoundingClientRect();
    let x = catRect.right - stageRect.left + 6;
    let y = catRect.top - stageRect.top - 4;
    const MENU_W = 168;
    const MENU_H = 220;
    if (x + MENU_W > stageRect.width - 8) {
      x = catRect.left - stageRect.left - MENU_W - 6;
    }
    if (y + MENU_H > stageRect.height - 8) {
      y = stageRect.height - MENU_H - 8;
    }
    if (y < 8) y = 8;
    setMenu({ x, y });
    setActive(null);
  };

  // LMB → pet the cat
  const petCat = (e) => {
    e.stopPropagation();
    setMenu(null);
    setPetting(true);
    setLastAction("pet");
    setTimeout(() => setPetting(false), 280);

    const stageRect = stageRef.current.getBoundingClientRect();
    const catRect = e.currentTarget.getBoundingClientRect();
    const id = ++heartIdRef.current;
    const heart = {
      id,
      x: catRect.left - stageRect.left + catRect.width / 2 + (Math.random() * 20 - 10),
      y: catRect.top - stageRect.top - 4,
    };
    setHearts((h) => [...h, heart]);
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1100);
  };

  const onSelect = (id) => {
    setLastAction(id);
    setMenu(null);
    if (id === "feed")  { setVariant("eat");   setTimeout(() => setVariant("idle"), 900); }
    if (id === "play")  { setVariant("play");  setTimeout(() => setVariant("idle"), 900); }
    if (id === "sleep") { setVariant("sleep"); setTimeout(() => setVariant("idle"), 1400); }
    if (id === "hide")  { setHidden(true);     setTimeout(() => setHidden(false), 1400); }
  };

  return (
    <div className="cm-wrap">
      <div className="cm-hint">
        <span className="cm-kbd">click</span> to pet · <span className="cm-kbd">right-click</span> for menu
      </div>

      <div
        ref={stageRef}
        className="cm-stage"
        onMouseDown={() => setMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
      >
        {/* Fake page chrome behind the cat */}
        <div className="cm-page">
          <div className="cm-page-line" style={{ width: "62%" }} />
          <div className="cm-page-line" style={{ width: "84%" }} />
          <div className="cm-page-line" style={{ width: "48%" }} />
          <div className="cm-page-block" />
          <div className="cm-page-line" style={{ width: "70%" }} />
          <div className="cm-page-line" style={{ width: "55%" }} />
        </div>

        {/* Hearts from petting */}
        {hearts.map((h) => (
          <div key={h.id} className="cm-heart" style={{ left: h.x, top: h.y }}>
            ♥
          </div>
        ))}

        {/* The cat — LMB pets, RMB opens menu */}
        {!hidden && (
          <div
            className={`cm-cat ${menu ? "is-open" : ""} ${petting ? "is-petting" : ""}`}
            onClick={petCat}
            onContextMenu={openMenuAtCat}
            style={{ cursor: "pointer" }}
            title="Left-click to pet, right-click for menu"
          >
            <PixelCat variant={variant} scale={4} />
            <div className="cm-cat-hint">pet me · right-click for menu</div>
          </div>
        )}
        {hidden && <div className="cm-hidden-note">cat hidden — peeking back…</div>}

        {/* The menu */}
        {menu && (
          <div
            className="cm-menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            {MENU_ITEMS.map((item) => (
              <React.Fragment key={item.id}>
                {item.divider && <div className="cm-divider" />}
                <button
                  className={`cm-row ${active === item.id ? "is-active" : ""}`}
                  onMouseEnter={() => setActive(item.id)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => onSelect(item.id)}
                >
                  <span className="cm-row-icon">{item.icon}</span>
                  <span className="cm-row-label">{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <div className="cm-status">
        {lastAction
          ? <span>last action: <strong>{lastAction}</strong></span>
          : <span className="cm-status-idle">no action yet</span>}
      </div>
    </div>
  );
}

window.ContextMenuPrototype = ContextMenuPrototype;
