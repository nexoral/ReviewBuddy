#!/bin/bash

# Main Application Logic
# TODO: Add more features like 

# Resolve script directory to source correctly
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/github.sh"
source "$SCRIPT_DIR/gemini.sh"

main() {
    # 1. Initialization
    log_info "Starting Review Buddy..."
    check_dependencies
    validate_env

    local tone="${TONE:-roast}"
    local language="${LANGUAGE:-hinglish}"
    local min_desc_length=50

    log_info "Configuration: Tone=$tone, Language=$language"

    # 2. Fetch PR Data
    local pr_json
    pr_json=$(get_pr_details "$GITHUB_REPOSITORY" "$PR_NUMBER")
    
    local current_title
    current_title=$(echo "$pr_json" | jq -r '.title // ""')

    local current_body
    current_body=$(echo "$pr_json" | jq -r '.body // ""')
    if [[ "$current_body" == "null" ]]; then current_body=""; fi

    local pr_author
    pr_author=$(echo "$pr_json" | jq -r '.user.login // ""')

    # Extract reviewers (requested_reviewers)
    local reviewers_list
    reviewers_list=$(echo "$pr_json" | jq -r '.requested_reviewers[]?.login // empty' | tr '\n' ' ')
    
    # Build mentions string for reviewers
    local reviewer_mentions=""
    if [[ -n "$reviewers_list" ]]; then
        for reviewer in $reviewers_list; do
            reviewer_mentions="$reviewer_mentions @$reviewer"
        done
        reviewer_mentions=$(echo "$reviewer_mentions" | xargs)  # trim whitespace
        log_info "Reviewers: $reviewer_mentions"
    fi

    log_info "Analyzing PR: $current_title (Author: $pr_author)"

    # 3. Determine work items
    local needs_desc_update="false"
    if [[ "${#current_body}" -lt $min_desc_length ]]; then
        needs_desc_update="true"
        log_warning "Description is too short (${#current_body} chars). Marking for update."
    fi

    # 4. Fetch Diff
    local diff
    diff=$(get_pr_diff "$GITHUB_REPOSITORY" "$PR_NUMBER")
    
    if [[ -z "$diff" ]]; then
        log_info "Diff is empty. Nothing to review."
        exit 0
    fi
    
    # Truncate diff (approx 100k chars)
    local truncated_diff="${diff:0:100000}"

    # 5. Generate AI Content
    log_info "Generating analysis..."
    local payload_file="gemini_payload.json"
    local prompt
    prompt=$(construct_prompt "$truncated_diff" "$current_title" "$pr_author" "$tone" "$language" "$needs_desc_update")
    echo "$prompt" > "$payload_file"

    local response
    response=$(call_gemini "$GEMINI_API_KEY" "$payload_file")

    if [[ -z "$response" ]]; then
        log_error "Failed to get response from Gemini."
        exit 1
    fi

    # 6. Parse Response
    local generated_text
    generated_text=$(echo "$response" | jq -r '.candidates[0].content.parts[0].text // empty')
    
    # Clean JSON markdown blocks
    local clean_json
    clean_json=$(echo "$generated_text" | sed 's/```json//g' | sed 's/```//g')
    
    # Parse all analyses from single API response
    local review_comment
    review_comment=$(echo "$clean_json" | jq -r '.review_comment // empty')
    
    local performance_analysis
    performance_analysis=$(echo "$clean_json" | jq -r '.performance_analysis // empty')
    
    local security_analysis
    security_analysis=$(echo "$clean_json" | jq -r '.security_analysis // empty')
    
    local quality_analysis
    quality_analysis=$(echo "$clean_json" | jq -r '.quality_analysis // empty')
    
    local new_title
    new_title=$(echo "$clean_json" | jq -r '.new_title // empty')
    
    local new_desc
    new_desc=$(echo "$clean_json" | jq -r '.new_description // empty')
    
    local score
    score=$(echo "$clean_json" | jq -r '.quality_score // 0')

    local maintainability_score
    maintainability_score=$(echo "$clean_json" | jq -r '.maintainability_score // 0')

    log_success "Analysis Complete. Quality Score: $score/10 | Overall Benchmark: $maintainability_score/100"

    # 7. Execute Actions in Order (All analyses from SINGLE API call with same tone & language)
    
    # STEP 1: Update PR Title & Description FIRST
    log_info "Step 1: Updating PR title and description..."
    local update_json="{}"

    # Update Title?
    if [[ -n "$new_title" && "$new_title" != "null" && "$new_title" != "$current_title" ]]; then
        log_info "Suggesting new title: $new_title"
        update_json=$(echo "$update_json" | jq --arg t "$new_title" '. + {title: $t}')
    fi

    # Update Description - ALWAYS update now
    if [[ -n "$new_desc" && "$new_desc" != "null" ]]; then
        log_info "Updating description..."
        update_json=$(echo "$update_json" | jq --arg b "$new_desc" '. + {body: $b}')
    fi

    # Apply Updates
    update_pr "$GITHUB_REPOSITORY" "$PR_NUMBER" "$update_json"
    
    # STEP 2: Post General Changes Review Comment
    log_info "Step 2: Posting general changes review..."
    if [[ -n "$review_comment" && "$review_comment" != "null" ]]; then
        # Build mention line for author and reviewers
        local mentions="@$pr_author"
        if [[ -n "$reviewer_mentions" ]]; then
            mentions="$mentions $reviewer_mentions"
        fi
        
        # Add Review Buddy Branding with mentions
        local branded_comment="<!-- Review Buddy Start -->
## 🤖 Review Buddy - General Code Review
> 👥 **Attention:** $mentions

$review_comment

---
*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: $tone | Language: $language*"
        
        post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$branded_comment"
    fi
    
    # STEP 3: Post Performance Analysis (from same API call)
    log_info "Step 3: Posting performance analysis..."
    if [[ -n "$performance_analysis" && "$performance_analysis" != "null" ]]; then
        # Build mention line
        local mentions="@$pr_author"
        if [[ -n "$reviewer_mentions" ]]; then
            mentions="$mentions $reviewer_mentions"
        fi
        
        local perf_comment="<!-- Review Buddy Performance -->
## ⚡ Review Buddy - Performance Analysis
> 👥 **Attention:** $mentions

$performance_analysis

---
*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: $tone | Language: $language*"
        
        post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$perf_comment"
    fi
    
    # STEP 4: Post Security Analysis (from same API call)
    log_info "Step 4: Posting security audit..."
    if [[ -n "$security_analysis" && "$security_analysis" != "null" ]]; then
        # Build mention line
        local mentions="@$pr_author"
        if [[ -n "$reviewer_mentions" ]]; then
            mentions="$mentions $reviewer_mentions"
        fi
        
        local sec_comment="<!-- Review Buddy Security -->
## 🔐 Review Buddy - Security Audit
> 👥 **Attention:** $mentions

$security_analysis

---
*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: $tone | Language: $language*"
        
        post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$sec_comment"
    fi
    
    # STEP 5: Post Code Quality Analysis (from same API call)
    log_info "Step 5: Posting code quality analysis..."
    if [[ -n "$quality_analysis" && "$quality_analysis" != "null" ]]; then
        # Build mention line
        local mentions="@$pr_author"
        if [[ -n "$reviewer_mentions" ]]; then
            mentions="$mentions $reviewer_mentions"
        fi
        
        # Determine score badge color/label
        local score_label="Poor"
        if [[ "$maintainability_score" -ge 90 ]]; then
            score_label="Excellent"
        elif [[ "$maintainability_score" -ge 70 ]]; then
            score_label="Good"
        elif [[ "$maintainability_score" -ge 50 ]]; then
            score_label="Needs Improvement"
        fi

        local quality_comment="<!-- Review Buddy Quality -->
## 📊 Review Buddy - Code Quality & Maintainability Analysis
> 👥 **Attention:** $mentions

### 🎯 Overall Benchmark: **$maintainability_score/100** ($score_label)

$quality_analysis

---
*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: $tone | Language: $language*"
        
        post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$quality_comment"
    fi
    
    log_success "All tasks finished successfully!"
    log_info "Summary: SINGLE API call → PR updated + 4 specialized comments posted"
    log_info "All analyses used: Tone=$tone, Language=$language"
}

# Run the main function
main
