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

function toHHMMSS(secs) {
    var sec_num = parseInt(secs / 1000, 10);
    var minutes = Math.floor(sec_num / 60) % 60;
    //var seconds = sec_num % 60;
    //return `${minutes}m ${seconds}s`;
    return `${minutes}m`;
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

module.exports = {
    generateString,
    hasGuild,
    hasRole,
    inArray,
    toHHMMSS,
    formatDate
};