// Strips "Answer:" and all markdown-decorated variants at the start of text:
// Answer:, **Answer:**, ## Answer:, ### Answer:, ## **Answer:**, *Answer:*, etc.
const ANSWER_PREFIX = /^(?:#{1,6}\s*)?(?:\*{1,2})?Answer:?(?:\*{1,2})?:?\s*/i;

export function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "").trimStart();
}
