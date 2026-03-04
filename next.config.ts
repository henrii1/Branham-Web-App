import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
