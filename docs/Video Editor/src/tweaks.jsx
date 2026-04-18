// Floating Tweaks panel — theme + font + density
function Tweaks({ open, onClose, theme, setTheme, font, setFont, density, setDensity }) {
  const { Btn, cx } = window.UI;
  if (!open) return null;

  const themes = [
    { id: 'midnight',  label: 'Midnight',  swatches: ['oklch(0.155 0.008 260)','oklch(0.26 0.008 260)','oklch(0.86 0.17 128)'] },
    { id: 'graphite',  label: 'Graphite',  swatches: ['oklch(0.16 0.004 40)','oklch(0.27 0.004 40)','oklch(0.84 0.15 58)'] },
    { id: 'arctic',    label: 'Arctic',    swatches: ['oklch(0.19 0.02 220)','oklch(0.31 0.025 220)','oklch(0.84 0.14 200)'] },
    { id: 'plum',      label: 'Plum',      swatches: ['oklch(0.18 0.03 300)','oklch(0.30 0.04 300)','oklch(0.78 0.19 340)'] },
    { id: 'blueprint', label: 'Blueprint', swatches: ['oklch(0.19 0.06 255)','oklch(0.32 0.08 255)','oklch(0.87 0.17 85)'] },
    { id: 'parchment', label: 'Parchment', swatches: ['oklch(0.96 0.005 80)','oklch(0.85 0.008 80)','oklch(0.62 0.17 30)'] },
  ];

  return (
    <div className="fixed bottom-10 right-4 z-40 w-[280px] rounded-xl bg-panel border border-line2 shadow-float overflow-hidden">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line/70">
        <div className="flex items-center gap-2">
          <I.sparkle size={13} className="text-accent"/>
          <div className="text-[12px] font-semibold tracking-tight">Tweaks</div>
        </div>
        <Btn kind="ghost" size="iconSm" onClick={onClose}><I.close size={13}/></Btn>
      </div>
      <div className="p-3 flex flex-col gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-1.5">Theme</div>
          <div className="grid grid-cols-2 gap-1.5">
            {themes.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)}
                className={cx(
                  'h-14 rounded-md border p-2 flex flex-col justify-between text-left transition-colors',
                  theme === t.id ? 'border-accent ring-1 ring-accent/40' : 'border-line/70 hover:border-line2'
                )}
                style={{ background: t.swatches[0] }}>
                <div className="flex items-center gap-1">
                  {t.swatches.map((s,i) => (
                    <div key={i} className="h-3 w-3 rounded-[3px] border border-black/20" style={{ background: s }}/>
                  ))}
                </div>
                <div className="text-[11px] font-medium" style={{
                  color: t.id === 'parchment' ? 'oklch(0.2 0.008 80)' : 'oklch(0.95 0 0)'
                }}>{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-1.5">UI font</div>
          <div className="inline-flex items-center p-[2px] rounded-md bg-panel2 border border-line/60 w-full">
            {[
              { v: 'inter', l: 'Inter' },
              { v: 'geist', l: 'Geist' },
              { v: 'mono',  l: 'Mono' },
            ].map(o => (
              <button key={o.v} onClick={() => setFont(o.v)}
                className={cx(
                  'flex-1 h-7 text-[11px] rounded-[5px]',
                  font === o.v ? 'bg-panel3 text-ink' : 'text-mute hover:text-ink'
                )}>{o.l}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-mute font-semibold mb-1.5">Density</div>
          <div className="inline-flex items-center p-[2px] rounded-md bg-panel2 border border-line/60 w-full">
            {[
              { v: 'compact',    l: 'Compact' },
              { v: 'comfortable',l: 'Comfortable' },
            ].map(o => (
              <button key={o.v} onClick={() => setDensity(o.v)}
                className={cx(
                  'flex-1 h-7 text-[11px] rounded-[5px]',
                  density === o.v ? 'bg-panel3 text-ink' : 'text-mute hover:text-ink'
                )}>{o.l}</button>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-mute2 leading-relaxed">
          Theme, font, and density persist across reloads.
        </div>
      </div>
    </div>
  );
}
window.Tweaks = Tweaks;
