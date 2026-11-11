/**
 * Copy for the /about page in every supported language.
 *
 * Positioning, in this order: an evangelism tool for anyone whatever they
 * believe (Christianity Seen in Nature), a place to study Scripture (Bible
 * search, Questions of Faith, Family Altar), and a search of William
 * Branham's sermons. The same three-part message is used across the site
 * (lib/site/positioning.ts). Spanish uses "usted".
 *
 * The example quote in each language is the real sermon text for HEBREWS,
 * CHAPTER ONE (57-0821) ¶104, as returned by the API's /api/reference
 * endpoint for that language — not a translation of the English — so the
 * citation pill opens a matching passage.
 *
 * Adding a language: add an entry here (the AboutLang union forces every
 * field), then add its route params and sitemap entry.
 */

export type AboutLang = "en" | "es" | "fr";

export const ABOUT_LANGS: AboutLang[] = ["en", "es", "fr"];

/** One way into the site, for one audience. */
export interface AboutPath {
  label: string;
  body: string;
  links: { label: string; href: string }[];
}

export interface AboutContent {
  metaTitle: string;
  metaDescription: string;
  askQuestion: string;
  title: string;
  lead: string;
  availableIn: string;
  pathsHeading: string;
  paths: AboutPath[];
  trustHeading: string;
  principle: string;
  example: {
    question: string;
    quote: string;
    citation: string;
    evidenceLabel: string;
    caption: string;
  };
  isntHeading: string;
  isntChurch: { heading: string; body: string };
  isntTable: { heading: string; body: string; linkLabel: string };
  connectHeading: string;
  connectBody: string;
  connectButton: string;
  emailLead: string;
}

export const ABOUT_CONTENT: Record<AboutLang, AboutContent> = {
  en: {
    metaTitle: "About BranhamSermons.ai",
    metaDescription:
      "Explore what creation shows about God, study the Bible with answers drawn from Scripture, and search the sermons of William Branham. Every answer is cited.",
    askQuestion: "Ask a question",
    title: "About BranhamSermons.ai",
    lead:
      "BranhamSermons.ai (also known as Branham Sermons Assistant) is a free place to explore faith, study the Bible and search the sermons of William Branham. Whatever you believe, start with Christianity Seen in Nature, a series that looks at what creation shows about God. If you follow Christ, ask anything about the Bible and get answers that let Scripture interpret Scripture. And if you want to know what Brother Branham actually preached, search his sermons in your own words. Every answer shows the verses or quotes it rests on, so you can check it for yourself.",
    availableIn: "Available in",
    pathsHeading: "Where to start",
    paths: [
      {
        label: "Exploring faith",
        body: "Whatever you believe, Christianity Seen in Nature looks at what creation shows about God, one question at a time. It starts from nature, not from the Bible.",
        links: [{ label: "Start the series", href: "/faq/nature" }],
      },
      {
        label: "Studying the Bible",
        body: "Ask about any passage or subject and get answers that let Scripture interpret Scripture. Browse Questions of Faith, and open the Family Altar each day for a short devotion to share at home.",
        links: [
          { label: "Ask the Bible", href: "/chat?mode=bible" },
          { label: "Questions of Faith", href: "/faq" },
          { label: "Family Altar", href: "/altar" },
        ],
      },
      {
        label: "Finding out about Brother Branham",
        body: "Sermon search shows what he actually said, quoted with the sermon’s date and paragraph, instead of second-hand summaries.",
        links: [{ label: "Search the sermons", href: "/chat?mode=sermons" }],
      },
    ],
    trustHeading: "Nothing to take on trust",
    principle: "Every answer shows the verses or sermon quotes it rests on.",
    example: {
      question: "Where did he say God spoke by the prophets, but now through His Son?",
      quote:
        "In that day, He spoke by the prophets, but this day through His Son. That was the word of a prophet, there. This is the Word of the Son, today.",
      citation: "HEBREWS, CHAPTER ONE — 57-0821: ¶104",
      evidenceLabel: "Evidence",
      caption: "Tap the citation to read the exact paragraph it points to.",
    },
    isntHeading: "What it isn’t",
    isntChurch: {
      heading: "A church or a pastor",
      body: "For personal or spiritual matters, talk to a pastor or someone you trust. If you’re looking for a church, write to us and we’ll help you find one.",
    },
    isntTable: {
      heading: "A replacement for the full sermons",
      body: "Every sermon quote points to the Table, where you can read or listen to the whole sermon.",
      linkLabel: "Open the Table app",
    },
    connectHeading: "Stay connected",
    connectBody: "Our WhatsApp channel shares the daily Family Altar and new answers, and it’s where to reach us.",
    connectButton: "Join the WhatsApp channel",
    emailLead: "Or email",
  },

  es: {
    metaTitle: "Acerca de BranhamSermons.ai",
    metaDescription:
      "Descubra lo que la creación muestra acerca de Dios, estudie la Biblia con respuestas tomadas de las Escrituras y busque en los sermones de William Branham. Todo citado.",
    askQuestion: "Hacer una pregunta",
    title: "Acerca de BranhamSermons.ai",
    lead:
      "BranhamSermons.ai (también conocido como Branham Sermons Assistant) es un lugar gratuito para explorar la fe, estudiar la Biblia y buscar en los sermones de William Branham. Sea cual sea su creencia, comience con El cristianismo visto en la naturaleza, una serie que examina lo que la creación muestra acerca de Dios. Si usted sigue a Cristo, pregunte cualquier cosa sobre la Biblia y reciba respuestas que dejan que la Escritura interprete la Escritura. Y si desea saber lo que el Hermano Branham predicó realmente, busque en sus sermones con sus propias palabras. Cada respuesta muestra los versículos o las citas en que se basa, para que usted mismo pueda comprobarla.",
    availableIn: "Disponible en",
    pathsHeading: "Por dónde empezar",
    paths: [
      {
        label: "Explorar la fe",
        body: "Sea cual sea su creencia, El cristianismo visto en la naturaleza examina lo que la creación muestra acerca de Dios, una pregunta a la vez. Parte de la naturaleza, no de la Biblia.",
        links: [{ label: "Comenzar la serie", href: "/es/faq/nature" }],
      },
      {
        label: "Estudiar la Biblia",
        body: "Pregunte sobre cualquier pasaje o tema y reciba respuestas que dejan que la Escritura interprete la Escritura. Vea las Preguntas de fe y abra cada día el Altar Familiar para un breve devocional que compartir en casa.",
        links: [
          { label: "Preguntar a la Biblia", href: "/chat?mode=bible" },
          { label: "Preguntas de fe", href: "/es/faq" },
          { label: "Altar Familiar", href: "/es/altar" },
        ],
      },
      {
        label: "Conocer al Hermano Branham",
        body: "La búsqueda en los sermones muestra lo que él realmente dijo, citado con la fecha y el párrafo del sermón, en lugar de resúmenes de segunda mano.",
        links: [{ label: "Buscar en los sermones", href: "/chat?mode=sermons" }],
      },
    ],
    trustHeading: "Nada que deba creer sin comprobar",
    principle: "Cada respuesta muestra los versículos o las citas de los sermones en que se basa.",
    example: {
      question: "¿Dónde dijo que Dios habló por los profetas, pero ahora a través de Su Hijo?",
      quote:
        "En aquel día, Él habló por los profetas, pero en este día a través de Su Hijo. Eso allá era la palabra de un profeta. Hoy, ésta es la Palabra del Hijo.",
      citation: "HEBREOS, CAPÍTULO UNO — 57-0821: ¶104",
      evidenceLabel: "Evidencia",
      caption: "Toque la cita para leer el párrafo exacto al que se refiere.",
    },
    isntHeading: "Lo que no es",
    isntChurch: {
      heading: "Una iglesia ni un pastor",
      body: "Para asuntos personales o espirituales, hable con un pastor o con alguien de su confianza. Si busca una iglesia, escríbanos y le ayudaremos a encontrar una.",
    },
    isntTable: {
      heading: "Un sustituto de los sermones completos",
      body: "Cada cita de un sermón remite a The Table, donde puede leer o escuchar el sermón completo.",
      linkLabel: "Abrir la aplicación The Table",
    },
    connectHeading: "Manténgase en contacto",
    connectBody: "Nuestro canal de WhatsApp comparte el Altar Familiar de cada día y las nuevas respuestas, y es el lugar para comunicarse con nosotros.",
    connectButton: "Unirse al canal de WhatsApp",
    emailLead: "O escríbanos a",
  },

  fr: {
    metaTitle: "À propos de BranhamSermons.ai",
    metaDescription:
      "Découvrez ce que la création montre de Dieu, étudiez la Bible avec des réponses tirées des Écritures et cherchez dans les sermons de William Branham. Tout est cité.",
    askQuestion: "Poser une question",
    title: "À propos de BranhamSermons.ai",
    lead:
      "BranhamSermons.ai (aussi appelé Branham Sermons Assistant) est un lieu gratuit pour explorer la foi, étudier la Bible et chercher dans les sermons de William Branham. Quelle que soit votre croyance, commencez par Le christianisme vu dans la nature, une série qui examine ce que la création montre de Dieu. Si vous suivez Christ, posez n’importe quelle question sur la Bible et recevez des réponses qui laissent l’Écriture interpréter l’Écriture. Et si vous voulez savoir ce que Frère Branham a réellement prêché, cherchez dans ses sermons avec vos propres mots. Chaque réponse montre les versets ou les citations sur lesquels elle repose, pour que vous puissiez la vérifier vous-même.",
    availableIn: "Disponible en",
    pathsHeading: "Par où commencer",
    paths: [
      {
        label: "Explorer la foi",
        body: "Quelle que soit votre croyance, Le christianisme vu dans la nature examine ce que la création montre de Dieu, une question à la fois. La série part de la nature, pas de la Bible.",
        links: [{ label: "Commencer la série", href: "/fr/faq/nature" }],
      },
      {
        label: "Étudier la Bible",
        body: "Posez une question sur n’importe quel passage ou sujet et recevez des réponses qui laissent l’Écriture interpréter l’Écriture. Parcourez les Questions de foi et ouvrez chaque jour l’Autel familial pour une courte méditation à partager à la maison.",
        links: [
          { label: "Interroger la Bible", href: "/chat?mode=bible" },
          { label: "Questions de foi", href: "/fr/faq" },
          { label: "Autel familial", href: "/fr/altar" },
        ],
      },
      {
        label: "Découvrir Frère Branham",
        body: "La recherche dans les sermons montre ce qu’il a réellement dit, cité avec la date et le paragraphe du sermon, plutôt que des résumés de seconde main.",
        links: [{ label: "Chercher dans les sermons", href: "/chat?mode=sermons" }],
      },
    ],
    trustHeading: "Rien à croire sur parole",
    principle: "Chaque réponse montre les versets ou les citations des sermons sur lesquels elle repose.",
    example: {
      question: "Où a-t-il dit que Dieu a parlé par les prophètes, mais maintenant dans Son Fils ?",
      quote:
        "À cette époque-là Il a parlé par les prophètes, mais à notre époque, dans Son Fils. Là, c’était la parole d’un prophète. Aujourd’hui, c’est la Parole du Fils.",
      citation: "HÉBREUX, CHAPITRE UN — 57-0821: ¶104",
      evidenceLabel: "Preuve",
      caption: "Touchez la citation pour lire le paragraphe exact auquel elle renvoie.",
    },
    isntHeading: "Ce que ce n’est pas",
    isntChurch: {
      heading: "Une église ou un pasteur",
      body: "Pour les questions personnelles ou spirituelles, parlez à un pasteur ou à une personne de confiance. Si vous cherchez une église, écrivez-nous et nous vous aiderons à en trouver une.",
    },
    isntTable: {
      heading: "Un substitut des sermons complets",
      body: "Chaque citation de sermon renvoie à The Table, où vous pouvez lire ou écouter le sermon en entier.",
      linkLabel: "Ouvrir l’application The Table",
    },
    connectHeading: "Restons en contact",
    connectBody: "Notre chaîne WhatsApp partage l’Autel familial de chaque jour et les nouvelles réponses, et c’est là que vous pouvez nous joindre.",
    connectButton: "Rejoindre la chaîne WhatsApp",
    emailLead: "Ou écrivez-nous à",
  },
};

export function aboutHref(lang: string): string {
  return lang === "es" || lang === "fr" ? `/${lang}/about` : "/about";
}
