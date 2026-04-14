<p align="center">
  <img src="./assets/banner.png" alt="Kirha CLI" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@kirha/cli"><img src="https://img.shields.io/npm/v/@kirha/cli" alt="npm version" /></a>
  <a href="https://github.com/kirha-ai/kirha-cli/actions/workflows/ci.yml"><img src="https://github.com/kirha-ai/kirha-cli/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@kirha/cli"><img src="https://img.shields.io/npm/dm/@kirha/cli" alt="npm downloads" /></a>
</p>

<p align="center">
  <a href="https://kirha.com"><b>🦋 Kirha</b></a> &bull;
  <a href="https://docs.kirha.com"><b>📚 Documentation</b></a> &bull;
  <a href="https://app.kirha.com/auth/register"><b>🔑 Get an API key</b></a>
</p>

---

# Kirha CLI

Run [Kirha](https://kirha.com) from your terminal.

```bash
curl -fsSL https://cli.kirha.com/install.sh | sh
```

> [!TIP]
> **Let your AI coding agent do the setup for you.** Tell it:
>
> > *Fetch https://cli.kirha.com/llms.txt and follow it.*
>
> It will install the CLI, wire up the Kirha skill in your editor, and walk you through creating an API key — all from inside your existing agent session.

Anything you can do with the SDK you can do here: search, run research tasks, preview plans, call individual tools. From your shell, in scripts, or wired into whatever you're building.

## Install

The curl command at the top drops a single binary at `~/.kirha/bin/kirha` and adds it to your `PATH`. Prefer something else?

```bash
npm install -g @kirha/cli       # via npm
npx @kirha/cli search "..."     # one-off, no install
```

Once the `kirha` command is on your `PATH`, finish setup:

### 1. Authenticate

Grab a key from [app.kirha.com](https://app.kirha.com/auth/register), then save it locally:

```bash
kirha auth login --api-key sk-...
```

Your key lives in `~/.config/kirha/auth.json` and only your user can read it. If you'd rather not store it, you can pass `--api-key` per call or set `KIRHA_API_KEY` in your env. The CLI checks them in this order: `--api-key` flag, then the file, then the env var.

### 2. Install the Kirha skill in your editor (optional)

If you're using Claude Code, Cursor, Codex, Cline, or another agent with skill support, install the Kirha skill so your agent can query Kirha directly inside your sessions:

```bash
kirha skills install                              # auto-detect installed agents
kirha skills install --agent claude-code --yes    # target a specific agent
kirha skills install --agent claude-code,cursor   # several at once
```

Valid agent ids come from [skills.sh](https://skills.sh) — anything listed there works. This wraps `npx skills add kirha-ai/kirha-skill`, so you need Node available.

### 3. Run your first search

```bash
kirha search "What's the largest USDC holder on Base?" --vertical crypto
```

If you're going to use the same vertical a lot, save it as a default so you don't have to repeat it every time:

```bash
kirha config set vertical crypto
kirha search "What's the largest USDC holder on Base?"
```

## What you can do

Everything below assumes you've set a default vertical. If not, add `--vertical <id>` to the command.

**Search:**

```bash
kirha search "Top 5 ETH validators by stake"

# With a summary instead of just raw data — defaults to kirha-flash
kirha search "..." --summarize

# Or pick the model explicitly
kirha search "..." --summarize kirha

# Custom summary instructions
kirha search "..." --summarize --instruction "Format as a markdown table"

# Pick a planning runtime (default: fast)
kirha search "..." --runtime standard         # standard | fast | deterministic
```

The planning runtime controls how Kirha plans your query. `fast` is the default and is what you want most of the time. Save a different default with `kirha config set runtime standard`, or set `KIRHA_RUNTIME` in your env.

**Preview a query before running it.** `plan create` shows you the steps Kirha will take and the estimated credit cost — useful before kicking off something expensive. When you're happy, `plan exec` runs the exact plan you previewed:

```bash
kirha plan create "Compare ETH vs Base trading volume"
# → { "id": "plan_...", "steps": [...], "usage": {...} }

kirha plan exec plan_abc123
# → the final SearchResult
```

**Long-running research tasks.** These can take a few minutes. `task run` creates the task and waits for it; `task create` kicks it off and returns an id you can poll later:

```bash
# One-shot: kick it off and wait
kirha task run "Compare the AI strategies of Google, Microsoft, and Meta"

# Or fire-and-forget, come back later
kirha task create "Compare the AI strategies..."
# → { "id": "tsk_..." }

kirha task status tsk_abc123    # check progress
kirha task wait tsk_abc123      # block until done
kirha task result tsk_abc123    # fetch the final result
```

**Call a single Kirha tool directly,** if you know the one you want:

```bash
kirha tools list
kirha tools run zerion_getEthereumWalletProfitAndLoss \
  --input '{"currency":"usd","ethereumAddress":"0x..."}'
```

**Browse what Kirha offers** — verticals, providers, and the tools they expose. `discovery` prints markdown straight from [discovery.kirha.com](https://discovery.kirha.com), so it's just as useful for you as it is for an LLM piping it around:

```bash
kirha discovery home                    # overview
kirha discovery verticals list          # every vertical
kirha discovery verticals get crypto    # details for one
kirha discovery providers list          # every provider
kirha discovery providers get zerion    # details for one
```

You can pipe queries in too, which is handy in scripts:

```bash
echo "What's hot in DeFi today?" | kirha search
```

Run `kirha --help` (or `kirha <command> --help`) to see every flag.

## Output

The CLI prints JSON, one line per invocation, so you can pipe it into `jq` or whatever else:

```bash
kirha search "Top 5 ETH validators" | jq '.summary'
```

Errors come out on stderr in a stable shape:

```json
{ "error": { "code": "AUTH_REQUIRED", "message": "..." } }
```

Exit codes are predictable: `0` for success, `2` for bad usage, `3` for auth issues, `4` for rate limits, `5` for network errors, `6` for an expired plan.

## Wire Kirha into your AI coding tools

Install the Kirha MCP server into Claude Code, Codex, OpenCode, Gemini CLI, or Droid with one command:

```bash
kirha mcp install            # interactive picker, pick one or more with space/enter
kirha mcp install --client claudecode
kirha mcp install --client claudecode,codex
kirha mcp install --client all

kirha mcp update --client claudecode         # re-sync your current API key to a client
kirha mcp remove --client claudecode         # remove the server entry
kirha mcp show   --client claudecode         # show the current configuration
```

Your API key is pulled automatically from `kirha auth login`. Pass `--key <apiKey>` if you want to override it for a single command, or `--dry-run` to see what would change without touching anything.

## Upgrade

```bash
kirha upgrade           # download and install the latest version
kirha upgrade --check   # just print whether a newer version exists
```

If you installed via `curl`, `kirha upgrade` self-replaces the binary at `~/.kirha/bin/kirha` after verifying its SHA256 checksum. If you installed via npm, it prints the right command for you to run (`npm install -g @kirha/cli@latest`).

## Uninstall

If you installed via the curl script:

```bash
rm -rf ~/.kirha
rm -rf ~/.config/kirha   # also removes your stored API key and config
```

If you installed via npm:

```bash
npm uninstall -g @kirha/cli
rm -rf ~/.config/kirha
```

## License

MIT
