import { readFileSync } from "node:fs";
import path from "node:path";

const logoPath = path.join(process.cwd(), "logo.jpg");
const logoBase64 = readFileSync(logoPath).toString("base64");

export const logoDataUrl = `data:image/jpeg;base64,${logoBase64}`;
