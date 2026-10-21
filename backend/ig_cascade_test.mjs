// Offline regression harness for the Instagram extraction cascade.
//
// Drives the REAL instagram() service with a mocked global fetch, so the
// actual getPost() cascade runs — not a re-implementation of it.
//
// Background: Instagram serves some GraphVideo reels through the embed page
// WITHOUT a `video_url` (the payload carries `context.copyright_blocked:
// true`). extractOldPost() used to fall through to `display_url` and label
// that a photo, so the user received the poster frame as a .jpg instead of
// the clip. The cascade also stopped as soon as a stage returned JSON, so
// the later graphql stage — which does carry the file — never ran.
//
// Scenarios:
//   1. embed stage withholds video, graphql stage has it  -> must be the mp4
//   2. every stage withholds the video                    -> must NOT be a photo
//   3. control: embed stage has the video (regression)     -> still the mp4
//
// Usage: node ig_cascade_test.mjs <embed_fixture_path>
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = process.argv[2];
if (!fixturePath) {
    console.error("usage: node ig_cascade_test.mjs <embed_fixture>");
    process.exit(2);
}

const embedHtml = readFileSync(fixturePath, "utf8");

// The video Instagram withholds from the embed page for this post. Stands in
// for what the graphql stage returns when it still has the file.
const WITHHELD_VIDEO_URL =
    "https://scontent-los4-1.cdninstagram.com/o1/v/t2/f2/m86/AQMU-test-withheld-video.mp4";

const { default: instagram } = await import(
    pathToFileURL(join(here, "cobalt/api/src/processing/services/instagram.js")).href
);

// createStream() builds its tunnel link from env.apiURL; without it any picker
// path throws ERR_INVALID_URL. Production sets API_URL (see render.yaml), and
// the sidecar picker paths in this harness must not depend on ambient env.
if (!process.env.API_URL) process.env.API_URL = "http://127.0.0.1:9000/";

const SHORTCODE = "DeuQdvFsdC9";

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

// Build the payload the graphql stage returns, by taking the embed page's own
// contextJSON and optionally restoring video_url. Keeps the fixture honest:
// everything except video_url is the real Instagram payload.
function graphqlPayload(withVideo) {
    const m = embedHtml.match(/"init",\[\],\[(.*?)\]\],/);
    const init = JSON.parse("[" + m[1] + "]");
    const ctx = init.find((item) => item && item.contextJSON).contextJSON;
    const node = JSON.parse(ctx);
    const media = node.gql_data.shortcode_media;
    if (withVideo) media.video_url = WITHHELD_VIDEO_URL;
    else delete media.video_url;
    return { data: { xdt_shortcode_media: media } };
}

/**
 * @param {object} opts
 * @param {boolean} opts.graphqlHasVideo - does the graphql stage carry video_url?
 * @param {boolean} opts.embedHasVideo   - does the embed stage carry video_url?
 */
function run({ graphqlHasVideo, embedHasVideo }) {
    const calls = [];
    const gql = graphqlPayload(graphqlHasVideo);

    // The embed page, optionally with video_url restored for the control case.
    let embed = embedHtml;
    if (embedHasVideo) {
        // inject video_url into the contextJSON blob the same way IG would
        const m = embedHtml.match(/"init",\[\],\[(.*?)\]\],/);
        const init = JSON.parse("[" + m[1] + "]");
        const entry = init.find((item) => item && item.contextJSON);
        const node = JSON.parse(entry.contextJSON);
        node.gql_data.shortcode_media.video_url = WITHHELD_VIDEO_URL;
        entry.contextJSON = JSON.stringify(node);
        embed = embedHtml.replace(m[1], JSON.stringify(init).slice(1, -1));
    }

    globalThis.fetch = async (url, init) => {
        const u = String(url);
        calls.push(u);

        // oembed -> media_id. Real endpoint, real shape.
        if (u.includes("/api/v1/oembed/")) {
            return jsonResponse({ media_id: "4012216730204098749_24078627" });
        }
        // mobile api. Prod sees login_required without a session cookie,
        // which is exactly why the embed/graphql stages matter here.
        if (u.includes("/api/v1/media/") && u.includes("/info/")) {
            return jsonResponse({ status: "fail", message: "login_required" }, 403);
        }
        // embed page
        if (u.includes("/embed/captioned/")) {
            return new Response(embed, { status: 200 });
        }
        // graphql
        if (u.includes("/graphql/query")) {
            return jsonResponse(gql);
        }
        // anything else (bulk-route-definitions, ruling, getErrorContext...)
        return jsonResponse({}, 404);
    };

    // No session cookie configured -> matches the anonymous prod path.
    return instagram({ postId: SHORTCODE, dispatcher: undefined });
}

let failures = 0;
const check = (label, cond, detail) => {
    console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!cond) failures++;
};

console.log("\n[1] embed withholds video, graphql has it -> must be the mp4");
{
    const r = await run({ graphqlHasVideo: true, embedHasVideo: false });
    check("returns urls", !!r?.urls, JSON.stringify(Object.keys(r || {})));
    check("is not a photo", !r?.isPhoto);
    check("filename ends .mp4", r?.filename?.endsWith(".mp4"), r?.filename);
    check("is the withheld video", r?.urls === WITHHELD_VIDEO_URL, r?.urls);
    check("not the poster .jpg", !String(r?.urls || "").includes("_n.jpg"));
}

console.log("\n[2] every stage withholds the video -> must NOT be reported as a photo");
{
    const r = await run({ graphqlHasVideo: false, embedHasVideo: false });
    check("no isPhoto result", !r?.isPhoto, JSON.stringify(r));
    check("does not serve the poster frame", !String(r?.urls || "").includes("_n.jpg"), r?.urls);
}

console.log("\n[3] control: embed stage has the video -> still the mp4");
{
    const r = await run({ graphqlHasVideo: false, embedHasVideo: true });
    check("returns urls", !!r?.urls, JSON.stringify(Object.keys(r || {})));
    check("is not a photo", !r?.isPhoto);
    check("filename ends .mp4", r?.filename?.endsWith(".mp4"), r?.filename);
}

console.log("");
process.exit(failures ? 1 : 0);
