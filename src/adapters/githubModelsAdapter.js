// src/adapters/githubModelsAdapter.js
const { logInfo, logError } = require('../utils');

const name = "GitHub Models";
const defaultModel = "openai/gpt-4o"; // Best balance of quality and speed
const API_URL = "https://models.github.ai/inference/chat/completions";

/**
 * Wraps prompt text into GitHub Models' OpenAI-compatible request body format.
 */
function buildPayload(promptText, model) {
  return {
    model: model || defaultModel,
    messages: [{ role: "user", content: promptText }]
  };
}

/**
 * Sends a request to the GitHub Models API.
 * @param {string} apiKey - GitHub Token
 * @param {object} payload - Request body from buildPayload()
 * @returns {object|null} Parsed JSON response or null on failure
 */
async function sendRequest(apiKey, payload) {
  logInfo(`Sending request to GitHub Models (model: ${payload.model})...`);

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
    logError(`GitHub Models API request failed: ${error.message}`);
    return null;
  }
}

/**
 * Extracts generated text from GitHub Models' OpenAI-compatible response format.
 */
function extractText(response) {
  return response?.choices?.[0]?.message?.content || null;
}

module.exports = { name, defaultModel, buildPayload, sendRequest, extractText };
