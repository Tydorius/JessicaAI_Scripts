# Faction Management

A two-mode faction governance system for JessicaAI. Normal roleplay mode tracks stats invisibly while the story flows. Faction management mode (`/faction`) provides a full strategy interface with construction, recruitment, research, diplomacy, espionage, military operations, and resource management.

Designed for any scenario involving faction governance: kingdoms, merchant guilds, mercenary companies, criminal organizations, political parties, or corporate entities.

## Overview

- **Two-mode operation**: Seamless switch between narrative roleplay and strategy management
- **Project system**: 20 buildable structures with prerequisites, upgrade paths, and passive resource generation
- **Scalable project slots**: Start with 2 concurrent projects, upgrade to 4 then 6
- **Diplomacy**: Stance and treaty tracking for 6 rival factions (7 stance levels, 5 treaty types)
- **Resource management**: 5 resource types with passive generation and daily consumption
- **Population tracking**: 3 personnel types plus morale
- **7 faction stats**: Force, Security, Knowledge, Technology, Wealth, Reputation, Opposition
- **Stat keyword detection**: Normal roleplay actions automatically adjust stats
- **Day-based timeline**: Scripted story events trigger on specific days
- **Lore activation engine**: Keyword-triggered world context with cascading triggers
- **All state server-side**: No zero-width encoding, no stat parsing, no LLM dependence

## Quick Start

1. Copy `Faction_Management.js` into a JessicaAI Script on your Play
2. The script auto-initializes on first message
3. In normal mode, roleplay naturally — stats adjust based on keywords
4. Type `/faction` to enter management mode
5. Type `/help` in faction mode for command list
6. Type `/exit` to return to roleplay

## Modes

### Normal Mode (Default)

The script tracks faction stats invisibly. When the player describes actions in roleplay, keywords automatically adjust stats:

| Action Keywords | Stat Affected |
|----------------|---------------|
| train, recruit, mobilize | Force +1 |
| fortify, reinforce, secure | Security +1 |
| study, research, ritual | Knowledge +1 |
| invent, craft, engineer | Technology +1 |
| trade route, merchant, tax | Wealth +1 |
| diplomacy, negotiate, persuade | Reputation +1 |

Time progression keywords advance the day counter:
- "next day", "next morning", "dawn breaks" → +1 day
- "days later", "a week later" → +3 days

Optional stat display: `/showstats` (basic), `/showstats verbose` (full), `/hidestats` (hidden).

### Faction Mode

Type `/faction` to enter management mode. The output becomes a full status panel with stats, resources, personnel, active projects, and diplomacy. All commands are processed by the script.

Type `/exit` to return to normal roleplay.

## Commands (Faction Mode)

### Construction

| Command | Description |
|---------|-------------|
| `/build [project]` | Start a construction project |
| `/upgrade [building]` | Start an upgrade project |
| `/overview` | Display full faction status |

**Buildable projects**: base, barracks, watch, resource, workshop, supply, ward, vault, archive, trade hub, command, training, trade route

**Upgrades**: upgrade workshop, upgrade archive, upgrade supply, upgrade resource, upgrade barracks

### Recruitment

| Command | Description |
|---------|-------------|
| `/train [count] [type]` | Recruit personnel |

**Types**: soldiers (3 funds, 2 provisions each), operatives (1 fund, 1 provision), scholars (5 funds, 1 provision)

### Research

| Command | Description |
|---------|-------------|
| `/research [field]` | Invest in a stat |

**Fields**: knowledge/arcane (8 funds), technology (8 funds), security/defense (5 funds), force/military (5 funds)

### Diplomacy

| Command | Description |
|---------|-------------|
| `/diplomacy [faction] [action]` | Diplomatic action with a rival faction |

**Factions**: northern, eastern, mountain, forest, southern, underground

**Actions**: envoy (5 funds, +1 stance), threaten (-1 stance), treaty (8 funds, non-aggression pact), trade (5 funds, trade agreement), alliance (10 funds, military alliance), secret pact (8 funds)

| `/espionage [faction]` | Spy on a faction (5 funds) |

### Military

| Command | Description |
|---------|-------------|
| `/military [action]` | Military operation |

**Actions**: train (3 provisions, Force +1), patrol (1 provision, Security +1), raid [faction] (3 funds, 5 provisions, Force +3, relations -1)

### Management

| Command | Description |
|---------|-------------|
| `/manage [action]` | Internal management |

**Actions**: tax (+5 funds, -3 morale), ration (+3 provisions, -2 morale), feast (-3 funds, -5 provisions, +5 morale), festival (-5 funds, -8 provisions, +8 morale, +1 reputation)

### Turn

| Command | Description |
|---------|-------------|
| `/endturn` | Advance one day (processes project completion, resource generation, consumption) |

## Project System

Each project has a cost (deducted immediately) and a duration (in days). When `/endturn` advances the day, project elapsed time increases. When elapsed >= duration, the project completes and applies its effects.

### Project Effects

| Effect Type | Description |
|-------------|-------------|
| `statEffect` | Permanently increases stats on completion |
| `passiveGen` | Daily resource generation after completion |
| `popEffect` | Adds population units on completion |
| `special` | `slots4` or `slots6` increases concurrent project limit |

### Prerequisites

Some projects require a prerequisite building:

```
command_center → command_upgrade_1 (slots 4) → command_upgrade_2 (slots 6)
workshop → upgrade_workshop
archive → upgrade_archive
supply_depot → upgrade_supply
resource_site → upgrade_resource
expand_barracks → upgrade_barracks
```

### Daily Resource Cycle

When a day advances:
1. All projects progress; completed ones apply effects
2. Completed buildings generate passive resources
3. Provisions are consumed: Soldiers/5 + Operatives/10 + Scholars/8 per day
4. Diplomacy shifts based on Force and Reputation thresholds

## Stats Reference

| Stat | Range | Description |
|------|-------|-------------|
| Force | 0-99 | Military power |
| Security | 0-99 | Defensive capability |
| Knowledge | 0-99 | Arcane/academic power |
| Technology | 0-99 | Technological advancement |
| Wealth | 0-99 | Economic strength |
| Reputation | 0-99 | Standing in the region |
| Opposition | 0-99% | Active resistance against the faction |

### Resources

| Resource | Description |
|----------|-------------|
| Funds | Currency for most actions |
| Materials | Construction material |
| Arms | Weapons and military equipment |
| Supplies | Operational supplies |
| Provisions | Food (consumed daily by population) |

### Diplomacy

**Stances**: Unknown → Hostile → Unfriendly → Neutral → Cautious → Friendly → Allied → Vassal

**Treaties**: None, Non-Aggression Pact, Trade Agreement, Military Alliance, Vassalage, Secret Pact

### Passive Diplomacy Shifts

| Condition | Effect |
|-----------|--------|
| Force >= 50 | Dominant factions (0-3) become more hostile (-1 stance) |
| Force 30-49 | Marginalized factions (4-5) become friendlier (+1 stance) |
| Reputation >= 40 | Marginalized factions (4-5) become friendlier (+1 stance) |

## Customization

### Changing Stats and Resources

Edit the definition arrays at the top of the file:

```js
const STAT_NAMES = ["Force", "Security", "Knowledge", ...];
const STAT_DEFAULTS = [10, 25, 15, ...];

const RESOURCE_NAMES = ["Funds", "Materials", ...];
const RESOURCE_DEFAULTS = [15, 20, ...];
```

### Adding Projects

Add entries to `PROJECT_TABLE`:

```js
{
    id: "shipyard",
    name: "Build Shipyard",
    duration: 15,
    cost: { funds: 5, materials: 10, supplies: 3 },
    requires: null,
    statEffect: { Wealth: 5 },
    passiveGen: { Funds: 2 }
}
```

Add aliases for the `/build` command:

```js
const BUILD_ALIASES = {
    ...
    "shipyard": "shipyard", "dock": "shipyard", "port": "shipyard"
};
```

### Changing Rival Factions

Edit `NATION_TABLE`:

```js
const NATION_TABLE = [
    { id: 0, name: "The Empire", aliases: ["empire", "imperial"] },
    { id: 1, name: "Free Cities", aliases: ["cities", "free"] },
    ...
];
```

### Custom Lore Entries

Edit `LORE_ENTRIES` for normal-mode world context. Uses keyword matching with cascading triggers:

```js
{
    keywords: ["dragon", "wyrm"],
    priority: 10,
    scenario: " Dragons have been spotted in the northern mountains.",
    triggers: ["danger", "ancient"]
}
```

### Custom Timeline Events

Edit `TIMELINE`:

```js
{ day: 5, text: " [Event] A merchant caravan arrives seeking trade." },
{ day: 14, text: " [Event] War breaks out between the Northern Alliance and Eastern Federation." }
```

## Character Card Integration

```
{{char}} is the narrator for a faction management scenario.
In normal mode, narrate the story naturally. Faction stats are tracked invisibly.
When [FACTION STATS] appears, display those values as authoritative.
When [FACTION STATUS] appears (faction mode), present the full status panel
and process player commands, narrating the results.
[Faction Event] and [World Reaction] blocks should be woven into the narrative.
[Critical Alert] blocks indicate urgent situations requiring immediate attention.
```

## Comparison with JanitorAI Version

| Feature | JanitorAI | JessicaAI |
|---------|-----------|-----------|
| State persistence | Zero-width encoding (93 digit string) | `tools.game` / `tools.status` (structured JSON) |
| State encoding | Manual digit packing/unpacking | Direct API calls |
| LLM dependence | High (must reproduce state) | None (server-side) |
| Character card | Must include `[PERSISTENT MEMORY]` instructions | No special instructions needed |
| Stat parsing | None (internal tracking via ZW) | None (tools.status) |
| Output | `context.character.scenario +=` | `output =` |
| Code size | ~1180 lines | ~600 lines |
| State reliability | Fragile (LLM may fail to reproduce) | Guaranteed (server-side) |

## Memory Budget

This script uses JessicaAI's 4 KB persistent memory store. Usage breakdown:

| Category | Keys | Approximate Size |
|----------|------|-----------------|
| Stats (`stat.*`) | 7 | ~140 bytes |
| Resources (`res.*`) | 5 | ~100 bytes |
| Population (`pop.*`) | 4 | ~80 bytes |
| Diplomacy (`diplo.*`) | 6 | ~240 bytes |
| Projects | 1 (JSON array) | ~100-300 bytes |
| Buildings | 1 (JSON array) | ~100-400 bytes |
| Mode/Day/Slots/Display | 4 | ~60 bytes |
| Flags | 1 | ~20 bytes |
| **Total** | ~29 keys | ~840-1340 bytes |

Well within the 4 KB / 32-key limit. If you add many more stats, resources, or factions, monitor usage.

## Limitations

- **Command parsing is regex-based**: Commands must start with `/`. Free-text actions in faction mode are not parsed.
- **Single output**: All status and results go to the 4,000 character output. Very large status panels (many projects, all diplomacy lines) may approach the limit.
- **No combat simulation**: Military actions adjust stats but don't simulate battles. Use the Dice Controller for tactical combat.
- **Diplomacy is abstract**: Stance changes are immediate (+/-1). There's no multi-turn negotiation process.
- **Population is simplified**: No aging, training time, or casualty simulation. Recruiting is instant.
- **Memory namespace**: Uses `stat.*`, `res.*`, `pop.*`, `diplo.*` prefixes. Avoid these if combining with other scripts that use the same prefixes.
