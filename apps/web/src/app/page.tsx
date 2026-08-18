import { Anchor, Container, Stack, Title } from "@mantine/core";
export default function Home() {
  return (
    <Container py={100}>
      <Stack>
        <Title>Payload multi-tenant demo</Title>
        <Anchor href="/demo1/">Open demo tenant</Anchor>
      </Stack>
    </Container>
  );
}
