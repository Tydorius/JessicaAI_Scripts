# Investigation Template

A progressive disclosure system for mystery and investigation scenarios. Combines flag-gated content unlocking, timeline progression, hidden clues, and anti-omniscience design principles. Merges the JanitorAI Anti-Omniscience and TimeDelay templates into a single JessicaAI-native script.

## Overview

- **Flag-gated content**: Information is locked behind flags that the script sets when the player discovers things. Only discovered information is ever in the LLM's context.
- **Anti-omniscience design**: No meta-labels, no foreshadowing, explicit information boundary instructions. The LLM cannot reveal what hasn't been discovered.
- **Timeline progression**: In-game hour tracking advances as the player takes actions. Events trigger at specific times.
- **Canon count tracking**: Cumulative clue discoveries unlock hidden clues at higher thresholds.
- **Drop-in/drop-out entities**: Witnesses and locations activate when mentioned, with behavioral guidance that changes based on flag state.
- **Conditional branching**: Story outcomes change based on what the player accomplished before critical time thresholds.
- **Server-side state**: All flags, timeline, and clue counts use `tools.game` — no hex strings, no stat parsing, no anti-cheat, no LLM dependence.

## Quick Start

1. Copy `Investigation_Template.js` into a JessicaAI Script on your Play
2. Edit the `[FLAG TRIGGER DEFINITIONS]` section to match your scenario
3. Edit the `[CONTENT NODES]` section with your investigation content
4. Edit the `[TIMELINE DEFINITIONS]` for your time-based events
5. Edit the `[DROP-IN/DROP-OUT ENTITIES]` for your NPCs

The included example is a bank robbery investigation. Replace it entirely with your own scenario.

## How It Works

### The Core Loop

```
1. Player message arrives
2. Script checks FLAG_TRIGGERS — did the player do something that sets a flag?
3. Script advances the TIMELINE if the player took a time-advancing action
4. Script evaluates CONTENT_NODES — which nodes' requirements are met?
5. Script checks ENTITIES — which NPCs are mentioned and available?
6. Script assembles output: status + guidance + events + timeline + facts + entities + anti-omniscience
7. Only discovered information reaches the LLM
```

### Flag Triggers

Flags are set by the **script**, not the LLM. The script detects keywords in the player's message and checks prerequisites:

```js
{
    keywords: ["thomas", "anderson", "security guard"],
    setsFlags: ["witness.thomas_interviewed"],
    requiresAll: ["bank.first_national_visited"],   // must have visited first
    requiresNone: ["witness.thomas_interviewed"],   // not already interviewed
    description: "The player interviews Thomas Anderson."
}
```

This is the key difference from the JanitorAI version: flags are reliable, server-side, and tamper-proof. No hex strings, no anti-cheat validation, no dependence on the LLM remembering to output a flag block.

### Content Nodes

Content is only injected when all requirements are met:

```js
{
    id: "thomas_account",
    requires: ["witness.thomas_interviewed"],
    content: " Thomas Anderson states: 'Three days ago, a man in a dark jacket was photographing the building exterior...'"
}
```

Requirement types:

| Requirement | Logic |
|-------------|-------|
| `requires: ["flag1", "flag2"]` | ALL flags must be set |
| `requiresAny: ["flag1", "flag2"]` | At least ONE flag must be set |
| `requiresNone: ["flag1"]` | None of these flags may be set |
| `minHour: 14` | In-game hour must be >= 14 |
| `minCanon: 3` | Cumulative clue count must be >= 3 |

### Timeline Progression

The in-game hour is tracked in `tools.game` and advances when the player takes actions:

```js
const TIME_ADVANCING_KEYWORDS = [
    { keywords: ["visit", "go to", "travel"], hours: 1 },
    { keywords: ["interview", "question", "speak with"], hours: 1 },
    { keywords: ["search", "examine", "investigate"], hours: 1 },
    { keywords: ["wait", "rest"], hours: 2 }
];
```

Timeline events provide contextual flavor:

```js
{
    minHour: 13,
    maxHour: 14,
    content: " It is nearly 2 PM. If the robbery has not been prevented, it may happen at any moment."
}
```

### Hidden Clues

Content nodes with `minCanon` requirements are hidden clues that only appear after the player has discovered enough other clues:

```js
{
    id: "hidden_sedan_detail",
    requires: ["witness.maria_interviewed"],
    minCanon: 3,  // only after 3+ total discoveries
    content: " On closer review, the silver sedan had a dealer plate frame from the warehouse district..."
}
```

This creates emergent connections that reward thorough investigation without the LLM knowing about them in advance.

### Conditional Branching

Content nodes can create branching outcomes based on what the player accomplished:

```js
// Only if orchestrator identified before 2 PM
{
    id: "robbery_prevented",
    requires: ["evidence.orchestrator_named"],
    minHour: 14,
    content: " The robbery was prevented because the orchestrator was identified in time."
}

// If the player visited Metro but didn't identify the orchestrator before 2 PM
{
    id: "robbery_occurred",
    requires: ["bank.metro_visited"],
    requiresNone: ["evidence.orchestrator_named"],
    minHour: 14,
    content: " The robbery was carried out at Metro Community Bank..."
}
```

### Drop-in/Drop-out Entities

NPCs activate when mentioned, with behavioral guidance that can change based on flags:

```js
{
    name: "Sarah Williams",
    keywords: ["sarah", "williams", "manager"],
    activeBehavior: " Sarah is stressed and evasive. She deflects questions.",
    requiresAll: ["bank.metro_visited"],
    requiresNone: ["witness.sarah_cooperative"],
    altBehavior: {
        requiresAll: ["witness.sarah_cooperative"],
        behavior: " Sarah is now cooperative and answers questions fully."
    }
}
```

### Anti-Omniscience Instructions

Every turn, the script injects explicit information boundary rules:

```
<INFORMATION BOUNDARIES>
1. Only reference details that have been explicitly stated or provided by the script.
2. Do not speculate about motives or plot developments unless discovered.
3. Each character knows only what they have personally experienced.
4. Acknowledge information gaps plainly rather than filling them with inference.
5. Do not hint at or foreshadow undiscovered information.
6. Do not label information as suspicious, significant, or misleading.
7. Environmental descriptions reflect only what is visible and known now.
</INFORMATION BOUNDARIES>
```

## Output Format

```
[INVESTIGATION STATUS]
Flags: bank.first_national_visited, bank.river_city_visited, witness.thomas_interviewed
Time: 10:00 AM (Hour 4)
Clues Discovered: 3
Case: OPEN

[GUIDANCE] Visited: First National, River City. Remaining: Metro Community.
All banks assessed. Interview witnesses at each location...

[DISCOVERY] The player interviews Security Guard Thomas Anderson.

[TIMELINE] It is late morning. The predicted robbery time of 2 PM is approaching...

[KNOWN FACTS]
An anonymous message was received: 'One of three banks will be robbed today...'
First National Bank security assessment: State-of-the-art camera system...
River City Savings security assessment: 1960s-era vault with manual locking...
Security Guard Thomas Anderson states: 'Three days ago, a man in a dark jacket...'

[CHARACTER: Thomas Anderson] Thomas Anderson is a professional security guard who speaks in direct, factual terms...

<INFORMATION BOUNDARIES>
{{char}} operates within strict information limits...
</INFORMATION BOUNDARIES>
```

## Configuration

### Global Knobs

```js
let DEBUG_MODE = 0;          // 1 = emit [DBG] diagnostic lines
let MAX_OUTPUT = 3500;       // output character cap (4000 is platform max)
let ANTI_OMNISCIENCE = 1;    // 1 = inject information boundary instructions
let TIMELINE_ENABLED = 1;    // 1 = track in-game hour progression
let CANON_TRACKING = 1;      // 1 = track cumulative clue discoveries
let HIDDEN_CLUES = 1;        // 1 = enable threshold-gated hidden clues
```

### Writing Your Own Scenario

1. **Map your investigation flow**: What clues exist? What flags unlock them? What are the prerequisites?
2. **Define flag triggers**: What player actions set each flag? What keywords indicate those actions?
3. **Write content nodes**: What information does each flag combination reveal? Follow the anti-omniscience rules.
4. **Define timeline events**: How does time pass? What happens at critical hours?
5. **Add entities**: Which NPCs can be interacted with? How does their behavior change?
6. **Add hidden clues**: What connections emerge after thorough investigation?
7. **Add conditional branches**: What happens if the player succeeds or fails at key moments?

## Character Card Integration

```
{{char}} is the narrator for an interactive investigation scenario.
Follow the [INVESTIGATION STATUS] to understand what has been discovered.
The [GUIDANCE] line indicates what the player should pursue next.
The [KNOWN FACTS] section contains only information the player has discovered —
do not reference information that does not appear there.
The <INFORMATION BOUNDARIES> rules are absolute — do not violate them.
```

## Comparison with JanitorAI Versions

| Feature | JanitorAI Anti-Omniscience | JanitorAI TimeDelay | JessicaAI Investigation |
|---------|---------------------------|---------------------|------------------------|
| Flag storage | Visible `**FLAGS:** XX:XX` hex string | Stat-parsed from AI output | `tools.game.flag()` server-side |
| Anti-cheat | Required (hex validation) | Not needed | Not needed (tamper-proof) |
| Timeline | `**Hour:** X` parsed from AI | Same | `tools.game.get("hour")` |
| Canon count | N/A | `**Canon Count:** X%` parsed | `tools.game.get("canon_count")` |
| Stat parsing | N/A | Regex from AI output | Not needed |
| Character card setup | Flag string instructions | Status block + canon protocol | None required |
| Hidden clues | N/A | `hiddenCondition` thresholds | `minCanon` thresholds |
| Conditional events | Flag-gated | Stat + message count gated | Flag + hour gated |
| LLM dependence | High (must reproduce flags) | High (must output stats) | None (script controls all state) |

## Limitations

- **Keyword detection is substring-based**: "thomas" matches anywhere in the message. For more robust matching, combine with the Lorebook Engine.
- **Linear timeline**: The hour only moves forward. For non-linear or time-travel scenarios, customize the timeline logic.
- **Single canon count**: All discoveries contribute to one counter. For multi-track investigations, use separate counters (e.g., `tools.game.get("canon_finance")`, `tools.game.get("canon_witnesses")`).
- **Output budget**: The investigation status + guidance + facts + entities + anti-omniscience instructions can approach the 4,000 character limit in complex scenarios. `MAX_OUTPUT` defaults to 3,500 to leave room. If you have many content nodes, consider prioritizing or adding a token budget system.
- **Memory budget**: Each flag uses a small amount of the 4 KB memory store. With 20-30 flags, this is well within limits.
