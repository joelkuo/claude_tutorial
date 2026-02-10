import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5";

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error("ANTHROPIC_API_KEY is required but not found in environment variables");
  }

  return anthropic(MODEL);
}
