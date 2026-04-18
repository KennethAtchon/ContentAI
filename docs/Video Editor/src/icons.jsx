// Hand-tuned line icons. 1.5px stroke, 16-px grid, rounded joins.
const Icon = ({ d, size = 16, stroke = 1.6, className = "", children, viewBox = "0 0 24 24" }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none"
       stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
       className={className}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  logo: (p) => (
    <svg width={p.size||20} height={p.size||20} viewBox="0 0 24 24" fill="none" className={p.className}>
      <path d="M4 6 L12 2 L20 6 L20 18 L12 22 L4 18 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 9 L16 12 L10 15 Z" fill="currentColor"/>
    </svg>
  ),
  undo:    (p) => <Icon {...p} d="M9 14 L4 9 L9 4 M4 9 H14 a6 6 0 0 1 0 12 H10"/>,
  redo:    (p) => <Icon {...p} d="M15 14 L20 9 L15 4 M20 9 H10 a6 6 0 0 0 0 12 H14"/>,
  save:    (p) => <Icon {...p} d="M5 3 H16 L21 8 V21 H5 Z M8 3 V8 H15 V3 M8 14 H16 V21 H8 Z"/>,
  play:    (p) => <Icon {...p} d="M6 4 L20 12 L6 20 Z"/>,
  pause:   (p) => <Icon {...p} d="M7 4 V20 M17 4 V20" />,
  skipBack:(p) => <Icon {...p} d="M5 4 V20 M21 4 L8 12 L21 20 Z"/>,
  skipFwd: (p) => <Icon {...p} d="M19 4 V20 M3 4 L16 12 L3 20 Z"/>,
  stepBack:(p) => <Icon {...p} d="M8 4 L8 20 M20 4 L11 12 L20 20 Z"/>,
  stepFwd: (p) => <Icon {...p} d="M16 4 L16 20 M4 4 L13 12 L4 20 Z"/>,
  full:    (p) => <Icon {...p} d="M4 10 V4 H10 M20 10 V4 H14 M4 14 V20 H10 M20 14 V20 H14"/>,
  search:  (p) => <Icon {...p} d="M11 4 a7 7 0 1 1 0 14 a7 7 0 0 1 0 -14 M16 16 L21 21"/>,
  plus:    (p) => <Icon {...p} d="M12 5 V19 M5 12 H19"/>,
  upload:  (p) => <Icon {...p} d="M12 16 V4 M6 10 L12 4 L18 10 M4 20 H20"/>,
  download:(p) => <Icon {...p} d="M12 4 V16 M6 10 L12 16 L18 10 M4 20 H20"/>,
  film:    (p) => <Icon {...p} d="M4 4 H20 V20 H4 Z M4 8 H8 M4 12 H8 M4 16 H8 M16 8 H20 M16 12 H20 M16 16 H20"/>,
  type:    (p) => <Icon {...p} d="M4 6 V4 H20 V6 M12 4 V20 M8 20 H16"/>,
  shapes:  (p) => <Icon {...p} d="M4 4 H12 V12 H4 Z M17 9 a4 4 0 1 1 0 8 a4 4 0 0 1 0 -8 Z"/>,
  transition: (p)=> <Icon {...p} d="M4 8 H10 V4 L14 8 L10 12 V8 M20 16 H14 V20 L10 16 L14 12 V16"/>,
  audio:   (p) => <Icon {...p} d="M3 12 H5 L9 6 V18 L5 12 M12 9 a4 4 0 0 1 0 6 M15 6 a8 8 0 0 1 0 12"/>,
  folder:  (p) => <Icon {...p} d="M3 7 a2 2 0 0 1 2 -2 H9 L11 7 H19 a2 2 0 0 1 2 2 V17 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 Z"/>,
  magic:   (p) => <Icon {...p} d="M4 20 L14 10 L18 14 L8 24 Z M16 4 L17 7 L20 8 L17 9 L16 12 L15 9 L12 8 L15 7 Z" viewBox="0 0 24 24"/>,
  crop:    (p) => <Icon {...p} d="M6 2 V18 H22 M2 6 H18 V22"/>,
  copy:    (p) => <Icon {...p} d="M8 8 H20 V20 H8 Z M4 4 H16 V8 M4 4 V16 H8"/>,
  trash:   (p) => <Icon {...p} d="M4 7 H20 M10 11 V17 M14 11 V17 M6 7 V20 a1 1 0 0 0 1 1 H17 a1 1 0 0 0 1 -1 V7 M9 7 V4 H15 V7"/>,
  front:   (p) => <Icon {...p} d="M4 4 H14 V14 H4 Z M10 10 H20 V20 H10 Z" />,
  back:    (p) => <Icon {...p} d="M10 10 H20 V20 H10 Z M4 4 H14 V14 H4 Z" />,
  fit:     (p) => <Icon {...p} d="M4 9 V4 H9 M15 4 H20 V9 M4 15 V20 H9 M15 20 H20 V15"/>,
  fill:    (p) => <Icon {...p} d="M4 4 H20 V20 H4 Z M9 9 H15 V15 H9 Z"/>,
  replace: (p) => <Icon {...p} d="M4 8 H16 L13 5 M20 16 H8 L11 19"/>,
  split:   (p) => <Icon {...p} d="M12 3 V21 M4 8 L8 12 L4 16 M20 8 L16 12 L20 16"/>,
  lock:    (p) => <Icon {...p} d="M6 11 H18 V20 H6 Z M9 11 V8 a3 3 0 0 1 6 0 V11"/>,
  unlock:  (p) => <Icon {...p} d="M6 11 H18 V20 H6 Z M9 11 V8 a3 3 0 0 1 6 0"/>,
  eye:     (p) => <Icon {...p} d="M2 12 S6 5 12 5 S22 12 22 12 S18 19 12 19 S2 12 2 12 M12 9 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6"/>,
  eyeOff:  (p) => <Icon {...p} d="M4 4 L20 20 M2 12 S6 5 12 5 c2 0 4 .6 5.5 1.6 M22 12 S18 19 12 19 c-2 0-4-.6-5.5-1.6"/>,
  mute:    (p) => <Icon {...p} d="M3 10 H6 L10 5 V19 L6 14 M15 9 L21 15 M21 9 L15 15"/>,
  volume:  (p) => <Icon {...p} d="M3 10 H6 L10 5 V19 L6 14 M14 9 a4 4 0 0 1 0 6"/>,
  dots:    (p) => <Icon {...p} d="M5 12 h.01 M12 12 h.01 M19 12 h.01" stroke={3}/>,
  chevR:   (p) => <Icon {...p} d="M9 5 L16 12 L9 19"/>,
  chevD:   (p) => <Icon {...p} d="M5 9 L12 16 L19 9"/>,
  chevL:   (p) => <Icon {...p} d="M15 5 L8 12 L15 19"/>,
  close:   (p) => <Icon {...p} d="M6 6 L18 18 M6 18 L18 6"/>,
  cog:     (p) => <Icon {...p} d="M12 9 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M19 12 L21 12 M3 12 L5 12 M12 3 V5 M12 19 V21 M17 7 L18.5 5.5 M5.5 18.5 L7 17 M17 17 L18.5 18.5 M5.5 5.5 L7 7"/>,
  link:    (p) => <Icon {...p} d="M10 14 a4 4 0 0 0 6 0 L20 10 a4 4 0 0 0 -6 -6 L13 5 M14 10 a4 4 0 0 0 -6 0 L4 14 a4 4 0 0 0 6 6 L11 19"/>,
  bold:    (p) => <Icon {...p} d="M6 4 H13 a4 4 0 0 1 0 8 H6 Z M6 12 H14 a4 4 0 0 1 0 8 H6 Z"/>,
  italic:  (p) => <Icon {...p} d="M10 4 H18 M6 20 H14 M14 4 L10 20"/>,
  underline:(p)=> <Icon {...p} d="M7 4 V12 a5 5 0 0 0 10 0 V4 M5 20 H19"/>,
  alignL:  (p) => <Icon {...p} d="M4 6 H20 M4 10 H14 M4 14 H18 M4 18 H12"/>,
  alignC:  (p) => <Icon {...p} d="M4 6 H20 M7 10 H17 M5 14 H19 M8 18 H16"/>,
  alignR:  (p) => <Icon {...p} d="M4 6 H20 M10 10 H20 M6 14 H20 M12 18 H20"/>,
  rotate:  (p) => <Icon {...p} d="M4 12 a8 8 0 1 1 2.3 5.7 L4 20 V14 H10"/>,
  sparkle: (p) => <Icon {...p} d="M12 3 L13.5 9.5 L20 11 L13.5 12.5 L12 19 L10.5 12.5 L4 11 L10.5 9.5 Z M19 4 L19.7 5.8 L21.5 6.5 L19.7 7.2 L19 9 L18.3 7.2 L16.5 6.5 L18.3 5.8 Z"/>,
  wave:    (p) => <Icon {...p} d="M3 12 H5 V8 H7 V16 H9 V6 H11 V18 H13 V9 H15 V15 H17 V11 H19 V13 H21"/>,
  check:   (p) => <Icon {...p} d="M5 12 L10 17 L20 6"/>,
  scissor: (p) => <Icon {...p} d="M6 6 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M6 12 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M9 9 L20 19 M9 15 L20 5"/>,
  clock:   (p) => <Icon {...p} d="M12 4 a8 8 0 1 1 0 16 a8 8 0 0 1 0 -16 M12 8 V12 L15 14"/>,
  zoomIn:  (p) => <Icon {...p} d="M11 4 a7 7 0 1 1 0 14 a7 7 0 0 1 0 -14 M16 16 L21 21 M8 11 H14 M11 8 V14"/>,
  zoomOut: (p) => <Icon {...p} d="M11 4 a7 7 0 1 1 0 14 a7 7 0 0 1 0 -14 M16 16 L21 21 M8 11 H14"/>,
  history: (p) => <Icon {...p} d="M4 12 a8 8 0 1 0 2 -5.3 L4 8 M4 4 V8 H8 M12 8 V12 L15 14"/>,
  share:   (p) => <Icon {...p} d="M18 4 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M18 14 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M6 9 a3 3 0 1 1 0 6 a3 3 0 0 1 0 -6 M8.5 10.5 L15.5 6.5 M8.5 13.5 L15.5 17.5"/>,
  grid:    (p) => <Icon {...p} d="M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z"/>,
  list:    (p) => <Icon {...p} d="M4 6 H6 M10 6 H20 M4 12 H6 M10 12 H20 M4 18 H6 M10 18 H20"/>,
  star:    (p) => <Icon {...p} d="M12 3 L14.6 9.2 L21 9.8 L16 14 L17.7 20.3 L12 16.8 L6.3 20.3 L8 14 L3 9.8 L9.4 9.2 Z"/>,
};
window.I = I;
