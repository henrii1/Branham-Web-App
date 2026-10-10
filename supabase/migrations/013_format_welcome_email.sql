-- Welcome email formatting pass (en/es/fr), same wording as migration 012:
-- "Introducing BranhamSermons.ai" as a heading, a bold welcome line with
-- emoji, a bold Features heading over a bullet list, a working
-- https://branhamsermons.ai link, and a sign-off that no longer contains
-- "SERMONS.AI" (mail apps were auto-linking it to sermons.ai). Rendered by
-- markdownToEmailHtml in src/lib/email/sendEmail.ts.

UPDATE public.intro_messages
SET
  subject = $$Introducing BranhamSermons.ai$$,
  body_markdown = $$Release Note

# Introducing BranhamSermons.ai

**We’re excited to introduce BranhamSermons.ai! 🎉🙌**

The idea began from a simple experience. One morning during prayer, a sermon came to mind that I wanted to find in the Table app. Even after trying different keywords, I couldn’t locate it. That led to a simple question: What if you could search the sermons by asking a question or describing what you remember, instead of relying only on exact keywords? From that question, BranhamSermons.ai was born.

Designed for both believers and those discovering Brother Branham’s ministry for the first time, the platform helps you search the original sermons using natural language, phrases, thoughts, Scriptures, or topics.

## ✨ Features

• Search using questions, phrases, or thoughts
• AI-powered responses grounded in the original sermons
• Sermon quotations and references
• Popular Questions
• Conversation history after signing in
• Multiple language support

Every response includes sermon references, making it easy to verify quotations and continue your study in the Table app.

We sincerely appreciate your feedback and suggestions as we continue improving the platform.

📧 info@branhamsermons.ai
🌐 Visit us: [https://branhamsermons.ai](https://branhamsermons.ai)

—
The BranhamSermons.ai Admin$$
WHERE language = 'en';

UPDATE public.intro_messages
SET
  subject = $$Presentamos BranhamSermons.ai$$,
  body_markdown = $$Nota de Lanzamiento

# Presentamos BranhamSermons.ai

**¡Nos alegra presentarte BranhamSermons.ai! 🎉🙌**

La idea nació de una experiencia sencilla. Una mañana, durante la oración, vino a mi mente un sermón que quería encontrar en la aplicación Table. Aun después de probar diferentes palabras clave, no pude localizarlo. Eso me llevó a una pregunta sencilla: ¿y si pudieras buscar en los sermones haciendo una pregunta o describiendo lo que recuerdas, en lugar de depender solo de palabras clave exactas? De esa pregunta nació BranhamSermons.ai.

Diseñada tanto para creyentes como para quienes descubren por primera vez el ministerio del Hermano Branham, la plataforma te ayuda a buscar en los sermones originales usando lenguaje natural, frases, ideas, Escrituras o temas.

## ✨ Funciones

• Busca con preguntas, frases o ideas
• Respuestas con IA fundamentadas en los sermones originales
• Citas y referencias de los sermones
• Preguntas Populares
• Historial de conversaciones al iniciar sesión
• Disponible en varios idiomas

Cada respuesta incluye referencias de los sermones, para que sea fácil verificar las citas y continuar tu estudio en la aplicación Table.

Agradecemos sinceramente tus comentarios y sugerencias mientras seguimos mejorando la plataforma.

📧 info@branhamsermons.ai
🌐 Visítanos: [https://branhamsermons.ai](https://branhamsermons.ai)

—
El equipo de administración de BranhamSermons.ai$$
WHERE language = 'es';

UPDATE public.intro_messages
SET
  subject = $$Nous vous présentons BranhamSermons.ai$$,
  body_markdown = $$Note de Version

# Nous vous présentons BranhamSermons.ai

**Nous sommes heureux de vous présenter BranhamSermons.ai ! 🎉🙌**

L'idée est née d'une expérience toute simple. Un matin, pendant la prière, un sermon m'est venu à l'esprit et j'ai voulu le retrouver dans l'application Table. Même en essayant différents mots-clés, je n'arrivais pas à le trouver. Cela m'a conduit à une question simple : et si vous pouviez rechercher dans les sermons en posant une question ou en décrivant ce dont vous vous souvenez, au lieu de dépendre uniquement de mots-clés exacts ? C'est de cette question qu'est né BranhamSermons.ai.

Conçue aussi bien pour les croyants que pour ceux qui découvrent pour la première fois le ministère du Frère Branham, la plateforme vous aide à rechercher dans les sermons originaux en langage naturel, par des phrases, des pensées, des passages des Écritures ou des sujets.

## ✨ Fonctionnalités

• Recherche par questions, phrases ou pensées
• Réponses de l'IA fondées sur les sermons originaux
• Citations et références des sermons
• Questions Populaires
• Historique des conversations après connexion
• Prise en charge de plusieurs langues

Chaque réponse comprend des références de sermons, ce qui permet de vérifier facilement les citations et de poursuivre votre étude dans l'application Table.

Nous apprécions sincèrement vos retours et suggestions alors que nous continuons à améliorer la plateforme.

📧 info@branhamsermons.ai
🌐 Rendez-nous visite : [https://branhamsermons.ai](https://branhamsermons.ai)

—
L'équipe d'administration de BranhamSermons.ai$$
WHERE language = 'fr';
