'use strict';

const express = require('express');
const router = express.Router();
const i18n = require('i18n');

const config = require('../config.json');
const defaultData = require('../data/default.js');
const map = require('../data/map.js');
const GeofenceService = require('../services/geofence.js');
const locale = require('../services/locale.js');
const utils = require('../services/utils.js');
const pokedex = require('../../static/data/pokedex.json');

const svc = new GeofenceService.GeofenceService();


router.get(['/', '/index'], async (req, res) => {
    const data = defaultData;
    const newPokestops = await map.getNewPokestops();
    const newGyms = await map.getNewGyms();
    const topGymDefenders = await map.getGymDefenders(10);
    const gymsUnderAttack = await map.getGymsUnderAttack(15);
    gymsUnderAttack.forEach(x => {
        x.team = locale.getTeamName(x.team_id).toLowerCase();
        x.slots_available = x.availble_slots === 0 ? 'Full' : x.availble_slots + '/6';
        x.raid_battle_timestamp = utils.toHHMMSS(x.raid_battle_timestamp * 1000);
    });
    const top10_100IVStats = await map.getTopPokemonIVStats(100, 10);
    const lifetime = await map.getTopPokemonStats(true, 10);
    const today = await map.getTopPokemonStats(false, 10);

    const defenders = topGymDefenders.map(x => {
        return {
            id: x.guarding_pokemon_id,
            name: pokedex[x.guarding_pokemon_id],
            count: (x.count || 0).toLocaleString(),
            image_url: locale.getPokemonIcon(x.guarding_pokemon_id, 0)
        };
    });
    data.top10_100iv_pokemon = top10_100IVStats.map(x => {
        return {
            pokemon_id: x.pokemon_id,
            name: pokedex[x.pokemon_id],
            iv: x.iv,
            count: (x.count || 0).toLocaleString(),
            image_url: locale.getPokemonIcon(x.pokemon_id)
        };
    });
    data.lifetime = lifetime.map(x => {
        return {
            pokemon_id: x.pokemon_id,
            name: pokedex[x.pokemon_id],
            shiny: (x.shiny || 0).toLocaleString(),
            count: (x.count || 0).toLocaleString(),
            image_url: locale.getPokemonIcon(x.pokemon_id)
        };
    });
    data.today = today.map(x => {
        return {
            pokemon_id: x.pokemon_id,
            name: pokedex[x.pokemon_id],
            shiny: (x.shiny || 0).toLocaleString(),
            count: (x.count || 0).toLocaleString(),
            image_url: locale.getPokemonIcon(x.pokemon_id)
        };
    });
    data.gym_defenders = defenders;
    data.gyms_under_attack = gymsUnderAttack;
    data.new_pokestops = newPokestops;
    data.new_gyms = newGyms;
    data.custom_overview = config.pages.home.custom.overview;
    data.custom_spawnpoints = config.pages.home.custom.spawnpoints;
    data.custom_pokemon = config.pages.home.custom.pokemon.enabled;
    data.custom_active_iv = config.pages.home.custom.pokemon.active;
    data.custom_lifetime_iv = config.pages.home.custom.pokemon.lifetime;

    data.custom_pokemon_top10 = config.pages.home.custom.pokemon.top10.enabled;
    data.custom_pokemon_top10_lifetime = config.pages.home.custom.pokemon.top10.lifetime;
    data.custom_pokemon_top10_today = config.pages.home.custom.pokemon.top10.today;
    data.custom_pokemon_top10_iv = config.pages.home.custom.pokemon.top10.iv;

    data.custom_gyms = config.pages.home.custom.gyms.enabled;
    data.custom_gyms_new = config.pages.home.custom.gyms.newGyms;
    data.custom_gyms_teams = config.pages.home.custom.gyms.teams;
    data.custom_gyms_defenders = config.pages.home.custom.gyms.defenders;
    data.custom_gyms_under_attack = config.pages.home.custom.gyms.underAttack;
    data.custom_gyms_overview = config.pages.home.custom.gyms.overview;

    data.custom_pokestops = config.pages.home.custom.pokestops.enabled;
    data.custom_pokestops_overview = config.pages.home.custom.pokestops.overview;
    data.custom_pokestops_new = config.pages.home.custom.pokestops.newPokestops;

    if (!config.discord.enabled || req.session.logged_in) {
        data.logged_in = true;
        data.username = req.session.username;
        if (config.discord.enabled) {
            if (req.session.valid) {
                const perms = req.session.perms;
                data.home_page = config.pages.home.enabled && perms.home !== false;
                data.pokemon_page = config.pages.pokemon.enabled && perms.pokemon !== false;
                data.raids_page = config.pages.raids.enabled && perms.raids !== false;
                data.gyms_page = config.pages.gyms.enabled && perms.gyms !== false;
                data.quests_page = config.pages.quests.enabled && perms.quests !== false;
                data.invasions_page = config.pages.invasions.enabled && perms.invasions !== false;
                data.nests_page = config.pages.nests.enabled && perms.nests !== false;
            } else {
                console.log(req.session.username, 'Not authorized to access map');
                res.redirect('/login');
            }
        }
    }

    res.render('index', data);
});

if (config.discord.enabled) {
    router.get('/login', (req, res) => {
        res.redirect('/api/discord/login');
    });

    router.get('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) throw err;
            res.redirect('/login');
        });
    });
}

if (config.pages.pokemon.enabled) {
    router.get('/pokemon', (req, res) => {
        const data = defaultData;
        data.pokemon = map.getPokemonNameIdsList();
        data.tileserver = config.map.tileserver;
        data.start_lat = config.map.startLat;
        data.start_lon = config.map.startLon;
        data.start_zoom = config.map.startZoom;
        data.min_zoom = config.map.minZoom;
        data.max_zoom = config.map.maxZoom;
        res.render('pokemon', data);
    });
}

if (config.pages.raids.enabled) {
    router.get('/raids', (req, res) => {
        const data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        data.pokemon = map.getPokemonNameIdsList();
        res.render('raids', data);
    });
}

if (config.pages.gyms.enabled) {
    router.get('/gyms', (req, res) => {
        const data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        res.render('gyms', data);
    });
}

if (config.pages.quests.enabled) {
    router.get('/quests', async (req, res) => {
        const data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        data.rewards = await map.getQuestRewardsList();
        res.render('quests', data);
    });
}

if (config.pages.invasions.enabled) {
    router.get('/invasions', (req, res) => {
        const data = defaultData;
        const gruntTypes = [];
        for (let i = 0; i <= 50; i++) {
            const grunt = i18n.__('grunt_' + i);
            gruntTypes.push({ 'id': i, 'name': grunt });
        }
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        data.grunt_types = gruntTypes;
        res.render('invasions', data);
    });
}

if (config.pages.nests.enabled) {
    router.get('/nests', (req, res) => {
        const data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        res.render('nests', data);
    });
}

if (config.pages.spawnpoints.enabled) {
    router.get('/spawnpoints', (req, res) => {
        const data = defaultData;
        data.tileserver = config.map.tileserver;
        data.start_lat = config.map.startLat;
        data.start_lon = config.map.startLon;
        data.start_zoom = config.map.startZoom;
        data.min_zoom = config.map.minZoom;
        data.max_zoom = config.map.maxZoom;
        res.render('spawnpoints', data);
    });
}

module.exports = router;