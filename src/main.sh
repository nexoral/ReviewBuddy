#!/bin/bash

# Main Application Logic
# TODO: Add more features like 

# Resolve script directory to source correctly
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/github.sh"
source "$SCRIPT_DIR/gemini.sh"

handle_pull_request() {
    # 1. Initialization
    log_info "Starting Review Buddy (PR Mode)..."
    check_dependencies
    validate_env

    local tone="${TONE:-roast}"
    local language="${LANGUAGE:-hinglish}"
    local min_desc_length=50
    local min_title_length=15 # Define threshold for "short" title

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

    # --- CONDITIONAL SKIP LOGIC REMOVED ---
    # Auto-Review now triggers for ALL PRs regardless of description length.
    log_info "Auto-Review Triggered: Analyzing PR..."


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
    # Attempt to extract JSON from markdown code block
    if echo "$generated_text" | grep -q "```json"; then
        clean_json=$(echo "$generated_text" | sed -n '/```json/,/```/p' | sed 's/```json//g' | sed 's/```//g')
    elif echo "$generated_text" | grep -q "```"; then
        clean_json=$(echo "$generated_text" | sed -n '/```/,/```/p' | sed 's/```//g')
    else
        clean_json="$generated_text"
    fi
    
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

    # STEP 6: Add Smart Labels Based on Analysis
    log_info "Step 6: Adding smart labels based on analysis..."

    # Use the updated title (if it was changed) for label determination
    local final_title="$new_title"
    if [[ -z "$final_title" || "$final_title" == "null" ]]; then
        final_title="$current_title"
    fi

    # Determine labels based on title, scores, and analyses
    local labels_to_add
    labels_to_add=($(determine_labels "$final_title" "$maintainability_score" "$security_analysis" "$performance_analysis"))

    if [[ ${#labels_to_add[@]} -gt 0 ]]; then
        log_info "Determined labels: ${labels_to_add[*]}"
        add_labels "$GITHUB_REPOSITORY" "$PR_NUMBER" "${labels_to_add[@]}"
    else
        log_info "No labels to add based on current analysis"
    fi

    # STEP 7: Post Final Recommendation
    log_info "Step 7: Posting final recommendation..."

    # Get recommendation
    local recommendation_data
    recommendation_data=$(determine_recommendation "$maintainability_score" "$score" "$security_analysis" "$performance_analysis" "$tone" "$language")

    # Parse recommendation data (format: STATUS|ICON|MESSAGE|REASONING)
    IFS='|' read -r rec_status rec_icon rec_message rec_reasoning <<< "$recommendation_data"

    # Build mention line
    local mentions="@$pr_author"
    if [[ -n "$reviewer_mentions" ]]; then
        mentions="$mentions $reviewer_mentions"
    fi

    # Create final recommendation comment
    local final_comment="<!-- Review Buddy Recommendation -->
## $rec_icon Review Buddy - Final Recommendation
> 👥 **Attention:** $mentions

### Recommendation: **$rec_status**

$rec_message

### Reasoning:
$rec_reasoning

---

### 📋 Review Checklist for Reviewers:
- [ ] Code changes align with the PR description
- [ ] No security vulnerabilities introduced
- [ ] Performance considerations addressed
- [ ] Code follows project conventions
- [ ] Tests are adequate (if applicable)
- [ ] Documentation updated (if needed)

### 🎯 Next Steps:
"

    if [[ "$rec_status" == "APPROVE" ]]; then
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            final_comment+="✅ **Agar tum satisfied ho, toh approve kar do aur merge kar do!**"
        elif [[ "$tone" == "funny" ]]; then
            final_comment+="✅ **If you're happy with it, smash that approve button! 👍**"
        else
            final_comment+="✅ **If all reviewers are satisfied, please approve and merge this PR.**"
        fi
    elif [[ "$rec_status" == "REQUEST CHANGES" ]]; then
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            final_comment+="⚠️ **Pehle suggestions address karo, phir approve karna.**"
        elif [[ "$tone" == "funny" ]]; then
            final_comment+="⚠️ **Fix the issues mentioned above, then we'll give this the thumbs up! 👍**"
        else
            final_comment+="⚠️ **Please address the suggestions above, then request re-review for approval.**"
        fi
    else  # REJECT
        if [[ "$tone" == "roast" && "$language" == "hinglish" ]]; then
            final_comment+="🚫 **Critical issues hai - is PR ko reject karo aur major fixes ke baad dobara submit karo.**"
        elif [[ "$tone" == "funny" ]]; then
            final_comment+="🚫 **This needs major work - please close this PR and submit a new one after fixes! 🔧**"
        else
            final_comment+="🚫 **This PR should be rejected. Please close and resubmit after addressing critical issues.**"
        fi
    fi

    final_comment+="

---
*Generated by [Review Buddy](https://github.com/nexoral/ReviewBuddy) | Tone: $tone | Language: $language*"

    post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$final_comment"

    log_success "All tasks finished successfully!"
    log_info "Summary: SINGLE API call → PR updated + 4 specialized comments + final recommendation posted + labels assigned"
    log_info "Final Recommendation: $rec_status"
    log_info "All analyses used: Tone=$tone, Language=$language"
}

handle_issue_comment() {
    log_info "Starting Review Buddy (Comment Reply Mode)..."
    check_dependencies
    validate_env

    local tone="${TONE:-roast}"
    local language="${LANGUAGE:-hinglish}"

    # Read Event Payload to find comment
    if [[ ! -f "$GITHUB_EVENT_PATH" ]]; then
        log_error "Event payload not found at $GITHUB_EVENT_PATH"
        exit 1
    fi

    # Extract comment info using jq
    local comment_body
    comment_body=$(jq -r '.comment.body // ""' "$GITHUB_EVENT_PATH")
    
    local comment_author
    comment_author=$(jq -r '.comment.user.login // ""' "$GITHUB_EVENT_PATH")

    # Extract PR number from issue payload (it's called 'issue' even for PR comments)
    local issue_number
    issue_number=$(jq -r '.issue.number // empty' "$GITHUB_EVENT_PATH")
    
    if [[ -z "$issue_number" ]]; then
        log_warning "Could not find issue number in payload. Exiting."
        exit 0
    fi
    
    # Verify it is a PR
    local is_pr
    is_pr=$(jq -r '.issue.pull_request // empty' "$GITHUB_EVENT_PATH")
    if [[ -z "$is_pr" ]]; then
        log_info "This comment is not on a Pull Request. Skipping."
        exit 0
    fi

    # Check for /Buddy or /buddy command
    if echo "$comment_body" | grep -qiE "/buddy"; then
        log_info "Command '/Buddy' detected in comment by @$comment_author."
        
        # Override global PR_NUMBER for fetching details
        PR_NUMBER="$issue_number"

        # Fetch PR Details for context
        local pr_json
        pr_json=$(get_pr_details "$GITHUB_REPOSITORY" "$PR_NUMBER")
        
        local current_title
        current_title=$(echo "$pr_json" | jq -r '.title // ""')
        
        local pr_author
        pr_author=$(echo "$pr_json" | jq -r '.user.login // ""')

        # Fetch Diff for Context
        local diff
        diff=$(get_pr_diff "$GITHUB_REPOSITORY" "$PR_NUMBER")
        
        if [[ -z "$diff" ]]; then
            log_warning "Diff is empty. Proceeding without diff context."
            diff="No diff available."
        fi
        local truncated_diff="${diff:0:50000}" # Smaller diff context for chat

        # Generate Reply
        log_info "Generating reply..."
        local payload_file="gemini_chat_payload.json"
        
        local prompt
        prompt=$(construct_chat_prompt "$truncated_diff" "$current_title" "$pr_author" "$comment_body" "$comment_author" "$tone" "$language")
        echo "$prompt" > "$payload_file"

        local response
        response=$(call_gemini "$GEMINI_API_KEY" "$payload_file")

        if [[ -z "$response" ]]; then
            log_error "Failed to get response from Gemini."
            exit 1
        fi

        local reply_text
        reply_text=$(echo "$response" | jq -r '.candidates[0].content.parts[0].text // empty')

        if [[ -n "$reply_text" ]]; then
            post_comment "$GITHUB_REPOSITORY" "$PR_NUMBER" "$reply_text"
            log_success "Replied to user comment."
        else
            log_error "Empty response from Gemini."
        fi

    else
        log_info "No '/Buddy' command found. Skipping."
        exit 0
    fi
}

main() {
    log_info "GitHub Event Name: $GITHUB_EVENT_NAME"

    if [[ "$GITHUB_EVENT_NAME" == "pull_request" || "$GITHUB_EVENT_NAME" == "pull_request_target" ]]; then
        handle_pull_request
    elif [[ "$GITHUB_EVENT_NAME" == "issue_comment" ]]; then
        handle_issue_comment
    else
        log_warning "Unsupported event: $GITHUB_EVENT_NAME"
        # Optional: Fail or just exit success to not break workflow?
        # Exit success to allow other jobs to continue if any
        exit 0
    fi
}

# Run the main function
main
