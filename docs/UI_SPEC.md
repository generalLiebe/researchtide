# ResearchTide — UI Design Specification
> Version 0.1 · March 2026 · For Coding Agents

---

## 0. Design Philosophy

ResearchTide's UI is inspired by three sources:

| Source | What we borrow |
|---|---|
| **Fate/Grand Order — Chaldeas** | Bright, clean facility aesthetic. A glowing blue sphere as the "observation center". White walls, luminous data. The feeling of watching something vast from a safe, well-lit room. |
| **Neon Genesis Evangelion — NERV terminals** | Monospace overlays, corner brackets, status tickers, hex grids, orange accent on critical alerts. The HUD-within-a-clean-UI tension. |
| **Detroit: Become Human** | Clean white panels with sharp information hierarchy. Scan-line reveals. Sidebar detail panels that slide in smoothly. |

**Core tone: bright, luminous, trustworthy — not dark/hacker. This is a scientific observatory, not a cyberpunk terminal.**

---

## 1. Color Palette

### Base (backgrounds)
```
--bg-primary:     #eaf3ff   /* main canvas, like Chaldeas facility walls */
--bg-secondary:   #f0f6ff   /* panels, cards */
--bg-tertiary:    #dce8f8   /* subtle depth */
--bg-panel:       rgba(255, 255, 255, 0.92)  /* slide-in panels, frosted */
```

### Text
```
--text-primary:   #1a3060   /* dark navy, main headings */
--text-secondary: #3a5a9a   /* subheadings, labels */
--text-muted:     #8aaad0   /* metadata, timestamps */
--text-mono:      #6a8ac0   /* monospace overlays, HUD text */
```

### Signal Colors (encode research status)
```
--tier-s:   #e8a020   /* gold — Tier S, >90 intensity (≥90 papers·impact score) */
--tier-a:   #3a7ad4   /* blue — Tier A, 75–89 */
--tier-b:   #2ab8a0   /* teal — Tier B, 65–74 */
--tier-c:   #8aaad0   /* muted blue — Tier C, <65 */
```

### Accent
```
--accent-glow:    rgba(100, 170, 255, 0.18)   /* Chaldeas sphere center glow */
--accent-line:    rgba(80, 130, 210, 0.18)    /* flowing dashed edges */
--accent-border:  rgba(100, 150, 220, 0.35)   /* continent outlines, card borders */
--accent-grid:    rgba(74, 123, 203, 0.06)    /* background grid lines */
```

### Alert / Ethics Lag
```
--alert-ethics:   #e85d24   /* warm orange-red — Ethics Lag warning */
--alert-weak:     #e8a020   /* gold pulse — Weak Signal detected */
--success:        #2ab8a0   /* teal — system nominal */
```

---

## 2. Typography

### Fonts
- **Body / UI**: system sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **HUD overlays / status text / timestamps**: `monospace` (system mono)
- **Data values / metrics**: sans-serif, weight 700

### Scale
```
--fs-hud:      8px   /* HUD overlays, corner labels, status tickers — monospace */
--fs-label:    9px   /* legend items, metadata keys — monospace, letter-spacing: .12em */
--fs-body:     10px  /* panel descriptions */
--fs-tag:      9px   /* topic pills */
--fs-metric:   15px  /* stat card values */
--fs-heading:  14px  /* panel node name */
```

### Letter-spacing
- HUD / monospace text: `letter-spacing: .15em` to `.22em`
- ALL CAPS labels: `letter-spacing: .12em`
- Body text: default

---

## 3. Layout

### Two Primary Views (tab-switched)

#### View A: World Map (Chaldeas Observation Layer)
- Full-width canvas, aspect ratio `width × 0.52`
- Background: radial gradient from `--bg-primary` to `--bg-tertiary`
- Central radial glow (the "Chaldeas sphere") centered at `(50%, 42%)`, radius `22% of width`
- Subtle grid: 12 vertical × 7 horizontal lines, `--accent-grid` color
- Continent fills: `rgba(200, 218, 245, 0.55)` with `--accent-border` stroke
- Hub nodes: glowing dots, size proportional to intensity score

#### View B: Research Topic Map
- Full-width canvas, same dimensions
- Dark-ish background (navy `#0d1f3c`) — the topic map is more "deep space"
- Nodes: circles with status-color fills
- Edges: faint gray connection lines

### Slide-in Detail Panel
- Width: `264px` fixed
- Position: right edge, slides in on node click (`right: -280px` → `right: 0`)
- Transition: `0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- Background: `--bg-panel` (frosted white)
- Border-left: `1px solid #c5d8f0`
- Dismisses on: clicking the × button, or clicking empty canvas space

### HUD Overlay Elements (always visible, pointer-events: none)
- **Corner brackets** (4 corners): `18×18px`, `1.5px` stroke, `#4a7bcb55`
- **Top bar**: title left (`RESEARCHTIDE // [VIEW NAME]`) + clock right — monospace, `--text-mono`
- **Bottom bar**: node count left + status message center + system status right
- **Legend**: top-left, below corner bracket — tier dots + labels

---

## 4. Node / Hub Design

### World Map Nodes
```
base_radius = 3 + (intensity / 32)   /* px, scales with intensity */
```

Layers (drawn bottom to top):
1. **Radial glow** — `createRadialGradient`, color `#COLOR30` → `#COLOR00`, radius `base_r + 12`
2. **Pulse ring** — animated circle, radius `base_r + 4 + 2.5 * sin(phase)`, stroke `#COLOR28`, `0.6px`
3. **Core dot** — radial gradient fill (lighter center, `#COLORff` → `#COLORcc`), stroke white when selected
4. **Reflection dot** — small white circle at `(-0.25r, -0.28r)` offset, `rgba(255,255,255,0.55)`, radius `0.22r`
5. **Label** — monospace, `9px`, color `#COLORbb` (muted), appears below node

**Selected state**: pulse ring opacity `55` (vs `28`), core stroke white `2px`, label color `--text-primary`

### Topic Map Nodes
```
base_radius = variable per topic importance
```
- `Weak Signal`: animated outer pulsing ring (extra glow), color `--tier-s`
- `Rising`: solid, color `--tier-a`
- `Mainstream`: solid + larger, color `--tier-b` or custom
- `Displaced`: 50% opacity, color `#888780`

---

## 5. Animated Elements

### Flowing Edges (World Map)
- Dashed lines between related hubs
- `lineDashOffset` decremented each frame: `dashOffset -= 0.4`
- Dash pattern: `[5 + 3*sin(T*0.04 + nodeIndex), 8]`
- Color: `rgba(80, 130, 210, 0.18)`, `0.7px` stroke

### Node Pulse
- Phase per node: `T * 0.035 + nodeId * 0.7`
- Pulse ring radius: `base_r + 4 + 2.5 * sin(phase)`
- Tier-S nodes: extra golden outer ring, `0.5px`, `#ffc10766`

### Weak Signal Indicator (Topic Map)
- Additional outer ring: `base_r + 4 + 3 * sin(pulse)`
- Color: node color at `66` opacity

### Clock Ticker (top-right HUD)
- Updates every 60 frames
- Format: `HH:MM:SS` in local time
- Font: monospace, `--fs-label`

### Status Message Cycle (bottom-center HUD)
Cycles every 60 frames through:
```
"MONITORING GLOBAL RESEARCH STREAMS"
"ANALYZING CITATION FLOWS"
"DETECTING WEAK SIGNALS"
"COMPUTING ETHICS LAG DELTA"
"UPDATING INFLUENCE GRAPH"
```

---

## 6. Detail Panel Components

### Header
```
[Node Name]           → font-size: 14px, weight: 600, color: --text-primary
[TIER-X · REGION]     → monospace, 9px, letter-spacing: .15em, color: tier color
[Institution names]   → 10px, color: --text-muted
```

### Stat Cards (2-column grid)
```
background: #f0f6ff
border: 1px solid #d0e0f0
border-radius: 6px
padding: 6px 8px
```
- Label: `8px`, monospace, `--text-muted`, `letter-spacing: .1em`
- Value: `15px`, weight 700, colored by tier

### Progress Bars
```
track: height 4px, background #e0ecf8, border-radius 2px
fill:  transition width 0.5s
```
- Signal Intensity: fill color = tier color
- Growth Velocity: fill color = `--tier-a` (`#3a7ad4`)

### Ethics Lag Timeline
```
Two-segment bar (horizontal)
  Left segment:  "技術" — color #1D9E75cc, width = (100 - ethicLag)%
  Right segment: "倫理ラグ" — color #E85D24cc, width = ethicLag%
  Height: 20px, border-radius: 4px
```

### Topic Pills
```
background: #e8f2ff
color: #3a6ab8
border: 1px solid #c5d8f0
border-radius: 10px
padding: 2px 7px
font-size: 9px
```

### Action Button
```
background: linear-gradient(135deg, #4a7bcb, #2a5bab)
color: #ffffff
border: none
border-radius: 6px
font-size: 10px
font-family: monospace
letter-spacing: .08em
padding: 7px
width: 100%
```
Hover: `opacity: 0.85`

---

## 7. Canvas Setup

```javascript
// Always resize to parent width, maintain 0.52 aspect ratio
canvas.width = parent.clientWidth
canvas.height = Math.round(canvas.width * 0.52)

// Coordinate helpers
function px(normalizedX, normalizedY) {
  return [normalizedX * W, normalizedY * H]
}

// Node positions are stored as normalized [0,1] coordinates
// to remain responsive across screen sizes
```

---

## 8. Interaction Spec

| Event | Behavior |
|---|---|
| Click on node | `sel = node`, open detail panel with slide-in animation |
| Click on empty canvas | `sel = null`, close detail panel |
| Hover over node | Cursor → `pointer` |
| Hover over empty canvas | Cursor → `default` |
| "DEEP ANALYSIS" button | `sendPrompt(...)` with node context |
| Panel `×` button | Close panel, `sel = null` |
| Window resize | Cancel animation frame, resize canvas, restart loop |

### Hit Test Radius
```
hitRadius = base_radius + 8   /* px — larger than visual for easier clicking */
```

---

## 9. View Switching (Tab Bar)

Two tabs at the top of the dashboard:

```
[ WORLD MAP ]   [ TOPIC GRAPH ]
```

Style:
- Active: border-bottom `2px solid #3a7ad4`, text `--text-primary`, weight 600
- Inactive: text `--text-muted`
- Font: monospace, `9px`, `letter-spacing: .12em`
- Transition: `0.2s`

Both views share the same detail panel component — panel content updates based on what was clicked (hub vs topic node).

---

## 10. Responsive Behavior

| Canvas width | Label visibility | Legend | Panel width |
|---|---|---|---|
| > 580px | Full labels, 9px | Visible | 264px |
| 400–580px | Smaller labels, 7.5px | Visible | 220px |
| < 400px | Labels hidden | Hidden | Full width overlay |

---

## 11. File Structure (suggested)

```
src/
  views/
    WorldMapView.tsx       ← Chaldeas world map canvas
    TopicGraphView.tsx     ← Research topic node graph
  components/
    DetailPanel.tsx        ← Slide-in detail panel (shared)
    HudOverlay.tsx         ← Corner brackets, status bars, clock
    TabBar.tsx             ← View switcher
    TopicPill.tsx          ← Tag/topic badge
    StatCard.tsx           ← Metric card (2-col grid item)
    EthicsLagBar.tsx       ← Two-segment timeline bar
  hooks/
    useHubData.ts          ← Hub/node data + WebSocket updates
    useAnimation.ts        ← rAF loop management
  styles/
    tokens.css             ← All CSS variables from Section 1–2
  types/
    hub.ts                 ← Hub / ResearchNode types
```

---

## 12. Data Types

```typescript
type ResearchStatus = 'weak' | 'rising' | 'mainstream' | 'displaced'

interface Hub {
  id: number
  name: string
  subtitle: string       // institution names
  region: string
  x: number              // normalized 0–1
  y: number              // normalized 0–1
  intensity: number      // 0–100
  topics: string[]
  papersK: number        // papers in thousands
  yoyGrowth: number      // % year-over-year
}

interface TopicNode {
  id: number
  label: string
  status: ResearchStatus
  x: number
  y: number
  radius: number
  growth: number         // 0–100
  ethicLag: number       // months
  socialPenetration: number  // 0–100
  influencedBy: string[]
  influences: string[]
}

interface Edge {
  source: number
  target: number
  weight: number         // 0–1, controls opacity/width
}
```

---

*This spec should be treated as a living document. Update version number on any breaking design change.*