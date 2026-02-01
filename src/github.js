
// src/github.js
const { logInfo, logError, logSuccess, logWarning } = require('./utils');

async function fetchPRDetails(repo, prNum, token) {
  const url = `https://api.github.com/repos/${repo}/pulls/${prNum}`;
  logInfo(`Fetching PR details from: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewBuddy-Action'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logError(`Failed to fetch PR details: ${error.message}`);
    process.exit(1);
  }
}

async function fetchPRDiff(repo, prNum, token) {
  const url = `https://api.github.com/repos/${repo}/pulls/${prNum}`;
  logInfo('Fetching PR diff...');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3.diff',
        'User-Agent': 'ReviewBuddy-Action'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return ""; // No diff or empty
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    logError(`Failed to fetch PR diff: ${error.message}`);
    // Return empty string instead of exit to allow handling
    return "";
  }
}

async function postComment(repo, prNum, body, token) {
  if (!body) return;

  logInfo(`Posting comment to PR #${prNum}...`);
  const url = `https://api.github.com/repos/${repo}/issues/${prNum}/comments`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewBuddy-Action'
      },
      body: JSON.stringify({ body })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    logSuccess("Comment posted successfully");
  } catch (error) {
    logError(`Failed to post comment: ${error.message}`);
  }
}

async function updatePR(repo, prNum, payload, token) {
  if (!payload || Object.keys(payload).length === 0) return;

  logInfo("Updating PR metadata...");
  const url = `https://api.github.com/repos/${repo}/pulls/${prNum}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewBuddy-Action'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    logSuccess("PR updated successfully");
  } catch (error) {
    logError(`Failed to update PR: ${error.message}`);
  }
}

async function addLabels(repo, prNum, labels, token) {
  if (!labels || labels.length === 0) return;

  logInfo(`Adding labels to PR #${prNum}: ${labels.join(', ')}`);
  const url = `https://api.github.com/repos/${repo}/issues/${prNum}/labels`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ReviewBuddy-Action'
      },
      body: JSON.stringify({ labels })
    });

    if (!response.ok) {
      logWarning(`Failed to add labels (status ${response.status}). Labels may not exist in the repo.`);
      return;
    }

    logSuccess("Labels added successfully");
  } catch (error) {
    logWarning(`Failed to add labels: ${error.message}`);
  }
}

module.exports = {
  fetchPRDetails,
  fetchPRDiff,
  postComment,
  updatePR,
  addLabels
};
