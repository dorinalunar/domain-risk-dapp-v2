# Changelog

All notable changes to the DomainRiskManager protocol and dApp are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-10-22

### Added
- **Pre-Flight Conflict & Policy Simulator:** Client-side heuristic analyzer in `main.js` and `index.html` to scan candidate agreements before triggering on-chain transactions.
- **Audit JSON Exporter:** One-click structured compliance report generation for offline reviews and audit trails.
- **Automated Verification Suite:** 12 comprehensive unit tests in `test.py` covering AI hallucination neutralization, deterministic critical issue hashing, and policy escalation.
- **Continuous Integration:** GitHub Actions workflow (`.github/workflows/tests.yml`) executing test suites across pull requests and main branch commits.
- **Security Documentation:** Added formal `SECURITY.md` covering consensus guardrails, state synchronization counters, and RBAC rules.

### Changed
- Refactored `index.html` interface into an agentic 4-panel operations center.
- Enhanced `main.js` with direct JSON-RPC transport handling for GenLayer Studio network methods.
- Updated `README.md` with complete technical architecture and local test instructions.

## [1.0.0] - 2026-09-15

### Added
- Initial deployment of `DomainRiskManager.py` intelligent contract on GenLayer Studio network.
- Leader/Validator non-deterministic AI evaluation pattern using `run_nondet_unsafe`.
- Steward override capabilities and domain-level risk configuration (`strict_mode`, `ignore_minor`).
- Basic Web3 frontend for submitting and tracking agreement status.
