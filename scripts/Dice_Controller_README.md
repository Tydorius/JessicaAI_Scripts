# Dice Controller

A JessicaAI Script that intercepts `/roll` commands from the player and `[ROLL:...]` requests from the LLM, executes exact dice math, and injects authoritative results for the LLM to narrate.

## Overview

- **Player `/roll` commands**: Players type `/roll 2d6`, `/roll 1d8!+2 -w`, etc. and get mathematically accurate results
- **LLM roll requests**: The LLM can request dice rolls using visible `[ROLL: NdX+M]` tags in its responses; the system detects and executes them on the next turn
- **Savage Worlds support**: Exploding dice (Aces), Wild Die (d6, take highest with Trait Die), Raises, and Critical Failure detection
- **Standard dice support**: Any combination of d2, d4, d6, d8, d10, d12, d20, d100 with positive/negative modifiers
- **D&D advantage/disadvantage/check**: When `tools.dice` is available, supports `/roll adv`, `/roll dis`, and `/roll check dc15 +3`
- **Always-on instruction block**: A `[DICE SYSTEM]` block is injected every turn teaching the LLM the roll protocol

## Quick Start

### Step 1: Add the Script

Copy `Dice_Controller.js` into a JessicaAI Script on your Play. No customization required for basic usage.

### Step 2: Player Uses `/roll`

Players can roll dice at any time:

```
/roll 1d20
/roll 2d6+3
/roll 1d8! -w
```

The script detects the command, executes the roll with actual random number generation, and injects the results. The LLM then narrates the outcome.

### Step 3 (Optional): Character Card Instructions

For best results, add to your character card:

```
{{char}} uses the dice system for action resolution. When [SYSTEM: DICE RESOLUTION]
appears, the numbers are authoritative — do not substitute your own random values.
Narrate outcomes based on the provided results.
```

## How It Works

### User Command Processing

The script scans `last_message` for `/roll` commands:

```
/roll <count>d<faces>[!][+/-<mod>] [-w]
```

| Component | Syntax | Example |
|-----------|--------|---------|
| Count | Number of dice | `2` in `2d6` |
| Faces | Die type | `6` in `2d6` |
| Explode | `!` after faces | `1d8!` |
| Modifier | `+N` or `-N` | `+2` or `-3` |
| Wild Die | `-w` flag | `-w` |

Multiple `/roll` commands in a single message are all processed.

### LLM Roll Request Protocol

The LLM can request dice rolls by embedding tags in its response:

```
[ROLL: 1d20+3]
[ROLL: 2d6]
[ROLL: 1d8!+2]
[ROLL: 1d6+1 -w]
```

The script scans the LLM's previous response for these tags and executes them. Results appear in the next turn's `[SYSTEM: DICE RESOLUTION]` block.

The LLM is taught this protocol every turn via the always-on `[DICE SYSTEM]` instruction block.

### D&D Commands

When JessicaAI's `tools.dice` API is available, the script supports additional commands:

| Command | Description |
|---------|-------------|
| `/roll adv` or `/roll advantage +3` | Roll 2d20, keep highest |
| `/roll dis` or `/roll disadvantage +3` | Roll 2d20, keep lowest |
| `/roll check dc15 +3` | Roll d20+3 vs DC 15, report success/failure |

These use the platform's native `tools.dice.advantage()`, `.disadvantage()`, and `.check()` helpers.

### Result Injection

When rolls occur, the script outputs a `[SYSTEM: DICE RESOLUTION]` block containing:

- Individual die results with Ace chains shown as `[8, Aced! -> 3]`
- Wild Die results (when applicable)
- Final totals with modifiers
- Instructions telling the LLM how to narrate the results

## Output Format Example

When a user types `/roll 1d8!+2 -w`:

```
[SYSTEM: DICE RESOLUTION]
USER ROLLS (Chronological):
- User Roll 1 (/roll 1d8!+2 -w):
  > Trait Die (d8!): [8, Aced! -> 5] = 13
  > Wild Die (d6!): [3] = 3
  > Result: 13 (Highest) +2 (Mod) = 15.

[SYSTEM: Map LLM Rolls to your previous actions in order. Map User Rolls to the
user's intended actions. Evaluate successes and raises based on the active
ruleset. Narrate the outcome based on these authoritative results.]

[DICE SYSTEM]
The player can roll dice using /roll commands...
```

## Savage Worlds Mode

When a Wild Die (`-w`) or exploding dice (`!`) are used, the script operates in Savage Worlds mode:

**Trait Die + Wild Die**: Roll both the requested die and a d6 Wild Die. The higher of the two is used as the base result.

**Exploding (Acing)**: When a die rolls its maximum face value, roll it again and add the result. Continue until a non-maximum value is rolled.

**Target Number**: Standard TN is 4. Every 4 points above the TN is a Raise (e.g., a result of 12 vs TN 4 gives 2 Raises).

**Critical Failure**: If both the Trait Die and Wild Die roll a natural 1, it is a Critical Failure. The script reports the raw 1; the `[DICE SYSTEM]` instruction block tells the LLM to check for this condition.

## Command Reference

| Command | Description |
|---------|-------------|
| `/roll NdX` | Roll N dice with X faces |
| `/roll NdX!` | Exploding dice (reroll on max) |
| `/roll NdX+N` | Roll with positive modifier |
| `/roll NdX-N` | Roll with negative modifier |
| `/roll NdX -w` | Include Savage Worlds Wild Die |
| `/roll adv [mod]` | D&D advantage (2d20 keep highest) |
| `/roll dis [mod]` | D&D disadvantage (2d20 keep lowest) |
| `/roll check dcN [mod]` | D&D check vs DC N |

## Character Card Integration

### Minimal Setup

No character card changes are required. The script's always-on instruction block teaches the LLM everything it needs.

### Recommended Additions

For scenarios where dice are central to gameplay:

```
{{char}} resolves actions using the dice system. When the player describes an action
with uncertain outcome, {{char}} should:
1. Determine the appropriate die type based on the character's skill level
2. Consider modifiers based on circumstances
3. Wait for the player to /roll, or request a roll via [ROLL: NdX+M]
4. Narrate the outcome based on the authoritative dice results

Die types by skill level:
- Untrained: d4
- Novice: d6
- Competent: d8
- Expert: d10
- Master: d12
```

## Combining With Other Scripts

The Dice Controller works well alongside the Lorebook Engine. JessicaAI allows up to 5 scripts per Play, or combine them in a Script Bundle.

When combining, the Dice Controller's output appears alongside other scripts' output in the system prompt. The `[DICE SYSTEM]` and `[SYSTEM: DICE RESOLUTION]` tags help the LLM distinguish dice content from other guidance.

## Differences from the JanitorAI Version

| Feature | JanitorAI | JessicaAI |
|---------|-----------|-----------|
| State persistence | Zero-width Unicode encoding | Not needed (no visibility toggle) |
| LLM roll requests | 20-digit encoded string (zero-width or visible) | Simple `[ROLL: NdX+M]` notation tags |
| Visibility mode | Toggle between hidden/visible via zero-width | Visible mode only (simpler, more reliable) |
| D&D advantage/check | Not supported | Supported via `tools.dice` |
| Message access | `context.chat.last_messages[].message` | `last_messages[].content` |
| Output | `context.character.scenario +=` | `output =` |

## Limitations

- **One-turn delay for LLM requests**: The LLM requests a roll in turn N; the result appears in turn N+1. This is inherent to the script-runs-before-reply architecture.
- **Visible roll tags**: LLM roll requests appear as `[ROLL: NdX+M]` in the AI's response. This is intentional — it's part of the TTRPG experience. Users who want invisible requests can rely on player-initiated `/roll` commands only.
- **Output cap**: The instruction block and resolution block together use approximately 800-1000 characters of the 4,000 character limit. Plan accordingly when combining with other scripts.
