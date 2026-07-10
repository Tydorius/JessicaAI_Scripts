/**
 * TOKEN CONTEXT MANAGER for JessicaAI
 *
 * A budget management utility designed to run as a helper file in a
 * JessicaAI Script Bundle. It exposes functions that main.js can call
 * to estimate, allocate, and trim output within the 4,000 character limit.
 *
 * HOW TO USE IN A BUNDLE:
 *   1. Add this file to your Script Bundle (it executes first as a helper)
 *   2. In main.js, call the exposed functions:
 *
 *      const budget = getBudget();            // remaining character budget
 *      const level  = selectDetail(entry);    // "full" | "limited" | "summary"
 *      const text   = buildOutput(items);     // budget-aware string assembly
 *
 *   3. Assign the final result to output:
 *
 *      output = buildOutput(myItems);
 *
 * USER COMMANDS:
 *   The user can set a global detail preference via chat commands:
 *     /budget high    — prioritize detail over breadth (keep fewer, richer entries)
 *     /budget medium  — balanced (default)
 *     /budget low     — prioritize breadth over detail (more, shorter entries)
 *     /budget status  — display current budget settings
 *
 * JessicaAI Inputs: last_message, memory, tools
 * JessicaAI Output: none directly (this is a helper file; main.js produces output)
 */


/* ============================================================================
   [SECTION] CONFIGURATION
   SAFE TO EDIT: Yes
   ========================================================================== */

// Total output budget. JessicaAI caps at 4,000 characters.
// Default leaves a small safety margin.
let MAX_OUTPUT_CHARS = 3800;

// Estimated characters per token (for token-based thinking)
const CHARS_PER_TOKEN = 4;

// Budget level presets: each defines how much of MAX_OUTPUT_CHARS is allocated
// and how aggressively detail is degraded.
const BUDGET_PRESETS = {
    high: {
        label: "high",
        budgetMultiplier: 1.0,     // use full MAX_OUTPUT_CHARS
        fullThreshold: 0.7,        // use "full" if >70% budget remains per entry
        limitedThreshold: 0.35,    // use "limited" if >35% remains
        maxEntries: 8,             // cap total entries (fewer, richer)
        description: "Prioritizes detail over breadth"
    },
    medium: {
        label: "medium",
        budgetMultiplier: 0.85,
        fullThreshold: 0.5,
        limitedThreshold: 0.2,
        maxEntries: 12,
        description: "Balanced detail and breadth"
    },
    low: {
        label: "low",
        budgetMultiplier: 0.7,
        fullThreshold: 0.3,
        limitedThreshold: 0.1,
        maxEntries: 20,
        description: "Prioritizes breadth over detail"
    }
};


// ============================================================================
// PLATFORM DETECTION (do not edit)
// ============================================================================
const HAS_MEMORY = (typeof memory !== "undefined" && memory);
const HAS_TOOLS  = (typeof tools !== "undefined" && tools);


/* ============================================================================
   [SECTION] STATE MANAGEMENT
   ========================================================================== */

/**
 * Get the user's budget preference from memory, defaulting to "medium".
 */
function _getBudgetLevel() {
    if (!HAS_MEMORY) return "medium";
    try {
        return memory.get("budget.level") || "medium";
    } catch(e) {
        return "medium";
    }
}

/**
 * Persist the budget level to memory.
 */
function _setBudgetLevel(level) {
    if (!HAS_MEMORY) return;
    try {
        memory.set("budget.level", level);
    } catch(e) {}
}

/**
 * Process user commands for budget control.
 * Called automatically — check if the user typed a /budget command.
 */
function _processBudgetCommand() {
    const msg = (typeof last_message === "string") ? last_message.toLowerCase() : "";

    if (msg.includes("/budget high")) {
        _setBudgetLevel("high");
        return "[BUDGET] Detail level set to HIGH. Fewer entries will appear, each with full detail.";
    }
    if (msg.includes("/budget medium")) {
        _setBudgetLevel("medium");
        return "[BUDGET] Detail level set to MEDIUM (default).";
    }
    if (msg.includes("/budget low")) {
        _setBudgetLevel("low");
        return "[BUDGET] Detail level set to LOW. More entries will appear with less detail each.";
    }
    if (msg.includes("/budget status")) {
        const level = _getBudgetLevel();
        const preset = BUDGET_PRESETS[level] || BUDGET_PRESETS.medium;
        return `[BUDGET STATUS] Level: ${level}. ${preset.description}. Max entries: ${preset.maxEntries}. Budget: ${Math.round(MAX_OUTPUT_CHARS * preset.budgetMultiplier)} chars.`;
    }

    return null;
}

// Auto-process commands on load
const _commandResult = _processBudgetCommand();


/* ============================================================================
   [SECTION] TOKEN / CHARACTER ESTIMATION
   ========================================================================== */

/**
 * Estimate the token count of a string (~4 chars per token).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(String(text).length / CHARS_PER_TOKEN);
}

/**
 * Get the character length of a string.
 * @param {string} text
 * @returns {number}
 */
function estimateChars(text) {
    if (!text) return 0;
    return String(text).length;
}


/* ============================================================================
   [SECTION] BUDGET CALCULATION
   ========================================================================== */

/**
 * Get the effective maximum output in characters, accounting for budget level.
 * @returns {number}
 */
function getEffectiveMaxChars() {
    const level = _getBudgetLevel();
    const preset = BUDGET_PRESETS[level] || BUDGET_PRESETS.medium;
    return Math.round(MAX_OUTPUT_CHARS * preset.budgetMultiplier);
}

/**
 * Get the max entries based on budget level.
 * @returns {number}
 */
function getMaxEntries() {
    const level = _getBudgetLevel();
    const preset = BUDGET_PRESETS[level] || BUDGET_PRESETS.medium;
    return preset.maxEntries;
}

/**
 * Get the current preset configuration.
 * @returns {object}
 */
function getPreset() {
    const level = _getBudgetLevel();
    return BUDGET_PRESETS[level] || BUDGET_PRESETS.medium;
}


/* ============================================================================
   [SECTION] DETAIL LEVEL SELECTION
   ========================================================================== */

/**
 * Select the appropriate detail level for an entry given the remaining budget.
 *
 * Entries should have this structure:
 *   {
 *     priority: 1-5 (optional, default 3; higher = keeps detail longer),
 *     full: "full detail text",
 *     limited: "condensed text",
 *     summary: "minimal text"
 *   }
 *
 * @param {object} entry — the entry with full/limited/summary versions
 * @param {number} remainingChars — characters remaining in the budget
 * @returns {string} — the selected text version
 */
function selectDetail(entry, remainingChars) {
    if (!entry) return "";

    const full = entry.full || "";
    const limited = entry.limited || "";
    const summary = entry.summary || "";

    // If only one version exists, use it
    if (full && !limited && !summary) return full;
    if (!full && limited && !summary) return limited;
    if (!full && !limited && summary) return summary;

    // If no text versions exist, return empty
    if (!full && !limited && !summary) return "";

    const max = getEffectiveMaxChars();
    const ratio = remainingChars / max;
    const priority = entry.priority || 3;
    const priorityBoost = (priority - 3) * 0.1; // ±0.2 for priority 1-5

    const preset = getPreset();

    // High-priority entries get a boost to their thresholds
    if (ratio + priorityBoost >= preset.fullThreshold) return full;
    if (ratio + priorityBoost >= preset.limitedThreshold) return limited;
    return summary || limited || full;
}


/* ============================================================================
   [SECTION] BUDGET-AWARE OUTPUT BUILDING
   ========================================================================== */

/**
 * Build output from a list of items, respecting the character budget.
 *
 * Items are sorted by priority (descending) and each gets the best detail
 * level the remaining budget allows. Items that can't fit even at summary
 * level are dropped.
 *
 * @param {Array} items — array of entry objects (see selectDetail)
 * @param {string} [prefix] — text to always include at the start (e.g., header)
 * @param {string} [suffix] — text to always include at the end
 * @param {string} [separator] — separator between items (default: "\n\n")
 * @returns {string} — the assembled output, trimmed to budget
 */
function buildOutput(items, prefix, suffix, separator) {
    const sep = separator || "\n\n";
    const maxChars = getEffectiveMaxChars();
    const maxEntries = getMaxEntries();

    // Account for prefix and suffix
    const prefixLen = estimateChars(prefix);
    const suffixLen = estimateChars(suffix);
    let remaining = maxChars - prefixLen - suffixLen;

    // Sort by priority (descending)
    const sorted = (items || []).slice().sort((a, b) => {
        return (b.priority || 3) - (a.priority || 3);
    });

    const parts = [];
    let count = 0;

    for (const item of sorted) {
        if (count >= maxEntries) break;

        const text = selectDetail(item, remaining);
        if (!text) continue;

        const itemLen = estimateChars(text) + sep.length;

        // If the text doesn't fit, try lower detail levels
        if (itemLen > remaining) {
            // Already at lowest detail — skip if it doesn't fit
            const fallback = item.summary || item.limited || "";
            if (estimateChars(fallback) + sep.length <= remaining && fallback) {
                parts.push(fallback);
                remaining -= estimateChars(fallback) + sep.length;
                count++;
            }
            continue;
        }

        parts.push(text);
        remaining -= itemLen;
        count++;
    }

    // Assemble
    let output = "";
    if (prefix) output += prefix;
    if (parts.length > 0) output += (prefix ? sep : "") + parts.join(sep);
    if (suffix) output += (parts.length > 0 || prefix ? sep : "") + suffix;

    // Final trim
    return output.slice(0, 4000);
}


/* ============================================================================
   [SECTION] UTILITY: TRIM TO BUDGET
   ========================================================================== */

/**
 * Simple trim: cut text to fit within the budget.
 * Tries to cut at a sentence or word boundary.
 *
 * @param {string} text
 * @param {number} [maxChars] — override max (default: effective max)
 * @returns {string}
 */
function trimToBudget(text, maxChars) {
    if (!text) return "";
    const limit = maxChars || getEffectiveMaxChars();
    if (text.length <= limit) return text;

    // Try to cut at a sentence boundary
    const sentenceEnd = text.lastIndexOf(". ", limit);
    if (sentenceEnd > limit * 0.7) {
        return text.slice(0, sentenceEnd + 1);
    }

    // Try to cut at a word boundary
    const wordEnd = text.lastIndexOf(" ", limit);
    if (wordEnd > limit * 0.7) {
        return text.slice(0, wordEnd) + "...";
    }

    // Hard cut
    return text.slice(0, limit - 3) + "...";
}


/* ============================================================================
   [SECTION] COMMAND OUTPUT
   ========================================================================== */

/**
 * If the user issued a /budget command, return the response for output.
 * main.js should check this and include it in output if non-null.
 * @returns {string|null}
 */
function getCommandOutput() {
    return _commandResult;
}
