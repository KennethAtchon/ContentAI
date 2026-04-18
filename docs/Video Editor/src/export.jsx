// Export modal
function ExportModal({ open, onClose, project }) {
  const { Btn, Seg, NumField } = window.UI;
  const [stage, setStage] = useState('configure'); // configure | progress | done
  const [res, setRes] = useState('1080p');
  const [fps, setFps] = useState(24);
  const [format, setFormat] = useState('mp4');
  const [preset, setPreset] = useState('high');
  const [codec, setCodec] = useState('h264');
  const [filename, setFilename] = useState(project.name.replace(/\s+/g, '_'));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (stage === 'progress') {
      setProgress(0);
      const id = setInterval(() => {
        setProgress(p => {
          if (p >= 100) { clearInterval(id); setStage('done'); return 100; }
          return Math.min(100, p + 2 + Math.random() * 4);
        });
      }, 140);
      return () => clearInterval(id);
    }
  }, [stage]);

  useEffect(() => {
    if (!open) { setStage('configure'); setProgress(0); }
  }, [open]);

  if (!open) return null;

  const fileSize = Math.round(
    (res === '4k' ? 8.5 : res === '1080p' ? 2.4 : 1.1) *
    (preset === 'high' ? 1.8 : preset === 'medium' ? 1.2 : 0.7) *
    (project.duration / 60) * 10
  ) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
         onMouseDown={onClose}>
      <div className="w-[680px] max-w-full rounded-xl bg-panel border border-line2 shadow-float overflow-hidden"
           onMouseDown={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-line/70">
          <div className="flex items-center gap-2">
            <I.download size={15} className="text-accent"/>
            <div className="text-[13px] font-semibold">Export</div>
            <div className="text-[11px] text-mute">·</div>
            <div className="text-[11.5px] text-mute truncate max-w-[320px]">{project.name}</div>
          </div>
          <Btn kind="ghost" size="iconSm" onClick={onClose}><I.close size={14}/></Btn>
        </div>

        {stage === 'configure' && (
          <div className="p-5 grid grid-cols-2 gap-5">
            <div className="col-span-2 flex gap-3 items-center">
              <label className="flex-1">
                <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1">File name</div>
                <div className="flex items-center h-9 px-3 rounded-md bg-panel2 border border-line/60 focus-within:border-accent/60">
                  <input value={filename} onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 bg-transparent text-[13px] outline-none" />
                  <span className="text-[11px] font-mono text-mute">.{format}</span>
                </div>
              </label>
            </div>

            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1.5">Resolution</div>
              <div className="flex flex-col gap-1">
                {[
                  { v: '720p',  l: '1280 × 720',   t: 'Social cuts' },
                  { v: '1080p', l: '1920 × 1080',  t: 'Standard HD' },
                  { v: '4k',    l: '3840 × 2160',  t: 'Master · 4K UHD' },
                ].map(o => (
                  <button key={o.v} onClick={() => setRes(o.v)}
                    className={`px-3 h-10 rounded-md border text-left flex items-center justify-between transition-colors ${
                      res === o.v ? 'border-accent bg-accent/5' : 'border-line/60 hover:border-line2 bg-panel2'
                    }`}>
                    <div>
                      <div className="text-[12.5px] font-medium">{o.v}</div>
                      <div className="text-[10.5px] text-mute">{o.l}</div>
                    </div>
                    <div className="text-[10.5px] text-mute">{o.t}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1.5">Frame rate</div>
                <Seg value={String(fps)} onChange={(v) => setFps(Number(v))} className="w-full flex"
                  options={[
                    { value: '24', label: '24' },
                    { value: '30', label: '30' },
                    { value: '60', label: '60' },
                  ]}/>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1.5">Format</div>
                <Seg value={format} onChange={setFormat} className="w-full flex"
                  options={[
                    { value: 'mp4',  label: 'MP4'  },
                    { value: 'mov',  label: 'MOV'  },
                    { value: 'webm', label: 'WebM' },
                    { value: 'gif',  label: 'GIF'  },
                  ]}/>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1.5">Codec</div>
                <Seg value={codec} onChange={setCodec} className="w-full flex"
                  options={[
                    { value: 'h264', label: 'H.264' },
                    { value: 'h265', label: 'H.265' },
                    { value: 'prores', label: 'ProRes' },
                  ]}/>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-mute font-semibold mb-1.5">Quality preset</div>
                <Seg value={preset} onChange={setPreset} className="w-full flex"
                  options={[
                    { value: 'low',    label: 'Draft'   },
                    { value: 'medium', label: 'Balanced'},
                    { value: 'high',   label: 'High'    },
                  ]}/>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between p-3 rounded-md bg-panel2 border border-line/60">
              <div className="flex items-center gap-5">
                <Stat l="Duration" v={`${Math.floor(project.duration/60)}m ${Math.round(project.duration%60)}s`}/>
                <Stat l="Output"   v={`${res} · ${fps} fps`}/>
                <Stat l="Codec"    v={codec.toUpperCase()}/>
                <Stat l="Est. size" v={`≈ ${fileSize} MB`}/>
              </div>
              <Btn kind="primary" size="lg" icon={<I.download size={13}/>} onClick={() => setStage('progress')}>
                Start export
              </Btn>
            </div>

            <div className="col-span-2 text-[10.5px] text-mute2 -mt-3">
              Tip: Use <span className="font-mono text-mute">Balanced</span> for social drafts, <span className="font-mono text-mute">High</span> for client review, <span className="font-mono text-mute">ProRes</span> for the color pipeline.
            </div>
          </div>
        )}

        {stage === 'progress' && (
          <div className="p-10 flex flex-col items-center text-center gap-5">
            <div className="relative h-20 w-20">
              <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                <circle cx="40" cy="40" r="34" stroke="oklch(0.30 0.008 260)" strokeWidth="6" fill="none"/>
                <circle cx="40" cy="40" r="34" stroke="oklch(0.86 0.17 128)" strokeWidth="6" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2*Math.PI*34}
                  strokeDashoffset={2*Math.PI*34 * (1 - progress/100)}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[14px]">{Math.floor(progress)}%</div>
            </div>
            <div>
              <div className="text-[14px] font-semibold">Rendering {filename}.{format}</div>
              <div className="text-[12px] text-mute mt-1">Encoding frame {Math.floor(progress/100 * project.duration * fps)} of {Math.floor(project.duration * fps)} · {res} {codec.toUpperCase()}</div>
            </div>
            <div className="w-full max-w-[420px] h-1.5 rounded-full bg-panel2 overflow-hidden">
              <div className="h-full bg-accent transition-[width] duration-150" style={{width: progress+'%'}}/>
            </div>
            <Btn kind="subtle" size="md" onClick={onClose}>Cancel</Btn>
          </div>
        )}

        {stage === 'done' && (
          <div className="p-10 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-accent/15 flex items-center justify-center text-accent">
              <I.check size={26}/>
            </div>
            <div>
              <div className="text-[15px] font-semibold">Export complete</div>
              <div className="text-[12px] text-mute mt-1">{filename}.{format} · {res} · ≈ {fileSize} MB · rendered in {Math.floor(project.duration*0.4)}s</div>
            </div>
            <div className="flex items-center gap-2">
              <Btn kind="subtle" size="md" icon={<I.folder size={13}/>}>Show in finder</Btn>
              <Btn kind="subtle" size="md" icon={<I.share size={13}/>}>Copy share link</Btn>
              <Btn kind="primary" size="md" onClick={onClose}>Done</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ l, v }) {
  return (
    <div className="flex flex-col">
      <div className="text-[9.5px] uppercase tracking-wider text-mute font-semibold">{l}</div>
      <div className="text-[12.5px] font-mono text-ink">{v}</div>
    </div>
  );
}

window.ExportModal = ExportModal;
