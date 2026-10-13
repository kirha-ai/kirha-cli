# AGENTS.md

`kirha`: the KIRHA command line. It searches live, sourced data from specialized providers, with web search as fallback, and plugs KIRHA into agent tools (MCP server, agent skill).

## Using the CLI

```bash
curl -fsSL https://cli.kirha.com/install.sh | sh   # or: npm i -g @kirha/cli
kirha auth login --api-key <KEY>
kirha search "Summarize latest NVIDIA earning calls" --summarize
```

- `--focus <vertical>` is optional. Leave it out unless results are thin, then pick one with `kirha discovery verticals list`.
- `kirha plan create "<query>"` shows the steps and the cost before anything is charged, `kirha plan exec <id>` runs it.
- `kirha mcp install` adds the KIRHA MCP server to Claude Code, Codex, OpenCode, Gemini CLI or Droid. `kirha skills install` adds the agent skill.
- Every command prints JSON on stdout. The setup guide for agents is in `llms.txt`.

## Working on this repo

- Bun 1.4.3 (see `.tool-versions`), TypeScript 7, Commander, Biome. Built on the `kirha` SDK.
- `bun install`, then `bun run dev -- <args>` to run from source. CI runs `bun run typecheck`, `bun run lint` and `bun run build`.
- One file per command in `src/commands/`, registered in `src/cli.ts`. Shared code (config, auth, output) lives in `src/lib/`.
- When a flag or command changes, update `README.md` and `llms.txt` in the same change.
- Releasing: bump `version` in `package.json` and push a `v*` tag. The release workflow builds the binaries and checksums and publishes the GitHub release.
