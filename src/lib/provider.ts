import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5";

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using Anthropic without key (requests will fail)");
  }

  return anthropic(MODEL);
}
