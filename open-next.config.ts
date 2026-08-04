import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers adapter config.
 *
 * No incremental cache is configured. Every route in this portal is
 * authenticated and user-specific, so there is nothing safe to cache at the
 * edge: a cached parent dashboard is one family's records served to another.
 * Report card PDFs are the one cacheable artefact and they are immutable, so
 * they get explicit cache headers at the route rather than a global cache layer.
 */
export default defineCloudflareConfig();
