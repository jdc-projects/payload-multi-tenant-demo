import { cmsUrl } from "./cms-url";

export function mediaURL(value: unknown) {
  const url = String(value ?? "");
  if (!url || /^https?:\/\//.test(url)) return url;
  return new URL(url, cmsUrl).toString();
}
