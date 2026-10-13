# AGENTS.md

`kirha`: the KIRHA command line. It searches live, sourced data from specialized providers, with web search as fallback, and plugs KIRHA into agent tools (MCP server, agent skill).

- Get an API key: https://app.kirha.com/api-keys
- CLI docs: https://docs.kirha.com/cli.mdx
- Setup guide for agents: `llms.txt` in this repo

```bash
curl -fsSL https://cli.kirha.com/install.sh | sh   # or: npm i -g @kirha/cli
kirha auth login --api-key <KEY>
kirha search "Summarize latest NVIDIA earning calls" --summarize
```

- `--focus <vertical>` is optional. Leave it out unless results are thin, then pick one with `kirha discovery verticals list`.
- `kirha plan create "<query>"` shows the steps and the cost before anything is charged, `kirha plan exec <id>` runs it.
- `kirha mcp install` adds the KIRHA MCP server to Claude Code, Codex, OpenCode, Gemini CLI or Droid. `kirha skills install` adds the agent skill.
- Every command prints JSON on stdout.
