
Need to do deep research. 

Alright — this is a solid feature. I’m going to clean it up into something a team could actually execute on without confusion.

---

# 📄 PM Specification: On-Canvas Editing + Contextual Toolbars

## 1. Overview

We are transitioning from a **panel-driven editing model (Inspector)** to a **direct manipulation model (on-canvas editing)**.

This change introduces:

* **Drag-and-drop interaction directly in the preview**
* **Contextual toolbars based on selection**
* **Removal of the Inspector panel entirely**

Goal: Make editing feel like Figma / Adobe Premiere Pro instead of a form-based UI.

---

## 2. Problem

Current issues:

* Editing is indirect (Inspector-based)
* Users cannot manipulate elements visually
* High friction for simple actions (move, crop, duplicate)
* UI feels outdated vs modern editors

---

## 3. Goals

* Enable **direct manipulation (WYSIWYG editing)**
* Reduce reliance on side panels
* Surface **common actions instantly**
* Improve editing speed + intuitiveness

---

## 4. Core Changes

### 4.1 Deprecate Inspector

* Remove Inspector panel entirely
* All functionality redistributed into:

  * **Right-side toolbar (rich controls)**
  * **Top floating toolbar (quick actions)**

---

## 5. On-Canvas Interaction (Core Feature)

### 5.1 Selection

* User can click/tap any visible element in preview
* Selected element shows:

  * Bounding box
  * Selection state (highlight)

---

### 5.2 Drag-to-Reposition

* Users can drag elements directly in preview
* Movement updates position in real-time

**Behavior:**

* Smooth dragging (no lag)
* Position maps to underlying transform model
* Works across all clip types (text, image, video, overlays)

---

### 5.3 Mental Model

> Preview = source of truth for positioning
> Timeline = sequencing only

---

## 6. Contextual UI on Selection

When a clip is selected, **two UI surfaces appear simultaneously**:

---

## 6.1 Top Floating Toolbar (Quick Actions)

### Behavior

* Appears near the top of the preview (anchored or floating)
* Context-sensitive to selected clip type

### Purpose

Fast, high-frequency actions

### Example Actions

* Crop
* Duplicate
* Delete
* Add Overlay
* Fill / Fit
* Flip / Rotate (optional)

### Characteristics

* Minimal
* Fast access
* Always visible on selection

---

## 6.2 Right-Side Toolbar (Rich Controls)

### Behavior

* Replaces Inspector
* Updates dynamically based on selected clip type

### Purpose

Deep editing controls

### Example Sections

* **Basic**

  * Position
  * Scale
  * Rotation

* **Background**

  * Color
  * Blur
  * Opacity

* **Smart Tools**

  * AI features
  * Auto enhancements

* **Animation**

  * Entry / Exit
  * Keyframes (future)

---

## 7. Clip-Type Customization

Toolbars should adapt based on clip type:

| Clip Type | Top Toolbar              | Right Toolbar        |
| --------- | ------------------------ | -------------------- |
| Text      | Duplicate, Delete, Style | Font, Size, Effects  |
| Image     | Crop, Fill, Duplicate    | Filters, Adjustments |
| Video     | Crop, Trim shortcut      | Playback, Effects    |
| Overlay   | Duplicate, Layering      | Opacity, Blend       |

---

## 8. Interaction Flow

1. User clicks element in preview

2. Element becomes selected

3. System shows:

   * Bounding box
   * Top floating toolbar
   * Right-side toolbar

4. User can:

   * Drag to reposition
   * Use top toolbar for quick edits
   * Use right toolbar for deep edits

---

## 9. UX Principles

* **Direct > indirect**
* **Visible > hidden**
* **Fast actions > buried controls**
* **Canvas-first editing**

---

## 10. Non-Goals (for now)

* Advanced snapping system
* Multi-select
* Rotation handles
* Full keyframe system

(Keep scope tight — don’t overbuild yet)

---

## 11. Risks / Considerations

* React Native gesture handling complexity
* Performance during drag (especially video layers)
* Z-index / layering conflicts
* Hitbox precision for selection

---

## 12. Success Metrics

* ↓ Time to perform basic edits (move, duplicate)
* ↓ Reliance on right panel interactions
* ↑ User interaction with preview canvas
* ↑ Editing speed / session completion rate

---

## 13. TL;DR (what you're building)

> A Figma-style editing experience inside a video editor:

* Drag stuff directly in preview
* Click = select
* Top bar = quick actions
* Right panel = deep controls
* Inspector = gone

