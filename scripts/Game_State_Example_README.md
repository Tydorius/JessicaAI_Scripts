# Game State Example

A practical mini-RPG demonstrating every game-state tool available in the JessicaAI Script API. This is both a playable text adventure and a learning resource — each section is commented to show exactly which tool is being used.

## Overview

This example demonstrates:

- **`tools.game`** — flags and generic JSON state (first-run detection, entity names)
- **`tools.inventory`** — item counts (starting gear, loot pickup, quest item turn-in)
- **`tools.quest`** — quest statuses (main quest progression through stages)
- **`tools.status`** — RPG stats (HP, MP, gold, XP, level, enemy stats)
- **`tools.map`** — location tracking and movement over a script-provided world graph
- **`tools.encounter`** — weighted encounter and loot tables (random enemies, treasure)
- **`tools.combat`** — attack resolution with hit/damage calculation
- **`tools.dice`** — dice rolling (gold rewards)
- **`tools.random`** — probability checks (encounter chances, loot drops)

## Quick Start

1. Copy `Game_State_Example.js` into a JessicaAI Script on your Play
2. Start chatting — the script auto-initializes on first run

The script sets up a starting character and world, then reacts to player actions each turn.

## How It Works

### First-Run Initialization

On the very first message, the script checks `tools.game.hasFlag("started")`. If false, it initializes all state:

```js
tools.game.flag("started");              // mark as initialized
tools.status.set("hp", 20);              // RPG stats
tools.inventory.add("torch", 1);         // starting items
tools.quest.set("main", "explore_crossroads");  // starting quest
tools.map.setLocation("crossroads");     // starting location
```

All of this persists automatically across turns — no encoding, no LLM cooperation needed.

### World Map

The script defines a `WORLD` object with locations, descriptions, and exits:

```js
const WORLD = {
    crossroads: {
        name: "Crossroads",
        desc: "A dusty intersection of three roads.",
        exits: { north: "darkwood", east: "riverton", west: "old_mine" }
    },
    // ...
};
```

The map graph is provided by the script. JessicaAI only persists the current location via `tools.map.setLocation()` / `tools.map.location()`.

### Player Commands

| Action | Trigger Words | Effect |
|--------|--------------|--------|
| Move | "go north", "move east", "walk south" | Changes location via `tools.map.move()` |
| Attack | "attack", "fight", "strike" | Resolves combat via `tools.combat.attack()` |
| Search | "search", "look around", "examine" | Finds hidden items, loot rolls |
| Rest | "rest", "sleep", "camp" | Restores HP and MP to full |

### Random Encounters

When entering dangerous locations, there's a 35% chance of an encounter:

```js
if (tools.random.chance(0.35)) {
    const enemy = tools.encounter.roll([
        { id: "wolf", name: "Gray Wolf", hp: 6, ac: 12, weight: 50 },
        { id: "goblin", name: "Goblin Scout", hp: 8, ac: 10, weight: 30 },
        { id: "spider", name: "Giant Spider", hp: 5, ac: 14, weight: 20 }
    ]);
}
```

Higher `weight` = more common. Enemy stats are stored in `tools.status` so combat persists across turns.

### Combat Resolution

```js
const attack = tools.combat.attack(
    { attackBonus: 2, damage: "1d6+1" },   // attacker
    { ac: 10 }                               // defender AC
);

if (attack.hit) {
    tools.status.inc("enemy.hp", -attack.damage.total);
}
```

The `tools.combat.attack()` helper rolls a d20 + attackBonus against the defender's AC, then rolls damage if it hits. The script tracks enemy HP in `tools.status` so combat spans multiple turns.

### Quest Progression

Quests advance based on world state:

```js
// If player found the gem, update the quest
if (mainQuest === "explore_crossroads" && tools.game.hasFlag("found_gem")) {
    tools.quest.set("main", "return_gem");
}

// If player returned to town with the gem, complete it
if (mainQuest === "return_gem" && loc === "riverton" && tools.inventory.has("gem")) {
    tools.inventory.remove("gem", 1);
    tools.quest.set("main", "complete");
    tools.game.flag("quest_complete");
}
```

### Status HUD

Every turn, the script emits a game state block:

```
[GAME STATE]
Location: Crossroads
HP: 20/20 | MP: 10 | Gold: 5 | XP: 0 | Level: 1
Quest: explore_crossroads
Exits: north, east, west
Inventory: torch x1, bread x2, dagger x1
Scene: A dusty intersection of three roads.
```

## Tools Reference Summary

### tools.game — Flags and Generic State

```js
tools.game.flag("found_gem");              // set a flag
tools.game.hasFlag("found_gem");           // check a flag -> boolean
tools.game.unsetFlag("found_gem");         // remove a flag
tools.game.flags();                        // list all flags -> string[]
tools.game.set("enemy.name", "Goblin");    // store any JSON value
tools.game.get("enemy.name", "default");   // read a value
tools.game.inc("score", 10);               // increment a numeric value
```

### tools.status — RPG Stats

```js
tools.status.set("hp", 20);
tools.status.get("hp", 20);                // second arg is fallback
tools.status.inc("gold", 5);               // increment and persist
tools.status.inc("hp", -3);                // negative = decrement
tools.status.list();                       // all stats -> [{id, value}]
```

### tools.inventory — Items

```js
tools.inventory.add("torch", 2);
tools.inventory.remove("torch", 1);
tools.inventory.count("torch");            // -> number
tools.inventory.has("torch");              // -> boolean
tools.inventory.list();                    // -> [{id, count}]
```

### tools.quest — Quest Stages

```js
tools.quest.set("main", "find_castle");
tools.quest.get("main");                   // -> "find_castle"
tools.quest.clear("main");
tools.quest.list();                        // -> [{id, status}]
```

### tools.map — Location

```js
tools.map.location();                      // -> "crossroads"
tools.map.setLocation("riverton");
tools.map.exits(worldGraph);               // -> ["north", "east"]
tools.map.canMove("north", worldGraph);    // -> boolean
tools.map.move("north", worldGraph);       // -> { moved, location, direction }
```

### tools.encounter — Weighted Tables

```js
const enemy = tools.encounter.roll([
    { id: "wolf", hp: 6, weight: 50 },
    { id: "goblin", hp: 8, weight: 30 }
]);

const loot = tools.encounter.loot([
    { id: "gold", amount: 5, weight: 80 },
    { id: "potion", amount: 1, weight: 20 }
]);
```

### tools.combat — Attack Resolution

```js
const result = tools.combat.attack(
    { attackBonus: 3, damage: "1d8+2" },
    { ac: 12 }
);
// result.hit -> boolean
// result.damage.total -> number

tools.combat.damage("2d6+3");              // just roll damage
tools.combat.isDefeated({ hp: 0 });        // -> true
```

### tools.dice — Dice Rolling

```js
tools.dice.roll("2d6+3");                  // -> { expression, total, rolls, modifier }
tools.dice.d20(2);                         // 1d20+2
tools.dice.d6(2, 1);                       // 2d6+1
tools.dice.check(3, { dc: 15 });           // d20+3 vs DC 15 -> { ..., success }
tools.dice.advantage(2);                   // 2d20 keep highest +2
```

### tools.random — Probability

```js
tools.random.chance(0.35);                 // -> boolean (35% chance)
tools.random.pick(["sword", "shield", "potion"]);  // -> random item
```

## Character Card Integration

For best results, add RPG instructions to your character card:

```
{{char}} is the narrator and game master for a text-based RPG adventure.
Follow the [GAME STATE] block each turn to know the player's current stats,
location, inventory, and quest status. Describe the environment, narrate
combat outcomes from [COMBAT] blocks, and react to player actions using the
available exits and mechanics.

The player can:
- Move: "go north", "move east", etc.
- Attack: "attack the wolf"
- Search: "search the room", "look around"
- Rest: "rest", "sleep"
```

## Memory Budget

This script uses JessicaAI's 4 KB persistent memory store. The state is compact:

- Status values: ~8 entries (hp, max_hp, mp, gold, xp, level, enemy.hp, enemy.ac)
- Inventory: ~5 entries at start
- Game state: ~3 keys (started flag, enemy.name, found_gem flag)
- Quest: 1 entry

Total usage is well under the 4 KB / 32-key limit. If you extend this script with more items, enemies, or quests, monitor your memory usage.

## Customization

### Adding Locations

Add entries to the `WORLD` object:

```js
const WORLD = {
    // existing locations...
    castle_gate: {
        name: "Castle Gate",
        desc: "Iron gates tower above you. Guards watch from the battlements.",
        exits: { south: "crossroads", north: "castle_throne" }
    }
};
```

Then add exits from adjacent locations pointing to the new one.

### Adding Items

Items are just inventory IDs. Add them via `tools.inventory.add("potion", 1)` and check with `tools.inventory.has("potion")`. No registration needed.

### Adding Enemies

Extend the encounter table or create scripted encounters:

```js
if (loc === "castle_throne" && !tools.game.hasFlag("boss_dead")) {
    tools.status.set("enemy.hp", 30);
    tools.status.set("enemy.ac", 16);
    tools.game.set("enemy.name", "Dark Knight");
}
```

## Limitations

- **Single enemy at a time**: This example tracks one enemy in `tools.status`. For multiple enemies, use prefixed keys (`enemy1.hp`, `enemy2.hp`, etc.) or `tools.game.set("enemies", [...])`.
- **No save/load UI**: State persists in the chat session. Starting a new Play resets everything (first-run detection runs again).
- **Output budget**: The HUD + event messages use roughly 400-600 characters. Plenty of room remains within the 4,000 character limit.
