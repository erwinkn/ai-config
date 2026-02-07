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
  saveFirstImageFromResponse,
} from "./common";

function printUsage(error?: string): void {
  const stream = error ? process.stderr : process.stdout;
  if (error) {
    console.error(`Error: ${error}`);
  }
  stream.write(
    `Usage: skillx imagegen generate "prompt" [-o output.jpg] [--aspect ${ASPECT_RATIOS.join(
      "|",
    )}] [--size ${IMAGE_SIZES.join("|")}] [--model ${DEFAULT_MODEL}]\n`,
  );
}

type GenerateCliArgs = {
  prompt: string;
  outputPath: string;
  aspectRatio: string;
  imageSize: string;
  model: string;
};

type ParseResult =
  | {
      type: "ok";
      value: GenerateCliArgs;
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
      output: { type: "string", short: "o", default: "output.jpg" },
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

  if (parsed.positionals.length < 1) {
    printUsage("Missing required argument: prompt");
    return { type: "exit", code: 2 };
  }

  if (parsed.positionals.length > 1) {
    printUsage("Unexpected extra positional arguments");
    return { type: "exit", code: 2 };
  }

  ensureAspectRatio(parsed.values.aspect);
  ensureImageSize(parsed.values.size);

  return {
    type: "ok",
    value: {
      prompt: parsed.positionals[0],
      outputPath: parsed.values.output,
      aspectRatio: parsed.values.aspect,
      imageSize: parsed.values.size,
      model: parsed.values.model,
    },
  };
}

export async function runGenerate(argv: string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.type === "exit") {
      return parsed.code;
    }
    const { prompt, outputPath, aspectRatio, imageSize, model } = parsed.value;

    const client = createClient();
    const response = await client.models.generateContent({
      model,
      contents: [prompt],
      config: {
        responseModalities: RESPONSE_MODALITIES,
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    saveFirstImageFromResponse(response, outputPath, "Image saved to");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await runGenerate(process.argv.slice(2)));
}
