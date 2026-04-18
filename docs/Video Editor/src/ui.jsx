// ---------- shared UI primitives ----------
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// Merge class names
const cx = (...xs) => xs.filter(Boolean).join(' ');

// format seconds → 00:00:00:ff (frames)
const formatTC = (t, fps = 24) => {
  const total = Math.max(0, t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  const pad = (n, w=2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
};
const formatClock = (t) => {
  const m = Math.floor(t/60);
  const s = Math.floor(t%60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// Tiny button. `kind`: ghost | primary | subtle | danger
const Btn = ({ kind = 'ghost', size = 'md', className, icon, children, active, ...rest }) => {
  const base = 'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors select-none border';
  const sizes = {
    sm: 'h-7 px-2 text-[11.5px]',
    md: 'h-8 px-2.5 text-[12px]',
    lg: 'h-9 px-3 text-[13px]',
    icon: 'h-8 w-8 justify-center',
    iconSm: 'h-7 w-7 justify-center',
  };
  const kinds = {
    ghost: cx(
      'border-transparent text-ink2 hover:text-ink hover:bg-white/[0.04]',
      active && 'bg-white/[0.08] text-ink'
    ),
    subtle: cx(
      'border-line/60 bg-panel2 text-ink2 hover:text-ink hover:bg-panel3',
      active && 'bg-panel3 text-ink border-line2'
    ),
    primary: 'border-transparent bg-accent text-[oklch(0.16_0.02_130)] hover:brightness-110',
    danger: 'border-transparent text-red-300 hover:text-red-200 hover:bg-red-500/10',
    pill: cx(
      'border-line/50 bg-panel2 text-ink2 hover:text-ink hover:bg-panel3 rounded-full',
      active && 'bg-panel3 text-ink'
    ),
  };
  return (
    <button {...rest} className={cx(base, sizes[size], kinds[kind], className)}>
      {icon}
      {children}
    </button>
  );
};

// Keyboard caption chip
const Kbd = ({ children, className }) => (
  <span className={cx(
    'font-mono text-[10px] leading-none px-1.5 py-[3px] rounded',
    'border border-line/60 bg-panel2/80 text-mute',
    className
  )}>{children}</span>
);

// Section label (small uppercase)
const Tag = ({ children, className, dot }) => (
  <span className={cx(
    'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-mute font-semibold',
    className
  )}>
    {dot && <span className="inline-block h-1 w-1 rounded-full bg-mute" />}
    {children}
  </span>
);

// Divider
const Hr = ({ v, className }) => v
  ? <div className={cx('w-px self-stretch bg-line/70', className)} />
  : <div className={cx('h-px w-full bg-line/70', className)} />;

// Column / panel wrapper
const Panel = ({ className, children }) => (
  <div className={cx('bg-panel border border-line/70 rounded-lg shadow-panel', className)}>
    {children}
  </div>
);

// labelled numeric field (used throughout properties panel)
const NumField = ({ label, value, onChange, suffix, step = 1, min, max, className, icon }) => {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(v);
    if (Number.isFinite(n)) {
      let out = n;
      if (min !== undefined) out = Math.max(min, out);
      if (max !== undefined) out = Math.min(max, out);
      onChange && onChange(out);
    } else {
      setV(String(value));
    }
  };
  return (
    <label className={cx(
      'group flex items-center gap-1.5 h-8 px-2 rounded-md',
      'bg-panel2 border border-line/60 hover:border-line2 focus-within:border-accent/60',
      className
    )}>
      {icon && <span className="text-mute">{icon}</span>}
      {label && <span className="text-[10px] uppercase tracking-wider text-mute font-semibold">{label}</span>}
      <input
        className="num flex-1 text-right"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
      />
      {suffix && <span className="text-[10px] text-mute font-mono">{suffix}</span>}
    </label>
  );
};

// slider row
const SliderRow = ({ label, value, min = 0, max = 100, step = 1, onChange, format }) => (
  <div className="flex items-center gap-3">
    <div className="text-[11px] text-mute w-16 shrink-0">{label}</div>
    <input type="range" className="slim flex-1" min={min} max={max} step={step}
           value={value} onChange={(e) => onChange && onChange(parseFloat(e.target.value))} />
    <div className="font-mono text-[11px] text-ink2 w-10 text-right tabular-nums">
      {format ? format(value) : value}
    </div>
  </div>
);

// color swatch button
const Swatch = ({ color, selected, onClick, ariaLabel }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    className={cx(
      'h-6 w-6 rounded-md border',
      selected ? 'border-accent ring-1 ring-accent/60' : 'border-line/70 hover:border-line2'
    )}
    style={{ background: color }}
  />
);

// toggle (segmented)
const Seg = ({ options, value, onChange, className }) => (
  <div className={cx('inline-flex items-center p-[2px] rounded-md bg-panel2 border border-line/60', className)}>
    {options.map(opt => {
      const isActive = value === opt.value;
      return (
        <button key={opt.value}
          onClick={() => onChange && onChange(opt.value)}
          className={cx(
            'h-6 px-2 text-[11px] rounded-[5px] inline-flex items-center gap-1.5 transition-colors',
            isActive ? 'bg-panel3 text-ink shadow-[0_1px_0_0_oklch(1_0_0_/_0.05)_inset]' : 'text-mute hover:text-ink'
          )}>
          {opt.icon}{opt.label}
        </button>
      );
    })}
  </div>
);

// tooltip-ish static caption
const Hint = ({ children, className }) => (
  <div className={cx('text-[10.5px] text-mute2 leading-relaxed', className)}>{children}</div>
);

window.UI = { cx, formatTC, formatClock, Btn, Kbd, Tag, Hr, Panel, NumField, SliderRow, Swatch, Seg, Hint };
