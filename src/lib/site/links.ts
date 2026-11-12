/**
 * Copy for the links page (/links, /es/links, /fr/links): the address in the
 * social media bios, in place of Linktree. Paths follow the site's order:
 * the nature series for anyone, then the Bible, then the sermons. Spanish
 * uses "usted".
 */

import { POSITIONING } from "./positioning";

export type LinksLang = "en" | "es" | "fr";

export interface LinksCopy {
  metaTitle: string;
  tagline: string;
  channelButton: string;
  channelNote: string;
  todayLabel: string;
  openDevotion: string;
  preparing: string;
  natureTitle: string;
  natureNote: (questions: number) => string;
  bibleTitle: string;
  bibleNote: string;
  faqTitle: string;
  faqNote: string;
  sermonsTitle: string;
  sermonsNote: string;
  followUs: string;
  about: string;
}

export const LINKS_COPY: Record<LinksLang, LinksCopy> = {
  en: {
    metaTitle: "BranhamSermons.ai: links",
    tagline: POSITIONING.en.short,
    channelButton: "Join the WhatsApp channel",
    channelNote: "Daily Christian growth, and posts on why Christianity",
    todayLabel: "Today’s Family Altar",
    openDevotion: "Open today’s devotion",
    preparing: "Today’s devotion is being prepared.",
    natureTitle: "Christianity Seen in Nature",
    natureNote: (n) => `What creation shows about God, in ${n} questions`,
    bibleTitle: "Ask the Bible",
    bibleNote: "Get answers straight from Scripture",
    faqTitle: "Bible Questions Answered",
    faqNote: "Clear, Scripture-based answers to questions people often ask",
    sermonsTitle: "Ask the Sermons",
    sermonsNote: "Get answers from Brother Branham’s sermons, every quote cited",
    followUs: "Follow us",
    about: "About BranhamSermons.ai",
  },
  es: {
    metaTitle: "BranhamSermons.ai: enlaces",
    tagline: POSITIONING.es.short,
    channelButton: "Unirse al canal de WhatsApp",
    channelNote: "Crecimiento cristiano diario y publicaciones sobre el porqué del cristianismo",
    todayLabel: "Altar Familiar de hoy",
    openDevotion: "Abrir el devocional de hoy",
    preparing: "El devocional de hoy se está preparando.",
    natureTitle: "El cristianismo visto en la naturaleza",
    natureNote: (n) => `Lo que la creación muestra acerca de Dios, en ${n} preguntas`,
    bibleTitle: "Preguntar a la Biblia",
    bibleNote: "Reciba respuestas tomadas directamente de las Escrituras",
    faqTitle: "Preguntas bíblicas respondidas",
    faqNote: "Respuestas claras, basadas en las Escrituras, a preguntas frecuentes",
    sermonsTitle: "Preguntar a los sermones",
    sermonsNote: "Respuestas de los sermones del Hermano Branham, con cada cita indicada",
    followUs: "Síganos",
    about: "Acerca de BranhamSermons.ai",
  },
  fr: {
    metaTitle: "BranhamSermons.ai : liens",
    tagline: POSITIONING.fr.short,
    channelButton: "Rejoindre la chaîne WhatsApp",
    channelNote: "Grandir chaque jour dans la foi, et des publications sur le pourquoi du christianisme",
    todayLabel: "L’Autel familial du jour",
    openDevotion: "Ouvrir la méditation du jour",
    preparing: "La méditation du jour est en préparation.",
    natureTitle: "Le christianisme vu dans la nature",
    natureNote: (n) => `Ce que la création montre de Dieu, en ${n} questions`,
    bibleTitle: "Interroger la Bible",
    bibleNote: "Des réponses tirées directement des Écritures",
    faqTitle: "Questions bibliques",
    faqNote: "Des réponses claires, fondées sur les Écritures, aux questions qu’on se pose souvent",
    sermonsTitle: "Interroger les sermons",
    sermonsNote: "Des réponses tirées des sermons de Frère Branham, chaque citation indiquée",
    followUs: "Suivez-nous",
    about: "À propos de BranhamSermons.ai",
  },
};

export function linksHref(lang: string): string {
  return lang === "es" || lang === "fr" ? `/${lang}/links` : "/links";
}
