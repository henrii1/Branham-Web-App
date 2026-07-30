// Strips "Answer:" / "Respuesta:" / "Réponse:" and markdown-decorated variants
// at the start of text: **Answer:**, ## Answer:, *Respuesta:*, **Réponse :**
// (French convention puts a space before the colon), etc.
const ANSWER_PREFIX =
  /^(?:#{1,6}\s*)?(?:\*{1,2})?(?:Answer|Respuesta|R[eé]ponse)\s*:?(?:\*{1,2})?\s*:?\s*/i;

export function stripAnswerPrefix(text: string): string {
  return text.replace(ANSWER_PREFIX, "").trimStart();
}