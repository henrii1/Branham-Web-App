/**
 * Cloudflare Worker entry: OpenNext's generated worker plus a scheduled()
 * handler for the daily Family Altar cron (wrangler.jsonc → triggers.crons).
 * Pattern from OpenNext's "custom worker" docs. Bundled by Wrangler, not by
 * Next, so it's excluded from tsconfig (the import below only exists after
 * `opennextjs-cloudflare build`).
 */

// @ts-ignore -- generated at build time
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
  [key: string]: unknown;
}
interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: Env, ctx: ExecutionContextLike) {
    if (!env.CRON_SECRET) {
      console.error("Family Altar cron skipped: CRON_SECRET is not set.");
      return;
    }
    // Run the route in-process (no network hop). A cron invocation may run
    // for up to 15 minutes; a week of devotionals takes ~4.
    const request = new Request("https://branhamsermons.ai/api/altar/cron", {
      method: "POST",
      headers: { "x-cron-secret": env.CRON_SECRET },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(request, env, ctx)).then(async (res: Response) => {
        console.log(`Family Altar cron finished: ${res.status} ${await res.text()}`);
      }),
    );
  },
};

// @ts-ignore -- generated at build time
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
