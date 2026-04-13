const API_KEYS_URL = "https://app.kirha.com/api-keys";

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

function readMaskedLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stderr = process.stderr;
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buffer = "";

    const cleanup = () => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\n" || char === "\r") {
          cleanup();
          resolve(buffer);
          return;
        }
        if (char === "\u0003") {
          cleanup();
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
}
