// src/prompts/chatPrompt.js

/**
 * Constructs the chat reply prompt text (provider-agnostic).
 * Returns a plain string to be wrapped by the adapter.
 *
 * Prefers `priorFindings` (the already-posted review sections, reused from
 * comments already fetched for this PR) over re-sending the full `diff` —
 * cheaper on every /buddy follow-up and the model already committed to
 * those findings. `diff` is only used as a fallback when no prior findings
 * exist yet (e.g. /buddy used before the initial review ran).
 *
 * `newChangesDiff` covers the separate case of commits pushed AFTER the
 * findings above were generated — it must always be considered fresh, since
 * priorFindings has no idea it exists.
 */
function constructChatPromptText({
  title, author, comment, commentAuthor, tone, lang,
  conversationHistory, currentVerdict, priorFindings, diff, newChangesDiff
}) {
  const historySection = conversationHistory && conversationHistory.length > 0
    ? `\nPrevious Conversation on this PR (read ALL of this to understand full context):\n${conversationHistory}\n`
    : '';

  const verdictSection = currentVerdict
    ? `\nCurrent Review Buddy Verdict: ${currentVerdict.status}\nCurrent Reasoning:\n${currentVerdict.reasoning}\n`
    : '';

  const hasPriorFindings = priorFindings && Object.keys(priorFindings).length > 0;
  const contextSection = hasPriorFindings
    ? `\nPrevious Review Buddy Findings on this PR (already posted — treat as ground truth, do not re-derive from scratch):\n${Object.entries(priorFindings).map(([section, body]) => `### ${section}\n${body}`).join('\n\n')}\n`
    : `\nPR Diff Context:\n${diff}\n`;

  const newChangesSection = newChangesDiff
    ? `\n⚠️ NEW COMMITS PUSHED SINCE THE FINDINGS ABOVE WERE GENERATED — the findings above do NOT account for this code. Treat it as the most current state of the PR:\n${newChangesDiff}\n`
    : '';

  return `You are Review Buddy, an expert AI code reviewer. You are replying to a comment on a Pull Request.

Context:
 - PR Title: ${title}
 - PR Author: ${author}
 - Comment Author: ${commentAuthor}
 - User Question/Comment: ${comment}
 - Tone: ${tone}
 - Language: ${lang}
${verdictSection}${historySection}${contextSection}${newChangesSection}
Instructions:
1. Read ALL the previous conversation history carefully to understand the full context.
2. Analyze the User's LATEST comment in the context of the PR findings/diff above AND the previous conversation.
3. Answer their question, justify the code, or explain the issue clearly.
4. Use the specified Tone and Language.
   - If Tone is "roast", be savage but helpful.
   - If Language is "hinglish", use Hinglish.
5. Provide code examples if needed.
6. Keep the response concise but informative.
7. **VERDICT RE-EVALUATION**: If the user is explaining WHY they made certain changes, defending their approach, or providing context that addresses previous concerns, OR if new commits were pushed (see above):
   - Re-evaluate whether the current verdict (${currentVerdict ? currentVerdict.status : 'N/A'}) is still appropriate.
   - If the user's explanation is valid and addresses the concerns, OR the new commits fix/introduce issues, you SHOULD update the verdict.
   - Consider the PERSPECTIVE and PURPOSE of the changes when re-evaluating.
   - Be fair: if the user makes a good argument, acknowledge it and update accordingly.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks.

Output JSON with this EXACT structure:
{
  "reply": "<your response text in markdown>",
  "verdict_changed": <true | false>,
  "updated_verdict": {
    "status": "<APPROVE | REQUEST_CHANGES | REJECT>",
    "reasoning": ["<bullet point 1>", "<bullet point 2>", "..."]
  }
}

If the verdict has NOT changed, set verdict_changed to false and set updated_verdict to null.
If the verdict HAS changed based on the conversation, set verdict_changed to true and provide the new verdict.`;
}

module.exports = { constructChatPromptText };
