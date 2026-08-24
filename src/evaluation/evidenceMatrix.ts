export interface EvidenceMatrixEntry {
  invariantId: string;
  claim: string;
  command: string;
  evidenceFile: string;
}

export const R1_CORE_EVIDENCE_MATRIX: EvidenceMatrixEntry[] = [
  { invariantId: "trace.schema-sequence-lifecycle", claim: "Trace v1 sequence and lifecycle are valid", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "privacy.fake-secret-omitted", claim: "Fake secrets and runtime content are omitted", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "permission.deny-zero-execution", claim: "Denied tools are not executed", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
  { invariantId: "writer.failure-isolation", claim: "Writer degradation and close timeout do not alter the main result", command: "npm run test:trace", evidenceFile: "src/scripts/test-trace.ts" },
];
