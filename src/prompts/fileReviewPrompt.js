// src/prompts/fileReviewPrompt.js
// Map phase of the large-PR review: one lean, structured call per changed
// file instead of the single "100+ line essay" prompt — this compactness is
// what makes running it once per file affordable.
const { getToneInstructions } = require('./toneInstructions');

function constructFileReviewPromptText({ file, diffChunk, repoMapForFile, title, author, tone, lang }) {
  const contextBlock = repoMapForFile && Object.keys(repoMapForFile).length > 0
    ? JSON.stringify(repoMapForFile, null, 2)
    : 'None';

  return `You are an expert AI code reviewer analyzing ONE file from a larger pull request (it is being reviewed file-by-file to stay within context limits). Focus only on this file's diff.

Context:
 - PR Title: ${title}
 - Author: ${author}
 - File: ${file}
${getToneInstructions(tone, lang)}

Related local context (exported signatures only from files this one imports, NOT full bodies — use this only to judge whether the change breaks a contract, contradicts existing architecture, or duplicates logic that already exists):
${contextBlock}

Diff for this file:
${diffChunk}

Return ONLY valid JSON, no markdown code fences, no extra text:
{
  "file": "${file}",
  "issues": [
    {
      "category": "<performance | security | quality | best_practices>",
      "severity": "<critical | high | medium | low | info>",
      "comment": "<markdown string in the specified tone/language>"
    }
  ],
  "notable_good": "<short markdown string or null>",
  "quality_contribution": <number 0-10 for THIS file's change>,
  "has_critical_security": <true | false>,
  "has_high_security": <true | false>
}
If a category has no issues for this file, omit it from the array — do not invent problems.`;
}

module.exports = { constructFileReviewPromptText };
