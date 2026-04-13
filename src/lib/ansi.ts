const ESC = "\x1b";
const useColor = process.env.NO_COLOR === undefined && process.stderr.isTTY === true;

function wrap(code: string): string {
  return useColor ? code : "";
}

export const ANSI = {
  reset: wrap(`${ESC}[0m`),
  dim: wrap(`${ESC}[2m`),
  red: wrap(`${ESC}[31m`),
  green: wrap(`${ESC}[32m`),
  cyan: wrap(`${ESC}[36m`),
  hideCursor: wrap(`${ESC}[?25l`),
  showCursor: wrap(`${ESC}[?25h`),
  clearLine: wrap(`${ESC}[2K`),
  cursorHome: "\r",
  cursorUp: (n: number) => wrap(`${ESC}[${n}A`),
};

export { ESC };
