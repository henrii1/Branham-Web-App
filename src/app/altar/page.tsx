import type { Metadata } from "next";
import { AltarPage, buildAltarMetadata } from "@/components/altar/altarPage";

export const metadata: Metadata = buildAltarMetadata("en");

export default function EnglishAltarPage() {
  return <AltarPage language="en" />;
}
