

# Flourishing Through Resilience Dashboard — Phase 1: Global Resilience Map

## Overview
An executive-grade interactive dashboard for the 49F program at Mori Building, Tokyo. Phase 1 delivers the Global Resilience Map mode with all 5 domains, 4 mindsets, AI insight generation, and Japan-focused sidebar.

## Design System
- **Background**: Deep navy charcoal (`#0F1923`)
- **Japan/highlights accent**: Deep amber gold (`#E8A838`)
- **Gen Z accent** (reserved for Phase 2): Soft teal jade (`#2ABFB3`)
- **Body text**: Muted warm white (`#E8E4DC`)
- **Alert indicators**: Terracotta (`#C1583A`)
- **Map base**: Dark matte warm-toned style
- **Typography**: Clean, authoritative — Inter or similar. Large readable headers, professional executive tone.

## Pages & Layout

### Main Dashboard (single page app)
- **Top bar**: "Flourishing Through Resilience" title + Anchorstar × Mori branding area, mode toggle (Global Resilience / Gen Z Signal — Gen Z disabled with "Coming Soon" badge for now)
- **Left sidebar**: Domain selector (5 domains as toggleable layers) + Mindset selector (4 mindsets as lens filters) + Japan Focus Panel showing how the selected domain/mindset connects to Japanese business context
- **Center**: Full-width interactive map using MapLibre GL JS with dark warm-toned basemap
- **Right panel**: AI Insight Panel — generates a synthesized brief when domain/mindset selection changes

## Interactive Map (MapLibre GL)
- Dark-toned basemap (e.g., CARTO Dark Matter or custom styled)
- 5 toggleable data layers, one per domain:
  - **Work**: Workforce transformation signals (remote work adoption, labor market shifts)
  - **Selfhood**: Mental health, identity, and personal development trends
  - **Community**: Community rebuilding, social infrastructure, mutual aid
  - **Aging**: Aging population data, eldercare innovation, longevity economy
  - **Environment**: Climate adaptation, renewable energy, urban sustainability
- Each layer uses placeholder GeoJSON point/polygon data with ~15-25 global data points
- Japan highlighted with special styling (amber gold markers/boundaries)
- Clicking a data point opens a popup with signal details
- 4 mindset lenses reframe the visual emphasis and tooltip content

## Japan Focus Sidebar
- Always visible on the left below domain/mindset selectors
- Shows curated Japan-specific context for the active domain
- Includes placeholder stats, trend summaries, and "what this means for CEOs" callouts
- Structured data format so content is easy to update as research comes in

## AI Insight Panel (Right Side)
- Powered by Lovable AI gateway (Gemini model) via a Supabase edge function
- Triggers when user changes domain, mindset, or both
- Generates a ~150-word executive brief: "What's happening globally through [domain] × [mindset] and what it means for Japanese business leaders"
- Tone: executive, direct, data-grounded
- Shows loading state with subtle animation
- Displays the generated brief with domain/mindset context label

## Data Architecture
- All placeholder data in structured JSON/TypeScript files under `src/data/`
- Separate files per domain with typed interfaces
- Easy to swap in real research data later without changing components
- Modular layer system so new data sources plug in cleanly

## Components to Build
1. **DashboardLayout** — main shell with sidebar, map, and AI panel
2. **GlobalMap** — MapLibre GL map with layer management
3. **DomainSelector** — toggle switches for 5 domain layers
4. **MindsetSelector** — radio/card selector for 4 mindset lenses
5. **JapanFocusPanel** — Japan-specific insight sidebar
6. **AIInsightPanel** — right panel with AI-generated briefs
7. **MapPopup** — styled popup for data point details
8. **ModeToggle** — header toggle between modes (Gen Z disabled for now)
9. **Edge function** (`ai-insight`) — calls Lovable AI gateway with domain/mindset context

