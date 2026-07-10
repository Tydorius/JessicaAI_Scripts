# JessicaAI_Scripts

Script templates for JessicaAI.online — JavaScript-enabled lorebooks that go beyond traditional JSON lorebooks and worldbooks.

## Scripts

### [Lorebook Engine](scripts/Lorebook_Engine.js) | [README](scripts/Lorebook_Engine_README.md)

Dynamic, keyword-driven lorebook system with cascading triggers, conditional gates, priority selection, entity aliases, relationship triggers, and persistent memory. The flagship template — start here.

### [Dice Controller](scripts/Dice_Controller.js) | [README](scripts/Dice_Controller_README.md)

Intercepts `/roll` commands and LLM `[ROLL:...]` requests, executes exact dice math, and injects authoritative results. Supports standard polyhedral dice, Savage Worlds (Aces, Wild Die), and D&D advantage/disadvantage/checks.

### [Game State Example](scripts/Game_State_Example.js) | [README](scripts/Game_State_Example_README.md)

A playable mini-RPG demonstrating every game-state tool: inventory, quests, stats, map movement, encounters, combat, and dice. Serves as both a learning resource and a starting template for game-like bots.

### [Flags Example](scripts/Flags_Example.js) | [README](scripts/Flags_Example_README.md)

A branching mystery narrative demonstrating the native flag and quest APIs for story progression, content gating, branching choices, and achievement tracking.

### [Multi-Character Manager](scripts/Multi_Character_Manager.js) | [README](scripts/Multi_Character_Manager_README.md)

Dynamically injects character context based on platform-tracked active characters and mention detection. Includes adaptive detail levels, relationship injections, and entrance/exit tracking.

### [Investigation Template](scripts/Investigation_Template.js) | [README](scripts/Investigation_Template_README.md)

A progressive disclosure system for mystery scenarios. Combines flag-gated content unlocking, timeline progression, hidden clues, and anti-omniscience design principles. Merges the Anti-Omniscience and TimeDelay templates into one JessicaAI-native script.

### [Token Context Manager](scripts/Token_Context_Manager.js) | [README](scripts/Token_Context_Manager_README.md)

A budget management utility for Script Bundles. Provides token estimation, detail-level selection (full/limited/summary), user-configurable presets (`/budget high|medium|low`), and budget-aware output assembly. Designed as a helper file that exposes functions to `main.js`.

### [Faction Management](scripts/Faction_Management.js) | [README](scripts/Faction_Management_README.md)

Two-mode faction governance system. Normal roleplay mode tracks stats invisibly; `/faction` mode provides a full strategy interface with construction, recruitment, research, diplomacy, espionage, military operations, and resource management. 20 buildable projects, 6 rival factions, 7 stats, 5 resources.

### [API Explorer](scripts/API_Explorer.js) | [README](scripts/API_Explorer_README.md)

A diagnostic script that introspects available JessicaAI APIs and outputs a summary. Type `/api` for a full report, or `/api tools`, `/api memory`, etc. for specific sections. Safe to leave attached — silent unless activated.

## Planning

- [`planning/scripting-api.md`](planning/scripting-api.md) — JessicaAI Script API reference
- [`planning/scripting-tools-guide.md`](planning/scripting-tools-guide.md) — Game tools guide (dice, inventory, quests, maps, combat)
- [`planning/migration-plan.md`](planning/migration-plan.md) — Full evaluation of JanitorAI Scripts and migration plan
- [`planning/JanitorAI_Scripts/`](planning/JanitorAI_Scripts/) — Archive of original JanitorAI Scripts
