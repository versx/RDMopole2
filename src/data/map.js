'use strict';

const util = require('util');

const config = require('../config.json');
const query = require('../services/db.js');
const queryManual = require('../services/db-manual.js');
const GeofenceService = require('../services/geofence.js');
const locale = require('../services/locale.js');
const utils = require('../services/utils.js');
const svc = new GeofenceService.GeofenceService();

const pokedex = require('../../static/data/pokedex.json');

async function getStats() {
    const sql = `
    SELECT
        (
            SELECT COUNT(id)
            FROM   pokestop
        ) AS pokestops,
        (
            SELECT COUNT(id)
            FROM   gym
        ) AS gyms,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  raid_end_timestamp > UNIX_TIMESTAMP()
        ) AS raids,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  quest_reward_type IS NOT NULL
        ) AS quests,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  incident_expire_timestamp > UNIX_TIMESTAMP()
        ) AS invasions,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  team_id = 0
        ) AS neutral,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  team_id = 1
        ) AS mystic,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  team_id = 2
        ) AS valor,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  team_id = 3
        ) AS instinct,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  raid_end_timestamp > UNIX_TIMESTAMP() AND ex_raid_eligible=1
        ) AS raids_ex,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  raid_end_timestamp > UNIX_TIMESTAMP() AND raid_pokemon_gender=1
        ) AS raids_male,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  raid_end_timestamp > UNIX_TIMESTAMP() AND raid_pokemon_gender=2
        ) AS raids_female,
        (
            SELECT COUNT(id)
            FROM   gym
            WHERE  in_battle=1
        ) AS gyms_attack,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  lure_expire_timestamp > UNIX_TIMESTAMP() AND lure_id=501
        ) AS lures_normal,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  lure_expire_timestamp > UNIX_TIMESTAMP() AND lure_id=502
        ) AS lures_glacial,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  lure_expire_timestamp > UNIX_TIMESTAMP() AND lure_id=503
        ) AS lures_mossy,
        (
            SELECT COUNT(id)
            FROM   pokestop
            WHERE  lure_expire_timestamp > UNIX_TIMESTAMP() AND lure_id=504
        ) AS lures_magnetic,
        (
            SELECT COUNT(id)
            FROM   spawnpoint
        ) AS spawnpoints_total,
        (
            SELECT COUNT(id)
            FROM   spawnpoint
            WHERE  despawn_sec IS NOT NULL
        ) AS spawnpoints_found,
        (
            SELECT COUNT(id)
            FROM   spawnpoint
            WHERE  despawn_sec IS NULL
        ) AS spawnpoints_missing
    FROM metadata
    LIMIT 1;
    `;
    const results = await query(sql);
    if (results && results.length > 0) {
        return results[0];        
    }
    return null;
}

async function getPokemonIVStats() {
    const sql = `
    SELECT * FROM (
        SELECT SUM(count) AS pokemon_total
        FROM pokemon_stats
    ) AS A
    JOIN (
        SELECT SUM(count) AS iv_total
        FROM pokemon_iv_stats
    ) AS B
    JOIN (
        SELECT SUM(count) AS shiny_total
        FROM pokemon_shiny_stats
    ) AS C
    JOIN (
        SELECT
            COUNT(id) AS active,
            SUM(iv IS NOT NULL) AS active_iv,
            SUM(iv = 100) AS active_100iv,
            SUM(iv >= 90 AND iv < 100) AS active_90iv,
            SUM(iv = 0) AS active_0iv,
            SUM(shiny = 1) AS active_shiny
        FROM pokemon
        WHERE expire_timestamp >= UNIX_TIMESTAMP()
    ) AS D
    `;
    const results = await query(sql);
    return results;
}

async function getPokemonOverviewStats() {
    const sql = `
    SELECT date, SUM(count) AS count
    FROM pokemon_stats
    GROUP BY date
    `;
    const results = await query(sql);
    return results;
}

async function getTopPokemonIVStats(iv = 100, limit = 10) {
    const sql = `
    SELECT pokemon_id, iv, COUNT(iv) AS count
    FROM pokemon
    WHERE first_seen_timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL 24 HOUR) AND iv = ?
    GROUP BY pokemon_id
    ORDER BY count DESC
    LIMIT ?
    `;
    const args = [iv, limit];
    const results = await query(sql, args);
    return results;
}

async function getTopPokemonStats(lifetime = false, limit = 10) {
    let sql = '';
    if (lifetime) {
        sql = `
        SELECT iv.pokemon_id, SUM(shiny.count) AS shiny, SUM(iv.count) AS count
        FROM pokemon_iv_stats iv
          LEFT JOIN pokemon_shiny_stats shiny
          ON iv.date = shiny.date AND iv.pokemon_id = shiny.pokemon_id
        GROUP BY iv.pokemon_id
        ORDER BY count DESC
        LIMIT ?
        `;
    } else {
        sql = `
        SELECT iv.pokemon_id, SUM(shiny.count) AS shiny, SUM(iv.count) AS count
        FROM pokemon_iv_stats iv
          LEFT JOIN pokemon_shiny_stats shiny
          ON iv.date = shiny.date AND iv.pokemon_id = shiny.pokemon_id
        WHERE iv.date = FROM_UNIXTIME(UNIX_TIMESTAMP(), '%Y-%m-%d')
        GROUP BY iv.pokemon_id
        ORDER BY count DESC
        LIMIT ?
        `;
    }
    const args = [limit];
    const results = await query(sql, args);
    return results;
}

async function getPokemonHeatmapStats(filter) {
    const start = filter.start;
    const end = filter.end;
    const pokemonId = filter.pokemon_id;
    const sql = `
    SELECT pokemon_id, lat, lon, expire_timestamp
    FROM pokemon
    WHERE pokemon_id = ? AND expire_timestamp >= ? AND expire_timestamp <= ?
    `;
    const args = [pokemonId, start, end];
    const results = await query(sql, args);
    return results;
}

async function getShinyRates(filter) {
    const date = filter.date || utils.formatDate(new Date());
    let sql = `
    SELECT date, pokemon_id, count
    FROM pokemon_shiny_stats
    WHERE date = ?
    `;
    const args = [date];
    const shinyResults = await query(sql, args);
    sql = `
    SELECT date, pokemon_id, count
    FROM pokemon_iv_stats
    WHERE date = ?
    `;
    const ivResults = await query(sql, args);
    if (shinyResults) {
        const getTotalCount = (x) => {
            for (let i = 0; i < ivResults.length; i++) {
                const row = ivResults[i];
                if (row.pokemon_id === x) {
                    return row.count;
                }
            }
        };

        const data = [];
        for (let i = 0; i < shinyResults.length; i++) {
            const row = shinyResults[i];
            const pokemonId = row.pokemon_id;
            const name = pokedex[pokemonId];
            const shiny = (row.count || 0);
            const total = (getTotalCount(pokemonId) || 0);
            const rate = shiny === 0 || total === 0 ? 0 : Math.round(total / shiny);
            const imageUrl = locale.getPokemonIcon(pokemonId, 0);
            data.push({
                id: `#${pokemonId}`,
                pokemon: `<img src="${imageUrl}" width="auto" height="32" />&nbsp;${name}`,
                rate: `1/${rate}`,
                count: `${shiny.toLocaleString()}/${total.toLocaleString()}`
            });
        }
        return data;
    }
    return [];
}

async function getCommunityDayStats(filter) {
    const start = filter.start;
    const end = filter.end;
    const pokemonId = filter.pokemon_id;
    const sql = `
    SELECT
        COUNT(id) AS total,
        SUM(iv > 0) AS with_iv,
        SUM(iv IS NULL) AS without_iv,
        SUM(iv = 0) AS iv_0,
        SUM(iv >= 1 AND iv < 10) AS iv_1_9,
        SUM(iv >= 10 AND iv < 20) AS iv_10_19,
        SUM(iv >= 20 AND iv < 30) AS iv_20_29,
        SUM(iv >= 30 AND iv < 40) AS iv_30_39,
        SUM(iv >= 40 AND iv < 50) AS iv_40_49,
        SUM(iv >= 50 AND iv < 60) AS iv_50_59,
        SUM(iv >= 60 AND iv < 70) AS iv_60_69,
        SUM(iv >= 70 AND iv < 80) AS iv_70_79,
        SUM(iv >= 80 AND iv < 90) AS iv_80_89,
        SUM(iv >= 90 AND iv < 100) AS iv_90_99,
        SUM(iv = 100) AS iv_100,
        SUM(gender = 1) AS male,
        SUM(gender = 2) AS female,
        SUM(gender = 3) AS genderless,
        SUM(level >= 1 AND level <= 9) AS level_1_9,
        SUM(level >= 10 AND level <= 19) AS level_10_19,
        SUM(level >= 20 AND level <= 29) AS level_20_29,
        SUM(level >= 30 AND level <= 35) AS level_30_35
    FROM pokemon
    WHERE pokemon_id = ?
        AND first_seen_timestamp >= ?
        AND first_seen_timestamp <= ?
    `;
    const args = [pokemonId, start, end];
    const results = await query(sql, args);
    if (results && results.length > 0) {
        const data = results[0];
        data.pokemon_id = pokemonId;
        data.start = start;
        data.end = end;
        const id = parseInt(pokemonId);
        data.evo1 = {
            name: `${pokedex[id]} (#${id})`,
            image: locale.getPokemonIcon(id, 0)
        };
        data.evo2 = {
            name: `${pokedex[id + 1]} (#${id + 1})`,
            image: locale.getPokemonIcon(id + 1, 0)
        };
        data.evo3 = {
            name: `${pokedex[id + 2]} (#${id + 2})`,
            image: locale.getPokemonIcon(id + 2, 0)
        };
        return data;
    }
    return null;
}

async function getPokemonStats(filter) {
    const start = filter.start;
    const end = filter.end;
    const pokemonId = filter.pokemon_id;
    const all = pokemonId === 'all' ? '' : 'WHERE date > ? AND date < ? AND pokemon_id = ?';
    const sql = `
    SELECT date, pokemon_id, count
    FROM pokemon_stats
    ${all}
    `;
    const args = [start, end, pokemonId];
    const results = await query(sql, args);
    return results;
}

async function getRaidStats(filter) {
    const start = filter.start;
    const end = filter.end;
    const pokemonId = filter.pokemon_id;
    const all = pokemonId === 'all' ? '' : 'WHERE date > ? AND date < ? AND pokemon_id = ?';
    const sql = `
    SELECT date, pokemon_id, count
    FROM raid_stats
    ${all}
    `;
    const args = [start, end, pokemonId];
    const results = await query(sql, args);
    return results;
}

async function getQuestStats(filter) {
    const start = filter.start;
    const end = filter.end;
    let reward = filter.reward;
    let sql;
    if (reward.includes('poke_')) {
        // Pokemon
        sql = `
        SELECT date, pokemon_id, count
        FROM quest_stats
        WHERE reward_type = 7 AND pokemon_id = ? ${reward === 'all' ? '' : ' AND date > ? AND date < ?'}
        `;
        reward = reward.replace('poke_', '');
    } else if (reward.includes('item_')) {
        // Item
        sql = `
        SELECT date, item_id, count
        FROM quest_stats
        WHERE reward_type = 2 AND item_id = ? ${reward === 'all' ? '' : ' AND date > ? AND date < ?'}
        `;
        reward = reward.replace('item_', '');
    } else {
        // Stardust
        sql = `
        SELECT date, item_id, count
        FROM quest_stats
        WHERE reward_type = 3 AND item_id = ? ${reward === 'all' ? '' : ' AND date > ? AND date < ?'}
        `;
        reward = '0';
    }
    const args = [reward, start, end];
    const results = await query(sql, args);
    return results;
}

async function getInvasionStats(filter) {
    const start = filter.start;
    const end = filter.end;
    const grunt = filter.grunt;
    const all = grunt === 'all' ? '' : 'WHERE date > ? AND date < ? AND grunt_type = ?';
    const sql = `
    SELECT date, grunt_type, count
    FROM invasion_stats
    ${all}
    `;
    const args = [start, end, grunt];
    const results = await query(sql, args);
    return results;
}

async function getRaids(filter) {
    const sql = `
    SELECT
        id,
        raid_battle_timestamp,
        raid_end_timestamp,
        lat,
        lon,
        raid_level,
        raid_pokemon_id,
        raid_pokemon_move_1,
        raid_pokemon_move_2,
        name,
        team_id,
        ex_raid_eligible,
        updated
    FROM gym
    WHERE
        raid_pokemon_id IS NOT NULL
        AND name IS NOT NULL
        AND raid_end_timestamp > UNIX_TIMESTAMP()
    ORDER BY raid_end_timestamp
    `;
    const results = await query(sql);
    if (results && results.length > 0) {
        var raids = [];
        results.forEach(function(row) {
            const name = row.raid_pokemon_id === 0 ? 'Egg' : `${pokedex[row.raid_pokemon_id]} (#${row.raid_pokemon_id})`;
            const imgUrl = locale.getRaidIcon(row.raid_pokemon_id, row.raid_level);
            const geofence = svc.getGeofence(row.lat, row.lon);
            const team = locale.getTeamName(row.team_id);
            const teamIcon = getTeamIcon(row.team_id);
            const gym = row.name;
            const level = '' + row.raid_level;
            const ex = row.ex_raid_eligible ? 'Yes' : 'No';
            const city = geofence ? geofence.name : 'Unknown';
            const now = new Date();
            const starts = new Date(row.raid_battle_timestamp * 1000);
            const started = starts < now;
            const startTime = started ? '--' : starts.toLocaleTimeString();
            const ends = new Date(row.raid_end_timestamp * 1000);
            const secondsLeft = ends - now;
            // Skip raids that have less than 60 seconds remaining.
            if (secondsLeft > 60 * 1000) {
                const endTimeLeft = utils.toHHMMSS(secondsLeft);
                const endTime = started ? endTimeLeft : ends.toLocaleTimeString();
                if (name.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                    (gym.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 || filter.gym === '') &&
                    (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team.toLowerCase() === 'all') &&
                    (level.toLowerCase().indexOf(filter.level.toLowerCase()) > -1 || filter.level.toLowerCase() === 'all') &&
                    (ex.toLowerCase().indexOf(filter.ex.toLowerCase()) > -1 || filter.ex.toLowerCase() === 'all') &&
                    (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                    const mapLink = util.format(config.google.maps, row.lat, row.lon);
                    raids.push({
                        pokemon: `<img src='${imgUrl}' width=auto height=32 />&nbsp;${name}`,
                        raid_starts: startTime,
                        raid_ends: endTime,
                        raid_level: 'Level ' + level,
                        gym_name: `<a href='${mapLink}' target='_blank'>${gym}</a>`,
                        team: teamIcon,
                        ex_eligible: ex,
                        city: city
                    });
                }
            }
        });
        return raids;
    }
    return [];
}

async function getGyms(filter) {
    const sql = `
    SELECT 
        lat, 
        lon,
        guarding_pokemon_id,
        availble_slots,
        team_id,
        in_battle,
        name,
        updated
    FROM gym
    WHERE
        name IS NOT NULL
        AND enabled = 1;
    `;
    const results = await query(sql);
    if (results && results.length > 0) {
        const gyms = [];
        results.forEach(function(row) {
            const name = row.name;
            const team = locale.getTeamName(row.team_id);
            const teamIcon = getTeamIcon(row.team_id);
            const slots = row.availble_slots === 0 ? 'Full' : row.availble_slots === 6 ? 'Empty' : '' + row.availble_slots;
            const guard = row.guarding_pokemon_id === 0 ? 'None' : pokedex[row.guarding_pokemon_id];
            const pkmnIcon = guard === 'None' ? 'None' : locale.getPokemonIcon(row.guarding_pokemon_id, 0);
            const geofence = svc.getGeofence(row.lat, row.lon);
            const city = geofence ? geofence.name : 'Unknown';
            const inBattle = row.in_battle ? 'Yes' : 'No';
            if (name.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 &&
                (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team === 'all') &&
                (slots.toLowerCase().indexOf(filter.slots.toLowerCase()) > -1 || filter.slots.toLowerCase() === 'all') && // TODO: Accomodate for Full and Empty
                //(guard.toLowerCase().indexOf(filter.guard.toLowerCase()) > -1 || filter.guard.toLowerCase() === 'all') &&
                (inBattle.toLowerCase().indexOf(filter.battle.toLowerCase()) > -1 || filter.battle.toLowerCase() === 'all') &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                const mapLink = util.format(config.google.maps, row.lat, row.lon);
                gyms.push({
                    name: `<a href='${mapLink}' target='_blank'>${name}</a>`,
                    team: teamIcon,
                    available_slots: slots,
                    guarding_pokemon_id: pkmnIcon === 'None' ? 'None' : `<img src='${pkmnIcon}' width=auto height=32 />&nbsp;${guard}`,
                    in_battle: inBattle,
                    city: city
                    // TODO: Updated
                });
            }
        });
        return gyms;
    }
    return [];
}

async function getQuests(filter) {
    const sql = `
    SELECT 
        lat, 
        lon,
        quest_type,
        quest_timestamp, 
        quest_target,
        quest_conditions,
        quest_rewards,
        quest_template,
        quest_pokemon_id,
        quest_reward_type,
        quest_item_id,
        name,
        updated
    FROM
        pokestop
    WHERE
        quest_type IS NOT NULL
        AND name IS NOT NULL
        AND enabled = 1;
    `;
    const results = await query(sql);
    if (results && results.length > 0) {
        const quests = [];
        results.forEach(function(row) {
            const name = row.name;
            const imgUrl = locale.getQuestIcon(row.quest_rewards);
            const reward = locale.getQuestReward(row.quest_rewards);
            const task = locale.getQuestTask(row.quest_type, row.quest_target);
            const conditions = locale.getQuestConditions(row.quest_conditions);
            const geofence = svc.getGeofence(row.lat, row.lon);
            const pokestop = row.name;
            const city = geofence ? geofence.name : 'Unknown';
            if (reward.toLowerCase().indexOf(filter.reward.toLowerCase()) > -1 &&
                task.toLowerCase().indexOf(filter.task.toLowerCase()) > -1 &&
                pokestop.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                const mapLink = util.format(config.google.maps, row.lat, row.lon);
                quests.push({
                    reward: `<img src='${imgUrl}' width=auto height=32 />&nbsp;${reward}`,
                    quest: task,
                    conditions: conditions,
                    pokestop_name: `<a href='${mapLink}' target='_blank'>${name}</a>`,
                    city: city
                    // TODO: Updated
                });
            }
        });
        return quests;
    }
    return [];
}

async function getInvasions(filter) {
    const sql = `
    SELECT 
        lat, 
        lon,
        name,
        grunt_type,
        incident_expire_timestamp,
        updated
    FROM
        pokestop
    WHERE
        incident_expire_timestamp > UNIX_TIMESTAMP()
        AND enabled = 1;
    `;
    const results = await query(sql);
    if (results && results.length > 0) {
        const invasions = [];
        results.forEach(function(row) {
            const name = row.name || '';
            const gruntType = locale.getGruntType(row.grunt_type);
            const expires = new Date(row.incident_expire_timestamp * 1000).toLocaleTimeString();
            const geofence = svc.getGeofence(row.lat, row.lon);
            const city = geofence ? geofence.name : 'Unknown';
            if ((utils.inArray(filter.grunt, gruntType) || filter.grunt.toLowerCase() === 'all') &&
                name.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                const mapLink = util.format(config.google.maps, row.lat, row.lon);
                invasions.push({
                    grunt_type: `<img src='./img/grunts/${row.grunt_type}.png' width=auto height=32 />&nbsp;${gruntType}`,
                    pokestop_name: `<a href='${mapLink}' target='_blank'>${name}</a>`,
                    expires: expires,
                    city: city
                    // TODO: Updated
                });
            }
        });
        return invasions;
    }
    return [];
}

async function getNests(filter) {
    const sql = `
    SELECT 
        lat, 
        lon,
        name,
        pokemon_id,
        pokemon_count,
        pokemon_avg,
        updated
    FROM nests
    WHERE name IS NOT NULL
    `;
    const results = await queryManual(sql);
    if (results && results.length > 0) {
        const nests = [];
        results.forEach(function(row) {
            const imgUrl = locale.getPokemonIcon(row.pokemon_id, 0);
            const name = row.name;
            const pokemon = pokedex[row.pokemon_id];
            const count = row.pokemon_count;
            const average = row.pokemon_avg;
            const geofence = svc.getGeofence(row.lat, row.lon);
            const city = geofence ? geofence.name : 'Unknown';
            if (name.toLowerCase().indexOf(filter.nest.toLowerCase()) > -1 &&
                pokemon.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                const mapLink = util.format(config.google.maps, row.lat, row.lon);
                nests.push({
                    name: `<a href='${mapLink}' target='_blank'>${name}</a>`,
                    pokemon: `<img src='${imgUrl}' width=auto height=32 />&nbsp;${pokemon}`,
                    count: count,
                    average: average,
                    city: city
                    // TODO: Updated
                });
            }
        });
        return nests;
    }
    return [];
}

async function getGymDefenders(limit = 10) {
    const sql = `
	SELECT guarding_pokemon_id, COUNT(guarding_pokemon_id) AS count
	FROM gym
	GROUP BY guarding_pokemon_id
	ORDER BY count DESC
	LIMIT ?
    `;
    const args = [limit];
    const results = await query(sql, args);
    return results;
}

async function getGymsUnderAttack(limit = 10) {
    const sql = `
    SELECT name, lat, lon, team_id, availble_slots, IF(raid_battle_timestamp > UNIX_TIMESTAMP(), 1, 0) AS has_egg, raid_battle_timestamp
    FROM gym
    WHERE in_battle = 1
    LIMIT ?
    `;
    const args = [limit];
    const results = await query(sql, args);
    return results;
}

async function getNewPokestops(lastHours = 24) {
    const sql = `
    SELECT id, lat, lon, name, url, first_seen_timestamp
    FROM pokestop
    WHERE first_seen_timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL ? HOUR)
    `;
    const args = [lastHours];
    const results = await query(sql, args);
    return results;
}

async function getNewGyms(lastHours = 24) {
    const sql = `
    SELECT id, lat, lon, name, url, first_seen_timestamp
    FROM gym
    WHERE first_seen_timestamp > UNIX_TIMESTAMP(NOW() - INTERVAL ? HOUR)
    `;
    const args = [lastHours];
    const results = await query(sql, args);
    return results;
}

function getTeamIcon(teamId) {
    var teamName = locale.getTeamName(teamId);
    switch (teamId) {
    case 1:
        return '<img src="./img/teams/mystic.png" width=auto height=32 />&nbsp;' + teamName;
    case 2:
        return '<img src="./img/teams/valor.png" width=auto height=32 />&nbsp;' + teamName;
    case 3:
        return '<img src="./img/teams/instinct.png" width=auto height=32 />&nbsp;' + teamName;
    default:
        return '<img src="./img/teams/neutral.png" width=auto height=32 />&nbsp;' + teamName;
    }
}

function getPokemonNameIdsList() {
    const dex = pokedex;
    const result = Object.keys(dex).map(x => { return { 'id': x, 'name': pokedex[x] }; });
    return result;
}

async function getQuestRewardsList() {
    const rewards = [{ id: 'stardust', name: 'Stardust' }]; // TODO: Localize
    let sql = 'SELECT item_id AS id FROM quest_stats WHERE reward_type=2 GROUP BY item_id';
    const itemResults = await query(sql);
    if (itemResults && itemResults.length > 0) {
        itemResults.forEach(reward => rewards.push({
            id: 'item_' + reward.id,
            name: locale.getItem(reward.id)
        }));
    }
    sql = 'SELECT pokemon_id AS id FROM quest_stats WHERE reward_type=7 GROUP BY pokemon_id';
    const pokemonResults = await query(sql);
    if (pokemonResults && pokemonResults.length > 0) {
        pokemonResults.forEach(reward => rewards.push({
            id: 'poke_' + reward.id,
            name: locale.getPokemonName(reward.id)
        }));
    }
    return rewards;
}

module.exports = {
    getStats,
    getPokemonIVStats,
    getTopPokemonIVStats,
    getTopPokemonStats,
    getGymDefenders,
    getGymsUnderAttack,
    getPokemonOverviewStats,
    getPokemonHeatmapStats,
    getShinyRates,
    getCommunityDayStats,
    getPokemonStats,
    getRaids,
    getRaidStats,
    getGyms,
    getQuests,
    getQuestStats,
    getInvasions,
    getInvasionStats,
    getNests,
    getNewPokestops,
    getNewGyms,
    getPokemonNameIdsList,
    getQuestRewardsList
};