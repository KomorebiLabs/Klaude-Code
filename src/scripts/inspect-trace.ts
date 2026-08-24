#!/usr/bin/env tsx
import * as path from "node:path";
import { formatTraceTimeline, inspectTraceFile } from "../observability/traceInspector.js";

const tracePath = process.argv[2];
if (!tracePath) {
  console.error("Usage: npm run inspect:trace -- <trace.jsonl>");
  process.exitCode = 1;
} else {
  const timeline = await inspectTraceFile(path.resolve(tracePath));
  console.log(formatTraceTimeline(timeline));
}
