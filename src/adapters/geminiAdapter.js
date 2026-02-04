// src/adapters/geminiAdapter.js
const { logInfo, logError } = require('../utils');

const name = "Gemini";
const defaultModel = "gemini-3-flash-preview";

/**
 * Wraps prompt text into Gemini's request body format.
 */
function buildPayload(promptText) {
  return {
    contents: [{ parts: [{ text: promptText }] }]
  };
}

/**
 * Sends a request to the Gemini API.
 * @param {string} apiKey - Gemini API key
 * @param {object} payload - Request body from buildPayload()
 * @param {string} [model] - Model name (used in URL path)
 * @returns {object|null} Parsed JSON response or null on failure
 */
async function sendRequest(apiKey, payload, model) {
  const modelName = model || defaultModel;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  logInfo(`Sending request to Gemini AI (model: ${modelName})...`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
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
    logError(`Gemini API request failed: ${error.message}`);
    return null;
  }
}

/**
 * Extracts generated text from Gemini's response format.
 */
function extractText(response) {
  return response?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

module.exports = { name, defaultModel, buildPayload, sendRequest, extractText };
