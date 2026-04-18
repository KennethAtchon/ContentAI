// Preview canvas — renders mocked layers, supports select/drag/resize/rotate
function Preview({
  project, currentTime, isPlaying, zoom, setZoom,
  layers, setLayers,
  selectedId, setSelectedId,
  onTogglePlay, onStepBack, onStepFwd, onJumpStart, onJumpEnd,
  previewQuality, setPreviewQuality,
  showSafe, setShowSafe, showGrid, setShowGrid,
}) {
  const { Btn, Seg, cx, formatTC } = window.UI;
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ w: 1920 * 0.4, h: 1080 * 0.4 });

  // Fit the 1920x1080 logical canvas to whatever the stage gives us.
  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const pad = 32;
      const aw = r.width - pad * 2;
      const ah = r.height - pad * 2 - 48; // leave room for chrome below
      const s = Math.min(aw / 1920, ah / 1080);
      setStageSize({ w: 1920 * s, h: 1080 * s, s });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = stageSize.s || 0.4;
  const selected = layers.find(l => l.id === selectedId);

  // ------- interaction ----------
  const beginDrag = (e, layer) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(layer.id);
    document.body.classList.add('dragging');
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { x: layer.x, y: layer.y };
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) } : l));
    };
    const onUp = () => {
      document.body.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const beginResize = (e, layer, corner) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(layer.id);
    document.body.classList.add('resizing');
    const sx = e.clientX, sy = e.clientY;
    const o = { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      let { x, y, w, h } = o;
      if (corner.includes('e')) w = Math.max(40, o.w + dx);
      if (corner.includes('w')) { w = Math.max(40, o.w - dx); x = o.x + (o.w - w); }
      if (corner.includes('s')) h = Math.max(40, o.h + dy);
      if (corner.includes('n')) { h = Math.max(40, o.h - dy); y = o.y + (o.h - h); }
      setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) } : l));
    };
    const onUp = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const beginRotate = (e, layer) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(layer.id);
    document.body.classList.add('resizing');
    const rect = e.currentTarget.closest('[data-layer]').getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const start = Math.atan2(e.clientY - cy, e.clientX - cx);
    const orig = layer.rotation || 0;
    const onMove = (ev) => {
      const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      const deg = orig + ((ang - start) * 180 / Math.PI);
      setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, rotation: Math.round(deg) } : l));
    };
    const onUp = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ------- rendering a layer ----------
  const renderLayer = (layer) => {
    const style = {
      position: 'absolute',
      left: layer.x,
      top: layer.y,
      width: layer.w,
      height: layer.h,
      transform: `rotate(${layer.rotation || 0}deg)`,
      opacity: layer.opacity ?? 1,
      borderRadius: layer.radius || 0,
      overflow: 'hidden',
    };
    const selectedHere = selected?.id === layer.id;
    return (
      <div key={layer.id} data-layer={layer.id} style={style}
        onMouseDown={(e) => beginDrag(e, layer)}
        className={cx('cursor-move', selectedHere && 'sel-outline')}
      >
        {layer.kind === 'video' && (
          <div className={cx('w-full h-full relative', layer.fill)}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30" />
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
              <div className="text-[11px] font-mono text-white/80 bg-black/40 px-1.5 py-0.5 rounded">{layer.label}</div>
            </div>
          </div>
        )}
        {layer.kind === 'overlay' && (
          <div className="w-full h-full bg-[oklch(0.16_0.01_260_/_0.86)] border border-white/20 backdrop-blur-sm p-5 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-accent/90 font-semibold">Featured in</div>
            <div className="mt-2 text-white text-[28px] font-semibold leading-tight">Mikael Kovač</div>
            <div className="text-white/70 text-[16px]">Design lead, Northfield Studio</div>
          </div>
        )}
        {layer.kind === 'text' && (
          <div className="w-full h-full flex items-center" style={{
            justifyContent: layer.align === 'center' ? 'center' : layer.align === 'right' ? 'flex-end' : 'flex-start',
            textAlign: layer.align || 'left',
          }}>
            <div style={{
              fontFamily: layer.font, fontWeight: layer.weight,
              fontSize: layer.size, letterSpacing: (layer.letter || 0) + 'px',
              color: layer.color,
              textShadow: layer.shadow ? `0 ${layer.shadow/3}px ${layer.shadow}px ${layer.shadowColor}99` : 'none',
              WebkitTextStroke: layer.stroke ? `${layer.stroke}px ${layer.strokeColor}` : 'none',
              lineHeight: 1,
            }}>
              {layer.text}
            </div>
          </div>
        )}
      </div>
    );
  };

  // overlays on the SELECTED layer (handles, contextual toolbar)
  const selectionChrome = () => {
    if (!selected) return null;
    const { x, y, w, h } = selected;
    // Place floating toolbar above selection in stage space.
    return (
      <>
        {/* outline + handles */}
        <div className="pointer-events-none absolute"
          style={{ left: x, top: y, width: w, height: h, transform: `rotate(${selected.rotation||0}deg)` }}>
          <div className="absolute inset-0 outline outline-[2px] outline-accent" />
          {/* corner handles */}
          {['nw','ne','sw','se'].map(corner => (
            <div key={corner}
              onMouseDown={(e) => beginResize(e, selected, corner)}
              className="handle pointer-events-auto cursor-nwse-resize"
              style={{
                left: corner.includes('w') ? -5 : 'auto',
                right: corner.includes('e') ? -5 : 'auto',
                top: corner.includes('n') ? -5 : 'auto',
                bottom: corner.includes('s') ? -5 : 'auto',
                cursor: corner === 'ne' || corner === 'sw' ? 'nesw-resize' : 'nwse-resize',
              }} />
          ))}
          {/* edge handles */}
          {['n','s'].map(k => (
            <div key={k}
              onMouseDown={(e) => beginResize(e, selected, k)}
              className="handle pointer-events-auto"
              style={{
                left: '50%', transform: 'translateX(-50%)',
                top: k === 'n' ? -5 : 'auto', bottom: k === 's' ? -5 : 'auto',
                width: 14, height: 6, cursor: 'ns-resize',
              }} />
          ))}
          {['w','e'].map(k => (
            <div key={k}
              onMouseDown={(e) => beginResize(e, selected, k)}
              className="handle pointer-events-auto"
              style={{
                top: '50%', transform: 'translateY(-50%)',
                left: k === 'w' ? -5 : 'auto', right: k === 'e' ? -5 : 'auto',
                width: 6, height: 14, cursor: 'ew-resize',
              }} />
          ))}
          {/* rotate handle */}
          <div
            onMouseDown={(e) => beginRotate(e, selected)}
            className="pointer-events-auto absolute"
            style={{ left: '50%', top: -28, transform: 'translateX(-50%)', cursor: 'grab' }}>
            <div className="h-[14px] w-px bg-accent mx-auto" />
            <div className="h-3 w-3 rounded-full bg-base border-[1.5px] border-accent" />
          </div>
          {/* size badge */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-base/90 text-ink border border-accent/60 whitespace-nowrap">
            {Math.round(w)} × {Math.round(h)} · {selected.rotation || 0}°
          </div>
        </div>
      </>
    );
  };

  const floatingToolbar = () => {
    if (!selected) return null;
    // position above the layer in stage space
    const top = Math.max(8, selected.y - 52);
    const left = Math.max(0, Math.min(selected.x + selected.w/2 - 200, 1920 - 400));
    return (
      <div className="pointer-events-auto absolute" style={{ left, top }}>
        <FloatingToolbar layer={selected} />
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[oklch(0.13_0.008_260)]">
      {/* preview top strip */}
      <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-line/70 gap-3">
        <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-[11px] text-mute whitespace-nowrap">
            <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <span className="font-mono">REC · PREVIEW</span>
          </div>
          <div className="h-4 w-px bg-line/70 mx-1 shrink-0"/>
          <div className="text-[11px] text-mute whitespace-nowrap truncate">1920 × 1080 · 24 fps · Rec.709</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Seg value={previewQuality} onChange={setPreviewQuality} options={[
            { value: 'full', label: 'Full' },
            { value: 'half', label: '½' },
            { value: 'quarter', label: '¼' },
          ]}/>
          <div className="h-4 w-px bg-line/70 mx-1"/>
          <Btn kind="ghost" size="iconSm" active={showGrid} onClick={() => setShowGrid(g => !g)} title="Grid"><I.grid size={13}/></Btn>
          <Btn kind="ghost" size="iconSm" active={showSafe} onClick={() => setShowSafe(s => !s)} title="Safe areas"><I.crop size={13}/></Btn>
          <Btn kind="ghost" size="iconSm" title="Fullscreen"><I.full size={13}/></Btn>
        </div>
      </div>

      {/* stage */}
      <div ref={stageRef} className="flex-1 min-h-0 relative flex items-center justify-center p-6"
        onMouseDown={() => setSelectedId(null)}>
        <div className="relative shadow-[0_30px_80px_-30px_oklch(0_0_0_/_0.6)]"
          style={{ width: stageSize.w, height: stageSize.h }}>
          {/* inner scaled canvas, logical 1920×1080 */}
          <div className="absolute inset-0 overflow-hidden rounded-sm"
            style={{ width: 1920, height: 1080, transformOrigin: 'top left', transform: `scale(${scale})` }}
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="w-full h-full checker absolute inset-0" />
            {layers.map(renderLayer)}
            {showGrid && (
              <div className="pointer-events-none absolute inset-0">
                {[...Array(9)].map((_,i) => (
                  <div key={'v'+i} className="absolute top-0 bottom-0 border-l border-white/10" style={{left: `${(i+1)*10}%`}}/>
                ))}
                {[...Array(9)].map((_,i) => (
                  <div key={'h'+i} className="absolute left-0 right-0 border-t border-white/10" style={{top: `${(i+1)*10}%`}}/>
                ))}
              </div>
            )}
            {showSafe && (
              <>
                <div className="pointer-events-none absolute border border-dashed border-accent/50" style={{ left: '5%', top: '5%', right: '5%', bottom: '5%' }}/>
                <div className="pointer-events-none absolute border border-dashed border-[oklch(0.82_0.13_80_/_0.6)]" style={{ left: '10%', top: '10%', right: '10%', bottom: '10%' }}/>
              </>
            )}
            {selectionChrome()}
            {floatingToolbar()}

            {/* playing scan bar */}
            {isPlaying && (
              <div className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                style={{ animation: 'scan 3s linear infinite' }}/>
            )}
          </div>

          {/* frame decoration */}
          <div className="absolute inset-0 pointer-events-none ring-1 ring-line/60 rounded-sm"/>
        </div>

        {/* corner frame size */}
        <div className="absolute left-4 top-4 text-[10px] font-mono text-mute2">16:9 · {Math.round(scale*100)}%</div>
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <Btn kind="ghost" size="iconSm" onClick={() => setZoom(Math.max(0.25, zoom * 0.9))}><I.zoomOut size={13}/></Btn>
          <Btn kind="ghost" size="iconSm" onClick={() => setZoom(Math.min(2, zoom * 1.1))}><I.zoomIn size={13}/></Btn>
        </div>
      </div>

      {/* playback bar */}
      <div className="h-14 shrink-0 border-t border-line/70 flex items-center px-3 gap-3">
        <div className="flex items-center gap-1">
          <Btn kind="ghost" size="icon" onClick={onJumpStart} title="To start"><I.skipBack size={15}/></Btn>
          <Btn kind="ghost" size="icon" onClick={onStepBack} title="Prev frame"><I.stepBack size={15}/></Btn>
          <Btn kind="subtle" size="icon" onClick={onTogglePlay}
               className="h-9 w-9 rounded-full !bg-ink !text-base hover:!bg-white border-transparent"
               title="Play / Pause (space)">
            {isPlaying ? <I.pause size={14}/> : <I.play size={14}/>}
          </Btn>
          <Btn kind="ghost" size="icon" onClick={onStepFwd} title="Next frame"><I.stepFwd size={15}/></Btn>
          <Btn kind="ghost" size="icon" onClick={onJumpEnd} title="To end"><I.skipFwd size={15}/></Btn>
        </div>
        <div className="font-mono text-[12.5px] tabular-nums flex items-center gap-2 px-3 h-8 rounded-md bg-panel2 border border-line/60">
          <span className="text-ink">{formatTC(currentTime, project.fps)}</span>
          <span className="text-mute2">/</span>
          <span className="text-mute">{formatTC(project.duration, project.fps)}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <I.volume size={14} className="text-mute"/>
          <input type="range" className="slim w-24" min={0} max={100} defaultValue={72}/>
        </div>
        <div className="h-5 w-px bg-line/70" />
        <Btn kind="ghost" size="sm" icon={<I.scissor size={13}/>}>Split <span className="text-mute2"><window.UI.Kbd>B</window.UI.Kbd></span></Btn>
        <Btn kind="ghost" size="sm" icon={<I.magic size={13}/>}>Auto-magic</Btn>
      </div>
    </div>
  );
}

function FloatingToolbar({ layer }) {
  const { Btn, cx } = window.UI;
  const actions = layer.kind === 'text'
    ? [
      { n: 'Replace text', i: <I.type size={13}/> },
      { n: 'Animate', i: <I.sparkle size={13}/> },
      { n: 'Split', i: <I.split size={13}/> },
    ]
    : [
      { n: 'Crop', i: <I.crop size={13}/> },
      { n: 'Fit', i: <I.fit size={13}/> },
      { n: 'Fill', i: <I.fill size={13}/> },
      { n: 'Replace', i: <I.replace size={13}/> },
      { n: 'Split', i: <I.split size={13}/> },
    ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-panel2/95 border border-line2 shadow-float backdrop-blur-sm">
      {actions.map(a => (
        <Btn key={a.n} kind="ghost" size="sm" icon={a.i}>{a.n}</Btn>
      ))}
      <div className="h-4 w-px bg-line/70 mx-0.5"/>
      <Btn kind="ghost" size="iconSm" title="Bring forward"><I.front size={13}/></Btn>
      <Btn kind="ghost" size="iconSm" title="Send backward"><I.back size={13}/></Btn>
      <Btn kind="ghost" size="iconSm" title="Duplicate"><I.copy size={13}/></Btn>
      <div className="h-4 w-px bg-line/70 mx-0.5"/>
      <Btn kind="danger" size="iconSm" title="Delete"><I.trash size={13}/></Btn>
      <Btn kind="ghost" size="iconSm" title="More"><I.dots size={13}/></Btn>
    </div>
  );
}

window.Preview = Preview;
