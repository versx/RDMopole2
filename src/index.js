'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const app = express();
const mustacheExpress = require('mustache-express');
const helmet = require('helmet');

const config = require('./config.json');
const defaultData = require('./data/default.js');
const apiRoutes = require('./routes/api.js');
const discordRoutes = require('./routes/discord.js');
const uiRoutes = require('./routes/ui.js');
const utils = require('./services/utils.js');


// TODO: Raid list with pressable rows for more details
// TODO: Mobile friendly (column prioritizing)
// TODO: Custom user settings (per user)
// TODO: Double check discord role check
// TODO: Max pokestop and gym name length
// TODO: Make sql class to connect with different config options
// TODO: Restrict data to specific areas
// TODO: Check csrf token with `/api/`
// TODO: Allow choice between bar/line graph charts
// TODO: Use `mode: 'range'` for flatdatepickr to select a range
// TODO: Load button for stats instead of onchange event
// TODO: If stats not available then show message
// TODO: Add custom tile server selection to heatmap
// TODO: Finish localization
// TODO: Make rest of pages modular, hide/show stats/billboard
// TODO: Device status page with geofences of cities

(async () => {
    // Basic security protections
    app.use(helmet());

    // View engine
    app.set('view engine', 'mustache');
    app.set('views', path.resolve(__dirname, 'views'));
    app.engine('mustache', mustacheExpress());

    // Static paths
    app.use(express.static(path.resolve(__dirname, '../static')));
    
    // Body parser middlewares
    app.use(express.json());
    app.use(express.urlencoded({ extended: false, limit: '50mb' }));

    // Sessions middleware
    app.use(session({
        secret: utils.generateString(),
        resave: true,
        saveUninitialized: true
    }));

    if (config.discord.enabled) {
        app.use('/api/discord', discordRoutes);

        // Discord error middleware
        /* eslint-disable no-unused-vars */
        app.use(function(err, req, res, next) {
        /* eslint-enable no-unused-vars */
            switch (err.message) {
                case 'NoCodeProvided':
                    return res.status(400).send({
                        status: 'ERROR',
                        error: err.message,
                    });
                default:
                    return res.status(500).send({
                        status: 'ERROR',
                        error: err.message,
                    });
            }
        });
    }
    
    // Login middleware
    app.use(function(req, res, next) {
        if (config.discord.enabled && (req.path === '/api/discord/login' || req.path === '/login')) {
            return next();
        }
        if (req.session.user_id && req.session.username && req.session.guilds && req.session.roles) {
            //console.log("Previous discord auth still active for user id:", req.session.user_id);
            return next();
        }
        if (!config.discord.enabled || req.session.logged_in) {
            defaultData.logged_in = true;
            defaultData.username = req.session.username;
            if (!config.discord.enabled) {
                return next();
            }
            if (!req.session.valid) {
                console.error('Invalid user authenticated', req.session.user_id);
                res.redirect('/login');
                return;
            }
            const perms = req.session.perms;
            /*
            defaultData.home_page = config.pages.home.enabled && perms.home !== false;
            if (!defaultData.home_page) {
                // No view map permissions, go to login screen
                console.error('Invalid home page permissions for user', req.session.user_id);
                res.redirect('/login');
                return;
            }
            */
            defaultData.logged_in = true;
            defaultData.username = req.session.username;
            defaultData.home_page = config.pages.home.enabled && perms.home !== false;
            defaultData.pokemon_page = config.pages.pokemon.enabled && perms.pokemon !== false;
            defaultData.raids_page = config.pages.raids.enabled && perms.raids !== false;
            defaultData.gyms_page = config.pages.gyms.enabled && perms.gyms !== false;
            defaultData.quests_page = config.pages.quests.enabled && perms.quests !== false;
            defaultData.invasions_page = config.pages.invasions.enabled && perms.invasions !== false;
            defaultData.nests_page = config.pages.nests.enabled && perms.nests !== false;
            return next();
        }
        res.redirect('/login');
    });

    // API routes
    app.use('/api', apiRoutes);

    // UI routes
    app.use('/', uiRoutes);

    // Start listener
    app.listen(config.port, config.interface, () => console.log(`Listening on port ${config.port}...`));
})();
