export const THEME_COOKIE_NAME = "branham-theme";

export const THEME_PREFERENCES = ["light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark";
}

export function normalizeThemePreference(
  value: string | null | undefined,
  fallback: ThemePreference = "dark",
): ThemePreference {
  return isThemePreference(value) ? value : fallback;
}
