import { spawn } from "node:child_process";
import type { Command } from "commander";
import { CliError } from "../lib/errors.ts";

const SKILLS_REPO = "kirha-ai/kirha-skill";

interface SkillsInstallFlags {
  agent?: string;
  global?: boolean;
  yes?: boolean;
  copy?: boolean;
}

function runSkillsAdd(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["skills", "add", ...args], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new CliError(
            "INTERNAL",
            "npx not found. Install Node.js (https://nodejs.org) to use `kirha skills install`.",
          ),
        );
        return;
      }
      reject(new CliError("INTERNAL", `Failed to spawn npx: ${err.message}`));
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

export function registerSkills(program: Command): void {
  const skills = program
    .command("skills")
    .description("Install Kirha skills into AI coding agents");

  skills
    .command("install")
    .description(`Install Kirha skills from ${SKILLS_REPO}`)
    .option(
      "-a, --agent <names>",
      "Target agents, comma-separated (e.g. claude-code,cursor). Omit to auto-detect or pick interactively.",
    )
    .option("-g, --global", "Install to user directory instead of current project")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--copy", "Copy files instead of symlinking")
    .action(async (flags: SkillsInstallFlags) => {
      const args: string[] = [SKILLS_REPO];

      if (flags.agent) {
        const agents = flags.agent
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
        if (agents.length > 0) args.push("--agent", ...agents);
      }
      if (flags.global) args.push("--global");
      if (flags.yes) args.push("--yes");
      if (flags.copy) args.push("--copy");

      const code = await runSkillsAdd(args);
      if (code !== 0) {
        throw new CliError("API_ERROR", `skills add exited with code ${code}`);
      }
    });
}
