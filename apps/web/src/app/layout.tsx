import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payload multi-tenant demo",
  description: "A thin client website builder demo.",
};
const theme = createTheme({
  fontFamily: "Inter, system-ui, sans-serif",
  headings: { fontFamily: "inherit", fontWeight: "700" },
  primaryColor: "indigo",
  defaultRadius: "md",
});
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MantineProvider theme={theme}>{children}</MantineProvider>
      </body>
    </html>
  );
}
