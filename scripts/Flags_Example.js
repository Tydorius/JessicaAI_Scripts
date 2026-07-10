/**
 * FLAGS EXAMPLE for JessicaAI
 *
 * Demonstrates the native flag and quest APIs for story progression,
 * branching narratives, and achievement tracking.
 *
 *   tools.game.flag()      — set a flag
 *   tools.game.hasFlag()   — check a flag
 *   tools.game.unsetFlag() — remove a flag
 *   tools.game.flags()     — list all flags
 *   tools.quest.set()      — set a quest stage
 *   tools.quest.get()      — read a quest stage
 *   tools.quest.list()     — list all quests
 *
 * This example implements a branching story where the player's choices
 * set flags that unlock or lock future content.
 *
 * JessicaAI Inputs: last_message, last_messages, character, memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

// ============================================================================
// GUARDS
// ============================================================================
const HAS_TOOLS = (typeof tools !== "undefined" && tools);

if (!HAS_TOOLS) {
    output = "";
} else {

// ============================================================================
// FIRST-RUN INITIALIZATION
// ============================================================================
if (!tools.game.hasFlag("story_started")) {
    tools.game.flag("story_started");
    tools.quest.set("main", "arrive_at_tavern");
    tools.quest.set("mystery", "untouched");
}

const text = (typeof last_message === "string") ? last_message.toLowerCase() : "";
const parts = [];

// ============================================================================
// FLAG TRIGGERS — detect story events and set flags
// ============================================================================

// --- Arrived at the tavern ---
if (text.includes("tavern") || text.includes("inn") || text.includes("bar")) {
    if (!tools.game.hasFlag("visited_tavern")) {
        tools.game.flag("visited_tavern");
        parts.push("[EVENT] The player enters the tavern for the first time.");
    }
}

// --- Met the bartender ---
if (text.includes("bartender") || text.includes("innkeeper") || text.includes("barkeep")) {
    if (!tools.game.hasFlag("met_bartender")) {
        tools.game.flag("met_bartender");
        parts.push("[EVENT] The player meets the bartender, a grizzled man named Corwin.");
    }
}

// --- Overheard the rumor ---
if (text.includes("rumor") || text.includes("whisper") || text.includes("overhear")) {
    if (!tools.game.hasFlag("heard_rumor")) {
        tools.game.flag("heard_rumor");
        tools.quest.set("mystery", "rumor_heard");
        parts.push("[EVENT] The player overhears a rumor about disappearances in the old quarter.");
    }
}

// --- Investigated the old quarter ---
if (text.includes("old quarter") || text.includes("alley") || text.includes("investigate")) {
    if (tools.game.hasFlag("heard_rumor") && !tools.game.hasFlag("investigated_quarter")) {
        tools.game.flag("investigated_quarter");
        tools.quest.set("mystery", "clue_found");
        parts.push("[EVENT] The player finds a strange symbol carved into a wall in the old quarter.");
    }
}

// --- Found the key ---
if (text.includes("key") && (text.includes("find") || text.includes("found") || text.includes("pick up"))) {
    if (!tools.game.hasFlag("has_key")) {
        tools.game.flag("has_key");
        parts.push("[EVENT] The player acquires a rusty iron key.");
    }
}

// --- Unlocked the door ---
if (text.includes("unlock") || text.includes("open door")) {
    if (tools.game.hasFlag("has_key") && !tools.game.hasFlag("door_unlocked")) {
        tools.game.flag("door_unlocked");
        tools.quest.set("mystery", "lair_found");
        parts.push("[EVENT] The rusty key fits. The door groans open to reveal a hidden cellar.");
    } else if (!tools.game.hasFlag("has_key")) {
        parts.push("[BLOCKED] The door is locked. The player needs a key.");
    }
}

// --- Confronted the antagonist ---
if (text.includes("confront") || text.includes("cellar") || text.includes("lair")) {
    if (tools.game.hasFlag("door_unlocked") && !tools.game.hasFlag("confronted antagonist".replace(" ", "_"))) {
        tools.game.flag("confronted_antagonist");
        tools.quest.set("mystery", "confrontation");
        parts.push("[EVENT] The player descends into the cellar and comes face to face with the culprit.");
    }
}

// --- Player chose to spare ---
if (text.includes("spare") || text.includes("let live") || text.includes("mercy")) {
    if (tools.game.hasFlag("confronted_antagonist") && !tools.game.hasFlag("spared_antagonist") && !tools.game.hasFlag("killed_antagonist")) {
        tools.game.flag("spared_antagonist");
        tools.quest.set("mystery", "resolved_spare");
        tools.quest.set("main", "complete");
        parts.push("[EVENT] The player shows mercy. The antagonist surrenders and is taken into custody.");
    }
}

// --- Player chose to kill ---
if (text.includes("kill") || text.includes("strike down") || text.includes("execute")) {
    if (tools.game.hasFlag("confronted_antagonist") && !tools.game.hasFlag("spared_antagonist") && !tools.game.hasFlag("killed_antagonist")) {
        tools.game.flag("killed_antagonist");
        tools.quest.set("mystery", "resolved_kill");
        tools.quest.set("main", "complete");
        parts.push("[EVENT] The player strikes down the antagonist. The mystery is solved, but at a cost.");
    }
}

// ============================================================================
// CONTENT GATING — inject guidance based on flag state
// ============================================================================

// --- Tavern scene ---
if (tools.game.hasFlag("visited_tavern") && !tools.game.hasFlag("heard_rumor")) {
    parts.push("[SCENE] The tavern is bustling. The bartender is drying mugs. A few patrons huddle in corners speaking in hushed tones. Something is on their minds.");
}

// --- After hearing the rumor ---
if (tools.game.hasFlag("heard_rumor") && !tools.game.hasFlag("investigated_quarter")) {
    parts.push("[SCENE] Rumors swirl about people vanishing near the old quarter at night. The bartender seems nervous when pressed.");
}

// --- After finding the clue ---
if (tools.game.hasFlag("investigated_quarter") && !tools.game.hasFlag("has_key")) {
    parts.push("[SCENE] The carved symbol matches descriptions of an old cult. The bartender might know more, or perhaps the town archives hold answers.");
}

// --- After getting the key ---
if (tools.game.hasFlag("has_key") && !tools.game.hasFlag("door_unlocked")) {
    parts.push("[SCENE] The rusty key feels heavy in hand. The old quarter's locked door beckons.");
}

// --- In the cellar ---
if (tools.game.hasFlag("door_unlocked") && !tools.game.hasFlag("confronted_antagonist")) {
    parts.push("[SCENE] The cellar reeks of damp earth. Flickering candlelight reveals a long passage. Footsteps echo ahead.");
}

// --- After confrontation, present the choice ---
if (tools.game.hasFlag("confronted_antagonist") && !tools.game.hasFlag("spared_antagonist") && !tools.game.hasFlag("killed_antagonist")) {
    parts.push("[CHOICE] The antagonist is cornered, unarmed, and begging. The player must decide: spare or strike. Present this choice dramatically.");
}

// --- Ending variations ---
if (tools.game.hasFlag("spared_antagonist")) {
    parts.push("[ENDING] The antagonist was spared. The town is safe, and the culprit will face justice. The townspeople speak of the player's wisdom and mercy.");
}

if (tools.game.hasFlag("killed_antagonist")) {
    parts.push("[ENDING] The antagonist lies dead. The disappearances have stopped, but some townspeople whisper about the player's ruthlessness. Justice or vengeance?");
}

// ============================================================================
// ACHIEVEMENT TRACKING
// ============================================================================
if (tools.quest.get("main") === "complete" && !tools.game.hasFlag("achievement_complete")) {
    tools.game.flag("achievement_complete");
    parts.push("[ACHIEVEMENT] Mystery Solved — The disappearances have been resolved.");
}

// ============================================================================
// STATUS REPORT
// ============================================================================
const allFlags = tools.game.flags();
const quests = tools.quest.list();

let status = "[STORY STATE]\n";
status += `Quest: ${tools.quest.get("main") || "none"}\n`;
status += `Mystery: ${tools.quest.get("mystery") || "unknown"}`;

if (quests && quests.length > 2) {
    const extra = quests.filter(q => q.id !== "main" && q.id !== "mystery");
    if (extra.length > 0) {
        status += `\nSide Quests: ${extra.map(q => `${q.id}=${q.status}`).join(", ")}`;
    }
}

status += `\nFlags: ${allFlags.length > 0 ? allFlags.join(", ") : "none"}`;

// Story progress hint for the LLM
const progress = [];
if (!tools.game.hasFlag("visited_tavern")) progress.push("The story hasn't begun — guide the player toward the tavern.");
else if (!tools.game.hasFlag("heard_rumor")) progress.push("The player is in the tavern but hasn't heard the rumor — have an NPC mention disappearances.");
else if (!tools.game.hasFlag("investigated_quarter")) progress.push("The player knows about the mystery — encourage investigation of the old quarter.");
else if (!tools.game.hasFlag("has_key")) progress.push("The player found the symbol — lead them to the key (bartender, archives, or a hidden cache).");
else if (!tools.game.hasFlag("door_unlocked")) progress.push("The player has the key — guide them back to the locked door.");
else if (!tools.game.hasFlag("confronted_antagonist")) progress.push("The player is in the cellar — build tension toward the confrontation.");
else if (!tools.game.hasFlag("spared_antagonist") && !tools.game.hasFlag("killed_antagonist")) progress.push("The antagonist is cornered — present the moral choice clearly.");
else progress.push("The story is complete — reflect on the player's choices and their consequences.");

status += `\nGuidance: ${progress.join(" ")}`;

parts.unshift(status);

// ============================================================================
// FINAL OUTPUT
// ============================================================================
output = parts.join("\n\n");

// Close HAS_TOOLS guard
}
