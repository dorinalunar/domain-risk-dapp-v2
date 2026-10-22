<div align="center">
  <img src="./logo.svg" alt="DomainRiskManager Logo" width="180" height="180">
  <br>
</div>

# 🛡️ DomainRiskManager (GenLayer Full-Stack dApp v2.1)

![GenLayer](https://img.shields.io/badge/Network-GenLayer_Studio-blueviolet?style=for-the-badge)
![Smart Contract](https://img.shields.io/badge/Smart_Contract-Python_3.9+-blue?style=for-the-badge&logo=python&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla_JS-orange?style=for-the-badge&logo=javascript&logoColor=white)
![Tests](https://img.shields.io/badge/Pytest-12_Passing-success?style=for-the-badge)
![SDK](https://img.shields.io/badge/SDK-genlayer--js-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

> **Demonstrating the power of Intelligent Smart Contracts and Agentic UI design.**

**DomainRiskManager** is a full-stack Intelligent dApp built for the GenLayer ecosystem. 

It acts as an autonomous semantic registry that leverages GenVM's non-deterministic AI consensus to evaluate, manage, and secure on-chain commitments. The project includes a robust Python-based Intelligent Contract and a fully integrated, modular Web3 frontend command center.

---

## 🚀 What's New in v2.1 (Milestone Upgrade)

* **Pre-Flight Conflict & Policy Simulator:** Client-side dry-run analyzer that validates domain formatting, character limits, and heuristic scanning across all 6 conflict categories with a visual risk score meter before spending gas.
* **Audit JSON Exporter:** One-click generation of structured compliance reports for local simulations and on-chain AI judgements.
* **Automated Security Verification:** Comprehensive 12-case Pytest suite covering AI hallucination neutralization, deterministic critical issue hashing, strict/ignore risk policies, and domain sanitization, seamlessly integrated with GitHub Actions CI.

---

## 🌍 Real-World Use Cases

* **DAO Governance:** Prevent contradictory proposals from passing by semantically checking new proposals against existing active rules.
* **DeFi Partnerships:** Automatically verify if a new marketing commitment violates exclusivity clauses of previous agreements.
* **Freelance & Escrow:** Ensure deliverables match the semantic intent of the initial contract before releasing funds, acting as an autonomous AI judge.

---

## 📜 Deployment Details

* **Network:** GenLayer Studio (Chain ID: 61999)
* **Smart Contract Address:** `0xBfD7843AF81097Faec3Ce05A86B7E106BB78024e`
* **Compiler:** GenLayer Studio Native Compiler (GenVM)

---

## 🛠️ Tech Stack & Architecture

This dApp demonstrates a highly resilient, mobile-friendly Web3 architecture tailored specifically for the GenLayer ecosystem:
* **Smart Contract:** Native Python using the `py-genlayer` SDK, implementing deterministic state management alongside AI logic.
* **Frontend Modular Design:** Built with Vanilla JS and ES Modules (via `esm.sh`) for seamless browser deployment without heavy build tools.
* **SDK Integration:** Utilizes the official `genlayer-js` SDK (`createClient`) for both read operations (state querying and JSON parsing) and write operations, featuring dynamic network switching to ensure seamless MetaMask compatibility and type-safe transaction execution.

---

## ✨ Key Features

### 🖥️ Agentic Command Center (Frontend)
* **Seamless Web3 Integration:** Connect via MetaMask to the GenLayer Studio network directly from the browser with automatic chain-switching.
* **4-Panel Dashboard:** Intuitive UI covering Setup, Pre-Flight Simulation, Submission, AI Execution, and Block Explorer views.
* **Real-time Event Console:** Track transaction hashes, state changes, and AI rationale directly in the UI.

### 🧠 Intelligent Contract (Backend)
* **AI-Powered Consensus:** Utilizes GenLayer's `run_nondet_unsafe` to semantically analyze incoming text agreements against active domain landscape data.
* **Steward Override System:** Global stewards can manually resolve deadlocks or override AI decisions.
* **Permissioned Architecture:** Domain-specific whitelisting ensures only authorized actors can submit data.
* **Dynamic Risk Configuration:** Configurable risk tolerance (`strict_mode`, `ignore_minor`) per domain.

---

## 🚀 How to Use the dApp

The frontend is divided into four main operational panels. Connect your wallet (GenLayer Studio network) and follow the flow:

### 1. 🔍 Pre-Flight Risk Simulator (New)
* Run a local dry-run on candidate agreements to calculate a heuristic risk score and identify potential clauses overlapping with active policies.
* Export an Audit JSON report for compliance tracking.

### 2. ⚙️ Setup & Admin (Domain Management)
* **Register Domain:** Create a new isolated registry (e.g., `marketing_q4`).
* **Whitelist Users:** Authorize specific wallet addresses to submit agreements to your domain.
* **Configure Risk:** Set semantic strictness levels for the AI consensus.

### 3. 📥 Submission & AI Execution
* **Submit Agreement:** Enter your target domain and the full text of the commitment.
* **Evaluate Submission:** Enter the `Submission ID` and trigger GenVM. The AI will semantically compare the new text against all `LIVE` agreements in that domain.
* **Steward Override:** Force a state change if the AI returns an ambiguous result.

### 4. 📊 Explorer (Views)
* Read the current state (`QUEUED`, `LIVE`, `DENIED`, `MANUAL_CHECK`).
* Fetch detailed AI judgements (JSON rationale and detected conflicts).
* View global contract statistics and event logs.

---

## 🧪 Local Development & Testing

Since the dApp is built with a modular Vanilla JS architecture and uses CDN imports (`esm.sh`), running it locally requires zero build tools.

**Running the Frontend:**
1. Clone the repository: `git clone https://github.com/dorinalunar/domain-risk-dapp.git`
2. Open `index.html` in any modern web browser or serve it via a simple local server.
3. Connect your MetaMask to the GenLayer Studio network.

**Running the Security Test Suite:**
The contract validation logic is fully covered by automated tests.

```bash
pip install -r requirements.txt
pytest test.py -v
```

---

<div align="center">
  <img src="./mascot.png" alt="Author" width="160" style="border-radius: 16px;">
  <h3>Architected by Andrii (@dorinalunar)</h3>
  <p><i>Autonomous Intelligent Contract & dApp Development</i></p>
</div>