'use strict';

const util = require('util');
const i18n = require('i18n');

const config = require('../config.json');
const pokedex = require('../../static/data/pokedex.json');

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
function getTeamName(teamId) {
    return i18n.__('team_' + teamId);
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
        let string = '';
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
        let typesString = '';
        for (let i = 0; i < info.pokemon_type_ids.length; i++) {
            const typeId = info.pokemon_type_ids[i];
            let formatted = '';
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
        let pokemonString = '';
        for (let i = 0; i < info.pokemon_ids.length; i++) {
            const pokemonId = info.pokemon_ids[i];
            let formatted = '';
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
        let levelsString = '';
        for (let i = 0; i < info.raid_levels.length; i++) {
            const level = info.raid_levels[i];
            let formatted = '';
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
        let alignmentsString = '';
        for (let i = 0; info.alignment_ids.length; i++) {
            const alignment = info.alignment_ids[i];
            let formatted = '';
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
        let categoriesString = '';
        for (let i = 0; i < info.character_category_ids.length; i++) {
            const characterCategory = info.character_category_ids[i];
            let formatted = '';
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


function getPokemonIcon(pokemonId, formId) {
    const padId = (pokemonId + '').padStart(3, '0');
    if (formId > 0) {
        return util.format(config.urls.images.pokemon, padId, formId);
    }
    return util.format(config.urls.images.pokemon, padId, '00');
}

function getRaidIcon(pokemonId, raidLevel) {
    if (pokemonId > 0) {
        return getPokemonIcon(pokemonId, 0);
    }
    return util.format(config.urls.images.eggs, raidLevel);
}

function getQuestIcon(rewards) {
    let iconIndex = 0;
    const obj = JSON.parse(rewards);
    const reward = obj[0];
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
        return getPokemonIcon((reward.info.pokemon_id + '').padStart(3, '0'), 0);
    default: //Unset/Unknown
        break;
    }
    return `./img/quests/${iconIndex}.png`;
}

module.exports = {
    getGruntType,
    getAlignmentName,
    getCharacterCategoryName,
    getThrowType,
    getItem,
    getPokemonType,
    getTeamName,
    getQuestTask,
    getQuestReward,
    getQuestConditions,
    getQuestCondition,
    getPokemonIcon,
    getRaidIcon,
    getQuestIcon,
};