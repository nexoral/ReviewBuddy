#!/bin/bash
# Gemini API interactions

source "$(dirname "${BASH_SOURCE[0]}")/utils.sh"

call_gemini() {
    local api_key="$1"
    local payload_file="$2"
    local api_url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
    
    log_info "Sending request to Gemini AI..."
    
    local response
    response=$(curl -s -f -X POST "$api_url" \
        -H "x-goog-api-key: $api_key" \
        -H "Content-Type: application/json" \
        -d @"$payload_file")
        
    if [[ $? -ne 0 ]]; then
        log_error "Gemini API request failed"
        echo "" # return empty
    else
        echo "$response"
    fi
}

construct_prompt() {
    local diff="$1"
    local title="$2"
    local author="$3"
    local tone="$4"
    local lang="$5"
    local needs_desc="$6"
    
    # Using jq to construct the JSON payload safely
    jq -n \
      --arg diff "$diff" \
      --arg title "$title" \
      --arg author "$author" \
      --arg tone "$tone" \
      --arg lang "$lang" \
      --arg needs_desc "$needs_desc" \
      '{
        "contents": [{
          "parts": [{
            "text": ("You are an expert AI code reviewer. Analyze the git diff below and provide FOUR comprehensive analyses.\n\n" +
                   "Context:\n" +
                   " - PR Title: " + $title + "\n" +
                   " - Author: " + $author + "\n" +
                   " - Tone: " + $tone + "\n" +
                   " - Language: " + $lang + "\n" +
                   " - Needs Description Update: " + $needs_desc + "\n\n" +
                   "IMPORTANT: ALL responses (general, performance, security, quality) MUST use the same Tone (" + $tone + ") and Language (" + $lang + ") as specified.\n\n" +
                   "Tone Guidelines:\n" +
                   " - If Tone is \"roast\" or \"funny\", be brutally honest and funny in ALL sections. ROAST THE CODE.\n" +
                   " - If Tone is \"professional\", be concise and polite in ALL sections.\n" +
                   " - If Language is \"hinglish\", use a mix of Hindi and English in ALL sections.\n" +
                   "   - For \"roast\" in Hinglish: Be savage. Use Bollywood dialogues like \"Ek din tu mar jayega, kutte ki maut\", \"Ye kya bawasir bana diya?\", \"Tumse na ho payega\".\n" +
                   " - If Tone is \"friendly\", use emojis and be encouraging in ALL sections.\n\n" +
                   "Tasks:\n\n" +
                   "1. **General Review Comment**: Write a constructive review comment addressed to @" + $author + ".\n" +
                   "   - Analyze for bugs, general improvements, and style issues.\n" +
                   "   - Use the specified Tone and Language.\n" +
                   "   - Provide a Code Quality Score (1-10).\n\n" +
                   "2. **Performance Analysis** (100+ lines): Conduct a DEEP performance analysis.\n" +
                   "   - Use the same Tone and Language as above.\n" +
                   "   - Review: Algorithm complexity, Memory usage, Database queries, Caching, Async patterns, Loop optimizations, N+1 problems, Connection pooling, CPU operations, Concurrency.\n" +
                   "   - Provide DETAILED, ACTIONABLE recommendations with code examples.\n" +
                   "   - Make this comprehensive and over 100 lines.\n\n" +
                   "3. **Security Audit**: Conduct a COMPREHENSIVE security audit.\n" +
                   "   - Use the same Tone and Language as above.\n" +
                   "   - Analyze for: SQL Injection, XSS, CSRF, Auth/Authorization, Input validation, Secrets exposure, Session management, API security, Path traversal, Command injection, Rate limiting, CORS.\n" +
                   "   - For each issue: Severity (Critical/High/Medium/Low), Location, Exploit scenario, Remediation steps, OWASP/CWE references.\n" +
                   "   - Be thorough and educational.\n\n" +
                   "4. **Code Quality Analysis** (100+ lines): Provide an EXTENSIVE quality review.\n" +
                   "   - Use the same Tone and Language as above.\n" +
                   "   - Analyze: SOLID principles, Design patterns, DRY, Function complexity, Naming conventions, Code clarity, Error handling, Testing, Documentation, Code smells, Technical debt.\n" +
                   "   - For each issue: Category, Severity, Location, Explanation, Refactoring suggestions with examples.\n" +
                   "   - Be EXTREMELY detailed (100+ lines).\n\n" +
                   "5. **PR Metadata**:\n" +
                   "   - Check if the current title follows Conventional Commits. If GOOD, return null. ONLY suggest a new title if it is vague or violates conventions.\n" +
                   "   - Generate a comprehensive PR description (Markdown) with Summary, Changes, and Verification.\n\n" +
                   "6. **Overall Benchmark Score (0-100)**: Calculate a comprehensive maintainability score.\n" +
                   "   - Weigh all factors: Code Quality (30%), Security (25%), Performance (25%), Maintainability (20%).\n" +
                   "   - Scoring: 90-100 Excellent, 70-89 Good, 50-69 Needs Improvement, 0-49 Poor.\n" +
                   "   - Be strict but fair in scoring.\n\n" +
                   "CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks (no ```json```) or extra text.\n\n" +
                   "Output JSON with this EXACT structure:\n" +
                   "{\n" +
                   "  \"review_comment\": \"<markdown string>\",\n" +
                   "  \"performance_analysis\": \"<markdown string - 100+ lines>\",\n" +
                   "  \"security_analysis\": \"<markdown string - comprehensive>\",\n" +
                   "  \"quality_analysis\": \"<markdown string - 100+ lines>\",\n" +
                   "  \"new_title\": \"<string or null>\",\n" +
                   "  \"new_description\": \"<markdown string or null>\",\n" +
                   "  \"quality_score\": <number 1-10>,\n" +
                   "  \"maintainability_score\": <number 0-100>\n" +
                   "}\n\n" +
                   "Diff to analyze:\n" + $diff)
          }]
        }]
      }'
}

construct_chat_prompt() {
    local diff="$1"
    local title="$2"
    local author="$3"
    local comment="$4"
    local comment_author="$5"
    local tone="$6"
    local lang="$7"

    jq -n \
      --arg diff "$diff" \
      --arg title "$title" \
      --arg author "$author" \
      --arg comment "$comment" \
      --arg comment_author "$comment_author" \
      --arg tone "$tone" \
      --arg lang "$lang" \
      '{
        "contents": [{
          "parts": [{
            "text": ("You are Review Buddy, an expert AI code reviewer. You are replying to a comment on a Pull Request.\n\n" +
                   "Context:\n" +
                   " - PR Title: " + $title + "\n" +
                   " - PR Author: " + $author + "\n" +
                   " - Comment Author: " + $comment_author + "\n" +
                   " - User Question/Comment: " + $comment + "\n" +
                   " - Tone: " + $tone + "\n" +
                   " - Language: " + $lang + "\n\n" +
                   "Instructions:\n" +
                   "1. Analyze the User'\''s comment in the context of the PR Diff provided below.\n" +
                   "2. Answer their question, justify the code, or explain the issue clearly.\n" +
                   "3. Use the specified Tone and Language.\n" +
                   "   - If Tone is \"roast\", be savage but helpful.\n" +
                   "   - If Language is \"hinglish\", use Hinglish.\n" +
                   "4. Provide code examples if needed.\n" +
                   "5. Keep the response concise but informative.\n\n" +
                   "Diff Context:\n" + $diff)
          }]
        }]
      }'
}
