# Skill: ToolSettingsPanel Component

## Context
`src/components/ToolSettingsPanel.tsx` provides configuration for the active annotation tool (Color, Thickness, Opacity) and Signature management.

- **Store**: `useAnnotationStore`.
- **Modes**: Context-aware (hides strokes for Text, shows font size for Text).

## Internal Logic
1. **Signature Pad**:
   - Custom canvas implementation for drawing signatures.
   - Captures `mousedown/mousemove/mouseup` to draw paths.
   - Converts to DataURL for storage.
2. **Live Updates**:
   - Sliders update store immediately.
   - Font size uses a "draft" ref pattern to avoid history pollution during slide.

## Invariants
- Only one tool's settings are relevant at a time.
- Signature data must be a valid DataURL image.

## Common Pitfalls
- **History Spam**: Dragging a slider should not create 50 Undo entries. Use `onPointerUp` for the "commit".
- **Mobile**: Drawing surface must handle `scrolling` vs `drawing` touches.

## Self-Improvement Protocol
1. **Verification Checklist**:
   - [ ] Does changing color update the *selected* annotation if one is selected?
   - [ ] Does the signature pad work on generic touch screens?
   - [ ] Is the "Export" button functional?

## Refactoring Guidelines
- **Componentization**: Extract `SignaturePad` to its own component.
- **Presets**: Allow saving custom colors to a palette.
