const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

/** Pick readable text for a tenant's filled accent color. */
export function accessibleTextColor(color?: string): "#000" | "#fff" {
  if (!color || !HEX_COLOR.test(color)) return "#fff";
  const value = color.slice(1);
  const channels =
    value.length === 3
      ? value.split("").map((channel) => parseInt(channel + channel, 16))
      : [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  const [red, green, blue] = channels.map((channel) => channel / 255);
  const luminance = [red, green, blue].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] >
    0.179
    ? "#000"
    : "#fff";
}
