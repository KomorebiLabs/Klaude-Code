export type ToolEntryPoint =
  | "interactive"
  | "headless"
  | "subagent"
  | "background_subagent";

export type PermissionPolicySource =
  | "explicit_deny"
  | "explicit_allow"
  | "mode_policy"
  | "hard_safety"
  | "read_only"
  | "coordination_policy"
  | "domain_policy"
  | "sandbox_policy"
  | "classifier"
  | "default_policy"
  | "pre_tool_hook"
  | "input_validation"
  | "execution_ledger";

export type PermissionReasonCode =
  | "matched_deny_rule"
  | "matched_allow_rule"
  | "plan_restriction"
  | "plan_file_write"
  | "auto_hard_deny"
  | "read_only"
  | "coordination_safe"
  | "domain_preapproved"
  | "domain_confirmation"
  | "sandbox_auto_allow"
  | "classifier_allow"
  | "classifier_deny"
  | "classifier_unavailable"
  | "confirmation_required"
  | "mode_transition"
  | "hook_blocked"
  | "invalid_input"
  | "duplicate_tool_use";

export type PermissionResolutionSource =
  | "policy"
  | "pre_tool_hook"
  | "user"
  | "headless"
  | "bypass"
  | "background"
  | "default_deny";

export type PermissionOutcome =
  | "allowed"
  | "denied"
  | "blocked"
  | "invalid"
  | "aborted"
  | "duplicate";
