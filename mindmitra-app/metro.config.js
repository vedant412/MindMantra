const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add modern extension support. DO NOT add cjs to assetExts!
config.resolver.sourceExts.push('mjs', 'cjs');
// expo-sqlite's browser worker imports its WebAssembly binary as an asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
