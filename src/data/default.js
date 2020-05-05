'use strict';

const config = require('../config.json');
const data = require('../../static/locales/' + config.locale + '.json');
data.title = config.title;
data.locale = config.locale;
data.style = config.style == 'dark' ? 'dark' : '';
data.last_nest_migration = config.lastNestMigration;
//data.logging = config.logging.enabled;
data.home_page = config.pages.home.enabled;
data.raids_page = config.pages.raids.enabled;
data.gyms_page = config.pages.gyms.enabled;
data.quests_page = config.pages.quests.enabled;
data.invasions_page = config.pages.invasions.enabled;
data.nests_page = config.pages.nests.enabled;
data.analytics = config.google.analytics;
data.adsense = config.google.adsense;

module.exports = data;