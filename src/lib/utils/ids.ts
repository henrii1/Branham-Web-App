export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShareHash(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
