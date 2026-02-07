#!/usr/bin/env bun

import { parseArgs } from "node:util";

import {
  ASPECT_RATIOS,
  DEFAULT_MODEL,
  IMAGE_SIZES,
  RESPONSE_MODALITIES,
  createClient,
  ensureAspectRatio,
  ensureImageSize,
  inlineImagePart,
  saveFirstImageFromResponse,
} from "./common";

function printUsage(error?: string): void {
  const stream = error ? process.stderr : process.stdout;
  if (error) {
    console.error(`Error: ${error}`);
  }
  stream.write(
    `Usage: skillx imagegen compose "prompt" <input1> [input2 ...] [-o composed.jpg] [--aspect ${ASPECT_RATIOS.join(
      "|",
    )}] [--size ${IMAGE_SIZES.join("|")}]\n`,
  );
}

type ComposeCliArgs = {
  prompt: string;
  inputPaths: string[];
  outputPath: string;
  aspectRatio: string;
  imageSize: string;
  model: string;
};

type ParseResult =
  | {
      type: "ok";
      value: ComposeCliArgs;
    }
  | {
      type: "exit";
      code: number;
    };

function parseCliArgs(argv: string[]): ParseResult {
  const parsed = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o", default: "composed.jpg" },
      aspect: { type: "string", default: "1:1" },
      size: { type: "string", default: "1K" },
      model: { type: "string", default: DEFAULT_MODEL },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (parsed.values.help) {
    printUsage();
    return { type: "exit", code: 0 };
  }

  if (parsed.positionals.length < 2) {
    printUsage("Missing required arguments: prompt and at least one input image");
    return { type: "exit", code: 2 };
  }

  ensureAspectRatio(parsed.values.aspect);
  ensureImageSize(parsed.values.size);

  return {
    type: "ok",
    value: {
      prompt: parsed.positionals[0],
      inputPaths: parsed.positionals.slice(1),
      outputPath: parsed.values.output,
      aspectRatio: parsed.values.aspect,
      imageSize: parsed.values.size,
      model: parsed.values.model,
    },
  };
}

export async function runCompose(argv: string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.type === "exit") {
      return parsed.code;
    }
    const { prompt, inputPaths, outputPath, aspectRatio, imageSize, model } =
      parsed.value;

    if (inputPaths.length > 14) {
      throw new Error("Maximum 14 input images allowed");
    }

    const client = createClient();
    const response = await client.models.generateContent({
      model,
      contents: [prompt, ...inputPaths.map(inlineImagePart)],
      config: {
        responseModalities: RESPONSE_MODALITIES,
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    saveFirstImageFromResponse(response, outputPath, "Composed image saved to");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await runCompose(process.argv.slice(2)));
}
