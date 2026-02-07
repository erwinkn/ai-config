#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

import { GoogleGenAI, Modality } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3-pro-image-preview";
export const ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;
export const IMAGE_SIZES = ["1K", "2K", "4K"] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type ImageSize = (typeof IMAGE_SIZES)[number];

type InlineImagePart = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export function createClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({ apiKey });
}

export function ensureFileExists(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Input file not found: ${path}`);
  }
}

export function ensureAspectRatio(value: string): asserts value is AspectRatio {
  if (!ASPECT_RATIOS.includes(value as AspectRatio)) {
    throw new Error(
      `Invalid --aspect '${value}'. Allowed values: ${ASPECT_RATIOS.join(", ")}`,
    );
  }
}

export function ensureImageSize(value: string): asserts value is ImageSize {
  if (!IMAGE_SIZES.includes(value as ImageSize)) {
    throw new Error(
      `Invalid --size '${value}'. Allowed values: ${IMAGE_SIZES.join(", ")}`,
    );
  }
}

export function inlineImagePart(path: string): InlineImagePart {
  ensureFileExists(path);
  const extension = extname(path).toLowerCase();
  const mimeType = MIME_TYPE_BY_EXTENSION[extension];
  if (!mimeType) {
    throw new Error(
      `Unsupported image extension '${extension || "(none)"}' for file: ${path}`,
    );
  }

  const data = readFileSync(path).toString("base64");
  return {
    inlineData: {
      mimeType,
      data,
    },
  };
}

function collectParts(response: any): any[] {
  const directParts = Array.isArray(response?.parts) ? response.parts : [];
  const candidateParts = Array.isArray(response?.candidates)
    ? response.candidates.flatMap((candidate: any) =>
        Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [],
      )
    : [];
  return [...directParts, ...candidateParts];
}

export function saveFirstImageFromResponse(
  response: any,
  outputPath: string,
  successMessage: string,
): string {
  const parts = collectParts(response);

  if (typeof response?.text === "string" && response.text.length > 0) {
    console.log(response.text);
  }

  for (const part of parts) {
    if (typeof part?.text === "string" && part.text.length > 0) {
      console.log(part.text);
    }
    const imageData = part?.inlineData?.data;
    if (typeof imageData === "string" && imageData.length > 0) {
      writeFileSync(outputPath, Buffer.from(imageData, "base64"));
      console.log(`${successMessage}: ${outputPath}`);
      return outputPath;
    }
  }

  throw new Error("No image was generated");
}

export const RESPONSE_MODALITIES = [Modality.TEXT, Modality.IMAGE];
