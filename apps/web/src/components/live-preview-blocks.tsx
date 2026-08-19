"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Blocks } from "./blocks";
import type { Page } from "../lib/cms";

export function LivePreviewBlocks({ blocks }: { blocks: Page["layout"] }) {
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

      if (event.data.type === "payload-live-preview") {
        const layout = event.data.data?.layout;
        if (Array.isArray(layout)) setCurrentBlocks(layout as Page["layout"]);
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
