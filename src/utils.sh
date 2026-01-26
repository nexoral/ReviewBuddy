#!/bin/bash

# Utility functions for logging and validation

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

check_dependencies() {
    local missing=0
    for cmd in curl jq; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd is required but not installed."
            missing=1
        fi
    done
    
    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
}

validate_env() {
    if [[ -z "$GEMINI_API_KEY" ]]; then
        log_error "GEMINI_API_KEY is missing."
        exit 1
    fi

    if [[ -z "$GITHUB_TOKEN" ]]; then
        log_error "GITHUB_TOKEN is missing."
        exit 1
    fi

    if [[ -z "$PR_NUMBER" || "$PR_NUMBER" == "null" ]]; then
        log_error "PR_NUMBER is missing. Ensure this action runs on a pull_request event or provide PR_NUMBER as input."
        exit 1
    fi
}

determine_labels() {
    local title="$1"
    local maintainability_score="$2"
    local security_analysis="$3"
    local performance_analysis="$4"
    local labels=()

    # Extract change type from Conventional Commit title
    if [[ "$title" =~ ^(feat|feature)(\(.*\))?:.*$ ]]; then
        labels+=("enhancement")
    elif [[ "$title" =~ ^(fix|bugfix)(\(.*\))?:.*$ ]]; then
        labels+=("bug")
    elif [[ "$title" =~ ^(docs?)(\(.*\))?:.*$ ]]; then
        labels+=("documentation")
    elif [[ "$title" =~ ^(refactor|perf|performance)(\(.*\))?:.*$ ]]; then
        labels+=("enhancement")
    elif [[ "$title" =~ ^(test|tests)(\(.*\))?:.*$ ]]; then
        labels+=("testing")
    elif [[ "$title" =~ ^(chore|ci|build)(\(.*\))?:.*$ ]]; then
        labels+=("maintenance")
    fi

    # Add quality-based labels
    if [[ "$maintainability_score" -ge 90 ]]; then
        labels+=("good first review")
    elif [[ "$maintainability_score" -lt 50 ]]; then
        labels+=("needs work")
    fi

    # Check for security concerns
    if [[ "$security_analysis" == *"Critical"* ]] || [[ "$security_analysis" == *"High"* ]]; then
        labels+=("security")
    fi

    # Check for performance concerns
    if [[ "$performance_analysis" == *"performance issue"* ]] || [[ "$performance_analysis" == *"optimize"* ]] || [[ "$performance_analysis" == *"slow"* ]]; then
        labels+=("performance")
    fi

    echo "${labels[@]}"
}
