/** The one-minute site tour (public/tour, made with reels_dir/site_tour): its copy and files. */
export type TourLang = "en" | "fr" | "es";

export const TOUR_COPY: Record<TourLang, { label: string; length: string; note: string; close: string }> = {
  en: { label: "How the site works", length: "1 min", note: "A one-minute tour", close: "Close the tour" },
  fr: { label: "Comment fonctionne le site", length: "1 min", note: "Une visite d’une minute", close: "Fermer la visite" },
  es: { label: "Cómo funciona el sitio", length: "1 min", note: "Un recorrido de un minuto", close: "Cerrar el recorrido" },
};

export const tourPoster = (lang: TourLang, device: "desk" | "phone" = "desk") => `/tour/tour-${lang}-${device}.jpg`;
