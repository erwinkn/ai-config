#!/usr/bin/env bun

import { runCompose } from "./compose";
import { runEdit } from "./edit";
import { runGenerate } from "./generate";

const COMMANDS = new Set(["compose", "edit", "generate"]);

function printUsage(error?: string): void {
  const stream = error ? process.stderr : process.stdout;
  if (error) {
    console.error(`Error: ${error}`);
  }
  stream.write("Usage: skillx imagegen <command> [args...]\n");
  stream.write("Commands: compose, edit, generate\n");
  stream.write(
    'Example: skillx imagegen generate "A sunset over mountains" -o sunset.jpg\n',
  );
}

export async function runMain(argv: string[]): Promise<number> {
  if (argv.length === 0 || ["help", "-h", "--help"].includes(argv[0])) {
    printUsage();
    return 0;
  }

  const [command, ...args] = argv;
  if (!COMMANDS.has(command)) {
    printUsage(`unknown command '${command}'`);
    return 2;
  }

  if (command === "generate") {
    return runGenerate(args);
  }
  if (command === "edit") {
    return runEdit(args);
  }
  return runCompose(args);
}

if (import.meta.main) {
  process.exit(await runMain(process.argv.slice(2)));
}
