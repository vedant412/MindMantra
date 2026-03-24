const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add modern extension support. DO NOT add cjs to assetExts!
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
