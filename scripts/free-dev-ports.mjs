import { execFileSync } from "node:child_process";

const ports = ["3001", "3002", "3003", "3004", "3005", "3006"];

const output = run("lsof", ["-ti", `tcp:${ports.join(",")}`, "-sTCP:LISTEN"]);
const pids = output
  .split(/\s+/u)
  .map((pid) => pid.trim())
  .filter(Boolean);

if (pids.length === 0) {
  console.log(`Dev ports are free: ${ports.join(", ")}`);
  process.exit(0);
}

run("kill", pids);
console.log(`Freed dev ports ${ports.join(", ")} by stopping PID(s): ${pids.join(", ")}`);

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
  } catch {
    return "";
  }
}
