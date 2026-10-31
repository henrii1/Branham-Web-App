/**
 * Christianity Seen in Nature is a series: its groups are parts and every
 * question builds on the one before, so it is read in order — groups in
 * creation order, questions in creation order within each, numbered
 * continuously. Reading progress: seriesProgress.ts (client only).
 */

import type { FaqListItem, FaqSection } from "./groups";

type Lang = "en" | "es" | "fr";

export interface SeriesEntry {
  slug: string;
  question: string;
  /** 1-based, continuous across parts. */
  number: number;
  /** 1-based part (group) number. */
  part: number;
}

/** Where a question sits in the series, for its own page. */
export interface SeriesPosition {
  number: number;
  total: number;
  part: number;
  partName: string;
  first: { slug: string; question: string };
  prev: { slug: string; question: string } | null;
  next: { slug: string; question: string } | null;
}

/** The series' own page (`/faq/nature`, `/es/faq/nature`, `/fr/faq/nature`). */
export const seriesPagePath = (language: string) => (language === "en" ? "/faq/nature" : `/${language}/faq/nature`);
export const SERIES_PAGE_LANG_HREFS = { en: seriesPagePath("en"), es: seriesPagePath("es"), fr: seriesPagePath("fr") };

export function seriesOf<T extends FaqListItem>(sections: FaqSection<T>[]): SeriesEntry[] {
  let n = 0;
  return sections.flatMap((s, i) => s.items.map((item) => ({ slug: item.slug, question: item.question, number: ++n, part: i + 1 })));
}

export const SERIES_COPY: Record<
  Lang,
  {
    intro: string;
    start: string;
    continueAt: (n: number) => string;
    again: string;
    part: (n: number) => string;
    position: (part: number, n: number, total: number) => string;
    buildsOn: string;
    startAtOne: string;
    previous: string;
    next: string;
    end: string;
    read: string;
    show: (parts: number, questions: number) => string;
    hide: string;
    /** The series page: intro, links, share, metadata. */
    pageIntro: (parts: number, questions: number) => string;
    allQuestions: string;
    openPage: string;
    share: string;
    copied: string;
    askQuestion: string;
    metaDescription: string;
    /** Under the title on the link-preview image. */
    ogSubtitle: (parts: number) => string;
  }
> = {
  en: {
    intro: "A series. Read it in order: each answer builds on the one before.",
    start: "Start from the beginning",
    continueAt: (n) => `Continue with question ${n}`,
    again: "Read it again from the beginning",
    part: (n) => `Part ${n}`,
    position: (p, n, t) => `Part ${p}, question ${n} of ${t}`,
    buildsOn: "This answer builds on the earlier ones.",
    startAtOne: "Start from question 1",
    previous: "Previous",
    next: "Next in the series",
    end: "You’ve reached the end of the series.",
    read: "Read",
    show: (p, q) => `Show the series: ${p} part${p === 1 ? "" : "s"}, ${q} questions`,
    hide: "Hide the series",
    pageIntro: (p, q) => `What creation shows us about God, in ${p} part${p === 1 ? "" : "s"} and ${q} questions. Read it in order: each answer builds on the one before.`,
    allQuestions: "All questions",
    openPage: "Open the series page",
    share: "Share the series",
    copied: "Link copied",
    askQuestion: "Ask a question",
    metaDescription: "What creation shows us about God: a series read in order, each answer building on the one before.",
    ogSubtitle: (p) => `A series in ${p} part${p === 1 ? "" : "s"}, read in order`,
  },
  es: {
    intro: "Una serie. Léala en orden: cada respuesta se apoya en la anterior.",
    start: "Empezar desde el principio",
    continueAt: (n) => `Continuar con la pregunta ${n}`,
    again: "Leerla de nuevo desde el principio",
    part: (n) => `Parte ${n}`,
    position: (p, n, t) => `Parte ${p}, pregunta ${n} de ${t}`,
    buildsOn: "Esta respuesta se apoya en las anteriores.",
    startAtOne: "Empezar por la pregunta 1",
    previous: "Anterior",
    next: "Siguiente en la serie",
    end: "Ha llegado al final de la serie.",
    read: "Leída",
    show: (p, q) => `Ver la serie: ${p} parte${p === 1 ? "" : "s"}, ${q} preguntas`,
    hide: "Ocultar la serie",
    pageIntro: (p, q) => `Lo que la creación nos muestra de Dios, en ${p} parte${p === 1 ? "" : "s"} y ${q} preguntas. Léala en orden: cada respuesta se apoya en la anterior.`,
    allQuestions: "Todas las preguntas",
    openPage: "Abrir la página de la serie",
    share: "Compartir la serie",
    copied: "Enlace copiado",
    askQuestion: "Hacer una pregunta",
    metaDescription: "Lo que la creación nos muestra de Dios: una serie para leer en orden, cada respuesta apoyada en la anterior.",
    ogSubtitle: (p) => `Una serie en ${p} parte${p === 1 ? "" : "s"}, para leer en orden`,
  },
  fr: {
    intro: "Une série. Lisez-la dans l’ordre : chaque réponse s’appuie sur la précédente.",
    start: "Commencer au début",
    continueAt: (n) => `Reprendre à la question ${n}`,
    again: "La relire depuis le début",
    part: (n) => `Partie ${n}`,
    position: (p, n, t) => `Partie ${p}, question ${n} sur ${t}`,
    buildsOn: "Cette réponse s’appuie sur les précédentes.",
    startAtOne: "Commencer à la question 1",
    previous: "Précédente",
    next: "Suivante dans la série",
    end: "Vous êtes arrivé à la fin de la série.",
    read: "Lue",
    show: (p, q) => `Voir la série : ${p} partie${p === 1 ? "" : "s"}, ${q} questions`,
    hide: "Masquer la série",
    pageIntro: (p, q) => `Ce que la création nous montre de Dieu, en ${p} partie${p === 1 ? "" : "s"} et ${q} questions. Lisez-la dans l’ordre : chaque réponse s’appuie sur la précédente.`,
    allQuestions: "Toutes les questions",
    openPage: "Ouvrir la page de la série",
    share: "Partager la série",
    copied: "Lien copié",
    askQuestion: "Poser une question",
    metaDescription: "Ce que la création nous montre de Dieu : une série à lire dans l’ordre, chaque réponse s’appuyant sur la précédente.",
    ogSubtitle: (p) => `Une série en ${p} partie${p === 1 ? "" : "s"}, à lire dans l’ordre`,
  },
};

export function seriesCopy(language: string) {
  return SERIES_COPY[language === "es" || language === "fr" ? language : "en"];
}
