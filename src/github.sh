#!/bin/bash

# GitHub API interactions

source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"

get_pr_details() {
    local repo="$1"
    local pr_num="$2"
    
    log_info "Fetching PR #$pr_num details from $repo..."
    
    local response
    response=$(curl -s -f -H "Authorization: token ${GITHUB_TOKEN}" \
        "https://api.github.com/repos/${repo}/pulls/${pr_num}")
        
    if [[ $? -ne 0 ]]; then
        log_error "Failed to fetch PR details"
        exit 1
    fi
    
    echo "$response"
}

get_pr_diff() {
    local repo="$1"
    local pr_num="$2"
    
    log_info "Fetching PR diff..."
    
    local diff
    diff=$(curl -s -L -f -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github.v3.diff" \
        "https://api.github.com/repos/${repo}/pulls/${pr_num}")
        
    echo "$diff"
}

post_comment() {
    local repo="$1"
    local pr_num="$2"
    local body="$3"
    
    if [[ -z "$body" || "$body" == "null" ]]; then
        return
    fi
    
    log_info "Posting comment to PR #$pr_num..."
    
    # Escape content safely using jq
    local payload
    payload=$(jq -n --arg b "$body" '{body: $b}')
    
    curl -s -f -X POST -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "https://api.github.com/repos/${repo}/issues/${pr_num}/comments" > /dev/null
        
    if [[ $? -eq 0 ]]; then
        log_success "Comment posted successfully"
    else
        log_error "Failed to post comment"
    fi
}

update_pr() {
    local repo="$1"
    local pr_num="$2"
    local payload="$3"
    
    if [[ "$payload" == "{}" ]]; then
        return
    fi
    
    log_info "Updating PR metadata..."
    
    curl -s -f -X PATCH -H "Authorization: token ${GITHUB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "https://api.github.com/repos/${repo}/pulls/${pr_num}" > /dev/null
        
    if [[ $? -eq 0 ]]; then
        log_success "PR updated successfully"
    else
        log_error "Failed to update PR"
    fi
}
