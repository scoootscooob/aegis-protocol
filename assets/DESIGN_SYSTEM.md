# Plimsoll Design System — Academic Brutalism

> A research paper you can ship. Blueprint precision meets venture-scale ambition.

---

## Color Palette

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| **Background** | `parchment` | `#FAF9F6` | All backgrounds. Never pure white. |
| **Background (alt)** | `parchment-200` | `#F4F3EE` | Cards, code blocks, subtle separation. |
| **Text** | `ink` | `#1A1918` | Body text, headings, borders. Never pure black. |
| **Text (muted)** | `ink-700` | `#2E2C2A` | Secondary text, captions, annotations. |
| **Accent** | `terracotta` | `#C84B31` | BLOCK verdicts, warnings, accent borders, CTAs. |

### Do Not

- Use pure white (`#FFFFFF`) or pure black (`#000000`)
- Use gradients of any kind
- Use drop shadows or glow effects
- Use any color outside the palette

---

## Typography

| Role | Font | Fallback Stack |
|------|------|----------------|
| **Headings** | Newsreader | EB Garamond, Georgia, serif |
| **Body / Code** | JetBrains Mono | Berkeley Mono, Fira Code, monospace |

### Type Scale

| Token | Size | Use |
|-------|------|-----|
| `hero` | 3.5rem | Page title, hero banner |
| `section` | 1.75rem | Section headings (H2) |
| `subsection` | 1.25rem | Sub-headings (H3) |
| `body` | 0.9375rem | Body text |
| `caption` | 0.8125rem | Annotations, table headers |
| `label` | 0.6875rem | Engineering labels, metadata |

---

## Geometry

| Property | Value |
|----------|-------|
| Border radius | `0` — always. No exceptions. |
| Border width | `1px` solid |
| Border color | `ink` (#1A1918) |
| Accent border | `terracotta` (#C84B31) |
| Grid unit | 40px (blueprint grid) |
| Page gutter | 24px |
| Frame margin | 32px |

### Engineering Drawing Conventions

- Corner marks at page edges (crosshair registration marks)
- Dimension lines for labeled measurements
- Title block in bottom-right (drawing number, revision, scale)
- Section references (SECTION A-A) for callouts
- Fine tick marks at grid intersections

---

## Tone of Voice

### The Manifesto Pattern

Open with an Anthropic-style introspective paragraph. First person plural. Past tense framing ("We set out to..."). End with a quiet challenge.

### Section Headers

Direct. No question marks unless rhetorical. Use the period-terminated fragment:

- "See It Break (Then See It Save)"
- "836 Tests. 5 Languages. Zero Failures."
- "Multi-Chain. Not Multi-Compromise."

### Code Comments

Use `// ──` comment dividers. Add explanatory comments above code blocks. The code should read like annotated research.

---

## Verdict Styling

| Verdict | Color | Border | Label |
|---------|-------|--------|-------|
| `BLOCK` | terracotta (#C84B31) | 1.5px terracotta | Red-orange monospace |
| `ALLOW` | ink (#1A1918) | 1px ink | Dark monospace |

---

## Assets

| Asset | File | Purpose |
|-------|------|---------|
| Hero Banner | `assets/plimsoll-blueprint.svg` | README hero, social preview |
| Terminal Demo | `demo/demo.tape` | VHS recording config (Rosé Pine Dawn) |
| Dashboard | `dapp/tailwind.config.ts` | Full Tailwind design token config |

---

## Implementation Checklist

- [x] SVG hero banner (research paper blueprint)
- [x] Mermaid.js architecture flowchart (academic palette)
- [x] VHS demo.tape (Rosé Pine Dawn, JetBrains Mono)
- [x] Tailwind config (full design token system)
- [x] README manifesto blockquote
- [x] Code snippet styling (annotated research comments)
- [x] Flat-square badges (ink/terracotta, no rounded)
- [ ] Dashboard components (Next.js + Tailwind implementation)
- [ ] Social preview image (1200x630 from SVG)
- [ ] Favicon (terracotta Plimsoll mark)
