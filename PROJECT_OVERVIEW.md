# Wrestling Coach Prototype Overview

## What this project is
This prototype is a browser-based wrestling program management sim built with Vite and TypeScript. The HTML shell (no React) wires directly to DOM IDs and classes defined in `index.html`, while most logic lives in `src/main.ts` with small, focused helpers in `src/core`, `src/data`, `src/store`, and `src/ui`.

## Core game systems implemented
- **Program & league setup**: A catalog of programs is generated from `SCHOOL_NAMES` with color palettes, prestige, and resource ratings, and a parallel league table is initialized to track wins, losses, points for/against, and ratings. State for roster, budgets, schedule, weekly summaries, postseason bracket placeholders, and live-dual context is centralized in `src/main.ts`.【F:src/main.ts†L523-L604】
- **Roster & lineup management**: Wrestlers are modeled with positional, physical, morale, health, fatigue, potential, and injury attributes. Lineups are tracked per weight class, with helper UI rendering for roster lists and lineup cards that surface injury/form/fatigue badges and selection dropdowns.【F:src/ui/rosterUI.ts†L1-L83】【F:src/ui/rosterUI.ts†L85-L140】
- **Match & dual simulation**: Individual matches combine style attributes, morale, health, fatigue, and injuries to score competitors, determine a winner, and set a victory method that feeds into dual scoring. Dual meets iterate across weight classes, award team points by method (including forfeits), and return bout logs and team scores.【F:src/core/match.ts†L2-L86】【F:src/core/dualMeet.ts†L1-L112】
- **Season loop & weekly flow**: The game tracks day-of-week, season week, and team record, updating UI elements and allowing day advancement. Season duals pull scheduled opponents (with a final-week tournament flag), simulate results, adjust fatigue/health/morale, log weekly summaries, update standings, and trigger Gazette storytelling and postseason when appropriate.【F:src/main.ts†L1529-L1585】【F:src/main.ts†L1985-L2028】【F:src/main.ts†L2054-L2079】
- **Schedule, scouting, and standings**: Season schedules are procedurally generated, splitting upcoming vs. completed events in the dashboard, and standings sort league teams by win percentage, point differential, and rating while feeding the home-ranking tiles.【F:src/main.ts†L1529-L1568】【F:src/main.ts†L193-L216】【F:src/main.ts†L500-L515】
- **Recruiting & budgets**: Prospects include weight class, rating, interest, rank, and tags; generate/decay actions are wired to UI lists. Training and NIL budgets are sliders stored in state and written to the coach bar and dashboard cards.【F:src/main.ts†L532-L551】【F:index.html†L180-L189】
- **Live dual & Gazette presentation**: Live-dual UI scaffolding creates a dedicated view with dynamic titles, scores, bout cards, and coaching strategy controls, while Gazette overlays render headlines, blurbs, secondary stories, reaction buttons, and continue/box-score navigation after sims.【F:src/main.ts†L216-L274】【F:src/main.ts†L184-L228】
- **Persistence**: Game state (roster, lineup selections, schedule, recruits, league, postseason, budgets, and live duals) can be saved/loaded via `localStorage` with backward compatibility for a legacy key.【F:src/store/storage.ts†L1-L42】【F:src/main.ts†L1311-L1444】

## How the UI is structured
- `index.html` lays out the views and cards without a framework: program selection overlay; home tiles; coach bar with training focus selector; dashboard cards for lineup, roster, recruiting, budget, and schedule/scouting; plus navigation buttons to swap views.【F:index.html†L13-L200】
- Styling lives in `style.css` (global) and class names referenced in `src/ui/rosterUI.ts` and main scripts. The TypeScript code uses `document.getElementById` lookups against these IDs to bind event listeners and render content.

## What remains or could be expanded
- **Documentation & onboarding**: This overview is the first consolidated explanation; in-app tutorial tiles still point to “Learn the ropes” without underlying guidance content.【F:index.html†L79-L83】
- **Program data richness**: `SCHOOL_NAMES` is a large string list but currently maps to identical blurbs and formulaic prestige/athletics values; bespoke bios or difficulty tiers could improve differentiation.【F:src/main.ts†L592-L605】
- **Training depth**: Training focus and budget sliders exist, but skill progression largely occurs through day advancement and basic modifiers; a clearer progression model (e.g., per-focus gains, decay, offseason development) would deepen the loop.【F:src/main.ts†L2054-L2067】【F:index.html†L114-L128】
- **Live dual interactions**: The live-dual view scaffolding is present, yet richer real-time controls (tactics, substitutions, injury handling) and visual bout updates would make live simulations feel distinct from instant sims.【F:src/main.ts†L216-L274】
- **Postseason & tournaments**: State is tracked for postseason brackets and logs, and tournaments are flagged in schedules, but the flow could be expanded with bracket visualization, advancement UI, and off-season summaries beyond the current log strings.【F:src/main.ts†L543-L552】【F:src/main.ts†L1985-L2028】【F:src/main.ts†L2200-L2255】
- **Analytics & scouting depth**: Schedule entries and scouting buttons exist, but scouting reports are minimal; richer opponent insights, wrestler matchups, and historical results could guide lineup choices.【F:index.html†L191-L200】

## Quick file guide
- `src/main.ts` – Primary game loop, state, event handlers, UI rendering, schedule/postseason management, Gazette, and live dual orchestration.
- `src/core/match.ts` and `src/core/dualMeet.ts` – Simulation engines for matches and dual meets.
- `src/ui/rosterUI.ts` and `src/ui/logger.ts` – DOM helpers for roster/lineup displays and logging.
- `src/store/storage.ts` – Save/load helpers for `localStorage`.
- `src/data/weights.ts` and `src/schools.ts` – Static datasets for weight classes and program names.
- `index.html` and `style.css` – Static shell and styling for the prototype interface.
