// src/utils/contextBudget.js
// Replaces the old fixed 100000/50000-char truncation constants with a
// budget scaled to whatever context window the caller's model actually has.
//
// No hardcoded per-model-name table here on purpose: model context windows
// change constantly and users can point this action at any model (including
// custom/fine-tuned/self-hosted ones a name-pattern list would never match).
// The action.yml `model_context_tokens` input lets the user state their
// model's real window; DEFAULT_CONTEXT_TOKENS is only the conservative
// fallback when they don't.

const CHARS_PER_TOKEN = 4; // rough heuristic, no tokenizer dependency needed for a budget guard
const OUTPUT_RESERVE_RATIO = 0.35; // headroom for prompt scaffolding + the model's own response
const DEFAULT_CONTEXT_TOKENS = 32000; // safe for effectively any current model unless overridden

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Max diff character count safe to send in one request.
 * @param {number|string} [contextTokens] - the model's context window in
 *   tokens, as configured by the user. Falls back to a conservative default
 *   when absent or not a positive number.
 */
function getDiffCharBudget(contextTokens) {
  const tokens = Number(contextTokens);
  const usableContext = tokens > 0 ? tokens : DEFAULT_CONTEXT_TOKENS;
  const usableTokens = Math.floor(usableContext * (1 - OUTPUT_RESERVE_RATIO));
  return usableTokens * CHARS_PER_TOKEN;
}

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

function findingWeight(fileResult) {
  const issues = (fileResult && fileResult.issues) || [];
  return issues.reduce((max, issue) => {
    const rank = SEVERITY_RANK[(issue.severity || '').toLowerCase()] || 0;
    return Math.max(max, rank);
  }, 0);
}

/**
 * The reduce/merge step is itself one request — this keeps its input within
 * budget even on a massive PR by keeping the highest-severity per-file
 * results first and dropping the rest, instead of silently overflowing.
 * @returns {{ kept: object[], dropped: string[] }} dropped is a list of file paths
 */
function fitFindingsToBudget(perFileResults, charBudget) {
  if (JSON.stringify(perFileResults).length <= charBudget) {
    return { kept: perFileResults, dropped: [] };
  }

  const sorted = [...perFileResults].sort((a, b) => findingWeight(b) - findingWeight(a));
  const kept = [];
  const dropped = [];
  let size = 2; // account for the enclosing [ ]

  for (const result of sorted) {
    const entrySize = JSON.stringify(result).length + 1; // + comma/separator
    if (size + entrySize <= charBudget) {
      kept.push(result);
      size += entrySize;
    } else {
      dropped.push(result.file || 'unknown');
    }
  }

  return { kept, dropped };
}

module.exports = { estimateTokens, getDiffCharBudget, fitFindingsToBudget, DEFAULT_CONTEXT_TOKENS };
