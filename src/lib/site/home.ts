/**
 * Text for the home page (/, /fr, /es) and the shared site header and menu.
 * The page reads in the site's order: people who don't believe (the nature
 * series), believers who want to grow (Bible questions, Family Altar, the
 * WhatsApp channel; Bible search kept small, since ready answers are
 * instant), then the sermon search. Doctrinal questions are never shown
 * here. Spanish uses "usted".
 */

import type { SiteLang } from "./siteLanguage";

export interface SiteNavCopy {
  nature: string;
  natureNote: (n: number) => string;
  bibleQuestions: string;
  bibleQuestionsNote: (n: number) => string;
  altar: string;
  altarNote: string;
  videos: string;
  videosNote: string;
  about: string;
  ask: string;
  askBible: string;
  askBibleNote: string;
  askSermons: string;
  askSermonsNote: string;
  menu: string;
  close: string;
  exploreFaith: string;
  growInWord: string;
  theSermons: string;
  channelButton: string;
  channelNote: string;
  signIn: string;
  yourChats: string;
  contact: string;
  home: string;
}

export interface HomeCopy {
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroLede: string;
  heroStart: string;
  heroAll: (n: number) => string;
  firstQuestionLabel: string;
  seriesTitle: string;
  seriesIntro: (parts: number) => string;
  partLabel: (n: number) => string;
  videosTitle: string;
  videosIntro: string;
  videosMore: string;
  videosEmptyTitle: string;
  videosEmptyBody: string;
  videosEmptyButton: string;
  growTitle: string;
  growIntro: string;
  bibleTitle: string;
  bibleMeta: (n: number) => string;
  bibleBrowse: string;
  bibleCantFind: string;
  askBible: string;
  altarLabel: string;
  altarOpen: string;
  altarPreparing: string;
  channelTitle: string;
  channelBody: string;
  channelButton: string;
  sermonsTitle: string;
  sermonsBody: string;
  sermonsButton: string;
  photoCredit: string;
}

export const SITE_NAV: Record<SiteLang, SiteNavCopy> = {
  en: {
    nature: "Christianity Seen in Nature",
    natureNote: (n) => `What creation shows about God, in ${n} questions`,
    bibleQuestions: "Bible Questions",
    bibleQuestionsNote: (n) => `${n} questions, answered from Scripture`,
    altar: "Family Altar",
    altarNote: "Today’s verse and devotion",
    videos: "Videos",
    videosNote: "Our films on YouTube",
    about: "About",
    ask: "Ask",
    askBible: "Ask the Bible",
    askBibleNote: "Ask your own question",
    askSermons: "Search the sermons",
    askSermonsNote: "William Branham’s sermons, every quote cited",
    menu: "Menu",
    close: "Close",
    exploreFaith: "Explore faith",
    growInWord: "Grow in the Word",
    theSermons: "The sermons",
    channelButton: "Join the WhatsApp channel",
    channelNote: "Daily Christian growth, and posts on why Christianity",
    signIn: "Sign in",
    yourChats: "Your chats",
    contact: "Contact",
    home: "Home",
  },
  fr: {
    nature: "Le christianisme vu dans la nature",
    natureNote: (n) => `Ce que la création montre de Dieu, en ${n} questions`,
    bibleQuestions: "Questions bibliques",
    bibleQuestionsNote: (n) => `${n} questions, avec des réponses tirées des Écritures`,
    altar: "Autel familial",
    altarNote: "Le verset et la méditation du jour",
    videos: "Vidéos",
    videosNote: "Nos films sur YouTube",
    about: "À propos",
    ask: "Demander",
    askBible: "Interroger la Bible",
    askBibleNote: "Posez votre propre question",
    askSermons: "Rechercher dans les sermons",
    askSermonsNote: "Les sermons de William Branham, chaque citation indiquée",
    menu: "Menu",
    close: "Fermer",
    exploreFaith: "Découvrir la foi",
    growInWord: "Grandir dans la Parole",
    theSermons: "Les sermons",
    channelButton: "Rejoindre la chaîne WhatsApp",
    channelNote: "Grandir chaque jour dans la foi, et des publications sur le pourquoi du christianisme",
    signIn: "Se connecter",
    yourChats: "Vos discussions",
    contact: "Contact",
    home: "Accueil",
  },
  es: {
    nature: "El cristianismo visto en la naturaleza",
    natureNote: (n) => `Lo que la creación muestra acerca de Dios, en ${n} preguntas`,
    bibleQuestions: "Preguntas bíblicas",
    bibleQuestionsNote: (n) => `${n} preguntas, respondidas con las Escrituras`,
    altar: "Altar Familiar",
    altarNote: "El versículo y el devocional de hoy",
    videos: "Videos",
    videosNote: "Nuestros videos en YouTube",
    about: "Acerca de",
    ask: "Preguntar",
    askBible: "Preguntar a la Biblia",
    askBibleNote: "Haga su propia pregunta",
    askSermons: "Buscar en los sermones",
    askSermonsNote: "Los sermones de William Branham, con cada cita indicada",
    menu: "Menú",
    close: "Cerrar",
    exploreFaith: "Conocer la fe",
    growInWord: "Crecer en la Palabra",
    theSermons: "Los sermones",
    channelButton: "Unirse al canal de WhatsApp",
    channelNote: "Crecimiento cristiano diario y publicaciones sobre el porqué del cristianismo",
    signIn: "Iniciar sesión",
    yourChats: "Sus conversaciones",
    contact: "Contacto",
    home: "Inicio",
  },
};

export const HOME_COPY: Record<SiteLang, HomeCopy> = {
  en: {
    metaTitle: "BranhamSermons.ai: Is Someone Behind All of This?",
    metaDescription:
      "See what creation shows about God, one honest question at a time. Grow with Bible answers and a daily devotion, and search the sermons of William Branham.",
    heroTitle: "Is someone behind all of this?",
    heroLede:
      "The sun rises on time. Seeds know what to become. Every people on earth has looked up and wondered. Walk through what nature shows about God, one honest question at a time. No belief needed to start.",
    heroStart: "Start with question 1",
    heroAll: (n) => `See all ${n} questions`,
    firstQuestionLabel: "Question 1",
    seriesTitle: "Christianity Seen in Nature",
    seriesIntro: (parts) => `${parts} short parts, read in order. It starts with the world you can see and ends with the One who made it.`,
    partLabel: (n) => `Part ${n}`,
    videosTitle: "Stories from creation",
    videosIntro: "Short films on what nature shows about God. A seed that dies to bring a harvest, a sun that never fails to rise, a lost sheep someone goes looking for: creation keeps pointing to its Creator.",
    videosMore: "More on YouTube",
    videosEmptyTitle: "Our first films are on their way",
    videosEmptyBody: "Subscribe on YouTube to see them as soon as they’re out.",
    videosEmptyButton: "Subscribe on YouTube",
    growTitle: "Already a believer? Grow every day.",
    growIntro: "Clear answers from Scripture, a short devotion each morning, and a community to walk with.",
    bibleTitle: "Bible Questions Answered",
    bibleMeta: (n) => `${n} questions, answered from Scripture and ready to read.`,
    bibleBrowse: "Browse all Bible questions",
    bibleCantFind: "Can’t find yours?",
    askBible: "Ask the Bible",
    altarLabel: "Today’s Family Altar",
    altarOpen: "Read today’s devotion",
    altarPreparing: "Today’s devotion is being prepared.",
    channelTitle: "Grow with us on WhatsApp",
    channelBody: "Daily Christian growth: the Family Altar each morning, new answers, and posts on why Christianity. It’s also where to reach us.",
    channelButton: "Join the channel",
    sermonsTitle: "Searching William Branham’s sermons?",
    sermonsBody: "Ask a question and get an answer drawn from his sermons, with every quote cited to the sermon and paragraph.",
    sermonsButton: "Search the sermons",
    photoCredit: "Night sky photo: Giles Laurent, CC BY-SA 4.0",
  },
  fr: {
    metaTitle: "BranhamSermons.ai : quelqu’un est-il derrière tout cela ?",
    metaDescription:
      "Découvrez ce que la création montre de Dieu, une question honnête à la fois. Grandissez avec des réponses bibliques et une méditation quotidienne, et recherchez dans les sermons de William Branham.",
    heroTitle: "Quelqu’un est-il derrière tout cela ?",
    heroLede:
      "Le soleil se lève à l’heure. La graine sait ce qu’elle doit devenir. Tous les peuples de la terre ont levé les yeux et se sont posé la question. Parcourez ce que la nature montre de Dieu, une question honnête à la fois. Pas besoin de croire pour commencer.",
    heroStart: "Commencer par la question 1",
    heroAll: (n) => `Voir les ${n} questions`,
    firstQuestionLabel: "Question 1",
    seriesTitle: "Le christianisme vu dans la nature",
    seriesIntro: (parts) => `${parts} courtes parties, à lire dans l’ordre. Elles partent du monde que vous voyez et mènent à Celui qui l’a fait.`,
    partLabel: (n) => `Partie ${n}`,
    videosTitle: "Histoires de la création",
    videosIntro: "De courts films sur ce que la nature montre de Dieu. Une graine qui meurt pour donner une moisson, un soleil qui ne manque jamais de se lever, une brebis perdue que quelqu’un part chercher : la création ne cesse de désigner son Créateur.",
    videosMore: "Plus sur YouTube",
    videosEmptyTitle: "Nos premiers films arrivent bientôt",
    videosEmptyBody: "Abonnez-vous sur YouTube pour les voir dès leur sortie.",
    videosEmptyButton: "S’abonner sur YouTube",
    growTitle: "Déjà croyant ? Grandissez chaque jour.",
    growIntro: "Des réponses claires tirées des Écritures, une courte méditation chaque matin et une communauté pour avancer ensemble.",
    bibleTitle: "Questions bibliques",
    bibleMeta: (n) => `${n} questions, avec des réponses tirées des Écritures, prêtes à lire.`,
    bibleBrowse: "Voir toutes les questions bibliques",
    bibleCantFind: "Vous ne trouvez pas la vôtre ?",
    askBible: "Interroger la Bible",
    altarLabel: "L’Autel familial du jour",
    altarOpen: "Lire la méditation du jour",
    altarPreparing: "La méditation du jour est en préparation.",
    channelTitle: "Grandissez avec nous sur WhatsApp",
    channelBody: "Grandir chaque jour dans la foi : l’Autel familial chaque matin, de nouvelles réponses et des publications sur le pourquoi du christianisme. C’est aussi là que vous pouvez nous joindre.",
    channelButton: "Rejoindre la chaîne",
    sermonsTitle: "Vous cherchez dans les sermons de William Branham ?",
    sermonsBody: "Posez une question et recevez une réponse tirée de ses sermons, chaque citation indiquée avec le sermon et le paragraphe.",
    sermonsButton: "Rechercher dans les sermons",
    photoCredit: "Photo du ciel nocturne : Giles Laurent, CC BY-SA 4.0",
  },
  es: {
    metaTitle: "BranhamSermons.ai: ¿Hay alguien detrás de todo esto?",
    metaDescription:
      "Vea lo que la creación muestra acerca de Dios, una pregunta sincera a la vez. Crezca con respuestas bíblicas y un devocional diario, y busque en los sermones de William Branham.",
    heroTitle: "¿Hay alguien detrás de todo esto?",
    heroLede:
      "El sol sale a su hora. La semilla sabe en qué convertirse. Todos los pueblos de la tierra han mirado al cielo y se han preguntado. Recorra lo que la naturaleza muestra acerca de Dios, una pregunta sincera a la vez. No necesita creer para empezar.",
    heroStart: "Empezar por la pregunta 1",
    heroAll: (n) => `Ver las ${n} preguntas`,
    firstQuestionLabel: "Pregunta 1",
    seriesTitle: "El cristianismo visto en la naturaleza",
    seriesIntro: (parts) => `${parts} partes breves, para leer en orden. Comienzan con el mundo que usted ve y terminan con Aquel que lo hizo.`,
    partLabel: (n) => `Parte ${n}`,
    videosTitle: "Historias de la creación",
    videosIntro: "Videos breves sobre lo que la naturaleza muestra acerca de Dios. Una semilla que muere para dar una cosecha, un sol que nunca deja de salir, una oveja perdida que alguien sale a buscar: la creación no deja de señalar a su Creador.",
    videosMore: "Más en YouTube",
    videosEmptyTitle: "Nuestros primeros videos vienen pronto",
    videosEmptyBody: "Suscríbase en YouTube para verlos en cuanto salgan.",
    videosEmptyButton: "Suscribirse en YouTube",
    growTitle: "¿Ya es creyente? Crezca cada día.",
    growIntro: "Respuestas claras de las Escrituras, un breve devocional cada mañana y una comunidad con quien caminar.",
    bibleTitle: "Preguntas bíblicas respondidas",
    bibleMeta: (n) => `${n} preguntas, respondidas con las Escrituras y listas para leer.`,
    bibleBrowse: "Ver todas las preguntas bíblicas",
    bibleCantFind: "¿No encuentra la suya?",
    askBible: "Preguntar a la Biblia",
    altarLabel: "Altar Familiar de hoy",
    altarOpen: "Leer el devocional de hoy",
    altarPreparing: "El devocional de hoy se está preparando.",
    channelTitle: "Crezca con nosotros en WhatsApp",
    channelBody: "Crecimiento cristiano diario: el Altar Familiar cada mañana, nuevas respuestas y publicaciones sobre el porqué del cristianismo. También es donde puede escribirnos.",
    channelButton: "Unirse al canal",
    sermonsTitle: "¿Busca en los sermones de William Branham?",
    sermonsBody: "Haga una pregunta y reciba una respuesta tomada de sus sermones, con cada cita indicada por sermón y párrafo.",
    sermonsButton: "Buscar en los sermones",
    photoCredit: "Foto del cielo nocturno: Giles Laurent, CC BY-SA 4.0",
  },
};

/** Topics shown as chips on the home page (Bible group names in English, matched case-insensitively). */
export const HOME_TOPIC_GROUPS = [
  "Salvation & the New Birth",
  "Prayer & Faith",
  "Growing as a Christian",
  "The Holy Spirit",
  "Family & Raising Children",
  "Life After Death",
];

/**
 * The home page and the Bible new-chat screen feature the first question of
 * each of these groups (English names): everyday growth questions. The
 * Message-specific topics stay on the full list, not the front door.
 */
export const HOME_FEATURED_GROUPS = [
  "Salvation & the New Birth",
  "Prayer & Faith",
  "Fear, Doubt & Temptation",
  "Trials, Suffering & Patience",
];

/** Chat / FAQ paths. */
export const chatHref = (mode: "bible" | "sermons") => `/chat?mode=${mode}`;
export const bibleQuestionsHref = (lang: string) => (lang === "es" || lang === "fr" ? `/${lang}/faq/bible` : "/faq/bible");
