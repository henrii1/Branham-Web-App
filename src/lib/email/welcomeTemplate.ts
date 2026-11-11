export interface WelcomeEmailTemplate {
  language: string;
  subject: string;
  bodyMarkdown: string;
}

export const FALLBACK_WELCOME_EMAIL_TEMPLATE: WelcomeEmailTemplate = {
  language: "en",
  subject: "Introducing BranhamSermons.ai",
  bodyMarkdown: `Release Note

# Introducing BranhamSermons.ai

**We’re glad to have you with us! 🎉🙌**

BranhamSermons.ai is a free place to explore faith, study the Bible and search the sermons of William Branham. Ask in your own words, and every answer shows the verses or quotes it rests on, so you can check it for yourself.

## 🌿 Christianity Seen in Nature

For anyone, whatever they believe: a series on what creation shows about God, one question at a time. Start at [branhamsermons.ai/faq/nature](https://branhamsermons.ai/faq/nature) and share it with someone who is searching.

## 📖 Bible search

• Ask about any passage, subject or teaching of the Bible
• Clear answers grounded in the Scriptures, with the verses that support them
• Follow-up questions, the way a real conversation unfolds

## 🔎 Sermon search

For those searching Brother Branham’s sermons for what he preached, the platform also searches the original sermons. Describe what you remember or search by the exact wording. Every answer includes sermon quotations and references, so you can verify them and continue your study in the Table app.

## 🔥 Family Altar

A new devotion every day to study the Word together at home: a verse of Scripture, a reflection, questions to discuss with your family and points for prayer. Open today’s devotion at [branhamsermons.ai/altar](https://branhamsermons.ai/altar) and share it with your loved ones.

## ✨ Also included

• Questions of Faith
• Conversation history after signing in
• English, Spanish and French

Choose Bible search or Sermon search just above the chat box, and set your default anytime in your profile.

We sincerely appreciate your feedback and suggestions as we continue improving the platform.

## 🤝 Stay connected

💬 Follow our WhatsApp channel for the daily Family Altar: [Join the channel](https://whatsapp.com/channel/0029VbE5R3qLI8YY3HEfmh0d)
📸 Instagram: [@branhamsermons.ai](https://www.instagram.com/branhamsermons.ai)
👍 Facebook: [BranhamSermons.ai](https://www.facebook.com/share/1A2ybQezGf/)
🎵 TikTok: [@branham.sermons.as](https://www.tiktok.com/@branham.sermons.as)
✖️ X: [@branhamsermon](https://x.com/branhamsermon)

📧 info@branhamsermons.ai
🌐 Visit us: [https://branhamsermons.ai](https://branhamsermons.ai)

—
The BranhamSermons.ai Admin`,
};
