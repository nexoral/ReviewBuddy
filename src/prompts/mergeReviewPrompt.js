// src/prompts/mergeReviewPrompt.js
// Reduce phase of the large-PR review: synthesize the per-file structured
// findings into the exact same top-level schema constructReviewPromptText
// produces, so nothing downstream in index.js has to change.
const { getToneInstructions } = require('./toneInstructions');

function constructMergeReviewPromptText({ perFileResults, title, author, tone, lang, needsDesc, skippedFiles }) {
  const skippedNote = skippedFiles && skippedFiles.length > 0
    ? `Files intentionally not reviewed (lockfiles/generated/binary): ${skippedFiles.join(', ')}`
    : 'No files were skipped.';

  return `You are an expert AI code reviewer. Each changed file in this pull request was already analyzed individually; the structured findings are below. SYNTHESIZE them into one final review — do not re-analyze the code and do not invent issues that aren't in the findings, just organize, prioritize, and present them faithfully in the required tone and format.

Context:
 - PR Title: ${title}
 - Author: ${author}
 - Needs Description Update: ${needsDesc}
 - ${skippedNote}
${getToneInstructions(tone, lang)}

Per-file findings (JSON array, one entry per reviewed file):
${JSON.stringify(perFileResults, null, 2)}

⚠️ CRITICAL INSTRUCTIONS:
1. YOU MUST RETURN ONLY VALID JSON - no markdown code blocks, no extra text.
2. ALL string fields must be strings, not arrays or objects.
3. Group findings by category across files: performance_analysis groups all "performance" issues, security_analysis groups all "security" issues, quality_analysis groups all "quality" issues, best_practices groups all "best_practices" issues. Cite the file path for each finding.
4. review_comment is a general summary addressed to @${author}, highlighting the most important points across all files.
5. quality_score (1-10) and maintainability_score (0-100) should reflect the average/weighted view across all per-file quality_contribution values and the severity of issues found.
6. Check if the PR title follows Conventional Commits; if it's already good, new_title must be null.
7. If needsDesc is "true", write a comprehensive Markdown PR description (Summary, Changes, Verification); if "false", new_description must be null.
8. verdict.status is "APPROVE", "REQUEST_CHANGES", or "REJECT" based on the aggregated severity of all findings (any has_critical_security: true in the input means REJECT unless clearly a false positive). reasoning is an array of bullet point strings. has_critical_security/has_high_security are true only if any per-file entry set them true. change_type is "feature", "bugfix", "refactor", "config", "docs", "test", or "ci".

Output JSON with this EXACT structure:
{
  "review_comment": "<markdown string>",
  "performance_analysis": "<markdown string>",
  "security_analysis": "<markdown string>",
  "quality_analysis": "<markdown string>",
  "best_practices": "<markdown string with before/after code examples>",
  "new_title": "<string or null>",
  "new_description": "<markdown string or null>",
  "quality_score": <number 1-10>,
  "maintainability_score": <number 0-100>,
  "verdict": {
    "status": "<APPROVE | REQUEST_CHANGES | REJECT>",
    "reasoning": ["<bullet point 1>", "<bullet point 2>", "..."],
    "has_critical_security": <true | false>,
    "has_high_security": <true | false>,
    "change_type": "<feature | bugfix | refactor | config | docs | test | ci | mixed>"
  }
}`;
}

module.exports = { constructMergeReviewPromptText };
