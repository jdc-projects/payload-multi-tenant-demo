import {
  Anchor,
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
  const type = block.blockType;
  if (type === "hero")
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
            {(
              block.actions as
                Array<{ label: string; href: string }> | undefined
            )?.map((action) => (
              <Button component="a" href={action.href} key={action.label}>
                {action.label}
              </Button>
            ))}
          </Group>
        </Stack>
      </Container>
    );
  if (type === "featureGrid")
    return (
      <Container size="lg" py={80}>
        <Title order={2}>{String(block.heading ?? "")}</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mt="xl">
          {(
            block.features as
              Array<{ title: string; body?: string }> | undefined
          )?.map((feature) => (
            <Card withBorder padding="xl" key={feature.title}>
              <IconCircleCheck aria-hidden size={24} />
              <Title order={3}>{feature.title}</Title>
              <Text mt="sm">{feature.body}</Text>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    );
  if (type === "callToAction")
    return (
      <Container size="lg" py={80}>
        <Card withBorder padding="xl">
          <Title order={2}>{String(block.heading)}</Title>
          <Text my="md">{String(block.body ?? "")}</Text>
          <Button component="a" href={String(block.href)}>
            {String(block.label)}
          </Button>
        </Card>
      </Container>
    );
  if (type === "image")
    return (
      <Container size="lg" py={80}>
        <Image
          src={String((block.image as { url?: string })?.url ?? "")}
          alt={String(block.alt ?? "")}
        />
        <Text size="sm">{String(block.caption ?? "")}</Text>
      </Container>
    );
  if (type === "richText")
    return (
      <Container size="lg" py={80}>
        <Text>{JSON.stringify(block.content)}</Text>
      </Container>
    );
  return null;
}
