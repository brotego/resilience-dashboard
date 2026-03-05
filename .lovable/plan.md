

# Fix Plan: 4 Issues

## 1. Wider Left Sidebar
Change `DashboardLayout.tsx` sidebar from `w-72` (288px) to `w-[300px]`. Remove `truncate` from `DomainSelector.tsx` description text so nothing gets cut off.

## 2. Fix Map Popup Positioning
The popup positioning issue is likely caused by MapLibre CSS not being applied correctly or the popup anchor not being set. In `GlobalMap.tsx`, ensure the popup is created with proper `anchor` option and that the popup is attached to the marker's coordinates. Will also verify the MapLibre CSS import is working.

## 3. Expand to 50-60 Data Points
Add ~35 new signals to `signals.ts` to reach ~57 total. Fill gaps in:
- **Africa**: Lagos, Nairobi, Cape Town, Cairo, Accra
- **Southeast Asia**: Bangkok, Ho Chi Minh City, Jakarta (expand), Manila, Kuala Lumpur
- **South America**: Buenos Aires, Bogotá, Lima, Santiago
- **Middle East/Central Asia**: Dubai, Riyadh, Almaty
- **Japan**: Add 5-6 more Japan-specific points (Fukuoka, Sapporo, Kyoto, Hiroshima, Sendai, Kobe) to create a dense amber cluster
- **Additional global**: Mumbai, Delhi, Melbourne, Lagos, Nairobi

Distribute across all 5 domains evenly. Japan should have ~10 total markers (currently 5).

## 4. Gen Z Signal Mode (Phase 2)

### New data files
- `src/data/genzTypes.ts` — types for `GenZSignal`, `GenZCategory`
- `src/data/genzSignals.ts` — 40-50 Gen Z data points globally (US, Europe, East Asia, emerging markets)
- `src/data/genzCategories.ts` — Gen Z signal categories replacing the 5 domains (e.g., "Brand Authenticity", "Work-Life Integration", "Climate Action", "Digital Identity", "Community & Belonging")

### Updated components
- `DashboardLayout.tsx` — add `mode` state (`"resilience" | "genz"`), pass to all panels, conditionally render domain selector vs Gen Z category selector
- `ModeToggle.tsx` — make Gen Z button active/clickable, emit mode change
- `GlobalMap.tsx` — accept `mode` prop, render Gen Z signals (teal markers) when in Gen Z mode
- `AIInsightPanel.tsx` — accept `mode` prop, adjust prompt context for Gen Z insights
- New `GenZCategorySelector.tsx` — replaces DomainSelector in Gen Z mode
- New `GenZFocusPanel.tsx` — replaces JapanFocusPanel in Gen Z mode, showing Gen Z market insights for Japanese companies

### Edge function update
- `ai-insight/index.ts` — accept `mode` param, use Gen Z-specific system prompt and categories when mode is `"genz"`

### Visual
- All Gen Z markers use teal jade `#2ABFB3` / `hsl(170, 55%, 46%)`
- Gen Z mode header button gets active styling, Global Resilience becomes inactive
- Left sidebar smoothly swaps content based on mode

