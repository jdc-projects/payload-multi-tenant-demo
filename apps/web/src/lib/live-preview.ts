type PreviewBlock = Record<string, unknown>;

export function mergeMedia(
  current: PreviewBlock[],
  incoming: PreviewBlock[],
): PreviewBlock[] {
  return incoming.map((block) => {
    const blockID = block.id;
    const previous =
      blockID === undefined
        ? undefined
        : current.find((item) => String(item.id) === String(blockID));
    if (!previous) return block;

    const merged = { ...block };
    for (const field of ["image", "video", "poster"]) {
      const nextMedia = block[field];
      const previousMedia = previous[field] as
        { id?: unknown; url?: unknown } | undefined;
      if (
        nextMedia === undefined &&
        previousMedia &&
        typeof previousMedia.url === "string"
      )
        merged[field] = previousMedia;
      else if (
        nextMedia &&
        typeof nextMedia === "object" &&
        previousMedia &&
        typeof previousMedia === "object" &&
        typeof previousMedia.url === "string" &&
        "id" in nextMedia &&
        String(nextMedia.id) === String(previousMedia.id)
      )
        merged[field] = previousMedia;
      else if (
        (typeof nextMedia === "string" || typeof nextMedia === "number") &&
        previousMedia &&
        String(nextMedia) === String(previousMedia.id) &&
        typeof previousMedia.url === "string"
      )
        merged[field] = previousMedia;
    }
    return merged;
  });
}
