import { ANSI, ESC } from "./ansi.ts";

const API_KEYS_URL = "https://app.kirha.com/api-keys";

const TERMINATING_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

function installSignalCleanup(cleanup: () => void): () => void {
  const handlers: Array<[NodeJS.Signals, () => void]> = TERMINATING_SIGNALS.map((signal) => {
    const handler = () => {
      cleanup();
      process.exit(signal === "SIGINT" ? 130 : 143);
    };
    process.on(signal, handler);
    return [signal, handler];
  });
  return () => {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  };
}

export async function promptApiKey(): Promise<string | null> {
  if (!process.stdin.isTTY) return null;

  const stderr = process.stderr;
  stderr.write("\n");
  stderr.write("  Get your Kirha API key here:\n");
  stderr.write(`  ${API_KEYS_URL}\n`);
  stderr.write("\n");
  stderr.write("  Paste your API key: ");

  const value = await readMaskedLine();
  stderr.write("\n\n");
  return value.trim() || null;
}

export interface MultiSelectItem<T> {
  label: string;
  value: T;
  selected?: boolean;
  disabled?: boolean;
}

export interface MultiSelectOptions<T> {
  message: string;
  items: MultiSelectItem<T>[];
  minSelected?: number;
}

export async function promptMultiSelect<T>(options: MultiSelectOptions<T>): Promise<T[] | null> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return null;
  if (options.items.length === 0) return [];

  const selected = options.items.map((item) => item.selected ?? false);
  let cursor = options.items.findIndex((item) => !item.disabled);
  if (cursor < 0) cursor = 0;

  const stderr = process.stderr;
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;

  const render = (isInitial: boolean) => {
    if (!isInitial) {
      stderr.write(ANSI.cursorUp(options.items.length + 2));
    }
    stderr.write(`${ANSI.clearLine}${ANSI.cursorHome}`);
    stderr.write(`${ANSI.cyan}?${ANSI.reset} ${options.message}`);
    stderr.write(`  ${ANSI.dim}(space: toggle, a: all, enter: confirm)${ANSI.reset}\n`);

    for (let i = 0; i < options.items.length; i++) {
      stderr.write(`${ANSI.clearLine}${ANSI.cursorHome}`);
      const item = options.items[i];
      if (!item) continue;
      const pointer = i === cursor ? `${ANSI.cyan}❯${ANSI.reset}` : " ";
      const box = selected[i] ? `${ANSI.green}◉${ANSI.reset}` : "◯";
      const label = item.disabled ? `${ANSI.dim}${item.label}${ANSI.reset}` : item.label;
      stderr.write(`${pointer} ${box} ${label}\n`);
    }
    stderr.write(`${ANSI.clearLine}${ANSI.cursorHome}\n`);
  };

  let onData: ((chunk: string) => void) | null = null;
  const cleanup = () => {
    if (onData) stdin.removeListener("data", onData);
    stdin.setRawMode(wasRaw);
    stdin.pause();
    stderr.write(ANSI.showCursor);
  };
  const uninstallSignals = installSignalCleanup(cleanup);

  try {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stderr.write(ANSI.hideCursor);
    render(true);

    const moveCursor = (delta: number) => {
      const n = options.items.length;
      for (let step = 0; step < n; step++) {
        cursor = (cursor + delta + n) % n;
        if (!options.items[cursor]?.disabled) return;
      }
    };

    return await new Promise<T[] | null>((resolve, reject) => {
      onData = (chunk: string) => {
        if (chunk === "\u0003") {
          reject(new Error("aborted"));
          return;
        }
        if (chunk === "\r" || chunk === "\n") {
          const minSelected = options.minSelected ?? 0;
          const count = selected.filter(Boolean).length;
          if (count < minSelected) return;
          resolve(options.items.filter((_, i) => selected[i]).map((item) => item.value));
          return;
        }
        if (chunk === " ") {
          if (!options.items[cursor]?.disabled) selected[cursor] = !selected[cursor];
          render(false);
          return;
        }
        if (chunk === "a" || chunk === "A") {
          const anyUnselected = selected.some((s, i) => !s && !options.items[i]?.disabled);
          for (let i = 0; i < selected.length; i++) {
            if (!options.items[i]?.disabled) selected[i] = anyUnselected;
          }
          render(false);
          return;
        }
        if (chunk === `${ESC}[A` || chunk === "k") {
          moveCursor(-1);
          render(false);
          return;
        }
        if (chunk === `${ESC}[B` || chunk === "j") {
          moveCursor(1);
          render(false);
          return;
        }
      };
      stdin.on("data", onData);
    });
  } finally {
    uninstallSignals();
    cleanup();
  }
}

async function readMaskedLine(): Promise<string> {
  const stdin = process.stdin;
  const stderr = process.stderr;
  const wasRaw = stdin.isRaw;

  let onData: ((chunk: string) => void) | null = null;
  const cleanup = () => {
    if (onData) stdin.removeListener("data", onData);
    stdin.setRawMode(wasRaw);
    stdin.pause();
  };
  const uninstallSignals = installSignalCleanup(cleanup);

  try {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    return await new Promise<string>((resolve, reject) => {
      let buffer = "";
      onData = (chunk: string) => {
        for (const char of chunk) {
          if (char === "\n" || char === "\r") {
            resolve(buffer);
            return;
          }
          if (char === "\u0003") {
            reject(new Error("aborted"));
            return;
          }
          if (char === "\u007f" || char === "\b") {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              stderr.write("\b \b");
            }
            continue;
          }
          if (char >= " ") {
            buffer += char;
            stderr.write("*");
          }
        }
      };
      stdin.on("data", onData);
    });
  } finally {
    uninstallSignals();
    cleanup();
  }
}
