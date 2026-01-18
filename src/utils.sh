#!/bin/bash

# Utility functions for logging and validation

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
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
