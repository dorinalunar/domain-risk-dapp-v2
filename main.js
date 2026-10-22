// ============================================================================
// Domain Risk Manager — Frontend Controller & Pre-Flight Policy Analyzer
// Compatible with GenLayer Studio Network deployment
// ============================================================================

const DEFAULT_CONTRACT_ADDRESS = localStorage.getItem("drm_contract_addr") || "0xBfD7843AF81097Faec3Ce05A86B7E106BB78024e";
const DEFAULT_RPC_URL = localStorage.getItem("drm_rpc_url") || "https://studio.genlayer.com/api";

const LIMITS = {
  DOMAIN: 100,
  BODY: 1500,
  BG: 800,
  RATIONALE: 600,
};

const RISK_PATTERNS = [
  { type: "MONOPOLY", weight: 35, keywords: ["exclusive", "sole provider", "monopoly", "only party", "single-source", "prohibit others"] },
  { type: "ASSET_CLASH", weight: 30, keywords: ["entire balance", "100% of treasury", "full collateral", "pledge all", "transfer all funds"] },
  { type: "SCHEDULE_CLASH", weight: 20, keywords: ["24/7", "simultaneous", "exclusive window", "at all times", "immediate lock"] },
  { type: "DUTY_BREACH", weight: 25, keywords: ["override fiduciary", "waive liability", "bypass audit", "ignore compliance"] },
  { type: "POWER_CLASH", weight: 30, keywords: ["unilateral veto", "sole authority", "irrevocable control", "supersede all"] },
];

let connectedAccount = null;
let lastAuditReport = null;

// Initialize inputs
const elContract = document.getElementById("inputContractAddr");
const elRpc = document.getElementById("inputRpcUrl");
const elConsole = document.getElementById("consoleOutput");

if (elContract) elContract.value = DEFAULT_CONTRACT_ADDRESS;
if (elRpc) elRpc.value = DEFAULT_RPC_URL;

function logOutput(title, payload) {
  const timestamp = new Date().toISOString();
  const formatted = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  if (elConsole) {
    elConsole.textContent = `[${timestamp}] ${title}\n${formatted}`;
  }
}

// ============================================================================
// 1. LOCAL PRE-FLIGHT RISK SIMULATOR (NEW MILESTONE FEATURE)
// ============================================================================

export function analyzeCandidateLocally(domain, bodyText, bgInfo) {
  const cleanDomain = (domain || "").trim().toLowerCase();
  const cleanBody = (bodyText || "").trim();
  const cleanBg = (bgInfo || "").trim();

  const validationErrors = [];
  if (!cleanDomain || cleanDomain.length > LIMITS.DOMAIN) {
    validationErrors.push(`Invalid domain length (1..${LIMITS.DOMAIN}).`);
  }
  if (!/^[a-z0-9._-]+$/.test(cleanDomain)) {
    validationErrors.push("Domain contains illegal characters (allowed: a-z, 0-9, ., _, -).");
  }
  if (!cleanBody || cleanBody.length > LIMITS.BODY) {
    validationErrors.push(`Body text length must be between 1 and ${LIMITS.BODY} chars (current: ${cleanBody.length}).`);
  }
  if (cleanBg.length > LIMITS.BG) {
    validationErrors.push(`Background info exceeds ${LIMITS.BG} chars (will be auto-trimmed on-chain).`);
  }

  const detectedFlags = [];
  let score = 0;
  const combined = `${cleanBody} ${cleanBg}`.toLowerCase();

  for (const rule of RISK_PATTERNS) {
    const matched = rule.keywords.filter((kw) => combined.includes(kw));
    if (matched.length > 0) {
      score += rule.weight;
      detectedFlags.push({
        type: rule.type,
        level: rule.weight >= 30 ? "CRITICAL" : "MINOR",
        matchedKeywords: matched,
      });
    }
  }

  if (validationErrors.length > 0) score = 100;
  score = Math.min(100, score);

  const predictedOutcome =
    validationErrors.length > 0
      ? "HALT_REJECT"
      : score >= 60
      ? "LIKELY_CLASH"
      : score >= 25
      ? "MANUAL_CHECK_UNCLEAR"
      : "LIKELY_SAFE";

  return {
    timestamp: new Date().toISOString(),
    domain: cleanDomain,
    lengths: { body: cleanBody.length, bg: cleanBg.length },
    validationErrors,
    predictedOutcome,
    riskScore: score,
    detectedFlags,
  };
}

document.getElementById("btnRunSimulation")?.addEventListener("click", () => {
  const d = document.getElementById("simDomain").value;
  const b = document.getElementById("simBody").value;
  const bg = document.getElementById("simBg").value;

  const report = analyzeCandidateLocally(d, b, bg);
  lastAuditReport = report;

  const bar = document.getElementById("simRiskBar");
  const verdict = document.getElementById("simVerdict");
  const scoreTxt = document.getElementById("simScoreText");
  const details = document.getElementById("simDetails");

  bar.style.width = `${report.riskScore}%`;
  bar.style.background =
    report.riskScore >= 60 ? "#ef4444" : report.riskScore >= 25 ? "#f59e0b" : "#22c55e";

  verdict.textContent = `Verdict: ${report.predictedOutcome}`;
  scoreTxt.textContent = `Risk Score: ${report.riskScore}/100`;

  if (report.validationErrors.length > 0) {
    details.textContent = `Validation Errors: ${report.validationErrors.join(" ")}`;
  } else if (report.detectedFlags.length > 0) {
    details.textContent = `Detected Risk Categories: ${report.detectedFlags
      .map((f) => `${f.type} (${f.level}:${f.matchedKeywords.join(", ")})`)
      .join(" | ")}`;
  } else {
    details.textContent = "All length and character guards passed. No exclusivity or asset clash triggers detected.";
  }

  logOutput("PRE-FLIGHT SIMULATION REPORT", report);
});

document.getElementById("btnCopyToSubmit")?.addEventListener("click", () => {
  document.getElementById("subDomain").value = document.getElementById("simDomain").value;
  document.getElementById("subBody").value = document.getElementById("simBody").value;
  document.getElementById("subBg").value = document.getElementById("simBg").value;
  logOutput("COPIED", "Candidate fields copied to On-Chain Submitter.");
});

document.getElementById("btnExportAudit")?.addEventListener("click", () => {
  const payload = lastAuditReport || {
    note: "No simulation run yet",
    contract: elContract?.value,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `domain-risk-audit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================================================
// 2. JSON-RPC INTERACTION HELPERS (GENLAYER STUDIO NETWORK)
// ============================================================================

async function rpcCall(method, params = []) {
  const rpcUrl = elRpc?.value.trim() || DEFAULT_RPC_URL;
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "RPC Error");
  return data.result;
}

async function callContractView(functionName, args = []) {
  const contractAddress = elContract?.value.trim();
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Please set a valid Contract Address in the top bar.");
  }
  const res = await rpcCall("gen_call", [
    {
      to: contractAddress,
      from: connectedAccount || "0x0000000000000000000000000000000000000000",
      method: functionName,
      args,
    },
  ]);
  return typeof res === "string" && res.startsWith("{") ? JSON.parse(res) : res;
}

async function sendContractWrite(functionName, args = []) {
  const contractAddress = elContract?.value.trim();
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Please set a valid Contract Address in the top bar.");
  }
  if (!window.ethereum) {
    throw new Error("MetaMask or Web3 provider not detected.");
  }
  if (!connectedAccount) {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    connectedAccount = accounts[0];
  }
  logOutput(`TX PENDING: ${functionName}`, { contractAddress, args });
  const txRes = await rpcCall("gen_sendTransaction", [
    {
      from: connectedAccount,
      to: contractAddress,
      method: functionName,
      args,
    },
  ]);
  logOutput(`TX SUBMITTED: ${functionName}`, txRes);
  setTimeout(() => syncProtocolStats(), 2500);
  return txRes;
}

export async function syncProtocolStats() {
  try {
    const data = await callContractView("stats", []);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed && typeof parsed === "object") {
      document.getElementById("statTracker").textContent = parsed.global_tracker_id ?? "1";
      document.getElementById("statLive").textContent = parsed.count_live ?? "0";
      document.getElementById("statDenied").textContent = parsed.count_denied ?? "0";
      document.getElementById("statManual").textContent = parsed.count_manual ?? "0";
      document.getElementById("statArchived").textContent = parsed.count_archived ?? "0";
      document.getElementById("statEvents").textContent = parsed.event_counter ?? "0";
    }
  } catch (_err) {
    // Silent catch during background sync
  }
}

// ============================================================================
// 3. UI EVENT BINDINGS
// ============================================================================

document.getElementById("btnSaveConfig")?.addEventListener("click", () => {
  localStorage.setItem("drm_contract_addr", elContract.value.trim());
  localStorage.setItem("drm_rpc_url", elRpc.value.trim());
  logOutput("CONFIG SAVED", { contract: elContract.value.trim(), rpc: elRpc.value.trim() });
  syncProtocolStats();
});

document.getElementById("btnConnect")?.addEventListener("click", async () => {
  try {
    if (!window.ethereum) throw new Error("Install MetaMask to connect.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    connectedAccount = accounts[0];
    document.getElementById("walletStatus").textContent = `Wallet: ${connectedAccount.slice(0, 6)}...${connectedAccount.slice(-4)}`;
    logOutput("WALLET CONNECTED", { account: connectedAccount });
    syncProtocolStats();
  } catch (e) {
    logOutput("WALLET ERROR", e.message);
  }
});

document.getElementById("btnRefreshStats")?.addEventListener("click", () => syncProtocolStats());

document.getElementById("btnSubmitAgreement")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("submit_agreement", [
      document.getElementById("subDomain").value,
      document.getElementById("subBody").value,
      document.getElementById("subBg").value,
      document.getElementById("subHook").value,
    ]);
  } catch (e) {
    logOutput("SUBMIT ERROR", e.message);
  }
});

document.getElementById("btnEvaluate")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("evaluate_submission", [Number(document.getElementById("evalUid").value)]);
  } catch (e) {
    logOutput("EVALUATE ERROR", e.message);
  }
});

document.getElementById("btnReload")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("reload_submission", [Number(document.getElementById("evalUid").value)]);
  } catch (e) {
    logOutput("RELOAD ERROR", e.message);
  }
});

document.getElementById("btnRevoke")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("revoke_submission", [Number(document.getElementById("evalUid").value)]);
  } catch (e) {
    logOutput("REVOKE ERROR", e.message);
  }
});

document.getElementById("btnTriggerHook")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("trigger_hook", [Number(document.getElementById("evalUid").value)]);
  } catch (e) {
    logOutput("HOOK ERROR", e.message);
  }
});

document.getElementById("btnRegisterDomain")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("register_domain", [
      document.getElementById("govDomain").value,
      document.getElementById("govAccount").value || connectedAccount,
    ]);
  } catch (e) {
    logOutput("REGISTER DOMAIN ERROR", e.message);
  }
});

document.getElementById("btnWhitelistAllow")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("set_whitelist", [
      document.getElementById("govDomain").value,
      document.getElementById("govAccount").value,
      true,
    ]);
  } catch (e) {
    logOutput("WHITELIST ERROR", e.message);
  }
});

document.getElementById("btnWhitelistRevoke")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("set_whitelist", [
      document.getElementById("govDomain").value,
      document.getElementById("govAccount").value,
      false,
    ]);
  } catch (e) {
    logOutput("WHITELIST ERROR", e.message);
  }
});

document.getElementById("btnAddSteward")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("add_steward", [document.getElementById("govAccount").value]);
  } catch (e) {
    logOutput("ADD STEWARD ERROR", e.message);
  }
});

document.getElementById("btnSaveRiskConfig")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("configure_domain_risk", [
      document.getElementById("govDomain").value,
      document.getElementById("chkStrict").checked,
      document.getElementById("chkIgnoreMinor").checked,
    ]);
  } catch (e) {
    logOutput("RISK CONFIG ERROR", e.message);
  }
});

document.getElementById("btnOverride")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("override_judgement", [
      Number(document.getElementById("ovrUid").value),
      document.getElementById("ovrOutcome").value,
      document.getElementById("ovrRationale").value,
    ]);
  } catch (e) {
    logOutput("OVERRIDE ERROR", e.message);
  }
});

document.getElementById("btnArchive")?.addEventListener("click", async () => {
  try {
    await sendContractWrite("archive_record", [
      Number(document.getElementById("ovrUid").value),
      document.getElementById("ovrRationale").value,
    ]);
  } catch (e) {
    logOutput("ARCHIVE ERROR", e.message);
  }
});

document.getElementById("btnInspectSub")?.addEventListener("click", async () => {
  try {
    const res = await callContractView("get_submission", [Number(document.getElementById("inspUid").value)]);
    lastAuditReport = res;
    logOutput("SUBMISSION RECORD", res);
  } catch (e) {
    logOutput("INSPECT ERROR", e.message);
  }
});

document.getElementById("btnInspectContent")?.addEventListener("click", async () => {
  try {
    const res = await callContractView("get_content", [Number(document.getElementById("inspUid").value)]);
    logOutput("SUBMISSION CONTENT", res);
  } catch (e) {
    logOutput("INSPECT ERROR", e.message);
  }
});

document.getElementById("btnInspectJudge")?.addEventListener("click", async () => {
  try {
    const res = await callContractView("get_judgement", [Number(document.getElementById("inspUid").value)]);
    lastAuditReport = res;
    logOutput("AI JUDGEMENT REPORT", res);
  } catch (e) {
    logOutput("INSPECT ERROR", e.message);
  }
});

document.getElementById("btnInspectDomain")?.addEventListener("click", async () => {
  try {
    const res = await callContractView("get_domain_state", [
      connectedAccount || "0x0000000000000000000000000000000000000000",
      document.getElementById("inspDomain").value,
    ]);
    logOutput("DOMAIN LANDSCAPE STATE", res);
  } catch (e) {
    logOutput("INSPECT ERROR", e.message);
  }
});