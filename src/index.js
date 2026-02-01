
// src/index.js
const fs = require('fs');
const path = require('path');
const {
  logInfo, logSuccess, logWarning, logError, validateEnv,
  determineLabels, determineRecommendation
} = require('./utils');
const {
  callGemini, constructPrompt, constructChatPrompt
} = require('./gemini');
const {
  fetchPRDetails, fetchPRDiff, postComment, updatePR, addLabels
} = require('./github');

function getVersion() {
  try {
    const versionPath = path.join(__dirname, '../VERSION');
    if (fs.existsSync(versionPath)) {
      return fs.readFileSync(versionPath, 'utf8').trim();
    }
  } catch (e) {
    // ignore
  }
  return 'unknown';
}

async function handlePullRequest(env) {
  logInfo("Starting Review Buddy (PR Mode)...");

  const appVersion = getVersion();
  logInfo(`App Version: ${appVersion}`);
  logInfo(`Node.js Version: ${process.version}`);
  logInfo(`Platform: ${process.platform}`);

  const {
    GITHUB_REPOSITORY,
    PR_NUMBER,
    GITHUB_TOKEN,
    GEMINI_API_KEY,
    TONE,
    LANGUAGE
  } = env;

  // Use input PR number or fallback to event payload if needed (though action.yml passes it)
  const prNumber = PR_NUMBER;
  const tone = TONE || 'roast';
  const language = LANGUAGE || 'hinglish';

  logInfo(`Configuration: Tone=${tone}, Language=${language}`);

  // Fetch PR Data
  const prJson = await fetchPRDetails(GITHUB_REPOSITORY, prNumber, GITHUB_TOKEN);
  const currentTitle = prJson.title || "";
  const currentBody = prJson.body || "";
  const prAuthor = prJson.user ? prJson.user.login : "";
  const reviewersList = prJson.requested_reviewers ? prJson.requested_reviewers.map(r => r.login) : [];

  let reviewerMentions = "";
  if (reviewersList.length > 0) {
    reviewerMentions = reviewersList.map(r => `@${r}`).join(" ");
    logInfo(`Reviewers: ${reviewerMentions}`);
  }

  logInfo(`Analyzing PR: ${currentTitle} (Author: ${prAuthor})`);

  // Determine work items
  const minDescLength = 50;
  const needsDescUpdate = currentBody.length < minDescLength;
  if (needsDescUpdate) {
    logWarning(`Description is too short (${currentBody.length} chars). Marking for update.`);
  }

  // Fetch Diff
  const diff = await fetchPRDiff(GITHUB_REPOSITORY, prNumber, GITHUB_TOKEN);
  if (!diff) {
    logInfo("Diff is empty. Nothing to review.");
    process.exit(0);
  }

  const truncatedDiff = diff.substring(0, 100000); // 100k char limit

  // Generate AI Content
  logInfo("Generating analysis...");

  const promptPayload = constructPrompt(truncatedDiff, currentTitle, prAuthor, tone, language, String(needsDescUpdate));
  const response = await callGemini(GEMINI_API_KEY, promptPayload);

  if (!response) {
    logError("Failed to get response from Gemini.");
    process.exit(1);
  }

  // Parse Response
  // Gemini 2.0 structure: candidates[0].content.parts[0].text
  const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!generatedText) {
    logError("Empty response from Gemini.");
    process.exit(1);
  }

  let cleanJsonStr = generatedText;
  // Attempt to extract JSON from markdown
  const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) || generatedText.match(/```\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    cleanJsonStr = jsonMatch[1];
  } else {
    // Fallback: simple brace matching (naive)
    const firstBrace = generatedText.indexOf('{');
    const lastBrace = generatedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJsonStr = generatedText.substring(firstBrace, lastBrace + 1);
    }
  }

  let analysisResults;
  try {
    analysisResults = JSON.parse(cleanJsonStr);
  } catch (e) {
    logError(`Failed to parse JSON response: ${e.message}`);
    logInfo(`Raw text: ${generatedText}`);
    // Last ditch effort: try to see if it's just raw text? No, failing hard is safer than bad parsing.
    process.exit(1);
  }

  const {
    review_comment,
    performance_analysis,
    security_analysis,
    quality_analysis,
    new_title,
    new_description,
    quality_score,
    maintainability_score
  } = analysisResults;

  const score = quality_score || 0;
  const mScore = maintainability_score || 0;

  logSuccess(`Analysis Complete. Quality Score: ${score}/10 | Overall Benchmark: ${mScore}/100`);

  // Execute Actions

  // Step 1: Update PR Metadata
  logInfo("Step 1: Updating PR title and description...");
  let updatePayload = {};

  if (new_title && new_title !== "null" && new_title !== currentTitle) {
    logInfo(`Suggesting new title: ${new_title}`);
    updatePayload.title = new_title;
  }

  if (new_description && new_description !== "null") {
    logInfo("Updating description...");
    updatePayload.body = new_description;
  }

  await updatePR(GITHUB_REPOSITORY, prNumber, updatePayload, GITHUB_TOKEN);

  // Helper to build mentions
  const buildMentions = () => {
    let m = `@${prAuthor}`;
    if (reviewerMentions) m += ` ${reviewerMentions}`;
    return m;
  };
  const commonMentions = buildMentions();
  const footer = `\n---\n*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: ${tone} | Language: ${language}*`;

  // Step 2: General Review
  logInfo("Step 2: Posting general changes review...");
  if (review_comment) {
    const comment = `<!-- Review Buddy Start -->
## 🤖 Review Buddy - General Code Review
> 👥 **Attention:** ${commonMentions}

${review_comment}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 3: Performance
  logInfo("Step 3: Posting performance analysis...");
  if (performance_analysis) {
    const comment = `<!-- Review Buddy Performance -->
## ⚡ Review Buddy - Performance Analysis
> 👥 **Attention:** ${commonMentions}

${performance_analysis}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 4: Security
  logInfo("Step 4: Posting security audit...");
  if (security_analysis) {
    const comment = `<!-- Review Buddy Security -->
## 🔐 Review Buddy - Security Audit
> 👥 **Attention:** ${commonMentions}

${security_analysis}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 5: Quality
  logInfo("Step 5: Posting code quality analysis...");
  if (quality_analysis) {
    let scoreLabel = "Poor";
    if (mScore >= 90) scoreLabel = "Excellent";
    else if (mScore >= 70) scoreLabel = "Good";
    else if (mScore >= 50) scoreLabel = "Needs Improvement";

    const comment = `<!-- Review Buddy Quality -->
## 📊 Review Buddy - Code Quality & Maintainability Analysis
> 👥 **Attention:** ${commonMentions}

### 🎯 Overall Benchmark: **${mScore}/100** (${scoreLabel})

${quality_analysis}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 6: Smart Labels
  logInfo("Step 6: Adding smart labels...");
  const finalTitle = (updatePayload.title) || currentTitle;
  const labelsToAdd = determineLabels(finalTitle, mScore, security_analysis, performance_analysis);

  if (labelsToAdd.length > 0) {
    await addLabels(GITHUB_REPOSITORY, prNumber, labelsToAdd, GITHUB_TOKEN);
  } else {
    logInfo("No labels to add.");
  }

  // Step 7: Final Recommendation
  logInfo("Step 7: Posting final recommendation...");
  const recData = determineRecommendation(mScore, score, security_analysis, performance_analysis, tone, language);

  let recComment = `<!-- Review Buddy Recommendation -->
## ${recData.icon} Review Buddy - Final Recommendation
> 👥 **Attention:** ${commonMentions}

### Recommendation: **${recData.status}**

${recData.message}

### Reasoning:
${recData.reasoning}

---

### 📋 Review Checklist for Reviewers:
- [ ] Code changes align with the PR description
- [ ] No security vulnerabilities introduced
- [ ] Performance considerations addressed
- [ ] Code follows project conventions
- [ ] Tests are adequate (if applicable)
- [ ] Documentation updated (if needed)

### 🎯 Next Steps:
`;

  // Add tone-specific closing
  if (recData.status === "APPROVE") {
    if (tone === "roast" && language === "hinglish") recComment += "✅ **Agar tum satisfied ho, toh approve kar do aur merge kar do!**";
    else if (tone === "funny") recComment += "✅ **If you're happy with it, smash that approve button! 👍**";
    else recComment += "✅ **If all reviewers are satisfied, please approve and merge this PR.**";
  } else if (recData.status === "REQUEST CHANGES") {
    if (tone === "roast" && language === "hinglish") recComment += "⚠️ **Pehle suggestions address karo, phir approve karna.**";
    else if (tone === "funny") recComment += "⚠️ **Fix the issues mentioned above, then we'll give this the thumbs up! 👍**";
    else recComment += "⚠️ **Please address the suggestions above, then request re-review for approval.**";
  } else { // REJECT
    if (tone === "roast" && language === "hinglish") recComment += "🚫 **Critical issues hai - is PR ko reject karo aur major fixes ke baad dobara submit karo.**";
    else if (tone === "funny") recComment += "🚫 **This needs major work - please close this PR and submit a new one after fixes! 🔧**";
    else recComment += "🚫 **This PR should be rejected. Please close and resubmit after addressing critical issues.**";
  }

  recComment += footer;
  await postComment(GITHUB_REPOSITORY, prNumber, recComment, GITHUB_TOKEN);

  logSuccess("All tasks finished successfully!");
}

async function handleIssueComment(env) {
  logInfo("Starting Review Buddy (Comment Reply Mode)...");

  // Validate keys specifically for this flow
  if (!env.GEMINI_API_KEY || !env.GITHUB_TOKEN) {
    logError("GEMINI_API_KEY or GITHUB_TOKEN is missing.");
    process.exit(1);
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!fs.existsSync(eventPath)) {
    logError(`Event payload not found at ${eventPath}`);
    process.exit(1);
  }

  const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const commentBody = eventData.comment?.body || "";
  const commentAuthor = eventData.comment?.user?.login || "";
  const issueNumber = eventData.issue?.number;
  const isPr = !!eventData.issue?.pull_request;

  if (!issueNumber) {
    logWarning("Could not find issue number in payload. Exiting.");
    process.exit(0);
  }

  if (!isPr) {
    logInfo("This comment is not on a Pull Request. Skipping.");
    process.exit(0);
  }

  // Check for /buddy command
  if (!/^\/buddy/i.test(commentBody)) { // Regex check for starting with /buddy (case insensitive) or contains it? Original grep was just recursive check.
    // Original: echo "$comment_body" | grep -qiE "/buddy"
    if (!/\/buddy/i.test(commentBody)) {
      logInfo("No '/Buddy' command found. Skipping.");
      process.exit(0);
    }
  }

  logInfo(`Command '/Buddy' detected in comment by @${commentAuthor}.`);
  logInfo(`Processing Comment for PR #${issueNumber}`);

  const prNumber = issueNumber;
  const {
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
    GEMINI_API_KEY,
    TONE,
    LANGUAGE
  } = env;

  const tone = TONE || 'roast';
  const language = LANGUAGE || 'hinglish';

  // Fetch PR Details
  const prJson = await fetchPRDetails(GITHUB_REPOSITORY, prNumber, GITHUB_TOKEN);
  const currentTitle = prJson.title || "";
  const prAuthor = prJson.user ? prJson.user.login : "";

  // Fetch Diff
  let diff = await fetchPRDiff(GITHUB_REPOSITORY, prNumber, GITHUB_TOKEN);
  if (!diff) {
    logWarning("Diff is empty. Proceeding without diff context.");
    diff = "No diff available.";
  }
  const truncatedDiff = diff.substring(0, 50000);

  // Generate Reply
  logInfo("Generating reply...");
  const promptPayload = constructChatPrompt(truncatedDiff, currentTitle, prAuthor, commentBody, commentAuthor, tone, language);
  const response = await callGemini(GEMINI_API_KEY, promptPayload);

  if (!response) {
    logError("Failed to get response from Gemini.");
    process.exit(1);
  }

  const replyText = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (replyText) {
    const finalReply = `@${commentAuthor} ${replyText}`;
    await postComment(GITHUB_REPOSITORY, prNumber, finalReply, GITHUB_TOKEN);
    logSuccess("Replied to user comment.");
  } else {
    logError("Empty response from Gemini.");
  }
}

async function main() {
  // Map inputs from environment variables (standard GitHub Actions pattern: INPUT_NAME)
  // We already passed them in handlePullRequest from process.env, but let's formalize.

  const env = {
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    PR_NUMBER: process.env.PR_NUMBER,
    TONE: process.env.TONE,
    LANGUAGE: process.env.LANGUAGE
  };

  logInfo(`GitHub Event Name: ${env.GITHUB_EVENT_NAME}`);

  // Meaningful Logs
  const actionVersion = getVersion();
  logInfo(`ReviewBuddy Version: ${actionVersion}`);
  logInfo(`Node.js Version: ${process.version}`);
  logInfo(`Platform: ${process.platform} (${process.arch})`);

  if (env.GITHUB_EVENT_NAME === 'pull_request' || env.GITHUB_EVENT_NAME === 'pull_request_target') {
    validateEnv(); // Checks KEYS
    await handlePullRequest(env);
  } else if (env.GITHUB_EVENT_NAME === 'issue_comment') {
    // Validation happens inside to allow skipping non-PR comments without hard fail on keys if logic dictates
    await handleIssueComment(env);
  } else {
    logWarning(`Unsupported event: ${env.GITHUB_EVENT_NAME}`);
    process.exit(0);
  }
}

main().catch(err => {
  logError(`Unhandled error: ${err.message}`);
  logError(err.stack);
  process.exit(1);
});
