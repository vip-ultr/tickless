// X (Twitter) renders twitter:image when present and only falls back to
// og:image when it is absent. Some crawlers get it wrong, so serve the same
// image under the twitter-image convention too rather than gamble on the
// fallback. Keep this file a pure re-export so there is one source of truth.
export { default, alt, size, contentType } from "./opengraph-image";
