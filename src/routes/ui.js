'use strict';

const express = require('express');
const router = express.Router();
const i18n = require('i18n');

const config = require('../config.json');
const defaultData = require('../data/default.js');
const map = require('../data/map.js');
const GeofenceService = require('../services/geofence.js');
const locale = require('../services/locale.js');
const pokedex = require('../../static/data/pokedex.json');

const svc = new GeofenceService.GeofenceService();


router.get(['/', '/index'], async function(req, res) {
    var data = defaultData;
    var newPokestops = await map.getNewPokestops();
    var newGyms = await map.getNewGyms();
    var topGymDefenders = await map.getGymDefenders(10);
    var top10_100IVStats = await map.getTopPokemonIVStats(100, 10);
    var lifetime = await map.getTopPokemonStats(true, 10);
    var today = await map.getTopPokemonStats(false, 10);

    var defenders = topGymDefenders.map(x => {
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
    data.new_pokestops = newPokestops;
    data.new_gyms = newGyms;
    res.render('index', data);
});

if (config.discord.enabled) {
    router.get('/login', function(req, res) {
        res.redirect('/api/discord/login');
    });

    router.get('/logout', function(req, res) {
        req.session.destroy(function(err) {
            if (err) throw err;
            res.redirect('/login');
        });
    });
}

if (config.pages.pokemon.enabled) {
    router.get('/pokemon', function(req, res) {
        var data = defaultData;
        data.pokemon = map.getPokemonNameIdsList();
        res.render('pokemon', data);
    });
}

if (config.pages.raids.enabled) {
    router.get('/raids', function(req, res) {
        var data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        data.pokemon = map.getPokemonNameIdsList();
        res.render('raids', data);
    });
}

if (config.pages.gyms.enabled) {
    router.get('/gyms', function(req, res) {
        var data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        res.render('gyms', data);
    });
}

if (config.pages.quests.enabled) {
    router.get('/quests', function(req, res) {
        var data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        res.render('quests', data);
    });
}

if (config.pages.invasions.enabled) {
    router.get('/invasions', function(req, res) {
        var data = defaultData;
        var gruntTypes = [];
        for (var i = 0; i <= 50; i++) {
            var grunt = i18n.__('grunt_' + i);
            gruntTypes.push({ 'name': grunt });
        }
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        data.grunt_types = gruntTypes;
        res.render('invasions', data);
    });
}

if (config.pages.nests.enabled) {
    router.get('/nests', function(req, res) {
        var data = defaultData;
        data.cities = svc.geofences.map(x => { return { 'name': x.name }; });
        res.render('nests', data);
    });
}

module.exports = router;