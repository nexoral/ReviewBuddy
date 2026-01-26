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

determine_recommendation() {
    local maintainability_score="$1"
    local quality_score="$2"
    local security_analysis="$3"
    local performance_analysis="$4"
    local tone="$5"
    local language="$6"

    local recommendation_status=""
    local recommendation_icon=""
    local recommendation_message=""
    local reasoning=""

    # Check for critical security issues
    local has_critical_security=0
    if [[ "$security_analysis" == *"Critical"* ]]; then
        has_critical_security=1
    fi

    # Check for high severity security issues
    local has_high_security=0
    if [[ "$security_analysis" == *"High"* ]]; then
        has_high_security=1
    fi

    # Determine recommendation based on scores and issues
    if [[ $has_critical_security -eq 1 ]]; then
        recommendation_status="REJECT"
        recommendation_icon="🚫"
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            recommendation_message="**Arre bhai bhai bhai!** Ye PR toh reject karna padega. Critical security issues hai!"
            reasoning="- **Critical Security Issues** detected kiye gaye hain jo production mein bahut dangerous ho sakte hain.\n- Pehle in security vulnerabilities ko fix karo, phir hi merge karna."
        elif [[ "$tone" == "professional" ]]; then
            recommendation_message="This PR should be **REJECTED** due to critical security vulnerabilities."
            reasoning="- **Critical security issues** have been identified that could pose serious risks in production.\n- These must be addressed before this PR can be merged."
        elif [[ "$tone" == "funny" ]]; then
            recommendation_message="🛑 **STOP RIGHT THERE!** This PR has critical security holes big enough to drive a truck through! 🚛"
            reasoning="- Critical security issues found - we don't want hackers having a field day! 🏴‍☠️\n- Fix these vulnerabilities first, then we'll talk merge! 🔒"
        else
            recommendation_message="This PR should be **REJECTED** due to critical security issues."
            reasoning="- Critical security vulnerabilities detected.\n- Please address these issues before proceeding."
        fi
    elif [[ "$maintainability_score" -lt 40 ]]; then
        recommendation_status="REJECT"
        recommendation_icon="🚫"
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            recommendation_message="**Bhai, yaar!** Is code ki quality bahut kharab hai. Reject kar do!"
            reasoning="- Overall Benchmark Score bahut low hai: **$maintainability_score/100**\n- Code quality, maintainability, aur best practices mein bahut improvement chahiye.\n- Isko refactor karke dobara submit karo."
        elif [[ "$tone" == "professional" ]]; then
            recommendation_message="This PR should be **REJECTED** due to poor code quality."
            reasoning="- Overall Benchmark Score is critically low: **$maintainability_score/100**\n- Significant improvements needed in code quality and maintainability.\n- Please refactor and resubmit."
        elif [[ "$tone" == "funny" ]]; then
            recommendation_message="😬 **Ouch!** This code needs some serious TLC (Tender Loving Code)!"
            reasoning="- Quality score is in the danger zone: **$maintainability_score/100** 📉\n- Time for a major makeover before this can see the light of production! 💅\n- Refactor and come back stronger! 💪"
        else
            recommendation_message="This PR should be **REJECTED** due to low quality score."
            reasoning="- Overall quality score: **$maintainability_score/100**\n- Significant refactoring required."
        fi
    elif [[ $has_high_security -eq 1 || "$maintainability_score" -lt 60 ]]; then
        recommendation_status="REQUEST CHANGES"
        recommendation_icon="⚠️"
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            recommendation_message="**Changes chahiye, bhai!** Abhi approve nahi kar sakte."
            reasoning="- Kuch security concerns ya quality issues hain jo fix karne padenge.\n- Suggestions ko address karo, improvements karo.\n- Sab fix hone ke baad hi approve hoga."
        elif [[ "$tone" == "professional" ]]; then
            recommendation_message="**REQUEST CHANGES** - This PR needs improvements before approval."
            reasoning="- Some security concerns or quality issues need to be addressed.\n- Please review the feedback and make necessary improvements.\n- Once changes are made, this can be approved."
        elif [[ "$tone" == "funny" ]]; then
            recommendation_message="🔧 **Almost there, but not quite!** Time for some tweaks!"
            reasoning="- Found some issues that need fixing before we can give this the green light! 🚦\n- Check out the suggestions and polish this gem! 💎\n- You're on the right track, just needs a bit more love! ❤️"
        else
            recommendation_message="**REQUEST CHANGES** - Improvements needed before approval."
            reasoning="- Some issues need to be addressed.\n- Please review feedback and make improvements."
        fi
    else
        recommendation_status="APPROVE"
        recommendation_icon="✅"
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            recommendation_message="**Shabash beta!** Ye PR approve karne layak hai."
            reasoning="- Code quality achhi hai: **$maintainability_score/100**\n- Koi critical issues nahi hain.\n- Agar sab reviewers satisfied hain, toh approve kar do aur merge karo!"
        elif [[ "$tone" == "professional" ]]; then
            recommendation_message="**APPROVE** - This PR meets quality standards and is ready for merge."
            reasoning="- Code quality is good: **$maintainability_score/100**\n- No critical issues found.\n- If all reviewers are satisfied, this can be approved and merged."
        elif [[ "$tone" == "funny" ]]; then
            recommendation_message="🎉 **LGTM! (Looks Good To Merge!)** Ship it! 🚀"
            reasoning="- Quality score looking fresh: **$maintainability_score/100** 🌟\n- No deal-breakers found! 👍\n- Give it the green stamp of approval and let's get this to prod! 🎊"
        else
            recommendation_message="**APPROVE** - This PR is ready for merge."
            reasoning="- Quality score: **$maintainability_score/100**\n- No critical issues found.\n- Ready for approval."
        fi
    fi

    # Return JSON-like formatted string
    echo "$recommendation_status|$recommendation_icon|$recommendation_message|$reasoning"
}
