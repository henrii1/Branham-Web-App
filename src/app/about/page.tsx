import type { Metadata } from "next";
import { AboutPage, buildAboutMetadata } from "@/components/about/AboutPage";

export const metadata: Metadata = buildAboutMetadata("en");

export default function EnglishAboutPage() {
  return <AboutPage lang="en" />;
}
