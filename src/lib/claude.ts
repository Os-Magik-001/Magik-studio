import "server-only";

// The agents themselves live in @/lib/agents.
export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;
