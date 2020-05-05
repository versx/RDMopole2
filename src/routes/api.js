'use strict';

const util = require('util');
const i18n = require('i18n');
const express = require('express');
const router = express.Router();

const config = require('../config.json');
const query = require('../services/db.js');
const queryManual = require('../services/db-manual.js');
const GeofenceService = require('../services/geofence.js');

const svc = new GeofenceService.GeofenceService();

const pokedex = require('../../static/data/pokedex.json');

if (config.pages.raids.enabled) {
    router.get('/raids*', async function(req, res) {
        var raids = await getRaids(req.query);
        res.json({ data: { raids: raids } });
    });
}

if (config.pages.gyms.enabled) {
    router.get('/gyms', async function(req, res) {
        var gyms = await getGyms(req.query);
        res.json({ data: { gyms: gyms } });
    });
}

if (config.pages.quests.enabled) {
    router.get('/quests', async function(req, res) {
        var quests = await getQuests(req.query);
        res.json({ data: { quests: quests } });
    });
}

if (config.pages.invasions.enabled) {
    router.get('/invasions', async function(req, res) {
        var invasions = await getInvasions(req.query);
        res.json({ data: { invasions: invasions } });
    });
}

if (config.pages.nests.enabled) {
    router.get('/nests', async function(req, res) {
        var nests = await getNests(req.query);
        res.json({ data: { nests: nests } });
    });
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
            var imgUrl = getRaidImage(row.raid_pokemon_id, row.raid_level);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var team = getTeamName(row.team_id);
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
                var endTimeLeft = toHHMMSS(secondsLeft);
                var endTime = started ? endTimeLeft : ends.toLocaleTimeString();
                if (name.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                    (gym.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 || filter.gym === '') &&
                    (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team.toLowerCase() === 'all') &&
                    (level.toLowerCase().indexOf(filter.level.toLowerCase()) > -1 || filter.level.toLowerCase() === 'all') &&
                    (ex.toLowerCase().indexOf(filter.ex.toLowerCase()) > -1 || filter.ex.toLowerCase() === 'all') &&
                    (city.toLowerCase().indexOf(filter.city.toLowerCase()) > -1 || filter.city.toLowerCase() === 'all')) {
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
            var team = getTeamName(row.team_id);
            var teamIcon = getTeamIcon(row.team_id);
            var slots = row.availble_slots === 0 ? 'Full' : row.availble_slots === 6 ? 'Empty' : '' + row.availble_slots;
            var guard = row.guarding_pokemon_id === 0 ? 'None' : pokedex[row.guarding_pokemon_id];
            var pkmnIcon = guard === 'None' ? 'None' : getPokemonIcon(row.guarding_pokemon_id, 0);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            var inBattle = row.in_battle ? 'Yes' : 'No';
            if (name.toLowerCase().indexOf(filter.gym.toLowerCase()) > -1 &&
                (team.toLowerCase().indexOf(filter.team.toLowerCase()) > -1 || filter.team === 'all') &&
                (slots.toLowerCase().indexOf(filter.slots.toLowerCase()) > -1 || filter.slots.toLowerCase() === 'all') && // TODO: Accomodate for Full and Empty
                //(guard.toLowerCase().indexOf(filter.guard.toLowerCase()) > -1 || filter.guard.toLowerCase() === 'all') &&
                (inBattle.toLowerCase().indexOf(filter.battle.toLowerCase()) > -1 || filter.battle.toLowerCase() === 'all') &&
                (city.toLowerCase().indexOf(filter.city.toLowerCase()) > -1 || filter.city.toLowerCase() === 'all')) {
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
            var imgUrl = getQuestIcon(row.quest_rewards);
            var reward = getQuestReward(row.quest_rewards);
            var task = getQuestTask(row.quest_type, row.quest_target);
            var conditions = getQuestConditions(row.quest_conditions);
            var geofence = svc.getGeofence(row.lat, row.lon);
            var pokestop = row.name;
            var city = geofence ? geofence.name : 'Unknown';
            if (reward.toLowerCase().indexOf(filter.reward.toLowerCase()) > -1 &&
                pokestop.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (city.toLowerCase().indexOf(filter.city.toLowerCase()) > -1 || filter.city.toLowerCase() === 'all')) {
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
            var gruntType = getGruntType(row.grunt_type);
            var expires = new Date(row.incident_expire_timestamp * 1000).toLocaleTimeString();
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            if ((gruntType.toLowerCase().indexOf(filter.grunt.toLowerCase()) > -1 || filter.grunt.toLowerCase() === 'all') &&
                name.toLowerCase().indexOf(filter.pokestop.toLowerCase()) > -1 &&
                (city.toLowerCase().indexOf(filter.city.toLowerCase()) > -1 || filter.city.toLowerCase() === 'all')) {
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
            var imgUrl = getPokemonIcon(row.pokemon_id, 0);
            var name = row.name;
            var pokemon = pokedex[row.pokemon_id];
            var count = row.pokemon_count;
            var average = row.pokemon_avg;
            var geofence = svc.getGeofence(row.lat, row.lon);
            var city = geofence ? geofence.name : 'Unknown';
            if (name.toLowerCase().indexOf(filter.nest.toLowerCase()) > -1 &&
                pokemon.toLowerCase().indexOf(filter.pokemon.toLowerCase()) > -1 &&
                (city.toLowerCase().indexOf(filter.city.toLowerCase()) > -1 || filter.city.toLowerCase() === 'all')) {
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


function toHHMMSS(secs) {
    var sec_num = parseInt(secs / 1000, 10);
    var minutes = Math.floor(sec_num / 60) % 60;
    var seconds = sec_num % 60;
    return `${minutes}m ${seconds}s`;
}

function getTeamIcon(teamId) {
    var teamName = getTeamName(teamId);
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

function getTeamName(teamId) {
    return i18n.__('team_' + teamId);
}

function getPokemonIcon(pokemonId, formId) {
    var padId = (pokemonId + '').padStart(3, '0');
    var padForm = (formId + '').padStart(3, '0');
    if (formId > 0) {
        return util.format(config.urls.images.pokemon, padId, padForm);
    }
    return util.format(config.urls.images.pokemon, padId, '000');
}

function getRaidImage(pokemonId, raidLevel) {
    if (pokemonId > 0) {
        return getPokemonIcon(pokemonId, 0);
    }
    return util.format(config.urls.images.eggs, raidLevel);
}

function getQuestTask(questId, amount) {
    return i18n.__('quest_' + questId, { amount: amount });
}

function getQuestReward(rewards) {
    const obj = JSON.parse(rewards);
    const reward = obj[0];
    const id = reward.type;
    const info = reward.info;
    if (id === 1 && info !== undefined && info.amount !== undefined) {
        return i18n.__('quest_reward_1_formatted', { amount: info.amount });
    } else if (id === 2 && info !== undefined && info.amount !== undefined && info.item_id !== undefined) {
        return i18n.__('quest_reward_2_formatted', { amount: info.amount, item: getItem(info.item_id) });
    } else if (id === 3 && info !== undefined && info.amount !== undefined) {
        return i18n.__('quest_reward_3_formatted', { amount: info.amount });
    } else if (id === 4 && info !== undefined && info.amount !== undefined && info.pokemon_id !== undefined) {
        return i18n.__('quest_reward_4_formatted', { amount: info.amount, pokemon: pokedex[info.pokemon_id] });
    } else if (id === 7 && info !== undefined && info.pokemon_id !== undefined) {
        var string = '';
        if (info.form_id !== 0 && info.form_id !== null) {
            // TODO: getFormName
            //string = getFormName(info.form_id) + ' ' + pokedex[info.pokemon_id];
            string = pokedex[info.pokemon_id];
        } else {
            string = pokedex[info.pokemon_id];
        }
        if (info.shiny) {
            string += ' (Shiny)';
        }
        return string;
    } else {
        return i18n.__('quest_reward_' + id);
    }
}

function getQuestConditions(conditions) {
    const obj = JSON.parse(conditions);
    if (obj && obj.length > 0) {
        return getQuestCondition(obj[0]);
    }
    return '';
}

function getQuestCondition(condition) {
    /* eslint-disable no-redeclare */
    const id = condition.type;
    const info = condition.info;
    if (id === 1 && info !== undefined && info.pokemon_type_ids !== undefined) {
        var typesString = '';
        for (var i = 0; i < info.pokemon_type_ids.length; i++) {
            var typeId = info.pokemon_type_ids[i];
            var formatted = '';
            if (i === 0) {
                formatted = '';
            } else if (i === info.pokemon_type_ids.length - 1) {
                formatted = ' or ';
            } else {
                formatted = ', ';
            }
            typesString += formatted + getPokemonType(typeId);
        }
        return i18n.__('quest_condition_1_formatted', { types: typesString });
    } else if (id === 2 && info !== undefined && info.pokemon_ids !== undefined) {
        var pokemonString = '';
        for (var i = 0; i < info.pokemon_ids.length; i++) {
            var pokemonId = info.pokemon_ids[i];
            var formatted = '';
            if (i === 0) {
                formatted = '';
            } else if (i === info.pokemon_ids.length - 1) {
                formatted = ' or ';
            } else {
                formatted = ', ';
            }
            pokemonString += formatted + pokedex[pokemonId];
        }
        return i18n.__('quest_condition_2_formatted', { pokemon: pokemonString });
    } else if (id === 7 && info !== undefined && info.raid_levels !== undefined) {
        var levelsString = '';
        for (var i = 0; i < info.raid_levels.length; i++) {
            var level = info.raid_levels[i];
            var formatted = '';
            if (i === 0) {
                formatted = '';
            } else if (i === info.raid_levels.length - 1) {
                formatted = ' or ';
            } else {
                formatted = ', ';
            }
            levelsString += formatted + level;
        }
        return i18n.__('quest_condition_7_formatted', { levels: levelsString });
    } else if (id === 8 && info !== undefined && info.throw_type_id !== undefined) {
        return i18n.__('quest_condition_8_formatted', { throw_type: getThrowType(info.throw_type_id) });
    } else if (id === 11 && info !== undefined && info.item_id !== undefined) {
        return i18n.__('quest_condition_11_formatted', { item: getItem(info.item_id) });
    } else if (id === 14 && info !== undefined && info.throw_type_id !== undefined) {
        return i18n.__('quest_condition_14_formatted', { throw_type: getThrowType(info.throw_type_id) });
    } else if (id === 26 && info !== undefined && info.alignment_ids !== undefined) {
        var alignmentsString = '';
        for (var i = 0; info.alignment_ids.length; i++) {
            var alignment = info.alignment_ids[i];
            var formatted = '';
            if (i === 0) {
                formatted = '';
            } else if (i === info.alignment_ids.length - 1) {
                formatted = ' or ';
            } else {
                formatted = ', ';
            }
            alignmentsString += formatted + getAlignmentName(alignment);
        }
        return i18n.__('quest_condition_26_formatted', { alignments: alignmentsString });
    } else if (id === 27 && info !== undefined && info.character_category_ids !== undefined) {
        var categoriesString = '';
        for (var i = 0; i < info.character_category_ids.length; i++) {
            var characterCategory = info.character_category_ids[i];
            var formatted = '';
            if (i === 0) {
                formatted = '';
            } else if (i === info.character_category_ids.length - 1) {
                formatted = ' or ';
            } else {
                formatted = ', ';
            }
            categoriesString += formatted + getCharacterCategoryName(characterCategory);
        }
        return i18n.__('quest_condition_27_formatted', { categories: categoriesString });
    } else {
        return i18n.__('quest_condition_' + id);
    }
    /* eslint-enable no-unused-vars */
}

function getQuestIcon(rewards) {
    var iconIndex = 0;
    var obj = JSON.parse(rewards);
    var reward = obj[0];
    switch (reward.type) {
    case 1://Experience
        iconIndex = -2;
        break;
    case 2://Item
        iconIndex = reward.info.item_id;
        break;
    case 3://Stardust
        iconIndex = -1;
        break;
    case 4://Candy
        iconIndex = 1301;
        break;
    case 5://AvatarClothing
        break;
    case 6://Quest
        break;
    case 7://Pokemon
        var padId = (reward.info.pokemon_id + '').padStart(3, '0');
        return getPokemonIcon(padId, 0);
    default: //Unset/Unknown
        break;
    }
    return `./img/quests/${iconIndex}.png`;
}

function getGruntType(gruntType) {
    return i18n.__('grunt_' + gruntType);
}
function getAlignmentName(alignmentId) {
    return i18n.__('alignment_' + alignmentId);
}
function getCharacterCategoryName(characterCategoryId) {
    return i18n.__('character_category_' + characterCategoryId);
}
function getThrowType(throwTypeId) {
    return i18n.__('throw_type_' + throwTypeId);
}
function getItem(itemId) {
    return i18n.__('item_' + itemId);
}
function getPokemonType(type) {
    return i18n.__('pokemon_type_' + type);
}

module.exports = router;