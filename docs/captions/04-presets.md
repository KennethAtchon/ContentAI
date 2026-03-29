# Preset Definitions: Caption Engine v2

10 built-in `TextPreset` objects. These are the canonical definitions — the source of truth for both frontend rendering and backend ASS export.

All color values are CSS strings. Font sizes are calibrated for a 1080p (1920×1080 or 1080×1920) canvas.

---

## 1. Hormozi (default)

Bold uppercase, yellow highlight on the active word. The viral standard.

```json
{
  "id": "hormozi",
  "name": "Hormozi",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 900,
    "fontSize": 72,
    "textTransform": "uppercase",
    "letterSpacing": 0,
    "lineHeight": 1.15,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 3,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "#FFFFFF",
      "stateColors": {
        "active": "#FACC15"
      }
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 85,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": {
    "scalePulse": {
      "from": 1.15,
      "durationMs": 120,
      "easing": { "type": "ease-out", "power": 2 }
    }
  },
  "groupingMs": 1400,
  "exportMode": "approximate"
}
```

**Visual notes:** Active word snaps to yellow with a quick scale-down pulse (1.15 → 1.0). Classic Alex Hormozi viral-caption look. Black outline ensures legibility on any background.

**Export behavior:** ASS uses `\k` karaoke tags with active color `#FACC15`. Scale pulse is not exported (ASS limitation).

---

## 2. Clean Minimal

Clean white text, thin outline, no animation. The safe default.

```json
{
  "id": "clean-minimal",
  "name": "Clean Minimal",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 700,
    "fontSize": 56,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 1.5,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "#FFFFFF"
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 85,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": null,
  "groupingMs": 1800,
  "exportMode": "full"
}
```

**Export behavior:** Full parity. ASS renders this exactly. No active-word styling means no karaoke tags needed.

---

## 3. Dark Box

White text on a dark semi-transparent pill. Clean and readable.

```json
{
  "id": "dark-box",
  "name": "Dark Box",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 700,
    "fontSize": 52,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "background",
      "color": "rgba(0,0,0,0.65)",
      "padding": 16,
      "radius": 10,
      "mode": "line"
    },
    {
      "type": "fill",
      "color": "#FFFFFF"
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 80,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": null,
  "groupingMs": 1600,
  "exportMode": "approximate"
}
```

**Export behavior:** ASS `BorderStyle: 3` with `BackColour` approximates the dark box. Rounded corners are not reproduced — the box has hard corners in the export. Preview shows rounded corners; export shows square corners.

---

## 4. Karaoke

Dim white base text. Active word pops to full white. Classic sing-along effect.

```json
{
  "id": "karaoke",
  "name": "Karaoke",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 700,
    "fontSize": 60,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 2,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "rgba(255,255,255,0.35)",
      "stateColors": {
        "active": "#FFFFFF",
        "past": "rgba(255,255,255,0.6)"
      }
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 85,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": {
    "scalePulse": {
      "from": 1.08,
      "durationMs": 80,
      "easing": { "type": "ease-out", "power": 2 }
    }
  },
  "groupingMs": 2000,
  "exportMode": "approximate"
}
```

**Visual notes:** Upcoming words are dim (35% opacity). Active word is full white. Past words are 60% — slightly brighter than upcoming, creating a "already sung" feel.

**Export behavior:** ASS `\kf` fill-wipe animation approximates the progressive reveal.

---

## 5. Bold Outline

Maximum legibility. Heavy black stroke, no distractions.

```json
{
  "id": "bold-outline",
  "name": "Bold Outline",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 900,
    "fontSize": 72,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.15,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 5,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "#FFFFFF"
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 85,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": null,
  "groupingMs": 1400,
  "exportMode": "full"
}
```

---

## 6. Pop Scale (NEW)

Words bounce in with a spring scale animation. Modern, energetic.

```json
{
  "id": "pop-scale",
  "name": "Pop Scale",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 800,
    "fontSize": 68,
    "textTransform": "uppercase",
    "letterSpacing": 0.02,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 3,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "#FFFFFF",
      "stateColors": {
        "active": "#F97316"
      }
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 80,
    "positionY": 78
  },
  "entryAnimation": [
    {
      "scope": "page",
      "property": "opacity",
      "from": 0,
      "to": 1,
      "durationMs": 150,
      "easing": { "type": "linear" }
    },
    {
      "scope": "word",
      "property": "scale",
      "from": 0.6,
      "to": 1.0,
      "durationMs": 280,
      "easing": { "type": "spring", "stiffness": 400, "damping": 0.7, "mass": 0.8 },
      "staggerMs": 60
    }
  ],
  "exitAnimation": null,
  "wordActivation": {
    "layerOverrides": [],
    "scalePulse": {
      "from": 1.2,
      "durationMs": 100,
      "easing": { "type": "ease-out", "power": 3 }
    }
  },
  "groupingMs": 1200,
  "exportMode": "approximate"
}
```

**Visual notes:** Each word springs in from 60% scale with staggered timing (60ms per word). Orange active word. The entry animation is the defining feature.

**Export behavior:** ASS approximates with standard karaoke tags. The spring scale entry is not exported. UI note: "Entry animation simplified in export."

---

## 7. Slide Up (NEW)

Caption group fades and slides up on entry. Smooth and professional.

```json
{
  "id": "slide-up",
  "name": "Slide Up",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 700,
    "fontSize": 56,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "shadow",
      "color": "rgba(0,0,0,0.6)",
      "offsetX": 0,
      "offsetY": 3,
      "blur": 8
    },
    {
      "type": "fill",
      "color": "#FFFFFF"
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 80,
    "positionY": 80
  },
  "entryAnimation": [
    {
      "scope": "page",
      "property": "opacity",
      "from": 0,
      "to": 1,
      "durationMs": 250,
      "easing": { "type": "ease-out", "power": 2 }
    },
    {
      "scope": "page",
      "property": "translateY",
      "from": 24,
      "to": 0,
      "durationMs": 300,
      "easing": { "type": "cubic-bezier", "x1": 0.2, "y1": 0.0, "x2": 0.2, "y2": 1.0 }
    }
  ],
  "exitAnimation": [
    {
      "scope": "page",
      "property": "opacity",
      "from": 1,
      "to": 0,
      "durationMs": 150,
      "easing": { "type": "ease-in", "power": 2 }
    }
  ],
  "wordActivation": null,
  "groupingMs": 1800,
  "exportMode": "static"
}
```

**Visual notes:** The whole page fades + slides up 24px on entry. Soft drop shadow for depth. No word-level animation — clean and editorial.

**Export behavior:** ASS static export (no animation). UI note: "Entry animation not available in export."

---

## 8. Fade Scale (NEW)

Words fade in with a subtle scale from 0.85. Elegant, not showy.

```json
{
  "id": "fade-scale",
  "name": "Fade Scale",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 600,
    "fontSize": 54,
    "textTransform": "none",
    "letterSpacing": 0.01,
    "lineHeight": 1.25,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "shadow",
      "color": "rgba(0,0,0,0.5)",
      "offsetX": 0,
      "offsetY": 2,
      "blur": 6
    },
    {
      "type": "fill",
      "color": "#FFFFFF"
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 80,
    "positionY": 80
  },
  "entryAnimation": [
    {
      "scope": "page",
      "property": "opacity",
      "from": 0,
      "to": 1,
      "durationMs": 300,
      "easing": { "type": "ease-out", "power": 2 }
    },
    {
      "scope": "page",
      "property": "scale",
      "from": 0.88,
      "to": 1.0,
      "durationMs": 350,
      "easing": { "type": "cubic-bezier", "x1": 0.0, "y1": 0.0, "x2": 0.2, "y2": 1.0 }
    }
  ],
  "exitAnimation": [
    {
      "scope": "page",
      "property": "opacity",
      "from": 1,
      "to": 0,
      "durationMs": 200,
      "easing": { "type": "ease-in", "power": 2 }
    }
  ],
  "wordActivation": null,
  "groupingMs": 2000,
  "exportMode": "static"
}
```

---

## 9. Glitch (NEW)

Active word shakes with a micro glitch. Bold, high-energy.

```json
{
  "id": "glitch",
  "name": "Glitch",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 900,
    "fontSize": 70,
    "textTransform": "uppercase",
    "letterSpacing": 0.03,
    "lineHeight": 1.1,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "stroke",
      "color": "#000000",
      "width": 4,
      "join": "round"
    },
    {
      "type": "fill",
      "color": "#FFFFFF",
      "stateColors": {
        "active": "#00FF99"
      }
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 85,
    "positionY": 78
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": {
    "scalePulse": {
      "from": 1.12,
      "durationMs": 60,
      "easing": { "type": "ease-out", "power": 4 }
    }
  },
  "groupingMs": 1200,
  "exportMode": "approximate"
}
```

**Visual notes:** Active word snaps to bright green (#00FF99) with a hard-fast scale pulse (60ms, power-4 ease). The snap is intentionally abrupt — that's the glitch effect. Heavy uppercase, tight tracking.

**Implementation note:** The "glitch" visual (chromatic aberration, pixel offset) is a v3 feature. v2 delivers the color snap + fast pulse, which produces the feel at a fraction of the complexity.

---

## 10. Word Highlight Box (NEW)

A colored box highlights behind the active word. The box moves word-to-word.

```json
{
  "id": "word-highlight-box",
  "name": "Word Box",
  "typography": {
    "fontFamily": "Inter",
    "fontWeight": 800,
    "fontSize": 64,
    "textTransform": "none",
    "letterSpacing": 0,
    "lineHeight": 1.2,
    "fontUrl": "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
  },
  "layers": [
    {
      "type": "background",
      "color": "transparent",
      "padding": 8,
      "radius": 6,
      "mode": "word",
      "stateColors": {
        "active": "#FACC15"
      }
    },
    {
      "type": "fill",
      "color": "#FFFFFF",
      "stateColors": {
        "active": "#000000"
      }
    }
  ],
  "layout": {
    "alignment": "center",
    "maxWidthPercent": 82,
    "positionY": 80
  },
  "entryAnimation": null,
  "exitAnimation": null,
  "wordActivation": null,
  "groupingMs": 1600,
  "exportMode": "approximate"
}
```

**Visual notes:** The yellow box background appears behind the active word. When the word is active, its text color inverts to black (for contrast against yellow). Non-active words are white text, no background. The box is per-word (`mode: "word"`), so it appears and disappears per word — not a continuous sliding box.

**Export behavior:** ASS approximates with `\k` karaoke color change. The per-word box is not reproduced. Active word color change (black text) exports as bright yellow primary color instead.

---

## Legacy ID Map

For backward compatibility with clips saved before v2:

```typescript
export const LEGACY_ID_MAP: Record<string, string> = {
  // Pre-2026-03 IDs
  "clean-white": "clean-minimal",
  "box-dark": "dark-box",
  "box-accent": "dark-box",
  "highlight": "hormozi",
  // Pre-v2 IDs (flat to new IDs — same meaning, same render)
  // (none needed — v1 IDs map to v2 IDs of the same name)
};
```

---

## Default Preset

`"hormozi"` is the default. It is `BUILTIN_PRESETS[0]`. When a `stylePresetId` is missing or unresolvable, `getPreset()` returns `BUILTIN_PRESETS[0]`.
