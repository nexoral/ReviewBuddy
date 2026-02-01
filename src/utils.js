
// src/utils.js

// ANSI Colors for logging
const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

const logInfo = (msg) => console.log(`${COLORS.BLUE}[INFO]${COLORS.RESET} ${msg}`);
const logSuccess = (msg) => console.log(`${COLORS.GREEN}[SUCCESS]${COLORS.RESET} ${msg}`);
const logWarning = (msg) => console.warn(`${COLORS.YELLOW}[WARN]${COLORS.RESET} ${msg}`);
const logError = (msg) => console.error(`${COLORS.RED}[ERROR]${COLORS.RESET} ${msg}`);

/**
 * Validates required environment variables.
 * @returns {object} The validated environment variables.
 */
function validateEnv() {
  const missing = [];
  if (!process.env.GEMINI_API_KEY && !process.env.INPUT_GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (!process.env.GITHUB_TOKEN && !process.env.INPUT_GITHUB_TOKEN) missing.push('GITHUB_TOKEN');

  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // PR_NUMBER might be missing if it's not a PR event (handled in main logic usually, but good to check if needed)
  // We will validate PR_NUMBER specifically where it is needed.

  return process.env;
}

/**
 * Determines labels based on analysis results.
 */
function determineLabels(title, maintainabilityScore, securityAnalysis, performanceAnalysis) {
  const labels = [];
  const lowerTitle = title.toLowerCase();

  // Conventional Commits
  if (/^(feat|feature)(\(.*\))?:/.test(lowerTitle)) labels.push("enhancement");
  else if (/^(fix|bugfix)(\(.*\))?:/.test(lowerTitle)) labels.push("bug");
  else if (/^(docs|doc)(\(.*\))?:/.test(lowerTitle)) labels.push("documentation");
  else if (/^(refactor|perf|performance)(\(.*\))?:/.test(lowerTitle)) labels.push("enhancement");
  else if (/^(test|tests)(\(.*\))?:/.test(lowerTitle)) labels.push("testing");
  else if (/^(chore|ci|build)(\(.*\))?:/.test(lowerTitle)) labels.push("maintenance");

  // Quality-based labels
  const score = parseInt(maintainabilityScore, 10) || 0;
  if (score >= 90) labels.push("good first review");
  else if (score < 50) labels.push("needs work");

  // Security
  if (securityAnalysis && (securityAnalysis.includes("Critical") || securityAnalysis.includes("High"))) {
    labels.push("security");
  }

  // Performance
  if (performanceAnalysis && (
    performanceAnalysis.toLowerCase().includes("performance issue") ||
    performanceAnalysis.toLowerCase().includes("optimize") ||
    performanceAnalysis.toLowerCase().includes("slow")
  )) {
    labels.push("performance");
  }

  return labels;
}

/**
 * Determines the final recommendation status and message.
 */
function determineRecommendation(maintainabilityScore, qualityScore, securityAnalysis, performanceAnalysis, tone, language) {
  const score = parseInt(maintainabilityScore, 10) || 0;
  const hasCriticalSecurity = securityAnalysis && securityAnalysis.includes("Critical");
  const hasHighSecurity = securityAnalysis && securityAnalysis.includes("High");

  let status = "APPROVE";
  let icon = "✅";
  let message = "";
  let reasoning = "";

  if (hasCriticalSecurity) {
    status = "REJECT";
    icon = "🚫";
    if (tone === "roast" && language === "hinglish") {
      message = "**Arre bhai bhai bhai!** Ye PR toh reject karna padega. Critical security issues hai!";
      reasoning = "- **Critical Security Issues** detected kiye gaye hain jo production mein bahut dangerous ho sakte hain.\n- Pehle in security vulnerabilities ko fix karo, phir hi merge karna.";
    } else if (tone === "professional") {
      message = "This PR should be **REJECTED** due to critical security vulnerabilities.";
      reasoning = "- **Critical security issues** have been identified that could pose serious risks in production.\n- These must be addressed before this PR can be merged.";
    } else if (tone === "funny") {
      message = "🛑 **STOP RIGHT THERE!** This PR has critical security holes big enough to drive a truck through! 🚛";
      reasoning = "- Critical security issues found - we don't want hackers having a field day! 🏴‍☠️\n- Fix these vulnerabilities first, then we'll talk merge! 🔒";
    } else {
      message = "This PR should be **REJECTED** due to critical security issues.";
      reasoning = "- Critical security vulnerabilities detected.\n- Please address these issues before proceeding.";
    }
  } else if (score < 40) {
    status = "REJECT";
    icon = "🚫";
    if (tone === "roast" && language === "hinglish") {
      message = "**Bhai, yaar!** Is code ki quality bahut kharab hai. Reject kar do!";
      reasoning = `- Overall Benchmark Score bahut low hai: **${score}/100**\n- Code quality, maintainability, aur best practices mein bahut improvement chahiye.\n- Isko refactor karke dobara submit karo.`;
    } else if (tone === "professional") {
      message = "This PR should be **REJECTED** due to poor code quality.";
      reasoning = `- Overall Benchmark Score is critically low: **${score}/100**\n- Significant improvements needed in code quality and maintainability.\n- Please refactor and resubmit.`;
    } else if (tone === "funny") {
      message = "😬 **Ouch!** This code needs some serious TLC (Tender Loving Code)!";
      reasoning = `- Quality score is in the danger zone: **${score}/100** 📉\n- Time for a major makeover before this can see the light of production! 💅\n- Refactor and come back stronger! 💪`;
    } else {
      message = "This PR should be **REJECTED** due to low quality score.";
      reasoning = `- Overall quality score: **${score}/100**\n- Significant refactoring required.`;
    }
  } else if (hasHighSecurity || score < 60) {
    status = "REQUEST CHANGES";
    icon = "⚠️";
    if (tone === "roast" && language === "hinglish") {
      message = "**Changes chahiye, bhai!** Abhi approve nahi kar sakte.";
      reasoning = "- Kuch security concerns ya quality issues hain jo fix karne padenge.\n- Suggestions ko address karo, improvements karo.\n- Sab fix hone ke baad hi approve hoga.";
    } else if (tone === "professional") {
      message = "**REQUEST CHANGES** - This PR needs improvements before approval.";
      reasoning = "- Some security concerns or quality issues need to be addressed.\n- Please review the feedback and make necessary improvements.\n- Once changes are made, this can be approved.";
    } else if (tone === "funny") {
      message = "🔧 **Almost there, but not quite!** Time for some tweaks!";
      reasoning = "- Found some issues that need fixing before we can give this the green light! 🚦\n- Check out the suggestions and polish this gem! 💎\n- You're on the right track, just needs a bit more love! ❤️";
    } else {
      message = "**REQUEST CHANGES** - Improvements needed before approval.";
      reasoning = "- Some issues need to be addressed.\n- Please review feedback and make improvements.";
    }
  } else {
    // Approve
    status = "APPROVE";
    icon = "✅";
    if (tone === "roast" && language === "hinglish") {
      message = "**Shabash beta!** Ye PR approve karne layak hai.";
      reasoning = `- Code quality achhi hai: **${score}/100**\n- Koi critical issues nahi hain.\n- Agar sab reviewers satisfied hain, toh approve kar do aur merge karo!`;
    } else if (tone === "professional") {
      message = "**APPROVE** - This PR meets quality standards and is ready for merge.";
      reasoning = `- Code quality is good: **${score}/100**\n- No critical issues found.\n- If all reviewers are satisfied, this can be approved and merged.`;
    } else if (tone === "funny") {
      message = "🎉 **LGTM! (Looks Good To Merge!)** Ship it! 🚀";
      reasoning = `- Quality score looking fresh: **${score}/100** 🌟\n- No deal-breakers found! 👍\n- Give it the green stamp of approval and let's get this to prod! 🎊`;
    } else {
      message = "**APPROVE** - This PR is ready for merge.";
      reasoning = `- Quality score: **${score}/100**\n- No critical issues found.\n- Ready for approval.`;
    }
  }

  return { status, icon, message, reasoning };
}

module.exports = {
  logInfo,
  logSuccess,
  logWarning,
  logError,
  validateEnv,
  determineLabels,
  determineRecommendation
};
