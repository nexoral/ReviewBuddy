// src/adapters/index.js
const geminiAdapter = require('./geminiAdapter');
const openrouterAdapter = require('./openrouterAdapter');
const githubModelsAdapter = require('./githubModelsAdapter');
const { logError } = require('../utils');

const adapters = {
  gemini: geminiAdapter,
  openrouter: openrouterAdapter,
  'github-models': githubModelsAdapter,
  'github_models': githubModelsAdapter // Alias for convenience
};

/**
 * Returns the appropriate adapter based on the adapter name.
 * Exits with error if the adapter name is not recognized.
 * @param {string} adapterName - "gemini" or "openrouter"
 * @returns {object} The adapter module
 */
function getAdapter(adapterName) {
  const key = (adapterName || 'gemini').toLowerCase().trim();
  const adapter = adapters[key];

  if (!adapter) {
    logError(`Unknown adapter: "${adapterName}". Supported adapters: ${Object.keys(adapters).join(', ')}`);
    process.exit(1);
  }

  return adapter;
}

module.exports = { getAdapter, adapters };
