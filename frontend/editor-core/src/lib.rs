use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EffectPreviewPatch {
    clip_id: String,
    patch: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Track {
    #[serde(rename = "type")]
    track_type: String,
    clips: Vec<Clip>,
    #[serde(default)]
    transitions: Vec<Transition>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Clip {
    id: String,
    #[serde(rename = "type")]
    clip_type: String,
    start_ms: f64,
    duration_ms: f64,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    speed: Option<f64>,
    #[serde(default)]
    opacity: Option<f64>,
    #[serde(default)]
    warmth: Option<f64>,
    #[serde(default)]
    contrast: Option<f64>,
    #[serde(default)]
    position_x: Option<f64>,
    #[serde(default)]
    position_y: Option<f64>,
    #[serde(default)]
    scale: Option<f64>,
    #[serde(default)]
    rotation: Option<f64>,
    #[serde(default)]
    trim_start_ms: Option<f64>,
    #[serde(default)]
    trim_end_ms: Option<f64>,
    #[serde(default)]
    source_max_duration_ms: Option<f64>,
    #[serde(default)]
    asset_id: Option<Value>,
    #[serde(default)]
    is_placeholder: Option<bool>,
    #[serde(flatten)]
    extra: Map<String, Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Transition {
    #[serde(rename = "type")]
    transition_type: String,
    duration_ms: f64,
    clip_a_id: String,
    clip_b_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct FrameRequest {
    clip_id: String,
    asset_id: Option<Value>,
    source_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ExportFrameRequest {
    frame_index: u32,
    timeline_ms: f64,
    requests: Vec<FrameRequest>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct CompositorClipEffects {
    contrast: f64,
    warmth: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct CompositorClipTransform {
    scale: f64,
    translate_x: f64,
    translate_y: f64,
    translate_x_percent: f64,
    translate_y_percent: f64,
    rotation_deg: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
struct CompositorInsetClipPath {
    #[serde(rename = "type")]
    clip_path_type: &'static str,
    top: f64,
    right: f64,
    bottom: f64,
    left: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct CompositorClipDescriptor {
    clip_id: String,
    z_index: usize,
    source_time_us: f64,
    opacity: f64,
    clip_path: Option<CompositorInsetClipPath>,
    effects: CompositorClipEffects,
    transform: CompositorClipTransform,
    enabled: bool,
}

#[wasm_bindgen]
pub fn compute_duration(tracks: JsValue) -> Result<f64, JsValue> {
    let tracks: Vec<Track> = serde_wasm_bindgen::from_value(tracks)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(compute_duration_core(&tracks))
}

#[wasm_bindgen]
pub fn resolve_frame(tracks: JsValue, playhead_ms: f64) -> Result<JsValue, JsValue> {
    let tracks: Vec<Track> = serde_wasm_bindgen::from_value(tracks)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_wasm_bindgen::to_value(&resolve_frame_core(&tracks, playhead_ms))
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn build_compositor_descriptors(
    tracks: JsValue,
    playhead_ms: f64,
    effect_preview: JsValue,
) -> Result<JsValue, JsValue> {
    let tracks: Vec<Track> = serde_wasm_bindgen::from_value(tracks)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let effect_preview = if effect_preview.is_null() || effect_preview.is_undefined() {
        None
    } else {
        Some(
            serde_wasm_bindgen::from_value(effect_preview)
                .map_err(|error| JsValue::from_str(&error.to_string()))?,
        )
    };
    build_compositor_descriptors_core(&tracks, playhead_ms, effect_preview.as_ref())
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn sanitize_no_overlap(tracks: JsValue) -> Result<JsValue, JsValue> {
    let value: Value = serde_wasm_bindgen::from_value(tracks)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let tracks = sanitize_no_overlap_value(value);
    serde_wasm_bindgen::to_value(&tracks).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn build_export_frame_requests(
    tracks: JsValue,
    duration_ms: f64,
    fps: f64,
) -> Result<JsValue, JsValue> {
    let tracks: Vec<Track> = serde_wasm_bindgen::from_value(tracks)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_wasm_bindgen::to_value(&build_export_frame_requests_core(&tracks, duration_ms, fps))
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

fn compute_duration_core(tracks: &[Track]) -> f64 {
    tracks
        .iter()
        .flat_map(|track| track.clips.iter())
        .map(|clip| clip.start_ms + clip.duration_ms)
        .fold(0.0, f64::max)
}

fn resolve_frame_core(tracks: &[Track], playhead_ms: f64) -> Option<FrameRequest> {
    let video_tracks: Vec<&Track> = tracks
        .iter()
        .filter(|track| track.track_type == "video")
        .collect();

    for track in video_tracks.iter().rev() {
        for clip in &track.clips {
            if clip.clip_type != "video" || clip.enabled == Some(false) {
                continue;
            }
            if playhead_ms >= clip.start_ms && playhead_ms < clip.start_ms + clip.duration_ms {
                return Some(FrameRequest {
                    clip_id: clip.id.clone(),
                    asset_id: clip.asset_id.clone(),
                    source_time_ms: clip_source_time_ms(clip, playhead_ms),
                });
            }
        }
    }
    None
}

fn build_export_frame_requests_core(
    tracks: &[Track],
    duration_ms: f64,
    fps: f64,
) -> Vec<ExportFrameRequest> {
    let safe_duration_ms = duration_ms.max(0.0);
    let safe_fps = fps.clamp(1.0, 120.0);
    let frame_count = ((safe_duration_ms / 1000.0) * safe_fps).ceil() as u32;
    let frame_duration_ms = 1000.0 / safe_fps;
    let video_tracks: Vec<&Track> = tracks
        .iter()
        .filter(|track| track.track_type == "video")
        .collect();

    (0..frame_count)
        .map(|frame_index| {
            let timeline_ms = (frame_index as f64 * frame_duration_ms).min(safe_duration_ms);
            let requests = collect_video_frame_requests(&video_tracks, timeline_ms);
            ExportFrameRequest {
                frame_index,
                timeline_ms,
                requests,
            }
        })
        .collect()
}

fn collect_video_frame_requests(video_tracks: &[&Track], timeline_ms: f64) -> Vec<FrameRequest> {
    video_tracks
        .iter()
        .flat_map(|track| {
            track
                .clips
                .iter()
                .filter(|clip| {
                    clip.clip_type == "video"
                        && clip.enabled != Some(false)
                        && clip.asset_id.is_some()
                        && is_clip_needed_for_export_frame(clip, &track.transitions, timeline_ms)
                })
                .map(|clip| FrameRequest {
                    clip_id: clip.id.clone(),
                    asset_id: clip.asset_id.clone(),
                    source_time_ms: clip_source_time_ms(clip, timeline_ms),
                })
        })
        .collect()
}

fn is_clip_needed_for_export_frame(
    clip: &Clip,
    transitions: &[Transition],
    timeline_ms: f64,
) -> bool {
    let clip_start = clip.start_ms;
    let clip_end = clip.start_ms + clip.duration_ms;
    if timeline_ms >= clip_start && timeline_ms < clip_end {
        return true;
    }

    transitions.iter().any(|transition| {
        transition.clip_a_id == clip.id
            && transition.transition_type != "none"
            && timeline_ms >= clip_end - transition.duration_ms
            && timeline_ms <= clip_end
    })
}

fn build_compositor_descriptors_core(
    tracks: &[Track],
    playhead_ms: f64,
    effect_preview: Option<&EffectPreviewPatch>,
) -> Vec<CompositorClipDescriptor> {
    let video_tracks: Vec<&Track> = tracks
        .iter()
        .filter(|track| track.track_type == "video")
        .collect();
    let mut descriptors = Vec::new();

    for (track_index, track) in video_tracks.iter().enumerate() {
        let video_clips: Vec<&Clip> = track
            .clips
            .iter()
            .filter(|clip| clip.clip_type == "video")
            .collect();
        for clip in &video_clips {
            let patch = effect_preview
                .filter(|preview| preview.clip_id == clip.id)
                .map(|preview| &preview.patch);
            let contrast =
                patched_number(patch, "contrast").unwrap_or(clip.contrast.unwrap_or(0.0));
            let warmth = patched_number(patch, "warmth").unwrap_or(clip.warmth.unwrap_or(0.0));
            let base_opacity =
                patched_number(patch, "opacity").unwrap_or(clip.opacity.unwrap_or(1.0));

            let outgoing = outgoing_transition_descriptor(clip, &track.transitions, playhead_ms);
            let incoming =
                incoming_transition_descriptor(clip, &track.transitions, &video_clips, playhead_ms);
            let is_active =
                playhead_ms >= clip.start_ms && playhead_ms < clip.start_ms + clip.duration_ms;

            let opacity = if clip.enabled == Some(false) {
                0.0
            } else if let Some(opacity) = outgoing.opacity {
                opacity
            } else if let Some(opacity) = incoming.as_ref().and_then(|value| value.opacity) {
                opacity
            } else if is_active {
                base_opacity
            } else {
                0.0
            };

            let mut transform = CompositorClipTransform {
                scale: patched_number(patch, "scale").unwrap_or(clip.scale.unwrap_or(1.0)),
                translate_x: patched_number(patch, "positionX")
                    .unwrap_or(clip.position_x.unwrap_or(0.0)),
                translate_y: patched_number(patch, "positionY")
                    .unwrap_or(clip.position_y.unwrap_or(0.0)),
                translate_x_percent: 0.0,
                translate_y_percent: 0.0,
                rotation_deg: patched_number(patch, "rotation")
                    .unwrap_or(clip.rotation.unwrap_or(0.0)),
            };
            if let Some(translate_x_percent) = outgoing.translate_x_percent {
                transform.translate_x_percent = translate_x_percent;
            }
            if let Some(translate_y_percent) = outgoing.translate_y_percent {
                transform.translate_y_percent = translate_y_percent;
            }

            descriptors.push(CompositorClipDescriptor {
                clip_id: clip.id.clone(),
                z_index: video_tracks.len() - 1 - track_index,
                source_time_us: (clip_source_time_ms(clip, playhead_ms) * 1000.0).round(),
                opacity,
                clip_path: incoming.and_then(|value| value.clip_path),
                effects: CompositorClipEffects { contrast, warmth },
                transform,
                enabled: clip.enabled != Some(false),
            });
        }
    }

    descriptors
}

#[derive(Default)]
struct OutgoingTransitionDescriptor {
    opacity: Option<f64>,
    translate_x_percent: Option<f64>,
    translate_y_percent: Option<f64>,
}

#[derive(Default)]
struct IncomingTransitionDescriptor {
    opacity: Option<f64>,
    clip_path: Option<CompositorInsetClipPath>,
}

fn outgoing_transition_descriptor(
    clip: &Clip,
    transitions: &[Transition],
    playhead_ms: f64,
) -> OutgoingTransitionDescriptor {
    let Some(transition) = transitions.iter().find(|item| item.clip_a_id == clip.id) else {
        return OutgoingTransitionDescriptor::default();
    };
    if transition.transition_type == "none" {
        return OutgoingTransitionDescriptor::default();
    }

    let clip_end = clip.start_ms + clip.duration_ms;
    let window_start = clip_end - transition.duration_ms;
    if playhead_ms < window_start || playhead_ms > clip_end {
        return OutgoingTransitionDescriptor::default();
    }

    let progress = (playhead_ms - window_start) / transition.duration_ms;
    match transition.transition_type.as_str() {
        "fade" | "dissolve" => OutgoingTransitionDescriptor {
            opacity: Some(1.0 - progress),
            translate_x_percent: None,
            translate_y_percent: None,
        },
        "slide-left" => OutgoingTransitionDescriptor {
            opacity: None,
            translate_x_percent: Some(-progress * 100.0),
            translate_y_percent: None,
        },
        "slide-up" => OutgoingTransitionDescriptor {
            opacity: None,
            translate_x_percent: None,
            translate_y_percent: Some(-progress * 100.0),
        },
        _ => OutgoingTransitionDescriptor::default(),
    }
}

fn incoming_transition_descriptor(
    clip: &Clip,
    transitions: &[Transition],
    all_clips: &[&Clip],
    playhead_ms: f64,
) -> Option<IncomingTransitionDescriptor> {
    let transition = transitions.iter().find(|item| item.clip_b_id == clip.id)?;
    if transition.transition_type != "dissolve" && transition.transition_type != "wipe-right" {
        return None;
    }
    let clip_a = all_clips
        .iter()
        .find(|candidate| candidate.id == transition.clip_a_id)?;
    let clip_a_end = clip_a.start_ms + clip_a.duration_ms;
    let window_start = clip_a_end - transition.duration_ms;
    if playhead_ms < window_start || playhead_ms > clip_a_end {
        return None;
    }

    let progress = (playhead_ms - window_start) / transition.duration_ms;
    if transition.transition_type == "dissolve" {
        return Some(IncomingTransitionDescriptor {
            opacity: Some(progress),
            clip_path: None,
        });
    }

    Some(IncomingTransitionDescriptor {
        opacity: Some(1.0),
        clip_path: Some(CompositorInsetClipPath {
            clip_path_type: "inset",
            top: 0.0,
            right: (1.0 - progress) * 100.0,
            bottom: 0.0,
            left: 0.0,
        }),
    })
}

fn clip_source_time_ms(clip: &Clip, playhead_ms: f64) -> f64 {
    let speed = clip
        .speed
        .filter(|speed| speed.is_finite() && *speed > 0.0)
        .unwrap_or(1.0);
    let source_time_ms = (playhead_ms - clip.start_ms) * speed + clip.trim_start_ms.unwrap_or(0.0);
    let clamped = source_time_ms.max(0.0);
    match clip.source_max_duration_ms {
        Some(max_duration) if max_duration > 0.0 => clamped.min(max_duration),
        _ => clamped,
    }
}

fn sanitize_no_overlap_value(value: Value) -> Value {
    let Value::Array(tracks) = value else {
        return Value::Array(Vec::new());
    };

    Value::Array(
        tracks
            .into_iter()
            .map(|track| {
                let Value::Object(mut track_obj) = track else {
                    return track;
                };
                let Some(Value::Array(clips)) = track_obj.remove("clips") else {
                    return Value::Object(track_obj);
                };
                let mut ordered: Vec<(usize, Value)> = clips.into_iter().enumerate().collect();
                ordered.sort_by(|(left_index, left), (right_index, right)| {
                    let left_start = value_number(left, "startMs").unwrap_or(0.0);
                    let right_start = value_number(right, "startMs").unwrap_or(0.0);
                    left_start
                        .partial_cmp(&right_start)
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then_with(|| left_index.cmp(right_index))
                });

                let mut cursor: f64 = 0.0;
                let mut sanitized = Vec::with_capacity(ordered.len());
                for (_, clip) in ordered {
                    let mut clip = align_clip_trim_end_to_invariant_value(clip);
                    let start = value_number(&clip, "startMs").unwrap_or(0.0).max(0.0);
                    let duration = value_number(&clip, "durationMs").unwrap_or(0.0);
                    let safe_start = cursor.max(start);
                    if let Value::Object(obj) = &mut clip {
                        obj.insert("startMs".to_string(), json_number(safe_start));
                    }
                    cursor = safe_start + duration;
                    sanitized.push(clip);
                }

                track_obj.insert("clips".to_string(), Value::Array(sanitized));
                Value::Object(track_obj)
            })
            .collect(),
    )
}

fn align_clip_trim_end_to_invariant_value(mut clip: Value) -> Value {
    let clip_type = clip
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    if !matches!(clip_type.as_str(), "video" | "audio" | "music") {
        return clip;
    }
    if clip_type == "video" && clip.get("isPlaceholder").and_then(Value::as_bool) == Some(true) {
        return clip;
    }
    if clip.get("assetId").is_none() || clip.get("assetId") == Some(&Value::Null) {
        return clip;
    }
    let Some(source_max_duration_ms) = value_number(&clip, "sourceMaxDurationMs") else {
        return clip;
    };
    let trim_start_ms = value_number(&clip, "trimStartMs").unwrap_or(0.0);
    let speed = value_number(&clip, "speed")
        .filter(|speed| speed.is_finite() && *speed > 0.0)
        .unwrap_or(1.0);
    let duration_ms = value_number(&clip, "durationMs").unwrap_or(0.0);
    let max_timeline_duration = ((source_max_duration_ms - trim_start_ms) / speed)
        .floor()
        .max(100.0);
    let duration = duration_ms.max(100.0).min(max_timeline_duration);
    let consumed_source_ms = (duration * speed).round();
    let trim_end_ms = (source_max_duration_ms - trim_start_ms - consumed_source_ms).max(0.0);

    if let Value::Object(obj) = &mut clip {
        obj.insert("durationMs".to_string(), json_number(duration));
        obj.insert("trimEndMs".to_string(), json_number(trim_end_ms));
    }
    clip
}

fn patched_number(patch: Option<&Value>, key: &str) -> Option<f64> {
    patch
        .and_then(|value| value.get(key))
        .and_then(Value::as_f64)
}

fn value_number(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(Value::as_f64)
}

fn json_number(value: f64) -> Value {
    serde_json::Number::from_f64(value)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn golden_fixture() -> Value {
        serde_json::from_str(include_str!("../fixtures/phase3-timeline-golden.json")).unwrap()
    }

    fn normalize_numbers(value: Value) -> Value {
        match value {
            Value::Array(items) => Value::Array(items.into_iter().map(normalize_numbers).collect()),
            Value::Object(map) => Value::Object(
                map.into_iter()
                    .map(|(key, value)| (key, normalize_numbers(value)))
                    .collect(),
            ),
            Value::Number(number) => number
                .as_f64()
                .map(json_number)
                .unwrap_or(Value::Number(number)),
            other => other,
        }
    }

    fn fixture_tracks() -> Vec<Track> {
        serde_json::from_value(golden_fixture()["tracks"].clone()).unwrap()
    }

    #[test]
    fn computes_duration() {
        assert_eq!(
            compute_duration_core(&fixture_tracks()),
            golden_fixture()["durationMs"].as_f64().unwrap()
        );
    }

    #[test]
    fn resolves_top_video_frame() {
        assert_eq!(
            resolve_frame_core(&fixture_tracks(), 875.0),
            serde_json::from_value(golden_fixture()["resolveFrameAt875"].clone()).unwrap()
        );
    }

    #[test]
    fn builds_golden_compositor_descriptors() {
        let descriptors = build_compositor_descriptors_core(&fixture_tracks(), 875.0, None);
        assert_eq!(
            normalize_numbers(serde_json::to_value(descriptors).unwrap()),
            normalize_numbers(golden_fixture()["compositorAt875"].clone())
        );
    }

    #[test]
    fn builds_export_frame_request_iterator() {
        let frames = build_export_frame_requests_core(&fixture_tracks(), 1000.0, 4.0);
        assert_eq!(frames.len(), 4);
        assert_eq!(frames[0].frame_index, 0);
        assert_eq!(frames[0].timeline_ms, 0.0);
        assert!(frames.iter().any(|frame| frame
            .requests
            .iter()
            .any(|request| request.clip_id == "clip-a")));
    }

    #[test]
    fn sanitizes_overlaps_and_trim_invariant() {
        let fixture = golden_fixture();
        let tracks = sanitize_no_overlap_value(fixture["sanitizeInput"].clone());
        assert_eq!(
            normalize_numbers(tracks),
            normalize_numbers(fixture["sanitizeOutput"].clone())
        );
    }
}
