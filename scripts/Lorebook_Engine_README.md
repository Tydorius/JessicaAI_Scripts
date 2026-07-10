# Lorebook Engine

A dynamic, keyword-driven lorebook system for JessicaAI Scripts. The engine matches user messages against your lore entries, applies conditional gates, and injects matching content into the AI's system prompt each turn.

## Overview

The Lorebook Engine is the flagship template for this repository. It provides:

- **Keyword matching** with whole-word boundaries and suffix wildcards
- **Cascading triggers** — entries can emit tags that activate other entries
- **Conditional gates** — require/exclude words, tags, emotions, time ranges
- **Priority system** — important lore wins when the entry cap is reached
- **Shifts** — child entries that refine a parent entry after it fires
- **Entity DB** — define characters with aliases for automatic keyword expansion
- **Relationship triggers** — inject context when character pairs interact
- **Persistent memory** — turn count and fired tags survive between turns
- **JessicaAI lore integration** — supplements with `tools.lore.find()` results
- **`{{char}}` replacement** — tokens are swapped for the active character name

## Quick Start

1. Copy `Lorebook_Engine.js` into a JessicaAI Script on your Play
2. Scroll to the `[AUTHOR ENTRIES]` section
3. Replace the example entries with your own lore
4. Save and test

The engine runs automatically before each AI reply. Any non-empty output is injected into the system prompt inside `<script_context>` tags.

## Global Knobs

These settings appear at the top of the file:

```js
let DEBUG       = 0;     // 1 = emit [DBG] diagnostic lines in output
let APPLY_LIMIT = 6;     // max entries applied per turn
let USE_JESSICA_MEMORY = 1;      // 1 = persist turn count and tags
let USE_JESSICA_LORE_TOOL = 1;   // 1 = append tools.lore.find() results
let JESSICA_LORE_LIMIT = 2;      // max external lore matches (1-8)
```

### Tuning APPLY_LIMIT

This is the most important knob. It caps how many entries fire per turn, preventing context bloat. Higher-priority entries win when the limit is reached.

- **Conservative (token-saving):** 3-4
- **Default:** 6
- **Lore-heavy scenarios:** 8-10

## Entry Properties Reference

Every entry is a JavaScript object. Below is the full list of supported properties.

### Core Properties

| Property | Type | Description |
|----------|------|-------------|
| `keywords` | `string[]` | Words/phrases that trigger this entry. Matched against a joined window of recent messages using whole-word boundaries. |
| `tag` | `string` | Internal label. Never matched against text. Used as an activation target for `triggers`. |
| `triggers` | `string[]` | Tags to emit when this entry fires. Other entries with a matching `tag` will activate. |
| `personality` | `string` | Character guidance text. Prepended with a space (e.g., `" {{char}} is friendly."`). |
| `scenario` | `string` | Scene/scenario guidance text. Prepended with a space. |
| `priority` | `number` | 1-5 (default 3). Higher = selected first when APPLY_LIMIT is reached. |
| `probability` | `number\|string` | 0-1 or `"40%"`. Chance of activation when all other gates pass. |
| `group` | `string` | Mutual exclusion group. Only one entry per group applies per turn. |

### Text Gates

These check whether certain words are present or absent in the message window. All use whole-word matching.

| Property | Alias | Logic |
|----------|-------|-------|
| `requireAny` | `andAny` | At least one listed word must be present (OR) |
| `requireAll` | `andAll` | All listed words must be present (AND) |
| `requireNone` | `notAny`, `block` | None of the listed words may be present (NOT) |
| `notAll` | — | Reject only if all listed words are present simultaneously |

You can also use the bundled form:

```js
requires: { any: ["word1"], all: ["word2"], none: ["word3"] }
```

### Tag Gates

These check whether certain tags have been fired by other entries this turn.

| Property | Logic |
|----------|-------|
| `andAnyTags` | At least one listed tag must be active |
| `andAllTags` | All listed tags must be active |
| `notAnyTags` | None of the listed tags may be active |
| `notAllTags` | Reject only if all listed tags are active |

### Time Gates

| Property | Type | Description |
|----------|------|-------------|
| `minMessages` | `number` | Minimum user message count before this entry can fire |
| `maxMessages` | `number` | Maximum user message count after which this entry stops firing |

### Name Block

| Property | Description |
|----------|-------------|
| `nameBlock` | `string[]` — entry is blocked if the active character's name matches any listed name |

Useful for preventing self-referential loops: if the active character IS the innkeeper, an entry about "innkeeper" behavior can be blocked to avoid the character acting on their own mention.

### Shifts (Child Entries)

```js
{
  keywords: ["shop", "buy"],
  personality: " {{char}} describes the merchant's wares.",
  Shifts: [
    {
      keywords: ["potion"],
      probability: 1.0,
      personality: " {{char}} lists available potions."
    },
    {
      keywords: ["armor"],
      notAny: ["broken"],
      personality: " {{char}} describes the armor quality."
    }
  ]
}
```

Shifts are evaluated after the parent entry fires. Each shift has its own keywords, gates, probability, and output fields. Shifts can also emit triggers.

### Previous-Message Targeting

Add a `prev.` prefix to any text-matching property to check against the second-to-last message instead of the joined window:

```js
{
  'prev.keywords': ["question", "ask"],
  personality: " {{char}} should address the question from the previous turn."
}
```

Supported: `prev.keywords`, `prev.requireAny`/`prev.andAny`, `prev.requireAll`/`prev.andAll`, `prev.requireNone`/`prev.notAny`/`prev.block`, `prev.notAll`, `prev.requires`.

### Emotion Targeting

When emotion detection is available on the platform:

```js
{
  requireEmotion: "anger",
  blockEmotion: "fear",
  personality: " The user seems angry. React accordingly."
}
```

| Property | Description |
|----------|-------------|
| `requireEmotion` | Entry only fires if any listed emotion is detected |
| `blockEmotion` | Entry is blocked if any listed emotion is detected |

### Always-On Entries

An entry with no `keywords`, no `tag`, no `prev.keywords`, no `minMessages`, and no `maxMessages` fires every turn. Use for baseline voice or standing instructions.

## Keyword Matching Details

- **Whole-word matching:** `"sword"` matches "sword" and "Sword" but not "swordsmanship"
- **Suffix wildcards:** `"quest*"` matches "quest", "questing", "questline"
- **Normalization:** Text is lowercased, hyphens/underscores become spaces, punctuation is stripped
- **Multi-message window:** By default, the last 5 messages are joined into one text blob for matching. Override with `WINDOW_DEPTH_OVERRIDE` (1-10)

## Entity DB

Define characters with aliases and optional lore entries. When you use `"char.entityName"` as a keyword, it auto-expands to include the entity's name and all aliases.

```js
const ENTITY_DB = {
    "marcus": {
        gender: "M",
        aliases: ["marc", "the warrior"],
        lore: [
            {
                keywords: ["char.marcus"],
                personality: " Marcus is a brooding warrior."
            }
        ]
    },
    "elara": { gender: "F", aliases: ["el", "the mage"] }
};
```

### Gender and Pronouns

The engine tracks the last-mentioned entity by gender (M/F/N) and resolves pronouns (he/she/it/they) to the most recent entity of that gender. This powers the Relationship system.

## Relationship Triggers

When two defined entities are present in the scene AND specific tags have been fired, inject additional context.

```js
const RELATIONSHIP_DB = [
    {
        pair: ["marcus", "elara"],       // both must be present
        requireTags: ["yearning", "angst"], // all tags must be active
        injection: "[HISTORY] Marcus and Elara share a painful past.",
        group: "relationship_history"     // mutual exclusion
    }
];
```

For tags to be active, you need entries that emit them via `triggers`.

## Output Format

The engine produces structured output:

```
[CHARACTER GUIDANCE]
<accumulated personality text>

[SCENE / SCENARIO GUIDANCE]
<accumulated scenario text>

[RELATED LORE]
- entry_id: lore text from tools.lore.find()
```

All `{{char}}` tokens in your entry text are replaced with the active character's display name before output.

## Debug Mode

Set `DEBUG = 1` at the top of the file to emit diagnostic lines showing:

- Which entries hit, were filtered, or triggered
- Entity keyword expansions
- Relationship triggers that fired
- APPLY_LIMIT reached notifications

Debug lines appear at the end of the output as `[DBG]` prefixed text.

## Character Card Integration

No special character card setup is required for basic functionality. The engine handles everything through script output.

For best results, you may add behavioral guidance to your character card:

```
{{char}} should follow any [CHARACTER GUIDANCE] and [SCENE / SCENARIO GUIDANCE]
instructions that appear in the script context. These represent the current
narrative state and should shape responses naturally.
```

## How the Selection Pipeline Works

1. **Direct pass:** Every entry is checked for keyword/always-on activation. Hits that pass all gates are bucketed by priority and emit their triggers.
2. **Trigger pass:** Entries with a `tag` matching any emitted trigger are activated (if they pass gates). These can emit further triggers.
3. **Priority selection:** Entries are selected from highest priority (5) to lowest (1), respecting `APPLY_LIMIT` and mutual exclusion groups.
4. **Apply + shifts:** Selected entries' personality/scenario text is accumulated. Shifts are evaluated and applied.
5. **Post-shift triggers:** Any triggers emitted by shifts can activate additional entries.
6. **Relationship injections:** Entity pair + tag combinations are checked and injected.
7. **Lore supplement:** `tools.lore.find()` results are appended (if enabled).
8. **Flush:** All accumulated text is combined, `{{char}}` tokens replaced, and trimmed to 4,000 characters.

## Combining With Other Scripts

JessicaAI allows up to 5 scripts per Play. The Lorebook Engine works well alongside:

- **Dice Controller** — for action resolution
- **Game State Example** — for RPG stats and inventory
- **Multi-Character Manager** — for group scenarios

For tighter integration, use Script Bundles. Place the Lorebook Engine as `main.js` and other scripts as helper files. Helper files execute first and can expose functions that `main.js` calls.

## Limitations

- **Output cap:** 4,000 characters. Very large lorebooks may hit this limit. Reduce `APPLY_LIMIT` or write shorter entries.
- **Execution timeout:** 1,000 ms. Extremely large lore databases (hundreds of entries) should still be fine.
- **Memory budget:** Turn count and last-fired tags use the shared 4 KB memory store. Keep key names short.
- **No inter-script communication:** Each script's output goes independently to the system prompt. Scripts cannot read each other's output. Use Script Bundles for shared state.
