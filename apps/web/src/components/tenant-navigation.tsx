"use client";

import {
  Anchor,
  Box,
  Burger,
  Collapse,
  Container,
  Group,
  Stack,
  Text,
} from "@mantine/core";
import { useState } from "react";
import type { NavigationPage } from "../lib/cms";

export function TenantNavigation({
  tenant,
  pages,
  currentSlug,
}: {
  tenant: string;
  pages: NavigationPage[];
  currentSlug: string;
}) {
  const [opened, setOpened] = useState(false);
  const links = pages.map((page) => ({
    ...page,
    href: `/${tenant}/${page.slug ? `${page.slug}/` : ""}`,
  }));

  return (
    <Box
      component="header"
      py="md"
      style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
    >
      <Container size="lg">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700} component="a" href={`/${tenant}/`} c="var(--accent)">
            {pages.find((page) => page.slug === "")?.title ?? tenant}
          </Text>
          <Group gap="lg" visibleFrom="sm">
            {links.map((link) => (
              <NavigationLink
                key={link.href}
                {...link}
                active={link.slug === currentSlug}
              />
            ))}
          </Group>
          <Burger
            hiddenFrom="sm"
            opened={opened}
            onClick={() => setOpened((value) => !value)}
            aria-label={opened ? "Close navigation" : "Open navigation"}
            aria-expanded={opened}
          />
        </Group>
        <Collapse expanded={opened} hiddenFrom="sm">
          <Stack gap="sm" pt="md">
            {links.map((link) => (
              <NavigationLink
                key={link.href}
                {...link}
                active={link.slug === currentSlug}
                onClick={() => setOpened(false)}
              />
            ))}
          </Stack>
        </Collapse>
      </Container>
    </Box>
  );
}

function NavigationLink({
  title,
  href,
  active,
  onClick,
}: NavigationPage & {
  href: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Anchor
      href={href}
      onClick={onClick}
      fw={active ? 700 : 500}
      c={active ? "var(--accent)" : "inherit"}
      aria-current={active ? "page" : undefined}
    >
      {title}
    </Anchor>
  );
}
