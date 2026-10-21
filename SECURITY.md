# Security Policy & Architecture Safeguards

## 1. AI Consensus & Hallucination Protection
`DomainRiskManager` utilizes GenLayer's Leader/Validator non-deterministic execution (`gl.vm.run_nondet_unsafe`) with strict post-processing normalization in `_format_judgement`:
- **UID Whitelist Verification (`allowed_map`)**: Any issue returned by the LLM referencing an agreement `uid` outside the snapshot's `sync_keys` is flagged as an AI hallucination (`ai_hallucinated = True`), immediately neutralizing the outcome to `UNCLEAR` (`MANUAL_CHECK`).
- **Deterministic Critical Hashing (`_hash_critical`)**: When the outcome is `CLASH`, both Leader and Validator nodes must independently converge on the exact sorted set of `CRITICAL` conflict UIDs.
- **Prompt Delimitation**: Candidate agreements and background context are encapsulated in XML data tags (`<domain>`, `<candidate>`, `<candidate_bg>`, `<active_agreements>`) with explicit instructions treating user input strictly as passive data.

## 2. State Desynchronization & Clone Defense
- **Optimistic Domain Versioning (`sync_version`)**: Each submission records the domain's version counter upon creation. If another agreement goes `LIVE` or is `ARCHIVED` before evaluation, `_run_evaluation_logic` halts with `HALT: State desync, reload required` until the submitter calls `reload_submission`.
- **Exact Clone Prevention (`_prevent_exact_clone`)**: Prevents duplicate agreement spam within the active domain roster (`LIMIT_MAX_ACTIVE = 15`).

## 3. Role-Based Access Control (RBAC)
- **Admin**: Deploys the contract and appoints Stewards (`add_steward`).
- **Stewards**: Register domains (`register_domain`), run batch evaluations (`evaluate_batch`), and execute emergency overrides (`override_judgement`).
- **Domain Owners**: Manage submitter whitelists (`set_whitelist`) and configure per-domain risk sensitivity (`configure_domain_risk`: `strict_mode`, `ignore_minor`).

## 4. Reporting a Vulnerability
To report a security issue, please open a discussion or contact `@dorinalunar` via GitHub.