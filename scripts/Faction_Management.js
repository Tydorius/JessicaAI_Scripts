/**
 * FACTION MANAGEMENT for JessicaAI
 *
 * Two-mode faction governance system: Normal roleplay with invisible stat
 * tracking, and /faction mode for a full management interface with slash
 * commands for construction, recruitment, research, diplomacy, and operations.
 *
 * Designed for any scenario involving faction governance: kingdoms, merchant
 * guilds, mercenary companies, criminal organizations, political parties,
 * or corporate entities.
 *
 * Systems:
 * - Two-mode operation (roleplay vs management interface)
 * - Project system with prerequisites and upgrade paths
 * - Scalable project slots (2 -> 4 -> 6 via upgrades)
 * - Diplomacy with stance/treaty tracking for up to 6 factions
 * - Resource management with passive generation and upkeep
 * - Population tracking with recruitment costs
 * - Stat keyword detection in normal mode
 * - Day-based timeline events
 * - Lore activation engine with cascading triggers
 *
 * KEY DIFFERENCE FROM JANITORAI:
 * - All state is in tools.game/tools.status — no zero-width encoding
 * - No packed digit strings — structured JSON values
 * - No [PERSISTENT MEMORY] reproduction instructions
 * - No stat-block parsing — everything is server-side
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
let MAX_OUTPUT = 3800;       // output character cap
let LORE_ENGINE = 1;         // 1 = keyword-triggered lore activation (normal mode)
let STAT_KEYWORDS = 1;       // 1 = detect stat-changing keywords in normal mode
let TIME_TRACKING = 1;       // 1 = day advancement detection
let TIMELINE_EVENTS = 1;     // 1 = day-based scripted events


/* ============================================================================
   [SECTION] FACTION DEFINITIONS
   SAFE TO EDIT: Yes

   Define your faction's stats, resources, population types, and starting values.
   ========================================================================== */

const STAT_NAMES = ["Force", "Security", "Knowledge", "Technology", "Wealth", "Reputation", "Opposition"];
const STAT_DEFAULTS = [10, 25, 15, 5, 10, 5, 2];

const RESOURCE_NAMES = ["Funds", "Materials", "Arms", "Supplies", "Provisions"];
const RESOURCE_DEFAULTS = [15, 20, 10, 15, 25];

const POP_NAMES = ["Soldiers", "Operatives", "Scholars", "Morale"];
const POP_DEFAULTS = [10, 20, 5, 50];

const STAT_CAP = 99;
const RESOURCE_CAP = 99;
const POP_CAP = 99;
const MORALE_CAP = 99;


/* ============================================================================
   [SECTION] PROJECT TABLE
   SAFE TO EDIT: Yes

   Buildings and upgrades the player can construct.
   - id: unique identifier
   - cost: { funds, materials, arms, supplies, provisions }
   - requires: project id that must be completed first (or null)
   - statEffect: { statName: delta } applied on completion
   - passiveGen: { resourceName: dailyAmount } after completion
   - popEffect: { popName: count } added on completion
   - special: "slots4" or "slots6" to increase project slot count
   ========================================================================== */

const PROJECT_TABLE = [
    { id: "fortify_base",       name: "Fortify Base",           duration: 14, cost: {materials:10, arms:5},                    requires: null,            statEffect: {Security:10} },
    { id: "expand_barracks",    name: "Expand Barracks",        duration: 10, cost: {funds:3, materials:5, arms:2, supplies:8}, requires: null,            statEffect: {},                popEffect: {Soldiers:5} },
    { id: "watch_post",         name: "Build Watch Post",       duration: 7,  cost: {materials:3, supplies:5},                  requires: null,            statEffect: {Security:5} },
    { id: "resource_site",      name: "Establish Resource Site",duration: 12, cost: {arms:3, supplies:5},                       requires: null,            statEffect: {},                passiveGen: {Arms:2} },
    { id: "workshop",           name: "Create Workshop",        duration: 10, cost: {funds:2, materials:8, arms:5},             requires: null,            statEffect: {Technology:5} },
    { id: "supply_depot",       name: "Build Supply Depot",     duration: 8,  cost: {materials:2, supplies:3},                  requires: null,            statEffect: {},                passiveGen: {Provisions:2} },
    { id: "ward_array",         name: "Erect Ward Array",       duration: 14, cost: {funds:5, arms:3},                          requires: null,            statEffect: {Knowledge:10, Security:5} },
    { id: "vault",              name: "Expand Vault",           duration: 12, cost: {funds:3, materials:10},                    requires: null,            statEffect: {},                passiveGen: {Funds:1} },
    { id: "archive",            name: "Build Archive",          duration: 16, cost: {funds:5, materials:3, supplies:8},         requires: null,            statEffect: {Technology:5, Knowledge:5} },
    { id: "trade_hub",          name: "Construct Trade Hub",    duration: 20, cost: {funds:5, arms:10, supplies:10},            requires: null,            statEffect: {Reputation:5},    passiveGen: {Funds:2} },
    { id: "command_center",     name: "Repair Command Center",  duration: 18, cost: {funds:8, materials:5, arms:5},             requires: null,            statEffect: {Knowledge:10} },
    { id: "command_upgrade_1",  name: "Upgrade Command I",      duration: 21, cost: {funds:5, materials:5, arms:3, supplies:3}, requires: "command_center", statEffect: {},                special: "slots4" },
    { id: "command_upgrade_2",  name: "Upgrade Command II",     duration: 35, cost: {funds:10, materials:10, arms:8, supplies:8},requires: "command_upgrade_1", statEffect: {},             special: "slots6" },
    { id: "training_ground",    name: "Build Training Ground",  duration: 12, cost: {funds:2, materials:4, arms:3, supplies:5}, requires: null,            statEffect: {Force:1},         popEffect: {Soldiers:3} },
    { id: "trade_route",        name: "Establish Trade Route",  duration: 10, cost: {funds:3, materials:2, supplies:2},         requires: null,            statEffect: {Wealth:3},        passiveGen: {Funds:1} },
    { id: "upgrade_workshop",   name: "Upgrade Workshop",       duration: 14, cost: {funds:5, materials:5, arms:8},             requires: "workshop",      statEffect: {Technology:5},    passiveGen: {Arms:1} },
    { id: "upgrade_archive",    name: "Upgrade Archive",        duration: 18, cost: {funds:8, materials:3, supplies:10},        requires: "archive",       statEffect: {Knowledge:5, Technology:5}, popEffect: {Scholars:3} },
    { id: "upgrade_supply",     name: "Upgrade Supply Depot",   duration: 10, cost: {funds:2, supplies:5},                      requires: "supply_depot",  statEffect: {},                passiveGen: {Provisions:3} },
    { id: "upgrade_resource",   name: "Upgrade Resource Site",  duration: 12, cost: {funds:3, arms:5, supplies:3},              requires: "resource_site", statEffect: {},                passiveGen: {Arms:3} },
    { id: "upgrade_barracks",   name: "Upgrade Barracks",       duration: 14, cost: {funds:5, materials:8, arms:3, supplies:5}, requires: "expand_barracks", statEffect: {Force:2},       popEffect: {Soldiers:10} }
];

// Build aliases: lowercase phrases players might type -> project id
const BUILD_ALIASES = {
    "fortify": "fortify_base", "base": "fortify_base", "fortification": "fortify_base",
    "barracks": "expand_barracks",
    "watch": "watch_post", "watchtower": "watch_post", "tower": "watch_post",
    "mine": "resource_site", "resource": "resource_site",
    "workshop": "workshop", "forge": "workshop", "smithy": "workshop",
    "supply": "supply_depot", "depot": "supply_depot", "farm": "supply_depot",
    "ward": "ward_array", "wards": "ward_array",
    "vault": "vault", "treasury": "vault",
    "archive": "archive", "library": "archive",
    "trade hub": "trade_hub", "hub": "trade_hub", "market": "trade_hub", "dock": "trade_hub",
    "command center": "command_center", "command": "command_center", "headquarters": "command_center",
    "command i": "command_upgrade_1", "command upgrade": "command_upgrade_1",
    "command ii": "command_upgrade_2", "command2": "command_upgrade_2",
    "training": "training_ground", "training ground": "training_ground",
    "trade route": "trade_route", "route": "trade_route",
    "upgrade workshop": "upgrade_workshop", "improve workshop": "upgrade_workshop",
    "upgrade archive": "upgrade_archive", "university": "upgrade_archive",
    "upgrade supply": "upgrade_supply", "upgrade depot": "upgrade_supply",
    "upgrade resource": "upgrade_resource", "upgrade mine": "upgrade_resource",
    "upgrade barracks": "upgrade_barracks", "improve barracks": "upgrade_barracks"
};

const UPGRADE_IDS = ["upgrade_workshop", "upgrade_archive", "upgrade_supply", "upgrade_resource", "upgrade_barracks"];


/* ============================================================================
   [SECTION] RIVAL FACTIONS
   SAFE TO EDIT: Yes
   ========================================================================== */

const NATION_TABLE = [
    { id: 0, name: "The Northern Alliance", aliases: ["northern", "alliance", "north"] },
    { id: 1, name: "Eastern Federation",    aliases: ["eastern", "federation", "east"] },
    { id: 2, name: "Mountain Holdings",     aliases: ["mountain", "holdings", "dwarves", "dwarven"] },
    { id: 3, name: "Forest Territories",    aliases: ["forest", "territories", "elven", "elves"] },
    { id: 4, name: "Southern Tribes",       aliases: ["southern", "tribes", "south", "nomads"] },
    { id: 5, name: "Underground Network",   aliases: ["underground", "network", "syndicate"] }
];

const STANCE_NAMES = ["Unknown", "Hostile", "Unfriendly", "Neutral", "Cautious", "Friendly", "Allied", "Vassal"];
const TREATY_NAMES = ["None", "Non-Aggression Pact", "Trade Agreement", "Military Alliance", "Vassalage", "Secret Pact"];


/* ============================================================================
   [SECTION] ACTION COSTS
   SAFE TO EDIT: Yes
   ========================================================================== */

const RECRUIT_COSTS = {
    soldiers:   { funds: 3, provisions: 2 },
    military:   { funds: 3, provisions: 2 },
    troops:     { funds: 3, provisions: 2 },
    operatives: { funds: 1, provisions: 1 },
    workers:    { funds: 1, provisions: 1 },
    scholars:   { funds: 5, provisions: 1 },
    researchers:{ funds: 5, provisions: 1 }
};

const RESEARCH_ACTIONS = {
    knowledge:   { funds: 8, stat: "Knowledge",   delta: 2 },
    arcane:      { funds: 8, stat: "Knowledge",   delta: 2 },
    magic:       { funds: 8, stat: "Knowledge",   delta: 2 },
    technology:  { funds: 8, stat: "Technology",  delta: 2 },
    tech:        { funds: 8, stat: "Technology",  delta: 2 },
    security:    { funds: 5, stat: "Security",    delta: 2 },
    defense:     { funds: 5, stat: "Security",    delta: 2 },
    force:       { funds: 5, stat: "Force",       delta: 2 },
    military:    { funds: 5, stat: "Force",       delta: 2 }
};

const MILITARY_ACTIONS = {
    train:  { funds: 0, provisions: 3, stat: "Force",    delta: 1 },
    patrol: { funds: 0, provisions: 1, stat: "Security", delta: 1 },
    raid:   { funds: 3, provisions: 5, stat: "Force",    delta: 3, diplomacyDelta: -1 }
};

const MANAGE_ACTIONS = {
    tax:      { fundsGain: 5,  provisionsGain: 0, fundsCost: 0, provisionsCost: 0, moraleDelta: -3, reputationDelta: 0 },
    ration:   { fundsGain: 0,  provisionsGain: 3, fundsCost: 0, provisionsCost: 0, moraleDelta: -2, reputationDelta: 0 },
    feast:    { fundsGain: 0,  provisionsGain: 0, fundsCost: 3, provisionsCost: 5, moraleDelta: 5,  reputationDelta: 1 },
    festival: { fundsGain: 0,  provisionsGain: 0, fundsCost: 5, provisionsCost: 8, moraleDelta: 8,  reputationDelta: 2 }
};

const DIPLOMACY_ACTIONS = {
    envoy:           { funds: 5,  stanceDelta: 1,  treatySet: null },
    negotiate:       { funds: 5,  stanceDelta: 1,  treatySet: null },
    threaten:        { funds: 0,  stanceDelta: -1, treatySet: null },
    intimidate:      { funds: 0,  stanceDelta: -1, treatySet: null },
    treaty:          { funds: 8,  stanceDelta: 0,  treatySet: 1 },
    "non-aggression":{ funds: 8,  stanceDelta: 0,  treatySet: 1 },
    trade:           { funds: 5,  stanceDelta: 1,  treatySet: 2 },
    alliance:        { funds: 10, stanceDelta: 2,  treatySet: 3 },
    "secret pact":   { funds: 8,  stanceDelta: 1,  treatySet: 5 }
};


/* ============================================================================
   [SECTION] STAT KEYWORDS (Normal Mode)
   SAFE TO EDIT: Yes
   ========================================================================== */

const STAT_KEYWORD_MAP = {
    Force:       { increase: ["train", "recruit", "mobilize", "conscript", "drill", "marshal"],    decrease: ["defeated", "routed", "casualties", "desert", "ambush"], delta: 1 },
    Security:    { increase: ["fortify", "reinforce", "barricade", "entrench", "secure", "ward"],  decrease: ["breached", "damaged", "collapsed", "infiltrated"],       delta: 1 },
    Knowledge:   { increase: ["ritual", "enchant", "study", "summon", "research", "meditate"],      decrease: ["dispelled", "failed ritual", "lost knowledge"],          delta: 1 },
    Technology:  { increase: ["invent", "craft", "engineer", "design", "fabricate"],                 decrease: ["sabotage", "blueprint lost", "workshop destroyed"],      delta: 1 },
    Wealth:      { increase: ["trade route", "merchant", "tax collection", "market", "caravan"],    decrease: ["embargo", "trade disrupted", "treasury raided"],         delta: 1 },
    Reputation:  { increase: ["diplomacy", "alliance formed", "negotiate", "convince", "persuade"],  decrease: ["scandal", "betrayed", "reputation damaged"],             delta: 1 }
};

const TIME_KEYWORDS = {
    nextDay:     ["next day", "next morning", "wake up", "the following day", "dawn breaks", "sun rises", "a new day"],
    multipleDay: ["days later", "days pass", "a week later", "several days", "after a fortnight", "week passes"],
    hoursPass:   ["hours pass", "later that day", "by evening", "by afternoon", "by nightfall"]
};


/* ============================================================================
   [SECTION] LORE ENTRIES (Normal Mode)
   SAFE TO EDIT: Yes
   ========================================================================== */

const LORE_ENTRIES = [
    { keywords: ["northern alliance", "the alliance", "north faction"], priority: 10, scenario: " The Northern Alliance is a coalition of powerful states that publicly champions order and stability. In practice, they use military and economic dominance to control weaker neighbors.", triggers: ["politics", "coalition"] },
    { keywords: ["eastern federation", "the federation", "east faction"], priority: 9, scenario: " The Eastern Federation is a sprawling state with a massive, stratified class system. It constantly pushes its borders outward, absorbing smaller territories.", triggers: ["hierarchy", "expansion"] },
    { keywords: ["mountain holdings", "mountain faction"], priority: 9, scenario: " The Mountain Holdings is a merchant oligarchy governed by a council of the wealthiest families. Its economic might is built on mineral wealth and manufacturing.", triggers: ["merchant", "commerce"] },
    { keywords: ["forest territories", "forest faction"], priority: 9, scenario: " The Forest Territories is an ancient domain that prefers subtle manipulation over open conflict. They see themselves as caretakers, a justification for interfering.", triggers: ["tradition", "ancient"] },
    { keywords: ["headquarters", "base", "command center"], priority: 11, minMessages: 1, scenario: " The faction headquarters serves as the nerve center for all operations. When occupied, it provides bonuses to all governance actions.", triggers: ["governance", "command"] },
    { keywords: ["vault", "treasury", "stronghold"], priority: 10, minMessages: 2, filters: { requiresAny: ["wealth", "resource", "treasure"] }, scenario: " The vault combines secure storage and resource management. Its contents fuel the faction's operations." }
];


/* ============================================================================
   [SECTION] TIMELINE EVENTS
   SAFE TO EDIT: Yes
   ========================================================================== */

const TIMELINE = [
    { day: 1,  text: " [Faction Event] The faction establishes its base of operations. The surrounding powers take notice of this new player on the board." },
    { day: 7,  text: " [Faction Event] A week has passed. Rival factions begin gathering intelligence. Scouts and spies are dispatched." },
    { day: 14, text: " [Faction Event] Two weeks have passed. The Northern Alliance convenes to discuss the emerging power." },
    { day: 21, text: " [Faction Event] Three weeks have passed. Public sentiment shifts. Some see the faction as a threat, others as a potential ally." },
    { day: 30, text: " [Faction Event] A month has passed. Underground networks begin sending feelers toward the faction, sensing opportunity." },
    { day: 60, text: " [Faction Event] Two months have passed. Rival factions have completed their assessment and are formulating direct responses." },
    { day: 90, text: " [Faction Event] Three months have passed. Open conflict or alliance negotiations become increasingly likely." }
];


// ============================================================================
// DO NOT EDIT BELOW THIS LINE — ENGINE CODE
// ============================================================================


/* ============================================================================
   [SECTION] STATE ACCESS WRAPPERS
   ========================================================================== */

function _safe(fn, fallback) {
    try { const v = fn(); return v == null ? fallback : v; }
    catch(e) { return fallback; }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Stats
function getStat(name) { return _safe(() => tools.status.get("stat." + name, STAT_DEFAULTS[STAT_NAMES.indexOf(name)] || 0), 0); }
function setStat(name, val) { _safe(() => tools.status.set("stat." + name, clamp(val, 0, STAT_CAP)), false); }
function adjustStat(name, delta) {
    const idx = STAT_NAMES.indexOf(name);
    if (idx < 0) return;
    const current = getStat(name);
    setStat(name, current + delta);
}

// Resources
function getResource(name) { return _safe(() => tools.status.get("res." + name, RESOURCE_DEFAULTS[RESOURCE_NAMES.indexOf(name)] || 0), 0); }
function setResource(name, val) { _safe(() => tools.status.set("res." + name, clamp(val, 0, RESOURCE_CAP)), false); }
function adjustResource(name, delta) {
    const idx = RESOURCE_NAMES.indexOf(name);
    if (idx < 0) return;
    setResource(name, getResource(name) + delta);
}

// Population
function getPop(name) { return _safe(() => tools.status.get("pop." + name, POP_DEFAULTS[POP_NAMES.indexOf(name)] || 0), 0); }
function setPop(name, val) {
    const cap = name === "Morale" ? MORALE_CAP : POP_CAP;
    _safe(() => tools.status.set("pop." + name, clamp(val, 0, cap)), false);
}
function adjustPop(name, delta) { setPop(name, getPop(name) + delta); }

// Mode / Day / Slots
function getMode() { return _safe(() => tools.game.get("mode", "normal"), "normal"); }
function setMode(m) { _safe(() => tools.game.set("mode", m), false); }

function getDay() { return _safe(() => tools.game.get("day", 1), 1); }
function setDay(d) { _safe(() => tools.game.set("day", d), false); }

function getMaxSlots() { return _safe(() => tools.game.get("maxSlots", 2), 2); }
function setMaxSlots(v) { _safe(() => tools.game.set("maxSlots", v), false); }

function getStatsDisplay() { return _safe(() => tools.game.get("statsDisplay", 0), 0); }
function setStatsDisplay(v) { _safe(() => tools.game.set("statsDisplay", v), false); }

// Projects
function getProjects() { return _safe(() => tools.game.get("projects", []), []); }
function setProjects(arr) { _safe(() => tools.game.set("projects", arr), false); }

function getCompletedBuildings() { return _safe(() => tools.game.get("buildings", []), []); }
function setCompletedBuildings(arr) { _safe(() => tools.game.set("buildings", arr), false); }
function hasBuilding(id) { return getCompletedBuildings().indexOf(id) >= 0; }

// Diplomacy
function getDiplomacy(factionId) {
    const key = "diplo." + factionId;
    return _safe(() => tools.game.get(key, { stance: factionId < 4 ? 1 : 0, treaty: 0 }), { stance: 0, treaty: 0 });
}
function setDiplomacy(factionId, stance, treaty) {
    _safe(() => tools.game.set("diplo." + factionId, { stance: clamp(stance, 0, 7), treaty: clamp(treaty, 0, 5) }), false);
}
function adjustStance(factionId, delta) {
    const d = getDiplomacy(factionId);
    setDiplomacy(factionId, d.stance + delta, d.treaty);
}

// Cost helpers
function canAfford(cost) {
    if (cost.funds && getResource("Funds") < cost.funds) return false;
    if (cost.materials && getResource("Materials") < cost.materials) return false;
    if (cost.arms && getResource("Arms") < cost.arms) return false;
    if (cost.supplies && getResource("Supplies") < cost.supplies) return false;
    if (cost.provisions && getResource("Provisions") < cost.provisions) return false;
    return true;
}
function deductCost(cost) {
    if (cost.funds) adjustResource("Funds", -cost.funds);
    if (cost.materials) adjustResource("Materials", -cost.materials);
    if (cost.arms) adjustResource("Arms", -cost.arms);
    if (cost.supplies) adjustResource("Supplies", -cost.supplies);
    if (cost.provisions) adjustResource("Provisions", -cost.provisions);
}
function costString(cost) {
    const parts = [];
    if (cost.funds) parts.push(cost.funds + " Funds");
    if (cost.materials) parts.push(cost.materials + " Materials");
    if (cost.arms) parts.push(cost.arms + " Arms");
    if (cost.supplies) parts.push(cost.supplies + " Supplies");
    if (cost.provisions) parts.push(cost.provisions + " Provisions");
    return parts.join(", ") || "Free";
}

// Faction resolution
function resolveFaction(name) {
    for (const nation of NATION_TABLE) {
        if (nation.aliases.some(a => name.includes(a))) return nation.id;
    }
    return -1;
}

// Build name resolution
function resolveBuildProjects(args) {
    const projects = [];
    const tokens = args.split(/\s+/).filter(t => t.length > 0);
    let i = 0;
    while (i < tokens.length) {
        let matched = false;
        for (let len = Math.min(3, tokens.length - i); len >= 1; len--) {
            const phrase = tokens.slice(i, i + len).join(" ");
            if (BUILD_ALIASES[phrase]) {
                projects.push(BUILD_ALIASES[phrase]);
                i += len;
                matched = true;
                break;
            }
        }
        if (!matched) i++;
    }
    return projects;
}


/* ============================================================================
   [SECTION] FIRST-RUN INITIALIZATION
   ========================================================================== */

if (!tools.game.hasFlag("faction_started")) {
    tools.game.flag("faction_started");
    tools.game.set("mode", "normal");
    tools.game.set("day", 1);
    tools.game.set("maxSlots", 2);
    tools.game.set("statsDisplay", 0);
    tools.game.set("projects", []);
    tools.game.set("buildings", []);

    for (let i = 0; i < STAT_NAMES.length; i++) setStat(STAT_NAMES[i], STAT_DEFAULTS[i]);
    for (let i = 0; i < RESOURCE_NAMES.length; i++) setResource(RESOURCE_NAMES[i], RESOURCE_DEFAULTS[i]);
    for (let i = 0; i < POP_NAMES.length; i++) setPop(POP_NAMES[i], POP_DEFAULTS[i]);

    for (let n = 0; n < NATION_TABLE.length; n++) {
        setDiplomacy(n, n < 4 ? 1 : 0, 0);
    }
}


/* ============================================================================
   [SECTION] INPUT & COMMAND PARSING
   ========================================================================== */

const text = (typeof last_message === "string") ? last_message.toLowerCase().trim() : "";

let results = [];
let errors = [];
let dayIncrement = 0;

function parseCommands(msg) {
    const cmds = [];
    const regex = /\/(\w+)(?:\s+([^/]*?))?(?=\/|$)/gi;
    let match;
    while ((match = regex.exec(msg)) !== null) {
        cmds.push({ cmd: match[1].toLowerCase(), args: (match[2] || "").trim().toLowerCase() });
    }
    return cmds;
}

const parsedCommands = parseCommands(text);

// Process mode switches first
let mode = getMode();
let statsDisplay = getStatsDisplay();

for (const cmd of parsedCommands) {
    if (cmd.cmd === "faction") {
        mode = "faction";
        setMode("faction");
        results.push("Entered faction management mode.");
    } else if (cmd.cmd === "exit") {
        mode = "normal";
        setMode("normal");
        results.push("Exited faction management mode. Returning to roleplay.");
    } else if (cmd.cmd === "showstats") {
        statsDisplay = cmd.args === "verbose" ? 2 : 1;
        setStatsDisplay(statsDisplay);
        results.push("Stats display set to " + (statsDisplay === 2 ? "verbose" : "basic") + ".");
    } else if (cmd.cmd === "hidestats") {
        statsDisplay = 0;
        setStatsDisplay(0);
        results.push("Stats display hidden.");
    }
}


/* ============================================================================
   [SECTION] DAY ADVANCEMENT DETECTION (Normal Mode)
   ========================================================================== */

if (mode === "normal" || !parsedCommands.some(c => c.cmd === "faction")) {
    for (const kw of TIME_KEYWORDS.nextDay) {
        if (text.includes(kw)) { dayIncrement = Math.max(dayIncrement, 1); break; }
    }
    for (const kw of TIME_KEYWORDS.multipleDay) {
        if (text.includes(kw)) { dayIncrement = Math.max(dayIncrement, 3); break; }
    }
}


/* ============================================================================
   [SECTION] FACTION MODE COMMAND PROCESSING
   ========================================================================== */

if (mode === "faction") {
    for (const cmd of parsedCommands) {
        if (["faction", "exit", "showstats", "hidestats"].includes(cmd.cmd)) continue;

        if (cmd.cmd === "help") {
            results.push("COMMANDS: /build [project] | /upgrade [building] | /train [n] [type] | /research [field] | /diplomacy [faction] [action] | /espionage [faction] | /military [action] | /manage [action] | /endturn | /overview | /exit");

        } else if (cmd.cmd === "endturn") {
            dayIncrement = Math.max(dayIncrement, 1);
            results.push("End of turn. Advancing one day.");

        } else if (cmd.cmd === "overview") {
            results.push("[Displaying current faction status.]");

        } else if (cmd.cmd === "build" || cmd.cmd === "upgrade") {
            const isUpgrade = cmd.cmd === "upgrade";
            const projectIds = resolveBuildProjects(cmd.args);
            if (projectIds.length === 0) {
                errors.push((isUpgrade ? "Upgrade" : "Build") + ": No recognized project names. Type /help.");
                continue;
            }
            for (const pId of projectIds) {
                const project = PROJECT_TABLE.find(p => p.id === pId);
                if (!project) { errors.push("Unknown project."); continue; }
                if (isUpgrade && UPGRADE_IDS.indexOf(pId) < 0) { errors.push(project.name + " is not an upgrade."); continue; }
                if (!isUpgrade && UPGRADE_IDS.indexOf(pId) >= 0) { errors.push(project.name + " is an upgrade. Use /upgrade."); continue; }
                if (project.requires && !hasBuilding(project.requires)) {
                    const req = PROJECT_TABLE.find(p => p.id === project.requires);
                    errors.push(project.name + " requires " + (req ? req.name : "a prerequisite") + " first.");
                    continue;
                }
                const projects = getProjects();
                if (projects.length >= getMaxSlots()) { errors.push("No available project slots."); continue; }
                if (!canAfford(project.cost)) { errors.push("Insufficient resources for " + project.name + ". Cost: " + costString(project.cost)); continue; }
                deductCost(project.cost);
                projects.push({ id: project.id, elapsed: 0, total: project.duration });
                setProjects(projects);
                results.push((isUpgrade ? "Upgrade" : "Build") + ": Started " + project.name + " (" + project.duration + " days). " + costString(project.cost) + " deducted.");
            }

        } else if (cmd.cmd === "train" || cmd.cmd === "recruit") {
            const parts = cmd.args.split(/\s+/);
            let count = 1, type = parts[0];
            if (parts.length >= 2 && !isNaN(parseInt(parts[0]))) {
                count = clamp(parseInt(parts[0]), 1, 20);
                type = parts[1];
            }
            const costInfo = RECRUIT_COSTS[type];
            if (!costInfo) { errors.push("Unknown unit type. Use soldiers, operatives, or scholars."); continue; }
            const totalFunds = costInfo.funds * count, totalProv = costInfo.provisions * count;
            if (getResource("Funds") < totalFunds || getResource("Provisions") < totalProv) {
                errors.push("Insufficient resources. Need " + totalFunds + " Funds, " + totalProv + " Provisions."); continue;
            }
            adjustResource("Funds", -totalFunds);
            adjustResource("Provisions", -totalProv);
            if (type === "soldiers" || type === "military" || type === "troops") adjustPop("Soldiers", count);
            else if (type === "operatives" || type === "workers") adjustPop("Operatives", count);
            else if (type === "scholars" || type === "researchers") adjustPop("Scholars", count);
            results.push("Recruited " + count + " " + type + ". Cost: " + totalFunds + " Funds, " + totalProv + " Provisions.");

        } else if (cmd.cmd === "research") {
            const action = RESEARCH_ACTIONS[cmd.args];
            if (!action) { errors.push("Unknown field. Use knowledge, technology, security, or force."); continue; }
            if (getResource("Funds") < action.funds) { errors.push("Insufficient funds. Need " + action.funds); continue; }
            adjustResource("Funds", -action.funds);
            adjustStat(action.stat, action.delta);
            results.push("Invested in " + action.stat + " (" + action.funds + " Funds). " + action.stat + " +" + action.delta + ".");

        } else if (cmd.cmd === "diplomacy") {
            const parts = cmd.args.split(/\s+/);
            const factionIdx = resolveFaction(parts[0]);
            const actionName = parts.slice(1).join(" ");
            if (factionIdx < 0) { errors.push("Unknown faction."); continue; }
            const action = DIPLOMACY_ACTIONS[actionName];
            if (!action) { errors.push("Unknown action. Use envoy, threaten, treaty, trade, alliance, or secret pact."); continue; }
            if (getResource("Funds") < action.funds) { errors.push("Insufficient funds. Need " + action.funds); continue; }
            adjustResource("Funds", -action.funds);
            adjustStance(factionIdx, action.stanceDelta);
            if (action.treatySet !== null) {
                const d = getDiplomacy(factionIdx);
                setDiplomacy(factionIdx, d.stance, action.treatySet);
            }
            const dip = getDiplomacy(factionIdx);
            results.push(actionName + " with " + NATION_TABLE[factionIdx].name + ". Stance: " + STANCE_NAMES[dip.stance] + (action.funds ? " (" + action.funds + " Funds)" : ""));

        } else if (cmd.cmd === "espionage") {
            const factionIdx = resolveFaction(cmd.args);
            if (factionIdx < 0) { errors.push("Unknown faction."); continue; }
            if (getResource("Funds") < 5) { errors.push("Insufficient funds. Need 5."); continue; }
            adjustResource("Funds", -5);
            results.push("Spying on " + NATION_TABLE[factionIdx].name + ". 5 Funds spent.");

        } else if (cmd.cmd === "military") {
            const parts = cmd.args.split(/\s+/);
            const action = MILITARY_ACTIONS[parts[0]];
            if (!action) { errors.push("Unknown action. Use train, patrol, or raid."); continue; }
            if (getResource("Funds") < (action.funds || 0) || getResource("Provisions") < (action.provisions || 0)) {
                errors.push("Insufficient resources."); continue;
            }
            adjustResource("Funds", -(action.funds || 0));
            adjustResource("Provisions", -(action.provisions || 0));
            adjustStat(action.stat, action.delta);
            if (action.diplomacyDelta && parts[1]) {
                const fIdx = resolveFaction(parts.slice(1).join(" "));
                if (fIdx >= 0) {
                    adjustStance(fIdx, action.diplomacyDelta);
                    results.push(parts[0] + " against " + NATION_TABLE[fIdx].name + ". " + action.stat + " +" + action.delta + ". Relations worsened.");
                    continue;
                }
            }
            results.push(parts[0] + " completed. " + action.stat + " +" + action.delta + ".");

        } else if (cmd.cmd === "manage") {
            const action = MANAGE_ACTIONS[cmd.args];
            if (!action) { errors.push("Unknown action. Use tax, ration, feast, or festival."); continue; }
            if (getResource("Funds") < (action.fundsCost || 0) || getResource("Provisions") < (action.provisionsCost || 0)) {
                errors.push("Insufficient resources."); continue;
            }
            adjustResource("Funds", (action.fundsGain || 0) - (action.fundsCost || 0));
            adjustResource("Provisions", (action.provisionsGain || 0) - (action.provisionsCost || 0));
            adjustPop("Morale", action.moraleDelta);
            if (action.reputationDelta) adjustStat("Reputation", action.reputationDelta);
            let msg = cmd.args + ":";
            if (action.fundsGain) msg += " +" + action.fundsGain + " Funds";
            if (action.provisionsGain) msg += " +" + action.provisionsGain + " Provisions";
            msg += " Morale " + (action.moraleDelta >= 0 ? "+" : "") + action.moraleDelta;
            results.push(msg);
        }
    }
}


/* ============================================================================
   [SECTION] NORMAL MODE KEYWORD DETECTION
   ========================================================================== */

if (mode === "normal" && STAT_KEYWORDS) {
    for (const [statName, config] of Object.entries(STAT_KEYWORD_MAP)) {
        for (const kw of config.increase) {
            if (text.includes(kw)) { adjustStat(statName, config.delta); break; }
        }
        for (const kw of config.decrease) {
            if (text.includes(kw)) { adjustStat(statName, -config.delta); break; }
        }
    }
}


/* ============================================================================
   [SECTION] DAY TICK PROCESSING
   ========================================================================== */

if (dayIncrement > 0) {
    const prevDay = getDay();
    const newDay = prevDay + dayIncrement;
    setDay(newDay);

    // Advance projects
    const projects = getProjects();
    const remaining = [];

    for (const proj of projects) {
        const newElapsed = proj.elapsed + dayIncrement;
        if (newElapsed >= proj.total) {
            const def = PROJECT_TABLE.find(p => p.id === proj.id);
            if (def) {
                if (def.statEffect) {
                    for (const [stat, delta] of Object.entries(def.statEffect)) adjustStat(stat, delta);
                }
                if (def.popEffect) {
                    for (const [popName, count] of Object.entries(def.popEffect)) adjustPop(popName, count);
                }
                const buildings = getCompletedBuildings();
                if (buildings.indexOf(def.id) < 0) {
                    buildings.push(def.id);
                    setCompletedBuildings(buildings);
                }
                if (def.special === "slots4") setMaxSlots(4);
                if (def.special === "slots6") setMaxSlots(6);
                results.push("[PROJECT COMPLETE] " + def.name + " finished on Day " + newDay + "!");
            }
        } else {
            remaining.push({ id: proj.id, elapsed: newElapsed, total: proj.total });
        }
    }
    setProjects(remaining);

    // Daily resource generation from buildings
    const buildings = getCompletedBuildings();
    for (const buildingId of buildings) {
        const def = PROJECT_TABLE.find(p => p.id === buildingId);
        if (def && def.passiveGen) {
            for (const [resName, amount] of Object.entries(def.passiveGen)) adjustResource(resName, amount);
        }
    }

    // Daily provisions consumption
    const consumption = Math.floor(getPop("Soldiers") / 5) + Math.floor(getPop("Operatives") / 10) + Math.floor(getPop("Scholars") / 8);
    adjustResource("Provisions", -consumption);

    // Passive diplomacy shifts based on stats
    const force = getStat("Force");
    const reputation = getStat("Reputation");
    if (force >= 50) {
        for (let n = 0; n < 4; n++) { if (getDiplomacy(n).stance > 1) adjustStance(n, -1); }
    }
    if (force >= 30 && force < 50) {
        for (let n = 4; n < 6; n++) { if (getDiplomacy(n).stance < 2) adjustStance(n, 1); }
    }
    if (reputation >= 40) {
        for (let n = 4; n < 6; n++) { if (getDiplomacy(n).stance < 3) adjustStance(n, 1); }
    }
}


/* ============================================================================
   [SECTION] LORE ACTIVATION (Normal Mode)
   ========================================================================== */

let activatedEntries = [];
let triggeredKeywords = [];

if (mode === "normal" && LORE_ENGINE) {
    // Message count from last_messages
    let msgCount = 0;
    if (typeof last_messages !== "undefined" && Array.isArray(last_messages)) {
        msgCount = last_messages.length;
    }

    // First pass: direct keyword matches
    for (const entry of LORE_ENTRIES) {
        if (entry.minMessages && msgCount < entry.minMessages) continue;
        const hasKeyword = entry.keywords.some(kw => text.includes(kw));
        if (!hasKeyword) continue;
        if (entry.probability && Math.random() > entry.probability) continue;
        if (entry.filters) {
            if (entry.filters.notWith && entry.filters.notWith.some(w => text.includes(w))) continue;
            if (entry.filters.requiresAny && !entry.filters.requiresAny.some(w => text.includes(w))) continue;
            if (entry.filters.requiresAll && !entry.filters.requiresAll.every(w => text.includes(w))) continue;
        }
        activatedEntries.push(entry);
        if (entry.triggers) entry.triggers.forEach(t => triggeredKeywords.push(t));
    }

    // Second pass: cascading activation
    if (triggeredKeywords.length > 0) {
        for (const entry of LORE_ENTRIES) {
            if (activatedEntries.includes(entry)) continue;
            const isTriggered = entry.keywords.some(kw =>
                triggeredKeywords.some(t => kw.includes(t) || t.includes(kw))
            );
            if (isTriggered) activatedEntries.push(entry);
        }
    }
}


/* ============================================================================
   [SECTION] OUTPUT ASSEMBLY
   ========================================================================== */

const parts = [];

if (mode === "faction") {
    // --- FACTION MODE: full management interface ---
    let status = "[FACTION STATUS — DAY " + getDay() + "]\n\n";

    status += "STATISTICS:\n";
    for (let i = 0; i < STAT_NAMES.length; i++) {
        status += STAT_NAMES[i] + ": " + getStat(STAT_NAMES[i]) + (STAT_NAMES[i] === "Opposition" ? "%" : "");
        status += (i < STAT_NAMES.length - 1) ? "  |  " : "\n";
    }

    status += "\nRESOURCES:\n";
    for (let i = 0; i < RESOURCE_NAMES.length; i++) {
        status += RESOURCE_NAMES[i] + ": " + getResource(RESOURCE_NAMES[i]);
        status += (i < RESOURCE_NAMES.length - 1) ? "  |  " : "\n";
    }

    status += "\nPERSONNEL:\n";
    for (let i = 0; i < POP_NAMES.length; i++) {
        status += POP_NAMES[i] + ": " + getPop(POP_NAMES[i]) + (POP_NAMES[i] === "Morale" ? "%" : "");
        status += (i < POP_NAMES.length - 1) ? "  |  " : "\n";
    }

    const projects = getProjects();
    status += "\nACTIVE PROJECTS (" + projects.length + "/" + getMaxSlots() + " slots):\n";
    if (projects.length === 0) {
        status += "  None\n";
    } else {
        for (let i = 0; i < projects.length; i++) {
            const def = PROJECT_TABLE.find(p => p.id === projects[i].id);
            status += "  " + (i + 1) + ". " + (def ? def.name : "Unknown") + ": Day " + projects[i].elapsed + "/" + projects[i].total + "\n";
        }
    }

    status += "\nDIPLOMACY:\n";
    for (const nation of NATION_TABLE) {
        const dip = getDiplomacy(nation.id);
        status += "  " + nation.name + ": " + STANCE_NAMES[dip.stance];
        if (dip.treaty > 0) status += " (" + TREATY_NAMES[dip.treaty] + ")";
        status += "\n";
    }

    if (results.length > 0) {
        status += "\nACTION RESULTS:\n" + results.join("\n");
    }
    if (errors.length > 0) {
        status += "\nERRORS:\n" + errors.join("\n");
    }

    status += "\n\nCommands: /build | /upgrade | /train | /research | /diplomacy | /espionage | /military | /manage | /endturn | /overview | /exit";

    parts.push(status);

} else {
    // --- NORMAL MODE: roleplay with invisible tracking ---

    // Lore entries sorted by priority
    activatedEntries
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .forEach(entry => {
            if (entry.scenario) parts.push("[WORLD CONTEXT]" + entry.scenario);
        });

    // Timeline events (fire on matching day)
    if (TIMELINE_EVENTS) {
        const day = getDay();
        for (const event of TIMELINE) {
            if (day === event.day) parts.push(event.text);
        }
    }

    // Stat-based world reactions
    const force = getStat("Force");
    const reputation = getStat("Reputation");
    const opposition = getStat("Opposition");
    const day = getDay();

    if (force >= 75 && day >= 30) {
        parts.push("[World Reaction] Your growing military force has been noticed. Rival factions accelerate preparations.");
    }
    if (reputation >= 60 && day >= 21) {
        parts.push("[World Reaction] Your expanding reputation shifts regional power dynamics. New opportunities and enemies emerge.");
    }
    if (opposition >= 80) {
        parts.push("[Critical Alert] Opposition forces have reached a critical threshold. They are mobilizing directly.");
    }

    // Command results (auto-build etc.)
    for (const r of results) parts.push("[EVENT] " + r);

    // Stat display (if enabled)
    if (statsDisplay >= 1) {
        let display = "[FACTION STATS — DAY " + day + "]\n";
        for (let i = 0; i < STAT_NAMES.length; i++) {
            display += STAT_NAMES[i] + ": " + getStat(STAT_NAMES[i]) + (STAT_NAMES[i] === "Opposition" ? "%" : "");
            if (i < STAT_NAMES.length - 1) display += " | ";
        }
        if (statsDisplay === 2) {
            display += "\n";
            for (let i = 0; i < RESOURCE_NAMES.length; i++) {
                display += RESOURCE_NAMES[i] + ": " + getResource(RESOURCE_NAMES[i]);
                if (i < RESOURCE_NAMES.length - 1) display += " | ";
            }
            display += "\nMorale: " + getPop("Morale") + "%";
        }
        parts.push(display);
    }

    // If nothing else was generated, provide minimal context
    if (parts.length === 0) {
        parts.push("[FACTION CONTEXT] Day " + day + ". The faction continues its operations. Stats are tracked invisibly.");
    }
}


/* ============================================================================
   [SECTION] DEBUG
   ========================================================================== */

if (DEBUG_MODE) {
    let debug = "[DBG]\n";
    debug += "Mode: " + mode + " | Day: " + getDay() + " | Slots: " + getMaxSlots() + "\n";
    debug += "Projects: " + JSON.stringify(getProjects()) + "\n";
    debug += "Buildings: " + JSON.stringify(getCompletedBuildings()) + "\n";
    debug += "Stats: " + STAT_NAMES.map(s => s + "=" + getStat(s)).join(", ") + "\n";
    debug += "Resources: " + RESOURCE_NAMES.map(r => r + "=" + getResource(r)).join(", ") + "\n";
    debug += "Lore activated: " + activatedEntries.length;
    parts.push(debug);
}


/* ============================================================================
   [SECTION] FLUSH
   ========================================================================== */

output = parts.join("\n\n").trim().slice(0, MAX_OUTPUT);

// Close HAS_TOOLS guard
}
