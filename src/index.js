
// src/index.js
const fs = require('fs');
const path = require('path');
const {
  logInfo, logSuccess, logWarning, logError, validateEnv,
  determineLabels, determineRecommendation
} = require('./utils');
const { getAdapter } = require('./adapters');
const { constructReviewPromptText } = require('./prompts/reviewPrompt');
const { constructChatPromptText } = require('./prompts/chatPrompt');
const {
  fetchPRDetails, fetchPRDiff, postComment, updatePR, addLabels,
  fetchPRComments, updateComment
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

/**
 * Resolves the correct API key based on the selected adapter.
 */
function resolveApiKey(adapterName, env) {
  const name = (adapterName || 'gemini').toLowerCase();
  if (name === 'openrouter') {
    if (!env.OPENROUTER_API_KEY) {
      logError("OPENROUTER_API_KEY is required when adapter is 'openrouter'.");
      process.exit(1);
    }
    return env.OPENROUTER_API_KEY;
  }
  // Default: gemini
  if (!env.GEMINI_API_KEY) {
    logError("GEMINI_API_KEY is required when adapter is 'gemini'.");
    process.exit(1);
  }
  return env.GEMINI_API_KEY;
}

/**
 * Extracts clean JSON string from AI response text.
 * Handles markdown code blocks and raw JSON.
 */
function extractJson(text) {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
  if (jsonMatch) return jsonMatch[1];

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1);
  }

  return text;
}

async function handlePullRequest(env, adapter, apiKey, model) {
  logInfo("Starting Review Buddy (PR Mode)...");

  const appVersion = getVersion();
  logInfo(`App Version: ${appVersion}`);
  logInfo(`Node.js Version: ${process.version}`);
  logInfo(`Platform: ${process.platform}`);

  const {
    GITHUB_REPOSITORY,
    PR_NUMBER,
    GITHUB_TOKEN,
    TONE,
    LANGUAGE
  } = env;

  const prNumber = PR_NUMBER;
  const tone = TONE || 'roast';
  const language = LANGUAGE || 'hinglish';

  logInfo(`Configuration: Tone=${tone}, Language=${language}, Adapter=${adapter.name}, Model=${model}`);

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

  const promptText = constructReviewPromptText(truncatedDiff, currentTitle, prAuthor, tone, language, String(needsDescUpdate));
  const payload = adapter.buildPayload(promptText, model);
  const response = await adapter.sendRequest(apiKey, payload, model);

  if (!response) {
    logError(`Failed to get response from ${adapter.name}.`);
    process.exit(1);
  }

  const generatedText = adapter.extractText(response);
  if (!generatedText) {
    logError(`Empty response from ${adapter.name}.`);
    process.exit(1);
  }

  logInfo(`✅ AI Response Length: ${generatedText.length} characters`);
  logInfo(`📄 Response Preview: ${generatedText.substring(0, 200)}...`);

  // Parse Response
  const cleanJsonStr = extractJson(generatedText);

  let analysisResults;
  try {
    analysisResults = JSON.parse(cleanJsonStr);
  } catch (e) {
    logError(`Failed to parse JSON response: ${e.message}`);
    logInfo(`Raw text (first 500 chars): ${generatedText.substring(0, 500)}`);
    process.exit(1);
  }

  // Debug: Log the parsed structure
  logInfo(`🔍 Parsed Keys: ${Object.keys(analysisResults).join(', ')}`);
  logInfo(`🔍 Field Types: review=${typeof analysisResults.review_comment}, perf=${typeof analysisResults.performance_analysis}, sec=${typeof analysisResults.security_analysis}, qual=${typeof analysisResults.quality_analysis}`);
  logInfo(`📝 Title Type/Value: ${typeof analysisResults.new_title} = ${analysisResults.new_title === null ? 'null' : analysisResults.new_title === undefined ? 'undefined' : `"${analysisResults.new_title}"`}`);
  logInfo(`📝 Description Type: ${typeof analysisResults.new_description} = ${analysisResults.new_description === null ? 'null' : analysisResults.new_description === undefined ? 'undefined' : `${String(analysisResults.new_description).substring(0, 100)}...`}`);

  const {
    review_comment,
    performance_analysis,
    security_analysis,
    quality_analysis,
    new_title,
    new_description,
    quality_score,
    maintainability_score,
    verdict
  } = analysisResults;

  // Validate and clean array-to-string issues (for broken models)
  const cleanField = (field, fieldName) => {
    if (!field) return field;
    if (typeof field === 'string') return field;
    if (Array.isArray(field)) {
      logWarning(`${fieldName} is an array (broken model output), converting to string`);
      return field.map(item => {
        if (typeof item === 'object') {
          return JSON.stringify(item, null, 2);
        }
        return String(item);
      }).join('\n\n');
    }
    if (typeof field === 'object') {
      logWarning(`${fieldName} is an object (broken model output), converting to JSON string`);
      return JSON.stringify(field, null, 2);
    }
    return String(field);
  };

  const cleanedReview = cleanField(review_comment, 'review_comment');
  const cleanedPerformance = cleanField(performance_analysis, 'performance_analysis');
  const cleanedSecurity = cleanField(security_analysis, 'security_analysis');
  const cleanedQuality = cleanField(quality_analysis, 'quality_analysis');

  const score = quality_score || 0;
  const mScore = maintainability_score || 0;

  // Debug: Log title/description status BEFORE cleaning
  logInfo(`RAW Title from AI: ${new_title === null ? 'null' : new_title === undefined ? 'undefined' : `"${new_title}"`}`);
  logInfo(`RAW Description from AI: ${new_description === null ? 'null' : new_description === undefined ? 'undefined' : `${String(new_description).length} chars`}`);
  logInfo(`Current PR Title: "${currentTitle}"`);
  logInfo(`Needs Desc Update flag: ${needsDescUpdate}`);

  logSuccess(`Analysis Complete. Quality Score: ${score}/10 | Overall Benchmark: ${mScore}/100`);

  // Execute Actions

  // Step 1: Update PR Metadata
  logInfo("Step 1: Updating PR title and description...");
  let updatePayload = {};

  if (new_title && new_title !== "null" && new_title.toLowerCase() !== "null" && new_title !== currentTitle) {
    logInfo(`Suggesting new title: ${new_title}`);
    updatePayload.title = new_title;
  } else {
    if (!new_title || new_title === "null" || new_title.toLowerCase() === "null") {
      logInfo("No title update needed (AI returned null)");
    } else if (new_title === currentTitle) {
      logInfo("Title already matches suggestion, skipping update");
    }
  }

  if (new_description && new_description !== "null" && new_description.toLowerCase() !== "null") {
    logInfo("Updating description...");
    updatePayload.body = new_description;
  } else {
    logInfo("No description update needed (AI returned null or empty)");
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
  if (cleanedReview) {
    const comment = `<!-- Review Buddy Start -->
## 🤖 Review Buddy - General Code Review
> 👥 **Attention:** ${commonMentions}

${cleanedReview}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 3: Performance
  logInfo("Step 3: Posting performance analysis...");
  if (cleanedPerformance) {
    const comment = `<!-- Review Buddy Performance -->
## ⚡ Review Buddy - Performance Analysis
> 👥 **Attention:** ${commonMentions}

${cleanedPerformance}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 4: Security
  logInfo("Step 4: Posting security audit...");
  if (cleanedSecurity) {
    const comment = `<!-- Review Buddy Security -->
## 🔐 Review Buddy - Security Audit
> 👥 **Attention:** ${commonMentions}

${cleanedSecurity}
${footer}`;
    await postComment(GITHUB_REPOSITORY, prNumber, comment, GITHUB_TOKEN);
  }

  // Step 5: Quality
  logInfo("Step 5: Posting code quality analysis...");
  if (cleanedQuality) {
    let scoreLabel = "Poor";
    if (mScore >= 90) scoreLabel = "Excellent";
    else if (mScore >= 70) scoreLabel = "Good";
    else if (mScore >= 50) scoreLabel = "Needs Improvement";

    const comment = `<!-- Review Buddy Quality -->
## 📊 Review Buddy - Code Quality & Maintainability Analysis
> 👥 **Attention:** ${commonMentions}

### 🎯 Overall Benchmark: **${mScore}/100** (${scoreLabel})

${cleanedQuality}
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
  const recData = determineRecommendation(mScore, score, cleanedSecurity, cleanedPerformance, tone, language, verdict);

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

async function handleIssueComment(env, adapter, apiKey, model) {
  logInfo("Starting Review Buddy (Comment Reply Mode)...");

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
  if (!/\/buddy/i.test(commentBody)) {
    logInfo("No '/Buddy' command found. Skipping.");
    process.exit(0);
  }

  logInfo(`Command '/Buddy' detected in comment by @${commentAuthor}.`);
  logInfo(`Processing Comment for PR #${issueNumber}`);

  const prNumber = issueNumber;
  const {
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
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

  // Fetch all PR comments for conversation context
  logInfo("Fetching conversation history...");
  const allComments = await fetchPRComments(GITHUB_REPOSITORY, prNumber, GITHUB_TOKEN);

  // Build conversation history string and find the recommendation comment
  let conversationHistory = "";
  let recommendationCommentId = null;
  let currentVerdict = null;

  for (const c of allComments) {
    const body = c.body || "";
    const author = c.user?.login || "unknown";

    // Track the recommendation comment for potential update
    if (body.includes("<!-- Review Buddy Recommendation -->")) {
      recommendationCommentId = c.id;

      // Extract current verdict status from the comment
      const statusMatch = body.match(/### Recommendation: \*\*(.+?)\*\*/);
      const reasoningMatch = body.match(/### Reasoning:\n([\s\S]*?)(?=\n---|\n###)/);
      if (statusMatch) {
        currentVerdict = {
          status: statusMatch[1],
          reasoning: reasoningMatch ? reasoningMatch[1].trim() : ""
        };
      }
    }

    // Build conversation history (truncate individual comments to keep context manageable)
    const truncatedBody = body.length > 2000 ? body.substring(0, 2000) + "..." : body;
    conversationHistory += `---\n**@${author}:**\n${truncatedBody}\n\n`;
  }

  // Truncate total conversation history to avoid exceeding token limits
  if (conversationHistory.length > 30000) {
    conversationHistory = conversationHistory.substring(conversationHistory.length - 30000);
  }

  logInfo(`Found ${allComments.length} comments. Recommendation comment ${recommendationCommentId ? 'found' : 'not found'}.`);
  if (currentVerdict) {
    logInfo(`Current verdict: ${currentVerdict.status}`);
  }

  // Generate Reply with full context
  logInfo("Generating context-aware reply...");
  const promptText = constructChatPromptText(
    truncatedDiff, currentTitle, prAuthor, commentBody, commentAuthor,
    tone, language, conversationHistory, currentVerdict
  );
  const payload = adapter.buildPayload(promptText, model);
  const response = await adapter.sendRequest(apiKey, payload, model);

  if (!response) {
    logError(`Failed to get response from ${adapter.name}.`);
    process.exit(1);
  }

  const generatedText = adapter.extractText(response);
  if (!generatedText) {
    logError(`Empty response from ${adapter.name}.`);
    process.exit(1);
  }

  // Parse the JSON response
  let parsedResponse;
  try {
    const cleanJson = extractJson(generatedText);
    parsedResponse = JSON.parse(cleanJson);
  } catch (e) {
    // Fallback: treat the entire response as plain text reply (backwards compatible)
    logWarning(`Could not parse structured response, using as plain text: ${e.message}`);
    parsedResponse = { reply: generatedText, verdict_changed: false, updated_verdict: null };
  }

  const replyText = parsedResponse.reply || generatedText;
  const verdictChanged = parsedResponse.verdict_changed === true;
  const updatedVerdict = parsedResponse.updated_verdict;

  // Post the reply
  const footer = `\n---\n*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: ${tone} | Language: ${language}*`;
  const finalReply = `@${commentAuthor} ${replyText}${footer}`;
  await postComment(GITHUB_REPOSITORY, prNumber, finalReply, GITHUB_TOKEN);
  logSuccess("Replied to user comment.");

  // If verdict changed and we have the recommendation comment, update it
  if (verdictChanged && updatedVerdict && recommendationCommentId) {
    logInfo(`Verdict changed to: ${updatedVerdict.status}. Updating recommendation comment...`);

    const newStatus = updatedVerdict.status.toUpperCase().replace('_', ' ');
    let newIcon = "✅";
    if (newStatus === "REJECT") newIcon = "🚫";
    else if (newStatus === "REQUEST CHANGES" || newStatus === "REQUEST_CHANGES") newIcon = "⚠️";

    const newReasoning = Array.isArray(updatedVerdict.reasoning)
      ? updatedVerdict.reasoning.map(r => `- ${r}`).join('\n')
      : updatedVerdict.reasoning || "";

    const commonMentions = `@${prAuthor}`;

    let updatedRecComment = `<!-- Review Buddy Recommendation -->
## ${newIcon} Review Buddy - Final Recommendation (Updated)
> 👥 **Attention:** ${commonMentions}

> **Note:** This verdict was updated after discussion in the PR comments.

### Recommendation: **${newStatus}**

${getToneMessage(newStatus, tone, language)}

### Reasoning:
${newReasoning}

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

    if (newStatus === "APPROVE") {
      if (tone === "roast" && language === "hinglish") updatedRecComment += "✅ **Agar tum satisfied ho, toh approve kar do aur merge kar do!**";
      else if (tone === "funny") updatedRecComment += "✅ **If you're happy with it, smash that approve button! 👍**";
      else updatedRecComment += "✅ **If all reviewers are satisfied, please approve and merge this PR.**";
    } else if (newStatus === "REQUEST CHANGES") {
      if (tone === "roast" && language === "hinglish") updatedRecComment += "⚠️ **Pehle suggestions address karo, phir approve karna.**";
      else if (tone === "funny") updatedRecComment += "⚠️ **Fix the issues mentioned above, then we'll give this the thumbs up! 👍**";
      else updatedRecComment += "⚠️ **Please address the suggestions above, then request re-review for approval.**";
    } else {
      if (tone === "roast" && language === "hinglish") updatedRecComment += "🚫 **Critical issues hai - is PR ko reject karo aur major fixes ke baad dobara submit karo.**";
      else if (tone === "funny") updatedRecComment += "🚫 **This needs major work - please close this PR and submit a new one after fixes! 🔧**";
      else updatedRecComment += "🚫 **This PR should be rejected. Please close and resubmit after addressing critical issues.**";
    }

    updatedRecComment += footer;
    await updateComment(GITHUB_REPOSITORY, recommendationCommentId, updatedRecComment, GITHUB_TOKEN);
    logSuccess("Recommendation comment updated with new verdict.");
  } else if (verdictChanged && updatedVerdict && !recommendationCommentId) {
    logWarning("Verdict changed but could not find the original recommendation comment to update.");
  }
}

/**
 * Returns a tone-appropriate opening message for a given verdict status.
 */
function getToneMessage(status, tone, language) {
  if (status === "REJECT") {
    if (tone === "roast" && language === "hinglish") return "**Arre bhai bhai bhai!** Ye PR toh reject karna padega!";
    if (tone === "professional") return "This PR should be **REJECTED**.";
    if (tone === "funny") return "🛑 **STOP RIGHT THERE!** This PR needs major work!";
    return "This PR should be **REJECTED**.";
  }
  if (status === "REQUEST CHANGES") {
    if (tone === "roast" && language === "hinglish") return "**Changes chahiye, bhai!** Abhi approve nahi kar sakte.";
    if (tone === "professional") return "**REQUEST CHANGES** - This PR needs improvements before approval.";
    if (tone === "funny") return "🔧 **Almost there, but not quite!** Time for some tweaks!";
    return "**REQUEST CHANGES** - Improvements needed before approval.";
  }
  // APPROVE
  if (tone === "roast" && language === "hinglish") return "**Shabash beta!** Ye PR approve karne layak hai.";
  if (tone === "professional") return "**APPROVE** - This PR meets quality standards and is ready for merge.";
  if (tone === "funny") return "🎉 **LGTM! (Looks Good To Merge!)** Ship it! 🚀";
  return "**APPROVE** - This PR is ready for merge.";
}

async function main() {
  const env = {
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ADAPTER: process.env.ADAPTER,
    MODEL: process.env.MODEL,
    PR_NUMBER: process.env.PR_NUMBER,
    TONE: process.env.TONE,
    LANGUAGE: process.env.LANGUAGE
  };

  logInfo(`GitHub Event Name: ${env.GITHUB_EVENT_NAME}`);

  const actionVersion = getVersion();
  logInfo(`ReviewBuddy Version: ${actionVersion}`);
  logInfo(`Node.js Version: ${process.version}`);
  logInfo(`Platform: ${process.platform} (${process.arch})`);

  // Resolve adapter, API key, and model
  const adapterName = env.ADAPTER || 'gemini';
  const adapter = getAdapter(adapterName);
  const model = env.MODEL || adapter.defaultModel;

  logInfo(`AI Provider: ${adapter.name} | Model: ${model}`);

  // Validate model is set (OpenRouter requires explicit model)
  if (!model) {
    logError(`Model is required for the '${adapterName}' adapter. Please set the 'model' input.`);
    process.exit(1);
  }

  if (env.GITHUB_EVENT_NAME === 'pull_request' || env.GITHUB_EVENT_NAME === 'pull_request_target') {
    validateEnv(adapterName);
    const apiKey = resolveApiKey(adapterName, env);
    await handlePullRequest(env, adapter, apiKey, model);
  } else if (env.GITHUB_EVENT_NAME === 'issue_comment') {
    // Resolve API key here; if missing, exit early with clear error
    const apiKey = resolveApiKey(adapterName, env);
    await handleIssueComment(env, adapter, apiKey, model);
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
