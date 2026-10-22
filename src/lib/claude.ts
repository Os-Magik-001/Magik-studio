import "server-only";
import { fakeAgents } from "@/lib/agent-fakes";

// The agents themselves live in @/lib/agents. Locally, MAGIK_FAKE_AGENTS=1 stands in for Claude.
export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY || fakeAgents();
