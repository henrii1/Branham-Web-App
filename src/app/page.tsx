import { permanentRedirect } from "next/navigation";

export default function Home() {
  // 308 permanent (not the default 307) so Google consolidates / into /chat
  // instead of tracking them as two separate URLs.
  permanentRedirect("/chat");
}
