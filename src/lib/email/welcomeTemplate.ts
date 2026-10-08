export interface WelcomeEmailTemplate {
  language: string;
  subject: string;
  bodyMarkdown: string;
}

export const FALLBACK_WELCOME_EMAIL_TEMPLATE: WelcomeEmailTemplate = {
  language: "en",
  subject: "Introducing BranhamSermons.ai",
  bodyMarkdown: `Release Note
Introducing BranhamSermons.ai

We’re excited to introduce BranhamSermons.ai.

The idea began from a simple experience. One morning during prayer, a sermon came to mind that I wanted to find in the Table app. Even after trying different keywords, I couldn’t locate it. That led to a simple question: What if you could search the sermons by asking a question or describing what you remember, instead of relying only on exact keywords? From that question, BranhamSermons.ai was born.

Designed for both believers and those discovering Brother Branham’s ministry for the first time, the platform helps you search the original sermons using natural language, phrases, thoughts, Scriptures, or topics.

Features
• Search using questions, phrases, or thoughts
• AI-powered responses grounded in the original sermons
• Sermon quotations and references
• Popular Questions
• Conversation history after signing in
• Multiple language support

Every response includes sermon references, making it easy to verify quotations and continue your study in the Table app.

We sincerely appreciate your feedback and suggestions as we continue improving the platform.

📧 info@branhamsermons.ai

-

THE BRANHAM SERMONS.AI admin`,
};
