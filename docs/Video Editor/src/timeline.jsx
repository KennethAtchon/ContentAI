// Timeline — multi-track with draggable/resizable clips, ruler, playhead, zoom
function Timeline({
  project, tracks, setTracks, clips, setClips,
  currentTime, setCurrentTime,
  selectedClipId, setSelectedClipId,
  pxPerSecond, setPxPerSecond,
}) {
  const { Btn, cx, formatTC, formatClock, Kbd, Seg } = window.UI;
  const scrollRef = useRef(null);
  const rulerRef = useRef(null);
  const [snap, setSnap] = useState(true);
  const [magnetic, setMagnetic] = useState(true);
  const [dragGuide, setDragGuide] = useState(null); // {x}

  const trackHeight = 40;
  const baseTrackPad = 2;
  const totalTracksHeight = tracks.reduce((s, t) => s + t.height + baseTrackPad, 0);

  const duration = project.duration;
  const timelineWidth = duration * pxPerSecond + 120;

  // tick scale based on zoom
  const majorEvery = pxPerSecond > 80 ? 1 : pxPerSecond > 40 ? 2 : pxPerSecond > 18 ? 5 : 10;
  const minorEvery = majorEvery / (pxPerSecond > 40 ? 4 : 2);

  // click on ruler to scrub
  const onRulerMouseDown = (e) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const move = (ev) => {
      const x = Math.max(0, ev.clientX - rect.left + (scrollRef.current?.scrollLeft || 0));
      let t = x / pxPerSecond;
      t = Math.max(0, Math.min(duration, t));
      setCurrentTime(t);
    };
    move(e);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // --- clip drag (move across tracks) ---
  const beginClipDrag = (e, clip) => {
    if (tracks.find(t => t.id === clip.trackId)?.locked) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedClipId(clip.id);
    document.body.classList.add('dragging');
    const startX = e.clientX, startY = e.clientY;
    const origStart = clip.start;
    const origTrack = clip.trackId;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / pxPerSecond;
      let newStart = Math.max(0, origStart + dx);
      if (snap) newStart = Math.round(newStart * 4) / 4; // snap to 0.25s
      // pick nearest track by vertical movement
      const dy = ev.clientY - startY;
      const origIdx = tracks.findIndex(t => t.id === origTrack);
      const targetIdx = Math.max(0, Math.min(tracks.length - 1, origIdx + Math.round(dy / 48)));
      const targetTrack = tracks[targetIdx];
      // only allow if same kind or overlay/text interchange
      const sameKind = targetTrack.kind === clip.kind;
      const newTrack = sameKind ? targetTrack.id : origTrack;
      setDragGuide({ x: newStart * pxPerSecond });
      setClips(cs => cs.map(c => c.id === clip.id ? { ...c, start: newStart, trackId: newTrack } : c));
    };
    const onUp = () => {
      document.body.classList.remove('dragging');
      setDragGuide(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // --- clip resize (left/right handles) ---
  const beginClipResize = (e, clip, edge) => {
    if (tracks.find(t => t.id === clip.trackId)?.locked) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedClipId(clip.id);
    document.body.classList.add('resizing');
    const startX = e.clientX;
    const orig = { start: clip.start, length: clip.length };
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / pxPerSecond;
      let { start, length } = orig;
      if (edge === 'left') {
        const delta = Math.max(-orig.start, Math.min(orig.length - 0.2, dx));
        start = orig.start + delta;
        length = orig.length - delta;
      } else {
        length = Math.max(0.2, orig.length + dx);
      }
      if (snap) {
        start = Math.round(start * 4) / 4;
        length = Math.round(length * 4) / 4;
      }
      setClips(cs => cs.map(c => c.id === clip.id ? { ...c, start, length } : c));
    };
    const onUp = () => {
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const toggleTrackProp = (trackId, key) => {
    setTracks(ts => ts.map(t => t.id === trackId ? { ...t, [key]: !t[key] } : t));
  };

  const clipsForTrack = (trackId) => clips.filter(c => c.trackId === trackId);

  return (
    <div className="h-[300px] shrink-0 bg-panel border-t border-line/70 flex flex-col">
      {/* top toolbar */}
      <div className="h-10 shrink-0 flex items-center px-3 gap-2 border-b border-line/70">
        <div className="flex items-center gap-1">
          <Btn kind="ghost" size="iconSm" title="Select tool" active><I.chevR size={13} className="rotate-[-45deg]"/></Btn>
          <Btn kind="ghost" size="iconSm" title="Split / Blade"><I.scissor size={13}/></Btn>
          <Btn kind="ghost" size="iconSm" title="Link"><I.link size={13}/></Btn>
          <div className="h-4 w-px bg-line/70 mx-1"/>
          <Btn kind="ghost" size="sm" active={snap} onClick={() => setSnap(s => !s)}>Snap</Btn>
          <Btn kind="ghost" size="sm" active={magnetic} onClick={() => setMagnetic(m => !m)}>Magnetic</Btn>
        </div>
        <div className="flex-1" />
        <div className="font-mono text-[11px] text-mute tabular-nums">
          <span className="text-ink2">{formatTC(currentTime, project.fps)}</span>
          <span className="text-mute2 mx-1">/</span>
          {formatTC(project.duration, project.fps)}
        </div>
        <div className="h-4 w-px bg-line/70 mx-1"/>
        <div className="flex items-center gap-1.5">
          <I.zoomOut size={13} className="text-mute"/>
          <input type="range" className="slim w-28" min={6} max={200} value={pxPerSecond}
            onChange={(e) => setPxPerSecond(parseFloat(e.target.value))}/>
          <I.zoomIn size={13} className="text-mute"/>
          <div className="font-mono text-[10.5px] text-mute2 w-10 text-right">{Math.round(pxPerSecond)} px/s</div>
        </div>
      </div>

      {/* body: track headers + tracks */}
      <div className="flex-1 min-h-0 flex">
        {/* fixed track headers */}
        <div className="w-[188px] shrink-0 border-r border-line/70 flex flex-col">
          <div className="h-8 shrink-0 px-2 border-b border-line/70 flex items-center">
            <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold">Tracks</div>
            <div className="ml-auto flex items-center gap-0.5">
              <Btn kind="ghost" size="iconSm" title="Add track"><I.plus size={12}/></Btn>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {tracks.map(t => <TrackHeader key={t.id} t={t} toggle={toggleTrackProp}/>)}
          </div>
        </div>

        {/* scrollable timeline area */}
        <div className="flex-1 min-w-0 overflow-auto" ref={scrollRef}>
          <div style={{ width: timelineWidth }}>
            {/* ruler */}
            <div
              ref={rulerRef}
              onMouseDown={onRulerMouseDown}
              className="sticky top-0 z-20 h-8 bg-panel border-b border-line/70 cursor-ew-resize select-none"
              style={{ width: timelineWidth }}
            >
              <TimelineRuler duration={duration} pxPerSecond={pxPerSecond} majorEvery={majorEvery} minorEvery={minorEvery}/>
            </div>

            {/* tracks */}
            <div className="relative" style={{ height: totalTracksHeight + baseTrackPad, width: timelineWidth }}>
              {/* alternating row backgrounds + grid */}
              <GridBackdrop duration={duration} pxPerSecond={pxPerSecond} tracks={tracks}/>

              {/* tracks & clips */}
              {(() => {
                let y = 0;
                return tracks.map(track => {
                  const top = y;
                  y += track.height + baseTrackPad;
                  return (
                    <div key={track.id}
                      className="absolute left-0"
                      style={{ top, height: track.height, width: timelineWidth }}>
                      {clipsForTrack(track.id).map(c => (
                        <TimelineClip key={c.id} clip={c} track={track} pxPerSecond={pxPerSecond}
                          selected={c.id === selectedClipId}
                          onMouseDown={(e) => beginClipDrag(e, c)}
                          onResizeStart={(e) => beginClipResize(e, c, 'left')}
                          onResizeEnd={(e) => beginClipResize(e, c, 'right')}
                        />
                      ))}
                    </div>
                  );
                });
              })()}

              {/* snap guide */}
              {dragGuide && (
                <div className="absolute top-0 bottom-0 border-l border-dashed border-accent/80 pointer-events-none"
                  style={{ left: dragGuide.x }}/>
              )}

              {/* playhead */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: currentTime * pxPerSecond }}>
                <div className="h-full w-px bg-accent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackHeader({ t, toggle }) {
  const { cx } = window.UI;
  const kindColor = {
    video:  'bg-video',
    audio:  'bg-audio',
    text:   'bg-text',
    overlay:'bg-overlay',
  }[t.kind];
  return (
    <div className="h-10 px-2 flex items-center gap-2 border-b border-line/60" style={{ height: t.height }}>
      <div className={cx('h-5 w-[3px] rounded-full', kindColor)} />
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] truncate leading-tight">{t.name}</div>
        <div className="text-[9.5px] text-mute2 tracking-wider font-mono uppercase">{t.kind}</div>
      </div>
      <div className="flex items-center gap-0.5">
        <button onClick={() => toggle(t.id, 'hidden')}
          className={cx('h-5 w-5 rounded flex items-center justify-center hover:bg-white/[0.05]',
          t.hidden ? 'text-mute2' : 'text-ink2')}>
          {t.hidden ? <I.eyeOff size={12}/> : <I.eye size={12}/>}
        </button>
        <button onClick={() => toggle(t.id, 'muted')}
          className={cx('h-5 w-5 rounded flex items-center justify-center hover:bg-white/[0.05]',
          t.muted ? 'text-red-300' : 'text-ink2')}>
          {t.muted ? <I.mute size={12}/> : <I.volume size={12}/>}
        </button>
        <button onClick={() => toggle(t.id, 'locked')}
          className={cx('h-5 w-5 rounded flex items-center justify-center hover:bg-white/[0.05]',
          t.locked ? 'text-[oklch(0.82_0.13_80)]' : 'text-ink2')}>
          {t.locked ? <I.lock size={12}/> : <I.unlock size={12}/>}
        </button>
      </div>
    </div>
  );
}

function TimelineRuler({ duration, pxPerSecond, majorEvery, minorEvery }) {
  const ticks = [];
  for (let t = 0; t <= duration; t += minorEvery) {
    const isMajor = Math.abs(t % majorEvery) < 0.001;
    ticks.push({ t, major: isMajor });
  }
  return (
    <div className="relative h-full">
      {ticks.map((tk, i) => (
        <div key={i}
          className="absolute top-0 bottom-0 border-l"
          style={{ left: tk.t * pxPerSecond,
                   borderColor: tk.major ? 'oklch(0.42 0.008 260)' : 'oklch(0.30 0.008 260)',
                   opacity: tk.major ? 1 : 0.5 }}>
          {tk.major && (
            <div className="absolute top-1 left-1 font-mono text-[9.5px] text-mute whitespace-nowrap">
              {window.UI.formatClock(tk.t)}
            </div>
          )}
          <div className={tk.major ? 'absolute bottom-0 h-2 w-px bg-line2' : 'absolute bottom-0 h-1 w-px bg-line'} />
        </div>
      ))}
    </div>
  );
}

function GridBackdrop({ duration, pxPerSecond, tracks }) {
  const lines = [];
  for (let t = 0; t <= duration; t += 1) {
    lines.push(t);
  }
  return (
    <div className="absolute inset-0">
      {tracks.map((t, i) => (
        <div key={t.id}
          className={i % 2 === 0 ? 'bg-[oklch(0.18_0.008_260)]' : 'bg-[oklch(0.20_0.008_260)]'}
          style={{ height: t.height, marginBottom: 2 }}>
        </div>
      ))}
      {/* faint vertical grid */}
      <div className="absolute inset-0 pointer-events-none">
        {lines.map(t => (
          <div key={t}
            className="absolute top-0 bottom-0 w-px"
            style={{ left: t * pxPerSecond, background: t % 5 === 0 ? 'oklch(0.30 0.008 260 / 0.6)' : 'oklch(0.25 0.008 260 / 0.5)' }}/>
        ))}
      </div>
    </div>
  );
}

function TimelineClip({ clip, track, pxPerSecond, selected, onMouseDown, onResizeStart, onResizeEnd }) {
  const { cx, formatClock } = window.UI;
  const style = {
    left: clip.start * pxPerSecond,
    width: Math.max(14, clip.length * pxPerSecond),
    top: 2,
    height: track.height - 6,
  };
  const kindTheme = {
    video:   { bar: 'bg-video',   edge: 'oklch(0.72 0.12 245)',  stripe: 'stripes-a' },
    audio:   { bar: 'bg-audio',   edge: 'oklch(0.78 0.10 185)',  stripe: 'stripes-d' },
    text:    { bar: 'bg-text',    edge: 'oklch(0.86 0.13 80)',   stripe: 'stripes-c' },
    overlay: { bar: 'bg-overlay', edge: 'oklch(0.74 0.14 305)',  stripe: 'stripes-b' },
  }[clip.kind];

  return (
    <div
      onMouseDown={onMouseDown}
      className={cx(
        'absolute rounded-[5px] overflow-hidden select-none group',
        'border',
        selected ? 'border-accent ring-1 ring-accent/60 z-10' : 'border-black/40',
        track.locked && 'opacity-70'
      )}
      style={style}
      title={`${clip.name} · ${formatClock(clip.length)}`}
    >
      {/* colored head strip */}
      <div
        className="absolute inset-x-0 top-0 h-[5px]"
        style={{ background: kindTheme.edge }}
      />
      {/* body */}
      <div className={cx('absolute inset-x-0 top-[5px] bottom-0', 'bg-[oklch(0.23_0.04_260)]')}>
        {clip.kind === 'video' && <VideoClipBody clip={clip} />}
        {clip.kind === 'audio' && <AudioClipBody clip={clip} width={Math.max(14, clip.length * pxPerSecond)}/>}
        {clip.kind === 'text'  && <TextClipBody clip={clip} />}
        {clip.kind === 'overlay' && <OverlayClipBody clip={clip} />}
      </div>
      {/* left/right resize handles */}
      <div
        onMouseDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20" />
      <div
        onMouseDown={onResizeEnd}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/20" />
      {/* name */}
      <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center gap-1 pointer-events-none">
        <div className="text-[10.5px] text-white/90 font-medium truncate">{clip.name}</div>
      </div>
      {/* selected badge */}
      {selected && (
        <div className="absolute top-1 right-1 text-[9px] font-mono bg-accent text-[oklch(0.16_0.02_130)] px-1 py-[1px] rounded">
          {clip.length.toFixed(1)}s
        </div>
      )}
    </div>
  );
}

function VideoClipBody({ clip }) {
  // thumbnail strip — repeat the stripe pattern
  return (
    <div className="absolute inset-0 flex">
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} className="flex-1 min-w-0 border-r border-black/30 last:border-0 stripes-a opacity-90"/>
      ))}
    </div>
  );
}

function AudioClipBody({ clip, width }) {
  // render a mocked waveform using divs
  const bars = Math.max(20, Math.floor(width / 3));
  const seed = clip.waveformSeed || 7;
  return (
    <div className="absolute inset-0 flex items-center px-1 gap-[1px] bg-[oklch(0.22_0.02_185)]">
      {[...Array(bars)].map((_, i) => {
        // deterministic pseudo-random
        const h = 20 + Math.abs(Math.sin(i * 0.7 + seed) * Math.cos(i * 0.23 + seed * 0.3)) * 70;
        return (
          <div key={i} className="w-px flex-1 min-w-[1px] rounded-[1px] bg-[oklch(0.82_0.11_185)]" style={{ height: h + '%' }}/>
        );
      })}
    </div>
  );
}

function TextClipBody({ clip }) {
  return (
    <div className="absolute inset-0 flex items-center gap-1.5 px-1.5 bg-[oklch(0.24_0.05_80)]">
      <I.type size={11} className="text-[oklch(0.86_0.13_80)] shrink-0"/>
      <div className="text-[10.5px] text-white/95 font-medium truncate">{clip.name}</div>
    </div>
  );
}

function OverlayClipBody({ clip }) {
  return (
    <div className="absolute inset-0 flex items-center gap-1.5 px-1.5 bg-[oklch(0.24_0.06_305)]">
      <I.shapes size={11} className="text-[oklch(0.80_0.14_305)] shrink-0"/>
      <div className="text-[10.5px] text-white/95 font-medium truncate">{clip.name}</div>
    </div>
  );
}

window.Timeline = Timeline;
