require('dotenv').config();

module.exports = {
    port: process.env.PORT || 5000,
    historyLength: parseInt(process.env.HISTORY_LENGTH, 10) || 3600,
    updateInterval: parseInt(process.env.UPDATE_INTERVAL, 10) || 1000,
};
