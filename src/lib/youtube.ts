const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const hasValidHost = (host: string) =>
  YOUTUBE_HOSTS.has(host) || host.endsWith(".youtube.com");

const firstPathSegment = (pathname: string) =>
  pathname
    .split("/")
    .filter(Boolean)
    .at(0);

export function parseYouTubeUrl(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (!hasValidHost(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);

  // youtu.be/<id>
  if (url.hostname.includes("youtu.be")) {
    return segments[0] || null;
  }

  // Shorts: youtube.com/shorts/<id>
  if (segments[0] === "shorts" && segments[1]) {
    return segments[1];
  }

  // Embedded: youtube.com/embed/<id>
  if (segments[0] === "embed" && segments[1]) {
    return segments[1];
  }

  // Standard watch URLs with ?v=
  const vParam = url.searchParams.get("v");
  if (vParam) return vParam;

  // Legacy /v/<id>
  if (segments[0] === "v" && segments[1]) {
    return segments[1];
  }

  // Fallback: if first path segment looks like an ID, return it.
  const candidate = firstPathSegment(url.pathname);
  if (candidate && candidate !== "watch") {
    return candidate;
  }

  return null;
}

export function isValidYouTubeUrl(raw: string): boolean {
  const id = parseYouTubeUrl(raw);
  return Boolean(id && id.trim().length > 0);
}
