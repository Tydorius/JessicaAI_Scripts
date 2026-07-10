/**
 * API EXPLORER for JessicaAI
 *
 * A diagnostic script that introspects the available JessicaAI Script APIs
 * and outputs a summary. Useful for debugging, discovering what data is
 * available, and learning the API.
 *
 * Usage:
 *   - Type /api to see a full API summary
 *   - Type /api tools to see only the tools namespace
 *   - Type /api memory to see the current memory store
 *   - Type /api state to see character and scenario info
 *   - Type /api chat to see recent message info
 *   - With no command, outputs nothing (stays silent)
 *
 * JessicaAI Inputs: last_message, last_messages, character, scenario,
 *   memory, long_term_memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

const HAS_TOOLS  = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);
const HAS_LTM    = (typeof long_term_memory !== "undefined" && long_term_memory);

const msg = (typeof last_message === "string") ? last_message.toLowerCase().trim() : "";

// Only activate on /api command
if (!msg.startsWith("/api")) {
    output = "";
} else {

const parts = [];
const section = msg.replace(/^\/api\s*/, "").trim();

// ============================================================================
// HEADER
// ============================================================================
parts.push("=== JessicaAI API Explorer ===\n");

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
function reportGlobal(name) {
    const has = (typeof eval === "function") ? null : null; // eval is blocked
    // We can't use eval, so check known globals directly
}

if (section === "" || section === "globals") {
    parts.push("--- GLOBAL VARIABLES ---");
    parts.push(`last_message: ${typeof last_message !== "undefined" ? "available (" + String(last_message || "").length + " chars)" : "undefined"}`);

    if (typeof last_messages !== "undefined" && Array.isArray(last_messages)) {
        const userCount = last_messages.filter(m => m && m.role === "user").length;
        const asstCount = last_messages.filter(m => m && m.role === "assistant").length;
        parts.push(`last_messages: available (${last_messages.length} messages, ${userCount} user, ${asstCount} assistant)`);
    } else {
        parts.push("last_messages: " + (typeof last_messages !== "undefined" ? String(last_messages) : "undefined"));
    }

    if (typeof character !== "undefined" && character) {
        const names = Array.isArray(character.names) ? character.names : [];
        parts.push(`character: available (names: ${names.length > 0 ? names.join(", ") : "none"})`);
    } else {
        parts.push("character: undefined");
    }

    parts.push(`scenario: ${typeof scenario !== "undefined" ? "available (" + String(scenario || "").length + " chars)" : "undefined"}`);
    parts.push(`output: ${typeof output !== "undefined" ? "available" : "undefined"}`);
    parts.push(`memory: ${HAS_MEMORY ? "available" : "undefined"}`);
    parts.push(`long_term_memory: ${HAS_LTM ? "available" : "undefined"}`);
    parts.push(`tools: ${HAS_TOOLS ? "available" : "undefined"}`);
    parts.push(`emotions: ${typeof emotions !== "undefined" ? "available" : "undefined"}`);
    parts.push("");
}

// ============================================================================
// TOOLS NAMESPACE
// ============================================================================
if (HAS_TOOLS && (section === "" || section === "tools")) {
    parts.push("--- TOOLS API ---");

    // tools.chat
    if (tools.chat) {
        parts.push("tools.chat:");
        parts.push("  .recent(limit)    : " + (typeof tools.chat.recent === "function" ? "available" : "missing"));
        parts.push("  .lastUser()       : " + (typeof tools.chat.lastUser === "function" ? "available" : "missing"));

        if (typeof tools.chat.recent === "function") {
            try {
                const recent = tools.chat.recent(3);
                if (Array.isArray(recent)) {
                    parts.push(`  [recent(3) => ${recent.length} messages]`);
                    for (const m of recent) {
                        const role = (m && m.role) || "?";
                        const len = (m && m.content) ? m.content.length : 0;
                        parts.push(`    ${role}: ${len} chars`);
                    }
                }
            } catch(e) {
                parts.push("  [recent() error: " + e.message + "]");
            }
        }
    } else {
        parts.push("tools.chat: not available");
    }

    // tools.state
    if (tools.state) {
        parts.push("tools.state:");
        parts.push("  .activeCharacters(): " + (typeof tools.state.activeCharacters === "function" ? "available" : "missing"));
        parts.push("  .scenario()        : " + (typeof tools.state.scenario === "function" ? "available" : "missing"));

        if (typeof tools.state.activeCharacters === "function") {
            try {
                const chars = tools.state.activeCharacters();
                parts.push(`  [activeCharacters() => ${Array.isArray(chars) ? chars.join(", ") || "empty" : chars}]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.state: not available");
    }

    // tools.game
    if (tools.game) {
        parts.push("tools.game:");
        parts.push("  .get(key, fb)      : " + (typeof tools.game.get === "function" ? "available" : "missing"));
        parts.push("  .set(key, val)     : " + (typeof tools.game.set === "function" ? "available" : "missing"));
        parts.push("  .inc(key, amt)     : " + (typeof tools.game.inc === "function" ? "available" : "missing"));
        parts.push("  .flag(name)        : " + (typeof tools.game.flag === "function" ? "available" : "missing"));
        parts.push("  .unsetFlag(name)   : " + (typeof tools.game.unsetFlag === "function" ? "available" : "missing"));
        parts.push("  .hasFlag(name)     : " + (typeof tools.game.hasFlag === "function" ? "available" : "missing"));
        parts.push("  .flags()           : " + (typeof tools.game.flags === "function" ? "available" : "missing"));

        if (typeof tools.game.flags === "function") {
            try {
                const flags = tools.game.flags();
                parts.push(`  [flags() => ${Array.isArray(flags) ? flags.length + " flags: " + flags.join(", ") : flags}]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.game: not available");
    }

    // tools.inventory
    if (tools.inventory) {
        parts.push("tools.inventory:");
        parts.push("  .add(id, count)    : " + (typeof tools.inventory.add === "function" ? "available" : "missing"));
        parts.push("  .remove(id, count) : " + (typeof tools.inventory.remove === "function" ? "available" : "missing"));
        parts.push("  .count(id)         : " + (typeof tools.inventory.count === "function" ? "available" : "missing"));
        parts.push("  .has(id, count)    : " + (typeof tools.inventory.has === "function" ? "available" : "missing"));
        parts.push("  .list()            : " + (typeof tools.inventory.list === "function" ? "available" : "missing"));

        if (typeof tools.inventory.list === "function") {
            try {
                const inv = tools.inventory.list();
                parts.push(`  [list() => ${Array.isArray(inv) ? inv.length + " items" : inv}]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.inventory: not available");
    }

    // tools.quest
    if (tools.quest) {
        parts.push("tools.quest:");
        parts.push("  .set(id, status)   : " + (typeof tools.quest.set === "function" ? "available" : "missing"));
        parts.push("  .get(id)           : " + (typeof tools.quest.get === "function" ? "available" : "missing"));
        parts.push("  .clear(id)         : " + (typeof tools.quest.clear === "function" ? "available" : "missing"));
        parts.push("  .list()            : " + (typeof tools.quest.list === "function" ? "available" : "missing"));

        if (typeof tools.quest.list === "function") {
            try {
                const quests = tools.quest.list();
                parts.push(`  [list() => ${Array.isArray(quests) ? quests.length + " quests" : quests}]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.quest: not available");
    }

    // tools.status
    if (tools.status) {
        parts.push("tools.status:");
        parts.push("  .get(id, fb)       : " + (typeof tools.status.get === "function" ? "available" : "missing"));
        parts.push("  .set(id, val)      : " + (typeof tools.status.set === "function" ? "available" : "missing"));
        parts.push("  .inc(id, amt)      : " + (typeof tools.status.inc === "function" ? "available" : "missing"));
        parts.push("  .list()            : " + (typeof tools.status.list === "function" ? "available" : "missing"));

        if (typeof tools.status.list === "function") {
            try {
                const stats = tools.status.list();
                if (Array.isArray(stats)) {
                    parts.push(`  [list() => ${stats.length} stats: ${stats.map(s => s.id + "=" + s.value).join(", ")}]`);
                }
            } catch(e) {}
        }
    } else {
        parts.push("tools.status: not available");
    }

    // tools.map
    if (tools.map) {
        parts.push("tools.map:");
        parts.push("  .location()        : " + (typeof tools.map.location === "function" ? "available" : "missing"));
        parts.push("  .setLocation(id)   : " + (typeof tools.map.setLocation === "function" ? "available" : "missing"));
        parts.push("  .exits(world)      : " + (typeof tools.map.exits === "function" ? "available" : "missing"));
        parts.push("  .canMove(dir, w)   : " + (typeof tools.map.canMove === "function" ? "available" : "missing"));
        parts.push("  .move(dir, world)  : " + (typeof tools.map.move === "function" ? "available" : "missing"));

        if (typeof tools.map.location === "function") {
            try {
                parts.push(`  [location() => ${tools.map.location() || "not set"}]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.map: not available");
    }

    // tools.encounter
    if (tools.encounter) {
        parts.push("tools.encounter:");
        parts.push("  .roll(table)       : " + (typeof tools.encounter.roll === "function" ? "available" : "missing"));
        parts.push("  .loot(table)       : " + (typeof tools.encounter.loot === "function" ? "available" : "missing"));
    } else {
        parts.push("tools.encounter: not available");
    }

    // tools.combat
    if (tools.combat) {
        parts.push("tools.combat:");
        parts.push("  .damage(expr)      : " + (typeof tools.combat.damage === "function" ? "available" : "missing"));
        parts.push("  .attack(atk, def)  : " + (typeof tools.combat.attack === "function" ? "available" : "missing"));
        parts.push("  .isDefeated(entity): " + (typeof tools.combat.isDefeated === "function" ? "available" : "missing"));
    } else {
        parts.push("tools.combat: not available");
    }

    // tools.dice
    if (tools.dice) {
        parts.push("tools.dice:");
        parts.push("  .roll(expr)        : " + (typeof tools.dice.roll === "function" ? "available" : "missing"));
        parts.push("  .d4/d6/d8/etc      : " + (typeof tools.dice.d20 === "function" ? "available" : "missing"));
        parts.push("  .d20(mod)          : " + (typeof tools.dice.d20 === "function" ? "available" : "missing"));
        parts.push("  .advantage(mod)    : " + (typeof tools.dice.advantage === "function" ? "available" : "missing"));
        parts.push("  .disadvantage(mod) : " + (typeof tools.dice.disadvantage === "function" ? "available" : "missing"));
        parts.push("  .check(mod, opts)  : " + (typeof tools.dice.check === "function" ? "available" : "missing"));

        if (typeof tools.dice.roll === "function") {
            try {
                const r = tools.dice.roll("1d20");
                parts.push(`  [roll("1d20") => total=${r.total}, rolls=[${r.rolls ? r.rolls.join(",") : "?"}]]`);
            } catch(e) {}
        }
    } else {
        parts.push("tools.dice: not available");
    }

    // tools.random
    if (tools.random) {
        parts.push("tools.random:");
        parts.push("  .pick(items)       : " + (typeof tools.random.pick === "function" ? "available" : "missing"));
        parts.push("  .chance(prob)      : " + (typeof tools.random.chance === "function" ? "available" : "missing"));
        parts.push("  .roll/d20/etc      : " + (typeof tools.random.roll === "function" ? "available (dice aliases)" : "missing"));
    } else {
        parts.push("tools.random: not available");
    }

    // tools.lore
    if (tools.lore) {
        parts.push("tools.lore:");
        parts.push("  .find(query, opts) : " + (typeof tools.lore.find === "function" ? "available" : "missing"));
    } else {
        parts.push("tools.lore: not available");
    }

    parts.push("");
}

// ============================================================================
// MEMORY
// ============================================================================
if (HAS_MEMORY && (section === "" || section === "memory")) {
    parts.push("--- MEMORY STORE ---");

    if (typeof memory.entries === "function") {
        try {
            const entries = memory.entries();
            const keys = Object.keys(entries);
            parts.push(`Keys: ${keys.length} / 32`);
            parts.push(`Size: ~${JSON.stringify(entries).length} / 4096 bytes`);

            if (keys.length > 0) {
                parts.push("\nEntries:");
                for (const key of keys) {
                    const val = String(entries[key]);
                    const display = val.length > 60 ? val.slice(0, 57) + "..." : val;
                    parts.push(`  ${key}: ${display}`);
                }
            }
        } catch(e) {
            parts.push("Error reading entries: " + e.message);
        }
    }

    if (typeof memory.lastError === "function") {
        try {
            const err = memory.lastError();
            if (err) parts.push(`Last error: ${err}`);
        } catch(e) {}
    }

    parts.push("");
}

// ============================================================================
// LONG-TERM MEMORY
// ============================================================================
if (HAS_LTM && (section === "" || section === "ltm" || section === "long_term_memory")) {
    parts.push("--- LONG-TERM MEMORY ---");
    try {
        const ltmKeys = Object.keys(long_term_memory);
        parts.push(`Keys: ${ltmKeys.length}`);
        for (const key of ltmKeys) {
            const val = long_term_memory[key];
            const type = Array.isArray(val) ? `array(${val.length})` : typeof val;
            parts.push(`  ${key}: ${type}`);
        }
    } catch(e) {
        parts.push("Error: " + e.message);
    }
    parts.push("");
}

// ============================================================================
// STATE (CHARACTER + SCENARIO)
// ============================================================================
if (section === "" || section === "state") {
    parts.push("--- STATE ---");

    if (typeof character !== "undefined" && character) {
        parts.push("character:");
        if (Array.isArray(character.names)) {
            parts.push(`  names: [${character.names.join(", ")}]`);
        }
    }

    if (typeof scenario !== "undefined") {
        const scenLen = String(scenario || "").length;
        parts.push(`scenario: ${scenLen} chars`);
        if (scenLen > 0) {
            const preview = String(scenario).slice(0, 100);
            parts.push(`  preview: ${preview}${scenLen > 100 ? "..." : ""}`);
        }
    }

    if (HAS_TOOLS && tools.state) {
        if (typeof tools.state.activeCharacters === "function") {
            try {
                const chars = tools.state.activeCharacters();
                parts.push(`activeCharacters: [${Array.isArray(chars) ? chars.join(", ") : chars}]`);
            } catch(e) {}
        }
    }

    parts.push("");
}

// ============================================================================
// CHAT
// ============================================================================
if (section === "" || section === "chat") {
    parts.push("--- CHAT ---");

    if (typeof last_messages !== "undefined" && Array.isArray(last_messages)) {
        parts.push(`last_messages: ${last_messages.length} available`);
        for (let i = 0; i < Math.min(last_messages.length, 5); i++) {
            const m = last_messages[i];
            if (!m) continue;
            const role = m.role || "?";
            const len = (m.content || "").length;
            const preview = (m.content || "").slice(0, 50);
            parts.push(`  [${i}] ${role} (${len} chars): ${preview}${len > 50 ? "..." : ""}`);
        }
    }

    if (typeof last_message !== "undefined") {
        const len = String(last_message || "").length;
        parts.push(`last_message: ${len} chars`);
    }

    parts.push("");
}

// ============================================================================
// EMOTIONS (if available)
// ============================================================================
if (typeof emotions !== "undefined" && emotions && (section === "" || section === "emotions")) {
    parts.push("--- EMOTIONS ---");
    try {
        const emoKeys = Object.keys(emotions);
        const active = emoKeys.filter(k => emotions[k] === true);
        parts.push(`Detected: ${active.length > 0 ? active.join(", ") : "none"}`);
        parts.push(`All keys: ${emoKeys.join(", ")}`);
    } catch(e) {
        parts.push("Error: " + e.message);
    }
    parts.push("");
}

// ============================================================================
// FINAL OUTPUT
// ============================================================================
output = parts.join("\n").slice(0, 4000);

} // end /api guard
