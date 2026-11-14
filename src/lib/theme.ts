/**
 * The theme a visitor chose (light is the default; dark only by choice).
 * Renamed from "branham-theme", which was written automatically on every
 * visit when dark was the default, so it never meant a choice.
 */
export const THEME_COOKIE_NAME = "branham-theme-choice";

export const THEME_PREFERENCES = ["light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function normalizeThemePreference(
  value: string | null | undefined,
  fallback: ThemePreference = "light",
): ThemePreference {
  return isThemePreference(value) ? value : fallback;
}
