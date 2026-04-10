
<summary>Fix map zoom limits, add country click for country outlook, show all country labels, add hover tooltips on dots, and improve overall usability.</summary>

## Problems to Fix

1. **Zoom-out shows empty corners** — MIN_ZOOM is 1 but the map projection doesn't fill the viewport at that level. Raise minimum zoom to 1.3 and default to ~1.5 so the map always fills the container.

2. **Countries not clickable** — Geography components have no onClick. Need to map country names to signals, then show a "Country Outlook" card in the right panel.

3. **Country labels only show at zoom >= 2.5** — Remove the `showLabels` gate so labels always display. Add more countries to COUNTRY_LABELS (cover all ~50 visible nations). Scale label font size by dotScale so they don't overwhelm at low zoom.

4. **No hover tooltips on dots** — Signal dots have no hover state. Need SVG `<title>` or a custom tooltip showing 1-5 word summary on hover.

5. **General polish** — Better hover states on countries, visual feedback.

## Plan

### 1. Fix Zoom Limits
- Change `MIN_ZOOM` from 1 to 1.3, keep default zoom at 1.5
- This prevents the map from shrinking below the viewport and showing background corners

### 2. Add Hover Tooltips on Signal Dots
- Add an SVG `<title>` element inside each `<Marker>` with the signal title (1-5 words)
- This gives native browser tooltip on hover — lightweight, no extra dependencies
- Also add a subtle scale-up on hover via CSS (`:hover` on the marker group)

### 3. Show Country Labels at All Zoom Levels
- Remove the `showLabels = position.zoom >= 2.5` gate — always render labels
- Expand COUNTRY_LABELS to cover ~60+ countries (add Russia, Canada, Mexico, Spain, Italy, Turkey, Iran, Pakistan, Bangladesh, Myanmar, Ethiopia, Tanzania, Congo, Morocco, Algeria, Libya, Sudan, Iraq, Afghanistan, Poland, Ukraine, Romania, Czech Republic, Austria, Switzerland, Norway, Ireland, Portugal, Greece, New Zealand, Mongolia, Uzbekistan, Cuba, Venezuela, Ecuador, Bolivia, Paraguay, Uruguay, etc.)
- Use a smaller base font size at low zoom (e.g. `8 * dotScale`) and slightly larger when zoomed in

### 4. Make Countries Clickable → Country Outlook Panel
- Add `onClick` to each `<Geography>` component that extracts the country name from `geo.properties.name`
- Create a new callback `onCountryClick(countryName: string)` in GlobalMap props
- In DashboardLayout, add state for `selectedCountry` and a handler that:
  - Clears `selectedSignal`
  - Sets `selectedCountry`
- Update AIInsightPanel to accept `selectedCountry` prop
- When a country is selected (and no signal is selected), show a **Country Outlook** card:
  - Country name as title
  - List all signals located in that country (filter by `signal.location` containing country name)
  - Show summary stats: number of signals, dominant domains, key themes
  - List each signal as a clickable mini-card (title + domain tag)
  - Clicking a signal from the list behaves same as clicking the dot
- Add visual feedback: highlight the clicked country with a brighter fill color

### 5. Visual Polish
- Add hover cursor `pointer` on Geography elements
- Highlight hovered countries with a slightly brighter fill
- Add a subtle glow/pulse on selected signal dots
- Improve the empty state messaging in the right panel

### Files to Edit
- `src/components/dashboard/GlobalMap.tsx` — zoom limits, labels, tooltips, country click, hover styles
- `src/components/dashboard/DashboardLayout.tsx` — new `selectedCountry` state, handler, pass to panel
- `src/components/dashboard/AIInsightPanel.tsx` — new country outlook view when `selectedCountry` is set

### Technical Notes
- Country names from TopoJSON `geo.properties.name` may differ from signal location strings (e.g. "United States of America" vs "USA"). Will build a mapping/fuzzy match using `signal.location.includes(countryName)` or a country alias lookup.
- SVG `<title>` is the simplest tooltip approach — works natively, no state management needed.
