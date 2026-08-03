// `qrcode-generator` is dynamically imported here — and ONLY here — so it
// never enters the initial page bundle. `ShareModal`/`ShareCardTemplate` are
// statically imported into `ChatShell`, so a static import of this library
// would land in the main chat bundle even for the vast majority of visits
// that never open the Share modal (same latency-first reasoning as
// `generateShareCard.ts`'s dynamic-only `html-to-image` import).
export async function generateQrMatrix(value: string): Promise<boolean[][]> {
  const qrcode = (await import("qrcode-generator")).default;
  const qr = qrcode(0, "M"); // 0 = auto type-number (smallest that fits), M = medium error correction
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const cells: boolean[] = [];
    for (let col = 0; col < count; col++) cells.push(qr.isDark(row, col));
    matrix.push(cells);
  }
  return matrix;
}
