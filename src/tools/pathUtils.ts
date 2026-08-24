import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getEasyAgentHome } from "../utils/paths.js";

// Extra roots beyond cwd + ~/.easy-agent, from the `additionalDirectories`
// setting. Resolved to absolute paths and installed once at startup (see
// cli.ts). Kept module-level so the sync path guards below stay sync — the
// file tools call them on a hot path and shouldn't await a settings read each
// time. Trust-gating happens at load time (untrusted project/local dirs are
// dropped before they reach here).
let additionalAllowedRoots: string[] = [];

/** Install the resolved `additionalDirectories` (absolute paths). */
export function setAdditionalAllowedRoots(roots: string[]): void {
  additionalAllowedRoots = roots.map((root) => path.resolve(root));
}

export function getAdditionalAllowedRoots(): string[] {
  return additionalAllowedRoots;
}

export function getToolAllowedRoots(cwd: string): string[] {
  return [
    path.resolve(cwd),
    path.resolve(getEasyAgentHome()),
    ...additionalAllowedRoots,
  ];
}

export function describeAllowedRoots(cwd: string): string {
  return getToolAllowedRoots(cwd).join(", ");
}

export function expandHome(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function resolveSafePath(filePath: string, cwd: string): string {
  return path.resolve(cwd, expandHome(filePath));
}

/**
 * Resolve symlinks/junctions for the existing portion of a path. The remaining
 * suffix is retained so callers can safely validate files that do not exist yet.
 */
function canonicalizeWithExistingAncestor(candidate: string): string {
  let existingAncestor = path.resolve(candidate);
  const missingSegments: string[] = [];

  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(path.basename(existingAncestor));
    existingAncestor = parent;
  }

  const canonicalAncestor = fs.realpathSync.native(existingAncestor);
  return path.resolve(canonicalAncestor, ...missingSegments);
}

export function ensureInsideAllowedRoots(resolvedPath: string, cwd: string): void {
  const canonicalPath = canonicalizeWithExistingAncestor(resolvedPath);
  for (const root of getToolAllowedRoots(cwd)) {
    const canonicalRoot = canonicalizeWithExistingAncestor(root);
    const relative = path.relative(canonicalRoot, canonicalPath);
    if (relative === "" || relative === ".") return;
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      return;
    }
  }
  throw new Error("Path is outside the allowed roots.");
}

export function resolveWorkspacePath(filePath: string, cwd: string): string {
  const resolvedPath = resolveSafePath(filePath, cwd);
  ensureInsideAllowedRoots(resolvedPath, cwd);
  return resolvedPath;
}
