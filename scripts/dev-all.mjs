// Run backend + frontend together: `npm run dev:all`
import { spawn } from "node:child_process";

// Spawn node directly (not via npm) so killing the child really stops the server.
const node = process.execPath;

const procs = [
  { name: "backend ", color: "\x1b[35m", args: ["--env-file-if-exists=.env", "backend/server.mjs"] },
  { name: "frontend", color: "\x1b[36m", args: ["node_modules/vite/bin/vite.js"] },
];

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500);
}

for (const p of procs) {
  const prefix = `${p.color}[${p.name}]\x1b[0m `;
  const child = spawn(node, p.args, { stdio: ["inherit", "pipe", "pipe"] });
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const l of lines) out.write(prefix + l + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown(code ?? 0);
  });
  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
