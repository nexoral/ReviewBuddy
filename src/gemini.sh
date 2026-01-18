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
        contents: [{
          parts: [{
            text: ("You are an expert AI code reviewer. Analyze the git diff below.\n\n" +
                   "Context:\n" +
                   " - PR Title: " + $title + "\n" +
                   " - Author: " + $author + "\n" +
                   " - Tone: " + $tone + "\n" +
                   " - Language: " + $lang + "\n" +
                   " - Needs Description Update: " + $needs_desc + "\n\n" +
                   "Tasks:\n" +
                   "1. **Analyze Code**: Look for bugs, security risks, performance issues, and style improvements.\n" +
                   "2. **Review Comment**: Write a constructive review comment addressed to @" + $author + ".\n" +
                   "   - Adopt the requested logical Tone (" + $tone + ") and Language (" + $lang + ").\n" +
                   "   - If Tone is \"roast\" or \"funny\", be brutally honest and funny. ROAST THE CODE. \n" +
                   "   - If Tone is \"professional\", be concise and polite.\n" +
                   "   - If Language is \"hinglish\", use a mix of Hindi and English. \n" +
                   "     - For \"roast\" in Hinglish: Be savage. Use Bollywood dialogues like \"Ek din tu mar jayega, kutte ki maut\", \"Ye kya bawasir bana diya?\", \"Tumse na ho payega\". Make it memorable.\n" +
                   "   - If Tone is \"friendly\", use emojis and be encouraging.\n" +
                   "3. **New Title**: Check if the current title follows Conventional Commits. If it is GOOD, return null. ONLY suggest a new title if the current one is vague, bad, or violates conventions.\n" +
                   "4. **Measurements**: Provide a Code Quality Score (1-10).\n" +
                   "5. **New Description**: Always generate a comprehensive PR description (Markdown) with Summary, Changes, and Verification.\n" +
                   "\n" +
                   "Output valid JSON ONLY with this structure:\n" +
                   "{\n" +
                   "  \"review_comment\": \"string (markdown)\",\n" +
                   "  \"new_title\": \"string or null\",\n" +
                   "  \"new_description\": \"string or null\",\n" +
                   "  \"quality_score\": number\n" +
                   "}\n\n" +
                   "Diff:\n" + $diff)
          }]
        }]
      }'
}
