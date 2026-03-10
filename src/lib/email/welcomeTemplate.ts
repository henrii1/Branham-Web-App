export interface WelcomeEmailTemplate {
  language: string;
  subject: string;
  bodyMarkdown: string;
}

export const FALLBACK_WELCOME_EMAIL_TEMPLATE: WelcomeEmailTemplate = {
  language: "en",
  subject: "Release Note Branham Sermons AI",
  bodyMarkdown: `Release Note Branham Sermons AI

We’re glad to introduce Branham Sermons AI.

The idea for this app came in a very simple way. One morning during prayer, a sermon came to mind and I wanted to search it out in the Table app using keywords. I tried every keyword idea I could think of, but I still could not find it. That was when the thought came: what if there were an AI-based system where people could find sermons, compare doctrines and concepts, and study the Message and Scripture using normal, story-like questions instead of only keywords?

From that point, the burden grew into something more. In this AI age, there should be a tool that gives people faster access to information, especially people who are not yet familiar with Bro Branham, but want to learn about his life, the work of God in his ministry, and what he believed.

Part of that burden also came from a real situation. Some time ago, my brother invited a friend to church. Because the young man still lived with his parents, his father searched online to understand the church and its beliefs. What he found was material about subjects like the Seven Thunders and the Seals, and he quickly concluded that the church was a cult. He then advised his son never to attend. It made me feel that if a platform like this had existed, he could have searched these same questions and received fuller, more scriptural, and better-grounded context.

That is one of the main reasons this app is especially designed for people outside the Message as well as those within it. Whether you come from another denomination, another religion, or are simply curious about Bro Branham for the first time, this platform was built to help you search, understand, and study more clearly. If this is your first time looking into Bro Branham, you have come to the right place.

Branham Sermons AI includes deep search capabilities that help you find quotes and sermons either by the exact wording or by describing the context in your own words. The search results appear in the Sources window, while the AI provides a clearer and more focused response in the chat. The app also includes a Popular Questions section for many of the doctrinal questions people commonly ask about Bro Branham.

Each response includes explicit sermon references so that users can easily locate the original quotations and read the full sermon in the Table app.

After logging in, users can view past conversations and continue their studies from where they left off.

We sincerely appreciate feedback and recommendations from both people who are new to the Message and those whom God has graciously helped to study many of the sermons already. You can reach us at support@branhamsermons.ai
.

Admin
Branham Sermons AI`,
};
