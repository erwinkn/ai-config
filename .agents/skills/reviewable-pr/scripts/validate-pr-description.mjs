#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const options = {
    bodyPath: null,
    repo: null,
    pr: null,
    diagramsReviewed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo") {
      options.repo = argv[++index];
    } else if (argument === "--pr") {
      options.pr = argv[++index];
    } else if (argument === "--diagrams-reviewed") {
      options.diagramsReviewed = true;
    } else if (argument === "--help" || argument === "-h") {
      process.stdout.write(
        "Usage: validate-pr-description.mjs [BODY_FILE|-] --repo OWNER/REPO --pr NUMBER [--diagrams-reviewed]\n",
      );
      process.exit(0);
    } else if (argument.startsWith("--")) {
      fail(`Unknown option: ${argument}`);
    } else if (options.bodyPath === null) {
      options.bodyPath = argument;
    } else {
      fail(`Unexpected argument: ${argument}`);
    }
  }

  if (!options.repo || !options.pr) {
    fail("Use --repo and --pr for every validation.");
  }

  return options;
}

function readStdin() {
  return readFileSync(0, "utf8");
}

function loadPullRequest(repo, pr) {
  const output = execFileSync(
    "gh",
    ["pr", "view", String(pr), "--repo", repo, "--json", "body,files,url"],
    { encoding: "utf8" },
  );
  return JSON.parse(output);
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function stripProse(body) {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("|"))
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/!??\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function importantCallout(body) {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === "> [!IMPORTANT]");
  if (start === -1) return null;

  const callout = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!lines[index].startsWith(">")) break;
    callout.push(lines[index]);
  }
  return callout.join("\n");
}

function validate(body, pullRequest, options) {
  const errors = [];
  const warnings = [];
  const mermaidDiagrams = count(body, /```mermaid\r?\n[\s\S]*?```/g);

  if (mermaidDiagrams > 0 && !options.diagramsReviewed) {
    errors.push(
      `Render and visually inspect all ${mermaidDiagrams} Mermaid diagram(s), then use --diagrams-reviewed.`,
    );
  }
  if (mermaidDiagrams === 0 && options.diagramsReviewed) {
    errors.push("Remove --diagrams-reviewed because the body has no Mermaid diagrams.");
  }

  const requiredHeadings = [
    "## Overview",
    "### Decision map",
    "## Review walkthrough",
    "## Decision record",
    "## Deliberate non-goals",
    "## Evidence and verification",
  ];

  let lastHeadingIndex = -1;
  for (const heading of requiredHeadings) {
    const matches = body.split(heading).length - 1;
    if (matches !== 1) {
      errors.push(`${heading}: expected one occurrence, found ${matches}`);
      continue;
    }
    const headingIndex = body.indexOf(heading);
    if (headingIndex < lastHeadingIndex) {
      errors.push(`${heading}: heading order is incorrect`);
    }
    lastHeadingIndex = headingIndex;
  }

  const h2Headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  const duplicateH2 = [...new Set(h2Headings)].filter(
    (heading) => h2Headings.filter((candidate) => candidate === heading).length > 1,
  );
  if (duplicateH2.length) {
    errors.push(`Duplicate level-two headings: ${duplicateH2.join(", ")}`);
  }

  if (/^## Evidence$/m.test(body) || /^## Stack and verification$/m.test(body)) {
    errors.push("Use only the final 'Evidence and verification' section.");
  }
  if (body.includes("<kbd>VERIFY</kbd>")) {
    errors.push("Remove the VERIFY walkthrough panel.");
  }

  const details = count(body, /<details>/g);
  const closes = count(body, /<\/details>/g);
  const summaries = count(body, /<summary>/g);
  const spacedSummaries = count(body, /<\/summary>\n\n<br \/>\n\n/g);
  const openDetails = count(body, /<details\s+open(?:\s|>)/g);

  if (details !== closes || details !== summaries) {
    errors.push(
      `Collapsible sections are unbalanced: details=${details}, summaries=${summaries}, closes=${closes}`,
    );
  }
  if (openDetails !== 0) {
    errors.push(`All collapsible sections must start closed. Found ${openDetails} open sections.`);
  }
  if (spacedSummaries !== summaries) {
    errors.push(
      `Each summary needs a blank line, <br />, and another blank line. Found ${spacedSummaries}/${summaries}.`,
    );
  }

  const callout = importantCallout(body);
  if (!callout) {
    errors.push("Add an IMPORTANT callout with the pull request review order.");
  } else {
    const references = count(callout, /PR #\d+/g);
    const links = count(
      callout,
      /\[PR #\d+\]\(https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\)/g,
    );
    if (references === 0 || references !== links) {
      errors.push("Link every pull request number in the IMPORTANT callout.");
    }
    if (callout.includes("`") || callout.includes("→")) {
      errors.push("Keep branch names and design details out of the IMPORTANT callout.");
    }
    const calloutInstruction = callout
      .split("\n")
      .slice(1)
      .map((line) => line.replace(/^>\s?/, ""))
      .join(" ")
      .replace(
        /\[PR #\d+\]\(https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+\)/g,
        "PR",
      )
      .trim();
    if (!/^Review PR(?: first)?(?:\. Then, review PR)*\.$/.test(calloutInstruction)) {
      errors.push("Keep only the linked pull request review order in the IMPORTANT callout.");
    }
    const linkedPullRequests = [
      ...callout.matchAll(
        /\[PR #(\d+)\]\(https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)\)/g,
      ),
    ];
    const mismatchedLabels = linkedPullRequests.filter(
      (match) => match[1] !== match[3],
    );
    if (mismatchedLabels.length) {
      errors.push("Match each linked pull request label to its URL number.");
    }
    if (
      options.repo &&
      linkedPullRequests.some((match) => match[2] !== options.repo)
    ) {
      errors.push(`Link only pull requests from ${options.repo} in the IMPORTANT callout.`);
    }
    if (
      pullRequest &&
      !callout.includes(`[PR #${options.pr}](${pullRequest.url})`)
    ) {
      errors.push(`Link the current pull request as [PR #${options.pr}](${pullRequest.url}).`);
    }
  }

  const placeholders = [...body.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]);
  if (placeholders.length) {
    errors.push(`Replace template placeholders: ${[...new Set(placeholders)].join(", ")}`);
  }

  const vaguePatterns = [
    /\b(?:the|these|those|all)\s+(?:two|three|four|five|six|seven|eight|nine|ten)\s+[a-z-]+/gi,
    /\bprovides?\s+(?:two|three|four|five|six|seven|eight|nine|ten)\s+[a-z-]+/gi,
    /\b(?:same behavior|same transport|affected callers?|applicable path|both registries)\b/gi,
  ];
  const vagueMatches = vaguePatterns.flatMap((pattern) => body.match(pattern) || []);
  if (vagueMatches.length) {
    errors.push(`Replace vague count or reference phrases: ${[...new Set(vagueMatches)].join(", ")}`);
  }

  const prose = stripProse(body);
  const semicolonLines = prose
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => text.includes(";"));
  if (semicolonLines.length) {
    errors.push(
      `Remove prose semicolons from lines: ${semicolonLines.map(({ line }) => line).join(", ")}`,
    );
  }

  const longSentences = prose
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((sentence) => ({
      sentence: sentence.replace(/\s+/g, " ").trim(),
      words: (sentence.match(/\b[\w#<>-]+\b/g) || []).length,
    }))
    .filter(({ sentence, words }) => sentence && words > 25);
  if (longSentences.length) {
    errors.push(
      ...longSentences.map(
        ({ sentence, words }) => `Sentence has ${words} words: ${sentence}`,
      ),
    );
  }

  const passiveMatches = prose.match(
    /\b(?:is|are|was|were|be|been|being)\s+[a-z]+(?:ed|en)\b/gi,
  );
  if (passiveMatches) {
    warnings.push(
      `Review possible passive voice: ${[...new Set(passiveMatches)].join(", ")}`,
    );
  }

  let linkedFiles = null;
  if (pullRequest && options.repo && options.pr) {
    const missingFiles = pullRequest.files.filter(({ path }) => {
      const anchor = createHash("sha256").update(path).digest("hex");
      return !body.includes(`${pullRequest.url}/files#diff-${anchor}`);
    });
    linkedFiles = pullRequest.files.length - missingFiles.length;
    if (missingFiles.length) {
      errors.push(
        `Add direct diff links for changed files: ${missingFiles.map(({ path }) => path).join(", ")}`,
      );
    }

    try {
      execFileSync("gh", ["api", "--method", "POST", "markdown", "--input", "-"], {
        input: JSON.stringify({ text: body, mode: "gfm", context: options.repo }),
        stdio: ["pipe", "ignore", "pipe"],
      });
    } catch (error) {
      errors.push(`GitHub Markdown rendering failed: ${error.message}`);
    }
  }

  return {
    errors,
    warnings,
    metrics: {
      details,
      summaries,
      mermaidDiagrams,
      changedFiles: pullRequest?.files.length ?? null,
      linkedFiles,
    },
  };
}

const options = parseArgs(process.argv.slice(2));
let pullRequest = null;
if (options.repo && options.pr) {
  pullRequest = loadPullRequest(options.repo, options.pr);
}

let body;
if (options.bodyPath === "-") {
  body = readStdin();
} else if (options.bodyPath) {
  body = readFileSync(options.bodyPath, "utf8");
} else {
  body = pullRequest.body;
}

const result = validate(body, pullRequest, options);
for (const warning of result.warnings) {
  process.stderr.write(`WARNING: ${warning}\n`);
}
for (const error of result.errors) {
  process.stderr.write(`ERROR: ${error}\n`);
}

if (result.errors.length) {
  process.stderr.write(`Validation failed with ${result.errors.length} error(s).\n`);
  process.exit(1);
}

const fileSummary =
  result.metrics.changedFiles === null
    ? "file coverage not checked"
    : `${result.metrics.linkedFiles}/${result.metrics.changedFiles} changed files linked`;
const diagramSummary =
  result.metrics.mermaidDiagrams === 0
    ? "no Mermaid diagrams"
    : `${result.metrics.mermaidDiagrams} Mermaid diagram(s) acknowledged as visually reviewed`;
process.stdout.write(
  `PR description is valid: ${result.metrics.details} collapsed sections, ${fileSummary}, ${diagramSummary}.\n`,
);
