/**
 * DICE CONTROLLER for JessicaAI
 *
 * Intercepts /roll commands from the player and [ROLL:...] requests from the LLM,
 * executes exact dice math, and injects formatted results for the LLM to narrate.
 *
 * Supports:
 *   - Standard polyhedral dice (d2-d100) with modifiers
 *   - Exploding dice / Savage Worlds Aces
 *   - Wild Die (Savage Worlds)
 *   - D&D advantage / disadvantage / check vs DC (via tools.dice when available)
 *
 * JessicaAI Inputs: last_message, last_messages, memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

// ============================================================================
// PLATFORM DETECTION
// ============================================================================
const HAS_TOOLS  = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);
const HAS_DICE   = (HAS_TOOLS && tools.dice && typeof tools.dice.roll === "function");

// ============================================================================
// MESSAGE ACCESS
// ============================================================================
const userMessage = (typeof last_message === "string") ? last_message : "";

const messages = (typeof last_messages !== "undefined" && Array.isArray(last_messages))
    ? last_messages
    : (HAS_TOOLS && tools.chat && typeof tools.chat.recent === "function")
      ? (function() { try { return tools.chat.recent(10) || []; } catch(e) { return []; } })()
      : [];

// Find the last assistant message for LLM roll requests
let llmMessage = "";
for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === "assistant") {
        llmMessage = msg.content || "";
        break;
    }
}
// Fallback: if no role-tagged assistant message, try second-to-last message
if (!llmMessage && messages.length >= 2) {
    const prev = messages[messages.length - 2];
    llmMessage = (prev && (prev.content || prev.message)) || "";
}

// ============================================================================
// DICE ROLLING ENGINE
// ============================================================================

/**
 * Roll a single die with optional exploding (Savage Worlds Aces).
 * Returns { total, log } where log is an array of individual rolls.
 */
function rollDie(faces, explode) {
    let total = 0;
    let current = 0;
    let log = [];

    do {
        current = Math.floor(Math.random() * faces) + 1;
        log.push(current);
        total += current;
    } while (explode && current === faces && faces > 1);

    return { total, log };
}

/**
 * Format a die roll log as a display string.
 * Exploding rolls show the chain: [8, Aced! -> 3]
 */
function formatLog(log, explode) {
    if (log.length === 1) return `[${log[0]}]`;

    let parts = [];
    for (let i = 0; i < log.length - 1; i++) {
        parts.push(log[i] + ", Aced! -> ");
    }
    parts.push(log[log.length - 1]);
    return `[${parts.join("")}]`;
}

/**
 * Execute a full roll: trait dice + optional wild die + modifier.
 * Returns formatted output lines.
 */
function executeRoll(label, count, faces, modifier, wildDie, explode) {
    let lines = [`- ${label}:`];
    let traitTotals = [];
    let highestTrait = 0;

    for (let i = 0; i < count; i++) {
        const result = rollDie(faces, explode);
        const dieLabel = `d${faces}${explode ? "!" : ""}`;
        lines.push(`  > Trait Die (${dieLabel}): ${formatLog(result.log, explode)} = ${result.total}`);
        traitTotals.push(result.total);
        if (result.total > highestTrait) highestTrait = result.total;
    }

    let wildTotal = 0;
    if (wildDie) {
        const result = rollDie(6, explode);
        lines.push(`  > Wild Die (d6${explode ? "!" : ""}): ${formatLog(result.log, explode)} = ${result.total}`);
        wildTotal = result.total;
    }

    let finalResult = 0;
    let resultString = "";

    if (wildDie) {
        let best = Math.max(...traitTotals, wildTotal);
        finalResult = best + modifier;
        let modStr = modifier !== 0 ? ` ${modifier > 0 ? "+" : ""}${modifier} (Mod)` : "";
        resultString = `${best} (Highest)${modStr} = ${finalResult}`;
    } else {
        let sum = traitTotals.reduce((a, b) => a + b, 0);
        finalResult = sum + modifier;
        let modStr = modifier !== 0 ? ` ${modifier > 0 ? "+" : ""}${modifier} (Mod)` : "";
        resultString = `${sum}${modStr} = ${finalResult}`;
    }

    lines.push(`  > Result: ${resultString}.`);
    return lines.join("\n");
}

/**
 * Parse a dice notation string into components.
 * Handles: NdX[!][+/-M][ -w]
 * Returns { count, faces, modifier, explode, wildDie } or null.
 */
function parseNotation(notation) {
    const regex = /([0-9]+)\s*d\s*([0-9]+)\s*(!)?(?:\s*([+-])\s*([0-9]+))?(?:\s+(-w))?/i;
    const match = notation.match(regex);
    if (!match) return null;

    const count = parseInt(match[1]) || 1;
    const faces = parseInt(match[2]) || 6;
    const explode = !!match[3];

    let modifier = 0;
    if (match[4] && match[5]) {
        modifier = parseInt(match[5]);
        if (match[4] === "-") modifier *= -1;
    }

    const wildDie = !!match[6];

    return { count, faces, modifier, explode, wildDie };
}

// ============================================================================
// PROCESS USER /roll COMMANDS
// ============================================================================
const userResults = [];
const userRollRegex = /\/roll\s+([0-9]+\s*d\s*[0-9]+\s*!?(?:\s*[+-]\s*[0-9]+)?(?:\s+-w)?)/gi;
let uMatch;
let uIndex = 1;

while ((uMatch = userRollRegex.exec(userMessage)) !== null) {
    const parsed = parseNotation(uMatch[1]);
    if (!parsed) continue;

    const label = `User Roll ${uIndex} (/roll ${uMatch[1].trim()})`;
    userResults.push(executeRoll(label, parsed.count, parsed.faces, parsed.modifier, parsed.wildDie, parsed.explode));
    uIndex++;
}

// ============================================================================
// PROCESS D&D ADVANTAGE/DISADVANTAGE/CHECK COMMANDS
// ============================================================================
const dndResults = [];

if (HAS_DICE) {
    // Advantage: /roll adv +3 or /roll advantage +3
    const advRegex = /\/roll\s+(?:adv|advantage)(?:\s*([+-])\s*([0-9]+))?/i;
    const advMatch = userMessage.match(advRegex);
    if (advMatch) {
        let mod = 0;
        if (advMatch[1] && advMatch[2]) {
            mod = parseInt(advMatch[2]);
            if (advMatch[1] === "-") mod *= -1;
        }
        try {
            const result = tools.dice.advantage(mod);
            dndResults.push(`- User Advantage (d20${mod !== 0 ? (mod > 0 ? "+" : "") + mod : ""}):\n  > [${result.rolls ? result.rolls.join(", ") : "?"}] -> Kept: ${result.total}`);
        } catch(e) {}
    }

    // Disadvantage: /roll dis +3 or /roll disadvantage +3
    const disRegex = /\/roll\s+(?:dis|disadvantage)(?:\s*([+-])\s*([0-9]+))?/i;
    const disMatch = userMessage.match(disRegex);
    if (disMatch) {
        let mod = 0;
        if (disMatch[1] && disMatch[2]) {
            mod = parseInt(disMatch[2]);
            if (disMatch[1] === "-") mod *= -1;
        }
        try {
            const result = tools.dice.disadvantage(mod);
            dndResults.push(`- User Disadvantage (d20${mod !== 0 ? (mod > 0 ? "+" : "") + mod : ""}):\n  > [${result.rolls ? result.rolls.join(", ") : "?"}] -> Kept: ${result.total}`);
        } catch(e) {}
    }

    // Check: /roll check dc15 +3 or /roll check 15 +3
    const checkRegex = /\/roll\s+check\s+dc?\s*([0-9]+)(?:\s*([+-])\s*([0-9]+))?/i;
    const checkMatch = userMessage.match(checkRegex);
    if (checkMatch) {
        const dc = parseInt(checkMatch[1]) || 10;
        let mod = 0;
        if (checkMatch[2] && checkMatch[3]) {
            mod = parseInt(checkMatch[3]);
            if (checkMatch[2] === "-") mod *= -1;
        }
        try {
            const result = tools.dice.check(mod, { dc: dc });
            const successStr = result.success ? "SUCCESS" : "FAILURE";
            dndResults.push(`- User Check (d20${mod !== 0 ? (mod > 0 ? "+" : "") + mod : ""} vs DC ${dc}):\n  > Rolled ${result.total} -> ${successStr}`);
        } catch(e) {}
    }
}

// ============================================================================
// PROCESS LLM [ROLL:...] REQUESTS
// ============================================================================
const llmResults = [];
const llmRollRegex = /\[ROLL:\s*([0-9]+\s*d\s*[0-9]+\s*!?(?:\s*[+-]\s*[0-9]+)?(?:\s+-w)?)\s*\]/gi;
let lMatch;
let lIndex = 1;

while ((lMatch = llmRollRegex.exec(llmMessage)) !== null) {
    const parsed = parseNotation(lMatch[1]);
    if (!parsed) continue;

    const label = `LLM Roll ${lIndex} (Action ${lIndex})`;
    llmResults.push(executeRoll(label, parsed.count, parsed.faces, parsed.modifier, parsed.wildDie, parsed.explode));
    lIndex++;
}

// ============================================================================
// BUILD OUTPUT
// ============================================================================

const hasRolls = userResults.length > 0 || llmResults.length > 0 || dndResults.length > 0;

let output = "";

// --- Dice resolution block (only if rolls occurred) ---
if (hasRolls) {
    output += "[SYSTEM: DICE RESOLUTION]\n";

    if (userResults.length > 0) {
        output += "USER ROLLS (Chronological):\n" + userResults.join("\n") + "\n\n";
    }

    if (dndResults.length > 0) {
        output += "D&D ROLLS:\n" + dndResults.join("\n") + "\n\n";
    }

    if (llmResults.length > 0) {
        output += "LLM ROLLS (Chronological):\n" + llmResults.join("\n") + "\n\n";
    }

    output += "[SYSTEM: Map LLM Rolls to your previous actions in order. Map User Rolls to the user's intended actions. Evaluate successes and raises based on the active ruleset. Narrate the outcome based on these authoritative results.]";
}

// --- Always-on instruction block ---
output += `

[DICE SYSTEM]
The player can roll dice using /roll commands (e.g., /roll 1d20, /roll 2d6+3, /roll 1d8! -w).

You may also request dice rolls by embedding a roll request tag in your response:
  [ROLL: NdX+M]
Examples:
  [ROLL: 1d20+3]     — one d20 with +3 modifier
  [ROLL: 2d6]         — two six-sided dice
  [ROLL: 1d8!+2]      — exploding d8 (Savage Worlds Ace) with +2
  [ROLL: 1d6+1 -w]    — d6 with Wild Die and +1

The system will execute your roll request on the next turn and provide authoritative results. When [SYSTEM: DICE RESOLUTION] appears, those numbers are final — do not substitute your own random values.

Savage Worlds Mechanics (when using ! and/or -w):
  - Trait Die + Wild Die (d6): take the higher result.
  - Exploding (Aces): reroll and add whenever you roll the max face value.
  - Target Number: 4 is standard; each full 4 points over is a Raise.
  - Critical Failure: both Trait Die and Wild Die roll a natural 1.
[/DICE SYSTEM]`;
