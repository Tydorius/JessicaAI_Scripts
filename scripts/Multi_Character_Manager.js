/**
 * MULTI-CHARACTER MANAGER for JessicaAI
 *
 * Dynamically injects character context based on who is active and who is
 * being discussed in the scene. Uses JessicaAI's native multi-character
 * support (tools.state.activeCharacters, character.names) supplemented by
 * mention detection for scene-relevance.
 *
 * Features:
 *   - Reads active characters from the platform via tools.state.activeCharacters()
 *   - Defines character profiles (personality, appearance, scenario) in-script
 *   - Detects mentions in recent messages for scene-relevance
 *   - Tracks character presence across turns via memory
 *   - Optional adaptive detail levels (full/limited/summary) with token budget
 *   - Relationship injections when pairs of characters are co-active
 *
 * JessicaAI Inputs: last_message, last_messages, character, memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

// ============================================================================
// GUARDS
// ============================================================================
const HAS_TOOLS  = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);


/* ============================================================================
   [SECTION] CONFIGURATION
   SAFE TO EDIT: Yes
   ========================================================================== */

// Maximum total characters (approx) for character guidance output.
// Set to Infinity to disable budget management.
let TOKEN_BUDGET = 1500;

// Multi-message depth for mention scanning (1-10)
let MENTION_DEPTH = 3;

// When true, characters who were mentioned recently stay "present" even if
// not mentioned this exact turn. This smooths over brief absences.
let STICKY_PRESENCE = true;

// How many turns a character stays present without being mentioned before
// they fade out. Only relevant when STICKY_PRESENCE is true.
let STICKY_TURNS = 3;


/* ============================================================================
   [SECTION] CHARACTER PROFILES
   SAFE TO EDIT: Yes

   Define each character with their name, aliases, priority, and profile data.
   Priority 1-5 (higher = more important, stays detailed longer under budget
   pressure). Detail levels let the budget system degrade gracefully.

   The "name" must match what the platform reports via character.names or
   tools.state.activeCharacters(). Aliases are additional names/nicknames the
   script should recognize in user messages.
   ========================================================================== */

const CHARACTERS = [
    {
        name: "Nadia",
        aliases: ["nad", "captain", "the captain"],
        priority: 5,
        full: {
            personality: " Nadia is the captain of the Veiled Star. She is sharp-tongued, fiercely loyal to her crew, and carries the weight of command with visible tension. She has a dry wit and a scar across her left palm from a duel she refuses to discuss.",
            appearance: " Nadia has sun-darkened skin, close-cropped black hair, and storm-grey eyes. She wears a weathered navy coat with gold piping and keeps a cutlass at her hip.",
            scenario: " When Nadia is present, she commands the room. She speaks in clipped sentences and expects immediate compliance from her crew. She respects boldness but punishes insolence."
        },
        limited: {
            personality: " Nadia is the sharp-tongued, fiercely loyal captain of the Veiled Star. She carries tension and has a dry wit.",
            appearance: " Sun-darkened skin, cropped black hair, grey eyes, weathered navy coat, cutlass.",
            scenario: " Nadia commands any room she enters. She respects boldness, punishes insolence."
        },
        summary: {
            personality: " Captain Nadia: sharp-tongued, loyal, commanding.",
            appearance: " Dark-skinned, black hair, grey eyes, navy coat, cutlass.",
            scenario: " Commands respect. Clipped speech, expects compliance."
        }
    },
    {
        name: "Corvin",
        aliases: ["corv", "doc", "the doctor", "surgeon"],
        priority: 4,
        full: {
            personality: " Corvin is the ship's surgeon, a former university man who took to the sea after a scandal. He is soft-spoken, morbidly curious, and has a gentle bedside manner that masks a deeply analytical mind. He collects unusual specimens in glass jars.",
            appearance: " Corvin is tall and thin with spectacles, ink-stained fingers, and a perpetually stained apron over a faded linen shirt. He smells of herbs and formaldehyde.",
            scenario: " Corvin speaks in measured, clinical terms even in casual conversation. He is fascinated by injuries and will examine wounds with unsettling enthusiasm."
        },
        limited: {
            personality: " Corvin is the ship's surgeon — soft-spoken, morbidly curious, analytical. Former academic with a scandal in his past.",
            appearance: " Tall, thin, spectacles, ink-stained fingers, stained apron.",
            scenario: " Speaks in clinical terms. Fascinated by injuries."
        },
        summary: {
            personality: " Surgeon Corvin: soft-spoken, morbidly curious, clinical.",
            appearance: " Tall, thin, spectacles, stained apron.",
            scenario: " Clinical speech, injury fascination."
        }
    },
    {
        name: "Rix",
        aliases: ["rixie", "rigging rat", "lookout"],
        priority: 3,
        full: {
            personality: " Rix is the youngest crew member, a wiry cabin girl who scrambles through the rigging like a squirrel. She is cheerful, nosy, and collects gossip like currency. She hero-worships Nadia and is terrified of Corvin's jar collection.",
            appearance: " Rix is small and lean with a perpetually sunburned nose, tangled red hair, and oversized hand-me-down clothes tied with rope belts.",
            scenario: " Rix speaks rapidly and excitedly. She pops up in unexpected places and knows everyone's business. She can be bribed with sweets."
        },
        limited: {
            personality: " Rix is the young, cheerful cabin girl who climbs rigging. Nosy, gossipy, hero-worships Nadia.",
            appearance: " Small, lean, sunburned nose, tangled red hair, oversized clothes.",
            scenario: " Talks fast, pops up unexpectedly, knows everyone's secrets."
        },
        summary: {
            personality: " Cabin girl Rix: cheerful, nosy, gossipy.",
            appearance: " Small, red-haired, oversized clothes.",
            scenario: " Fast talker, knows secrets, bribeable with sweets."
        }
    }
];


/* ============================================================================
   [SECTION] RELATIONSHIPS
   SAFE TO EDIT: Yes

   When two characters are both present, inject relationship context.
   pair: both character names must match (case-insensitive)
   ========================================================================== */

const RELATIONSHIPS = [
    {
        pair: ["Nadia", "Corvin"],
        injection: "[RELATIONSHIP] Nadia trusts Corvin's medical skill but distrusts his secrecy about his past. They have a professional rapport with an undercurrent of unasked questions.",
        priority: 4
    },
    {
        pair: ["Nadia", "Rix"],
        injection: "[RELATIONSHIP] Nadia is protective of Rix in a gruff, deniable way. Rix adores the captain and tries to impress her constantly.",
        priority: 4
    },
    {
        pair: ["Corvin", "Rix"],
        injection: "[RELATIONSHIP] Rix is terrified of Corvin's specimen jars and avoids the surgery. Corvin finds her fear amusing and sometimes deliberately startles her.",
        priority: 3
    }
];


/* ============================================================================
   [SECTION] CHARACTER CARD GUIDANCE
   SAFE TO EDIT: Yes

   This block is injected when multiple characters are active, giving the LLM
   general instructions on how to portray them.
   ========================================================================== */

const MULTI_CHAR_GUIDANCE = `[MULTI-CHARACTER]
When multiple characters are present, distinguish them clearly through speech patterns, mannerisms, and physical positioning. Give each character a distinct voice. Avoid blending their personalities. Use the character's name when they speak or act. Characters should react to each other, not just to the player.`;


// ============================================================================
// DO NOT EDIT BELOW THIS LINE — ENGINE CODE
// ============================================================================


/* ============================================================================
   [SECTION] INPUT GATHERING
   ========================================================================== */

function _safe(fn, fallback) {
    try { const v = fn(); return v == null ? fallback : v; }
    catch(e) { return fallback; }
}

const activeFromPlatform = HAS_TOOLS
    ? _safe(() => tools.state.activeCharacters(), [])
    : [];

const rosterNames = (typeof character !== "undefined" && Array.isArray(character.names))
    ? character.names
    : activeFromPlatform;

// Get recent messages for mention scanning
let recentMsgs = [];
if (typeof last_messages !== "undefined" && Array.isArray(last_messages)) {
    recentMsgs = last_messages;
} else if (HAS_TOOLS && tools.chat && typeof tools.chat.recent === "function") {
    recentMsgs = _safe(() => tools.chat.recent(MENTION_DEPTH), []);
}

// Build a text blob from recent messages for mention detection
let recentText = "";
const startIdx = Math.max(0, recentMsgs.length - MENTION_DEPTH);
for (let i = startIdx; i < recentMsgs.length; i++) {
    const msg = recentMsgs[i];
    if (!msg) continue;
    const content = msg.content || msg.message || "";
    recentText += " " + content;
}
recentText = recentText.toLowerCase();

const lastMsgText = (typeof last_message === "string")
    ? last_message.toLowerCase()
    : (recentMsgs.length > 0
        ? (recentMsgs[recentMsgs.length - 1].content || recentMsgs[recentMsgs.length - 1].message || "").toLowerCase()
        : "");


/* ============================================================================
   [SECTION] PRESENCE DETECTION
   ========================================================================== */

// Normalize a name for comparison
function norm(s) { return String(s || "").toLowerCase().trim(); }

// Check if a character's name or aliases appear in text
function isMentioned(charDef, text) {
    const names = [norm(charDef.name)].concat((charDef.aliases || []).map(norm));
    return names.some(n => n && text.includes(n));
}

// Determine which characters are present this turn
const mentionedNow = {};
for (const c of CHARACTERS) {
    mentionedNow[c.name] = isMentioned(c, recentText);
}

// Load sticky presence from memory
let presenceMap = {};
if (STICKY_PRESENCE && HAS_MEMORY) {
    const stored = _safe(() => memory.get("mc.presence"), "");
    if (stored) {
        try { presenceMap = JSON.parse(stored); } catch(e) { presenceMap = {}; }
    }
}

// Update presence: merge current mentions with sticky tracking
const turnCount = _safe(() => parseInt(memory.get("mc.turn") || "0", 10), 0);
const newPresence = {};

for (const c of CHARACTERS) {
    const name = c.name;
    const wasPresent = presenceMap[name];
    const isNow = mentionedNow[name];

    // Also check platform active characters
    const platformActive = activeFromPlatform.some(a => norm(a) === norm(name));

    if (isNow || platformActive) {
        newPresence[name] = { present: true, lastSeen: turnCount };
    } else if (wasPresent && STICKY_PRESENCE) {
        // Keep present if within sticky window
        const turnsSince = turnCount - wasPresent.lastSeen;
        newPresence[name] = {
            present: turnsSince < STICKY_TURNS,
            lastSeen: wasPresent.lastSeen
        };
    } else {
        newPresence[name] = { present: false, lastSeen: wasPresent ? wasPresent.lastSeen : -1 };
    }
}

// Persist presence and increment turn count
if (HAS_MEMORY) {
    _safe(() => memory.set("mc.presence", JSON.stringify(newPresence)), false);
    _safe(() => memory.set("mc.turn", String(turnCount + 1)), false);
}


/* ============================================================================
   [SECTION] BUDGET MANAGEMENT
   ========================================================================== */

// Token estimation: ~4 chars per token
function estimateTokens(text) {
    return text ? Math.ceil(text.length / 4) : 0;
}

// Get the detail level for a character based on remaining budget
function getDetailLevel(charDef, remainingBudget) {
    const full = estimateTokens(JSON.stringify(charDef.full || {}));
    const limited = estimateTokens(JSON.stringify(charDef.limited || {}));
    const summary = estimateTokens(JSON.stringify(charDef.summary || {}));

    // Priority multiplier: higher priority characters get more budget
    const prio = charDef.priority || 3;

    if (remainingBudget > full * (prio / 3)) return "full";
    if (remainingBudget > limited * (prio / 3)) return "limited";
    return "summary";
}

// Assemble character guidance text at a given detail level
function buildCharText(charDef, level) {
    const data = charDef[level] || charDef.summary || {};
    const parts = [];
    if (data.personality) parts.push(`[PERSONALITY]${data.personality}`);
    if (data.appearance) parts.push(`[APPEARANCE]${data.appearance}`);
    if (data.scenario) parts.push(`[SCENARIO]${data.scenario}`);
    return parts.join("\n");
}


/* ============================================================================
   [SECTION] ASSEMBLE OUTPUT
   ========================================================================== */

const outputParts = [];
let budgetUsed = 0;
const budgetActive = (typeof TOKEN_BUDGET === "number" && TOKEN_BUDGET > 0);

// Determine present characters, sorted by priority (descending)
const presentChars = CHARACTERS
    .filter(c => newPresence[c.name] && newPresence[c.name].present)
    .sort((a, b) => (b.priority || 3) - (a.priority || 3));

// Multi-character guidance (only if 2+ characters present)
if (presentChars.length >= 2) {
    outputParts.push(MULTI_CHAR_GUIDANCE);
    budgetUsed += estimateTokens(MULTI_CHAR_GUIDANCE);
}

// Character profiles
for (const c of presentChars) {
    let level = "full";
    let remaining = budgetActive ? (TOKEN_BUDGET - budgetUsed) : Infinity;

    if (budgetActive && remaining > 0) {
        level = getDetailLevel(c, remaining);
    }

    const charText = buildCharText(c, level);
    const charBlock = `[CHARACTER: ${c.name} (${level})]\n${charText}`;
    outputParts.push(charBlock);
    budgetUsed += estimateTokens(charText);
}

// Relationship injections for co-present pairs
const presentNames = presentChars.map(c => c.name);
const activeRelationships = RELATIONSHIPS.filter(rel =>
    rel.pair.every(name => presentNames.some(pn => norm(pn) === norm(name)))
).sort((a, b) => (b.priority || 3) - (a.priority || 3));

for (const rel of activeRelationships) {
    outputParts.push(rel.injection);
    budgetUsed += estimateTokens(rel.injection);
}

// Characters who just arrived or departed (for narrative continuity)
for (const c of CHARACTERS) {
    const wasPresent = presenceMap[c.name] && presenceMap[c.name].present;
    const isNow = newPresence[c.name] && newPresence[c.name].present;

    if (!wasPresent && isNow && presenceMap[c.name] && presenceMap[c.name].lastSeen >= 0) {
        outputParts.push(`[ENTRANCE] ${c.name} enters the scene.`);
    } else if (wasPresent && !isNow) {
        outputParts.push(`[EXIT] ${c.name} is no longer present in the scene.`);
    }
}


/* ============================================================================
   [SECTION] FLUSH
   ========================================================================== */

const finalOutput = outputParts.join("\n\n").trim().slice(0, 4000);

if (finalOutput) {
    output = finalOutput;
}
