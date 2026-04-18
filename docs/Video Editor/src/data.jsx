// ---------- Mock data model ----------
//
// project: { name, fps, resolution, duration, tracks[], layers[] }
// track:   { id, kind: 'video'|'audio'|'text'|'overlay', name, muted, locked, hidden, height }
// clip:    { id, trackId, start, length, name, assetId?, kind, color, waveformSeed? }
// asset:   { id, kind, name, duration?, thumb: 'stripes-a'|... , meta }
// layer:   (preview) { id, kind, x, y, w, h, rotation, opacity, ...typeSpecific }

const PROJECT_NAME_DEFAULT = "Northfield Product Launch — v7";

const ASSETS = [
  { id: 'a1', kind: 'video', name: 'Aurora_Opening.mp4',   duration: 14.2, thumb: 'stripes-a', meta: '1920×1080 · 24 fps' },
  { id: 'a2', kind: 'video', name: 'Interview_MK_01.mp4',  duration: 32.8, thumb: 'stripes-a', meta: '3840×2160 · 29.97 fps' },
  { id: 'a3', kind: 'video', name: 'Drone_Coastline.mov',  duration: 48.0, thumb: 'stripes-a', meta: '3840×2160 · 60 fps' },
  { id: 'a4', kind: 'image', name: 'Logomark_white.png',   thumb: 'stripes-b', meta: 'PNG · 2048×2048' },
  { id: 'a5', kind: 'image', name: 'Poster_backplate.jpg', thumb: 'stripes-b', meta: 'JPG · 5000×3200' },
  { id: 'a6', kind: 'video', name: 'B_Roll_Workshop.mp4',  duration: 18.5, thumb: 'stripes-a', meta: '1920×1080 · 24 fps' },
  { id: 'a7', kind: 'audio', name: 'Score_Northern.wav',   duration: 124.6,thumb: 'stripes-d', meta: 'Stereo · 48 kHz' },
  { id: 'a8', kind: 'audio', name: 'VO_Narration_take3.wav',duration:42.1, thumb: 'stripes-d', meta: 'Mono · 48 kHz' },
  { id: 'a9', kind: 'audio', name: 'SFX_whoosh_01.wav',    duration: 1.4, thumb: 'stripes-d', meta: 'Stereo · 48 kHz' },
  { id: 'a10',kind: 'image', name: 'Texture_grain_04.png', thumb: 'stripes-b', meta: 'PNG · 4096×4096' },
  { id: 'a11',kind: 'video', name: 'Insert_Closeups.mp4',  duration: 22.0, thumb: 'stripes-a', meta: '1920×1080 · 30 fps' },
  { id: 'a12',kind: 'image', name: 'Still_Field.jpg',      thumb: 'stripes-b', meta: 'JPG · 6000×4000' },
];

const TRACKS = [
  { id: 't1', kind: 'text',    name: 'Titles',    muted: false, locked: false, hidden: false, height: 40 },
  { id: 't2', kind: 'overlay', name: 'Overlays',  muted: false, locked: false, hidden: false, height: 40 },
  { id: 't3', kind: 'video',   name: 'V2 · B-Roll', muted: false, locked: false, hidden: false, height: 56 },
  { id: 't4', kind: 'video',   name: 'V1 · Main',   muted: false, locked: false, hidden: false, height: 56 },
  { id: 't5', kind: 'audio',   name: 'A1 · Voice',   muted: false, locked: false, hidden: false, height: 48 },
  { id: 't6', kind: 'audio',   name: 'A2 · Score',   muted: false, locked: true,  hidden: false, height: 48 },
];

// seconds-based placements. Total timeline ~60s.
const CLIPS = [
  // titles
  { id: 'c1',  trackId: 't1', start: 1.0,  length: 3.2, name: 'NORTHFIELD',        kind: 'text' },
  { id: 'c2',  trackId: 't1', start: 18.5, length: 2.6, name: 'Built by hand',     kind: 'text' },
  { id: 'c3',  trackId: 't1', start: 42.0, length: 3.5, name: 'Available Apr 22',  kind: 'text' },
  // overlays
  { id: 'c4',  trackId: 't2', start: 4.0,  length: 4.0, name: 'Lower third',       kind: 'overlay' },
  { id: 'c5',  trackId: 't2', start: 24.0, length: 6.5, name: 'Callout card',      kind: 'overlay' },
  { id: 'c6',  trackId: 't2', start: 39.0, length: 2.0, name: 'Whoosh flash',      kind: 'overlay' },
  // V2 broll
  { id: 'c7',  trackId: 't3', start: 6.0,  length: 8.0,  name: 'B_Roll_Workshop',  kind: 'video', assetId: 'a6' },
  { id: 'c8',  trackId: 't3', start: 20.5, length: 10.5, name: 'Insert_Closeups',  kind: 'video', assetId: 'a11' },
  { id: 'c9',  trackId: 't3', start: 34.5, length: 7.5, name: 'Drone_Coastline',   kind: 'video', assetId: 'a3' },
  // V1 main
  { id: 'c10', trackId: 't4', start: 0,    length: 14.0, name: 'Aurora_Opening',   kind: 'video', assetId: 'a1' },
  { id: 'c11', trackId: 't4', start: 14.0, length: 18.0, name: 'Interview_MK_01',  kind: 'video', assetId: 'a2' },
  { id: 'c12', trackId: 't4', start: 32.0, length: 12.0, name: 'Drone_Coastline',  kind: 'video', assetId: 'a3' },
  { id: 'c13', trackId: 't4', start: 44.0, length: 10.0, name: 'Aurora_Outro',     kind: 'video', assetId: 'a1' },
  // A1 voice
  { id: 'c14', trackId: 't5', start: 2.0,  length: 12.0, name: 'VO_take_03',       kind: 'audio', assetId: 'a8', waveformSeed: 9 },
  { id: 'c15', trackId: 't5', start: 16.0, length: 14.0, name: 'VO_take_04',       kind: 'audio', assetId: 'a8', waveformSeed: 13 },
  { id: 'c16', trackId: 't5', start: 34.0, length: 10.0, name: 'VO_take_05',       kind: 'audio', assetId: 'a8', waveformSeed: 3 },
  // A2 score
  { id: 'c17', trackId: 't6', start: 0,    length: 54.0, name: 'Score_Northern',   kind: 'audio', assetId: 'a7', waveformSeed: 21 },
];

// preview layers = what is visible at the current scrubber time.
// For realism at t≈8s (default), show a background video layer, a lower-third, and a title.
const LAYERS_AT_T = [
  {
    id: 'L-bg',
    kind: 'video',
    name: 'Aurora_Opening',
    x: 0, y: 0, w: 1920, h: 1080,
    rotation: 0, opacity: 1,
    fill: 'stripes-a', label: 'VIDEO · Aurora_Opening',
  },
  {
    id: 'L-broll',
    kind: 'video',
    name: 'B_Roll_Workshop (picture-in-picture)',
    x: 1200, y: 120, w: 560, h: 340,
    rotation: -2, opacity: 0.96, radius: 18,
    fill: 'stripes-a', label: 'VIDEO · Workshop',
  },
  {
    id: 'L-lt',
    kind: 'overlay',
    name: 'Lower third',
    x: 120, y: 820, w: 720, h: 160,
    rotation: 0, opacity: 0.92, radius: 10,
    fill: 'stripes-b', label: 'OVERLAY · Lower third',
  },
  {
    id: 'L-title',
    kind: 'text',
    name: 'NORTHFIELD',
    x: 120, y: 720, w: 900, h: 88,
    rotation: 0, opacity: 1,
    text: 'NORTHFIELD',
    font: 'Inter', weight: 700, size: 84, letter: -2, color: '#F6F7F3',
    align: 'left', stroke: 0, strokeColor: '#000000',
    shadow: 12, shadowColor: '#000000',
  },
];

window.MOCK = { PROJECT_NAME_DEFAULT, ASSETS, TRACKS, CLIPS, LAYERS_AT_T };
