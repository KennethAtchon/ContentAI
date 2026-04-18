// Top toolbar / header bar
function Header({ project, setProject, onExport, canUndo, canRedo, onUndo, onRedo, saved, mode, setMode }) {
  const { Btn, Kbd, Seg, cx } = window.UI;
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(project.name);
  useEffect(() => setNameVal(project.name), [project.name]);

  const commitName = () => {
    setEditingName(false);
    if (nameVal.trim()) setProject(p => ({ ...p, name: nameVal.trim() }));
  };

  return (
    <header className="h-12 shrink-0 bg-panel border-b border-line/70 flex items-center px-3 gap-2 relative z-30">
      {/* left: logo + project */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-2 pr-2">
          <div className="text-accent"><I.logo size={22} /></div>
          <div className="font-semibold tracking-tight text-[13.5px]">Lumen</div>
          <div className="text-mute2 text-[10px] font-mono px-1.5 py-[2px] border border-line/60 rounded">v1.4</div>
        </div>
        <div className="h-5 w-px bg-line/70" />
        <button className="group h-7 px-2 -ml-0.5 rounded-md hover:bg-white/[0.04] flex items-center gap-1.5 text-ink2 hover:text-ink text-[12px] shrink-0 whitespace-nowrap">
          <I.folder size={14} />
          <span>Northfield Launch</span>
          <I.chevR size={12} className="text-mute2 mx-0.5" />
        </button>
        <div className="flex items-center min-w-0">
          {editingName ? (
            <input autoFocus value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === 'Enter' && commitName()}
              className="h-7 px-2 bg-panel2 border border-line2 rounded text-[12px] w-64 outline-none focus:border-accent/60"
            />
          ) : (
            <button className="h-7 px-2 rounded hover:bg-white/[0.04] text-ink text-[12.5px] font-medium truncate max-w-[220px]"
              onClick={() => setEditingName(true)}
              title="Rename project">
              {project.name}
            </button>
          )}
          <span className={cx(
            'ml-2 inline-flex items-center gap-1.5 text-[10.5px] whitespace-nowrap shrink-0',
            saved ? 'text-mute' : 'text-[oklch(0.82_0.13_80)]'
          )}>
            <span className={cx('h-1.5 w-1.5 rounded-full', saved ? 'bg-emerald-400/70' : 'bg-[oklch(0.82_0.13_80)]')} />
            {saved ? 'Saved' : 'Unsaved changes'}
          </span>
        </div>
      </div>

      {/* center: mode switch */}
      <div className="flex-1 flex items-center justify-center">
        <Seg
          value={mode} onChange={setMode}
          options={[
            { value: 'edit',  label: 'Edit' },
            { value: 'color', label: 'Color' },
            { value: 'audio', label: 'Audio' },
            { value: 'deliver', label: 'Deliver' },
          ]}
        />
      </div>

      {/* right cluster */}
      <div className="flex items-center gap-1">
        <Btn kind="ghost" size="icon" onClick={onUndo} disabled={!canUndo}
             className={!canUndo ? 'opacity-40' : ''} title="Undo (⌘Z)"><I.undo size={15}/></Btn>
        <Btn kind="ghost" size="icon" onClick={onRedo} disabled={!canRedo}
             className={!canRedo ? 'opacity-40' : ''} title="Redo (⌘⇧Z)"><I.redo size={15}/></Btn>
        <Btn kind="ghost" size="icon" title="History"><I.history size={15}/></Btn>
        <div className="h-5 w-px bg-line/70 mx-1" />
        <Btn kind="ghost" size="md" icon={<I.share size={14}/>}>Share</Btn>
        <Btn kind="subtle" size="md" icon={<I.save size={14}/>}>Save</Btn>
        <Btn kind="primary" size="md" onClick={onExport} icon={<I.download size={14}/>}>Export</Btn>
        <div className="h-5 w-px bg-line/70 mx-1" />
        {/* collaborators */}
        <div className="flex items-center -space-x-1.5 pr-1">
          {['K','M','J'].map((c, i) => (
            <div key={c} className="h-7 w-7 rounded-full border-2 border-panel flex items-center justify-center text-[10.5px] font-semibold"
                 style={{ background: ['oklch(0.72_0.14_45)','oklch(0.72_0.12_180)','oklch(0.72_0.12_310)'][i], color: 'oklch(0.18 0 0)' }}>
              {c}
            </div>
          ))}
        </div>
        <Btn kind="ghost" size="icon" title="Settings"><I.cog size={15}/></Btn>
      </div>
    </header>
  );
}
window.Header = Header;
