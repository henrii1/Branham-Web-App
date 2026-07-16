// Strips "Answer:" / "Respuesta:" / "Réponse:" and markdown-decorated variants
// at the start of text: **Answer:**, ## Answer:, *Respuesta:*, etc.
const ANSWER_PREFIX =
  /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Answer|Respuesta|R[eé]ponse):?(?:\*{1,2})?:?\s*/i;

export function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "").trimStart();
}