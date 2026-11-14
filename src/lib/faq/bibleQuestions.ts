/**
 * Copy and metadata for the Bible questions page (/faq/bible, /fr/faq/bible,
 * /es/faq/bible): every Bible FAQ, grouped by topic, searchable. It is the
 * fast way in for new readers, since a ready answer opens instantly and a
 * new Bible search takes 30–45 seconds. Kept out of page.tsx (Next rejects
 * extra page exports). Spanish uses "usted".
 */

import type { Metadata } from "next";
import { bibleQuestionsHref } from "@/lib/site/home";

type Lang = "en" | "es" | "fr";
const SITE_URL = "https://branhamsermons.ai";

export const BIBLE_PAGE_COPY: Record<
  Lang,
  {
    title: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    search: string;
    meta: (questions: number, topics: number) => string;
    all: string;
    count: (n: number) => string;
    more: (n: number) => string;
    less: string;
    noMatch: (q: string) => string;
    askTitle: string;
    askBody: string;
    askButton: string;
  }
> = {
  en: {
    title: "Bible Questions Answered",
    metaTitle: "Bible Questions Answered | BranhamSermons.ai",
    metaDescription: "Real questions Christians ask about salvation, prayer, the Holy Spirit, suffering and more, answered from Scripture. Every answer is ready to read.",
    intro: "Real questions Christians ask, answered from Scripture. Every answer is ready to read now.",
    search: "Find a question",
    meta: (q, t) => `${q} questions in ${t} topics`,
    all: "All",
    count: (n) => (n === 1 ? "1 question" : `${n} questions`),
    more: (n) => `${n} more`,
    less: "Show fewer",
    noMatch: (q) => `No answered question matches “${q}”.`,
    askTitle: "Didn’t find your question?",
    askBody: "Ask the Bible directly. A new answer takes about 30 to 45 seconds.",
    askButton: "Ask the Bible",
  },
  fr: {
    title: "Questions bibliques",
    metaTitle: "Questions bibliques | BranhamSermons.ai",
    metaDescription: "Les vraies questions que se posent les chrétiens sur le salut, la prière, le Saint-Esprit, la souffrance et plus encore, avec des réponses tirées des Écritures, prêtes à lire.",
    intro: "Les vraies questions que se posent les chrétiens, avec des réponses tirées des Écritures. Chaque réponse est prête à lire.",
    search: "Trouver une question",
    meta: (q, t) => `${q} questions dans ${t} thèmes`,
    all: "Tout",
    count: (n) => (n === 1 ? "1 question" : `${n} questions`),
    more: (n) => `${n} de plus`,
    less: "Afficher moins",
    noMatch: (q) => `Aucune question déjà répondue ne correspond à « ${q} ».`,
    askTitle: "Vous ne trouvez pas votre question ?",
    askBody: "Interrogez directement la Bible. Une nouvelle réponse prend environ 30 à 45 secondes.",
    askButton: "Interroger la Bible",
  },
  es: {
    title: "Preguntas bíblicas respondidas",
    metaTitle: "Preguntas bíblicas respondidas | BranhamSermons.ai",
    metaDescription: "Preguntas reales que hacen los cristianos sobre la salvación, la oración, el Espíritu Santo, el sufrimiento y más, respondidas con las Escrituras y listas para leer.",
    intro: "Preguntas reales que hacen los cristianos, respondidas con las Escrituras. Cada respuesta está lista para leer.",
    search: "Buscar una pregunta",
    meta: (q, t) => `${q} preguntas en ${t} temas`,
    all: "Todas",
    count: (n) => (n === 1 ? "1 pregunta" : `${n} preguntas`),
    more: (n) => `${n} más`,
    less: "Mostrar menos",
    noMatch: (q) => `Ninguna pregunta respondida coincide con «${q}».`,
    askTitle: "¿No encontró su pregunta?",
    askBody: "Pregúntele directamente a la Biblia. Una nueva respuesta tarda unos 30 a 45 segundos.",
    askButton: "Preguntar a la Biblia",
  },
};

export function bibleQuestionsMetadata(lang: Lang): Metadata {
  const c = BIBLE_PAGE_COPY[lang];
  const url = `${SITE_URL}${bibleQuestionsHref(lang)}`;
  return {
    title: { absolute: c.metaTitle },
    description: c.metaDescription,
    alternates: {
      canonical: url,
      languages: { en: `${SITE_URL}${bibleQuestionsHref("en")}`, fr: `${SITE_URL}${bibleQuestionsHref("fr")}`, es: `${SITE_URL}${bibleQuestionsHref("es")}` },
    },
    openGraph: { title: c.title, description: c.metaDescription, url, type: "website", siteName: "BranhamSermons.ai", locale: lang },
    twitter: { card: "summary_large_image", title: c.title, description: c.metaDescription },
  };
}
