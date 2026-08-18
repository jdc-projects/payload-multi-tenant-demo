import type { Block } from "payload";

const spacing = {
  name: "spacing",
  type: "select" as const,
  defaultValue: "md",
  options: ["none", "sm", "md", "lg"],
};

const Hero: Block = {
  slug: "hero",
  fields: [
    { name: "eyebrow", type: "text" },
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "image", type: "upload", relationTo: "media" },
    {
      name: "actions",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "href", type: "text", required: true },
      ],
    },
    spacing,
  ],
};
const RichText: Block = {
  slug: "richText",
  fields: [{ name: "content", type: "richText", required: true }, spacing],
};
const CallToAction: Block = {
  slug: "callToAction",
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "label", type: "text", required: true },
    { name: "href", type: "text", required: true },
    spacing,
  ],
};
const ImageBlock: Block = {
  slug: "image",
  fields: [
    { name: "image", type: "upload", relationTo: "media", required: true },
    { name: "alt", type: "text", required: true },
    { name: "caption", type: "text" },
    spacing,
  ],
};
const Video: Block = {
  slug: "video",
  fields: [
    { name: "video", type: "upload", relationTo: "media", required: true },
    { name: "poster", type: "upload", relationTo: "media" },
    { name: "caption", type: "text" },
    spacing,
  ],
};
const FeatureGrid: Block = {
  slug: "featureGrid",
  fields: [
    { name: "heading", type: "text" },
    {
      name: "features",
      type: "array",
      minRows: 1,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "body", type: "textarea" },
        { name: "icon", type: "text" },
      ],
    },
    spacing,
  ],
};
export const pageBlocks = [
  Hero,
  RichText,
  CallToAction,
  ImageBlock,
  Video,
  FeatureGrid,
];
