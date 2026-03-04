const ANSWER_PREFIX = /^Answer:\s*/i;

export function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "");
}
