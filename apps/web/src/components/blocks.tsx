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
    <Container size="lg" py={100}>
      <Stack gap="lg">
        <Text tt="uppercase" fw={700} c="dimmed">
          {String(block.eyebrow ?? "")}
        </Text>
        <Title order={1} size="clamp(2.5rem, 8vw, 6rem)">
          {String(block.heading)}
        </Title>
        <Text size="xl" maw={650}>
          {String(block.body ?? "")}
        </Text>
        <Group>
          {actions?.map((action) => (
            <Button
              component="a"
              href={safeHref(action.href)}
              key={action.label}
            >
              {action.label}
            </Button>
          ))}
        </Group>
      </Stack>
    </Container>
  );
}

function FeatureGridBlock({ block }: { block: Record<string, unknown> }) {
  const features = block.features as
    Array<{ title: string; body?: string }> | undefined;
  return (
    <Container size="lg" py={80}>
      <Title order={2}>{String(block.heading ?? "")}</Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
        {features?.map((feature) => (
          <Card withBorder padding="xl" key={feature.title}>
            <IconCircleCheck aria-hidden size={24} />
            <Title order={3}>{feature.title}</Title>
            <Text mt="sm">{feature.body}</Text>
          </Card>
        ))}
      </SimpleGrid>
    </Container>
  );
}

function CallToActionBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={80}>
      <Card withBorder padding="xl">
        <Title order={2}>{String(block.heading)}</Title>
        <Text my="md">{String(block.body ?? "")}</Text>
        <Button component="a" href={safeHref(String(block.href))}>
          {String(block.label)}
        </Button>
      </Card>
    </Container>
  );
}

function ImageBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={80}>
      <Image
        src={String((block.image as { url?: string })?.url ?? "")}
        alt={String(block.alt ?? "")}
      />
      <Text size="sm">{String(block.caption ?? "")}</Text>
    </Container>
  );
}

function VideoBlock({ block }: { block: Record<string, unknown> }) {
  const video = block.video as { url?: string } | undefined;
  const poster = block.poster as { url?: string } | undefined;
  return (
    <Container size="lg" py={80}>
      <video controls poster={poster?.url} style={{ width: "100%" }}>
        <source src={video?.url} />
      </video>
      <Text size="sm">{String(block.caption ?? "")}</Text>
    </Container>
  );
}

function RichTextBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={80}>
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
  return <p key={key}>{children}</p>;
}
