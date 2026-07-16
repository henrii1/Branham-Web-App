const CHAT_STRINGS = {
  en: {
    welcomeDescription:
      "Ask questions about the sermons of William Marrion Branham. Your answers are grounded in the original sermon texts.",
    passagesTitle: "Passages",
    passagesDescription:
      "Sermon passages retrieved for your question will appear here. For the most relevant results, ask one topic per chat.",
    passagesSectionHeader: "Sermon Passages",
    switchingTopics: "Switching topics?",
    startNewChat: "Start a new chat",
    forMorePassages: "for more relevant passages.",
    viewPassages: "View passages",
    backToAnswer: "Back to answer",
    respondingIn: "Responding in",
    popularQuestions: "Popular Questions",
    chatTab: "Chat",
    passagesTab: "Passages",
    finalizingResponse: "Finalizing response…",
    askPlaceholder: "Ask a question…",
    waitingPlaceholder: "Waiting for response…",
  },
  es: {
    welcomeDescription:
      "Haga preguntas sobre los sermones de William Marrion Branham. Sus respuestas se basan en los textos originales de los sermones.",
    passagesTitle: "Pasajes",
    passagesDescription:
      "Los pasajes de sermones recuperados para su pregunta aparecerán aquí. Para obtener los resultados más relevantes, pregunte sobre un tema por chat.",
    passagesSectionHeader: "Pasajes de Sermones",
    switchingTopics: "¿Cambiando de tema?",
    startNewChat: "Inicie un nuevo chat",
    forMorePassages: "para pasajes más relevantes.",
    viewPassages: "Ver pasajes",
    backToAnswer: "Volver a la respuesta",
    respondingIn: "Respondiendo en",
    popularQuestions: "Preguntas populares",
    chatTab: "Chat",
    passagesTab: "Pasajes",
    finalizingResponse: "Finalizando respuesta…",
    askPlaceholder: "Haga una pregunta…",
    waitingPlaceholder: "Esperando respuesta…",
  },
  fr: {
    welcomeDescription:
      "Posez des questions sur les sermons de William Marrion Branham. Vos réponses sont fondées sur les textes originaux des sermons.",
    passagesTitle: "Passages",
    passagesDescription:
      "Les passages de sermons récupérés pour votre question apparaîtront ici. Pour des résultats plus pertinents, posez une question par chat.",
    passagesSectionHeader: "Passages de Sermons",
    switchingTopics: "Vous changez de sujet ?",
    startNewChat: "Commencer un nouveau chat",
    forMorePassages: "pour des passages plus pertinents.",
    viewPassages: "Voir les passages",
    backToAnswer: "Retour à la réponse",
    respondingIn: "Répondre en",
    popularQuestions: "Questions populaires",
    chatTab: "Chat",
    passagesTab: "Passages",
    finalizingResponse: "Finalisation de la réponse…",
    askPlaceholder: "Posez une question…",
    waitingPlaceholder: "En attente de réponse…",
  },
} as const;

type ChatLang = keyof typeof CHAT_STRINGS;
export type ChatStrings = (typeof CHAT_STRINGS)[ChatLang];

export function getChatStrings(lang: string): ChatStrings {
  return CHAT_STRINGS[lang as ChatLang] ?? CHAT_STRINGS.en;
}