import { randomBytes } from "node:crypto";
import { resolveRedirectingURL } from "../url.js";
import { genericUserAgent } from "../../config.js";
import { createStream } from "../../stream/manage.js";
import { getCookie, updateCookie } from "../cookie/manager.js";

const commonHeaders = {
    "user-agent": genericUserAgent,
    "sec-gpc": "1",
    "sec-fetch-site": "same-origin",
    "x-ig-app-id": "936619743392459"
}

const mobileHeaders = {
    "x-ig-app-locale": "en_US",
    "x-ig-device-locale": "en_US",
    "x-ig-mapped-locale": "en_US",
    "user-agent": "Instagram 275.0.0.27.98 Android (33/13; 280dpi; 720x1423; Xiaomi; Redmi 7; onclite; qcom; en_US; 458229237)",
    "accept-language": "en-US",
    "x-fb-http-engine": "Liger",
    "x-fb-client-ip": "True",
    "x-fb-server-cluster": "True",
    "content-length": "0",
}

const embedHeaders = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-GB,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Dnt": "1",
    "Priority": "u=0, i",
    "Sec-Ch-Ua": 'Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": "macOS",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": genericUserAgent,
}

const cachedDtsg = {
    value: '',
    expiry: 0
}

const getNumberFromQuery = (name, data) => {
    const s = data?.match(new RegExp(name + '=(\\d+)'))?.[1];
    if (+s) return +s;
}

const getObjectFromEntries = (name, data) => {
    const obj = data?.match(new RegExp('\\["' + name + '",.*?,({.*?}),\\d+\\]'))?.[1];
    return obj && JSON.parse(obj);
}

const decodeEntities = (s) => (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?64;/g, "@")
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // last, so "&amp;#064;" still decodes to "@"
    .replace(/&amp;/g, "&");

/*
** Last resort for single-image instagram posts.
**
** the embed page (/p/<id>/embed/captioned/) only ships a structured
** `contextJSON` blob for sidecars. static images come back with
** `contextJSON: null` / `isRichEmbed: false`, so every stage of getPost()'s
** cascade (mobile api, embed json, web graphql) comes back empty — even
** though the image itself is sitting right there in the markup as
** `<img class="EmbeddedMediaImage">`.
**
** this scrapes that markup and rebuilds the same `shortcode_media` shape
** extractOldPost() already consumes, so filenames, `isPhoto` -> redirect and
** the meta (caption/@author/cover) forwarding all stay untouched.
**
** it is strictly a fallback: it only runs after every structured stage has
** failed, and it refuses anything that isn't a static `GraphImage`, so
** carousels (populated contextJSON) and reels (no EmbeddedMediaImage is
** rendered at all) keep taking their existing paths.
*/
// exported for the offline regression test in backend/test_backend.py
export function parseEmbedMarkup(html, id) {
    if (!html) return;

    const embedDiv = html.match(/<div class="Embed"[^>]*>/)?.[0];

    // static images only — video / sidecar / guide / profile embeds must keep
    // using the structured stages above this fallback.
    const mediaType = embedDiv?.match(/data-media-type="([^"]+)"/)?.[1];
    if (mediaType !== "GraphImage") return;

    // attribute order on the <img> isn't stable, so locate the tag first.
    const imgTag = [...html.matchAll(/<img\b[^>]*>/g)]
        .map(m => m[0])
        .find(tag => /class="[^"]*EmbeddedMediaImage/.test(tag));

    const imageUrl = decodeEntities(imgTag?.match(/\ssrc="([^"]+)"/)?.[1]);
    if (!imageUrl?.startsWith("http")) return;

    const captionBlock = html.match(
        /<div class="Caption">([\s\S]*?)(?:<div class="CaptionComments"|<div class="Footer")/
    )?.[1];

    const username = (captionBlock?.match(/class="CaptionUsername"[^>]*>([^<]*)</) || [])[1]?.trim()
        || html.match(/data-ios-link="user\?username=([A-Za-z0-9._]+)/)?.[1]
        || imgTag?.match(/\salt="[^"]*(?:&#064;|@)([A-Za-z0-9._]+)/)?.[1]
        || "";

    const caption = decodeEntities(
        (captionBlock || "")
            // links (username / hashtags) are markup, not caption text
            .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .trim()
    ).trim();

    return {
        __typename: "GraphImage",
        id: embedDiv?.match(/data-media-id="(\d+)"/)?.[1] || "",
        shortcode: id,
        is_video: false,
        display_url: imageUrl,
        owner: {
            id: embedDiv?.match(/data-owner-id="(\d+)"/)?.[1] || "",
            username
        },
        edge_media_to_caption: {
            edges: caption ? [{ node: { text: caption } }] : []
        }
    };
}

export default function instagram(obj) {
    const dispatcher = obj.dispatcher;

    // raw markup of the most recent embed page fetched for this request, so
    // the single-image fallback below doesn't have to pay for a second fetch.
    let lastEmbedHtml = "", lastEmbedId;

    async function findDtsgId(cookie) {
        try {
            if (cachedDtsg.expiry > Date.now()) return cachedDtsg.value;

            const data = await fetch('https://www.instagram.com/', {
                headers: {
                    ...commonHeaders,
                    cookie
                },
                dispatcher
            }).then(r => r.text());

            const token = data.match(/"dtsg":{"token":"(.*?)"/)[1];

            cachedDtsg.value = token;
            cachedDtsg.expiry = Date.now() + 86390000;

            if (token) return token;
            return false;
        }
        catch {}
    }

    async function request(url, cookie, method = 'GET', requestData) {
        let headers = {
            ...commonHeaders,
            'x-ig-www-claim': cookie?._wwwClaim || '0',
            'x-csrftoken': cookie?.values()?.csrftoken,
            cookie
        }
        if (method === 'POST') {
            headers['content-type'] = 'application/x-www-form-urlencoded';
        }

        const data = await fetch(url, {
            method,
            headers,
            body: requestData && new URLSearchParams(requestData),
            dispatcher
        });

        if (data.headers.get('X-Ig-Set-Www-Claim') && cookie)
            cookie._wwwClaim = data.headers.get('X-Ig-Set-Www-Claim');

        updateCookie(cookie, data.headers);
        return data.json();
    }

    async function getMediaId(id, { cookie, token } = {}) {
        const oembedURL = new URL('https://i.instagram.com/api/v1/oembed/');
        oembedURL.searchParams.set('url', `https://www.instagram.com/p/${id}/`);

        const oembed = await fetch(oembedURL, {
            headers: {
                ...mobileHeaders,
                ...( token && { authorization: `Bearer ${token}` } ),
                cookie
            },
            dispatcher
        }).then(r => r.json()).catch(() => {});

        return oembed?.media_id;
    }

    async function requestMobileApi(mediaId, { cookie, token } = {}) {
        const mediaInfo = await fetch(`https://i.instagram.com/api/v1/media/${mediaId}/info/`, {
            headers: {
                ...mobileHeaders,
                ...( token && { authorization: `Bearer ${token}` } ),
                cookie
            },
            dispatcher
        }).then(r => r.json()).catch(() => {});

        return mediaInfo?.items?.[0];
    }

    async function requestHTML(id, cookie) {
        const data = await fetch(`https://www.instagram.com/p/${id}/embed/captioned/`, {
            headers: {
                ...embedHeaders,
                cookie
            },
            dispatcher
        }).then(r => r.text()).catch(() => {});

        // keep the raw markup: getPost()'s single-image fallback reuses it
        // instead of requesting the embed page a second time.
        lastEmbedHtml = data || "";
        lastEmbedId = id;

        const init = data?.match(/"init",\[\],\[(.*?)\]\],/)?.[1];
        if (!init) return false;

        let embedData;
        try {
            embedData = JSON.parse(init);
            if (!embedData?.contextJSON) return false;
            return JSON.parse(embedData.contextJSON);
        } catch {
            // a malformed/unexpected payload must not abort getPost()'s cascade
            // (and skip the graphql stage) the way a bare throw would.
            return false;
        }
    }

    async function getGQLParams(id, cookie) {
        const req = await fetch(`https://www.instagram.com/p/${id}/`, {
            headers: {
                ...embedHeaders,
                cookie
            },
            dispatcher
        });

        const html = await req.text();
        const siteData = getObjectFromEntries('SiteData', html);
        const polarisSiteData = getObjectFromEntries('PolarisSiteData', html);
        const webConfig = getObjectFromEntries('DGWWebConfig', html);
        const pushInfo = getObjectFromEntries('InstagramWebPushInfo', html);
        const lsd = getObjectFromEntries('LSD', html)?.token || randomBytes(8).toString('base64url');
        const csrf = getObjectFromEntries('InstagramSecurityConfig', html)?.csrf_token;

        const anon_cookie = [
            csrf && "csrftoken=" + csrf,
            polarisSiteData?.device_id && "ig_did=" + polarisSiteData?.device_id,
            "wd=1280x720",
            "dpr=2",
            polarisSiteData?.machine_id && "mid=" + polarisSiteData.machine_id,
            "ig_nrcb=1"
        ].filter(a => a).join('; ');

        return {
            headers: {
                'x-ig-app-id': webConfig?.appId || '936619743392459',
                'X-FB-LSD': lsd,
                'X-CSRFToken': csrf,
                'X-Bloks-Version-Id': getObjectFromEntries('WebBloksVersioningID', html)?.versioningID,
                'x-asbd-id': 129477,
                cookie: anon_cookie
            },
            body: {
                __d: 'www',
                __a: '1',
                __s: '::' + Math.random().toString(36).substring(2).replace(/\d/g, '').slice(0, 6),
                __hs: siteData?.haste_session || '20126.HYP:instagram_web_pkg.2.1...0',
                __req: 'b',
                __ccg: 'EXCELLENT',
                __rev: pushInfo?.rollout_hash || '1019933358',
                __hsi: siteData?.hsi || '7436540909012459023',
                __dyn: randomBytes(154).toString('base64url'),
                __csr: randomBytes(154).toString('base64url'),
                __user: '0',
                __comet_req: getNumberFromQuery('__comet_req', html) || '7',
                av: '0',
                dpr: '2',
                lsd,
                jazoest: getNumberFromQuery('jazoest', html) || Math.floor(Math.random() * 10000),
                __spin_r: siteData?.__spin_r || '1019933358',
                __spin_b: siteData?.__spin_b || 'trunk',
                __spin_t: siteData?.__spin_t || Math.floor(new Date().getTime() / 1000),
            }
        };
    }

    async function requestGQL(id, cookie) {
        const { headers, body } = await getGQLParams(id, cookie);

        const req = await fetch('https://www.instagram.com/graphql/query', {
            method: 'POST',
            dispatcher,
            headers: {
                ...embedHeaders,
                ...headers,
                cookie,
                'content-type': 'application/x-www-form-urlencoded',
                'X-FB-Friendly-Name': 'PolarisPostActionLoadPostQueryQuery',
            },
            body: new URLSearchParams({
                ...body,
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
                variables: JSON.stringify({
                    shortcode: id,
                    fetch_tagged_user_count: null,
                    hoisted_comment_id: null,
                    hoisted_reply_id: null
                }),
                server_timestamps: true,
                doc_id: '8845758582119845'
            }).toString()
        });

        return {
            gql_data: await req.json()
                        .then(r => r.data)
                        .catch(() => null)
        };
    }

    async function getErrorContext(id) {
        try {
            const { headers, body } = await getGQLParams(id);

            const req = await fetch('https://www.instagram.com/ajax/bulk-route-definitions/', {
                method: 'POST',
                dispatcher,
                headers: {
                    ...embedHeaders,
                    ...headers,
                    'content-type': 'application/x-www-form-urlencoded',
                    'X-Ig-D': 'www',
                },
                body: new URLSearchParams({
                    'route_urls[0]': `/p/${id}/`,
                    routing_namespace: 'igx_www',
                    ...body
                }).toString()
            });

            const response = await req.text();
            if (response.includes('"tracePolicy":"polaris.privatePostPage"'))
                return { error: 'content.post.private' };

            const [, mediaId, mediaOwnerId] = response.match(
                /"media_id":\s*?"(\d+)","media_owner_id":\s*?"(\d+)"/
            ) || [];

            if (mediaId && mediaOwnerId) {
                const rulingURL = new URL('https://www.instagram.com/api/v1/web/get_ruling_for_media_content_logged_out');
                rulingURL.searchParams.set('media_id', mediaId);
                rulingURL.searchParams.set('owner_id', mediaOwnerId);

                const rulingResponse = await fetch(rulingURL, {
                    headers: {
                        ...headers,
                        ...commonHeaders
                    },
                    dispatcher,
                }).then(a => a.json()).catch(() => ({}));

                if (rulingResponse?.title?.includes('Restricted'))
                    return { error: "content.post.age" };
            }
        } catch {
            return { error: "fetch.fail" };
        }

        return { error: "fetch.empty" };
    }

    // Pull the public-facing post metadata (caption, author, cover) out of the
    // GQL/post object so Tickless can render an Instagram result the same way it
    // renders a TikTok result (cover + caption + @author). Cobalt's core
    // response builder normally DROPS everything except url/thumb, so we stash
    // these on a `meta` object that request.js is patched to forward.
    function extractMeta(node, id) {
        const captionEdges = node?.edge_media_to_caption?.edges
            || node?.caption?.edges
            || [];
        const caption = captionEdges.length
            ? (captionEdges[0]?.node?.text || "")
            : "";
        const author = (node?.owner?.username
            || node?.owner?.reel_owner?.username
            || "") || "";
        // Cover must be the PUBLIC display_url (a *.fna.fbcdn.net URL the user's
        // browser can load directly), NOT the proxied loopback thumb which only
        // resolves inside this container.
        const thumbnail = node?.display_url
            || node?.thumbnail_src
            || node?.image_versions2?.candidates?.[0]?.url
            || "";
        return { title: caption, author, thumbnail };
    }

    function attachMeta(result, node, id) {
        const meta = extractMeta(node, id);
        return { ...result, meta };
    }

    function extractOldPost(data, id, alwaysProxy) {
        const shortcodeMedia = data?.gql_data?.shortcode_media || data?.gql_data?.xdt_shortcode_media;
        const sidecar = shortcodeMedia?.edge_sidecar_to_children;

        if (sidecar) {
            const picker = sidecar.edges.filter(e => e.node?.display_url)
                .map((e, i) => {
                    const type = e.node?.is_video && e.node?.video_url ? "video" : "photo";

                    let url;
                    if (type === "video") {
                        url = e.node?.video_url;
                    } else if (type === "photo") {
                        url = e.node?.display_url;
                    }

                    let itemExt = type === "video" ? "mp4" : "jpg";

                    let proxyFile;
                    if (alwaysProxy) proxyFile = createStream({
                        service: "instagram",
                        type: "proxy",
                        url,
                        filename: `instagram_${id}_${i + 1}.${itemExt}`
                    });

                    return {
                        type,
                        url: proxyFile || url,
                        /* thumbnails have `Cross-Origin-Resource-Policy`
                        ** set to `same-origin`, so we need to proxy them */
                        thumb: createStream({
                            service: "instagram",
                            type: "proxy",
                            url: e.node?.display_url,
                            filename: `instagram_${id}_${i + 1}.jpg`
                        })
                    }
                });

            if (picker.length) return attachMeta({ picker }, shortcodeMedia, id)
        }

        if (shortcodeMedia?.video_url) {
            return attachMeta({
                urls: shortcodeMedia.video_url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }, shortcodeMedia, id)
        }

        if (shortcodeMedia?.display_url) {
            return attachMeta({
                urls: shortcodeMedia.display_url,
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }, shortcodeMedia, id)
        }
    }

    function extractNewPost(data, id, alwaysProxy) {
        const carousel = data.carousel_media;
        if (carousel) {
            const picker = carousel.filter(e => e?.image_versions2)
                .map((e, i) => {
                    const type = e.video_versions ? "video" : "photo";
                    const imageUrl = e.image_versions2.candidates[0].url;

                    let url = imageUrl;
                    let itemExt = type === "video" ? "mp4" : "jpg";

                    if (type === "video") {
                        const video = e.video_versions.reduce((a, b) => a.width * a.height < b.width * b.height ? b : a);
                        url = video.url;
                    }

                    let proxyFile;
                    if (alwaysProxy) proxyFile = createStream({
                        service: "instagram",
                        type: "proxy",
                        url,
                        filename: `instagram_${id}_${i + 1}.${itemExt}`
                    });

                    return {
                        type,
                        url: proxyFile || url,
                        /* thumbnails have `Cross-Origin-Resource-Policy`
                        ** set to `same-origin`, so we need to always proxy them */
                        thumb: createStream({
                            service: "instagram",
                            type: "proxy",
                            url: imageUrl,
                            filename: `instagram_${id}_${i + 1}.jpg`
                        })
                    }
                });

            if (picker.length) return attachMeta({ picker }, data, id)
        } else if (data.video_versions) {
            const video = data.video_versions.reduce((a, b) => a.width * a.height < b.width * b.height ? b : a)
            return attachMeta({
                urls: video.url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }, data, id)
        } else if (data.image_versions2?.candidates) {
            return attachMeta({
                urls: data.image_versions2.candidates[0].url,
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }, data, id)
        }
    }

    // Runs only when every structured stage above has come back empty (or
    // produced no media). Returns undefined unless the embed markup really
    // does hold a static GraphImage, so callers keep their existing errors.
    async function extractEmbedFallback(id, alwaysProxy) {
        try {
            let html = lastEmbedId === id ? lastEmbedHtml : "";
            if (!html) {
                html = await fetch(`https://www.instagram.com/p/${id}/embed/captioned/`, {
                    headers: embedHeaders,
                    dispatcher
                }).then(r => r.text()).catch(() => "");
            }

            const node = parseEmbedMarkup(html, id);
            if (!node) return;

            return extractOldPost({ gql_data: { shortcode_media: node } }, id, alwaysProxy);
        } catch {}
    }

    async function getPost(id, alwaysProxy) {
        const hasData = (data) => data
                                    && data.gql_data !== null
                                    && data?.gql_data?.xdt_shortcode_media !== null;
        let data, result;
        try {
            const cookie = getCookie('instagram');

            const bearer = getCookie('instagram_bearer');
            const token = bearer?.values()?.token;

            // get media_id for mobile api, three methods
            let media_id = await getMediaId(id);
            if (!media_id && token) media_id = await getMediaId(id, { token });
            if (!media_id && cookie) media_id = await getMediaId(id, { cookie });

            // mobile api (bearer)
            if (media_id && token) data = await requestMobileApi(media_id, { token });

            // mobile api (no cookie, cookie)
            if (media_id && !hasData(data)) data = await requestMobileApi(media_id);
            if (media_id && cookie && !hasData(data)) data = await requestMobileApi(media_id, { cookie });

            // html embed (no cookie, cookie)
            if (!hasData(data)) data = await requestHTML(id);
            if (!hasData(data) && cookie) data = await requestHTML(id, cookie);

            // web app graphql api (no cookie, cookie)
            if (!hasData(data)) data = await requestGQL(id);
            if (!hasData(data) && cookie) data = await requestGQL(id, cookie);
        } catch {}

        if (hasData(data)) {
            if (data?.gql_data) result = extractOldPost(data, id, alwaysProxy);
            else result = extractNewPost(data, id, alwaysProxy);
            if (result) return result;
        }

        // nothing structured to work with: single-image posts only expose the
        // file through the embed markup (see parseEmbedMarkup).
        const fallback = await extractEmbedFallback(id, alwaysProxy);
        if (fallback) return fallback;

        if (!hasData(data)) {
            return getErrorContext(id);
        }
        return { error: "fetch.empty" }
    }

    async function usernameToId(username, cookie) {
        const url = new URL('https://www.instagram.com/api/v1/users/web_profile_info/');
            url.searchParams.set('username', username);

        try {
            const data = await request(url, cookie);
            return data?.data?.user?.id;
        } catch {}
    }

    async function getStory(username, id) {
        const cookie = getCookie('instagram');
        if (!cookie) return { error: "link.unsupported" };

        const userId = await usernameToId(username, cookie);
        if (!userId) return { error: "fetch.empty" };

        const dtsgId = await findDtsgId(cookie);

        const url = new URL('https://www.instagram.com/api/graphql/');
        const requestData = {
            fb_dtsg: dtsgId,
            jazoest: '26438',
            variables: JSON.stringify({
                reel_ids_arr : [ userId ],
            }),
            server_timestamps: true,
            doc_id: '25317500907894419'
        };

        let media;
        try {
            const data = (await request(url, cookie, 'POST', requestData));
            media = data?.data?.xdt_api__v1__feed__reels_media?.reels_media?.find(m => m.id === userId);
        } catch {}

        const item = media.items.find(m => m.pk === id);
        if (!item) return { error: "fetch.empty" };

        if (item.video_versions) {
            const video = item.video_versions.reduce((a, b) => a.width * a.height < b.width * b.height ? b : a)
            return {
                urls: video.url,
                filename: `instagram_${id}.mp4`,
                audioFilename: `instagram_${id}_audio`
            }
        }

        if (item.image_versions2?.candidates) {
            return {
                urls: item.image_versions2.candidates[0].url,
                isPhoto: true,
                filename: `instagram_${id}.jpg`,
            }
        }

        return { error: "link.unsupported" };
    }

    const { postId, shareId, storyId, username, alwaysProxy } = obj;

    if (shareId) {
        return resolveRedirectingURL(
            `https://www.instagram.com/share/${shareId}/`,
            dispatcher,
            // for some reason instagram decides to return HTML
            // instead of a redirect when requesting with a normal
            // browser user-agent
            {'User-Agent': 'curl/7.88.1'}
        ).then(match => instagram({
            ...obj, ...match,
            shareId: undefined
        }));
    }

    if (postId) return getPost(postId, alwaysProxy);
    if (username && storyId) return getStory(username, storyId);

    return { error: "fetch.empty" }
}
