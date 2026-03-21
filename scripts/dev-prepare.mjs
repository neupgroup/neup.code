import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const defaultPort = process.env.PORT ?? "2633";
const killOnly = process.argv.includes("--kill-only");
const cleanOnly = process.argv.includes("--clean-only");
const clean = process.argv.includes("--clean") || cleanOnly;

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isNextProcess(command) {
  return /next[- ]server|next dev|next start|[/\\]next(\s|$)/i.test(command);
}

function freeDevPort(port) {
  const pidText = run(`lsof -ti tcp:${port} -sTCP:LISTEN`);
  if (!pidText) {
    return;
  }

  const pids = [...new Set(pidText.split("\n").map((item) => item.trim()).filter(Boolean))];
  for (const pid of pids) {
    const command = run(`ps -p ${pid} -o command=`) || "(unknown)";
    if (!isNextProcess(command)) {
      console.error(
        `Port ${port} is in use by a non-Next process (pid ${pid}). Refusing to kill it.`,
      );
      console.error(`Command: ${command}`);
      process.exit(1);
    }

    try {
      process.kill(Number(pid), "SIGTERM");
      console.log(`Stopped stale Next process on port ${port} (pid ${pid}).`);
    } catch {
      // If the process already ended, we can safely continue.
    }
  }
}

function cleanNextCache() {
  rmSync(".next", { recursive: true, force: true });
  console.log("Cleared .next cache.");
}

if (process.platform !== "win32" && !cleanOnly) {
  freeDevPort(defaultPort);
}

if (clean) {
  cleanNextCache();
}

if (killOnly) {
  process.exit(0);
}
