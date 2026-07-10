# Token Context Manager

A budget management utility for JessicaAI Script Bundles. Helps scripts stay within the 4,000-character output limit by providing token estimation, detail-level selection, and budget-aware output assembly. Designed to run as a helper file in a multi-file bundle.

## Overview

- **Character/token estimation**: Utility functions for measuring output size
- **Three budget presets**: High (fewer, richer entries), Medium (balanced), Low (more, shorter entries)
- **User commands**: Players can set detail preference via `/budget high|medium|low`
- **Detail-level selection**: Automatically degrades entry detail (full → limited → summary) based on remaining budget and entry priority
- **Budget-aware assembly**: Builds output from multiple items, fitting as many as possible within the limit
- **Smart trimming**: Cuts at sentence or word boundaries when needed
- **Priority weighting**: Higher-priority entries keep full detail longer

## Quick Start

### As a Bundle Helper File

1. Create a Script Bundle (in the JessicaAI Script editor, use `+ File`)
2. Add `Token_Context_Manager.js` as a helper file
3. Create or rename your main script as `main.js`
4. The helper executes first and exposes functions to `main.js`

### Minimal Usage in main.js

```js
// main.js — runs after Token_Context_Manager.js

const items = [
    {
        priority: 5,
        full: " Detailed description of the capital city with history and atmosphere.",
        limited: " The capital is a large, bustling city.",
        summary: " Capital: large city."
    },
    {
        priority: 3,
        full: " The Dark Forest is a dangerous woodland on the eastern border...",
        limited: " The Dark Forest is dangerous and unexplored.",
        summary: " Dark Forest: dangerous."
    }
];

output = buildOutput(items, "[WORLD CONTEXT]", null, "\n\n");
```

### With Command Handling

```js
// main.js

// Check if user issued a /budget command
const cmd = getCommandOutput();
if (cmd) {
    output = cmd;
} else {
    // Normal output
    output = buildOutput(myItems);
}
```

## How It Works

### Budget Levels

The user controls the overall approach via chat commands:

| Level | Command | Effect |
|-------|---------|--------|
| High | `/budget high` | Fewer entries (max 8), each at full detail. Prioritizes depth. |
| Medium | `/budget medium` | Balanced (max 12 entries, default). |
| Low | `/budget low` | More entries (max 20), each at reduced detail. Prioritizes breadth. |

The level persists in `memory` across turns.

### Detail Selection

Each entry can have three versions. The manager selects which to use based on:

1. **Remaining budget** — how much space is left
2. **Entry priority** — higher priority entries get a threshold boost
3. **Budget preset thresholds** — defined per level

```
Remaining budget: 80% → all entries at "full"
Remaining budget: 50% → priority 5 entries at "full", priority 3 at "limited"
Remaining budget: 20% → most entries at "summary"
```

Priority adjustments (±0.2 for priority 1-5):
- Priority 5: gets +0.2 to thresholds (stays full longer)
- Priority 3: no adjustment (baseline)
- Priority 1: gets -0.2 (degrades to summary first)

### Output Assembly

The `buildOutput()` function:

1. Sorts items by priority (descending)
2. Iterates, selecting the best detail level each item can afford
3. Skips items that don't fit even at summary level
4. Stops when max entries is reached or budget is exhausted
5. Assembles with prefix/suffix/separator
6. Hard-caps at 4,000 characters

## Function Reference

### estimateTokens(text)

Estimates token count (~4 chars/token).

```js
const tokens = estimateTokens("Hello world");  // → 3
```

### estimateChars(text)

Returns character length.

```js
const chars = estimateChars("Hello world");  // → 11
```

### getEffectiveMaxChars()

Returns the character budget, adjusted for the current budget level.

```js
const max = getEffectiveMaxChars();  // → 3230 (medium: 3800 * 0.85)
```

### getMaxEntries()

Returns the max entries allowed by the current budget level.

```js
const max = getMaxEntries();  // → 12 (medium)
```

### selectDetail(entry, remainingChars)

Returns the best text version for an entry given remaining budget.

```js
const text = selectDetail(
    { priority: 5, full: "...", limited: "...", summary: "..." },
    2000  // remaining chars
);
```

### buildOutput(items, prefix, suffix, separator)

Assembles budget-aware output from multiple items.

```js
const result = buildOutput(
    items,           // array of { priority, full, limited, summary }
    "[HEADER]",      // always included first
    "[FOOTER]",      // always included last
    "\n\n"           // separator between items (default)
);
```

### trimToBudget(text, maxChars)

Trims text to fit within a character limit, cutting at sentence or word boundaries.

```js
const trimmed = trimToBudget(longText, 500);
```

### getCommandOutput()

Returns the response text if the user issued a `/budget` command, or `null`. Check this in `main.js` and output it directly if non-null.

```js
const cmd = getCommandOutput();
if (cmd) {
    output = cmd;
    // Skip normal output this turn
}
```

## Entry Structure

Items passed to `selectDetail()` and `buildOutput()` should have:

```js
{
    priority: 1-5,        // optional, default 3. Higher = keeps detail longer.
    full: "Full text",    // most detailed version (~50-80 tokens)
    limited: "Limited",   // condensed version (~20-40 tokens)
    summary: "Summary"    // minimal version (~10-20 tokens)
}
```

Not all versions are required. If only `full` exists, it's always used. If `full` and `limited` exist but not `summary`, degradation stops at `limited`.

## User Commands

| Command | Effect |
|---------|--------|
| `/budget high` | Set detail level to high (fewer, richer entries) |
| `/budget medium` | Set detail level to medium (balanced, default) |
| `/budget low` | Set detail level to low (more, shorter entries) |
| `/budget status` | Display current budget settings |

These persist in `memory` and survive across turns.

## Configuration

Edit the top of `Token_Context_Manager.js`:

```js
let MAX_OUTPUT_CHARS = 3800;   // total budget (4000 is platform max)
const CHARS_PER_TOKEN = 4;     // estimation ratio

const BUDGET_PRESETS = {
    high:   { budgetMultiplier: 1.0,  fullThreshold: 0.7,  limitedThreshold: 0.35, maxEntries: 8  },
    medium: { budgetMultiplier: 0.85, fullThreshold: 0.5,  limitedThreshold: 0.2,  maxEntries: 12 },
    low:    { budgetMultiplier: 0.7,  fullThreshold: 0.3,  limitedThreshold: 0.1,  maxEntries: 20 }
};
```

### Tuning

- **Reduce `MAX_OUTPUT_CHARS`** if combining with other scripts that also produce output
- **Lower `maxEntries`** to ensure each entry gets more space
- **Raise `fullThreshold`** to make the manager more aggressive about degrading to limited/summary
- **Adjust `CHARS_PER_TOKEN`** if your content is significantly denser or sparser than average

## Combining With the Lorebook Engine

The most powerful use case is combining this with the Lorebook Engine in a bundle:

```
Bundle:
├── Token_Context_Manager.js   (executes first, exposes functions)
├── main.js                    (Lorebook Engine, uses budget functions)
```

In the Lorebook Engine's `main.js`, wrap the final output assembly:

```js
// Instead of:
// output = outputParts.join("\n\n").trim().slice(0, 4000);

// Use budget-aware building:
const loreItems = activatedEntries.map(e => ({
    priority: prio(e),
    full: e.personality_full || e.personality,
    limited: e.personality_limited || e.personality,
    summary: e.personality_summary || ""
}));

output = buildOutput(
    loreItems,
    outputParts.length > 0 ? outputParts.join("\n\n") : "",
    null,
    "\n\n"
);
```

## Comparison with JanitorAI Context Control

| Feature | JanitorAI | JessicaAI |
|---------|-----------|-----------|
| Architecture | Two-script broadcast/consume | Single bundle helper file |
| Communication | Zero-width encoded `[CONTEXT BUDGET]` block | Shared scope (functions) |
| State persistence | Zero-width encoding | `memory.get("budget.level")` |
| User control | `/maxtokens` slash command | `/budget high|medium|low` |
| Budget source | Model context window tiers | Fixed 4,000 char output cap |
| Allocation | `context_window * 0.10 / lorebook_count` | `MAX_OUTPUT_CHARS * preset.multiplier` |
| Detail levels | Full/Summary/Bullet | Full/Limited/Summary |
| Inter-script sharing | Parse `[CONTEXT BUDGET]` from scenario | Direct function calls in bundle |

## Limitations

- **Helper file only**: This script does not produce output directly. It must be part of a bundle with a `main.js` that calls its functions.
- **Estimation-based**: Token estimation uses ~4 chars/token. Actual tokenizer counts vary. This is accurate enough for budget management but not for precise token accounting.
- **No per-category budgets**: Unlike the JanitorAI Context Aware Multi-Character template, this does not support separate budgets per category (personality vs appearance vs scenario). All items share one global budget. If you need per-category budgets, extend the `buildOutput()` function.
- **Memory usage**: The budget level uses one memory key (`budget.level`). Minimal impact on the 4 KB store.
