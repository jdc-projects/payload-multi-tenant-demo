import { RootPage } from "@payloadcms/next/views";
import config from "@payload-config";
import { importMap } from "../importMap.js";

export default function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
}) {
  return (
    <RootPage
      config={config}
      importMap={importMap}
      params={params}
      searchParams={searchParams}
    />
  );
}
