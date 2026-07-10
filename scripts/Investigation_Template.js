/**
 * INVESTIGATION TEMPLATE for JessicaAI
 *
 * A progressive disclosure system for mystery and investigation scenarios.
 * Combines flag-gated content unlocking, timeline progression, hidden clues,
 * and anti-omniscience design principles.
 *
 * ANTI-OMNISCIENCE DESIGN:
 * - Content is locked behind flags; only discovered information is injected
 * - No meta-labels ([HIDDEN CLUE], [RED HERRING]) that reveal narrative structure
 * - No foreshadowing — characters know only what they've experienced
 * - Explicit information boundary instructions for the LLM
 * - Content describes what IS observed, never what WILL BE known
 *
 * PROGRESSIVE DISCLOSURE:
 * - Flag-gated content nodes (requires / requiresAny)
 * - Timeline progression (hour tracking via tools.game)
 * - Canon count / clue tracking (cumulative discoveries)
 * - Hidden clues revealed when threshold conditions are met
 * - Drop-in/drop-out witnesses and locations (mention-activated)
 * - Conditional story branching
 *
 * KEY DIFFERENCE FROM JANITORAI:
 * - Flags are server-side (tools.game) — no hex strings, no anti-cheat, no LLM dependence
 * - Timeline and canon count stored in tools.game — no stat parsing from AI output
 * - The script SETS flags based on detected player actions, not the LLM
 *
 * JessicaAI Inputs: last_message, last_messages, character, memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

// ============================================================================
// GUARDS
// ============================================================================
const HAS_TOOLS  = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);

if (!HAS_TOOLS) {
    output = "";
} else {


/* ============================================================================
   [SECTION] CONFIGURATION
   SAFE TO EDIT: Yes
   ========================================================================== */

let DEBUG_MODE = 0;          // 1 = emit [DBG] diagnostic lines
let MAX_OUTPUT = 3500;       // reserve some output budget; 4000 is the hard cap
let ANTI_OMNISCIENCE = 1;    // 1 = inject information boundary instructions
let TIMELINE_ENABLED = 1;    // 1 = track in-game hour progression
let CANON_TRACKING = 1;      // 1 = track cumulative clue discoveries
let HIDDEN_CLUES = 1;        // 1 = enable threshold-gated hidden clues


/* ============================================================================
   [SECTION] FLAG TRIGGER DEFINITIONS
   SAFE TO EDIT: Yes

   Each trigger defines:
   - keywords: words in the player's message that indicate they did something
   - setsFlags: flags to set when any keyword matches
   - requiresAll: (optional) all of these flags must already be set
   - requiresAny: (optional) at least one of these flags must be set
   - requiresNone: (optional) none of these flags may be set
   - description: what happened (for event log)

   The script SETS flags based on player actions. The LLM never controls flags.
   ========================================================================== */

const FLAG_TRIGGERS = [
    // === BANK VISITS ===
    {
        keywords: ["first national", "downtown bank"],
        setsFlags: ["bank.first_national_visited"],
        requiresNone: ["bank.first_national_visited"],
        description: "The player visits First National Bank and assesses its security."
    },
    {
        keywords: ["river city", "waterfront bank"],
        setsFlags: ["bank.river_city_visited"],
        requiresNone: ["bank.river_city_visited"],
        description: "The player visits River City Savings and assesses its security."
    },
    {
        keywords: ["metro community", "residential bank"],
        setsFlags: ["bank.metro_visited"],
        requiresNone: ["bank.metro_visited"],
        description: "The player visits Metro Community Bank and assesses its security."
    },

    // === WITNESS INTERVIEWS ===
    {
        keywords: ["thomas", "anderson", "security guard"],
        setsFlags: ["witness.thomas_interviewed"],
        requiresAll: ["bank.first_national_visited"],
        requiresNone: ["witness.thomas_interviewed"],
        description: "The player interviews Security Guard Thomas Anderson."
    },
    {
        keywords: ["maria", "rodriguez"],
        setsFlags: ["witness.maria_interviewed"],
        requiresAll: ["bank.river_city_visited"],
        requiresNone: ["witness.maria_interviewed"],
        description: "The player interviews customer Maria Rodriguez."
    },
    {
        keywords: ["sarah", "williams", "branch manager"],
        setsFlags: ["witness.sarah_interviewed"],
        requiresAll: ["bank.metro_visited"],
        requiresNone: ["witness.sarah_interviewed"],
        description: "The player questions manager Sarah Williams."
    },

    // === SARAH CONFRONTATION (requires evidence) ===
    {
        keywords: ["confront", "press", "accuse"],
        setsFlags: ["witness.sarah_cooperative"],
        requiresAll: ["witness.sarah_interviewed", "witness.thomas_interviewed"],
        requiresNone: ["witness.sarah_cooperative"],
        description: "The player confronts Sarah Williams with gathered evidence and she cooperates."
    },

    // === EVIDENCE DISCOVERY ===
    {
        keywords: ["mercer", "james mercer"],
        setsFlags: ["evidence.mercer_identified"],
        requiresAny: ["witness.sarah_cooperative", "witness.thomas_interviewed"],
        requiresNone: ["evidence.mercer_identified"],
        description: "The player identifies James Mercer as a key figure."
    },
    {
        keywords: ["financial", "paper trail", "money trail", "offshore"],
        setsFlags: ["evidence.financial_trail"],
        requiresAll: ["evidence.mercer_identified"],
        requiresNone: ["evidence.financial_trail"],
        description: "The player traces the financial connections."
    },
    {
        keywords: ["thorne", "marcus thorne", "ceo"],
        setsFlags: ["evidence.orchestrator_named"],
        requiresAll: ["evidence.financial_trail"],
        requiresNone: ["evidence.orchestrator_named"],
        description: "The player identifies Marcus Thorne as the orchestrator."
    },

    // === RESOLUTION ===
    {
        keywords: ["arrest", "resolve", "close the case", "take into custody"],
        setsFlags: ["case.resolved"],
        requiresAll: ["evidence.orchestrator_named"],
        requiresNone: ["case.resolved"],
        description: "The case is resolved. Marcus Thorne is taken into custody."
    }
];


/* ============================================================================
   [SECTION] TIMELINE DEFINITIONS
   SAFE TO EDIT: Yes

   Hour-based events that trigger as the in-game clock advances.
   The script tracks the hour in tools.game and advances it based on
   player actions (visiting locations, conducting interviews, etc.)
   ========================================================================== */

const TIMELINE_EVENTS = [
    {
        minHour: 0,
        maxHour: 2,
        content: " The investigation has just begun. It is early morning. The streets are quiet and the banks are not yet open for business."
    },
    {
        minHour: 2,
        maxHour: 6,
        content: " The morning is progressing. Banks are open. Staff are arriving for their shifts."
    },
    {
        minHour: 6,
        maxHour: 10,
        content: " It is late morning. The predicted robbery time of 2 PM is approaching. There is still time to act."
    },
    {
        minHour: 10,
        maxHour: 13,
        content: " It is early afternoon. Tension rises as 2 PM draws near. Security should be heightened at all bank locations."
    },
    {
        minHour: 13,
        maxHour: 14,
        content: " It is nearly 2 PM. If the robbery has not been prevented, it may happen at any moment. The stakes are critical."
    },
    {
        minHour: 14,
        maxHour: 24,
        content: " The critical hour has passed. The outcome of the robbery attempt is determined by the player's actions."
    }
];

// Actions that advance the in-game clock
const TIME_ADVANCING_KEYWORDS = [
    { keywords: ["visit", "go to", "travel", "head to"], hours: 1 },
    { keywords: ["interview", "question", "speak with", "talk to"], hours: 1 },
    { keywords: ["search", "examine", "investigate", "inspect"], hours: 1 },
    { keywords: ["wait", "rest", "pause"], hours: 2 }
];


/* ============================================================================
   [SECTION] CONTENT NODES
   SAFE TO EDIT: Yes

   Each content node is a piece of information injected ONLY when its flag
   requirements are met. This is the core of the anti-omniscience system.

   ANTI-OMNISCIENCE RULES FOR CONTENT:
   1. Describe what IS observed, not what it MEANS
   2. Do not use meta-labels ([HIDDEN CLUE], [MISDIRECTION], [TARGET])
   3. Do not foreshadow future revelations
   4. Characters only know what they have personally experienced
   5. Do not reveal narrative structure (red herrings, twists, true targets)
   6. Write content as factual observation, not authorial commentary

   REQUIREMENT TYPES:
   - requires: [flag1, flag2] — ALL listed flags must be set
   - requiresAny: [flag1, flag2] — at least ONE flag must be set
   - requiresNone: [flag1] — none of these flags may be set
   - minHour: N — the in-game hour must be >= N
   - minCanon: N — the cumulative clue count must be >= N
   ========================================================================== */

const CONTENT_NODES = [
    // === INITIAL HOOK ===
    {
        id: "initial_tip",
        requires: [],
        requiresNone: ["case.resolved"],
        content: " An anonymous message was received: 'One of three banks will be robbed today. They are targeting the bank with the largest vault but weakest defense. It will happen around 2 PM. The crew has inside help.' Three banks operate in the area: First National Bank (downtown district), River City Savings (waterfront district), and Metro Community Bank (residential district). The investigation begins now."
    },

    // === BANK SECURITY ASSESSMENTS ===
    {
        id: "first_national_security",
        requires: ["bank.first_national_visited"],
        content: " First National Bank security assessment: State-of-the-art camera system covering all approaches, bulletproof glass at teller stations, armed guards at entrance and vault access. Vault requires simultaneous authorization from two senior staff members. The building is modern and well-maintained."
    },
    {
        id: "first_national_context",
        requires: ["bank.first_national_visited"],
        content: " First National Bank is the largest and most secure bank in the downtown district. It has been in the news recently regarding proposed mergers with smaller community banks."
    },
    {
        id: "river_city_security",
        requires: ["bank.river_city_visited"],
        content: " River City Savings security assessment: 1960s-era vault with a manual locking mechanism, limited camera coverage (main lobby and vault room only), single unarmed guard at entrance. A back door leads to an alleyway connecting to waterfront streets. The regular manager is on emergency medical leave; a temporary manager is filling in and is unfamiliar with the branch operations."
    },
    {
        id: "metro_security",
        requires: ["bank.metro_visited"],
        content: " Metro Community Bank security assessment: Modern vault but visible from the teller line, single security guard covering both entrance and vault room, residential street access in multiple directions, no bulletproof glass at teller stations. A small branch with fewer staff but quicker customer response times."
    },
    {
        id: "metro_sarah_mention",
        requires: ["bank.metro_visited"],
        content: " The branch manager, Sarah Williams, has been with Metro Community for five years and handles daily operations including vault access procedures."
    },

    // === WITNESS TESTIMONY ===
    {
        id: "thomas_account",
        requires: ["witness.thomas_interviewed"],
        content: " Security Guard Thomas Anderson at First National Bank states: 'Three days ago, a man in a dark jacket was photographing the building exterior. He focused on the security cameras and the entrance. He left quickly when I started walking toward him. At the time I thought he might be doing an architectural study or insurance assessment.'"
    },
    {
        id: "maria_account",
        requires: ["witness.maria_interviewed"],
        content: " Customer Maria Rodriguez at River City Savings states: 'For four days, two people have been sitting in a silver sedan across the street from the bank. One writes in a notebook constantly, the other makes phone calls. They leave whenever anyone approaches them or enters the bank. I mentioned it to the temporary manager but he said they were probably just customers waiting and did not look into it.'"
    },
    {
        id: "sarah_observations",
        requires: ["witness.sarah_interviewed"],
        requiresNone: ["witness.sarah_cooperative"],
        content: " Metro Community Bank manager Sarah Williams appears visibly stressed. She has been checking vault access logs repeatedly, stepping away for private phone calls during working hours, and becomes visibly uncomfortable when asked about routine procedures. She gives short, deflecting answers to direct questions."
    },

    // === SARAH'S FULL STATEMENT (after confrontation) ===
    {
        id: "sarah_statement",
        requires: ["witness.sarah_cooperative"],
        content: " Sarah Williams provided a full statement: 'Two weeks ago, a man named James Mercer contacted me. He knew about my gambling debts and said he would tell my family and my employer if I did not cooperate. He gave me instructions for the vault combination and showed me how to disable the security cameras using the manager override. He said the robbery would happen at 2 PM today.'"
    },

    // === EVIDENCE AND CONNECTIONS ===
    {
        id: "crew_background",
        requires: ["evidence.mercer_identified"],
        content: " James Mercer has prior charges for armed robbery (2019, 2021) and assault (2020), primarily targeting retail establishments. His associate Carlos Mendez has multiple DUI and fleeing-and-eluding charges. Mercer operates out of the warehouse district. Both are considered armed and dangerous."
    },
    {
        id: "financial_trail",
        requires: ["evidence.financial_trail"],
        content: " Financial records show Sarah Williams' gambling debts were financed through offshore accounts tied to a shell corporation. The corporation is controlled by Marcus Thorne, CEO of First National Bank. First National has publicly proposed acquiring Metro Community Bank in upcoming merger discussions."
    },
    {
        id: "orchestrator_reveal",
        requires: ["evidence.orchestrator_named"],
        content: " Marcus Thorne, CEO of First National Bank, arranged the robbery of Metro Community Bank through intermediaries. His objective was to damage Metro Community's standing and reduce its acquisition value, enabling First National to absorb it at a reduced price in the pending merger."
    },
    {
        id: "case_resolution",
        requires: ["case.resolved"],
        content: " The investigation is complete. Marcus Thorne has been taken into custody on charges of conspiracy, orchestration of armed robbery, and extortion. James Mercer and Carlos Mendez are in custody. Sarah Williams is cooperating with prosecutors in exchange for reduced charges. The merger between First National and Metro Community has been halted pending regulatory review."
    },

    // === HIDDEN CLUES (revealed at higher canon counts) ===
    {
        id: "hidden_sedan_detail",
        requires: ["witness.maria_interviewed"],
        minCanon: 3,
        content: " On closer review of Maria Rodriguez's account, the silver sedan had a dealer plate frame from a lot in the warehouse district — the same area where James Mercer is known to operate."
    },
    {
        id: "hidden_camera_gap",
        requires: ["bank.river_city_visited", "witness.thomas_interviewed"],
        minCanon: 4,
        content: " Cross-referencing Thomas Anderson's account with the bank assessments: First National's camera system would detect the kind of reconnaissance he described. River City Savings' limited camera coverage would not. This suggests the crew was evaluating which bank lacked sufficient surveillance."
    },

    // === CONDITIONAL: ROBBERY OUTCOME ===
    {
        id: "robbery_prevented",
        requires: ["evidence.orchestrator_named"],
        requiresNone: ["case.resolved"],
        minHour: 14,
        content: " The 2 PM window has passed. Because the orchestrator was identified before the robbery could be executed, law enforcement was positioned to intercept the crew. The robbery was prevented."
    },
    {
        id: "robbery_occurred",
        requires: ["bank.metro_visited"],
        requiresNone: ["evidence.orchestrator_named"],
        minHour: 14,
        content: " The 2 PM window has passed. Without sufficient advance warning to law enforcement, the robbery was carried out at Metro Community Bank. The vault was breached using inside knowledge. The investigation continues."
    }
];


/* ============================================================================
   [SECTION] DROP-IN/DROP-OUT ENTITIES
   SAFE TO EDIT: Yes

   Witnesses and locations that activate when mentioned. Their presence adds
   behavioral guidance to the scene.
   ========================================================================== */

const ENTITIES = [
    {
        name: "Thomas Anderson",
        keywords: ["thomas", "anderson", "security guard"],
        activeBehavior: " Thomas Anderson is a professional security guard who speaks in direct, factual terms. He reports only what he personally witnessed and does not speculate.",
        requiresAll: ["bank.first_national_visited"]
    },
    {
        name: "Maria Rodriguez",
        keywords: ["maria", "rodriguez"],
        activeBehavior: " Maria Rodriguez is an observant bank customer who speaks plainly. She describes what she has seen without drawing conclusions about what it means.",
        requiresAll: ["bank.river_city_visited"]
    },
    {
        name: "Sarah Williams",
        keywords: ["sarah", "williams", "branch manager", "manager"],
        activeBehavior: " Sarah Williams is visibly stressed. She deflects questions and provides minimal information unless confronted with evidence.",
        requiresAll: ["bank.metro_visited"],
        requiresNone: ["witness.sarah_cooperative"],
        altBehavior: {
            requiresAll: ["witness.sarah_cooperative"],
            behavior: " Sarah Williams is now cooperative. She answers questions fully and appears genuinely remorseful."
        }
    }
];


/* ============================================================================
   [SECTION] ANTI-OMNISCIENCE INSTRUCTIONS
   SAFE TO EDIT: Text only (keep the structure)
   ========================================================================== */

const ANTI_OMNISCIENCE_INSTRUCTIONS = `<INFORMATION BOUNDARIES>
{{char}} operates within strict information limits:
1. Only reference details that have been explicitly stated in the conversation or provided by the script system.
2. Do not speculate about character motives, hidden relationships, or plot developments unless those have been discovered through investigation.
3. Each character knows only what they have personally experienced or been directly told. They cannot recall events they did not witness.
4. When information is missing or uncertain, acknowledge the gap plainly ("That is not clear yet," "More information is needed") rather than filling it with inference.
5. Do not hint at, foreshadow, or prepare the player for information that has not yet been discovered.
6. Do not label information as suspicious, significant, misleading, or important. Present observations neutrally and let the player draw conclusions.
7. Environmental descriptions should reflect only what is visible and known in the current moment.
</INFORMATION BOUNDARIES>`;


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

const text = (typeof last_message === "string") ? last_message.toLowerCase() : "";

// Get recent messages for context
let recentMsgs = [];
if (typeof last_messages !== "undefined" && Array.isArray(last_messages)) {
    recentMsgs = last_messages;
} else if (HAS_TOOLS && tools.chat && typeof tools.chat.recent === "function") {
    recentMsgs = _safe(() => tools.chat.recent(5), []);
}


/* ============================================================================
   [SECTION] FIRST-RUN INITIALIZATION
   ========================================================================== */

if (!tools.game.hasFlag("investigation_started")) {
    tools.game.flag("investigation_started");
    if (TIMELINE_ENABLED) tools.game.set("hour", 0);
    if (CANON_TRACKING) tools.game.set("canon_count", 0);
}


/* ============================================================================
   [SECTION] FLAG TRIGGER PROCESSING
   ========================================================================== */

const events = [];

function checkFlagTrigger(trigger) {
    // Check if any keyword matches
    const matched = trigger.keywords.some(kw => text.includes(kw));
    if (!matched) return false;

    // Check prerequisites
    if (trigger.requiresAll) {
        for (const f of trigger.requiresAll) {
            if (!tools.game.hasFlag(f)) return false;
        }
    }
    if (trigger.requiresAny) {
        const hasAny = trigger.requiresAny.some(f => tools.game.hasFlag(f));
        if (!hasAny) return false;
    }
    if (trigger.requiresNone) {
        for (const f of trigger.requiresNone) {
            if (tools.game.hasFlag(f)) return false;
        }
    }

    return true;
}

for (const trigger of FLAG_TRIGGERS) {
    if (checkFlagTrigger(trigger)) {
        for (const flag of trigger.setsFlags) {
            tools.game.flag(flag);
        }
        if (CANON_TRACKING) {
            tools.game.inc("canon_count", 1);
        }
        events.push("[DISCOVERY] " + trigger.description);
    }
}


/* ============================================================================
   [SECTION] TIMELINE PROGRESSION
   ========================================================================== */

if (TIMELINE_ENABLED) {
    const currentHour = tools.game.get("hour", 0);

    // Check for time-advancing actions
    let hoursAdvanced = 0;
    for (const entry of TIME_ADVANCING_KEYWORDS) {
        if (entry.keywords.some(kw => text.includes(kw))) {
            hoursAdvanced = Math.max(hoursAdvanced, entry.hours);
            break;
        }
    }

    if (hoursAdvanced > 0) {
        tools.game.set("hour", currentHour + hoursAdvanced);
    }
}


/* ============================================================================
   [SECTION] CONTENT NODE ACTIVATION
   ========================================================================== */

const currentHour = TIMELINE_ENABLED ? tools.game.get("hour", 0) : 0;
const canonCount = CANON_TRACKING ? tools.game.get("canon_count", 0) : 0;

function nodeRequirementsMet(node) {
    // requires: all flags must be set
    if (node.requires) {
        for (const f of node.requires) {
            if (!tools.game.hasFlag(f)) return false;
        }
    }

    // requiresAny: at least one flag must be set
    if (node.requiresAny) {
        const hasAny = node.requiresAny.some(f => tools.game.hasFlag(f));
        if (!hasAny) return false;
    }

    // requiresNone: none of these flags may be set
    if (node.requiresNone) {
        for (const f of node.requiresNone) {
            if (tools.game.hasFlag(f)) return false;
        }
    }

    // minHour: in-game hour must be >= N
    if (node.minHour != null && currentHour < node.minHour) return false;

    // minCanon: cumulative clue count must be >= N
    if (HIDDEN_CLUES && node.minCanon != null && canonCount < node.minCanon) return false;

    return true;
}

const activatedNodes = [];
for (const node of CONTENT_NODES) {
    if (nodeRequirementsMet(node)) {
        activatedNodes.push(node);
    }
}


/* ============================================================================
   [SECTION] DROP-IN/DROP-OUT ENTITY PROCESSING
   ========================================================================== */

const activeEntities = [];

for (const entity of ENTITIES) {
    // Check flag prerequisites
    if (entity.requiresAll) {
        const allMet = entity.requiresAll.every(f => tools.game.hasFlag(f));
        if (!allMet) continue;
    }

    // Check if mentioned in current message
    const mentioned = entity.keywords.some(kw => text.includes(kw));
    if (!mentioned) continue;

    // Determine behavior (check altBehavior conditions)
    let behavior = entity.activeBehavior;
    if (entity.altBehavior) {
        let altConditionsMet = true;
        if (entity.altBehavior.requiresAll) {
            altConditionsMet = entity.altBehavior.requiresAll.every(f => tools.game.hasFlag(f));
        }
        if (altConditionsMet) {
            behavior = entity.altBehavior.behavior;
        }
    }

    activeEntities.push({ name: entity.name, behavior });
}


/* ============================================================================
   [SECTION] TIMELINE CONTENT
   ========================================================================== */

let timelineContent = "";
if (TIMELINE_ENABLED) {
    for (const event of TIMELINE_EVENTS) {
        if (currentHour >= event.minHour && currentHour < event.maxHour) {
            timelineContent = event.content;
            break;
        }
    }
}


/* ============================================================================
   [SECTION] ASSEMBLE OUTPUT
   ========================================================================== */

const parts = [];

// --- Investigation status ---
const allFlags = tools.game.flags();
const investigationFlags = allFlags.filter(f => f !== "investigation_started");

let statusBlock = `[INVESTIGATION STATUS]\n`;
statusBlock += `Flags: ${investigationFlags.length > 0 ? investigationFlags.join(", ") : "none"}\n`;
if (TIMELINE_ENABLED) {
    const h = tools.game.get("hour", 0);
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const ampm = h >= 12 ? "PM" : "AM";
    statusBlock += `Time: ${displayHour}:00 ${ampm} (Hour ${h})\n`;
}
if (CANON_TRACKING) {
    statusBlock += `Clues Discovered: ${canonCount}\n`;
}
statusBlock += `Case: ${tools.game.hasFlag("case.resolved") ? "RESOLVED" : "OPEN"}`;

parts.push(statusBlock);

// --- Progress guidance ---
let guidance = "[GUIDANCE] ";
if (!tools.game.hasFlag("bank.first_national_visited") && !tools.game.hasFlag("bank.river_city_visited") && !tools.game.hasFlag("bank.metro_visited")) {
    guidance += "The player should visit the three banks to assess their security. Guide them toward First National, River City Savings, or Metro Community.";
} else {
    const visited = [];
    if (tools.game.hasFlag("bank.first_national_visited")) visited.push("First National");
    if (tools.game.hasFlag("bank.river_city_visited")) visited.push("River City");
    if (tools.game.hasFlag("bank.metro_visited")) visited.push("Metro Community");
    const unvisited = [];
    if (!tools.game.hasFlag("bank.first_national_visited")) unvisited.push("First National");
    if (!tools.game.hasFlag("bank.river_city_visited")) unvisited.push("River City");
    if (!tools.game.hasFlag("bank.metro_visited")) unvisited.push("Metro Community");

    if (unvisited.length > 0) {
        guidance += `Visited: ${visited.join(", ")}. Remaining: ${unvisited.join(", ")}.`;
    } else if (!tools.game.hasFlag("witness.thomas_interviewed") || !tools.game.hasFlag("witness.maria_interviewed") || !tools.game.hasFlag("witness.sarah_interviewed")) {
        guidance += "All banks assessed. Interview witnesses at each location for more information.";
    } else if (!tools.game.hasFlag("witness.sarah_cooperative")) {
        guidance += "Witnesses interviewed. Sarah Williams is evasive — the player should confront her with evidence from other witnesses.";
    } else if (!tools.game.hasFlag("evidence.orchestrator_named")) {
        guidance += "Sarah has cooperated. Follow up on James Mercer and trace the financial connections to identify who is behind this.";
    } else if (!tools.game.hasFlag("case.resolved")) {
        guidance += "The orchestrator has been identified. The player can now move to arrest and resolve the case.";
    } else {
        guidance += "The case is resolved. Reflect on the investigation and its outcome.";
    }
}
parts.push(guidance);

// --- Discovery events ---
for (const event of events) {
    parts.push(event);
}

// --- Timeline context ---
if (timelineContent) {
    parts.push("[TIMELINE]" + timelineContent);
}

// --- Content nodes ---
let contentText = "";
for (const node of activatedNodes) {
    contentText += node.content + "\n";
}
if (contentText.trim()) {
    parts.push("[KNOWN FACTS]" + contentText.trim());
}

// --- Active entity behaviors ---
for (const entity of activeEntities) {
    parts.push(`[CHARACTER: ${entity.name}]${entity.behavior}`);
}

// --- Anti-omniscience instructions ---
if (ANTI_OMNISCIENCE) {
    parts.push(ANTI_OMNISCIENCE_INSTRUCTIONS);
}


/* ============================================================================
   [SECTION] DEBUG
   ========================================================================== */

if (DEBUG_MODE) {
    let debug = "[DBG]\n";
    debug += `Flags: ${allFlags.join(", ")}\n`;
    debug += `Hour: ${currentHour}, Canon: ${canonCount}\n`;
    debug += `Active nodes: ${activatedNodes.map(n => n.id).join(", ")}\n`;
    debug += `Active entities: ${activeEntities.map(e => e.name).join(", ")}`;
    parts.push(debug);
}


/* ============================================================================
   [SECTION] FLUSH
   ========================================================================== */

output = parts.join("\n\n").trim().slice(0, MAX_OUTPUT);

// Close HAS_TOOLS guard
}
