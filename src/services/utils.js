'use strict';

const config = require('../config.json');

function generateString() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function hasGuild(guilds) {
    if (config.discord.guilds.length === 0) {
        return true;
    }
    for (var i = 0; i < guilds.length; i++) {
        var guild = guilds[i];
        if (config.discord.guilds.includes(guild)) {
            return true;
        }
    }
    return false;
}

function hasRole(userRoles, requiredRoles) {
    if (requiredRoles.length === 0) {
        return true;
    }
    for (var i = 0; i < userRoles.length; i++) {
        var role = userRoles[i];
        if (requiredRoles.includes(role)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    generateString,
    hasGuild,
    hasRole
};