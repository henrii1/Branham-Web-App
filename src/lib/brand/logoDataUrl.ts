import { readFileSync } from "node:fs";
import path from "node:path";

const logoPath = path.join(process.cwd(), "logo.png");
const logoBase64 = readFileSync(logoPath).toString("base64");

export const logoDataUrl = `data:image/png;base64,${logoBase64}`;
