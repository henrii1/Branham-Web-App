/**
 * Copy for the /about page in every supported language.
 *
 * Positioning, in this order: an evangelism tool for anyone whatever they
 * believe (Christianity Seen in Nature), a place to study Scripture (Bible
 * search, Questions of Faith, Family Altar), and a search of William
 * Branham's sermons. The same three-part message is used across the site
 * (lib/site/positioning.ts). Spanish uses "usted".
 *
 * The example quote in each language is the real sermon text of THE
 * REVELATION OF JESUS CHRIST (60-1204M) ¶200, as returned by the API's
 * /api/reference endpoint for that language — not a translation of the
 * English — so the citation pill opens a matching passage. (The French text
 * carries a stray "LA PAROLE PARLÉE" page header mid-sentence, left out.)
 *
 * Adding a language: add an entry here (the AboutLang union forces every
 * field), then add its route params and sitemap entry.
 */

export type AboutLang = "en" | "es" | "fr";

export const ABOUT_LANGS: AboutLang[] = ["en", "fr", "es"];

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
  /** First sentence of the lead: what the site is (set as the standfirst). */
  leadIntro: string;
  /** The rest: one sentence per audience, then why it can be trusted. */
  lead: string;
  availableIn: string;
  /** Keeps the old name on the page for search ("Branham Sermons Assistant"). */
  alsoKnownAs: string;
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
    leadIntro:
      "BranhamSermons.ai is a free place to explore faith, study the Bible and search the sermons of William Branham.",
    lead:
      "Whatever you believe, start with Christianity Seen in Nature, a series that looks at what creation shows about God. If you follow Christ, ask anything about the Bible and get answers that let Scripture interpret Scripture. And if you want to know what Brother Branham actually preached, search his sermons in your own words. Every answer shows the verses or quotes it rests on, so you can check it for yourself.",
    availableIn: "Available in",
    alsoKnownAs: "Also known as Branham Sermons Assistant",
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
      question: "Did Brother Branham teach that Jesus is God?",
      quote:
        "And He was the Lord of Glory, made manifest. So, He is the Lord Jesus Christ, the God of Glory made manifest among us.",
      citation: "THE REVELATION OF JESUS CHRIST — 60-1204M: ¶200",
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
    connectBody: "Our WhatsApp channel is for daily Christian growth: the Family Altar devotion, new answers, and posts on why Christianity. It’s also where to reach us.",
    connectButton: "Join the WhatsApp channel",
    emailLead: "Or email",
  },

  es: {
    metaTitle: "Acerca de BranhamSermons.ai",
    metaDescription:
      "Descubra lo que la creación muestra acerca de Dios, estudie la Biblia con respuestas tomadas de las Escrituras y busque en los sermones de William Branham. Todo citado.",
    askQuestion: "Hacer una pregunta",
    title: "Acerca de BranhamSermons.ai",
    leadIntro:
      "BranhamSermons.ai es un lugar gratuito para explorar la fe, estudiar la Biblia y buscar en los sermones de William Branham.",
    lead:
      "Sea cual sea su creencia, comience con El cristianismo visto en la naturaleza, una serie que examina lo que la creación muestra acerca de Dios. Si usted sigue a Cristo, pregunte cualquier cosa sobre la Biblia y reciba respuestas que dejan que la Escritura interprete la Escritura. Y si desea saber lo que el Hermano Branham predicó realmente, busque en sus sermones con sus propias palabras. Cada respuesta muestra los versículos o las citas en que se basa, para que usted mismo pueda comprobarla.",
    availableIn: "Disponible en",
    alsoKnownAs: "También conocido como Branham Sermons Assistant",
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
      question: "¿Enseñó el Hermano Branham que Jesús es Dios?",
      quote:
        "Y Él era el Señor de la Gloria, manifestado. Así que, Él es el Señor Jesucristo: el Dios de Gloria manifestado entre nosotros.",
      citation: "LA REVELACIÓN DE JESUCRISTO — 60-1204M: ¶200",
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
    connectBody: "Nuestro canal de WhatsApp es para su crecimiento cristiano diario: el devocional del Altar Familiar, nuevas respuestas y publicaciones sobre el porqué del cristianismo. También es el lugar para comunicarse con nosotros.",
    connectButton: "Unirse al canal de WhatsApp",
    emailLead: "O escríbanos a",
  },

  fr: {
    metaTitle: "À propos de BranhamSermons.ai",
    metaDescription:
      "Découvrez ce que la création montre de Dieu, étudiez la Bible avec des réponses tirées des Écritures et cherchez dans les sermons de William Branham. Tout est cité.",
    askQuestion: "Poser une question",
    title: "À propos de BranhamSermons.ai",
    leadIntro:
      "BranhamSermons.ai est un lieu gratuit pour explorer la foi, étudier la Bible et chercher dans les sermons de William Branham.",
    lead:
      "Quelle que soit votre croyance, commencez par Le christianisme vu dans la nature, une série qui examine ce que la création montre de Dieu. Si vous suivez Christ, posez n’importe quelle question sur la Bible et recevez des réponses qui laissent l’Écriture interpréter l’Écriture. Et si vous voulez savoir ce que Frère Branham a réellement prêché, cherchez dans ses sermons avec vos propres mots. Chaque réponse montre les versets ou les citations sur lesquels elle repose, pour que vous puissiez la vérifier vous-même.",
    availableIn: "Disponible en",
    alsoKnownAs: "Aussi appelé Branham Sermons Assistant",
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
      question: "Frère Branham a-t-il enseigné que Jésus est Dieu ?",
      quote:
        "Et Il était le Seigneur de Gloire manifesté. Donc, Il est le Seigneur Jésus-Christ, le Dieu de Gloire manifesté parmi nous.",
      citation: "LA RÉVÉLATION DE JÉSUS-CHRIST — 60-1204M: ¶200",
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
    connectBody: "Notre chaîne WhatsApp vous aide à grandir chaque jour dans la foi chrétienne : la méditation de l’Autel familial, les nouvelles réponses et des publications sur le pourquoi du christianisme. C’est aussi là que vous pouvez nous joindre.",
    connectButton: "Rejoindre la chaîne WhatsApp",
    emailLead: "Ou écrivez-nous à",
  },
};

export function aboutHref(lang: string): string {
  return lang === "es" || lang === "fr" ? `/${lang}/about` : "/about";
}
