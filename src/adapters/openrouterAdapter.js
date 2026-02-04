// src/adapters/openrouterAdapter.js
const { logInfo, logError } = require('../utils');

const name = "OpenRouter";
const defaultModel = null; // User must provide a model for OpenRouter
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Wraps prompt text into OpenRouter's OpenAI-compatible request body format.
 */
function buildPayload(promptText, model) {
  return {
    model: model || defaultModel,
    messages: [{ role: "user", content: promptText }]
  };
}

/**
 * Sends a request to the OpenRouter API.
 * @param {string} apiKey - OpenRouter API key
 * @param {object} payload - Request body from buildPayload()
 * @returns {object|null} Parsed JSON response or null on failure
 */
async function sendRequest(apiKey, payload) {
  logInfo(`Sending request to OpenRouter (model: ${payload.model})...`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    logError(`OpenRouter API request failed: ${error.message}`);
    return null;
  }
}

/**
 * Extracts generated text from OpenRouter's OpenAI-compatible response format.
 */
function extractText(response) {
  return response?.choices?.[0]?.message?.content || null;
}

module.exports = { name, defaultModel, buildPayload, sendRequest, extractText };
