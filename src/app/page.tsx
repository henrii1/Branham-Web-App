import { HomePage, buildHomeMetadata } from "@/components/home/HomePage";
import { fetchHomeData } from "@/lib/site/homeData";
import { fetchHomeVideos } from "@/lib/site/youtube";

export const metadata = buildHomeMetadata("en");

/**
 * The home page (evangelism first). A first visit whose browser is French or
 * Spanish is sent to /fr or /es by the middleware; the chat lives at /chat.
 */
export default async function Home() {
  const [data, videos] = await Promise.all([fetchHomeData("en"), fetchHomeVideos()]);
  return <HomePage lang="en" data={data} videos={videos} />;
}
