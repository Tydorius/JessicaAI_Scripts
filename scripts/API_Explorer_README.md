# API Explorer

A diagnostic script that introspects the available JessicaAI Script APIs and outputs a summary. Useful for debugging, discovering what data is available, and learning the API.

## Overview

- **On-demand activation**: Only outputs when the user types `/api` — silent otherwise
- **Full introspection**: Reports availability and sample data for every API namespace
- **Section filtering**: Query specific sections (`/api tools`, `/api memory`, etc.)
- **Live data**: Shows current memory contents, active characters, recent messages, stats, and more
- **Safe probing**: All API calls are wrapped in try/catch to prevent crashes

## Quick Start

1. Copy `API_Explorer.js` into a JessicaAI Script on your Play
2. Type `/api` in chat to see a full report
3. Type `/api tools` to see only the tools namespace, etc.

The script produces no output unless `/api` is typed, so it's safe to leave attached.

## Commands

| Command | Output |
|---------|--------|
| `/api` | Full report: globals, tools, memory, state, chat |
| `/api globals` | Global variables only (`last_message`, `character`, `scenario`, etc.) |
| `/api tools` | Full `tools.*` namespace introspection with live samples |
| `/api memory` | Memory store contents (keys, values, size) |
| `/api ltm` | Long-term memory snapshot |
| `/api state` | Character names, scenario text, active characters |
| `/api chat` | Recent message summary (roles, lengths, previews) |
| `/api emotions` | Detected emotions (if emotion detection is available) |

## What It Reports

### Global Variables

Checks availability and basic info for:
- `last_message` — character count
- `last_messages` — message count, user/assistant breakdown
- `character` — names array
- `scenario` — character count
- `output`, `memory`, `long_term_memory`, `tools`, `emotions`

### Tools Namespace

For each `tools.*` sub-namespace, reports which methods are available as functions:

| Namespace | Methods Probed |
|-----------|---------------|
| `tools.chat` | `recent()`, `lastUser()` |
| `tools.state` | `activeCharacters()`, `scenario()` |
| `tools.game` | `get()`, `set()`, `inc()`, `flag()`, `unsetFlag()`, `hasFlag()`, `flags()` |
| `tools.inventory` | `add()`, `remove()`, `count()`, `has()`, `list()` |
| `tools.quest` | `set()`, `get()`, `clear()`, `list()` |
| `tools.status` | `get()`, `set()`, `inc()`, `list()` |
| `tools.map` | `location()`, `setLocation()`, `exits()`, `canMove()`, `move()` |
| `tools.encounter` | `roll()`, `loot()` |
| `tools.combat` | `damage()`, `attack()`, `isDefeated()` |
| `tools.dice` | `roll()`, `d20()`, `advantage()`, `disadvantage()`, `check()` |
| `tools.random` | `pick()`, `chance()`, dice aliases |
| `tools.lore` | `find()` |

Where possible, it also calls safe read-only methods to show live sample data:
- `tools.chat.recent(3)` — previews of last 3 messages
- `tools.state.activeCharacters()` — current active character names
- `tools.game.flags()` — all set flags
- `tools.inventory.list()` — current inventory
- `tools.quest.list()` — current quests
- `tools.status.list()` — all tracked stats
- `tools.map.location()` — current location
- `tools.dice.roll("1d20")` — sample dice roll result

### Memory Store

Reports:
- Number of keys used (out of 32 max)
- Approximate bytes used (out of 4,096 max)
- All key-value pairs (values truncated to 60 chars)
- Last error if any

### State

Reports:
- `character.names` array
- `scenario` text with preview
- `tools.state.activeCharacters()` result

### Chat

Reports:
- Total `last_messages` count
- Per-message summary: index, role, character count, 50-char preview

## Use Cases

### Debugging a Script That Isn't Working

Attach the API Explorer alongside your other script. Type `/api tools` to verify which methods are available. Type `/api memory` to check if your script is storing data correctly.

### Learning the API

Type `/api` to see everything at once. The live sample data shows you exactly what each method returns.

### Checking Memory Usage

Type `/api memory` to see how much of your 4 KB budget you're using and which keys are stored.

### Verifying Character Setup

Type `/api state` to confirm the platform sees your character names and active characters correctly.

## Output Format

```
=== JessicaAI API Explorer ===

--- GLOBAL VARIABLES ---
last_message: available (15 chars)
last_messages: available (4 messages, 2 user, 2 assistant)
character: available (names: Nadia, Corvin)
scenario: available (450 chars)
output: available
memory: available
long_term_memory: available
tools: available

--- TOOLS API ---
tools.chat:
  .recent(limit)    : available
  .lastUser()       : available
  [recent(3) => 3 messages]
    user: 42 chars
    assistant: 380 chars
    user: 15 chars
tools.state:
  .activeCharacters(): available
  .scenario()        : available
  [activeCharacters() => Nadia, Corvin]
...

--- MEMORY STORE ---
Keys: 3 / 32
Size: ~145 / 4096 bytes

Entries:
  budget.level: medium
  mc.turn: 5
  mc.presence: {"Nadia":{"present":true,...
```

## Combining With Other Scripts

The API Explorer is safe to run alongside any other script. It only activates on `/api` commands and produces no output otherwise, so it won't interfere with other scripts' output.

## Limitations

- **Cannot use `eval`**: The sandbox blocks `eval`, so global variable detection is done by direct name checks rather than dynamic introspection.
- **Read-only**: The explorer only calls read-only methods. It never writes to memory, inventory, status, or flags (except the single `tools.dice.roll("1d20")` sample, which is stateless).
- **Output may exceed 4,000 chars**: The full `/api` report with many memory entries and tools data can approach the limit. Use section-specific commands (`/api tools`, `/api memory`) for focused output.
- **No `console.log`**: The sandbox doesn't expose `console.log` output to users. This script provides a user-facing alternative.
