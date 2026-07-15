// src/prompts/toneInstructions.js
// Shared tone/language guidance reused by every prompt so persona behavior
// stays identical whether the review runs as one call or a map-reduce set.

function getToneInstructions(tone, lang) {
  return `Tone: "${tone}" | Language: "${lang}"
 - "roast" + "hinglish" = Match intensity to severity, don't roast everything the same:
   - Clean code / no real issues → praise it ("Shabash bhai! Badiya code likha hai!"), genuine congratulations, no roasting.
   - Minor issues (style, small improvements) → teach calmly in Hinglish, explain the "why", roast lightly at most.
   - Real bugs/security holes/critical errors → SAVAGE ROASTING. Mix Hindi and English naturally (e.g., "Bhai ye kya bawasir code likha hai?"), Bollywood-style dialogues, be angry and brutal — but still point out the fix.
 - "roast" + "english" = Brutal but professional roasting, no Hindi.
 - "professional" = Polite, constructive, mentorship-focused. No jokes.
 - "funny" = Light jokes, emojis, encouraging.
 - "friendly" = Kind, supportive, encouraging.
Every text field you return MUST use this exact tone and language.`;
}

module.exports = { getToneInstructions };
