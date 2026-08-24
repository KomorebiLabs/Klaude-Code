#!/usr/bin/env tsx
import * as path from "node:path";
import {
  createProjectDiagnosticReport,
  formatDiagnosticReport,
  serializeDiagnosticReport,
} from "../diagnostics/index.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const positional = args.filter((arg) => arg !== "--json");
if (positional.length > 1) {
  console.error("Usage: npm run diagnose -- [--json] [cwd]");
  process.exitCode = 1;
} else {
  const cwd = path.resolve(positional[0] ?? process.cwd());
  const report = await createProjectDiagnosticReport(cwd);
  process.stdout.write(json ? serializeDiagnosticReport(report) : `${formatDiagnosticReport(report)}\n`);
}
