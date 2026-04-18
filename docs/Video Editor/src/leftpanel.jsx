// Left panel: tabbed media / text / elements / transitions / audio / uploads
function LeftPanel({ onInsertAsset }) {
  const { Btn, Tag, cx } = window.UI;
  const [tab, setTab] = useState('media');
  const [view, setView] = useState('grid');
  const [query, setQuery] = useState('');

  const tabs = [
    { id: 'media',       label: 'Media',       icon: <I.film size={15}/> },
    { id: 'text',        label: 'Text',        icon: <I.type size={15}/> },
    { id: 'elements',    label: 'Elements',    icon: <I.shapes size={15}/> },
    { id: 'transitions', label: 'Fx',          icon: <I.transition size={15}/> },
    { id: 'audio',       label: 'Audio',       icon: <I.audio size={15}/> },
    { id: 'uploads',     label: 'Uploads',     icon: <I.upload size={15}/> },
  ];

  return (
    <div className="w-[300px] shrink-0 flex bg-panel border-r border-line/70">
      {/* icon rail */}
      <div className="w-[56px] shrink-0 border-r border-line/70 flex flex-col items-center py-2 gap-1">
        {tabs.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'group w-[44px] py-1.5 rounded-md flex flex-col items-center gap-1 transition-colors',
              tab === t.id
                ? 'bg-panel3 text-ink shadow-[inset_0_0_0_1px_oklch(0.36_0.008_260)]'
                : 'text-ink2 hover:text-ink hover:bg-white/[0.04]'
            )}>
            {t.icon}
            <span className="text-[10px]">{t.label}</span>
          </button>
        ))}
        <div className="mt-auto pb-1">
          <Btn kind="ghost" size="iconSm" title="Project folder"><I.folder size={14}/></Btn>
        </div>
      </div>

      {/* content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-[13px] font-semibold tracking-tight">
              {tabs.find(t => t.id === tab)?.label}
            </div>
            <div className="text-[10px] font-mono text-mute2 px-1.5 py-[2px] rounded bg-panel2 border border-line/60">
              {tab === 'media' ? MOCK.ASSETS.filter(a => a.kind !== 'audio').length
               : tab === 'audio' ? MOCK.ASSETS.filter(a => a.kind === 'audio').length
               : 0}
            </div>
          </div>
          <Btn kind="ghost" size="iconSm" title="New folder"><I.plus size={14}/></Btn>
        </div>

        {/* search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <I.search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets"
              className="w-full h-8 pl-7 pr-2 bg-panel2 border border-line/60 hover:border-line2 focus:border-accent/60 rounded-md text-[12px] outline-none placeholder:text-mute2" />
          </div>
        </div>

        {/* sub tabs / filter row */}
        {tab === 'media' && (
          <div className="px-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {['All','Video','Image','Favorites'].map((l, i) => (
                <button key={l} className={cx(
                  'h-6 px-2 text-[11px] rounded-full border transition-colors',
                  i === 0 ? 'bg-panel3 border-line2 text-ink' : 'bg-transparent border-line/60 text-mute hover:text-ink hover:border-line2'
                )}>{l}</button>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              <Btn kind="ghost" size="iconSm" active={view === 'grid'} onClick={() => setView('grid')}><I.grid size={14}/></Btn>
              <Btn kind="ghost" size="iconSm" active={view === 'list'} onClick={() => setView('list')}><I.list size={14}/></Btn>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {tab === 'media' && <MediaGrid view={view} query={query} onInsertAsset={onInsertAsset} />}
          {tab === 'text' && <TextTab />}
          {tab === 'elements' && <ElementsTab />}
          {tab === 'transitions' && <TransitionsTab />}
          {tab === 'audio' && <AudioTab query={query} onInsertAsset={onInsertAsset} />}
          {tab === 'uploads' && <UploadsTab />}
        </div>

        {/* storage footer */}
        <div className="px-3 py-2 border-t border-line/70 flex items-center gap-2 text-[10.5px] text-mute">
          <I.upload size={12}/>
          <div className="flex-1">
            <div className="flex justify-between mb-1"><span>Project storage</span><span className="font-mono text-mute">4.2 / 20 GB</span></div>
            <div className="h-1 w-full bg-panel2 rounded-full overflow-hidden">
              <div className="h-full bg-accent/70" style={{ width: '21%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaGrid({ view, query, onInsertAsset }) {
  const assets = MOCK.ASSETS.filter(a => a.kind !== 'audio')
    .filter(a => !query || a.name.toLowerCase().includes(query.toLowerCase()));

  if (view === 'list') {
    return (
      <div className="flex flex-col gap-0.5">
        {assets.map(a => (
          <button key={a.id} onClick={() => onInsertAsset && onInsertAsset(a)}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/[0.04] text-left">
            <div className={`h-10 w-14 rounded ${a.thumb} relative overflow-hidden shrink-0`}>
              <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 right-1 text-[9px] font-mono text-white/90">
                {a.duration ? window.UI.formatClock(a.duration) : 'IMG'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] truncate">{a.name}</div>
              <div className="text-[10px] text-mute truncate">{a.meta}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {assets.map(a => <AssetCard key={a.id} a={a} onInsertAsset={onInsertAsset}/>)}
    </div>
  );
}

function AssetCard({ a, onInsertAsset }) {
  return (
    <div onClick={() => onInsertAsset && onInsertAsset(a)}
      role="button" tabIndex={0}
      className="group text-left cursor-pointer">
      <div className={`aspect-video rounded-md ${a.thumb} relative overflow-hidden ring-1 ring-line/70 group-hover:ring-accent/60 transition`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-1.5 left-1.5 h-4 px-1.5 rounded text-[9px] font-mono font-semibold bg-black/60 text-white/90 flex items-center">
          {a.kind.toUpperCase()}
        </div>
        <div className="absolute bottom-1 right-1.5 text-[10px] font-mono text-white/90">
          {a.duration ? window.UI.formatClock(a.duration) : ''}
        </div>
        <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/50 text-white/90 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-black/70">
          <I.plus size={11}/>
        </span>
      </div>
      <div className="mt-1.5 text-[11.5px] leading-tight truncate">{a.name}</div>
      <div className="text-[10px] text-mute2 truncate">{a.meta}</div>
    </div>
  );
}

function TextTab() {
  const { Tag } = window.UI;
  const presets = [
    { label: 'TITLE', sub: 'Display · 96pt', font: 'Inter', weight: 900, size: 32, style: { letterSpacing: '-0.04em' } },
    { label: 'Heading',   sub: 'Semibold · 48pt',font: 'Inter', weight: 600, size: 22 },
    { label: 'Subtitle', sub: 'Regular · 32pt', font: 'Inter', weight: 400, size: 18, style: { fontStyle: 'italic'} },
    { label: 'BODY COPY',sub: 'Regular · 20pt', font: 'Inter', weight: 400, size: 14 },
    { label: 'Caption',  sub: 'Mono · 14pt',    font: 'JetBrains Mono', weight: 500, size: 12 },
    { label: 'Lower third', sub: 'Two-line card', font: 'Inter', weight: 600, size: 16 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <button className="flex items-center justify-between px-3 h-9 rounded-md bg-panel2 border border-line/60 hover:border-accent/60 text-[12px] text-ink2 hover:text-ink">
        <div className="flex items-center gap-2"><I.type size={14}/>Add plain text</div>
        <I.plus size={14}/>
      </button>
      <Tag>Styles</Tag>
      <div className="grid grid-cols-2 gap-2">
        {presets.map((p, i) => (
          <div key={i} className="aspect-[5/3] rounded-md border border-line/60 bg-panel2 hover:border-accent/60 p-3 flex flex-col justify-end cursor-pointer group">
            <div className="text-ink" style={{
              fontFamily: p.font,
              fontWeight: p.weight,
              fontSize: p.size,
              ...(p.style || {})
            }}>{p.label}</div>
            <div className="text-[10px] text-mute mt-1">{p.sub}</div>
          </div>
        ))}
      </div>
      <Tag>Animated titles</Tag>
      <div className="grid grid-cols-2 gap-2">
        {['Typewriter','Glitch wave','Soft rise','Kinetic split'].map(n => (
          <div key={n} className="aspect-[5/3] rounded-md border border-line/60 bg-panel2 hover:border-accent/60 p-2 flex flex-col justify-between cursor-pointer">
            <div className="flex gap-0.5 items-center">
              {[...Array(12)].map((_,i) => (
                <div key={i} className="h-3 w-1 rounded-sm bg-gradient-to-t from-accent/60 to-accent"
                     style={{ opacity: 0.3 + Math.abs(Math.sin(i+n.length))*0.7 }} />
              ))}
            </div>
            <div className="text-[11px]">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementsTab() {
  const { Tag } = window.UI;
  return (
    <div className="flex flex-col gap-3">
      <Tag>Shapes</Tag>
      <div className="grid grid-cols-4 gap-2">
        {['rect','circle','tri','arrow','star','hex','line','pill'].map((s,i) => (
          <div key={i} className="aspect-square rounded-md bg-panel2 border border-line/60 hover:border-accent/60 flex items-center justify-center cursor-pointer">
            {s === 'rect' && <div className="h-5 w-7 bg-ink2 rounded-[2px]" />}
            {s === 'circle' && <div className="h-6 w-6 rounded-full bg-ink2" />}
            {s === 'tri' && <div style={{width:0,height:0,borderLeft:'12px solid transparent',borderRight:'12px solid transparent',borderBottom:'20px solid oklch(0.78 0.008 260)'}}/>}
            {s === 'arrow' && <div className="text-ink2"><I.chevR size={20}/></div>}
            {s === 'star' && <div className="text-ink2"><I.star size={22}/></div>}
            {s === 'hex' && <div className="h-5 w-6 bg-ink2" style={{clipPath:'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'}} />}
            {s === 'line' && <div className="h-[2px] w-7 bg-ink2" />}
            {s === 'pill' && <div className="h-4 w-8 bg-ink2 rounded-full" />}
          </div>
        ))}
      </div>
      <Tag>Stickers & emojis</Tag>
      <div className="grid grid-cols-4 gap-2">
        {['▲','◆','●','✦','✺','❖','⬡','✕'].map((g,i)=>(
          <div key={i} className="aspect-square rounded-md bg-panel2 border border-line/60 hover:border-accent/60 flex items-center justify-center text-xl text-ink2 cursor-pointer">{g}</div>
        ))}
      </div>
      <Tag>Motion graphics</Tag>
      <div className="grid grid-cols-2 gap-2">
        {['Progress bar','Countdown 0:10','Pulse dot','Crosshair'].map(n => (
          <div key={n} className="aspect-[5/3] rounded-md bg-panel2 border border-line/60 hover:border-accent/60 p-2 flex flex-col justify-end cursor-pointer">
            <div className="text-[11px]">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransitionsTab() {
  const { Tag } = window.UI;
  const kinds = [
    { n: 'Cross dissolve',  d: 0.4 },
    { n: 'Fade to black',   d: 0.6 },
    { n: 'Whip pan',        d: 0.3 },
    { n: 'Ink bleed',       d: 0.8 },
    { n: 'Cube rotate',     d: 0.7 },
    { n: 'Slide left',      d: 0.4 },
    { n: 'Shutter',         d: 0.5 },
    { n: 'Zoom punch',      d: 0.3 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Tag>Basics</Tag>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map(k => (
          <div key={k.n} className="rounded-md border border-line/60 bg-panel2 hover:border-accent/60 overflow-hidden cursor-pointer">
            <div className="h-14 flex">
              <div className="flex-1 stripes-a"/>
              <div className="w-5 bg-gradient-to-r from-transparent to-black/70"/>
              <div className="flex-1 stripes-b"/>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="text-[11.5px]">{k.n}</div>
              <div className="text-[10px] font-mono text-mute">{k.d.toFixed(1)}s</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AudioTab({ query, onInsertAsset }) {
  const { Tag } = window.UI;
  const audio = MOCK.ASSETS.filter(a => a.kind === 'audio')
    .filter(a => !query || a.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-2">
      <Tag>Project audio</Tag>
      {audio.map(a => (
        <button key={a.id} onClick={() => onInsertAsset && onInsertAsset(a)}
          className="flex items-center gap-2 p-2 rounded-md bg-panel2 border border-line/60 hover:border-accent/60 text-left">
          <div className="h-9 w-9 shrink-0 rounded-md bg-gradient-to-br from-[oklch(0.68_0.10_185)] to-[oklch(0.52_0.10_210)] flex items-center justify-center text-[oklch(0.14_0_0)]">
            <I.wave size={16}/>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] truncate">{a.name}</div>
            <div className="text-[10px] text-mute">{a.meta}</div>
          </div>
          <div className="text-[10px] font-mono text-mute">{window.UI.formatClock(a.duration)}</div>
        </button>
      ))}
      <Tag className="mt-2">Stock tracks</Tag>
      {['Evening Tide — Ambient','Forward — Cinematic','Pulse — Synth','Paperwork — Lo-fi'].map((n,i) => (
        <div key={n} className="flex items-center gap-2 p-2 rounded-md bg-panel2 border border-line/60 hover:border-accent/60 cursor-pointer">
          <div className="h-9 w-9 rounded-md bg-panel3 flex items-center justify-center"><I.audio size={15}/></div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] truncate">{n}</div>
            <div className="text-[10px] text-mute">{['Ambient','Cinematic','Synthwave','Lofi'][i]} · {Math.floor(60+Math.random()*120)}s</div>
          </div>
          <button className="text-mute hover:text-ink"><I.play size={13}/></button>
        </div>
      ))}
    </div>
  );
}

function UploadsTab() {
  const { Tag, Btn } = window.UI;
  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-[5/3] rounded-lg border border-dashed border-line2 bg-panel2/50 hover:border-accent/60 hover:bg-panel2 flex flex-col items-center justify-center cursor-pointer text-mute hover:text-ink transition-colors">
        <I.upload size={22}/>
        <div className="mt-2 text-[12px] text-ink2">Drop files to upload</div>
        <div className="text-[10.5px] text-mute2 mt-0.5">or click to browse · up to 5 GB</div>
      </div>
      <Tag>Recent uploads</Tag>
      <div className="flex flex-col gap-1.5">
        {[
          { n: 'Aurora_Opening.mp4', s: '412 MB', t: '2m ago', p: 100 },
          { n: 'Drone_Coastline.mov', s: '1.8 GB', t: '6m ago', p: 100 },
          { n: 'Rough_cut_v3.wav',   s: '24 MB',  t: 'uploading', p: 64 },
        ].map(u => (
          <div key={u.n} className="p-2 rounded-md bg-panel2 border border-line/60">
            <div className="flex items-center justify-between">
              <div className="text-[12px] truncate">{u.n}</div>
              <div className="text-[10px] font-mono text-mute">{u.s}</div>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-panel3 overflow-hidden">
              <div className={u.p === 100 ? 'h-full bg-emerald-400/70' : 'h-full bg-accent/70'} style={{width: u.p + '%'}}/>
            </div>
            <div className="mt-1 text-[10px] text-mute2">{u.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.LeftPanel = LeftPanel;
