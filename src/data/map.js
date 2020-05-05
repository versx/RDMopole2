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
    var sql = `
    SELECT
        (
            SELECT COUNT(*)
            FROM   gym
        ) AS gyms,
        (
            SELECT COUNT(*)
            FROM   gym
            WHERE raid_end_timestamp > UNIX_TIMESTAMP()
        ) AS raids,
        (
            SELECT COUNT(*)
            FROM   pokestop
            WHERE quest_reward_type IS NOT NULL
        ) AS quests,
        (
            SELECT COUNT(*)
            FROM   pokestop
            WHERE incident_expire_timestamp > UNIX_TIMESTAMP()
        ) AS invasions,
        (
            SELECT COUNT(*)
            FROM   gym
            WHERE  team_id = 0
        ) AS neutral,
        (
            SELECT COUNT(*)
            FROM   gym
            WHERE  team_id = 1
        ) AS mystic,
        (
            SELECT COUNT(*)
            FROM   gym
            WHERE  team_id = 2
        ) AS valor,
        (
            SELECT COUNT(*)
            FROM   gym
            WHERE  team_id = 3
        ) AS instinct
    FROM rdmdb.metadata
    LIMIT 1;
    `;
    var results = await query(sql);
    if (results && results.length > 0) {
        return results[0];        
    }
    return null;
}

async function getRaids(filter) {
    var sql = `
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
    ORDER BY raid_end_timestamp;
    `;
    var results = await query(sql);
    if (results && results.length > 0) {
        var raids = [];
        results.forEach(function(row) {
            var name = row.raid_pokemon_id === 0 ? 'Egg' : `${pokedex[row.raid_pokemon_id]} (#${row.raid_pokemon_id})`;
            var imgUrl = locale.getRaidIcon(row.raid_pokemon_id, row.raid_level);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var team = locale.getTeamName(row.team_id);
            var teamIcon = getTeamIcon(row.team_id);
            var gym = row.name;
            var level = '' + row.raid_level;
            var ex = row.ex_raid_eligible ? 'Yes' : 'No';
            var city = geofence ? geofence.name : 'Unknown';
            var now = new Date();
            var starts = new Date(row.raid_battle_timestamp * 1000);
            var started = starts < now;
            var startTime = started ? '--' : starts.toLocaleTimeString();
            var ends = new Date(row.raid_end_timestamp * 1000);
            var secondsLeft = ends - now;
            // Skip raids that have less than 60 seconds remaining.
            if (secondsLeft > 60 * 1000) {
                var endTimeLeft = utils.toHHMMSS(secondsLeft);
                var endTime = started ? endTimeLeft : ends.toLocaleTimeString();
                if (name.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                    (gym.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 || filter.gym === '') &&
                    (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team.toLowerCase() === 'all') &&
                    (level.toLowerCase().indexOf(filter.level.toLowerCase()) > -1 || filter.level.toLowerCase() === 'all') &&
                    (ex.toLowerCase().indexOf(filter.ex.toLowerCase()) > -1 || filter.ex.toLowerCase() === 'all') &&
                    (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                    var mapLink = util.format(config.google.maps, row.lat, row.lon);
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
    var sql = `
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
    var results = await query(sql);
    if (results && results.length > 0) {
        var gyms = [];
        results.forEach(function(row) {
            var name = row.name;
            var team = locale.getTeamName(row.team_id);
            var teamIcon = getTeamIcon(row.team_id);
            var slots = row.availble_slots === 0 ? 'Full' : row.availble_slots === 6 ? 'Empty' : '' + row.availble_slots;
            var guard = row.guarding_pokemon_id === 0 ? 'None' : pokedex[row.guarding_pokemon_id];
            var pkmnIcon = guard === 'None' ? 'None' : locale.getPokemonIcon(row.guarding_pokemon_id, 0);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            var inBattle = row.in_battle ? 'Yes' : 'No';
            if (name.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 &&
                (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team === 'all') &&
                (slots.toLowerCase().indexOf(filter.slots.toLowerCase()) > -1 || filter.slots.toLowerCase() === 'all') && // TODO: Accomodate for Full and Empty
                //(guard.toLowerCase().indexOf(filter.guard.toLowerCase()) > -1 || filter.guard.toLowerCase() === 'all') &&
                (inBattle.toLowerCase().indexOf(filter.battle.toLowerCase()) > -1 || filter.battle.toLowerCase() === 'all') &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                var mapLink = util.format(config.google.maps, row.lat, row.lon);
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
    var sql = `
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
    var results = await query(sql);
    if (results && results.length > 0) {
        var quests = [];
        results.forEach(function(row) {
            var name = row.name;
            var imgUrl = locale.getQuestIcon(row.quest_rewards);
            var reward = locale.getQuestReward(row.quest_rewards);
            var task = locale.getQuestTask(row.quest_type, row.quest_target);
            var conditions = locale.getQuestConditions(row.quest_conditions);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var pokestop = row.name;
            var city = geofence ? geofence.name : 'Unknown';
            if (reward.toLowerCase().indexOf(filter.reward.toLowerCase()) > -1 &&
                pokestop.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                var mapLink = util.format(config.google.maps, row.lat, row.lon);
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
    var sql = `
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
    var results = await query(sql);
    if (results && results.length > 0) {
        var invasions = [];
        results.forEach(function(row) {
            var name = row.name || '';
            var gruntType = locale.getGruntType(row.grunt_type);
            var expires = new Date(row.incident_expire_timestamp * 1000).toLocaleTimeString();
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            if ((utils.inArray(filter.grunt, gruntType) || filter.grunt.toLowerCase() === 'all') &&
                name.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                var mapLink = util.format(config.google.maps, row.lat, row.lon);
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
    var sql = `
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
    var results = await queryManual(sql);
    if (results && results.length > 0) {
        var nests = [];
        results.forEach(function(row) {
            var imgUrl = locale.getPokemonIcon(row.pokemon_id, 0);
            var name = row.name;
            var pokemon = pokedex[row.pokemon_id];
            var count = row.pokemon_count;
            var average = row.pokemon_avg;
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            if (name.toLowerCase().indexOf(filter.nest.toLowerCase()) > -1 &&
                pokemon.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                (utils.inArray(filter.city, city) || filter.city.toLowerCase() === 'all')) {
                var mapLink = util.format(config.google.maps, row.lat, row.lon);
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

module.exports = {
    getStats,
    getRaids,
    getGyms,
    getQuests,
    getInvasions,
    getNests
};