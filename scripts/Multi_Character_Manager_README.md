# Multi-Character Manager

A JessicaAI Script that dynamically injects character context based on who is active and who is being discussed. Combines platform-tracked active characters with mention detection and optional adaptive detail levels for token management.

## Overview

- **Platform integration**: Reads active characters from `tools.state.activeCharacters()` and the character roster from `character.names`
- **Character profiles**: Each character has personality, appearance, and scenario text defined in-script
- **Mention detection**: Scans recent messages to determine who is being discussed
- **Sticky presence**: Characters remain "present" for a configurable number of turns after their last mention, smoothing over brief gaps
- **Adaptive detail levels**: When token budget is tight, higher-priority characters keep full detail while lower-priority ones degrade to limited or summary
- **Relationship injections**: When two characters are co-present, injects context about their dynamic
- **Entrance/exit tracking**: Reports when characters enter or leave the scene for narrative continuity

## Quick Start

1. Copy `Multi_Character_Manager.js` into a JessicaAI Script on your Play
2. Edit the `[CHARACTER PROFILES]` section to define your characters
3. Edit the `[RELATIONSHIPS]` section for character dynamics
4. Adjust `TOKEN_BUDGET` and other configuration knobs as needed

## Configuration

### Global Knobs

```js
let TOKEN_BUDGET = 1500;     // max characters (approx) for character output
let MENTION_DEPTH = 3;       // how many recent messages to scan for mentions
let STICKY_PRESENCE = true;   // keep characters present briefly after last mention
let STICKY_TURNS = 3;         // turns a character stays present without mentions
```

### Character Profiles

Each character has three detail levels. The budget system selects which level to use based on remaining space and the character's priority.

```js
{
    name: "Nadia",                        // must match platform character name
    aliases: ["nad", "captain"],          // additional names recognized in messages
    priority: 5,                          // 1-5, higher = keeps detail longer
    full: {                               // most detailed version (~50-80 tokens)
        personality: " Nadia is sharp-tongued...",
        appearance: " Sun-darkened skin...",
        scenario: " When Nadia is present..."
    },
    limited: {                            // condensed version (~20-40 tokens)
        personality: " Nadia is sharp-tongued and loyal...",
        appearance: " Dark skin, black hair, navy coat...",
        scenario: " Commands the room..."
    },
    summary: {                            // minimal version (~10-20 tokens)
        personality: " Captain Nadia: sharp-tongued, loyal.",
        appearance: " Dark skin, navy coat, cutlass.",
        scenario: " Commands respect."
    }
}
```

### Relationships

When two characters are both present, relationship context is injected:

```js
{
    pair: ["Nadia", "Corvin"],
    injection: "[RELATIONSHIP] Nadia trusts Corvin's skill but distrusts his secrecy.",
    priority: 4
}
```

Relationships are sorted by priority and only fire when both characters are present.

## How It Works

### Presence Detection

The script determines character presence through three signals:

1. **Platform active characters** (`tools.state.activeCharacters()`): The platform's own tracking of which characters are active in the Play
2. **Mention detection**: Scanning the last `MENTION_DEPTH` messages for character names and aliases
3. **Sticky presence** (optional): Characters who were recently mentioned stay present for `STICKY_TURNS` turns before fading

A character is considered present if they're mentioned in recent messages OR the platform reports them as active. Sticky presence extends this window.

### Adaptive Detail Levels

When `TOKEN_BUDGET` is set (not Infinity), the script allocates budget:

1. Present characters are sorted by priority (highest first)
2. The highest-priority character gets `full` detail if budget allows
3. As budget tightens, subsequent characters get `limited` or `summary` detail
4. Priority acts as a multiplier — higher-priority characters can "afford" full detail at lower remaining budgets

```
Priority 5 character: full detail even at 60% budget remaining
Priority 3 character: needs ~100% budget for full, degrades to limited quickly
Priority 1 character: gets summary almost always
```

### Entrance/Exit Tracking

The script stores presence state in `memory` (`mc.presence` key) and compares turn-to-turn. When a character transitions from absent to present, an `[ENTRANCE]` notice is emitted. When they leave, an `[EXIT]` notice appears. This helps the LLM narrate arrivals and departures smoothly.

## Output Format

With two characters present:

```
[MULTI-CHARACTER]
When multiple characters are present, distinguish them clearly through speech
patterns, mannerisms, and physical positioning...

[CHARACTER: Nadia (full)]
[PERSONALITY] Nadia is the captain of the Veiled Star. She is sharp-tongued...
[APPEARANCE] Nadia has sun-darkened skin, close-cropped black hair...
[SCENARIO] When Nadia is present, she commands the room...

[CHARACTER: Corvin (limited)]
[PERSONALITY] Corvin is the ship's surgeon — soft-spoken, morbidly curious...
[APPEARANCE] Tall, thin, spectacles, ink-stained fingers, stained apron.
[SCENARIO] Speaks in clinical terms. Fascinated by injuries.

[RELATIONSHIP] Nadia trusts Corvin's medical skill but distrusts his secrecy...
```

## Character Card Integration

```
{{char}} should portray all active characters naturally. Use the [CHARACTER]
blocks to inform each character's personality, appearance, and behavior.
When [RELATIONSHIP] context appears, let it shape interactions between the
named characters. [ENTRANCE] and [EXIT] notices indicate arrivals and
departures — narrate them smoothly.
```

## Combining With Other Scripts

The Multi-Character Manager pairs well with:

- **Lorebook Engine** — for world/scene context alongside character profiles
- **Dice Controller** — for multi-character combat resolution
- **Game State Example** — if characters have RPG stats

In a Script Bundle, the Multi-Character Manager can run as a helper file (e.g., `characters.js`) exposing functions to `main.js`.

## Comparison with JanitorAI Multi-Character Templates

| Feature | JanitorAI (Multi-Char) | JanitorAI (Context-Aware) | JessicaAI |
|---------|------------------------|---------------------------|-----------|
| Character roster | Hardcoded in script | Hardcoded in script | Platform + script |
| Active detection | Regex mention only | Regex mention only | `activeCharacters()` + mentions |
| Presence tracking | None (reactive) | None (reactive) | Persistent via `memory` |
| Detail levels | None | Full/limited/summary | Full/limited/summary |
| Budget system | None | Per-category + global | Global with priority weighting |
| Relationships | None | Pairwise | Pairwise with priority |
| Entrances/exits | None | None | Tracked and reported |
| Output | `context.character.personality +=` | `context.character.personality +=` | `output =` |

## Customization

### Adding a Character

Add a new entry to the `CHARACTERS` array:

```js
{
    name: "Vex",
    aliases: ["vexie", "quartermaster"],
    priority: 3,
    full: {
        personality: " Vex is the ship's quartermaster...",
        appearance: " Stocky, with a shaved head and gold earrings...",
        scenario: " Vex handles supplies and payroll..."
    },
    limited: { ... },
    summary: { ... }
}
```

The `name` should match what the platform reports. If your Play doesn't use platform multi-character, the script still works purely on mention detection.

### Disabling Budget Management

```js
let TOKEN_BUDGET = Infinity;  // always use full detail for all characters
```

### Adjusting Stickiness

For fast-paced scenes where characters come and go rapidly:

```js
let STICKY_PRESENCE = false;  // characters only present when mentioned this turn
```

For slow scenes where characters linger:

```js
let STICKY_TURNS = 8;  // characters stay present for 8 turns after last mention
```

## Limitations

- **Name matching is substring-based**: "Nad" will match "Nadia" in messages. This is intentional for alias support but can cause false positives if a character has a very short name. Use specific aliases to mitigate.
- **Budget is character-count-based, not true token count**: Estimation uses ~4 chars/token. Actual token usage varies by tokenizer.
- **Memory budget**: Presence data uses the shared 4 KB memory store. Each character entry is small (~50 bytes), so even 20 characters is fine.
- **No automatic character roster sync**: If you add or remove characters on the platform, update the `CHARACTERS` array in the script manually.
