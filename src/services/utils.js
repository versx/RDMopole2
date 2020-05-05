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

function inArray(haystack, needle) {
    var array = haystack.split(',');
    if (Array.isArray(array)) {
        for (var i = 0; i < array.length; i++) {
            var item = array[i].trim().toLowerCase();
            if (needle.trim().toLowerCase().indexOf(item) > -1) {
                return true;
            }
        }
        return false;
    }
    return needle.trim().indexOf(haystack.trim()) > -1;
  }

module.exports = {
    generateString,
    hasGuild,
    hasRole,
    inArray
};