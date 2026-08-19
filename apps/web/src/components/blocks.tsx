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
import {
  IconCircleCheck,
  IconRocket,
  IconSparkles,
  IconTarget,
} from "@tabler/icons-react";
import type { CSSProperties, ReactNode } from "react";
import { cmsUrl, type Page } from "../lib/cms";

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
  const image = block.image as { url?: string } | undefined;
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
        {image?.url ? (
          <div style={mediaFrameStyle(block.aspectRatio)}>
            <Image
              src={image.url}
              alt={String(block.heading)}
              radius="md"
              style={mediaContentStyle}
            />
          </div>
        ) : null}
        {actions?.length ? (
          <Group wrap="wrap">
            {actions.map((action) => (
              <TenantButton href={safeHref(action.href)} key={action.label}>
                {action.label}
              </TenantButton>
            ))}
          </Group>
        ) : null}
      </Stack>
    </Container>
  );
}

function FeatureGridBlock({ block }: { block: Record<string, unknown> }) {
  const features = block.features as
    Array<{ title: string; body?: string; icon?: string }> | undefined;
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      {block.heading ? <Title order={2}>{String(block.heading)}</Title> : null}
      <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
        {features?.map((feature) => {
          const FeatureIcon =
            featureIcons[feature.icon ?? ""] ?? IconCircleCheck;
          return (
            <Card withBorder padding="xl" key={feature.title}>
              <FeatureIcon aria-hidden size={24} />
              <Title order={3}>{feature.title}</Title>
              {feature.body ? <Text mt="sm">{feature.body}</Text> : null}
            </Card>
          );
        })}
      </SimpleGrid>
    </Container>
  );
}

const featureIcons: Record<string, typeof IconCircleCheck> = {
  rocket: IconRocket,
  sparkles: IconSparkles,
  target: IconTarget,
};

function CallToActionBlock({ block }: { block: Record<string, unknown> }) {
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <Card withBorder padding="xl">
        <Title order={2}>{String(block.heading)}</Title>
        {block.body ? <Text my="md">{String(block.body)}</Text> : null}
        <TenantButton href={safeHref(String(block.href))}>
          {String(block.label)}
        </TenantButton>
      </Card>
    </Container>
  );
}

function TenantButton({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Button
      component="a"
      href={href}
      color="var(--accent)"
      style={
        {
          "--button-color": "var(--accent-foreground)",
        } as CSSProperties
      }
    >
      {children}
    </Button>
  );
}

function ImageBlock({ block }: { block: Record<string, unknown> }) {
  const image = block.image as { url?: string } | undefined;
  return (
    <Container size="lg" py={spacingValue(block.spacing, "lg")}>
      <div style={mediaFrameStyle(block.aspectRatio)}>
        <Image
          src={mediaURL(image?.url)}
          alt={String(block.alt ?? "")}
          style={mediaContentStyle}
        />
      </div>
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
      <div style={mediaFrameStyle(block.aspectRatio)}>
        <video
          controls
          poster={mediaURL(poster?.url)}
          aria-label={String(block.caption || "Video")}
          style={mediaContentStyle}
        >
          <source src={mediaURL(video?.url)} />
        </video>
      </div>
      {block.caption ? (
        <Text size="sm" mt="sm">
          {String(block.caption)}
        </Text>
      ) : null}
    </Container>
  );
}

function mediaURL(value: unknown) {
  const url = String(value ?? "");
  if (!url || /^https?:\/\//.test(url)) return url;
  return new URL(url, cmsUrl).toString();
}

function mediaAspectRatio(value: unknown) {
  if (value === "4:3") return "4 / 3";
  if (value === "1:1") return "1 / 1";
  return "16 / 9";
}

function mediaFrameStyle(value: unknown): CSSProperties {
  return {
    aspectRatio: mediaAspectRatio(value),
    overflow: "hidden",
    position: "relative",
    width: "100%",
    borderRadius: "var(--mantine-radius-md)",
  };
}

const mediaContentStyle: CSSProperties = {
  display: "block",
  height: "100%",
  inset: 0,
  position: "absolute",
  width: "100%",
  objectFit: "cover",
};

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

type RichTextNode = {
  type?: string;
  text?: string;
  tag?: string;
  children?: unknown[];
};

type RichTextRenderer = (
  node: RichTextNode,
  children: ReactNode,
  key: number,
) => ReactNode;

function renderRichTextNode(node: unknown, key: number): ReactNode {
  const value = node as RichTextNode;
  const children = renderRichTextChildren(value.children);
  const render = richTextRenderers[value.type ?? ""] ?? renderRichTextParagraph;
  return render(value, children, key);
}

function renderRichTextChildren(children?: unknown[]): ReactNode {
  return children?.map((child, index) => renderRichTextNode(child, index));
}

const richTextRenderers: Record<string, RichTextRenderer> = {
  text: (node, _children, key) => <span key={key}>{node.text}</span>,
  heading: (node, children, key) => {
    const Heading = (node.tag ?? "h2") as
      "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return <Heading key={key}>{children}</Heading>;
  },
  list: (_node, children, key) => <ul key={key}>{children}</ul>,
  listitem: (_node, children, key) => <li key={key}>{children}</li>,
  link: (node, children, key) => {
    const attrs = node as RichTextNode & {
      url?: string;
      fields?: { url?: string };
    };
    return (
      <a key={key} href={safeHref(attrs.url ?? attrs.fields?.url ?? "#")}>
        {children}
      </a>
    );
  },
};

function renderRichTextParagraph(
  _node: RichTextNode,
  children: ReactNode,
  key: number,
): ReactNode {
  return <p key={key}>{children}</p>;
}
