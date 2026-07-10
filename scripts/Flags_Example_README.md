# Flags Example

A branching narrative template demonstrating JessicaAI's native flag and quest APIs for story progression, content gating, and branching outcomes.

## Overview

This example implements a complete short mystery story where:

- Player **actions set flags** that persist across turns
- Flags **gate content** — scenes, dialogue, and clues only appear when the right flags are set
- Flags **block progress** — locked doors require the right flag
- The story **branches** based on the player's moral choices
- Quest stages track the **current story beat**
- The LLM receives **progress guidance** so it knows what to narrate next

All state is server-side via `tools.game.flag()` and `tools.quest.set()` — no visible stat blocks, no hex encoding, no dependence on LLM cooperation.

## Quick Start

1. Copy `Flags_Example.js` into a JessicaAI Script on your Play
2. Start chatting — the script initializes the story on first run
3. The player naturally explores: visit the tavern, hear a rumor, investigate, make choices

## The Pattern

This script demonstrates the core flag-driven narrative pattern:

```
1. Detect trigger in player message → set a flag
2. Check flags → gate content (inject scenes, guidance, or blocks)
3. Check quest stages → track story progress
4. Emit progress guidance → tell the LLM what should happen next
```

### Setting Flags

Flags are set when the player does something significant:

```js
// Player mentioned the tavern for the first time
if (text.includes("tavern") && !tools.game.hasFlag("visited_tavern")) {
    tools.game.flag("visited_tavern");
}
```

### Gating Content

Content only appears when prerequisite flags are set:

```js
// Only show this scene if the player heard the rumor but hasn't investigated yet
if (tools.game.hasFlag("heard_rumor") && !tools.game.hasFlag("investigated_quarter")) {
    parts.push("[SCENE] Rumors swirl about people vanishing...");
}
```

### Blocking Progress

Locked content requires specific flags:

```js
if (text.includes("unlock")) {
    if (tools.game.hasFlag("has_key")) {
        tools.game.flag("door_unlocked");
    } else {
        parts.push("[BLOCKED] The door is locked. The player needs a key.");
    }
}
```

### Branching Choices

Mutually exclusive flags create branches:

```js
// Player can spare OR kill, but not both
if (!tools.game.hasFlag("spared_antagonist") && !tools.game.hasFlag("killed_antagonist")) {
    if (text.includes("spare") || text.includes("mercy")) {
        tools.game.flag("spared_antagonist");
        tools.quest.set("mystery", "resolved_spare");
    }
    if (text.includes("kill") || text.includes("execute")) {
        tools.game.flag("killed_antagonist");
        tools.quest.set("mystery", "resolved_kill");
    }
}
```

### Progress Guidance

The script tells the LLM what beat comes next:

```js
if (!tools.game.hasFlag("visited_tavern")) {
    // Story hasn't begun
    guidance = "Guide the player toward the tavern.";
} else if (!tools.game.hasFlag("heard_rumor")) {
    // Player is in the tavern, needs the hook
    guidance = "Have an NPC mention disappearances.";
}
// ...etc
```

## The Example Story

The script implements a mystery narrative:

```
arrive_at_tavern
    ↓ (visit the tavern)
visit_tavern [FLAG]
    ↓ (talk to bartender)
met_bartender [FLAG]
    ↓ (hear about disappearances)
heard_rumor [FLAG] → quest: rumor_heard
    ↓ (investigate the old quarter)
investigated_quarter [FLAG] → quest: clue_found
    ↓ (find the key)
has_key [FLAG]
    ↓ (unlock the door)
door_unlocked [FLAG] → quest: lair_found
    ↓ (enter the cellar)
confronted_antagonist [FLAG] → quest: confrontation
    ↓ (player chooses)
    ├─ spared_antagonist [FLAG] → quest: resolved_spare
    └─ killed_antagonist [FLAG] → quest: resolved_kill
    ↓
quest: complete → achievement_complete [FLAG]
```

## Output Format

Each turn the script emits:

```
[STORY STATE]
Quest: complete
Mystery: resolved_spare
Flags: story_started, visited_tavern, met_bartender, heard_rumor, ...
Guidance: The story is complete — reflect on the player's choices.

[EVENT] The player shows mercy. The antagonist surrenders...

[SCENE] The antagonist was spared. The town is safe...

[ACHIEVEMENT] Mystery Solved — The disappearances have been resolved.
```

## Tools Used

### Flags (`tools.game`)

```js
tools.game.flag("found_key");          // set
tools.game.hasFlag("found_key");       // check → boolean
tools.game.unsetFlag("found_key");     // remove
tools.game.flags();                    // list all → string[]
```

Flags are boolean — they're either set or not. Use them for one-time events, visited locations, met NPCs, discovered clues, and binary choices.

### Quests (`tools.quest`)

```js
tools.quest.set("main", "chapter_2");  // set stage
tools.quest.get("main");               // read stage → string
tools.quest.clear("main");             // remove
tools.quest.list();                    // all quests → [{id, status}]
```

Quests hold string values — use them for story stages, chapter tracking, or multi-step progressions where you need to know the current step, not just whether it happened.

### Generic State (`tools.game.set/get`)

```js
tools.game.set("reputation", 50);          // store numbers, strings, objects
tools.game.get("reputation", 0);           // read with fallback
tools.game.inc("reputation", 10);          // increment numeric values
```

Use generic state when you need values beyond boolean (flags) or stage strings (quests).

## Customization

### Writing Your Own Story

1. Map out your story as a flowchart of flag-gated nodes
2. Define what triggers each flag (keywords in player messages)
3. Define what content each flag unlocks
4. Define blocking conditions (what flags are required to proceed)
5. Define branching choices and their consequences

### Adding More Quests

```js
tools.quest.set("side_hearthstone", "started");
// ... later ...
tools.quest.set("side_hearthstone", "found_card");
// ... later ...
tools.quest.set("side_hearthstone", "complete");
```

### Tracking Player Reputation

Use `tools.game.set/inc` for continuous values:

```js
// When player does something good
tools.game.inc("alignment", 5);

// When player does something bad
tools.game.inc("alignment", -5);

// Gate content based on alignment
const align = tools.game.get("alignment", 0);
if (align >= 20) {
    parts.push("[SCENE] NPCs greet the player warmly.");
} else if (align <= -20) {
    parts.push("[SCENE] NPCs eye the player with suspicion.");
}
```

## Character Card Integration

```
{{char}} is the narrator for an interactive mystery story.
Follow the [STORY STATE] block each turn to understand the current story
progress. The [GUIDANCE] line tells you what should happen next.

When [BLOCKED] appears, the player is trying to do something they can't yet —
describe why they can't and hint at what they need.

When [CHOICE] appears, present the choice clearly and wait for the player's
decision before continuing.

When [EVENT] appears, narrate what happened dramatically.
```

## Comparison with the JanitorAI Persistent Flags System

| Feature | JanitorAI | JessicaAI |
|---------|-----------|-----------|
| Flag storage | Visible `**FLAGS:** XX:XX:FF` hex string in AI output | Server-side `tools.game.flag()` |
| Persistence | Relies on LLM reproducing flag string | Automatic, tamper-proof |
| Anti-cheat | Required (users could forge flag strings) | Not needed (server-side) |
| Flag parsing | Regex from AI response | `tools.game.hasFlag()` |
| Flag setting | Instruct LLM to update flag string | Script sets flags from detected triggers |
| Complexity | ~500 lines of encoding/parsing/validation | Direct API calls |

## Limitations

- **Keyword detection is fuzzy**: This example uses simple `text.includes()` for trigger detection. For more robust matching, consider the Lorebook Engine's whole-word matching with suffix wildcards.
- **Single storyline**: The example has one main story. For multiple concurrent storylines, use separate quest IDs and flag namespaces (e.g., `vampire.*`, `thieves_guild.*`).
- **No undo**: Flags can be unset (`tools.game.unsetFlag()`), but the example doesn't implement undo. If you need branching that can reverse, check and unset flags at decision points.
