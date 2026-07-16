const CHAT_STRINGS = {
  en: {
    // Chat UI
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
    // Language announcement banner
    announceHeading: "Spanish & French are now available 🇪🇸 🇫🇷",
    announceSubtext:
      "Know someone who'd find this useful? Share it — English, Spanish, and French are all supported.",
    announceShare: "Share",
    announceCopyLink: "Copy link",
    announceCopied: "Copied!",
    announceShareText:
      "Explore William Branham's sermons with AI — available in English, Spanish, and French.",
    // Language feature modal
    featureHeading: "Spanish & French are now available",
    featureBody:
      "You can now ask questions and receive full answers in Spanish or French. Set your preferred language in your profile.",
    featureSpanishStat: "385 sermons available in Spanish",
    featureFrenchStat: "359 sermons available in French",
    featureSetLanguage: "Set my language",
    featureLater: "Later",
    // Sermon count note (shown beneath language pill for non-English; empty for EN)
    sermonCountNote: "",
  },
  es: {
    // Chat UI
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
    // Language announcement banner
    announceHeading: "Inglés, Español y Francés disponibles 🇺🇸 🇪🇸 🇫🇷",
    announceSubtext:
      "¿Conoce a alguien que se beneficiaría? Compártalo — disponible en inglés, español y francés.",
    announceShare: "Compartir",
    announceCopyLink: "Copiar enlace",
    announceCopied: "¡Copiado!",
    announceShareText:
      "Explora los sermones de William Marrion Branham con IA — disponible en inglés, español y francés.",
    // Language feature modal
    featureHeading: "Inglés, Español y Francés ahora disponibles",
    featureBody:
      "Ahora puede hacer preguntas y recibir respuestas completas en español o francés. Configure su idioma preferido en su perfil.",
    featureSpanishStat: "385 sermones disponibles en español",
    featureFrenchStat: "359 sermones disponibles en francés",
    featureSetLanguage: "Establecer mi idioma",
    featureLater: "Más tarde",
    sermonCountNote:
      "385 de ~1,200 sermones indexados en español. Puede continuar con estas respuestas en mente.",
  },
  fr: {
    // Chat UI
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
    // Language announcement banner
    announceHeading: "Anglais, Espagnol et Français disponibles 🇺🇸 🇪🇸 🇫🇷",
    announceSubtext:
      "Vous connaissez quelqu'un qui en bénéficierait ? Partagez — disponible en anglais, espagnol et français.",
    announceShare: "Partager",
    announceCopyLink: "Copier le lien",
    announceCopied: "Copié !",
    announceShareText:
      "Explorez les sermons de William Marrion Branham avec l'IA — disponible en anglais, espagnol et français.",
    // Language feature modal
    featureHeading: "Anglais, Espagnol et Français maintenant disponibles",
    featureBody:
      "Vous pouvez maintenant poser des questions et recevoir des réponses complètes en espagnol ou en français. Définissez votre langue préférée dans votre profil.",
    featureSpanishStat: "385 sermons disponibles en espagnol",
    featureFrenchStat: "359 sermons disponibles en français",
    featureSetLanguage: "Définir ma langue",
    featureLater: "Plus tard",
    sermonCountNote:
      "359 des ~1 200 sermons indexés en français. Vous pouvez maintenant continuer avec ces réponses à l'esprit.",
  },
} as const;

type ChatLang = keyof typeof CHAT_STRINGS;
export type ChatStrings = (typeof CHAT_STRINGS)[ChatLang];

export function getChatStrings(lang: string): ChatStrings {
  return CHAT_STRINGS[lang as ChatLang] ?? CHAT_STRINGS.en;
}