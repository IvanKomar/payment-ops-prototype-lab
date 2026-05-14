import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseEnv } from "node:util";

let loaded = false;

function findWorkspaceRoot(startDir: string): string {
  let current = resolve(startDir);

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDir);
    }

    current = parent;
  }
}

function collectEnvFiles(workspaceRoot: string, startDir: string): string[] {
  const envFiles: string[] = [];
  let current = resolve(startDir);

  while (current.startsWith(workspaceRoot)) {
    const envFile = join(current, ".env");

    if (existsSync(envFile)) {
      envFiles.push(envFile);
    }

    if (current === workspaceRoot) {
      break;
    }

    current = dirname(current);
  }

  return envFiles.reverse();
}

export function loadWorkspaceEnv(
  startDir = process.cwd(),
  target: NodeJS.ProcessEnv = process.env
): void {
  if (loaded) {
    return;
  }

  loaded = true;

  const originalKeys = new Set(Object.keys(target));
  const workspaceRoot = findWorkspaceRoot(startDir);

  for (const envFile of collectEnvFiles(workspaceRoot, startDir)) {
    const parsed = parseEnv(readFileSync(envFile, "utf8"));

    for (const [key, value] of Object.entries(parsed)) {
      if (!originalKeys.has(key)) {
        target[key] = value;
      }
    }
  }
}
