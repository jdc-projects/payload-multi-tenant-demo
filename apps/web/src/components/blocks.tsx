import {
  Button,
  Card,
  Container,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { Page } from "../lib/cms";

export function Blocks({ blocks }: { blocks: Page["layout"] }) {
  return (
    <Stack gap={0}>
      {blocks.map((block) => (
        <Block key={String(block.id ?? block.blockType)} block={block} />
      ))}
    </Stack>
  );
}

function Block({ block }: { block: Record<string, unknown> }) {
  switch (block.blockType) {
    case "hero":
      return <HeroBlock block={block} />;
    case "featureGrid":
      return <FeatureGridBlock block={block} />;
    case "callToAction":
      return <CallToActionBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "video":
      return <VideoBlock block={block} />;
    case "richText":
      return <RichTextBlock block={block} />;
    default:
      return null;
  }
}

function HeroBlock({ block }: { block: Record<string, unknown> }) {
  const actions = block.actions as
    Array<{ label: string; href: string }> | undefined;
  return (
    <Container size="lg" py={spacingValue(block.spacing, "xl")}>
      <Stack gap="lg">
        {block.eyebrow ? (
          <Text tt="uppercase" fw={700} c="dimmed" size="sm">
            {String(block.eyebrow)}
          </Text>
        ) : null}
        <Title order={1} size="clamp(2.5rem, 8vw, 6rem)">
          {String(block.heading)}
        </Title>
        {block.body ? (
          <Text size="xl" maw={650}>
            {String(block.body)}
          </Text>
        ) : null}
        {actions?.length ? (
          <Group wrap="wrap">
            {actions.map((action) => (
              <Button
                component="a"
                href={safeHref(action.href)}
                key={action.label}
                color="var(--accent)"
              >
                {action.label}
              </Button>
            ))}
          </Group>
        ) : null}
      </Stack>
    </Container>
  );
}

function FeatureGridBlock({ block }: { block: Record<string, unknown> }) {
  const features = block.features as
    Array<{ title: string; body?: string }> | undefined;
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      {block.heading ? <Title order={2}>{String(block.heading)}</Title> : null}
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
        {features?.map((feature) => (
          <Card withBorder padding="xl" key={feature.title}>
            <IconCircleCheck aria-hidden size={24} />
            <Title order={3}>{feature.title}</Title>
            {feature.body ? <Text mt="sm">{feature.body}</Text> : null}
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}

function CallToActionBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <Card withBorder padding="xl">
        <Title order={2}>{String(block.heading)}</Title>
        {block.body ? <Text my="md">{String(block.body)}</Text> : null}
        <Button
          component="a"
          href={safeHref(String(block.href))}
          color="var(--accent)"
        >
          {String(block.label)}
        </Button>
      </Card>
    </Container>
  );
}

function ImageBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <Image
        src={String((block.image as { url?: string })?.url ?? "")}
        alt={String(block.alt ?? "")}
      />
      {block.caption ? (
        <Text size="sm" mt="sm">
          {String(block.caption)}
        </Text>
      ) : null}
    </Container>
  );
}

function VideoBlock({ block }: { block: Record<string, unknown> }) {
  const video = block.video as { url?: string } | undefined;
  const poster = block.poster as { url?: string } | undefined;
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <video
        controls
        poster={poster?.url}
        aria-label={String(block.caption || "Video")}
        style={{
          width: "100%",
          display: "block",
          borderRadius: "var(--mantine-radius-md)",
        }}
      >
        <source src={video?.url} />
      </video>
      {block.caption ? (
        <Text size="sm" mt="sm">
          {String(block.caption)}
        </Text>
      ) : null}
    </Container>
  );
}

function RichTextBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <Stack>{renderRichText(block.content)}</Stack>
    </Container>
  );
}

function safeHref(value: string) {
  try {
    const url = new URL(value, "http://local.invalid");
    if (["http:", "https:", "mailto:", "tel:"].includes(url.protocol))
      return value;
    if (value.startsWith("/") || value.startsWith("#")) return value;
  } catch {
    return "#";
  }
  return "#";
}

function spacingValue(value: unknown, fallback: "lg" | "xl") {
  if (value === "none") return 0;
  if (value === "sm") return "md";
  if (value === "md") return "lg";
  if (value === "lg") return "xl";
  return fallback;
}

function renderRichText(content: unknown): ReactNode {
  const root = (content as { root?: { children?: unknown[] } } | undefined)
    ?.root;
  return (
    root?.children?.map((node, index) => renderRichTextNode(node, index)) ??
    null
  );
}

function renderRichTextNode(node: unknown, key: number): ReactNode {
  const value = node as {
    type?: string;
    text?: string;
    tag?: string;
    children?: unknown[];
  };
  const children = value.children?.map((child, index) =>
    renderRichTextNode(child, index),
  );
  if (value.type === "text") return <span key={key}>{value.text}</span>;
  if (value.type === "heading") {
    const Heading = (value.tag ?? "h2") as
      "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return <Heading key={key}>{children}</Heading>;
  }
  if (value.type === "list") return <ul key={key}>{children}</ul>;
  if (value.type === "listitem") return <li key={key}>{children}</li>;
  if (value.type === "link") {
    const attrs = node as { url?: string; fields?: { url?: string } };
    return (
      <a key={key} href={safeHref(attrs.url ?? attrs.fields?.url ?? "#")}>
        {children}
      </a>
    );
  }
  return <p key={key}>{children}</p>;
}
