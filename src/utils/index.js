
// src/utils/index.js

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
 * Validates required environment variables based on the selected adapter.
 * @param {string} [adapterName] - The adapter name ("gemini", "openrouter", "github-models")
 * @returns {object} The validated environment variables.
 */
function validateEnv(adapterName) {
  const missing = [];
  const name = (adapterName || 'gemini').toLowerCase();

  // API key validation is adapter-specific
  if (name === 'openrouter') {
    if (!process.env.ADAPTIVE_API_TOKEN) {
      missing.push('ADAPTIVE_API_TOKEN');
    }
  } else if (name === 'github-models' || name === 'github_models') {
    if (!process.env.ADAPTIVE_API_TOKEN && !process.env.GITHUB_TOKEN) {
      missing.push('ADAPTIVE_API_TOKEN (or GITHUB_TOKEN)');
    }
  } else {
    if (!process.env.GEMINI_API_KEY && !process.env.INPUT_GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  }

  // GITHUB_TOKEN is always needed for PR operations
  if (!process.env.GITHUB_TOKEN && !process.env.INPUT_GITHUB_TOKEN) missing.push('GITHUB_TOKEN');

  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

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
 * Uses Gemini's structured verdict when available, falls back to heuristics.
 */
function determineRecommendation(maintainabilityScore, qualityScore, securityAnalysis, performanceAnalysis, tone, language, verdict) {
  const score = parseInt(maintainabilityScore, 10) || 0;

  // Use Gemini's structured verdict if available
  let status;
  let aiReasoning;
  if (verdict && verdict.status) {
    // Normalize Gemini's status to our display format
    const verdictStatus = verdict.status.toUpperCase().replace('_', ' ');
    if (verdictStatus === "REJECT") status = "REJECT";
    else if (verdictStatus === "REQUEST CHANGES" || verdictStatus === "REQUEST_CHANGES") status = "REQUEST CHANGES";
    else status = "APPROVE";

    aiReasoning = Array.isArray(verdict.reasoning)
      ? verdict.reasoning.map(r => `- ${r}`).join('\n')
      : null;
  } else {
    // Fallback: heuristic-based (legacy behavior, improved)
    // Only flag critical/high if they appear as actual severity labels in structured context
    const hasCriticalSecurity = securityAnalysis &&
      /\*\*?Severity\*?\*?:\s*Critical/i.test(securityAnalysis);
    const hasHighSecurity = securityAnalysis &&
      /\*\*?Severity\*?\*?:\s*High/i.test(securityAnalysis);

    if (hasCriticalSecurity || score < 40) {
      status = "REJECT";
    } else if (hasHighSecurity || score < 60) {
      status = "REQUEST CHANGES";
    } else {
      status = "APPROVE";
    }
  }

  let icon = "✅";
  let message = "";
  let reasoning = "";

  if (status === "REJECT") {
    icon = "🚫";
    if (tone === "roast" && language === "hinglish") {
      message = "**Arre bhai bhai bhai!** Ye PR toh reject karna padega!";
    } else if (tone === "professional") {
      message = "This PR should be **REJECTED**.";
    } else if (tone === "funny") {
      message = "🛑 **STOP RIGHT THERE!** This PR needs major work!";
    } else {
      message = "This PR should be **REJECTED**.";
    }

    reasoning = aiReasoning || `- Overall Benchmark Score: **${score}/100**\n- Significant issues need to be resolved before this can be merged.`;
  } else if (status === "REQUEST CHANGES") {
    icon = "⚠️";
    if (tone === "roast" && language === "hinglish") {
      message = "**Changes chahiye, bhai!** Abhi approve nahi kar sakte.";
    } else if (tone === "professional") {
      message = "**REQUEST CHANGES** - This PR needs improvements before approval.";
    } else if (tone === "funny") {
      message = "🔧 **Almost there, but not quite!** Time for some tweaks!";
    } else {
      message = "**REQUEST CHANGES** - Improvements needed before approval.";
    }

    reasoning = aiReasoning || `- Some issues need to be addressed.\n- Please review feedback and make improvements.`;
  } else {
    // APPROVE
    icon = "✅";
    if (tone === "roast" && language === "hinglish") {
      message = "**Shabash beta!** Ye PR approve karne layak hai.";
    } else if (tone === "professional") {
      message = "**APPROVE** - This PR meets quality standards and is ready for merge.";
    } else if (tone === "funny") {
      message = "🎉 **LGTM! (Looks Good To Merge!)** Ship it! 🚀";
    } else {
      message = "**APPROVE** - This PR is ready for merge.";
    }

    reasoning = aiReasoning || `- Quality score: **${score}/100**\n- No critical issues found.\n- Ready for approval.`;
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
