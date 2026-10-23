---
name: "Kachi"
description: "Extracted visual system for the concept study desk"
colors:
  slate-1: "#fcfcfd"
  slate-2: "#f9f9fb"
  slate-12: "#1c2024"
  slate-11: "#60646c"
  slate-6: "#d9d9e0"
  teal-9: "#12a594"
  teal-10: "#0d9b8a"
  teal-11: "#008573"
  teal-12: "#0d3d38"
  teal-3: "#e0f8f3"
  iris-9: "#5b5bd6"
  iris-3: "#f0f1fe"
  ruby-11: "#ca244d"
  ruby-9: "#e54666"
  slate-5: "#e0e1e6"
  ruby-3: "#feeaed"
  slate-3: "#f0f0f3"
  amber-9: "#ffc53d"
  amber-11: "#ab6400"
  iris-11: "#5753c6"
  slate-7: "#cdced6"
  iris-12: "#272962"
  iris-2: "#f8f8ff"
  iris-7: "#b8baf8"
  iris-4: "#e6e7ff"
  teal-8: "#53b9ab"
  ruby-8: "#e592a3"
  iris-6: "#cbcdff"
  iris-5: "#dadcff"
  iris-1: "#fdfdff"
  iris-10: "#5151cd"
  iris-8: "#9b9ef0"
typography:
  display:
    fontFamily: "Avenir Next, PingFang SC, system-ui, sans-serif"
    fontSize: "40px"
  title:
    fontFamily: "Avenir Next, PingFang SC, system-ui, sans-serif"
    fontSize: "24px"
  body:
    fontFamily: "Avenir Next, PingFang SC, system-ui, sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "Avenir Next, PingFang SC, system-ui, sans-serif"
    fontSize: "12px"
rounded:
  lesson-row: "4px"
  choice: "6px"
  surface: "8px"
spacing:
  space-8: "8px"
  space-12: "12px"
  space-16: "16px"
  space-20: "20px"
  space-24: "24px"
  space-28: "28px"
  space-32: "32px"
components:
  learning-start-button:
    backgroundColor: "{colors.iris-9}"
    textColor: "{colors.iris-1}"
    padding: "16px 20px"
    height: "52px"
  learning-choices:
    padding: "0"
  g-search:
    typography: "{typography.label}"
  learning-unit:
    typography: "{typography.label}"
  nav:
    backgroundColor: "{colors.slate-1}"
    padding: "10px 20px max(10px, env(safe-area-inset-bottom))"
    height: "72px"
---

# Design System: Kachi

## Overview

**Creative North Star: "The Concept Study Desk"**

A focused study desk pairs a concrete question with an ordered curriculum. Iris identifies the learning task, Teal confirms understanding, and Ruby marks correction. Bilingual definitions remain readable together; progress sits beside the next lesson action.

This code-led scan uses src/learning.css as the final override layer, with inherited rules from src/styles.css. Local review captures provide visual evidence; there is no separate visual comp.

**Key Characteristics:**

- Semantic Radix colors
- Four-size hierarchy
- Flat working surfaces
- Original imagery

## Colors

### Primary

Iris identifies the main task, selection, and actions.

### Secondary

Teal and Ruby distinguish correct and incorrect responses; Iris and Teal distinguish compared definitions.

### Neutral

Slate steps 1–3 distinguish page, surfaces, and controls. Steps 6–8 mark boundaries; steps 11–12 supply ink.

**The Semantic Step Rule.** Use exact Radix values at their implemented semantic role; original raster content is outside the authored UI palette.

Frontmatter records the light implementation shown in reviewed captures. Additional imported Radix theme scales do not by themselves certify a reviewed dark interface.

## Typography

The frontmatter records the four-size hierarchy. Mobile headings reuse an existing size; weights and spacing distinguish roles without adding sizes. Minimum authored text is 12px. The Kachi wordmark retains Dela Gothic One at 24px. Final body/display stacks override the older Zen Maru stack. Original raster typography is outside this scale.

## Layout

The home app is capped at 1120px and fills 100dvh. Two columns pair a sticky question panel with the curriculum, each using 40px by 32px padding. Below 760px they stack with 28px by 24px padding. The bottom navigation stays in the app shell with safe-area padding. Other desktop screens are capped at 760px. Comparisons stack below 480px. The graph has a horizontally scrollable inner canvas at least 480px wide to preserve 12px labels.

## Elevation & Depth

Flat surfaces use tonal steps, rules, and whitespace. Final overrides remove decorative shadows and backdrop blur. The sidecar shadow vocabulary is empty. State motion is limited to 250ms ease-out where needed, including the inherited cubic-bezier easing recorded in the sidecar. Reduced-motion disables transitions and animation.

## Shapes

4px lesson rows, 6px answer choices, and an 8px shared surface radius. Main working regions stay rectangular. Authored boundaries use 0.5px strokes; visible keyboard focus is a distinct 2px outline, not a decorative border.

## Components

### Working surface

Answer choices use real course feedback. Native curriculum disclosures preserve prerequisites and disabled states. Comparisons pair Iris step 3/12 and Teal step 3/12; headings and secondary text inherit panel ink. Graph node hit targets are 24px with circular clipping; keyboard focus removes the clip and uses a thin outline. Preserve keyboard panning.

### Reusable controls

The sidecar contains a small set of source-derived actions, navigation, fields, and signature surfaces. Snippets preserve implemented states and CSS variable references; they illustrate appearance rather than application engines or full route behavior.

### Evidence and provenance

Sources: src/learning.css, src/styles.css, and src/radix.css. Desktop and mobile review captures were inspected. .impeccable/asset-provenance.json records original repository assets with source commit/path and SHA256, plus relevant licenses. Existing screenshots, icons, and game faces were preserved without recoloring. No new AI raster assets were introduced. Radix MIT attribution is adjacent to radix.css. These local observations make no live-deployment claim.

## Do's and Don'ts

### Do:

- Do use Radix steps 1–2 for backgrounds, 3–5 for interactive surfaces, 6–8 for boundaries, 9–10 for solid fills, and 11–12 for readable ink.
- Do preserve original assets and consult .impeccable/asset-provenance.json before changing imagery.
- Do keep at most four authored text sizes and preserve visible keyboard focus.
- Do remove nonessential motion when prefers-reduced-motion is active.

### Don't:

- Don't add decorative shadows, middle-dot separators, or redundant explanatory UI copy.
- Don't treat screenshot colors or embedded text as UI design tokens.
- Don't shrink graph or map labels to make content fit; preserve the implemented panning or adjacent category-list alternative.
