import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AltarPage, buildAltarDayMetadata } from "@/components/altar/altarPage";
import { isIsoDate } from "@/lib/altar/week";

interface PageProps {
  params: Promise<{ day: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { day } = await params;
  if (!isIsoDate(day)) return { title: "Not Found" };
  return buildAltarDayMetadata("en", day);
}

/** One day of the Family Altar — the link the share button hands out. */
export default async function EnglishAltarDayPage({ params }: PageProps) {
  const { day } = await params;
  if (!isIsoDate(day)) notFound();
  return <AltarPage language="en" focusDay={day} />;
}
