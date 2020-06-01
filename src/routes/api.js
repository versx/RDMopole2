'use strict';

const express = require('express');
const router = express.Router();

const config = require('../config.json');
const map = require('../data/map.js');

if (config.pages.pokemon.enabled) {
    router.post('/pokemon/overview', async function(req, res) {
        const overviewStats = await map.getPokemonOverviewStats();
        res.json({ data: { stats: overviewStats } });
    });
    router.post('/pokemon/heatmap', async function(req, res) {
        const heatmapStats = await map.getPokemonHeatmapStats(req.query);
        res.json({ data: { stats: heatmapStats } });
    });
    router.post('/pokemon/shiny', async function(req, res) {
        const shinyRates = await map.getShinyRates(req.query);
        res.json({ data: { pokemon: shinyRates } });
    });
    router.post('/pokemon/commday', async function(req, res) {
        const commdayStats = await map.getCommunityDayStats(req.query);
        res.json({ data: { stats: commdayStats } });
    });
}

if (config.pages.raids.enabled) {
    router.post('/raids', async function(req, res) {
        const raids = await map.getRaids(req.query);
        res.json({ data: { raids: raids } });
    });
}

if (config.pages.gyms.enabled) {
    router.post('/gyms', async function(req, res) {
        const gyms = await map.getGyms(req.query);
        res.json({ data: { gyms: gyms } });
    });
}

if (config.pages.quests.enabled) {
    router.post('/quests', async function(req, res) {
        const quests = await map.getQuests(req.query);
        res.json({ data: { quests: quests } });
    });
}

if (config.pages.invasions.enabled) {
    router.post('/invasions', async function(req, res) {
        const invasions = await map.getInvasions(req.query);
        res.json({ data: { invasions: invasions } });
    });
}

if (config.pages.nests.enabled) {
    router.post('/nests', async function(req, res) {
        const nests = await map.getNests(req.query);
        res.json({ data: { nests: nests } });
    });
}

router.post('/stats', async function(req, res) {
    //console.log("Query:", req.query);
    const type = req.query.type;
    let data;
    if (type) {
        switch (type) {
        case 'pokemon':
            data = {
                stats: await map.getPokemonStats(req.query)
            };
            break;
        case 'raids':
            data = {
                stats: await map.getRaidStats(req.query)
            };
            break;
        case 'quests':
            data = {
                stats: await map.getQuestStats(req.query)
            };
            break;
        case 'invasions':
            data = {
                stats: await map.getInvasionStats(req.query)
            };
            break;
        }
    } else {
        const stats = await map.getStats();
        const pokemonStats = await map.getPokemonIVStats();
        const newPokestops = await map.getNewPokestops();
        const newGyms = await map.getNewGyms();
        data = {
            raids: (stats.raids || 0),
            gyms: (stats.gyms || 0),
            pokestops: (stats.pokestops || 0),
            quests: (stats.quests || 0),
            invasions: (stats.invasions || 0),

            pokemon_total: (pokemonStats[0].pokemon_total || 0),
            pokemon_iv_total: (pokemonStats[0].iv_total || 0),
            pokemon_shiny_total: (pokemonStats[0].shiny_total || 0),

            active_pokemon: (pokemonStats[0].active),
            active_shiny: (pokemonStats[0].active_shiny || 0),
            active_100iv: (pokemonStats[0].active_100iv || 0),
            active_90iv: (pokemonStats[0].active_90iv || 0),
            active_0iv: (pokemonStats[0].active_0iv || 0),
            active_iv: (pokemonStats[0].active_iv || 0),

            neutral: (stats.neutral || 0),
            mystic: (stats.mystic || 0),
            valor: (stats.valor || 0),
            instinct: (stats.instinct || 0),
            raids_ex: (stats.raids_ex || 0),
            raids_male: (stats.raids_male || 0),
            raids_female: (stats.raids_female || 0),
            gyms_attack: (stats.gyms_attack || 0),

            lures_normal: (stats.lures_normal || 0),
            lures_glacial: (stats.lures_glacial || 0),
            lures_mossy: (stats.lures_mossy || 0),
            lures_magnetic: (stats.lures_magnetic || 0),

            spawnpoints_total: (stats.spawnpoints_total || 0),
            spawnpoints_found: (stats.spawnpoints_found || 0),
            spawnpoints_missing: (stats.spawnpoints_missing || 0),
            spawnpoints_percentage: Math.round((stats.spawnpoints_found / stats.spawnpoints_total) * 100) + '%',

            new_pokestops: newPokestops,
            new_gyms: newGyms
        };
    }
    
    res.json(data);
});

module.exports = router;