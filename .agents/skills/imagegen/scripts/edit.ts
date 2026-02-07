#!/usr/bin/env bun

import { parseArgs } from "node:util";

import {
  DEFAULT_MODEL,
  IMAGE_SIZES,
  RESPONSE_MODALITIES,
  createClient,
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
    `Usage: skillx imagegen edit <input-image> "prompt" [-o edited.jpg] [--size ${IMAGE_SIZES.join(
      "|",
    )}] [--model ${DEFAULT_MODEL}]\n`,
  );
}

type EditCliArgs = {
  inputPath: string;
  prompt: string;
  outputPath: string;
  imageSize: string;
  model: string;
};

type ParseResult =
  | {
      type: "ok";
      value: EditCliArgs;
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
      output: { type: "string", short: "o", default: "edited.jpg" },
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
    printUsage("Missing required arguments: <input-image> and/or prompt");
    return { type: "exit", code: 2 };
  }

  if (parsed.positionals.length > 2) {
    printUsage("Unexpected extra positional arguments");
    return { type: "exit", code: 2 };
  }

  ensureImageSize(parsed.values.size);

  return {
    type: "ok",
    value: {
      inputPath: parsed.positionals[0],
      prompt: parsed.positionals[1],
      outputPath: parsed.values.output,
      imageSize: parsed.values.size,
      model: parsed.values.model,
    },
  };
}

export async function runEdit(argv: string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.type === "exit") {
      return parsed.code;
    }
    const { inputPath, prompt, outputPath, imageSize, model } = parsed.value;

    const client = createClient();
    const response = await client.models.generateContent({
      model,
      contents: [prompt, inlineImagePart(inputPath)],
      config: {
        responseModalities: RESPONSE_MODALITIES,
        imageConfig: {
          imageSize,
        },
      },
    });

    saveFirstImageFromResponse(response, outputPath, "Edited image saved to");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await runEdit(process.argv.slice(2)));
}
