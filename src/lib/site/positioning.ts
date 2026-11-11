/**
 * How the site describes itself, everywhere: first to anyone whatever they
 * believe (the nature series), then to Christians studying the Bible, then
 * to people looking into William Branham's sermons. `short` is the tagline
 * (links page, link-preview image); `medium` fits Google's ~155-character
 * description. The long form is the About page lead.
 */
export const POSITIONING = {
  en: {
    short: "See God in creation. Study the Bible. Search the sermons.",
    medium:
      "Explore what creation shows about God, study the Bible with answers drawn from Scripture, and search the sermons of William Branham. Every answer is cited.",
  },
  es: {
    short: "Vea a Dios en la creación. Estudie la Biblia. Busque en los sermones.",
    medium:
      "Descubra lo que la creación muestra acerca de Dios, estudie la Biblia con respuestas tomadas de las Escrituras y busque en los sermones de William Branham. Todo citado.",
  },
  fr: {
    short: "Voyez Dieu dans la création. Étudiez la Bible. Cherchez dans les sermons.",
    medium:
      "Découvrez ce que la création montre de Dieu, étudiez la Bible avec des réponses tirées des Écritures et cherchez dans les sermons de William Branham. Tout est cité.",
  },
} as const;

/** The site's page title (home and chat). */
export const SITE_TITLE = "BranhamSermons.ai: Explore Faith, Study the Bible, Search the Sermons";
