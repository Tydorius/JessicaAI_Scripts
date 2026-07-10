/* ============================================================================
   LOREBOOK ENGINE
   A dynamic lorebook system for JessicaAI Scripts.

   Based on the Advanced Lore Book System v16 by Icehellionx, cleaned up and
   adapted as a template for the JessicaAI_Scripts repository.

   JessicaAI Inputs (read-only): last_message, last_messages, character,
     scenario, long_term_memory, memory, tools
   JessicaAI Output: assign a non-empty string to `output`

   HOW TO USE:
     1. Scroll to the [AUTHOR ENTRIES] section.
     2. Replace the example entries with your own lore.
     3. Optionally configure the [GLOBAL KNOBS] and [ENTITY DB] sections.
     4. Do NOT edit the engine code below the marked line.

   AUTHOR CHEAT-SHEET (ASCII-safe):
     - keywords: real user words/phrases; supports suffix wildcard "welcom*"
     - tag: internal label for this entry (e.g., "tavern_open"); never matched against text
     - triggers: list of tags to emit when this entry hits

   Text gates (any of these aliases are accepted):
     - requireAny / andAny / requires: { any: [...] }
     - requireAll / andAll / requires: { all: [...] }
     - requireNone / notAny / block / requires: { none: [...] }
     - notAll  // reject only if *all* listed words are present simultaneously

   Tag gates (cross-entry by fired tags):
     - andAnyTags, andAllTags, notAnyTags, notAllTags

   Time gates:
     - minMessages / maxMessages

   Name block:
     - nameBlock: ["npc_name"]  // blocks if active bot name equals any listed

   Priority and selection:
     - priority: 1..5 (default 3; clamped)
     - APPLY_LIMIT caps how many entries apply per turn (engine-level)

   Probability:
     - probability: 0..1 or "40%" (both supported)

   Shifts:
     - optional sub-entries with same fields as entries; evaluated after the parent entry hits

   Output fields:
     - personality: character guidance text (leading space recommended)
     - scenario: scene/scenario guidance text (leading space recommended)
     - {{char}} in any field is replaced with the active character's display name

   Multi-message window (engine behavior summary):
     - Engine normalizes a joined window of recent messages (WINDOW_DEPTH) for keyword checks.
     - Whole-word matching with optional suffix wildcard "stem*".
     - Hyphen/underscore treated as spaces during normalization.

   Advanced features:
     - Entity DB: Define characters with aliases; use "char.entityName" as a keyword to auto-expand
     - Relationship DB: Inject context when entity pairs + tags co-occur
     - prev. prefix: Target the second-to-last message instead of the window
     - requireEmotion / blockEmotion: Gate on detected user emotion (when available)
   ========================================================================== */


/* ============================================================================
   [SECTION] GLOBAL KNOBS
   SAFE TO EDIT: Yes
   ========================================================================== */

let DEBUG       = 0;     // 1 -> emit [DBG] lines inline in personality
let APPLY_LIMIT = 6;     // cap applied entries per turn; higher priorities win
let USE_JESSICA_MEMORY = 1;      // 1 -> persist turn count and last fired tags when memory is available
let USE_JESSICA_LORE_TOOL = 1;   // 1 -> append a tiny tools.lore.find() supplement when available
let JESSICA_LORE_LIMIT = 2;      // external Jessica lore matches to append; Jessica clamps this to 1..8


/* ============================================================================
   [SECTION] ENTITY DEFINITIONS
   SAFE TO EDIT: Yes

   Define characters that appear in your story. Keys should be lower case.
   The engine uses these for:
     - "char.entityName" keyword expansion (auto-includes all aliases)
     - Relationship trigger resolution
     - Pronoun coreference (he/she/it resolves to last-mentioned entity)
   ========================================================================== */

const ENTITY_DB = {
    "marcus": {
        gender: "M",
        aliases: ["marc", "the warrior", "brooding warrior"],
        lore: [
            {
                group: "marcus_base",
                keywords: ["char.marcus"],
                personality: " Marcus is a brooding warrior with a hidden heart of gold. He speaks rarely but acts decisively."
            }
        ]
    },
    "elara": {
        gender: "F",
        aliases: ["el", "the mage", "young mage"],
        lore: [
            {
                group: "elara_base",
                keywords: ["char.elara"],
                personality: " Elara is a gifted but reckless mage. She is curious to a fault and often rushes into danger."
            }
        ]
    },
    "king": {
        gender: "M",
        aliases: ["the king", "his majesty"]
    },
    "innkeeper": {
        gender: "N",
        aliases: ["bartender", "tavern keeper"]
    },
    "avery": {
        gender: "N",
        aliases: ["aves", "avie", "avi", "avee"]
    }
};


/* ============================================================================
   [SECTION] RELATIONSHIP TRIGGERS
   SAFE TO EDIT: Yes

   When two entities are present in the scene AND specific tags have been
   triggered, inject additional context. This allows the model to know
   "When Marcus and Elara are arguing, inject their shared history."
   ========================================================================== */

const RELATIONSHIP_DB = [
    {
        pair: ["marcus", "elara"],
        requireTags: ["yearning", "angst"],
        injection: "[HISTORY] Marcus and Elara share a painful past. They want each other but are afraid to bridge the gap.",
        group: "relationship_history"
    },
    {
        pair: ["marcus", "king"],
        requireTags: ["jealousy", "conflict"],
        injection: "[RIVALRY] The tension between Marcus and the King is palpable. A power struggle simmers beneath the surface.",
        group: "rivalry"
    }
];

const PRONOUN_MAP = {
    "he": "M", "him": "M", "his": "M",
    "she": "F", "her": "F", "hers": "F",
    "it": "N", "they": "N"
};


/* ============================================================================
   [SECTION] AUTHOR ENTRIES
   SAFE TO EDIT: Yes

   This is where you define your lore. Each entry is an object. The engine
   matches keywords against recent messages and injects personality/scenario
   text for entries that pass all gates.

   The examples below demonstrate every feature, organized by complexity.
   Replace them with your own content.
   ========================================================================== */

const dynamicLore = [
// ============================================================================
// EDIT YOUR LORE ENTRIES BELOW THIS LINE
// ============================================================================

  /* --- L0: Always-on baseline ---
     No keywords, no tag, no time gates = fires every turn.
     Use for a baseline voice, mood, or standing instruction.
  */
  {
    personality: " Maintain a rich, immersive narrative tone. Describe sights, sounds, and atmosphere."
  },

  /* --- L1: Simple keyword match ---
     Fires when any keyword appears in recent messages.
  */
  {
    keywords: ["tavern", "inn", "pub"],
    scenario: " The tavern is warm and crowded. Firelight flickers off worn wooden tables. The smell of stew and ale fills the air."
  },

  /* --- L2: Keyword + priority + trigger emission ---
     When greeting keywords appear (and not in a combat context), emit the
     'social_greeting' tag for tag-only entries to pick up.
  */
  {
    keywords: ["hello", "hi", "hey", "greetings"],
    priority: 4,
    triggers: ["social_greeting"],
    requireNone: ["fight", "attack", "danger"],
    personality: " {{char}} should respond warmly and acknowledge the speaker."
  },

  /* --- L2b: Tag-only entry (triggered by L2) ---
     Only fires if 'social_greeting' tag was emitted this turn.
  */
  {
    tag: "social_greeting",
    priority: 5,
    personality: " {{char}} should introduce themselves if not yet known and offer conversation or refreshment."
  },

  /* --- L3: Multiple gates — requireAny + block + triggers ---
     For "sword" or "blade" AND any combat word, unless "peace" or "parley" blocks it.
  */
  {
    keywords: ["sword", "blade", "weapon"],
    priority: 4,
    block: ["peace", "parley", "surrender"],
    triggers: ["combat_ready"],
    andAny: ["fight", "battle", "enemy", "attack", "draw"],
    personality: " {{char}} is ready for combat. Describe their stance, weapon readiness, and tactical awareness.",
    scenario: " Tension rises as weapons are drawn. The atmosphere shifts to imminent violence."
  },

  /* --- L3b: Triggered follow-up ---
     Standard combat preflight when 'combat_ready' tag fires.
  */
  {
    tag: "combat_ready",
    priority: 5,
    personality: " {{char}} should assess the threat, choose a target, and describe their opening move."
  },

  /* --- L4: Probability gate ---
     Sometimes (40%) injects ambient tavern detail when drink/ale is mentioned.
  */
  {
    keywords: ["drink", "ale", "beer", "wine", "mead"],
    priority: 3,
    probability: "40%",
    triggers: ["tavern_atmosphere"],
    requires: { any: ["drink", "ale", "beer", "wine", "mead"], none: ["water", "poison"] },
    scenario: " The barmaid weaves through the crowd with practiced ease. Mugs clink and laughter echoes."
  },

  /* --- L4b: Triggered atmosphere ---
  */
  {
    tag: "tavern_atmosphere",
    priority: 4,
    personality: " {{char}} should describe the drink, the taste, and the mood of the room."
  },

  /* --- L5: Time gating — opening sequence ---
     Only fires in the first 3 messages. Sets up the scene.
  */
  {
    keywords: ["arrive", "enter", "look around"],
    minMessages: 0, maxMessages: 3,
    priority: 4,
    triggers: ["scene_intro"],
    notAny: ["leave", "exit", "depart"],
    personality: " {{char}} should describe the interior, the patrons, and the general atmosphere upon arrival."
  },

  /* --- L5b: Scene intro baseline ---
  */
  {
    tag: "scene_intro",
    priority: 5,
    personality: " {{char}} should note key details: exits, notable NPCs, and any immediate points of interest."
  },

  /* --- L6: Late-game + suffix wildcard + andAll ---
     After at least 5 messages, "quest*" (quest/questing/questline) AND "map"
     must both be present.
  */
  {
    keywords: ["quest*", "journey", "adventure"],
    minMessages: 5,
    priority: 4,
    triggers: ["quest_board"],
    andAll: ["map", "road", "path", "direction"],
    personality: " {{char}} should reference the map and suggest a route or destination for the journey ahead."
  },

  /* --- L6b: Quest board triggered entry ---
  */
  {
    tag: "quest_board",
    priority: 5,
    personality: " {{char}} should summarize known quest hooks and recommend a priority."
  },

  /* --- L7: Multiple triggers — fork into two flows ---
     When "magic" or "spell" appears, emit both 'arcane_notice' and 'mana_check'.
  */
  {
    keywords: ["magic", "spell", "enchant", "arcane", "ritual"],
    priority: 4,
    triggers: ["arcane_notice", "mana_check"],
    requires: { any: ["cast", "magic", "spell", "mana"], none: ["null", "dead"] },
    personality: " {{char}} should describe the magical energies at play and their effects on the environment."
  },

  /* --- L7b: Arcane notice ---
  */
  {
    tag: "arcane_notice",
    priority: 5,
    personality: " {{char}} should note the school of magic, visible effects, and any sensory impressions (smell of ozone, warmth, cold)."
  },

  /* --- L7c: Mana check ---
  */
  {
    tag: "mana_check",
    priority: 4,
    personality: " {{char}} should assess whether the caster appears strained or confident, hinting at their power level."
  },

  /* --- L8: Shifts (child entries that refine a parent) ---
     Base entry fires on "shop" or "buy"; shifts add detail based on item type.
  */
  {
    keywords: ["shop", "buy", "purchase", "trade", "merchant"],
    priority: 4,
    triggers: ["shopping"],
    personality: " {{char}} should describe the merchant's wares and demeanor.",
    scenario: " The shop is cluttered with goods. The merchant watches expectantly.",
    Shifts: [
      {
        keywords: ["potion", "heal", "medicine"],
        probability: 1.0,
        personality: " {{char}} should list available potions and their prices.",
        scenario: " A shelf of colorful vials catches the light."
      },
      {
        keywords: ["armor", "shield", "helm"],
        probability: 0.8,
        notAny: ["broke", "destroyed"],
        personality: " {{char}} should describe the armor quality and suggest a fitting.",
        scenario: " suits of chain and plate stand on racks along the wall."
      },
      {
        keywords: ["rare", "unique", "special"],
        block: ["fake", "scam"],
        nameBlock: ["merchant"],
        andAny: ["relic", "artifact", "enchanted"],
        personality: " {{char}} should express interest or suspicion about the rare item and haggle if appropriate.",
        scenario: " Behind the counter, a velvet-lined case holds something unusual."
      }
    ]
  },

  /* --- L8b: Shopping triggered entry ---
  */
  {
    tag: "shopping",
    priority: 5,
    personality: " {{char}} should ask what the customer is looking for and mention their best stock."
  },

  /* --- L9: nameBlock — prevents self-cameo ---
     If "innkeeper" is mentioned but the active character IS the innkeeper,
     this entry is blocked. Otherwise, assign innkeeper behavior.
  */
  {
    keywords: ["innkeeper", "bartender", "tavern keeper"],
    nameBlock: ["innkeeper"],
    priority: 4,
    triggers: ["innkeeper_npc"],
    notAny: ["absent", "gone", "dead"],
    personality: " The innkeeper is a stout, cheerful figure who knows all the local gossip. They wipe a mug and lean in to listen."
  },

  /* --- L9b: Innkeeper NPC baseline ---
  */
  {
    tag: "innkeeper_npc",
    priority: 5,
    personality: " The innkeeper should offer food, drink, or lodging, and share one piece of local news."
  },

  /* --- L10: Multi-trigger + andAll — investigation flow ---
     For "secret" or "hidden" with "door" or "passage", emit two tags.
  */
  {
    keywords: ["secret", "hidden", "mystery", "clue"],
    priority: 4,
    triggers: ["discovery", "investigation_mode"],
    andAll: ["door", "passage", "trapdoor", "wall"],
    personality: " {{char}} should describe what was found in vivid detail and hint at its significance."
  },

  /* --- L10b: Discovery triggered ---
  */
  {
    tag: "discovery",
    priority: 5,
    personality: " {{char}} should note the condition, age, and potential purpose of the discovery."
  },

  /* --- L10c: Investigation mode with requires bundle ---
  */
  {
    tag: "investigation_mode",
    priority: 4,
    requires: { none: ["bored", "distracted"], any: ["examine", "inspect", "study", "search"] },
    personality: " {{char}} should encourage careful observation and suggest what to look at next."
  },

  /* --- L11: Entity keyword expansion ---
     "char.avery" auto-expands to include "avery" and all aliases from ENTITY_DB.
  */
  {
    keywords: ["char.avery"],
    personality: " Avery is a mysterious traveler with an unreadable expression. They seem to know more than they let on."
  },

  /* --- L12: Previous message targeting ---
     Uses 'prev.' prefix to match against the second-to-last message.
     Useful for responding to something said a turn ago.
  */
  {
    'prev.keywords': ["question", "ask", "wonder"],
    personality: " {{char}} should address the question that was raised in the previous turn, even if the user has since moved on."
  },

  /* --- L13: Emotion-based targeting ---
     Only triggers if anger is detected in the user's message (requires
     emotion detection support on the platform).
  */
  {
    requireEmotion: "anger",
    blockEmotion: "fear",
    personality: " The user seems angry. {{char}} should react to the tension and attempt to de-escalate or match the energy as appropriate."
  }

// ============================================================================
// DO NOT EDIT BELOW THIS LINE — ENGINE CODE FOLLOWS
// ============================================================================
];


/* ============================================================================
   [SECTION] JESSICAAI COMPATIBILITY
   DO NOT EDIT: Engine code
   ========================================================================== */

const HAS_CONTEXT = (typeof context !== "undefined" && context);
const HAS_TOOLS = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);
const HAS_LONG_TERM_MEMORY = (typeof long_term_memory !== "undefined" && long_term_memory);
let _debugBuffer = "";

function _safeCall(fn, fallback) {
  try {
    const value = fn();
    return value == null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}


/* ============================================================================
   [SECTION] INPUT NORMALIZATION
   ========================================================================== */

const WINDOW_DEPTH = ((n) => {
  n = parseInt(n, 10);
  if (isNaN(n)) n = 5;
  if (n < 1) n = 1;
  if (n > 10) n = 10;
  return n;
})(typeof WINDOW_DEPTH_OVERRIDE === "number" ? WINDOW_DEPTH_OVERRIDE : 5);

function _str(x) { return (x == null ? "" : String(x)); }
function _normalizeText(s) {
  s = _str(s).toLowerCase();
  s = s.replace(/[^a-z0-9_\s-]/g, " ");
  s = s.replace(/[-_]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

const _toolRecent = (HAS_TOOLS && tools.chat && typeof tools.chat.recent === "function")
  ? _safeCall(() => tools.chat.recent(WINDOW_DEPTH), null)
  : null;
const _globalRecent = (typeof last_messages !== "undefined" && last_messages && typeof last_messages.length === "number")
  ? last_messages : null;
const _contextRecent = (HAS_CONTEXT && context.chat && context.chat.last_messages && typeof context.chat.last_messages.length === "number")
  ? context.chat.last_messages : null;
const _lmArr = _toolRecent || _globalRecent || _contextRecent || null;

let _joinedWindow = "";
let _rawLastSingle = "";
let _rawPrevSingle = "";

if (_lmArr && _lmArr.length > 0) {
  const startIdx = Math.max(0, _lmArr.length - WINDOW_DEPTH);
  const segs = [];
  for (const item of _lmArr.slice(startIdx)) {
    const msg = (item && typeof item.content === "string")
      ? item.content
      : ((item && typeof item.message === "string") ? item.message : _str(item));
    segs.push(_str(msg));
  }
  _joinedWindow = segs.join(" ");
  const lastItem = _lmArr[_lmArr.length - 1];
  _rawLastSingle = _str((lastItem && typeof lastItem.content === "string")
    ? lastItem.content
    : ((lastItem && typeof lastItem.message === "string") ? lastItem.message : lastItem));
  if (_lmArr.length > 1) {
      const prevItem = _lmArr[_lmArr.length - 2];
      _rawPrevSingle = _str((prevItem && typeof prevItem.content === "string")
        ? prevItem.content
        : ((prevItem && typeof prevItem.message === "string") ? prevItem.message : prevItem));
  }
} else {
  const _lastMsgTool = (HAS_TOOLS && tools.chat && typeof tools.chat.lastUser === "function")
    ? _safeCall(() => tools.chat.lastUser(), "")
    : "";
  const _lastMsgGlobal = (typeof last_message === "string") ? last_message : "";
  const _lastMsgA = (HAS_CONTEXT && context.chat && typeof context.chat.lastMessage === "string") ? context.chat.lastMessage : "";
  const _lastMsgB = (HAS_CONTEXT && context.chat && typeof context.chat.last_message === "string") ? context.chat.last_message : "";
  _rawLastSingle = _str(_lastMsgTool || _lastMsgGlobal || _lastMsgA || _lastMsgB);
  _joinedWindow = _rawLastSingle;
}

const CHAT_WINDOW = {
  depth: WINDOW_DEPTH,
  count_available: (_lmArr && _lmArr.length) ? _lmArr.length : (_rawLastSingle ? 1 : 0),
  text_joined: _joinedWindow,
  text_last_only: _rawLastSingle,
  text_prev_only: _rawPrevSingle,
  text_joined_norm: _normalizeText(_joinedWindow),
  text_last_only_norm: _normalizeText(_rawLastSingle),
  text_prev_only_norm: _normalizeText(_rawPrevSingle)
};
const last = " " + CHAT_WINDOW.text_joined_norm + " ";
const prev = " " + CHAT_WINDOW.text_prev_only_norm + " ";

let messageCount = 0;
if (_lmArr && typeof _lmArr.length === "number") {
  const userCount = _lmArr.filter(item => item && item.role === "user").length;
  messageCount = userCount || _lmArr.length;
} else if (HAS_CONTEXT && context.chat && typeof context.chat.message_count === "number") {
  messageCount = context.chat.message_count;
} else if (typeof context_chat_message_count === "number") {
  messageCount = context_chat_message_count;
}

const _storedTurnCount = (USE_JESSICA_MEMORY && HAS_MEMORY && typeof memory.get === "function")
  ? parseInt(memory.get("advanced_lore.turn_count") || "0", 10)
  : 0;
if (messageCount < _storedTurnCount) messageCount = _storedTurnCount;
if (USE_JESSICA_MEMORY && HAS_MEMORY && typeof memory.set === "function") {
  _safeCall(() => memory.set("advanced_lore.turn_count", String(messageCount + 1)), false);
}

const _characterNames = (HAS_TOOLS && tools.state && typeof tools.state.activeCharacters === "function")
  ? _safeCall(() => tools.state.activeCharacters(), [])
  : ((typeof character !== "undefined" && character && Array.isArray(character.names)) ? character.names : []);
const activeName = _normalizeText(
  (_characterNames && _characterNames.length)
    ? _characterNames[0]
    : (HAS_CONTEXT && context.character && typeof context.character.name === "string")
    ? context.character.name
    : ""
);


/* ============================================================================
   [SECTION] UTILITIES
   ========================================================================== */

function dbg(msg) {
  try {
    if (typeof DEBUG !== "undefined" && DEBUG) {
      _debugBuffer += `\n\n[DBG] ${String(msg)}`;
    }
  } catch (e) {}
}
function arr(x) { return Array.isArray(x) ? x : (x == null ? [] : [x]); }
function clamp01(v) { v = +v; if (!isFinite(v)) return 0; return Math.max(0, Math.min(1, v)); }
function parseProbability(v) {
  if (v == null) return 1;
  if (typeof v === "number") return clamp01(v);
  const s = String(v).trim().toLowerCase();
  const n = parseFloat(s.replace("%", ""));
  if (!isFinite(n)) return 1;
  return s.indexOf("%") !== -1 ? clamp01(n / 100) : clamp01(n);
}
function prio(e) {
  let p = (e && isFinite(e.priority)) ? +e.priority : 3;
  if (p < 1) p = 1;
  if (p > 5) p = 5;
  return p;
}
function getMin(e) { return (e && isFinite(e.minMessages)) ? +e.minMessages : -Infinity; }
function getMax(e) { return (e && isFinite(e.maxMessages)) ? +e.maxMessages :  Infinity; }
function getKW(e)  { return (e && Array.isArray(e.keywords)) ? e.keywords.slice(0) : []; }
function getTrg(e) { return (e && Array.isArray(e.triggers)) ? e.triggers.slice(0) : []; }
function getBlk(e) {
  if (!e) return [];
  if (Array.isArray(e.block)) return e.block.slice(0);
  if (Array.isArray(e.Block)) return e.Block.slice(0);
  return [];
}
function getNameBlock(e) { return (e && Array.isArray(e.nameBlock)) ? e.nameBlock.slice(0) : []; }
function normName(s) { return _normalizeText(s); }
function isNameBlocked(e) {
  if (!activeName) return false;
  const nb = getNameBlock(e);
  for (const item of nb) {
    const n = normName(item);
    if (!n) continue;
    if (n === activeName) return true;
    if (activeName.indexOf(n) !== -1) return true;
    if (n.indexOf(activeName + " ") === 0) return true;
  }
  return false;
}

function expandKeywordsInArray(keywords, entityDb, regex, dbgFunc) {
    const expanded = [];
    for (const keyword of keywords) {
        const match = String(keyword).match(regex);
        if (match) {
            const entityName = match[1].toLowerCase();
            const entity = entityDb[entityName];
            if (entity) {
                expanded.push(entityName);
                if (Array.isArray(entity.aliases)) {
                    expanded.push(...entity.aliases);
                }
                dbgFunc(`Expanded '${keyword}' to include keywords for '${entityName}'.`);
            } else {
                dbgFunc(`Could not find entity for '${keyword}'. Ignoring.`);
            }
        } else {
            expanded.push(keyword);
        }
    }
    return [...new Set(expanded)];
}

function expandEntityKeywords(loreBook, entityDb, dbgFunc) {
    const entityKeywordRegex = /^char\.([a-z0-9_]+)$/i;
    for (const entry of loreBook) {
        if (entry.keywords && entry.keywords.length) {
            entry.keywords = expandKeywordsInArray(entry.keywords, entityDb, entityKeywordRegex, dbgFunc);
        }
        if (entry.Shifts && entry.Shifts.length) {
            for (const shift of entry.Shifts) {
                if (shift.keywords && shift.keywords.length) {
                    shift.keywords = expandKeywordsInArray(shift.keywords, entityDb, entityKeywordRegex, dbgFunc);
                }
            }
        }
    }
}

function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function hasTerm(hay, term) {
  const rawTerm = (term == null ? "" : String(term)).trim();
  if (!rawTerm) return false;

  if (rawTerm.charAt(rawTerm.length - 1) === "*") {
    const stem = _normalizeText(rawTerm.slice(0, -1));
    if (!stem) return false;
    const re1 = new RegExp("(?:^|\\s)" + reEsc(stem) + "[a-z]*?(?=\\s|$)");
    return re1.test(hay);
  }

  const t = _normalizeText(rawTerm);
  if (!t) return false;
  const w = reEsc(t);
  const re2 = new RegExp("(?:^|\\s)" + w + "(?=\\s|$)");
  return re2.test(hay);
}

function collectWordGates(e) {
  const r = (e && e.requires) ? e.requires : {};
  const any = [].concat(
      arr(e && e.requireAny),
      HEURISTICS_USAGE.andAny ? arr(e && e.andAny) : [],
      arr(r.any)
  );
  const all = [].concat(
      arr(e && e.requireAll),
      HEURISTICS_USAGE.andAll ? arr(e && e.andAll) : [],
      arr(r.all)
  );
  const none = [].concat(
      arr(e && e.requireNone),
      HEURISTICS_USAGE.notAny ? arr(e && e.notAny) : [],
      arr(r.none),
      arr(getBlk(e))
  );
  const nall = HEURISTICS_USAGE.notAll ? [].concat(arr(e && e.notAll)) : [];

  const r_prev = (e && e['prev.requires']) ? e['prev.requires'] : {};
  const any_prev = [].concat(
      arr(e && e['prev.requireAny']),
      HEURISTICS_USAGE.andAny ? arr(e && e['prev.andAny']) : [],
      arr(r_prev.any)
  );
  const all_prev = [].concat(
      arr(e && e['prev.requireAll']),
      HEURISTICS_USAGE.andAll ? arr(e && e['prev.andAll']) : [],
      arr(r_prev.all)
  );
  const none_prev = [].concat(
      arr(e && e['prev.requireNone']),
      HEURISTICS_USAGE.notAny ? arr(e && e['prev.notAny']) : [],
      arr(r_prev.none),
      arr(e && e['prev.block'])
  );
  const nall_prev = HEURISTICS_USAGE.notAll ? [].concat(arr(e && e['prev.notAll'])) : [];

  return {
    current: { any, all, none, nall },
    previous: { any: any_prev, all: all_prev, none: none_prev, nall: nall_prev }
  };
}

function wordGatesPass(e) {
  const g = collectWordGates(e);

  const cur = g.current;
  if (cur.any.length  && !cur.any.some(w => hasTerm(last, w))) return false;
  if (cur.all.length  && !cur.all.every(w => hasTerm(last, w))) return false;
  if (cur.none.length &&  cur.none.some(w => hasTerm(last, w))) return false;
  if (cur.nall.length &&   cur.nall.every(w => hasTerm(last, w))) return false;

  const prevScope = g.previous;
  if (prevScope.any.length  && !prevScope.any.some(w => hasTerm(prev, w))) return false;
  if (prevScope.all.length  && !prevScope.all.every(w => hasTerm(prev, w))) return false;
  if (prevScope.none.length &&  prevScope.none.some(w => hasTerm(prev, w))) return false;
  if (prevScope.nall.length &&   prevScope.nall.every(w => hasTerm(prev, w))) return false;

  return true;
}

function tagsPass(e, activeTagsSet) {
  const anyT  = arr(e && e.andAnyTags);
  const allT  = arr(e && e.andAllTags);
  const noneT = arr(e && e.notAnyTags);
  const nallT = arr(e && e.notAllTags);
  const hasT  = t => !!activeTagsSet && activeTagsSet[String(t)] === 1;

  if (anyT.length  && !anyT.some(hasT)) return false;
  if (allT.length  && !allT.every(hasT)) return false;
  if (noneT.length &&  noneT.some(hasT)) return false;
  if (nallT.length &&   nallT.every(hasT)) return false;
  return true;
}

function emotionGatesPass(e) {
    const reqEmotion = arr(e && e.requireEmotion);
    const blockEmotion = arr(e && e.blockEmotion);

    if (reqEmotion.length === 0 && blockEmotion.length === 0) {
        return true;
    }

    const activeEmotions =
      (typeof emotions !== "undefined" && emotions && typeof emotions === "object")
        ? emotions
        : ((HAS_CONTEXT && typeof context.emotions === "object" && context.emotions)
          ? context.emotions
          : ((HAS_LONG_TERM_MEMORY && typeof long_term_memory.emotions === "object")
            ? long_term_memory.emotions
            : {}));

    if (reqEmotion.length > 0) {
        if (!reqEmotion.some(emo => activeEmotions[String(emo).toLowerCase()] === true)) {
            return false;
        }
    }

    if (blockEmotion.length > 0) {
        if (blockEmotion.some(emo => activeEmotions[String(emo).toLowerCase()] === true)) {
            return false;
        }
    }

    return true;
}

function isAlwaysOn(e) {
  const hasKW  = !!(e && e.keywords && e.keywords.length);
  const hasPrevKW = !!(e && e['prev.keywords'] && e['prev.keywords'].length);
  const hasTag = !!(e && e.tag);
  const hasMin = (e && e.minMessages != null);
  const hasMax = (e && e.maxMessages != null);
  return !hasKW && !hasPrevKW && !hasTag && !hasMin && !hasMax;
}

function entryPasses(e, activeTagsSet) {
  if (!(messageCount >= getMin(e) && messageCount <= getMax(e))) return false;
  if (isNameBlocked(e)) return false;
  if (!wordGatesPass(e)) return false;
  if (!tagsPass(e, activeTagsSet || {})) return false;
  if (!emotionGatesPass(e)) return false;
  if (Math.random() > parseProbability(e && e.probability)) return false;
  return true;
}

function resolveActiveEntities(currentText, lastMessages) {
    let mem = { M: null, F: null, N: null };
    let activeEntities = new Set();

    const scanTextForNames = (text) => {
        const lower = text.toLowerCase();
        for (const name in ENTITY_DB) {
            if (Object.prototype.hasOwnProperty.call(ENTITY_DB, name)) {
                if (lower.includes(name)) {
                    const meta = ENTITY_DB[name];
                    mem[meta.gender] = name;
                    mem.N = name;
                    if (text === currentText) activeEntities.add(name);
                }
            }
        }
    };

    if (lastMessages && Array.isArray(lastMessages)) {
        for (const msg of lastMessages) {
            const msgText = (msg && typeof msg.message === "string") ? msg.message : String(msg);
            scanTextForNames(msgText);
        }
    }

    scanTextForNames(currentText);

    const lowerCurrent = currentText.toLowerCase();
    const words = lowerCurrent.split(/\W+/);

    for (const word of words) {
        if (PRONOUN_MAP[word]) {
            const gender = PRONOUN_MAP[word];
            const target = mem[gender] || mem.N;
            if (target) {
                activeEntities.add(target);
                dbg(`Coreference: '${word}' -> ${target}`);
            }
        }
    }

    return Array.from(activeEntities);
}

function getDynamicRelationshipLore(activeTagsSet) {
    const lastMsgs = (_lmArr || []).map(item => (item && typeof item.content === "string")
      ? item.content
      : ((item && typeof item.message === "string") ? item.message : String(item)));
    const activeEntities = resolveActiveEntities(CHAT_WINDOW.text_last_only, lastMsgs);

    if (activeEntities.length < 2) return [];

    let injections = [];

    for (const trigger of RELATIONSHIP_DB) {
        const hasPair = trigger.pair.every(name => activeEntities.includes(name));

        if (hasPair) {
            const requireTags = arr(trigger.requireTags);
            if (requireTags.length === 0) continue;
            const hasTags = requireTags.every(t => hasTag(activeTagsSet, t));

            if (hasTags) {
                dbg(`Relationship Trigger: ${trigger.pair.join("+")}`);
                injections.push({
                    injection: trigger.injection,
                    group: trigger.group || null
                });
            }
        }
    }
    return injections;
}

function compileAuthorLore(authorLore, entityDb) {
  let src = Array.isArray(authorLore) ? authorLore.slice() : [];

  if (entityDb) {
      for (const entityName in entityDb) {
          if (Object.prototype.hasOwnProperty.call(entityDb, entityName)) {
              const entity = entityDb[entityName];
              if (entity.lore && Array.isArray(entity.lore)) {
                  src = src.concat(entity.lore);
              }
          }
      }
  }

  const out = new Array(src.length);
  for (const [i, entry] of src.entries()) {
    out[i] = normalizeEntry(entry);
  }
  return out;
}
function normalizeEntry(e) {
  if (!e) return {};
  const out = {};
  for (const k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
  out.keywords = Array.isArray(e.keywords) ? e.keywords.slice(0) : [];
  if (Array.isArray(e.Shifts) && e.Shifts.length) {
    const shArr = new Array(e.Shifts.length);
    for (const [i, shift] of e.Shifts.entries()) {
      const sh = shift || {};
      const shOut = {};
      for (const sk in sh) if (Object.prototype.hasOwnProperty.call(sh, sk)) shOut[sk] = sh[sk];
      shOut.keywords = Array.isArray(sh.keywords) ? sh.keywords.slice(0) : [];
      shArr[i] = shOut;
    }
    out.Shifts = shArr;
  } else if (out.hasOwnProperty("Shifts")) {
    delete out.Shifts;
  }
  return out;
}


/* ============================================================================
   [SECTION] COMPILATION
   ========================================================================== */

const _ENGINE_LORE = compileAuthorLore(typeof dynamicLore !== "undefined" ? dynamicLore : [], typeof ENTITY_DB !== "undefined" ? ENTITY_DB : {});

expandEntityKeywords(_ENGINE_LORE, ENTITY_DB, dbg);

const HEURISTICS_USAGE = {
    andAny: false,
    andAll: false,
    notAny: false,
    notAll: false,
};
for (const entry of _ENGINE_LORE) {
    if (entry.andAny && entry.andAny.length > 0) HEURISTICS_USAGE.andAny = true;
    if (entry.andAll && entry.andAll.length > 0) HEURISTICS_USAGE.andAll = true;
    if (entry.notAny && entry.notAny.length > 0) HEURISTICS_USAGE.notAny = true;
    if (entry.notAll && entry.notAll.length > 0) HEURISTICS_USAGE.notAll = true;
    if (HEURISTICS_USAGE.andAny && HEURISTICS_USAGE.andAll && HEURISTICS_USAGE.notAny && HEURISTICS_USAGE.notAll) {
        break;
    }
}


/* ============================================================================
   [SECTION] SELECTION PIPELINE
   ========================================================================== */

const buckets = [null, [], [], [], [], []];
const picked = new Array(_ENGINE_LORE.length).fill(0);
const inclusionGroups = {};

function makeTagSet() { return Object.create(null); }
const trigSet = makeTagSet();
const postShiftTrigSet = makeTagSet();

function addTag(set, key) { set[String(key)] = 1; }
function hasTag(set, key) { return set[String(key)] === 1; }

// --- 1) Direct pass ---
for (const [i1, e1] of _ENGINE_LORE.entries()) {
  const hit = isAlwaysOn(e1) || getKW(e1).some(kw => hasTerm(last, kw)) || arr(e1['prev.keywords']).some(kw => hasTerm(prev, kw));
  if (!hit) continue;
  if (!entryPasses(e1, undefined)) { dbg(`filtered entry[${i1}]`); continue; }
  buckets[prio(e1)].push(i1);
  picked[i1] = 1;
  const trg1 = getTrg(e1);
  for (const tag of trg1) {
    addTag(trigSet, tag);
  }
  dbg(`hit entry[${i1}] p=${prio(e1)}`);
}

// --- 2) Trigger pass ---
for (const [i2, e2] of _ENGINE_LORE.entries()) {
  if (picked[i2]) continue;
  if (!(e2 && e2.tag && hasTag(trigSet, e2.tag))) continue;
  if (!entryPasses(e2, trigSet)) { dbg(`filtered triggered entry[${i2}]`); continue; }
  buckets[prio(e2)].push(i2);
  picked[i2] = 1;
  const trg2 = getTrg(e2);
  for (const tag of trg2) {
    addTag(trigSet, tag);
  }
  dbg(`triggered entry[${i2}] p=${prio(e2)}`);
}

// --- 3) Priority selection (capped) ---
const selected = [];
let pickedCount = 0;
const __APPLY_LIMIT = (typeof APPLY_LIMIT === "number" && APPLY_LIMIT >= 1) ? APPLY_LIMIT : 99999;

for (let p = 5; p >= 1 && pickedCount < __APPLY_LIMIT; p--) {
  const bucket = buckets[p];
  for (const item of bucket) {
    if (pickedCount >= __APPLY_LIMIT) break;

    const entry = _ENGINE_LORE[item];
    const group = entry.group || (entry.id ? String(entry.id).split("_")[0] : null);
    if (group) {
        if (inclusionGroups[group]) {
            dbg(`Skipping entry in group '${group}' because an entry from this group was already selected.`);
            continue;
        }
        inclusionGroups[group] = true;
    }

    selected.push(item);
    pickedCount++;
  }
}
if (pickedCount === __APPLY_LIMIT) dbg("APPLY_LIMIT reached");


/* ============================================================================
   [SECTION] APPLY + SHIFTS + POST-SHIFT
   ========================================================================== */

let bufP = "";
let bufS = "";

for (const idx of selected) {
  const e3 = _ENGINE_LORE[idx];
  if (e3 && e3.personality) bufP += `\n\n${e3.personality}`;
  if (e3 && e3.scenario)    bufS += `\n\n${e3.scenario}`;
  if (!(e3 && Array.isArray(e3.Shifts) && e3.Shifts.length)) continue;

  for (const sh of e3.Shifts) {
    const activated = isAlwaysOn(sh) || getKW(sh).some(kw => hasTerm(last, kw)) || arr(sh['prev.keywords']).some(kw => hasTerm(prev, kw));
    if (!activated) continue;

    const trgSh = getTrg(sh);
    for (const tag of trgSh) {
      addTag(postShiftTrigSet, tag);
    }

    if (!entryPasses(sh, trigSet)) { dbg("shift filtered"); continue; }

    if (sh.personality) bufP += `\n\n${sh.personality}`;
    if (sh.scenario)    bufS += `\n\n${sh.scenario}`;
  }
}

// --- Post-shift triggers ---
const unionTags = (() => {
  const dst = makeTagSet();
  for (const k in trigSet) if (trigSet[k] === 1) dst[k] = 1;
  for (const k in postShiftTrigSet) if (postShiftTrigSet[k] === 1) dst[k] = 1;
  return dst;
})();

for (const [i3, e4] of _ENGINE_LORE.entries()) {
  if (picked[i3]) continue;
  if (!(e4 && e4.tag && hasTag(postShiftTrigSet, e4.tag))) continue;
  if (!entryPasses(e4, unionTags)) { dbg(`post-filter entry[${i3}]`); continue; }
  if (e4.personality) bufP += `\n\n${e4.personality}`;
  if (e4.scenario)    bufS += `\n\n${e4.scenario}`;
  dbg(`post-shift triggered entry[${i3}] p=${prio(e4)}`);
}

// --- Dynamic relationship injections ---
const relationshipInjections = getDynamicRelationshipLore(unionTags);
if (relationshipInjections.length > 0) {
    for (const injectionObj of relationshipInjections) {
        const group = injectionObj.group;
        if (group) {
            if (inclusionGroups[group]) {
                dbg(`Skipping relationship injection in group '${group}' due to exclusion.`);
                continue;
            }
            inclusionGroups[group] = true;
        }
        bufP += `\n\n${injectionObj.injection}`;
    }
}

// --- JessicaAI external lore supplement ---
let bufJessicaLore = "";
if (USE_JESSICA_LORE_TOOL && HAS_TOOLS && tools.lore && typeof tools.lore.find === "function") {
  const loreLimit = Math.max(1, Math.min(8, parseInt(JESSICA_LORE_LIMIT, 10) || 2));
  const loreMatches = _safeCall(() => tools.lore.find(CHAT_WINDOW.text_last_only, { limit: loreLimit }), []);
  if (Array.isArray(loreMatches) && loreMatches.length) {
    const lines = [];
    for (const match of loreMatches) {
      const text = _str(match && match.text).trim();
      if (!text) continue;
      const label = _str((match && (match.id || match.source)) || "lore").trim();
      lines.push(`- ${label}: ${text}`);
    }
    if (lines.length) {
      bufJessicaLore = `\n\n[RELATED LORE]\n${lines.join("\n")}`;
    }
  }
}

// --- Persist compact turn metadata ---
if (USE_JESSICA_MEMORY && HAS_MEMORY && typeof memory.set === "function") {
  const firedTags = [];
  for (const k in unionTags) if (unionTags[k] === 1) firedTags.push(k);
  _safeCall(() => memory.set("advanced_lore.last_tags", JSON.stringify(firedTags).slice(0, 1000)), false);
}


/* ============================================================================
   [SECTION] FLUSH
   ========================================================================== */

function _replaceCharTokens(text) {
  const displayName = (_characterNames && _characterNames.length) ? _characterNames[0] : "";
  return displayName ? _str(text).replace(/\{\{char\}\}/g, displayName) : _str(text);
}

const outputParts = [];
if (bufP) outputParts.push(`[CHARACTER GUIDANCE]${_replaceCharTokens(bufP)}`);
if (bufS) outputParts.push(`[SCENE / SCENARIO GUIDANCE]${_replaceCharTokens(bufS)}`);
if (bufJessicaLore) outputParts.push(_replaceCharTokens(bufJessicaLore).trim());
if (_debugBuffer) outputParts.push(_debugBuffer.trim());

const finalOutput = outputParts.join("\n\n").trim().slice(0, 4000);
if (typeof output !== "undefined") {
  output = finalOutput;
}
