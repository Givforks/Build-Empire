export function buildMeetingSummary(prompt: string) {
  return [
    "# Meeting Brief",
    "",
    "## Client Request Summary",
    prompt,
    "",
    "## Key Topics",
    "- Core objective and context",
    "- Expected outcomes from the appointment",
    "- Constraints, timeline, and risks",
    "",
    "## Suggested Questions for Superuser",
    "1. What is the highest impact next step?",
    "2. What should be prioritized in the next 30 days?",
    "3. What trade-offs should be avoided?",
    "",
    "## Proposed Agenda",
    "1. Context",
    "2. Deep discussion",
    "3. Recommendations",
    "4. Action plan"
  ].join("\n");
}
