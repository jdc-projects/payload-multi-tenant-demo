"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Blocks } from "./blocks";
import type { Page } from "../lib/cms";
import { mergeMedia } from "../lib/live-preview";

export function LivePreviewBlocks({
  blocks,
  pageId,
  preview = false,
}: {
  blocks: Page["layout"];
  pageId?: Page["id"];
  preview?: boolean;
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
        event.data.type === "payload-live-preview" &&
        window.parent !== window &&
        (pageId === undefined ||
          !data ||
          typeof data !== "object" ||
          data.id === undefined ||
          String(data.id) !== String(pageId))
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
  }, [pageId, router]);

  useEffect(() => {
    if (!preview) return;
    const interval = window.setInterval(() => router.refresh(), 1_000);
    return () => window.clearInterval(interval);
  }, [preview, router]);

  return <Blocks blocks={currentBlocks} />;
}
