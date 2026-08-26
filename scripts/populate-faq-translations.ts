/**
 * Populates seo_cache with Spanish and French versions of all published EN rows.
 *
 * Each target-language row stores:
 *   - question / robust_query in the target language (hardcoded translations below)
 *   - answer_markdown + rag_context from the API (called with the translated robust_query)
 *
 * Run: npx tsx scripts/populate-faq-translations.ts
 * Reads .env.local automatically. Safe to re-run (idempotent — skips existing rows).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ───────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = value;
}

// ── Config ────────────────────────────────────────────────────────────
const MODEL_API_BASE_URL = process.env.MODEL_API_BASE_URL!;
const CHAT_API_BEARER_KEY = process.env.CHAT_API_BEARER_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!MODEL_API_BASE_URL || !CHAT_API_BEARER_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing required env vars: MODEL_API_BASE_URL, CHAT_API_BEARER_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_LANGUAGES = ["es", "fr"] as const;
type TargetLang = (typeof TARGET_LANGUAGES)[number];

// ── Hardcoded translations ────────────────────────────────────────────
// question: short text displayed on the page
// robust_query: comprehensive query sent to the API to generate the answer

interface LangTexts { question: string; robust_query: string }

const TRANSLATIONS: Record<string, Record<TargetLang, LangTexts>> = {
  "what-did-brother-branham-teach-about-the-serpent-seed": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la semilla de la serpiente?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la semilla de la serpiente en sus sermones. Busca dónde explicó a Eva, la serpiente, Caín, la caída en el Edén y si el pecado original fue sexual. Incluye las principales referencias de sermones y contexto biográfico aclaratorio solo si es necesario.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la semence du serpent?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la semence du serpent dans ses sermons. Cherche où il a expliqué Ève, le serpent, Caïn, la chute dans l'Éden et si le péché originel était sexuel. Inclus les principales références de sermons et tout contexte biographique clarificateur seulement si nécessaire.",
    },
  },
  "what-did-brother-branham-teach-about-the-godhead": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la Deidad?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la Deidad en sus sermones. Busca dónde habló sobre el Padre, el Hijo y el Espíritu Santo, si Dios es uno, si rechazó la Trinidad y cómo explicó el nombre del Señor Jesucristo. Incluye referencias clave de sermones y añade contexto biográfico solo si es necesario.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la Déité?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la Déité dans ses sermons. Cherche où il a parlé du Père, du Fils et du Saint-Esprit, si Dieu est un, s'il a rejeté la Trinité et comment il a expliqué le nom du Seigneur Jésus-Christ. Inclus les références clés de sermons et ajoute du contexte biographique seulement si nécessaire.",
    },
  },
  "how-did-brother-branham-teach-baptism-in-jesus-name": {
    es: {
      question: "¿Cómo enseñó el Hermano Branham el bautismo en el Nombre de Jesús?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el bautismo en agua en sus sermones. Busca dónde explicó el bautismo en el Nombre del Señor Jesucristo, por qué rechazó el bautismo solo con títulos, si era necesario ser rebautizado y cómo usó Hechos 2:38 y Hechos 19. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Comment le Frère Branham a-t-il enseigné le baptême au Nom de Jésus?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur le baptême en eau dans ses sermons. Cherche où il a expliqué le baptême au Nom du Seigneur Jésus-Christ, pourquoi il a rejeté le baptême avec des titres seulement, si le rebaptême était nécessaire et comment il a utilisé Actes 2:38 et Actes 19. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-seven-church-ages": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre las Siete Edades de la Iglesia?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre las Siete Edades de la Iglesia en sus sermones y enseñanzas. Busca las siete edades, los siete mensajeros, el espíritu de cada edad y cómo conectó Apocalipsis 2 y 3 con la historia de la iglesia. Incluye las referencias más claras de sermones y libros.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les Sept Âges de l'Église?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les Sept Âges de l'Église dans ses sermons et enseignements. Cherche les sept âges, les sept messagers, l'esprit de chaque âge et comment il a connecté Apocalypse 2 et 3 à l'histoire de l'église. Inclus les références les plus claires de sermons et de livres.",
    },
  },
  "did-brother-branham-say-he-was-malachi-4": {
    es: {
      question: "¿Dijo el Hermano Branham que él era Malaquías 4?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre Malaquías 4 en sus sermones. Busca dónde habló sobre la venida de Elías antes del gran y terrible día del Señor, volver los corazones y si aplicó esta profecía a su propio ministerio. Incluye las referencias de sermones más fuertes y contexto biográfico solo donde sea necesario.",
    },
    fr: {
      question: "Le Frère Branham a-t-il dit qu'il était Malachie 4?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur Malachie 4 dans ses sermons. Cherche où il a parlé de la venue d'Élie avant le grand et redoutable jour du Seigneur, du retour des cœurs et s'il a appliqué cette prophétie à son propre ministère. Inclus les références de sermons les plus fortes et du contexte biographique seulement où nécessaire.",
    },
  },
  "did-brother-branham-say-he-was-revelation-107": {
    es: {
      question: "¿Dijo el Hermano Branham que él era Apocalipsis 10:7?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre Apocalipsis 10:7 en sus sermones. Busca dónde habló sobre el séptimo ángel, el cumplimiento del misterio de Dios y si conectó esta escritura con su ministerio y mensaje. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Le Frère Branham a-t-il dit qu'il était Apocalypse 10:7?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur Apocalypse 10:7 dans ses sermons. Cherche où il a parlé du septième ange, de l'achèvement du mystère de Dieu et s'il a connecté cette écriture à son ministère et message. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-rapture": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre el arrebatamiento?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el arrebatamiento en sus sermones. Busca dónde explicó a la Novia, el ser arrebatados, el grito, la voz, la trompeta, la preparación y la fe necesaria para la traslación. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur l'enlèvement?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur l'enlèvement dans ses sermons. Cherche où il a expliqué la Fiancée, l'être emporté, le cri, la voix, la trompette, la préparation et la foi nécessaire pour la translation. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-the-bride": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la Novia?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la Novia de Cristo en sus sermones. Busca dónde explicó a los elegidos, la verdadera Iglesia, la separación de las denominaciones y la Novia recibiendo la Palabra para la hora. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la Fiancée?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la Fiancée de Christ dans ses sermons. Cherche où il a expliqué les élus, la vraie Église, la séparation des dénominations et la Fiancée recevant la Parole pour l'heure. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-marriage-and-divorce": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre el matrimonio y el divorcio?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el matrimonio y el divorcio en sus sermones. Busca dónde explicó el divorcio, el nuevo matrimonio, el adulterio y las responsabilidades del marido y la esposa, especialmente en el mensaje Matrimonio y Divorcio y sermones relacionados. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur le mariage et le divorce?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur le mariage et le divorce dans ses sermons. Cherche où il a expliqué le divorce, le remariage, l'adultère et les responsabilités du mari et de la femme, particulièrement dans le message Mariage et Divorce et les sermons connexes. Inclus les principales références de sermons.",
    },
  },
  "can-a-divorced-person-remarry-according-to-brother-branham": {
    es: {
      question: "¿Puede una persona divorciada volver a casarse según el Hermano Branham?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre si una persona divorciada puede volver a casarse. Busca dónde habló sobre excepciones, adulterio, inocencia, nuevo matrimonio para hombres y mujeres y cómo aplicó Mateo 19 y 1 Corintios 7. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Une personne divorcée peut-elle se remarier selon le Frère Branham?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur le fait qu'une personne divorcée peut se remarier. Cherche où il a parlé des exceptions, de l'adultère, de l'innocence, du remariage pour hommes et femmes et comment il a appliqué Matthieu 19 et 1 Corinthiens 7. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-say-is-the-evidence-of-the-holy-ghost": {
    es: {
      question: "¿Qué dijo el Hermano Branham que es la evidencia del Espíritu Santo?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la evidencia del Espíritu Santo en sus sermones. Busca dónde explicó si la evidencia es hablar en lenguas, una vida cambiada, el nuevo nacimiento, recibir la Palabra o la revelación de Cristo. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a dit le Frère Branham est la preuve du Saint-Esprit?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la preuve du Saint-Esprit dans ses sermons. Cherche où il a expliqué si la preuve est parler en langues, une vie transformée, la nouvelle naissance, recevoir la Parole ou la révélation de Christ. Inclus les principales références de sermons.",
    },
  },
  "did-brother-branham-say-tongues-is-the-evidence-of-the-holy-ghost": {
    es: {
      question: "¿Dijo el Hermano Branham que las lenguas son la evidencia del Espíritu Santo?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre hablar en lenguas y la evidencia del Espíritu Santo. Busca dónde corrigió la enseñanza pentecostal sobre las lenguas y explicó cuál es la verdadera evidencia. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Le Frère Branham a-t-il dit que les langues sont la preuve du Saint-Esprit?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur parler en langues et la preuve du Saint-Esprit. Cherche où il a corrigé l'enseignement pentecôtiste sur les langues et a expliqué quelle est la vraie preuve. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-women-preachers": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre las mujeres predicadoras?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre las mujeres predicando en sus sermones. Busca dónde habló sobre mujeres pastoras, mujeres enseñando a hombres, mujeres hablando en la iglesia y el orden de la iglesia. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les femmes prédicatrices?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les femmes qui prêchent dans ses sermons. Cherche où il a parlé des femmes pasteurs, des femmes enseignant aux hommes, des femmes parlant à l'église et de l'ordre de l'église. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-womens-hair-and-dress": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre el cabello y la vestimenta de las mujeres?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el cabello, la vestimenta, la modestia, el maquillaje y la santidad de las mujeres en sus sermones. Busca dónde explicó el cabello largo, las mujeres usando pantalones, la apariencia exterior y cómo estas cosas se relacionan con las Escrituras. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les cheveux et la tenue des femmes?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les cheveux, la tenue vestimentaire, la modestie, le maquillage et la sainteté des femmes dans ses sermons. Cherche où il a expliqué les cheveux longs, les femmes portant des pantalons, l'apparence extérieure et comment ces choses se rapportent aux Écritures. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-predestination": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la predestinación?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la predestinación en sus sermones. Busca dónde explicó la elección, el preconocimiento, la semilla, el Libro de la Vida del Cordero y cómo la Novia fue escogida en Cristo. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la prédestination?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la prédestination dans ses sermons. Cherche où il a expliqué l'élection, la prescience, la semence, le Livre de Vie de l'Agneau et comment la Fiancée a été choisie en Christ. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-mean-by-the-seed-and-the-shuck": {
    es: {
      question: "¿Qué quiso decir el Hermano Branham con la semilla y la cáscara?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la semilla y la cáscara en sus sermones. Busca dónde comparó la Palabra, los sistemas denominacionales y la Novia con la semilla, la cáscara y la vida llegando a la madurez. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'entendait le Frère Branham par la semence et la cosse?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la semence et la cosse dans ses sermons. Cherche où il a comparé la Parole, les systèmes dénominationnels et la Fiancée à la graine, la cosse et la vie arrivant à maturité. Inclus les références de sermons les plus claires.",
    },
  },
  "why-did-brother-branham-preach-against-denomination": {
    es: {
      question: "¿Por qué predicó el Hermano Branham contra las denominaciones?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre las denominaciones. Busca dónde explicó por qué creía que los sistemas denominacionales eran erróneos, cómo difieren de la verdadera Iglesia y cómo la organización puede obstaculizar la Palabra. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Pourquoi le Frère Branham prêchait-il contre les dénominations?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur les dénominations. Cherche où il a expliqué pourquoi il croyait que les systèmes dénominationnels étaient erronés, comment ils diffèrent de la vraie Église et comment l'organisation peut entraver la Parole. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-communion": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la comunión?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la comunión en sus sermones. Busca dónde explicó la Cena del Señor, el examen de uno mismo, participar de manera indigna y cómo los creyentes deben acercarse a la comunión. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la communion?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la communion dans ses sermons. Cherche où il a expliqué la Cène du Seigneur, l'examen de soi-même, participer de manière indigne et comment les croyants doivent s'approcher de la communion. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-mark-of-the-beast": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la marca de la bestia?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la marca de la bestia en sus sermones. Busca dónde explicó la bestia, la imagen, los sistemas denominacionales, la adoración falsa, Roma y el engaño de los últimos tiempos. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur la marque de la bête?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la marque de la bête dans ses sermons. Cherche où il a expliqué la bête, l'image, les systèmes dénominationnels, le faux culte, Rome et la tromperie des derniers temps. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-the-antichrist": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre el anticristo?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el anticristo en sus sermones. Busca dónde explicó el espíritu del anticristo, la iglesia falsa, la unción falsa y cómo el anticristo difiere de Cristo. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur l'antéchrist?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur l'antéchrist dans ses sermons. Cherche où il a expliqué l'esprit de l'antéchrist, la fausse église, la fausse onction et comment l'antéchrist diffère de Christ. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-hell": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre el infierno?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre el infierno en sus sermones. Busca dónde explicó el castigo, el lago de fuego, si el infierno es eterno y si los perdidos son destruidos o atormentados para siempre. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur l'enfer?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur l'enfer dans ses sermons. Cherche où il a expliqué le châtiment, le lac de feu, si l'enfer est éternel et si les perdus sont détruits ou tourmentés pour toujours. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-the-144000": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los 144.000?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre los 144.000 en sus sermones. Busca dónde explicó si son judíos, si son parte de la Novia, cuándo son sellados y cómo encajan en el Apocalipsis. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les 144 000?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les 144 000 dans ses sermons. Cherche où il a expliqué s'ils sont juifs, s'ils font partie de la Fiancée, quand ils sont scellés et comment ils s'inscrivent dans l'Apocalypse. Inclus les références de sermons les plus claires.",
    },
  },
  "was-brother-branham-oneness-or-not": {
    es: {
      question: "¿Era el Hermano Branham Unicidad o no?",
      robust_query: "Muestra en los sermones del Hermano Branham si debe entenderse como Unicidad, anti-Trinitario o algo diferente. Busca dónde explicó un solo Dios, Padre, Hijo y Espíritu Santo, y el bautismo en el Nombre del Señor Jesucristo. Incluye las referencias de sermones más fuertes.",
    },
    fr: {
      question: "Le Frère Branham était-il Unicité ou non?",
      robust_query: "Montre d'après les sermons du Frère Branham s'il devrait être compris comme Unicité, anti-Trinitaire ou quelque chose de différent. Cherche où il a expliqué un seul Dieu, Père, Fils et Saint-Esprit, et le baptême au Nom du Seigneur Jésus-Christ. Inclus les références de sermons les plus fortes.",
    },
  },
  "what-did-brother-branham-teach-about-his-ministry-and-calling": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre su ministerio y llamado?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre su propio ministerio y llamado. Busca dónde habló sobre ser un profeta, el mensajero del tiempo del fin, Malaquías 4, Apocalipsis 10:7, Lucas 17:30 y el mensajero de la edad de la iglesia Laodicea. Incluye referencias clave de sermones y contexto biográfico donde sea necesario.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur son ministère et son appel?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur son propre ministère et appel. Cherche où il a parlé d'être un prophète, le messager de la fin des temps, Malachie 4, Apocalypse 10:7, Luc 17:30 et le messager de l'âge de l'église Laodicée. Inclus les références clés de sermons et du contexte biographique où nécessaire.",
    },
  },
  "what-did-brother-branham-teach-about-the-seven-seals": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los Siete Sellos?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre los Siete Sellos en sus sermones. Busca dónde explicó cada sello, la apertura de los misterios, la relación con Mateo 24 y cómo los sellos se conectan con la Novia en los últimos días. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les Sept Sceaux?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les Sept Sceaux dans ses sermons. Cherche où il a expliqué chaque sceau, l'ouverture des mystères, la relation avec Matthieu 24 et comment les sceaux se connectent à la Fiancée dans les derniers jours. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-seven-thunders": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los Siete Truenos?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre los Siete Truenos en sus sermones. Busca dónde conectó los Siete Truenos con Apocalipsis 10, los Siete Sellos, el Séptimo Sello, los misterios ocultos y la fe para el arrebatamiento. Incluye las referencias de sermones más claras y señala cualquier lugar donde dijo que los Truenos fueron revelados o no escritos. Incluye contexto biográfico solo si es necesario.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les Sept Tonnerres?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les Sept Tonnerres dans ses sermons. Cherche où il a connecté les Sept Tonnerres à Apocalypse 10, les Sept Sceaux, le Septième Sceau, les mystères cachés et la foi pour l'enlèvement. Inclus les références de sermons les plus claires et note tout endroit où il a dit que les Tonnerres ont été révélés ou non écrits. Inclus du contexte biographique seulement si nécessaire.",
    },
  },
  "what-did-brother-branham-teach-about-the-foolish-virgin": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre las vírgenes insensatas?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre las vírgenes insensatas en sus sermones. Busca dónde explicó las vírgenes prudentes e insensatas, la tribulación, el nuevo nacimiento y quién pierde el arrebatamiento pero puede aún ser salvo. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les vierges folles?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les vierges folles dans ses sermons. Cherche où il a expliqué les vierges sages et folles, la tribulation, la nouvelle naissance et qui manque l'enlèvement mais peut encore être sauvé. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-the-wise-virgin": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre las vírgenes prudentes?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre las vírgenes prudentes en sus sermones. Busca dónde explicó a la Novia, el aceite en la lámpara, la preparación, la revelación y lo que separa a las vírgenes prudentes de las insensatas. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les vierges sages?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les vierges sages dans ses sermons. Cherche où il a expliqué la Fiancée, l'huile dans la lampe, la préparation, la révélation et ce qui sépare les vierges sages des vierges folles. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-holiness-standards": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los estándares de santidad?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la santidad y la vida cristiana en sus sermones. Busca dónde habló sobre la separación del mundo, la vestimenta, la conducta, la modestia, el entretenimiento y la vida santificada para hombres y mujeres. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les normes de sainteté?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur la sainteté et la vie chrétienne dans ses sermons. Cherche où il a parlé de la séparation du monde, de la tenue vestimentaire, de la conduite, de la modestie, du divertissement et de la vie sanctifiée pour hommes et femmes. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-ministers-and-tithing": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los ministros y los diezmos?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre los diezmos, las ofrendas, el apoyo a los ministros y la actitud correcta hacia el dinero en el ministerio. Busca dónde habló sobre los salarios de los predicadores, el apoyo de la iglesia y la dadivosidad. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les ministres et la dîme?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur les dîmes, les offrandes, le soutien aux ministres et la bonne attitude envers l'argent dans le ministère. Cherche où il a parlé des salaires des prédicateurs, du soutien de l'église et des dons. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-cloud-and-the-seven-angels": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la nube y los siete ángeles?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la nube y los siete ángeles en sus sermones. Busca dónde habló sobre la nube de Arizona, la visitación de los ángeles, la comisión relacionada con los Sellos y cómo explicó la señal sobrenatural. Incluye las referencias de sermones más fuertes y contexto biográfico donde sea necesario.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur le nuage et les sept anges?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur le nuage et les sept anges dans ses sermons. Cherche où il a parlé du nuage de l'Arizona, de la visitation des anges, de la commission liée aux Sceaux et comment il a expliqué le signe surnaturel. Inclus les références de sermons les plus fortes et du contexte biographique où nécessaire.",
    },
  },
  "what-did-brother-branham-teach-about-the-laodicean-church-age": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la edad de la iglesia Laodicea?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre la edad de la iglesia Laodicea en sus sermones. Busca dónde explicó la última edad de la iglesia, la religión tibia, el mensajero a Laodicea y la condición de la iglesia del tiempo del fin. Incluye las referencias de sermones más claras.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur l'âge de l'église Laodicée?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur l'âge de l'église Laodicée dans ses sermons. Cherche où il a expliqué le dernier âge de l'église, la religion tiède, le messager à Laodicée et la condition de l'église de la fin des temps. Inclus les références de sermons les plus claires.",
    },
  },
  "what-did-brother-branham-teach-about-the-gifts-of-the-spirit": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre los dones del Espíritu?",
      robust_query: "Muestra lo que el Hermano Branham enseñó sobre los dones del Espíritu en sus sermones. Busca dónde explicó el discernimiento, la profecía, las lenguas, la sanidad, los milagros y cómo los dones deben operar en orden bajo el Espíritu Santo. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur les dons de l'Esprit?",
      robust_query: "Montre ce que le Frère Branham a enseigné sur les dons de l'Esprit dans ses sermons. Cherche où il a expliqué le discernement, la prophétie, les langues, la guérison, les miracles et comment les dons doivent opérer en ordre sous le Saint-Esprit. Inclus les principales références de sermons.",
    },
  },
  "what-did-brother-branham-teach-about-the-serpent-in-eden": {
    es: {
      question: "¿Qué enseñó el Hermano Branham sobre la serpiente en el Edén?",
      robust_query: "Muestra lo que el Hermano Branham enseñó en sus sermones sobre la serpiente en el Edén. Busca dónde describió lo que era la serpiente antes de la maldición, cómo podía razonar o hablar y cómo la conectó con la caída y Caín. Incluye las principales referencias de sermones.",
    },
    fr: {
      question: "Qu'a enseigné le Frère Branham sur le serpent dans l'Éden?",
      robust_query: "Montre ce que le Frère Branham a enseigné dans ses sermons sur le serpent dans l'Éden. Cherche où il a décrit ce qu'était le serpent avant la malédiction, comment il pouvait raisonner ou parler et comment il l'a connecté à la chute et à Caïn. Inclus les principales références de sermons.",
    },
  },
};

// ── API call ──────────────────────────────────────────────────────────

interface ApiResult {
  answer: string;
  ragContext: string;
}

async function fetchApiResult(robustQuery: string, language: string): Promise<ApiResult> {
  const response = await fetch(`${MODEL_API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHAT_API_BEARER_KEY}`,
    },
    body: JSON.stringify({
      conversation_id: crypto.randomUUID(),
      query: robustQuery,
      user_language: language,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
  }
  if (!response.body) throw new Error("No response body from API");

  // SSE state declared OUTSIDE the read loop so they persist across chunks.
  let buffer = "";
  let eventType = "";
  let dataLines: string[] = [];
  let answer = "";
  let ragContext = "";

  function flush() {
    if (!eventType || dataLines.length === 0) {
      eventType = "";
      dataLines = [];
      return;
    }
    try {
      const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      if (eventType === "rag") {
        if (typeof data.rag_context === "string") ragContext = data.rag_context;
      } else if (eventType === "final") {
        if (typeof data.answer === "string") answer = data.answer;
      } else if (eventType === "error") {
        throw new Error(`API error event: ${data.answer ?? "unknown"}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("API error event:")) throw e;
    }
    eventType = "";
    dataLines = [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n?/g, "\n");

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        } else if (line === "") {
          flush();
        }
      }
    }
    flush(); // flush any trailing event not followed by a blank line
  } finally {
    reader.releaseLock();
  }

  if (!answer) throw new Error("No 'final' event with answer received from API");
  return { answer: sanitizeText(answer), ragContext: sanitizeText(ragContext) };
}

// PostgreSQL rejects null bytes and lone surrogate codepoints in text columns.
function sanitizeText(text: string): string {
  return text.replace(/\0/g, "").replace(/[\uD800-\uDFFF]/g, "");
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const { data: enRows, error } = await supabase
    .from("seo_cache")
    .select("slug")
    .eq("published", true)
    .eq("language", "en")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!enRows || enRows.length === 0) {
    console.log("No published EN rows found.");
    return;
  }

  console.log(`Found ${enRows.length} EN rows. Generating ES and FR versions...\n`);

  for (const row of enRows) {
    const translations = TRANSLATIONS[row.slug];
    if (!translations) {
      console.log(`  WARN  no translation defined for slug: ${row.slug} — skipping`);
      continue;
    }

    for (const lang of TARGET_LANGUAGES) {
      const { data: existing } = await supabase
        .from("seo_cache")
        .select("slug")
        .eq("slug", row.slug)
        .eq("language", lang)
        .maybeSingle();

      if (existing) {
        console.log(`  SKIP  [${lang}] ${row.slug}`);
        continue;
      }

      const { question, robust_query } = translations[lang];
      let result: ApiResult | null = null;
      let lastError = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          process.stdout.write(
            attempt === 1
              ? `  GEN   [${lang}] ${row.slug} ... `
              : `  retry ${attempt}/3 [${lang}] ${row.slug} ... `,
          );
          result = await fetchApiResult(robust_query, lang);
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.log(`ERROR: ${lastError}`);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
        }
      }

      if (!result) {
        console.log(`  FAILED after 3 attempts`);
        continue;
      }

      const { error: insertError } = await supabase.from("seo_cache").insert({
        slug: row.slug,
        language: lang,
        question,
        robust_query,
        answer_markdown: result.answer,
        rag_context: result.ragContext || null,
        published: true,
      });

      if (insertError) {
        console.log(`ERROR (DB): ${insertError.message}`);
      } else {
        console.log(`done`);
      }

      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});