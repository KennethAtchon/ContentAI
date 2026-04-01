ALTER TABLE "caption" RENAME TO "caption_doc";

ALTER TABLE "caption_doc" RENAME COLUMN "words" TO "tokens";

ALTER TABLE "caption_doc"
  ALTER COLUMN "asset_id" DROP NOT NULL;

ALTER TABLE "caption_doc"
  ADD COLUMN "source" text NOT NULL DEFAULT 'whisper';

ALTER TABLE "caption_doc"
  ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();

ALTER TABLE "caption_doc"
  ADD CONSTRAINT "caption_doc_source_check"
  CHECK ("source" IN ('whisper', 'manual', 'import'));

ALTER INDEX "captions_asset_idx" RENAME TO "caption_doc_asset_idx";
ALTER INDEX "captions_user_idx" RENAME TO "caption_doc_user_idx";
DROP INDEX IF EXISTS "captions_user_asset_unique";
CREATE UNIQUE INDEX "caption_doc_user_asset_unique"
  ON "caption_doc" USING btree ("user_id", "asset_id")
  WHERE "asset_id" IS NOT NULL;

CREATE TABLE "caption_preset" (
  "id" text PRIMARY KEY,
  "definition" jsonb NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "caption_preset" ("id", "definition")
VALUES
  (
    'hormozi',
    $${
      "id":"hormozi",
      "name":"Hormozi",
      "typography":{"fontFamily":"Inter","fontWeight":900,"fontSize":72,"textTransform":"uppercase","letterSpacing":0,"lineHeight":1.15,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":3,"join":"round"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF","stateColors":{"active":"#FACC15"}}
      ],
      "layout":{"alignment":"center","maxWidthPercent":85,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":{"scalePulse":{"from":1.15,"durationMs":120,"easing":{"type":"ease-out","power":2}}},
      "groupingMs":1400,
      "exportMode":"approximate"
    }$$::jsonb
  ),
  (
    'clean-minimal',
    $${
      "id":"clean-minimal",
      "name":"Clean Minimal",
      "typography":{"fontFamily":"Inter","fontWeight":700,"fontSize":56,"textTransform":"none","letterSpacing":0,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":1.5,"join":"round"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF"}
      ],
      "layout":{"alignment":"center","maxWidthPercent":85,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":null,
      "groupingMs":1800,
      "exportMode":"full"
    }$$::jsonb
  ),
  (
    'dark-box',
    $${
      "id":"dark-box",
      "name":"Dark Box",
      "typography":{"fontFamily":"Inter","fontWeight":700,"fontSize":52,"textTransform":"none","letterSpacing":0,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"bg-line","type":"background","color":"rgba(0,0,0,0.65)","padding":16,"radius":10,"mode":"line"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF"}
      ],
      "layout":{"alignment":"center","maxWidthPercent":80,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":null,
      "groupingMs":1600,
      "exportMode":"approximate"
    }$$::jsonb
  ),
  (
    'karaoke',
    $${
      "id":"karaoke",
      "name":"Karaoke",
      "typography":{"fontFamily":"Inter","fontWeight":700,"fontSize":60,"textTransform":"none","letterSpacing":0,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":2,"join":"round"},
        {"id":"fill-base","type":"fill","color":"rgba(255,255,255,0.35)","stateColors":{"active":"#FFFFFF","past":"rgba(255,255,255,0.6)"}}
      ],
      "layout":{"alignment":"center","maxWidthPercent":85,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":{"scalePulse":{"from":1.08,"durationMs":80,"easing":{"type":"ease-out","power":2}}},
      "groupingMs":2000,
      "exportMode":"approximate"
    }$$::jsonb
  ),
  (
    'bold-outline',
    $${
      "id":"bold-outline",
      "name":"Bold Outline",
      "typography":{"fontFamily":"Inter","fontWeight":900,"fontSize":72,"textTransform":"none","letterSpacing":0,"lineHeight":1.15,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":5,"join":"round"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF"}
      ],
      "layout":{"alignment":"center","maxWidthPercent":85,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":null,
      "groupingMs":1400,
      "exportMode":"full"
    }$$::jsonb
  ),
  (
    'pop-scale',
    $${
      "id":"pop-scale",
      "name":"Pop Scale",
      "typography":{"fontFamily":"Inter","fontWeight":800,"fontSize":68,"textTransform":"uppercase","letterSpacing":0.02,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":3,"join":"round"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF","stateColors":{"active":"#F97316"}}
      ],
      "layout":{"alignment":"center","maxWidthPercent":80,"positionY":78},
      "entryAnimation":[
        {"scope":"page","property":"opacity","from":0,"to":1,"durationMs":150,"easing":{"type":"linear"}},
        {"scope":"word","property":"scale","from":0.6,"to":1,"durationMs":280,"easing":{"type":"spring","stiffness":400,"damping":0.7,"mass":0.8},"staggerMs":60}
      ],
      "exitAnimation":null,
      "wordActivation":{"layerOverrides":[],"scalePulse":{"from":1.2,"durationMs":100,"easing":{"type":"ease-out","power":3}}},
      "groupingMs":1200,
      "exportMode":"approximate"
    }$$::jsonb
  ),
  (
    'slide-up',
    $${
      "id":"slide-up",
      "name":"Slide Up",
      "typography":{"fontFamily":"Inter","fontWeight":700,"fontSize":56,"textTransform":"none","letterSpacing":0,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"shadow-base","type":"shadow","color":"rgba(0,0,0,0.6)","offsetX":0,"offsetY":3,"blur":8},
        {"id":"fill-base","type":"fill","color":"#FFFFFF"}
      ],
      "layout":{"alignment":"center","maxWidthPercent":80,"positionY":80},
      "entryAnimation":[
        {"scope":"page","property":"opacity","from":0,"to":1,"durationMs":250,"easing":{"type":"ease-out","power":2}},
        {"scope":"page","property":"translateY","from":24,"to":0,"durationMs":300,"easing":{"type":"cubic-bezier","x1":0.2,"y1":0,"x2":0.2,"y2":1}}
      ],
      "exitAnimation":[
        {"scope":"page","property":"opacity","from":1,"to":0,"durationMs":150,"easing":{"type":"ease-in","power":2}}
      ],
      "wordActivation":null,
      "groupingMs":1800,
      "exportMode":"static"
    }$$::jsonb
  ),
  (
    'fade-scale',
    $${
      "id":"fade-scale",
      "name":"Fade Scale",
      "typography":{"fontFamily":"Inter","fontWeight":600,"fontSize":54,"textTransform":"none","letterSpacing":0.01,"lineHeight":1.25,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"shadow-base","type":"shadow","color":"rgba(0,0,0,0.5)","offsetX":0,"offsetY":2,"blur":6},
        {"id":"fill-base","type":"fill","color":"#FFFFFF"}
      ],
      "layout":{"alignment":"center","maxWidthPercent":80,"positionY":80},
      "entryAnimation":[
        {"scope":"page","property":"opacity","from":0,"to":1,"durationMs":300,"easing":{"type":"ease-out","power":2}},
        {"scope":"page","property":"scale","from":0.88,"to":1,"durationMs":350,"easing":{"type":"cubic-bezier","x1":0,"y1":0,"x2":0.2,"y2":1}}
      ],
      "exitAnimation":[
        {"scope":"page","property":"opacity","from":1,"to":0,"durationMs":200,"easing":{"type":"ease-in","power":2}}
      ],
      "wordActivation":null,
      "groupingMs":2000,
      "exportMode":"static"
    }$$::jsonb
  ),
  (
    'glitch',
    $${
      "id":"glitch",
      "name":"Glitch",
      "typography":{"fontFamily":"Inter","fontWeight":900,"fontSize":70,"textTransform":"uppercase","letterSpacing":0.03,"lineHeight":1.1,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"stroke-base","type":"stroke","color":"#000000","width":4,"join":"round"},
        {"id":"fill-base","type":"fill","color":"#FFFFFF","stateColors":{"active":"#00FF99"}}
      ],
      "layout":{"alignment":"center","maxWidthPercent":85,"positionY":78},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":{"scalePulse":{"from":1.12,"durationMs":60,"easing":{"type":"ease-out","power":4}}},
      "groupingMs":1200,
      "exportMode":"approximate"
    }$$::jsonb
  ),
  (
    'word-highlight-box',
    $${
      "id":"word-highlight-box",
      "name":"Word Box",
      "typography":{"fontFamily":"Inter","fontWeight":800,"fontSize":64,"textTransform":"none","letterSpacing":0,"lineHeight":1.2,"fontUrl":"https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"},
      "layers":[
        {"id":"bg-word","type":"background","color":"transparent","padding":8,"radius":6,"mode":"word","stateColors":{"active":"#FACC15"}},
        {"id":"fill-base","type":"fill","color":"#FFFFFF","stateColors":{"active":"#000000"}}
      ],
      "layout":{"alignment":"center","maxWidthPercent":82,"positionY":80},
      "entryAnimation":null,
      "exitAnimation":null,
      "wordActivation":null,
      "groupingMs":1600,
      "exportMode":"approximate"
    }$$::jsonb
  )
ON CONFLICT ("id") DO UPDATE
SET
  "definition" = EXCLUDED."definition",
  "updated_at" = now();
