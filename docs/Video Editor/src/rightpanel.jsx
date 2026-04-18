// Right panel — properties / adjust / animate / effects
function RightPanel({ selected, setLayers, clipSelected, updateClip, project, setProject }) {
  const { Btn, Tag, Hr, NumField, SliderRow, Swatch, Seg, cx } = window.UI;
  const [tab, setTab] = useState('adjust');
  const active = selected || clipSelected;

  const tabs = [
    { id: 'adjust',  label: 'Adjust' },
    { id: 'animate', label: 'Animate' },
    { id: 'effects', label: 'Effects' },
    { id: 'project', label: 'Project' },
  ];

  return (
    <div className="w-[320px] shrink-0 bg-panel border-l border-line/70 flex flex-col">
      <div className="px-3 pt-3 pb-2 border-b border-line/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {selected && <LayerBadge kind={selected.kind}/>}
            {clipSelected && !selected && <LayerBadge kind={clipSelected.kind}/>}
            {!active && <div className="text-[11px] text-mute">No selection</div>}
            <div className="text-[12.5px] font-semibold truncate min-w-0">
              {selected?.name || clipSelected?.name || 'Project'}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Btn kind="ghost" size="iconSm" title="Lock"><I.lock size={13}/></Btn>
            <Btn kind="ghost" size="iconSm" title="Visibility"><I.eye size={13}/></Btn>
            <Btn kind="ghost" size="iconSm" title="More"><I.dots size={13}/></Btn>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cx(
                'h-7 px-2 text-[11.5px] rounded-md transition-colors',
                tab === t.id ? 'bg-panel3 text-ink' : 'text-mute hover:text-ink'
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'adjust' && selected && <AdjustTab layer={selected} setLayers={setLayers} />}
        {tab === 'adjust' && !selected && clipSelected && <ClipAdjustTab clip={clipSelected} updateClip={updateClip}/>}
        {tab === 'adjust' && !active && <EmptyState label="Select a clip or layer to adjust"/>}
        {tab === 'animate' && <AnimateTab/>}
        {tab === 'effects' && <EffectsTab/>}
        {tab === 'project' && <ProjectTab project={project} setProject={setProject}/>}
      </div>
    </div>
  );
}

function LayerBadge({ kind }) {
  const map = {
    video: { bg: 'bg-video/20', fg: 'text-video', l: 'VIDEO' },
    audio: { bg: 'bg-audio/20', fg: 'text-audio', l: 'AUDIO' },
    text:  { bg: 'bg-text/20',  fg: 'text-text',  l: 'TEXT' },
    overlay: { bg: 'bg-overlay/20', fg: 'text-overlay', l: 'OVERLAY' },
  }[kind] || { bg: 'bg-panel3', fg: 'text-mute', l: kind?.toUpperCase() || '—' };
  return <span className={`px-1.5 h-5 rounded text-[9.5px] font-semibold font-mono flex items-center ${map.bg} ${map.fg}`}>{map.l}</span>;
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 gap-2 text-mute">
      <div className="h-12 w-12 rounded-lg border border-dashed border-line2 flex items-center justify-center">
        <I.shapes size={20}/>
      </div>
      <div className="text-[12px]">{label}</div>
      <div className="text-[10.5px] text-mute2 max-w-[200px]">Click any element in the preview, or a clip on the timeline.</div>
    </div>
  );
}

function Section({ title, right, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line/70">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 h-9 hover:bg-white/[0.02]">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-mute font-semibold">
          <I.chevD size={11} className={open ? '' : '-rotate-90'}/>
          {title}
        </div>
        {right}
      </button>
      {open && <div className="px-3 pb-3 pt-0.5 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}

// ---------- layer adjust ----------
function AdjustTab({ layer, setLayers }) {
  const { NumField, SliderRow, Swatch, Seg } = window.UI;
  const update = (patch) => setLayers(ls => ls.map(l => l.id === layer.id ? { ...l, ...patch } : l));

  return (
    <>
      <Section title="Transform">
        <div className="grid grid-cols-2 gap-1.5">
          <NumField label="X" value={layer.x} suffix="px" onChange={v => update({ x: v })}/>
          <NumField label="Y" value={layer.y} suffix="px" onChange={v => update({ y: v })}/>
          <NumField label="W" value={layer.w} suffix="px" onChange={v => update({ w: v })}/>
          <NumField label="H" value={layer.h} suffix="px" onChange={v => update({ h: v })}/>
        </div>
        <div className="flex items-center gap-1.5">
          <NumField label="Rot" value={layer.rotation || 0} suffix="°" onChange={v => update({ rotation: v })}/>
          <NumField label="Rad" value={layer.radius || 0} suffix="px" onChange={v => update({ radius: v })}/>
        </div>
        <SliderRow label="Opacity" min={0} max={100} value={Math.round((layer.opacity ?? 1) * 100)}
          onChange={v => update({ opacity: v / 100 })} format={v => v + '%'}/>
        <div className="flex items-center gap-1 pt-1">
          <Btn kind="subtle" size="sm" className="flex-1 justify-center" icon={<I.fit size={12}/>}>Fit</Btn>
          <Btn kind="subtle" size="sm" className="flex-1 justify-center" icon={<I.fill size={12}/>}>Fill</Btn>
          <Btn kind="subtle" size="sm" className="flex-1 justify-center" icon={<I.replace size={12}/>}>Center</Btn>
        </div>
      </Section>

      {layer.kind === 'text' && <TextAdjust layer={layer} update={update}/>}
      {layer.kind !== 'text' && <VisualAdjust layer={layer} update={update}/>}

      <Section title="Blending" defaultOpen={false}>
        <Seg value="normal" onChange={()=>{}} className="w-full flex"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'multiply', label: 'Multiply' },
            { value: 'screen', label: 'Screen' },
            { value: 'overlay', label: 'Overlay' },
          ]}/>
        <SliderRow label="Fill" value={100} onChange={() => {}} format={v => v+'%'}/>
      </Section>
    </>
  );
}

function Btn(props) {
  return window.UI.Btn(props);
}

function VisualAdjust({ layer, update }) {
  return (
    <>
      <Section title="Color">
        <SliderRow label="Exposure" min={-100} max={100} value={0} onChange={()=>{}}/>
        <SliderRow label="Contrast" min={-100} max={100} value={6} onChange={()=>{}}/>
        <SliderRow label="Saturation" min={-100} max={100} value={-4} onChange={()=>{}}/>
        <SliderRow label="Temperature" min={-100} max={100} value={12} onChange={()=>{}}/>
        <SliderRow label="Tint" min={-100} max={100} value={-3} onChange={()=>{}}/>
      </Section>
      <Section title="Crop & mask" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-1.5">
          <window.UI.NumField label="T" value={0} suffix="px" onChange={()=>{}}/>
          <window.UI.NumField label="B" value={0} suffix="px" onChange={()=>{}}/>
          <window.UI.NumField label="L" value={0} suffix="px" onChange={()=>{}}/>
          <window.UI.NumField label="R" value={0} suffix="px" onChange={()=>{}}/>
        </div>
        <window.UI.Seg value="none" onChange={()=>{}} className="w-full flex"
          options={[
            { value: 'none', label: 'None' },
            { value: 'circle', label: 'Circle' },
            { value: 'rect', label: 'Rect' },
            { value: 'custom', label: 'Custom' },
          ]}/>
      </Section>
    </>
  );
}

function TextAdjust({ layer, update }) {
  const fonts = ['Inter','JetBrains Mono','Georgia','Times New Roman','Helvetica','Courier'];
  const colors = ['#F6F7F3','#0A0A0A','#E7B64C','#6BD2C7','#A77BE2','#E26B6B'];
  return (
    <>
      <Section title="Text">
        <textarea
          value={layer.text}
          onChange={(e) => update({ text: e.target.value })}
          className="w-full min-h-[56px] bg-panel2 border border-line/60 rounded-md p-2 text-[12.5px] resize-none outline-none focus:border-accent/60"
        />
      </Section>
      <Section title="Typography">
        <select value={layer.font} onChange={(e) => update({ font: e.target.value })}
          className="h-8 px-2 bg-panel2 border border-line/60 rounded-md text-[12px] outline-none focus:border-accent/60">
          {fonts.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1.5">
          <window.UI.NumField label="Size" value={layer.size} suffix="px" onChange={v => update({ size: v })}/>
          <window.UI.NumField label="Wgt" value={layer.weight} onChange={v => update({ weight: v })}/>
          <window.UI.NumField label="Lsp" value={layer.letter || 0} suffix="px" onChange={v => update({ letter: v })}/>
        </div>
        <div className="flex items-center gap-1">
          <Btn kind="subtle" size="iconSm" active={layer.weight >= 700} onClick={() => update({ weight: layer.weight >= 700 ? 500 : 700 })}><I.bold size={12}/></Btn>
          <Btn kind="subtle" size="iconSm"><I.italic size={12}/></Btn>
          <Btn kind="subtle" size="iconSm"><I.underline size={12}/></Btn>
          <div className="h-4 w-px bg-line/70 mx-1"/>
          <Btn kind="subtle" size="iconSm" active={layer.align === 'left'}   onClick={() => update({ align: 'left' })}><I.alignL size={12}/></Btn>
          <Btn kind="subtle" size="iconSm" active={layer.align === 'center'} onClick={() => update({ align: 'center' })}><I.alignC size={12}/></Btn>
          <Btn kind="subtle" size="iconSm" active={layer.align === 'right'}  onClick={() => update({ align: 'right' })}><I.alignR size={12}/></Btn>
        </div>
      </Section>
      <Section title="Color & stroke">
        <div className="flex flex-wrap gap-1.5">
          {colors.map(c => (
            <window.UI.Swatch key={c} color={c} selected={c.toLowerCase() === (layer.color||'').toLowerCase()} onClick={() => update({ color: c })}/>
          ))}
          <div className="h-6 w-6 rounded-md border border-dashed border-line2 flex items-center justify-center text-mute"><I.plus size={11}/></div>
        </div>
        <window.UI.SliderRow label="Stroke" min={0} max={12} value={layer.stroke || 0} onChange={v => update({ stroke: v })} format={v => v+'px'}/>
        <window.UI.SliderRow label="Shadow" min={0} max={40} value={layer.shadow || 0} onChange={v => update({ shadow: v })} format={v => v+'px'}/>
      </Section>
    </>
  );
}

function ClipAdjustTab({ clip, updateClip }) {
  const { SliderRow, NumField } = window.UI;
  const isAudio = clip.kind === 'audio';
  return (
    <>
      <Section title="Timing">
        <div className="grid grid-cols-2 gap-1.5">
          <NumField label="In" value={clip.start.toFixed(2)} suffix="s" onChange={v => updateClip({ start: v })}/>
          <NumField label="Len" value={clip.length.toFixed(2)} suffix="s" onChange={v => updateClip({ length: v })}/>
        </div>
        <SliderRow label="Speed" min={25} max={400} step={5} value={100} onChange={() => {}} format={v => (v/100).toFixed(2)+'×'}/>
      </Section>
      {isAudio ? (
        <Section title="Audio">
          <SliderRow label="Volume" min={-60} max={12} value={-6} onChange={() => {}} format={v => (v>0?'+':'') + v + ' dB'}/>
          <SliderRow label="Fade in"  min={0} max={4} step={0.1} value={0.4} onChange={() => {}} format={v => v.toFixed(1)+'s'}/>
          <SliderRow label="Fade out" min={0} max={4} step={0.1} value={1.2} onChange={() => {}} format={v => v.toFixed(1)+'s'}/>
          <div className="flex gap-1 pt-1">
            <Btn kind="subtle" size="sm" className="flex-1 justify-center" icon={<I.mute size={12}/>}>Mute</Btn>
            <Btn kind="subtle" size="sm" className="flex-1 justify-center" icon={<I.sparkle size={12}/>}>Denoise</Btn>
          </div>
        </Section>
      ) : (
        <Section title="Visual">
          <SliderRow label="Opacity" value={100} onChange={()=>{}} format={v => v+'%'}/>
          <SliderRow label="Scale" min={10} max={300} value={100} onChange={()=>{}} format={v => v+'%'}/>
          <SliderRow label="Blur" min={0} max={60} value={0} onChange={()=>{}} format={v => v+'px'}/>
        </Section>
      )}
    </>
  );
}

function AnimateTab() {
  return (
    <>
      <Section title="Presets">
        <div className="grid grid-cols-2 gap-2">
          {[
            { n:'Fade in', t:'0.4s' },
            { n:'Rise up', t:'0.5s' },
            { n:'Scale pop', t:'0.3s' },
            { n:'Slide left', t:'0.6s' },
            { n:'Typewriter', t:'1.2s' },
            { n:'Float loop', t:'2.0s' },
          ].map(p => (
            <div key={p.n} className="aspect-[5/3] rounded-md bg-panel2 border border-line/60 hover:border-accent/60 p-2 flex flex-col justify-between cursor-pointer">
              <div className="h-8 flex items-end gap-0.5">
                {[...Array(14)].map((_,i) => (
                  <div key={i} className="w-1 rounded-sm bg-accent/70" style={{height: (8+Math.abs(Math.sin(i+p.n.length))*24)+'px'}}/>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[11.5px]">{p.n}</div>
                <div className="text-[10px] font-mono text-mute">{p.t}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Keyframes">
        <div className="flex items-center gap-1.5">
          <Btn kind="subtle" size="sm" icon={<I.plus size={12}/>}>Add keyframe</Btn>
          <Btn kind="ghost" size="sm" icon={<I.clock size={12}/>}>Linear</Btn>
        </div>
        <div className="rounded-md border border-line/60 bg-panel2 overflow-hidden">
          {[
            { p:'Position', v:'−120, 0 → 0, 0', t:'0:12'},
            { p:'Scale',    v:'80% → 100%',     t:'0:14'},
            { p:'Opacity',  v:'0 → 1',          t:'0:14'},
          ].map(k => (
            <div key={k.p} className="flex items-center gap-2 px-2 h-8 border-b border-line/50 last:border-b-0">
              <div className="h-2 w-2 rotate-45 bg-accent" />
              <div className="text-[12px]">{k.p}</div>
              <div className="text-[10.5px] text-mute ml-auto font-mono">{k.v}</div>
              <div className="text-[10.5px] text-mute2 font-mono">{k.t}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function EffectsTab() {
  const stack = [
    { n: 'Film grain',  pct: 22, on: true },
    { n: 'Vignette',    pct: 14, on: true },
    { n: 'Chromatic aberration', pct: 6, on: false },
    { n: 'Glow',        pct: 0, on: false },
  ];
  return (
    <>
      <Section title="Effect stack">
        <div className="rounded-md border border-line/60 bg-panel2 divide-y divide-line/50">
          {stack.map(e => (
            <div key={e.n} className="flex items-center gap-2 px-2 h-10">
              <button className={`h-3 w-3 rounded-sm border ${e.on ? 'bg-accent border-accent' : 'border-line2'}`}/>
              <div className="text-[12px] flex-1">{e.n}</div>
              <div className="font-mono text-[10.5px] text-mute">{e.pct}%</div>
              <Btn kind="ghost" size="iconSm"><I.dots size={12}/></Btn>
            </div>
          ))}
        </div>
        <Btn kind="subtle" size="sm" className="w-full justify-center mt-1" icon={<I.plus size={12}/>}>Add effect</Btn>
      </Section>
      <Section title="Looks">
        <div className="grid grid-cols-3 gap-1.5">
          {['Neutral','Teal & Ivy','Warm Film','Bleach','Night','Desat'].map((n,i)=>(
            <div key={n} className={`aspect-square rounded-md stripes-${['a','b','c','d','e','a'][i]} relative cursor-pointer overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"/>
              <div className="absolute bottom-1 left-1 right-1 text-[9.5px] font-mono text-white/90 truncate">{n}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function ProjectTab({ project, setProject }) {
  const { SliderRow, NumField, Seg } = window.UI;
  return (
    <>
      <Section title="Project">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="col-span-2 h-8 px-2 rounded-md bg-panel2 border border-line/60 flex items-center text-[12px]">{project.name}</div>
          <NumField label="FPS" value={project.fps} onChange={v => setProject(p => ({ ...p, fps: v }))}/>
          <NumField label="Dur" value={project.duration.toFixed(1)} suffix="s" onChange={v => setProject(p => ({ ...p, duration: v }))}/>
        </div>
        <Seg value="1080" onChange={() => {}} className="w-full flex"
          options={[
            { value: '720', label: '720p' },
            { value: '1080', label: '1080p' },
            { value: '4k', label: '4K' },
            { value: 'sq', label: '1:1' },
          ]}/>
      </Section>
      <Section title="Scratch notes">
        <textarea
          placeholder="Keep session notes, todos, or direction for this cut…"
          className="w-full min-h-[100px] bg-panel2 border border-line/60 rounded-md p-2 text-[12px] outline-none focus:border-accent/60 resize-none"
          defaultValue={'- tighten intro to 10s\n- swap score at 0:34 for softer cue\n- color pass on interview A-cam'}
        />
      </Section>
    </>
  );
}

window.RightPanel = RightPanel;
