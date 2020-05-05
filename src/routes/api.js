'use strict';


const express = require('express');
const router = express.Router();

const config = require('../config.json');
const map = require('../data/map.js');

if (config.pages.raids.enabled) {
    router.get('/raids*', async function(req, res) {
        var raids = await map.getRaids(req.query);
        res.json({ data: { raids: raids } });
    });
}

if (config.pages.gyms.enabled) {
    router.get('/gyms', async function(req, res) {
        var gyms = await map.getGyms(req.query);
        res.json({ data: { gyms: gyms } });
    });
}

if (config.pages.quests.enabled) {
    router.get('/quests', async function(req, res) {
        var quests = await map.getQuests(req.query);
        res.json({ data: { quests: quests } });
    });
}

if (config.pages.invasions.enabled) {
    router.get('/invasions', async function(req, res) {
        var invasions = await map.getInvasions(req.query);
        res.json({ data: { invasions: invasions } });
    });
}

if (config.pages.nests.enabled) {
    router.get('/nests', async function(req, res) {
        var nests = await map.getNests(req.query);
        res.json({ data: { nests: nests } });
    });
}

module.exports = router;