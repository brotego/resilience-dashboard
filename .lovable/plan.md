
Assessment
- Your proposed mousemove plus position fixed approach will look stable, but it does not satisfy the original UX goal: it follows the cursor, not the marker. If the cursor moves off the point, the tooltip drifts away from the data point.
- Better fix: avoid both map.project and getBoundingClientRect for hover, and anchor the tooltip directly to the marker DOM element.

Implementation plan

1) Replace hover system in GlobalMap with marker-local tooltip (clean rewrite)
- Delete current hover tooltip refs and map move reposition logic.
- On marker mouseenter, create one plain div tooltip and append it as a child of that marker’s element.
- Set marker element to position: relative and tooltip to position: absolute with fixed offsets (left: 20px, top: -40px).
- Tooltip content remains: country, signal title, one-line description, colored domain/category label.
- On mouseleave, remove tooltip immediately.

2) Enforce single-tooltip lifecycle and hard guards
- Track current hover tooltip element in a ref.
- Before creating a new tooltip, safely remove existing one with null checks.
- On marker refresh/unmount, remove tooltip once and clear refs.
- Ensure no .remove call is made on undefined.

3) Keep click behavior isolated
- Keep click detail popups independent from hover tooltips so hover state never interferes with click state.
- If click is also unstable, move click detail to the same custom-div pattern (anchored to marker element) in a second pass.

4) Add defensive tooltip rendering
- Escape/sanitize dynamic text before innerHTML, or build tooltip via createElement/textContent nodes.
- Keep pointer-events: none on tooltip to prevent hover flicker loops.

5) AI response format lock (small hardening)
- Keep current exact section template in backend prompt.
- In AIInsightPanel, strengthen client post-processing:
  - strip markdown tokens
  - normalize to exactly three labeled sections if model drifts
- Render with whitespace-pre-line as already implemented.

Validation checklist
- Hover marker at different zoom levels and after pan: tooltip stays attached to the same marker.
- Rapidly move between markers: no orphan tooltip and no console errors.
- Switch resilience/genz and company lens: hover still stable.
- Trigger AI generation multiple times: plain uppercase labels, no asterisks, short executive prose.

Why this should finally work
- Marker-local absolute positioning removes coordinate conversion and viewport math entirely.
- Because tooltip is attached to the marker element itself, it moves with the marker automatically as the map moves.
