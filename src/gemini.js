
// src/gemini.js
const { logInfo, logError } = require('./utils');

async function callGemini(apiKey, payload) {
  const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
  logInfo("Sending request to Gemini AI...");

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

function constructPrompt(diff, title, author, tone, lang, needsDesc) {
  return {
    contents: [{
      parts: [{
        text: `You are an expert AI code reviewer. Analyze the git diff below and provide FOUR comprehensive analyses.

Context:
 - PR Title: ${title}
 - Author: ${author}
 - Tone: ${tone}
 - Language: ${lang}
 - Needs Description Update: ${needsDesc}

IMPORTANT: ALL responses (general, performance, security, quality) MUST use the same Tone (${tone}) and Language (${lang}) as specified.

Tone Guidelines:
 - If Tone is "roast" or "funny", be brutally honest and funny in ALL sections. ROAST THE CODE.
 - If Tone is "professional", be concise and polite in ALL sections.
 - If Language is "hinglish", use a mix of Hindi and English in ALL sections.
   - For "roast" in Hinglish: Be savage. Use Bollywood dialogues like "Ek din tu mar jayega, kutte ki maut", "Ye kya bawasir bana diya?", "Tumse na ho payega".
 - If Tone is "friendly", use emojis and be encouraging in ALL sections.

Tasks:

1. **General Review Comment**: Write a constructive review comment addressed to @${author}.
   - Analyze for bugs, general improvements, and style issues.
   - Use the specified Tone and Language.
   - Provide a Code Quality Score (1-10).

2. **Performance Analysis** (100+ lines): Conduct a DEEP performance analysis.
   - Use the same Tone and Language as above.
   - Review: Algorithm complexity, Memory usage, Database queries, Caching, Async patterns, Loop optimizations, N+1 problems, Connection pooling, CPU operations, Concurrency.
   - Provide DETAILED, ACTIONABLE recommendations with code examples.
   - Make this comprehensive and over 100 lines.

3. **Security Audit**: Conduct a COMPREHENSIVE security audit.
   - Use the same Tone and Language as above.
   - Analyze for: SQL Injection, XSS, CSRF, Auth/Authorization, Input validation, Secrets exposure, Session management, API security, Path traversal, Command injection, Rate limiting, CORS.
   - For each issue: Severity (Critical/High/Medium/Low), Location, Exploit scenario, Remediation steps, OWASP/CWE references.
   - Be thorough and educational.

4. **Code Quality Analysis** (100+ lines): Provide an EXTENSIVE quality review.
   - Use the same Tone and Language as above.
   - Analyze: SOLID principles, Design patterns, DRY, Function complexity, Naming conventions, Code clarity, Error handling, Testing, Documentation, Code smells, Technical debt.
   - For each issue: Category, Severity, Location, Explanation, Refactoring suggestions with examples.
   - Be EXTREMELY detailed (100+ lines).

5. **PR Metadata**:
   - Check if the current title follows Conventional Commits. If GOOD, return null. ONLY suggest a new title if it is vague or violates conventions.
   - Generate a comprehensive PR description (Markdown) with Summary, Changes, and Verification.

6. **Overall Benchmark Score (0-100)**: Calculate a comprehensive maintainability score.
   - Weigh all factors: Code Quality (30%), Security (25%), Performance (25%), Maintainability (20%).
   - Scoring: 90-100 Excellent, 70-89 Good, 50-69 Needs Improvement, 0-49 Poor.
   - Be strict but fair in scoring.

7. **Verdict**: Determine the final recommendation for this PR.
   - Consider the PERSPECTIVE and PURPOSE of the changes. For example:
     - Config/documentation/CI changes should be judged leniently on security/performance.
     - A PR that adds tests should not be penalized for not having production logic.
     - A refactoring PR should be judged on whether it improves the codebase, not on new features.
     - A feature PR adding auth/payments/data handling needs strict security review.
   - Evaluate the ACTUAL impact and risk of the changes, not just theoretical concerns.
   - Your verdict must be one of: "APPROVE", "REQUEST_CHANGES", or "REJECT".
   - Provide clear reasoning as an array of bullet point strings.
   - Set has_critical_security to true ONLY if there are real, exploitable critical security vulnerabilities (not theoretical or minor ones).
   - Set has_high_security to true ONLY if there are real high-severity security issues.
   - The change_type should describe the nature of the PR (e.g., "feature", "bugfix", "refactor", "config", "docs", "test", "ci").

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks (no \`\`\`json\`\`\`) or extra text.

Output JSON with this EXACT structure:
{
  "review_comment": "<markdown string>",
  "performance_analysis": "<markdown string - 100+ lines>",
  "security_analysis": "<markdown string - comprehensive>",
  "quality_analysis": "<markdown string - 100+ lines>",
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
}

Diff to analyze:
${diff}`
      }]
    }]
  };
}

function constructChatPrompt(diff, title, author, comment, commentAuthor, tone, lang, conversationHistory, currentVerdict) {
  const historySection = conversationHistory && conversationHistory.length > 0
    ? `\nPrevious Conversation on this PR (read ALL of this to understand full context):\n${conversationHistory}\n`
    : '';

  const verdictSection = currentVerdict
    ? `\nCurrent Review Buddy Verdict: ${currentVerdict.status}\nCurrent Reasoning:\n${currentVerdict.reasoning}\n`
    : '';

  return {
    contents: [{
      parts: [{
        text: `You are Review Buddy, an expert AI code reviewer. You are replying to a comment on a Pull Request.

Context:
 - PR Title: ${title}
 - PR Author: ${author}
 - Comment Author: ${commentAuthor}
 - User Question/Comment: ${comment}
 - Tone: ${tone}
 - Language: ${lang}
${verdictSection}${historySection}
Instructions:
1. Read ALL the previous conversation history carefully to understand the full context.
2. Analyze the User's LATEST comment in the context of the PR Diff AND the previous conversation.
3. Answer their question, justify the code, or explain the issue clearly.
4. Use the specified Tone and Language.
   - If Tone is "roast", be savage but helpful.
   - If Language is "hinglish", use Hinglish.
5. Provide code examples if needed.
6. Keep the response concise but informative.
7. **VERDICT RE-EVALUATION**: If the user is explaining WHY they made certain changes, defending their approach, or providing context that addresses previous concerns:
   - Re-evaluate whether the current verdict (${currentVerdict ? currentVerdict.status : 'N/A'}) is still appropriate.
   - If the user's explanation is valid and addresses the concerns, you SHOULD update the verdict.
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
If the verdict HAS changed based on the conversation, set verdict_changed to true and provide the new verdict.

Diff Context:
${diff}`
      }]
    }]
  };
}


module.exports = {
  callGemini,
  constructPrompt,
  constructChatPrompt
};
