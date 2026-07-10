/**
 * GAME STATE EXAMPLE for JessicaAI
 *
 * A practical example demonstrating every game-state tool available on JessicaAI:
 *   tools.game      — flags and generic JSON state
 *   tools.inventory — item counts
 *   tools.quest     — quest statuses
 *   tools.status    — RPG stats (HP, MP, gold, XP, level)
 *   tools.map       — location tracking and movement
 *   tools.encounter — weighted encounter and loot tables
 *   tools.combat    — attack and damage resolution
 *   tools.dice      — dice rolling
 *
 * This is both a working mini-RPG and a learning resource. Each section is
 * commented so you can see exactly which tool is being used and why.
 *
 * JessicaAI Inputs: last_message, last_messages, character, memory, tools
 * JessicaAI Output: assign a non-empty string to `output`
 */

// ============================================================================
// GUARDS — the tools API may not be available on all platforms
// ============================================================================
const HAS_TOOLS  = (typeof tools !== "undefined" && tools);
const HAS_MEMORY = (typeof memory !== "undefined" && memory);

if (!HAS_TOOLS) {
    // On platforms without tools, output nothing (silently ignored)
    output = "";
} else {

// ============================================================================
// WORLD MAP — the script provides the graph; JessicaAI persists the location
// ============================================================================
const WORLD = {
    crossroads: {
        name: "Crossroads",
        desc: "A dusty intersection of three roads. Signs point north, east, and west.",
        exits: { north: "darkwood", east: "riverton", west: "old_mine" }
    },
    darkwood: {
        name: "Darkwood Forest",
        desc: "Gnarled trees block the sky. The air is cold and still.",
        exits: { south: "crossroads", north: "deep_woods" }
    },
    riverton: {
        name: "Riverton Village",
        desc: "A quiet village beside a river. A shop and inn face the square.",
        exits: { west: "crossroads" }
    },
    old_mine: {
        name: "Abandoned Mine",
        desc: "A dark mine entrance yawns in the hillside. Rotting supports creak.",
        exits: { east: "crossroads", down: "mine_shaft" }
    },
    deep_woods: {
        name: "Deep Woods",
        desc: "The forest is ancient here. Strange sounds echo between the trees.",
        exits: { south: "darkwood" }
    },
    mine_shaft: {
        name: "Mine Shaft",
        desc: "Darkness. Your footsteps echo on wet stone. Something gleams in the dark.",
        exits: { up: "old_mine" }
    }
};

// ============================================================================
// FIRST-RUN INITIALIZATION — set up the player's starting state
// ============================================================================
if (!tools.game.hasFlag("started")) {
    tools.game.flag("started");

    // Status: RPG stats (tools.status)
    tools.status.set("hp", 20);
    tools.status.set("max_hp", 20);
    tools.status.set("mp", 10);
    tools.status.set("gold", 5);
    tools.status.set("xp", 0);
    tools.status.set("level", 1);

    // Inventory: starting items (tools.inventory)
    tools.inventory.add("torch", 1);
    tools.inventory.add("bread", 2);
    tools.inventory.add("dagger", 1);

    // Quest: starting quest (tools.quest)
    tools.quest.set("main", "explore_crossroads");

    // Map: starting location (tools.map)
    tools.map.setLocation("crossroads");
}

// ============================================================================
// COMMAND PARSING — read what the player typed
// ============================================================================
const text = (typeof last_message === "string") ? last_message.toLowerCase() : "";
const parts = [];

// --- Movement: "go north", "go east", etc. ---
const moveMatch = text.match(/(?:go|move|walk|head)\s+(north|south|east|west|up|down)/);
if (moveMatch) {
    const dir = moveMatch[1];
    const result = tools.map.move(dir, WORLD);
    if (result.moved) {
        parts.push(`[MOVEMENT] The player traveled ${dir} to ${WORLD[result.location].name}.`);
    } else {
        parts.push(`[MOVEMENT] The player tried to go ${dir} but there is no path that way.`);
    }
}

// --- Attack: "attack", "fight", "strike" ---
if (text.includes("attack") || text.includes("fight") || text.includes("strike")) {
    // tools.combat.attack returns { hit, damage: { total, rolls, ... } }
    const attack = tools.combat.attack(
        { attackBonus: 2, damage: "1d6+1" },   // attacker stats
        { ac: 10 }                               // defender AC
    );

    if (attack.hit) {
        // tools.status.inc reduces enemy HP (we track it in status)
        const enemyHp = tools.status.inc("enemy.hp", -attack.damage.total);
        parts.push(`[COMBAT] The player attacks! Hit for ${attack.damage.total} damage.` +
            (enemyHp <= 0 ? " The enemy is defeated!" : ` Enemy has ${Math.max(0, enemyHp)} HP remaining.`));
    } else {
        parts.push("[COMBAT] The player attacks but misses!");
    }
}

// --- Search/Look: "search", "look", "examine" ---
if (text.includes("search") || text.includes("look around") || text.includes("examine")) {
    const loc = tools.map.location();

    // Mine shaft has a hidden gem
    if (loc === "mine_shaft" && !tools.game.hasFlag("found_gem")) {
        tools.game.flag("found_gem");
        tools.inventory.add("gem", 1);
        tools.status.inc("xp", 10);
        parts.push("[DISCOVERY] The player finds a glowing gemstone hidden among the rocks! +10 XP.");
    }

    // Deep woods has a chance of treasure
    if (loc === "deep_woods" && tools.random.chance(0.4)) {
        const loot = tools.encounter.loot([
            { id: "gold", amount: 3, weight: 70 },
            { id: "herb", amount: 1, weight: 30 }
        ]);
        if (loot) {
            tools.inventory.add(loot.id, loot.amount || 1);
            parts.push(`[DISCOVERY] The player finds ${loot.amount || 1}x ${loot.id} in the undergrowth.`);
        }
    }
}

// --- Rest: "rest", "sleep", "camp" ---
if (text.includes("rest") || text.includes("sleep") || text.includes("camp")) {
    const maxHp = tools.status.get("max_hp", 20);
    tools.status.set("hp", maxHp);
    const mp = tools.status.get("mp", 0);
    tools.status.set("mp", mp + 5);
    parts.push(`[REST] The player rests and recovers to full. HP: ${maxHp}, MP: ${mp + 5}.`);
}

// ============================================================================
// RANDOM ENCOUNTER — chance of an enemy when entering certain locations
// ============================================================================
const loc = tools.map.location();
const dangerousLocs = ["darkwood", "deep_woods", "old_mine", "mine_shaft"];

if (dangerousLocs.includes(loc) && !tools.status.get("enemy.hp", 0)) {
    // tools.encounter.roll picks from a weighted table
    if (tools.random.chance(0.35)) {
        const enemy = tools.encounter.roll([
            { id: "wolf", name: "Gray Wolf", hp: 6, ac: 12, weight: 50 },
            { id: "goblin", name: "Goblin Scout", hp: 8, ac: 10, weight: 30 },
            { id: "spider", name: "Giant Spider", hp: 5, ac: 14, weight: 20 }
        ]);
        if (enemy) {
            tools.status.set("enemy.hp", enemy.hp);
            tools.status.set("enemy.ac", enemy.ac);
            tools.game.set("enemy.name", enemy.name);
            parts.push(`[ENCOUNTER] A ${enemy.name} appears! (HP: ${enemy.hp}, AC: ${enemy.ac})`);
        }
    }
}

// ============================================================================
// ENEMY DEFEATED — clean up and reward
// ============================================================================
const enemyHp = tools.status.get("enemy.hp", 0);
const enemyName = tools.game.get("enemy.name", "");

if (enemyName && enemyHp <= 0) {
    // tools.combat.isDefeated checks if an entity's HP is at or below 0
    const goldReward = tools.dice.d6(1, 1).total;  // 1d6+1 gold
    tools.status.inc("gold", goldReward);
    tools.status.inc("xp", 5);

    // Clear enemy state
    tools.status.set("enemy.hp", 0);
    tools.game.set("enemy.name", "");

    parts.push(`[VICTORY] The ${enemyName} is defeated! +${goldReward} gold, +5 XP.`);

    // Level up every 20 XP
    const xp = tools.status.get("xp", 0);
    const level = tools.status.get("level", 1);
    if (xp >= level * 20) {
        tools.status.inc("level", 1);
        tools.status.inc("max_hp", 5);
        const newMax = tools.status.get("max_hp", 20);
        tools.status.set("hp", newMax);
        parts.push(`[LEVEL UP] The player reaches level ${level + 1}! Max HP is now ${newMax}.`);
    }
}

// ============================================================================
// QUEST PROGRESSION — advance based on location and flags
// ============================================================================
const mainQuest = tools.quest.get("main");

if (mainQuest === "explore_crossroads" && tools.game.hasFlag("found_gem")) {
    tools.quest.set("main", "return_gem");
    parts.push("[QUEST] Main quest updated: 'Return the gem to Riverton.'");
}

if (mainQuest === "return_gem" && loc === "riverton" && tools.inventory.has("gem")) {
    tools.inventory.remove("gem", 1);
    tools.status.inc("gold", 20);
    tools.status.inc("xp", 15);
    tools.quest.set("main", "complete");
    tools.game.flag("quest_complete");
    parts.push("[QUEST] The player returns the gem! +20 gold, +15 XP. Quest complete!");
}

// ============================================================================
// STATUS HUD — always emit current state for the LLM
// ============================================================================
const hp = tools.status.get("hp", 20);
const maxHp = tools.status.get("max_hp", 20);
const mp = tools.status.get("mp", 10);
const gold = tools.status.get("gold", 0);
const xp = tools.status.get("xp", 0);
const level = tools.status.get("level", 1);
const location = tools.map.location();
const locName = (WORLD[location] && WORLD[location].name) || "Unknown";
const locDesc = (WORLD[location] && WORLD[location].desc) || "";
const quest = tools.quest.get("main") || "none";
const currentEnemy = tools.game.get("enemy.name", "");
const enemyHpNow = tools.status.get("enemy.hp", 0);

let hud = `[GAME STATE]
Location: ${locName}${currentEnemy && enemyHpNow > 0 ? ` (in combat with ${currentEnemy})` : ""}
HP: ${hp}/${maxHp} | MP: ${mp} | Gold: ${gold} | XP: ${xp} | Level: ${level}
Quest: ${quest}`;

// Exits hint
const exits = tools.map.exits(WORLD);
if (exits && exits.length > 0) {
    hud += `\nExits: ${exits.join(", ")}`;
}

// Inventory summary
const inv = tools.inventory.list();
if (inv && inv.length > 0) {
    hud += `\nInventory: ${inv.map(i => `${i.id} x${i.count}`).join(", ")}`;
}

hud += `\nScene: ${locDesc}`;

parts.unshift(hud);

// ============================================================================
// COMBAT INSTRUCTIONS — when an enemy is present
// ============================================================================
if (currentEnemy && enemyHpNow > 0) {
    const eAc = tools.status.get("enemy.ac", 10);
    parts.push(`[COMBAT STATUS] ${currentEnemy}: HP ${enemyHpNow}, AC ${eAc}. ` +
        `The player must attack to defeat it. If the player flees, remove the enemy.`);
}

// ============================================================================
// FINAL OUTPUT
// ============================================================================
output = parts.join("\n\n");

// Close the HAS_TOOLS guard
}
