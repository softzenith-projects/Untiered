/**
 * Checks what a crawler actually receives from a running site.
 *
 *   node apps/web/scripts/check-seo.mjs                        http://localhost:3000
 *   node apps/web/scripts/check-seo.mjs https://untiered.tech  production, after a release
 *
 * CI runs it against the production build. Unit tests (lib/seo.test.ts) cover the data; this
 * covers what only exists once Next has rendered it: the tags, headers, redirects and XML.
 * Canonicals always name the production host, so they are compared by path on any other host.
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PRODUCTION = "https://untiered.tech";
/** Next writes the homepage as "https://untiered.tech" and a sitemap as ".../"; they are one URL. */
const sameUrl = (a, b) => Boolean(a) && Boolean(b) && new URL(a).href === new URL(b).href;

const SIGNED_IN_ROUTES = ["/dashboard", "/profile", "/history", "/rounds", "/report/example", "/interview/new", "/questions", "/courses", "/courses/java", "/arena"];
const NOINDEX_ROUTES = ["/login", "/login?next=%2Fcourses", "/upgrade", "/daily-challenge", "/auth/update-password", "/unsubscribe"];

let failures = 0;
function check(ok, label, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${!ok && detail ? ` — ${detail}` : ""}`);
}

/** Waits for a server that was started a moment ago, as in CI. */
async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await fetch(base, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Nothing answered at ${base} after 30 seconds`);
}

const get = (path) => fetch(`${base}${path}`, { redirect: "manual", headers: { "User-Agent": "untiered-seo-check" } });

const meta = (html, attribute, name) =>
  html.match(new RegExp(`<meta[^>]*${attribute}="${name}"[^>]*content="([^"]*)"`))?.[1] ??
  html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attribute}="${name}"`))?.[1];
const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1];
const canonicalsOf = (html) => [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/g)].map((match) => match[1]);
const internalLinksOf = (html) => [...html.matchAll(/<a[^>]*href="(\/[^"#]*)/g)].map((match) => match[1].replaceAll("&amp;", "&"));
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

function isNoindex(response, html) {
  return /noindex/i.test(response.headers.get("x-robots-tag") ?? "") || /noindex/i.test(meta(html, "name", "robots") ?? "");
}

async function checkRobots() {
  const response = await get("/robots.txt");
  const text = await response.text();
  check(response.status === 200, "robots.txt returns 200", `got ${response.status}`);
  check((response.headers.get("content-type") ?? "").startsWith("text/plain"), "robots.txt is plain text", response.headers.get("content-type") ?? "");
  check(text.includes(`Sitemap: ${PRODUCTION}/sitemap.xml`), "robots.txt names the production sitemap", text);
  check(!/^Disallow: \/\s*$/m.test(text), "robots.txt does not block the whole site", text);
  check(!/^Disallow: \/_next/m.test(text), "robots.txt does not block assets", text);
}

async function sitemapUrls() {
  const response = await get("/sitemap.xml");
  const xml = await response.text();
  check(response.status === 200, "sitemap.xml returns 200", `got ${response.status}`);
  check((response.headers.get("content-type") ?? "").includes("xml"), "sitemap.xml is served as XML", response.headers.get("content-type") ?? "");
  check(/^<\?xml[^>]*\?>\s*<urlset[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml), "sitemap.xml has an XML declaration and a urlset in the sitemap namespace", xml.slice(0, 200));
  const opened = xml.match(/<url>/g)?.length ?? 0;
  const closed = xml.match(/<\/url>/g)?.length ?? 0;
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  check(opened > 0 && opened === closed && opened === urls.length, `sitemap.xml is well formed, ${urls.length} URLs`, `${opened} open, ${closed} close, ${urls.length} loc`);
  check(new Set(urls).size === urls.length, "sitemap.xml has no duplicate URLs");
  check(urls.every((url) => url.startsWith(`${PRODUCTION}/`)), "every sitemap URL is on the production host", urls.join(" "));
  return urls;
}

async function checkPublicPage(url, seen, links) {
  const path = new URL(url).pathname;
  const response = await get(path);
  const html = await response.text();
  check(response.status === 200, `${path} returns 200 with no redirect`, `got ${response.status} ${response.headers.get("location") ?? ""}`);
  check(!isNoindex(response, html), `${path} is indexable`, `${response.headers.get("x-robots-tag") ?? ""} ${meta(html, "name", "robots") ?? ""}`);

  const canonicals = canonicalsOf(html);
  check(canonicals.length === 1 && sameUrl(canonicals[0], url),`${path} has one canonical, pointing at itself`, canonicals.join(" "));

  const title = titleOf(html);
  const description = meta(html, "name", "description");
  check(Boolean(title) && !seen.titles.has(title), `${path} has a unique title: ${title}`);
  check(Boolean(description) && !seen.descriptions.has(description), `${path} has a unique description`);
  seen.titles.add(title);
  seen.descriptions.add(description);

  check(sameUrl(meta(html, "property", "og:url"), url),`${path} og:url matches the canonical`, meta(html, "property", "og:url"));
  check(Boolean(meta(html, "property", "og:title")) && Boolean(meta(html, "property", "og:description")), `${path} has Open Graph title and description`);
  const image = meta(html, "property", "og:image");
  check(Boolean(image), `${path} has an Open Graph image`);
  if (image) {
    const imageResponse = await get(new URL(image).pathname + new URL(image).search);
    check(imageResponse.status === 200 && (imageResponse.headers.get("content-type") ?? "").startsWith("image/"), `${path} Open Graph image resolves`, `${imageResponse.status}`);
  }

  check(Boolean(meta(html, "name", "twitter:image")), `${path} has a Twitter card image`);

  check(/<h1[\s>]/.test(html),`${path} has an h1 in the initial HTML`);
  check(textOf(html).length > 400, `${path} has real text in the initial HTML, ${textOf(html).length} characters`);
  for (const link of internalLinksOf(html)) links.add(link);
  return html;
}

async function checkStructuredData(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  check(blocks.length === 1, "the homepage has one JSON-LD block", `found ${blocks.length}`);
  if (blocks.length !== 1) return;
  const parsed = JSON.parse(blocks[0]);
  const types = parsed["@graph"].map((node) => node["@type"]).join(",");
  check(types === "Organization,WebSite", "JSON-LD declares Organization and WebSite", types);
  const organization = parsed["@graph"][0];
  const logoPath = new URL(organization.logo).pathname;
  const logo = await get(logoPath);
  check(logo.status === 200 && (logo.headers.get("content-type") ?? "").startsWith("image/"), `the JSON-LD logo resolves: ${logoPath}`, `${logo.status}`);
  check(textOf(html).includes(organization.name), "the JSON-LD organization name appears on the page");
}

async function checkSignedInRoutes() {
  for (const path of SIGNED_IN_ROUTES) {
    const response = await get(path);
    const location = response.headers.get("location") ?? "";
    check([307, 308].includes(response.status) && new URL(location, base).pathname === "/login", `${path} redirects a signed-out crawler to /login`, `${response.status} ${location}`);
  }
}

async function checkNoindexRoutes() {
  for (const path of NOINDEX_ROUTES) {
    const response = await get(path);
    const html = await response.text();
    check(response.status === 200 && isNoindex(response, html), `${path} is reachable and noindex`, `${response.status}`);
    check(canonicalsOf(html).length === 0, `${path} declares no canonical`);
  }
}

async function checkErrors() {
  const missing = await get("/this-page-does-not-exist");
  const html = await missing.text();
  check(missing.status === 404, "an unknown route returns 404, not a soft 404", `got ${missing.status}`);
  check(isNoindex(missing, html), "the 404 page is noindex");

  const slash = await get("/pricing/");
  check(slash.status === 308 && new URL(slash.headers.get("location") ?? "/", base).pathname === "/pricing", "a trailing slash redirects once to the canonical URL", `${slash.status} ${slash.headers.get("location") ?? ""}`);

  const query = await get("/pricing?utm_source=test");
  check(canonicalsOf(await query.text())[0] === `${PRODUCTION}/pricing`, "a query-string URL canonicalises to the clean URL");
}

/** Every same-site link on a public page must end somewhere real, after any sign-in redirect. */
async function checkInternalLinks(links) {
  for (const link of [...links].sort()) {
    const response = await fetch(`${base}${link}`, { redirect: "follow", headers: { "User-Agent": "untiered-seo-check" } });
    check(response.status === 200, `link resolves: ${link}`, `got ${response.status}`);
  }
}

await waitForServer();
console.log(`Checking ${base}\n`);
await checkRobots();
const urls = await sitemapUrls();
const seen = { titles: new Set(), descriptions: new Set() };
const links = new Set();
for (const url of urls) {
  const html = await checkPublicPage(url, seen, links);
  if (new URL(url).pathname === "/") await checkStructuredData(html);
}
await checkSignedInRoutes();
await checkNoindexRoutes();
await checkErrors();
await checkInternalLinks(links);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
