import { cmsUrl } from "./cms-url";

export function mediaURL(value: unknown) {
  const url = String(value ?? "");
  if (!url) return url;
  try {
    const parsed = new URL(url, cmsUrl);
    if (
      parsed.pathname.startsWith("/api/media/file/") &&
      (!/^https?:\/\//.test(url) || parsed.origin === new URL(cmsUrl).origin)
    )
      return `/media/${parsed.pathname.slice("/api/media/file/".length)}${parsed.search}${parsed.hash}`;
    return parsed.toString();
  } catch {
    return url;
  }
}
