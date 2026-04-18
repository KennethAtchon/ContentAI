// Top-level app: wires everything together, owns state, handles playback loop
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function App() {
  // --- theme / tweaks ---
  const defaults = window.TWEAK_DEFAULTS || { theme: 'midnight', font: 'inter', density: 'comfortable' };
  const [theme, setThemeRaw]     = useState(() => localStorage.getItem('lumen.theme') || defaults.theme);
  const [font,  setFontRaw]      = useState(() => localStorage.getItem('lumen.font')  || defaults.font);
  const [density, setDensityRaw] = useState(() => localStorage.getItem('lumen.density') || defaults.density);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [editModeActive, setEditModeActive] = useState(false);

  const persistTweak = (key, val) => {
    localStorage.setItem('lumen.' + key, val);
    try {
      window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
    } catch {}
  };
  const setTheme   = (v) => { setThemeRaw(v);   persistTweak('theme', v); };
  const setFont    = (v) => { setFontRaw(v);    persistTweak('font', v); };
  const setDensity = (v) => { setDensityRaw(v); persistTweak('density', v); };

  // apply to <html>
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.setAttribute('data-font', font); }, [font]);
  useEffect(() => { document.documentElement.setAttribute('data-density', density); }, [density]);

  // tweaks host protocol
  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data?.type === '__activate_edit_mode')   { setEditModeActive(true); setTweaksOpen(true); }
      if (e?.data?.type === '__deactivate_edit_mode') { setEditModeActive(false); setTweaksOpen(false); }
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // --- project state ---
  const [project, setProject] = useState({
    name: MOCK.PROJECT_NAME_DEFAULT,
    fps: 24,
    duration: 54,  // seconds
    resolution: '1080p',
  });
  const [mode, setMode] = useState('edit');
  const [saved, setSaved] = useState(false);

  // --- timeline state ---
  const [tracks, setTracks] = useState(MOCK.TRACKS);
  const [clips, setClips] = useState(MOCK.CLIPS);
  const [pxPerSecond, setPxPerSecond] = useState(44);
  const [selectedClipId, setSelectedClipId] = useState('c11');

  // --- preview state ---
  const [layers, setLayers] = useState(MOCK.LAYERS_AT_T);
  const [selectedLayerId, setSelectedLayerId] = useState('L-title');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(7.4);
  const [zoom, setZoom] = useState(1);
  const [previewQuality, setPreviewQuality] = useState('full');
  const [showGrid, setShowGrid] = useState(false);
  const [showSafe, setShowSafe] = useState(true);

  // --- modal ---
  const [exportOpen, setExportOpen] = useState(false);

  // --- history (very simplified — just undo/redo stacks of layer+clip snapshots) ---
  const [history, setHistory] = useState({ past: [], future: [] });

  const snapshot = () => ({ layers, clips, tracks });
  const restore = (s) => { setLayers(s.layers); setClips(s.clips); setTracks(s.tracks); };

  const commit = useCallback(() => {
    setHistory(h => ({ past: [...h.past, snapshot()].slice(-30), future: [] }));
    setSaved(false);
  }, [layers, clips, tracks]); // eslint-disable-line

  const onUndo = () => {
    setHistory(h => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      const rest = h.past.slice(0, -1);
      const cur = snapshot();
      restore(prev);
      return { past: rest, future: [cur, ...h.future] };
    });
  };
  const onRedo = () => {
    setHistory(h => {
      if (!h.future.length) return h;
      const next = h.future[0];
      const rest = h.future.slice(1);
      const cur = snapshot();
      restore(next);
      return { past: [...h.past, cur], future: rest };
    });
  };

  // --- playback loop ---
  useEffect(() => {
    if (!isPlaying) return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setCurrentTime(t => {
        const n = t + dt;
        if (n >= project.duration) { setIsPlaying(false); return project.duration; }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, project.duration]);

  // --- keyboard ---
  useEffect(() => {
    const onKey = (e) => {
      // ignore if user typing in a field
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA/.test(tag)) return;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying(p => !p); }
      else if (e.key === 'ArrowLeft') setCurrentTime(t => Math.max(0, t - (e.shiftKey ? 1 : 1/project.fps)));
      else if (e.key === 'ArrowRight') setCurrentTime(t => Math.min(project.duration, t + (e.shiftKey ? 1 : 1/project.fps)));
      else if (e.key === 'Home') setCurrentTime(0);
      else if (e.key === 'End') setCurrentTime(project.duration);
      else if (e.key === 'Escape') { setSelectedLayerId(null); setSelectedClipId(null); setExportOpen(false); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo(); else onUndo();
      }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); setExportOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [project.duration, project.fps]); // eslint-disable-line

  // wrapper setters that also commit for undo
  const setLayersTracked = (updater) => { setLayers(updater); commit(); };
  const setClipsTracked  = (updater) => { setClips(updater);  commit(); };
  const setTracksTracked = (updater) => { setTracks(updater); commit(); };

  const clipSelected = clips.find(c => c.id === selectedClipId);
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  const updateClip = (patch) => {
    if (!clipSelected) return;
    setClipsTracked(cs => cs.map(c => c.id === clipSelected.id ? { ...c, ...patch } : c));
  };

  const onInsertAsset = (asset) => {
    // pick a track that matches
    const kindToTrack = {
      video: 't3', image: 't3', audio: 't5'
    }[asset.kind] || 't3';
    const len = asset.duration ? Math.min(asset.duration, 6) : 5;
    const start = currentTime;
    const newClip = {
      id: 'c' + Math.random().toString(36).slice(2, 7),
      trackId: kindToTrack,
      start,
      length: len,
      name: asset.name.replace(/\.[^.]+$/, ''),
      kind: asset.kind === 'audio' ? 'audio' : 'video',
      assetId: asset.id,
      waveformSeed: Math.floor(Math.random()*20),
    };
    setClipsTracked(cs => [...cs, newClip]);
    setSelectedClipId(newClip.id);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-base text-ink">
      <Header
        project={project} setProject={setProject}
        onExport={() => setExportOpen(true)}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={onUndo} onRedo={onRedo}
        saved={saved}
        mode={mode} setMode={setMode}
      />
      <div className="flex-1 min-h-0 flex">
        <LeftPanel onInsertAsset={onInsertAsset}/>
        <div className="flex-1 min-w-0 flex flex-col">
          <Preview
            project={project}
            currentTime={currentTime}
            isPlaying={isPlaying}
            zoom={zoom} setZoom={setZoom}
            layers={layers}
            setLayers={(u) => { setLayers(u); setSaved(false); }}
            selectedId={selectedLayerId}
            setSelectedId={(id) => { setSelectedLayerId(id); if (id) setSelectedClipId(null); }}
            onTogglePlay={() => setIsPlaying(p => !p)}
            onStepBack={() => setCurrentTime(t => Math.max(0, t - 1/project.fps))}
            onStepFwd={() => setCurrentTime(t => Math.min(project.duration, t + 1/project.fps))}
            onJumpStart={() => setCurrentTime(0)}
            onJumpEnd={() => setCurrentTime(project.duration)}
            previewQuality={previewQuality} setPreviewQuality={setPreviewQuality}
            showSafe={showSafe} setShowSafe={setShowSafe}
            showGrid={showGrid} setShowGrid={setShowGrid}
          />
          <Timeline
            project={project}
            tracks={tracks} setTracks={setTracksTracked}
            clips={clips} setClips={setClipsTracked}
            currentTime={currentTime} setCurrentTime={setCurrentTime}
            selectedClipId={selectedClipId}
            setSelectedClipId={(id) => { setSelectedClipId(id); if (id) setSelectedLayerId(null); }}
            pxPerSecond={pxPerSecond} setPxPerSecond={setPxPerSecond}
          />
        </div>
        <RightPanel
          selected={selectedLayer}
          setLayers={(u) => { setLayers(u); setSaved(false); }}
          clipSelected={clipSelected}
          updateClip={updateClip}
          project={project} setProject={setProject}
        />
      </div>

      {/* status bar */}
      <div className="h-6 shrink-0 bg-panel border-t border-line/70 flex items-center px-3 gap-4 text-[10.5px] text-mute font-mono">
        <span>Lumen 1.4</span>
        <span className="text-mute2">·</span>
        <span>{clips.length} clips · {tracks.length} tracks · {layers.length} layers</span>
        <span className="text-mute2">·</span>
        <span>GPU accelerated preview</span>
        <div className="flex-1"/>
        <span>{project.resolution} · {project.fps} fps</span>
        <span className="text-mute2">·</span>
        <span className="text-emerald-400/80">● connected</span>
        <span className="text-mute2">·</span>
        <span>autosave 14s ago</span>
      </div>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} project={project}/>
      <Tweaks open={tweaksOpen} onClose={() => setTweaksOpen(false)}
        theme={theme} setTheme={setTheme}
        font={font} setFont={setFont}
        density={density} setDensity={setDensity}/>
      {!editModeActive && (
        <button onClick={() => setTweaksOpen(o => !o)}
          className="fixed bottom-10 right-4 z-30 h-9 px-3 rounded-full bg-panel border border-line2 hover:border-accent/60 shadow-float text-[12px] text-ink2 hover:text-ink flex items-center gap-1.5">
          <I.sparkle size={13} className="text-accent"/>
          Theme
        </button>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
