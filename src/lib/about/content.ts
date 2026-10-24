/**
 * Copy for the /about page in every supported language.
 *
 * Source: "About Branham Sermons Assistant.pdf" (English, supplied by the
 * project owner), condensed for the web. Spanish and French are translations
 * of the approved English. The example quote in each language is the real
 * sermon text for HEBREWS, CHAPTER ONE (57-0821) ¶104, as returned by the
 * API's /api/reference endpoint for that language — not a translation of
 * the English — so the citation pill opens a matching passage.
 *
 * Adding a language: add an entry here (the AboutLang union forces every
 * field), then add its route params and sitemap entry.
 */

export type AboutLang = "en" | "es" | "fr";

export const ABOUT_LANGS: AboutLang[] = ["en", "es", "fr"];

export interface AboutContent {
  metaTitle: string;
  metaDescription: string;
  askQuestion: string;
  title: string;
  lead: string;
  availableIn: string;
  whyHeading: string;
  whyParagraphs: string[];
  pullQuote: string;
  whoHeading: string;
  who: { label: string; body: string }[];
  doesHeading: string;
  principle: string;
  example: {
    question: string;
    quote: string;
    citation: string;
    evidenceLabel: string;
    caption: string;
  };
  features: { label: string; body: string }[];
  isntHeading: string;
  isntPastor: { heading: string; body: string };
  isntTable: { heading: string; body: string; linkLabel: string };
  aheadHeading: string;
  aheadIntro: string;
  roadmap: { label: string; body: string }[];
  foundation: string;
  contactHeading: string;
  contactBody: string;
  ctaChat: string;
  ctaFaq: string;
  /** Example question shown in the closing search-style link. */
  ctaExample: string;
}

export const ABOUT_CONTENT: Record<AboutLang, AboutContent> = {
  en: {
    metaTitle: "About Branham Sermons Assistant",
    metaDescription:
      "Why Branham Sermons Assistant exists, who it is for, and how it answers questions from the original sermons of William Marrion Branham with every point linked to the source.",
    askQuestion: "Ask a question",
    title: "About Branham Sermons Assistant",
    lead:
      "Branham Sermons Assistant, also known as Branham Sermons AI, is a search and study tool for the sermons of William Marrion Branham. Ask a question the way you would ask a person, in your own words or with the exact words you remember, and get a clear answer drawn from the sermons with every point linked to the original quotation.",
    availableIn: "Available in",
    whyHeading: "Why it exists",
    whyParagraphs: [
      "The idea came one morning during prayer. A sermon came to mind and I wanted to find it, but no keyword I tried in the Table app brought it up. What if people could find sermons, compare doctrines and study the Message and Scripture by asking natural questions instead of guessing keywords?",
      "A real situation added to the burden. Someone who wanted to understand what our church believed searched online, and what they found painted a distorted and alarming picture, enough that they discouraged a young man from ever attending. When people look for the truth about Brother Branham, what they find first is often incomplete, second-hand or biased.",
    ],
    pullQuote:
      "This platform exists to stand between an honest question and a trustworthy answer, and to make sure that answer always points back to the sermons themselves.",
    whoHeading: "Who it’s for",
    who: [
      {
        label: "Young and new believers",
        body: "Clear, scriptural answers to questions about their faith and the doctrines they hold.",
      },
      {
        label: "Ministers and teachers",
        body: "Preparing sermons, Bible studies and research across subjects in the Message.",
      },
      {
        label: "Believers studying deeper",
        body: "Comparing related sermons to gain a broader understanding of a subject.",
      },
      {
        label: "Seekers outside the Message",
        body: "Anyone curious about Brother Branham for the first time, who deserves the sermons themselves rather than distorted information found online.",
      },
    ],
    doesHeading: "What it does",
    principle: "It never asks you to take its word for anything. It shows you the source.",
    example: {
      question: "Where did he say God spoke by the prophets, but now through His Son?",
      quote:
        "In that day, He spoke by the prophets, but this day through His Son. That was the word of a prophet, there. This is the Word of the Son, today.",
      citation: "HEBREWS, CHAPTER ONE — 57-0821: ¶104",
      evidenceLabel: "Evidence",
      caption: "Tap the citation to read the exact paragraph it points to.",
    },
    features: [
      { label: "Search naturally or exactly", body: "Describe what you remember, or search by precise wording." },
      {
        label: "Focused answers",
        body: "A clear response supported by sermon quotations, with retrieved passages shown alongside.",
      },
      { label: "Clickable references", body: "Every citation opens the exact location in the sermon." },
      { label: "Natural follow-up", body: "Ask further questions the way a real conversation unfolds." },
      { label: "Popular Questions", body: "Curated answers to the doctrinal questions people ask most." },
      {
        label: "Shareable and saved",
        body: "Share answers on WhatsApp and elsewhere, and save conversations once signed in.",
      },
    ],
    isntHeading: "What it is not",
    isntPastor: {
      heading: "A substitute for your pastor",
      body: "It is made for comparing quotes, finding references and understanding general doctrine. Personal or sensitive spiritual matters belong with your pastor. It supports the life of the believer and never replaces the shepherd God has placed over it.",
    },
    isntTable: {
      heading: "A replacement for the Table",
      body: "It is not a reader for the sermon audio or text. It helps you find the right sermon and quotation, then sends you to the source to read the full sermon.",
      linkLabel: "Open the Table app",
    },
    aheadHeading: "What’s ahead",
    aheadIntro:
      "The aim is to be the bridge between what people search for online and the actual sermon tapes and books, the place a seeker’s question leads and from which they are guided to the right sermons.",
    roadmap: [
      {
        label: "More languages",
        body: "Building on English, Spanish and French so more people can read the Message in their own tongue.",
      },
      {
        label: "A trustworthy first result",
        body: "When someone searches online about Brother Branham’s message, the answer they meet first should be grounded, scriptural and linked to the sermons.",
      },
      { label: "More platforms", body: "Including mobile, so the tool is available wherever people study." },
    ],
    foundation:
      "In time, Branham Sermons Assistant will sit under the Branham Sermons Foundation as part of a wider work serving believers and seekers alike.",
    contactHeading: "Contact",
    contactBody:
      "We welcome feedback and recommendations from those new to the Message and those who have long studied the sermons.",
    ctaChat: "Ask your first question",
    ctaFaq: "Browse popular questions",
    ctaExample: "What did Brother Branham teach about the Seven Seals?",
  },

  es: {
    metaTitle: "Acerca de Branham Sermons Assistant",
    metaDescription:
      "Por qué existe Branham Sermons Assistant, para quién es y cómo responde preguntas a partir de los sermones originales de William Marrion Branham, con cada punto enlazado a la fuente.",
    askQuestion: "Hacer una pregunta",
    title: "Acerca de Branham Sermons Assistant",
    lead:
      "Branham Sermons Assistant, también conocido como Branham Sermons AI, es una herramienta de búsqueda y estudio de los sermones de William Marrion Branham. Haga una pregunta como se la haría a una persona, con sus propias palabras o con las palabras exactas que recuerda, y reciba una respuesta clara tomada de los sermones, con cada punto enlazado a la cita original.",
    availableIn: "Disponible en",
    whyHeading: "Por qué existe",
    whyParagraphs: [
      "La idea llegó una mañana durante la oración. Me vino a la mente un sermón y quise encontrarlo, pero ninguna palabra clave que probé en la aplicación The Table lo encontró. ¿Y si las personas pudieran encontrar sermones, comparar doctrinas y estudiar el Mensaje y las Escrituras haciendo preguntas naturales en lugar de adivinar palabras clave?",
      "Una situación real aumentó esa carga. Alguien que quería entender lo que creía nuestra iglesia buscó en internet, y lo que encontró pintaba un cuadro distorsionado y alarmante, al punto de que disuadió a un joven de asistir. Cuando las personas buscan la verdad sobre el Hermano Branham, lo primero que encuentran suele ser incompleto, de segunda mano o parcial.",
    ],
    pullQuote:
      "Esta plataforma existe para estar entre una pregunta sincera y una respuesta confiable, y para asegurar que esa respuesta siempre remita a los sermones mismos.",
    whoHeading: "Para quién es",
    who: [
      {
        label: "Creyentes jóvenes y nuevos",
        body: "Respuestas claras y bíblicas a preguntas sobre su fe y las doctrinas que sostienen.",
      },
      {
        label: "Ministros y maestros",
        body: "Para preparar sermones, estudios bíblicos e investigaciones sobre los temas del Mensaje.",
      },
      {
        label: "Creyentes que estudian a fondo",
        body: "Para comparar sermones relacionados y obtener una comprensión más amplia de un tema.",
      },
      {
        label: "Buscadores fuera del Mensaje",
        body: "Cualquiera que sienta curiosidad por el Hermano Branham por primera vez, y que merece los sermones mismos en lugar de información distorsionada en internet.",
      },
    ],
    doesHeading: "Qué hace",
    principle: "Nunca le pide que confíe en su palabra. Le muestra la fuente.",
    example: {
      question: "¿Dónde dijo que Dios habló por los profetas, pero ahora a través de Su Hijo?",
      quote:
        "En aquel día, Él habló por los profetas, pero en este día a través de Su Hijo. Eso allá era la palabra de un profeta. Hoy, ésta es la Palabra del Hijo.",
      citation: "HEBREOS, CAPÍTULO UNO — 57-0821: ¶104",
      evidenceLabel: "Evidencia",
      caption: "Toque la cita para leer el párrafo exacto al que se refiere.",
    },
    features: [
      {
        label: "Búsqueda natural o exacta",
        body: "Describa lo que recuerda o busque por las palabras precisas.",
      },
      {
        label: "Respuestas enfocadas",
        body: "Una respuesta clara respaldada por citas de los sermones, con los pasajes encontrados al lado.",
      },
      { label: "Referencias con enlace", body: "Cada cita abre la ubicación exacta en el sermón." },
      {
        label: "Preguntas de seguimiento",
        body: "Siga preguntando como en una conversación real.",
      },
      {
        label: "Preguntas populares",
        body: "Respuestas seleccionadas a las preguntas doctrinales más frecuentes.",
      },
      {
        label: "Para compartir y guardar",
        body: "Comparta respuestas por WhatsApp y otras plataformas, y guarde sus conversaciones al iniciar sesión.",
      },
    ],
    isntHeading: "Lo que no es",
    isntPastor: {
      heading: "Un sustituto de su pastor",
      body: "Está hecho para comparar citas, encontrar referencias y entender la doctrina general. Los asuntos espirituales personales o delicados corresponden a su pastor. Apoya la vida del creyente y nunca reemplaza al pastor que Dios ha puesto sobre ella.",
    },
    isntTable: {
      heading: "Un reemplazo de The Table",
      body: "No es un lector del audio ni del texto de los sermones. Le ayuda a encontrar el sermón y la cita correctos, y luego lo envía a la fuente para leer el sermón completo.",
      linkLabel: "Abrir la aplicación The Table",
    },
    aheadHeading: "Lo que viene",
    aheadIntro:
      "La meta es ser el puente entre lo que las personas buscan en internet y las cintas y libros de los sermones, el lugar al que conduce la pregunta de quien busca y desde el cual se le guía a los sermones correctos.",
    roadmap: [
      {
        label: "Más idiomas",
        body: "A partir del inglés, el español y el francés, para que más personas puedan leer el Mensaje en su propia lengua.",
      },
      {
        label: "Un primer resultado confiable",
        body: "Cuando alguien busque en internet sobre el Mensaje del Hermano Branham, la primera respuesta que encuentre debe ser fundamentada, bíblica y enlazada a los sermones.",
      },
      {
        label: "Más plataformas",
        body: "Incluido el móvil, para que la herramienta esté disponible dondequiera que se estudie.",
      },
    ],
    foundation:
      "Con el tiempo, Branham Sermons Assistant formará parte de la Branham Sermons Foundation, como parte de una obra más amplia al servicio de creyentes y buscadores.",
    contactHeading: "Contacto",
    contactBody:
      "Agradecemos los comentarios y sugerencias tanto de quienes son nuevos en el Mensaje como de quienes han estudiado los sermones por mucho tiempo.",
    ctaChat: "Haga su primera pregunta",
    ctaFaq: "Ver preguntas populares",
    ctaExample: "¿Qué enseñó el Hno. Branham sobre los Siete Sellos?",
  },

  fr: {
    metaTitle: "À propos de Branham Sermons Assistant",
    metaDescription:
      "Pourquoi Branham Sermons Assistant existe, à qui il s’adresse et comment il répond aux questions à partir des sermons originaux de William Marrion Branham, chaque point étant relié à sa source.",
    askQuestion: "Poser une question",
    title: "À propos de Branham Sermons Assistant",
    lead:
      "Branham Sermons Assistant, aussi appelé Branham Sermons AI, est un outil de recherche et d’étude des sermons de William Marrion Branham. Posez une question comme vous la poseriez à une personne, avec vos propres mots ou avec les mots exacts dont vous vous souvenez, et recevez une réponse claire tirée des sermons, chaque point étant relié à la citation originale.",
    availableIn: "Disponible en",
    whyHeading: "Pourquoi il existe",
    whyParagraphs: [
      "L’idée est venue un matin pendant la prière. Un sermon m’est venu à l’esprit et j’ai voulu le retrouver, mais aucun mot-clé essayé dans l’application The Table ne l’a fait apparaître. Et si l’on pouvait trouver des sermons, comparer des doctrines et étudier le Message et les Écritures en posant des questions naturelles plutôt qu’en devinant des mots-clés ?",
      "Une situation réelle a renforcé ce fardeau. Quelqu’un qui voulait comprendre ce que croyait notre église a fait des recherches en ligne, et ce qu’il a trouvé donnait une image déformée et alarmante, au point de dissuader un jeune homme de venir. Quand on cherche la vérité sur Frère Branham, ce que l’on trouve en premier est souvent incomplet, de seconde main ou partial.",
    ],
    pullQuote:
      "Cette plateforme existe pour se tenir entre une question sincère et une réponse digne de confiance, et pour que cette réponse renvoie toujours aux sermons eux-mêmes.",
    whoHeading: "À qui il s’adresse",
    who: [
      {
        label: "Jeunes croyants et nouveaux convertis",
        body: "Des réponses claires et scripturaires aux questions sur leur foi et les doctrines qu’ils tiennent.",
      },
      {
        label: "Ministres et enseignants",
        body: "Pour préparer des prédications, des études bibliques et des recherches sur les sujets du Message.",
      },
      {
        label: "Croyants qui étudient en profondeur",
        body: "Pour comparer des sermons liés et acquérir une compréhension plus large d’un sujet.",
      },
      {
        label: "Chercheurs en dehors du Message",
        body: "Toute personne qui découvre Frère Branham, et qui mérite les sermons eux-mêmes plutôt que des informations déformées trouvées en ligne.",
      },
    ],
    doesHeading: "Ce qu’il fait",
    principle: "Il ne vous demande jamais de le croire sur parole. Il vous montre la source.",
    example: {
      question: "Où a-t-il dit que Dieu a parlé par les prophètes, mais maintenant dans Son Fils ?",
      quote:
        "À cette époque-là Il a parlé par les prophètes, mais à notre époque, dans Son Fils. Là, c’était la parole d’un prophète. Aujourd’hui, c’est la Parole du Fils.",
      citation: "HÉBREUX, CHAPITRE UN — 57-0821: ¶104",
      evidenceLabel: "Preuve",
      caption: "Touchez la citation pour lire le paragraphe exact auquel elle renvoie.",
    },
    features: [
      {
        label: "Recherche naturelle ou exacte",
        body: "Décrivez ce dont vous vous souvenez, ou cherchez avec les mots précis.",
      },
      {
        label: "Des réponses ciblées",
        body: "Une réponse claire appuyée par des citations des sermons, avec les passages trouvés affichés à côté.",
      },
      { label: "Références cliquables", body: "Chaque citation ouvre l’emplacement exact dans le sermon." },
      {
        label: "Questions de suivi",
        body: "Continuez à poser des questions comme dans une vraie conversation.",
      },
      {
        label: "Questions populaires",
        body: "Des réponses choisies aux questions doctrinales les plus fréquentes.",
      },
      {
        label: "Partage et sauvegarde",
        body: "Partagez des réponses sur WhatsApp et ailleurs, et enregistrez vos conversations une fois connecté.",
      },
    ],
    isntHeading: "Ce qu’il n’est pas",
    isntPastor: {
      heading: "Un substitut à votre pasteur",
      body: "Il est conçu pour comparer des citations, trouver des références et comprendre la doctrine générale. Les questions spirituelles personnelles ou délicates relèvent de votre pasteur. Il soutient la vie du croyant et ne remplace jamais le berger que Dieu a placé au-dessus d’elle.",
    },
    isntTable: {
      heading: "Un remplacement de The Table",
      body: "Ce n’est pas un lecteur de l’audio ou du texte des sermons. Il vous aide à trouver le bon sermon et la bonne citation, puis vous renvoie à la source pour lire le sermon en entier.",
      linkLabel: "Ouvrir l’application The Table",
    },
    aheadHeading: "Ce qui vient",
    aheadIntro:
      "Le but est d’être le pont entre ce que l’on cherche en ligne et les bandes et livres des sermons eux-mêmes, l’endroit où mène la question d’un chercheur et d’où il est guidé vers les bons sermons.",
    roadmap: [
      {
        label: "Plus de langues",
        body: "À partir de l’anglais, de l’espagnol et du français, pour que davantage de personnes puissent lire le Message dans leur propre langue.",
      },
      {
        label: "Un premier résultat digne de confiance",
        body: "Quand quelqu’un cherche en ligne au sujet du Message de Frère Branham, la première réponse qu’il rencontre doit être fondée, scripturaire et reliée aux sermons.",
      },
      {
        label: "Plus de plateformes",
        body: "Y compris le mobile, pour que l’outil soit disponible partout où l’on étudie.",
      },
    ],
    foundation:
      "Avec le temps, Branham Sermons Assistant fera partie de la Branham Sermons Foundation, au sein d’une œuvre plus large au service des croyants comme des chercheurs.",
    contactHeading: "Contact",
    contactBody:
      "Nous accueillons les remarques et suggestions de ceux qui découvrent le Message comme de ceux qui étudient les sermons depuis longtemps.",
    ctaChat: "Posez votre première question",
    ctaFaq: "Voir les questions populaires",
    ctaExample: "Qu’a enseigné Frère Branham sur les Sept Sceaux ?",
  },
};

export function aboutHref(lang: string): string {
  return lang === "es" || lang === "fr" ? `/${lang}/about` : "/about";
}
