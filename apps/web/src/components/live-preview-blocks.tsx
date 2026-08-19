"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Blocks } from "./blocks";
import type { Page } from "../lib/cms";

export function LivePreviewBlocks({
  blocks,
  pageId,
}: {
  blocks: Page["layout"];
  pageId?: Page["id"];
}) {
  const router = useRouter();
  const [currentBlocks, setCurrentBlocks] = useState(blocks);

  useEffect(() => {
    const parentOrigin = (() => {
      if (!document.referrer) return undefined;
      try {
        return new URL(document.referrer).origin;
      } catch {
        return undefined;
      }
    })();
    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        (parentOrigin && event.origin !== parentOrigin)
      )
        return;
      if (!event.data || typeof event.data !== "object") return;
      const data = event.data.data;
      if (
        pageId !== undefined &&
        data &&
        typeof data === "object" &&
        data.id !== undefined &&
        String(data.id) !== String(pageId)
      )
        return;

      if (event.data.type === "payload-live-preview") {
        const layout = data?.layout;
        if (Array.isArray(layout))
          setCurrentBlocks((current) =>
            mergeMedia(current, layout as Page["layout"]),
          );
      } else if (event.data.type === "payload-document-event") {
        router.refresh();
      }
    };

    window.addEventListener("message", handleMessage);
    if (window.parent !== window)
      window.parent.postMessage(
        { type: "payload-live-preview", ready: true },
        parentOrigin ?? "*",
      );
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

  return <Blocks blocks={currentBlocks} />;
}

function mergeMedia(
  current: Page["layout"],
  incoming: Page["layout"],
): Page["layout"] {
  return incoming.map((block, index) => {
    const previous = current[index];
    if (!previous) return block;
    const merged = { ...block };
    for (const field of ["image", "video", "poster"]) {
      const nextMedia = block[field] as { url?: unknown } | undefined;
      const previousMedia = previous[field] as { url?: unknown } | undefined;
      if (
        previousMedia &&
        typeof previousMedia === "object" &&
        typeof previousMedia.url === "string" &&
        (!nextMedia ||
          typeof nextMedia !== "object" ||
          typeof nextMedia.url !== "string")
      )
        merged[field] = previousMedia;
    }
    return merged;
  });
}
