export function mediaMaxWidth(value: unknown) {
  if (value === "large") return "85%";
  if (value === "medium") return "70%";
  if (value === "narrow") return "50%";
  return "100%";
}
