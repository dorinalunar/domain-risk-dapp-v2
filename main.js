// ============================================================================
// DomainRiskManager v2.1 — GenLayer SDK Client & Pre-Flight Policy Analyzer
// Uses genlayer-js createClient for encoded contract reads, wallet-signed
// submissions, and reproducible submit-and-finalized-readback verification.
// ============================================================================

import { createClient } from "https://esm.sh/genlayer-js";
import { studionet } from "https://esm.sh/genlayer-js/chains";

const DEFAULT_CONTRACT_ADDRESS =
    localStorage.getItem("drm_contract_addr") ||
    "0xBfD7843AF81097Faec3Ce05A86B7E106BB78024e";
const DEFAULT_RPC_URL =
    localStorage.getItem("drm_rpc_url") ||
    "https://studio.genlayer.com/api";

const STUDIO_CHAIN_ID = 61999;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const LIMITS = {
    DOMAIN: 100,
    BODY: 1500,
    BG: 800,
    RATIONALE: 600,
};

const RISK_PATTERNS = [
    {
        type: "MONOPOLY",
        weight: 35,
        keywords: ["exclusive", "sole provider", "monopoly", "only party", "single-source", "prohibit others"],
    },
    {
        type: "ASSET_CLASH",
        weight: 30,
        keywords: ["entire balance", "100% of treasury", "full collateral", "pledge all", "transfer all funds"],
    },
    {
        type: "SCHEDULE_CLASH",
        weight: 20,
        keywords: ["24/7", "simultaneous", "exclusive window", "at all times", "immediate lock"],
    },
    {
        type: "DUTY_BREACH",
        weight: 25,
        keywords: ["override fiduciary", "waive liability", "bypass audit", "ignore compliance"],
    },
    {
        type: "POWER_CLASH",
        weight: 30,
        keywords: ["unilateral veto", "sole authority", "irrevocable control", "supersede all"],
    },
    {
        type: "MISC",
        weight: 15,
        keywords: ["unverified", "informal side-deal", "off-chain override", "ambiguous scope"],
    },
];

let userAccount = null;
let lastAuditReport = null;
let lastOnChainAuditReport = null;

const elContract = document.getElementById("inputContractAddr");
const elRpc = document.getElementById("inputRpcUrl");
const elBadge = document.getElementById("contractAddr");

if (elContract) elContract.value = DEFAULT_CONTRACT_ADDRESS;
if (elRpc) elRpc.value = DEFAULT_RPC_URL;
if (elBadge) elBadge.textContent = DEFAULT_CONTRACT_ADDRESS;

function getActiveContractAddress() {
    const addr = (elContract?.value || DEFAULT_CONTRACT_ADDRESS).trim();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr) || addr === ZERO_ADDRESS) {
        throw new Error("Please configure a valid 40-hex Contract Address.");
    }
    return addr;
}

function getActiveEndpoint() {
    return (elRpc?.value || DEFAULT_RPC_URL).trim();
}

function buildStudioChain() {
    const endpoint = getActiveEndpoint();
    return {
        ...studionet,
        id: STUDIO_CHAIN_ID,
        name: "GenLayer Studio",
        rpcUrls: {
            default: { http: [endpoint] },
            public: { http: [endpoint] },
        },
    };
}

function getReadClient() {
    return createClient({
        chain: buildStudioChain(),
        endpoint: getActiveEndpoint(),
    });
}

function getWalletWriteClient(accountAddress) {
    if (!window.ethereum) {
        throw new Error("MetaMask or EIP-1193 wallet provider is required for signed transactions.");
    }
    if (!accountAddress) {
        throw new Error("Connect wallet before submitting a transaction.");
    }
    return createClient({
        chain: buildStudioChain(),
        endpoint: getActiveEndpoint(),
        provider: window.ethereum,
        account: accountAddress,
    });
}

// --- UI Logger ---
window.logToConsole = function (consoleId, msg, type = "normal") {
    const el = document.getElementById(consoleId);
    if (!el) return;
    const text = typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
    el.textContent = text;
    el.className = "console-output";
    if (type === "error") el.classList.add("status-error");
    else if (type === "success") el.classList.add("status-success");
    else if (type === "warn") el.classList.add("status-warn");
    el.scrollTop = el.scrollHeight;
};

// --- Dynamic Network Switch Helper (GenLayer Studio 61999) ---
async function ensureStudioNetwork() {
    if (!window.ethereum) return false;
    const hexChainId = "0x" + STUDIO_CHAIN_ID.toString(16);
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexChainId }],
        });
        return true;
    } catch (switchError) {
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [
                        {
                            chainId: hexChainId,
                            chainName: "GenLayer Studio",
                            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                            rpcUrls: [getActiveEndpoint()],
                        },
                    ],
                });
                return true;
            } catch (addError) {
                console.warn("Could not add GenLayer Studio network:", addError);
            }
        }
        return false;
    }
}

// --- Wallet Connection ---
export async function connectWallet() {
    if (!window.ethereum) {
        alert("Please install MetaMask!");
        return null;
    }
    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userAccount = accounts[0];
        await ensureStudioNetwork();

        const walletText = document.getElementById("walletText");
        if (walletText) walletText.innerText = userAccount.slice(0, 6) + "..." + userAccount.slice(-4);

        const statusDot = document.getElementById("statusDot");
        if (statusDot) {
            statusDot.classList.add("connected-dot");
            statusDot.style.backgroundColor = "#4ade80";
        }

        const regOwner = document.getElementById("regDomainOwner");
        if (regOwner && !regOwner.value) regOwner.value = userAccount;
        const wlAcc = document.getElementById("wlAccount");
        if (wlAcc && !wlAcc.value) wlAcc.value = userAccount;
        const dsActor = document.getElementById("dsActor");
        if (dsActor && !dsActor.value) dsActor.value = userAccount;

        await syncProtocolStats();
        return userAccount;
    } catch (error) {
        console.error("Connection error:", error);
        return null;
    }
}

document.getElementById("connectBtn")?.addEventListener("click", connectWallet);

document.getElementById("btnSaveConfig")?.addEventListener("click", async () => {
    const addr = getActiveContractAddress();
    const rpc = getActiveEndpoint();
    localStorage.setItem("drm_contract_addr", addr);
    localStorage.setItem("drm_rpc_url", rpc);
    if (elBadge) elBadge.textContent = addr;
    window.logToConsole("viewConsole", `Endpoint configuration saved:\nContract: ${addr}\nRPC: ${rpc}`, "success");
    await syncProtocolStats();
});

// ============================================================================
// 1. ENCODED GENLAYER CONTRACT READS & WALLET-SIGNED WRITES (genlayer-js)
// ============================================================================

function parseContractPayload(raw) {
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
                return JSON.parse(trimmed);
            } catch (_e) {
                return raw;
            }
        }
    }
    return raw;
}

export async function callContractView(functionName, args = []) {
    const address = getActiveContractAddress();
    const client = getReadClient();

    const rawResult = await client.readContract({
        address,
        functionName,
        args,
    });

    return parseContractPayload(rawResult);
}

export async function sendContractWrite(functionName, args = [], waitForFinalized = true) {
    if (!userAccount) {
        const connected = await connectWallet();
        if (!connected) {
            throw new Error("Wallet connection required to sign transaction.");
        }
    }

    await ensureStudioNetwork();
    const address = getActiveContractAddress();
    const client = getWalletWriteClient(userAccount);

    const txResponse = await client.writeContract({
        address,
        functionName,
        args,
        value: 0n,
    });

    const txHash =
        typeof txResponse === "string"
            ? txResponse
            : txResponse?.hash || txResponse?.txId || txResponse?.transactionHash;

    if (!txHash) {
        throw new Error("Transaction hash was not returned by wallet/client.");
    }

    let receipt = null;
    if (waitForFinalized && typeof client.waitForTransactionReceipt === "function") {
        receipt = await client.waitForTransactionReceipt({
            hash: txHash,
            status: "FINALIZED",
            retries: 60,
            interval: 3000,
        });
    }

    return { txHash, receipt };
}

// --- UI Wrappers for Read / Write ---
window.executeTx = async function (functionName, args = [], consoleId = "adminConsole") {
    try {
        window.logToConsole(
            consoleId,
            `Preparing wallet-signed transaction ${functionName}...\nPlease confirm signature in MetaMask.`,
            "warn"
        );

        const { txHash, receipt } = await sendContractWrite(functionName, args, true);
        const statusLabel = receipt?.statusName || receipt?.status || "FINALIZED";

        window.logToConsole(
            consoleId,
            `Transaction Finalized!\nMethod: ${functionName}\nTx Hash: ${txHash}\nStatus: ${statusLabel}`,
            "success"
        );

        await syncProtocolStats();
        return { txHash, receipt };
    } catch (error) {
        console.error("Execution error:", error);
        window.logToConsole(
            consoleId,
            `Failed: ${error.shortMessage || error.message || "Transaction rejected"}`,
            "error"
        );
        throw error;
    }
};

window.readData = async function (functionName, args = [], consoleId = "viewConsole") {
    try {
        window.logToConsole(consoleId, `Encoding & querying ${functionName} via genlayer-js...`, "normal");

        const parsedData = await callContractView(functionName, args);
        const displayStr = typeof parsedData === "string" ? parsedData : JSON.stringify(parsedData, null, 2);

        lastOnChainAuditReport = {
            reportType: "ONCHAIN_GENVM_AUDIT",
            version: "DomainRiskManager/v2.1",
            timestamp: new Date().toISOString(),
            network: { name: "GenLayer Studio", chainId: STUDIO_CHAIN_ID, rpc: getActiveEndpoint() },
            contractAddress: getActiveContractAddress(),
            queryMethod: functionName,
            queryArgs: args.map((a) => (typeof a === "bigint" ? a.toString() : a)),
            data: parsedData,
        };

        window.logToConsole(consoleId, `Result (${functionName}):\n${displayStr}`, "success");
        return parsedData;
    } catch (error) {
        console.error("Read error:", error);
        window.logToConsole(
            consoleId,
            `Error: ${error.shortMessage || error.message || "Contract read reverted"}`,
            "warn"
        );
        throw error;
    }
};

// ============================================================================
// 2. REPRODUCIBLE SUBMIT-AND-FINALIZED-READBACK CHECK (STEWARD VERIFICATION)
// ============================================================================

export async function performSubmitAndReadbackCheck({
    domain,
    bodyText,
    bgInfo = "",
    hook = ZERO_ADDRESS,
    consoleId = "subConsole",
} = {}) {
    const targetDomain = (domain ?? document.getElementById("subDomain")?.value ?? "").trim().toLowerCase();
    const targetBody = (bodyText ?? document.getElementById("subBody")?.value ?? "").trim();
    const targetBg = (bgInfo ?? document.getElementById("subBg")?.value ?? "").trim();
    const targetHook = (hook || document.getElementById("subHook")?.value || ZERO_ADDRESS).trim();

    if (!targetDomain || !targetBody) {
        throw new Error("Domain and Agreement Body Text are required for the Submit-and-Readback check.");
    }

    // Step 1: Encoded pre-flight read of stats() to get current global_tracker_id
    window.logToConsole(
        consoleId,
        `[Step 1/4] Reading on-chain stats() via encoded readContract...`,
        "warn"
    );
    const beforeStats = await callContractView("stats", []);
    const expectedUid = BigInt(beforeStats?.global_tracker_id || "1");

    // Step 2: Wallet-signed writeContract to submit_agreement
    window.logToConsole(
        consoleId,
        `[Step 2/4] Signing & submitting submit_agreement("${targetDomain}", ...) in MetaMask (Expected UID: ${expectedUid.toString()})...`,
        "warn"
    );
    const { txHash, receipt } = await sendContractWrite(
        "submit_agreement",
        [targetDomain, targetBody, targetBg, targetHook],
        true
    );

    // Step 3: Encoded post-finalization readback of stats(), get_submission(uid), and get_content(uid)
    window.logToConsole(
        consoleId,
        `[Step 3/4] Tx ${txHash} finalized! Running encoded readback on get_submission(${expectedUid}) & get_content(${expectedUid})...`,
        "warn"
    );

    const afterStats = await callContractView("stats", []);
    const resolvedUid =
        afterStats?.global_tracker_id && BigInt(afterStats.global_tracker_id) > 1n
            ? BigInt(afterStats.global_tracker_id) - 1n
            : expectedUid;

    const submissionRecord = await callContractView("get_submission", [resolvedUid]);
    const submissionContent = await callContractView("get_content", [resolvedUid]);

    // Step 4: Verify readback invariants against submitted values
    const invariants = {
        uidMatches: String(submissionRecord?.uid) === resolvedUid.toString(),
        domainMatches: String(submissionRecord?.domain) === targetDomain,
        stateIsQueued: String(submissionRecord?.state) === "QUEUED",
        bodyMatches: String(submissionContent?.body_text) === targetBody,
        bgMatches: String(submissionContent?.bg_info) === targetBg,
    };
    const verified = Object.values(invariants).every(Boolean);

    const verificationReport = {
        checkType: "REPRODUCIBLE_SUBMIT_AND_FINALIZED_READBACK",
        verified,
        timestamp: new Date().toISOString(),
        contractAddress: getActiveContractAddress(),
        chainId: STUDIO_CHAIN_ID,
        signer: userAccount,
        transaction: {
            method: "submit_agreement",
            txHash,
            finalizedStatus: receipt?.statusName || receipt?.status || "FINALIZED",
        },
        submissionUid: resolvedUid.toString(),
        readback: {
            beforeStats,
            afterStats,
            get_submission: submissionRecord,
            get_content: submissionContent,
        },
        invariants,
    };

    lastOnChainAuditReport = verificationReport;
    lastAuditReport = verificationReport;

    // Populate ID inputs for convenience
    const evalInput = document.getElementById("evalId");
    if (evalInput) evalInput.value = resolvedUid.toString();
    const viewInput = document.getElementById("viewId");
    if (viewInput) viewInput.value = resolvedUid.toString();
    const manageInput = document.getElementById("manageId");
    if (manageInput) manageInput.value = resolvedUid.toString();

    await syncProtocolStats();

    window.logToConsole(
        consoleId,
        `[Step 4/4] SUBMIT + FINALIZED READBACK VERIFIED (${verified ? "PASS" : "MISMATCH"}):\n` +
            JSON.stringify(verificationReport, null, 2),
        verified ? "success" : "error"
    );

    return verificationReport;
}

window.runSubmitAndReadbackCheck = async function () {
    try {
        return await performSubmitAndReadbackCheck({ consoleId: "subConsole" });
    } catch (error) {
        window.logToConsole(
            "subConsole",
            `Submit-and-Readback Check Error: ${error.shortMessage || error.message}`,
            "error"
        );
    }
};

export async function syncProtocolStats() {
    try {
        const parsed = await callContractView("stats", []);
        if (parsed && typeof parsed === "object") {
            const setTxt = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = String(val);
            };
            setTxt("statTracker", parsed.global_tracker_id ?? "1");
            setTxt("statLive", parsed.count_live ?? "0");
            setTxt("statDenied", parsed.count_denied ?? "0");
            setTxt("statManual", parsed.count_manual ?? "0");
            setTxt("statArchived", parsed.count_archived ?? "0");
            setTxt("statEvents", parsed.event_counter ?? "0");
        }
        return parsed;
    } catch (_err) {
        return null;
    }
}

// ============================================================================
// 3. LOCAL PRE-FLIGHT RISK SIMULATOR (v2.1 MILESTONE FEATURE)
// ============================================================================

export function analyzeCandidateLocally(domain, bodyText, bgInfo = "", strictMode = false, ignoreMinor = false) {
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
        validationErrors.push(
            `Body text length must be between 1 and ${LIMITS.BODY} chars (current: ${cleanBody.length}).`
        );
    }
    if (cleanBg.length > LIMITS.BG) {
        validationErrors.push(`Background info exceeds ${LIMITS.BG} chars (will be auto-trimmed on-chain).`);
    }

    const detectedFlags = [];
    const categoryStatus = {};
    let score = 0;
    const combined = `${cleanBody} ${cleanBg}`.toLowerCase();

    for (const rule of RISK_PATTERNS) {
        const matched = rule.keywords.filter((kw) => combined.includes(kw));
        if (matched.length > 0) {
            score += rule.weight;
            const level = rule.weight >= 30 ? "CRITICAL" : "MINOR";
            detectedFlags.push({
                type: rule.type,
                level,
                matchedKeywords: matched,
            });
            categoryStatus[rule.type] = level === "CRITICAL" ? "CLASH" : "WARN";
        } else {
            categoryStatus[rule.type] = "CLEAR";
        }
    }

    if (strictMode && score > 0) score = Math.round(score * 1.25);
    if (ignoreMinor && score > 0 && score < 30) score = Math.max(5, score - 15);
    if (validationErrors.length > 0) score = 100;
    score = Math.min(100, score);

    const predictedOutcome =
        validationErrors.length > 0
            ? "HALT_REJECT"
            : score >= 60 || (strictMode && score >= 35)
            ? "LIKELY_CLASH"
            : score >= 25
            ? "MANUAL_CHECK_UNCLEAR"
            : "LIKELY_SAFE";

    return {
        reportType: "PRE_FLIGHT_SIMULATION_AUDIT",
        version: "DomainRiskManager/v2.1",
        timestamp: new Date().toISOString(),
        domain: cleanDomain,
        policy: { strictMode, ignoreMinor },
        lengths: { body: cleanBody.length, bg: cleanBg.length },
        validationErrors,
        predictedOutcome,
        riskScore: score,
        detectedFlags,
        categoryStatus,
    };
}

window.updateSimCharCount = function () {
    const body = document.getElementById("simBody")?.value || "";
    const counter = document.getElementById("simCharCounter");
    if (!counter) return;
    counter.innerText = `${body.length} / 1500 chars`;
    counter.style.color = body.length > 1500 ? "#f87171" : "#a3a3a3";
};

window.runPreFlightSim = function () {
    const d = document.getElementById("simDomain")?.value || "";
    const b = document.getElementById("simBody")?.value || "";
    const bg = document.getElementById("simBg")?.value || "";
    const strict = document.getElementById("simStrict")?.value === "true";
    const minor = document.getElementById("simMinor")?.value === "true";

    const report = analyzeCandidateLocally(d, b, bg, strict, minor);
    lastAuditReport = report;

    const bar = document.getElementById("simRiskBar");
    const verdict = document.getElementById("simVerdict");
    const scoreTxt = document.getElementById("simScoreText");

    const color =
        report.riskScore >= 60 ? "#f87171" : report.riskScore >= 25 ? "#fbbf24" : "#4ade80";

    if (bar) {
        bar.style.width = `${Math.max(4, report.riskScore)}%`;
        bar.style.backgroundColor = color;
    }
    if (verdict) {
        verdict.textContent = `Verdict: ${report.predictedOutcome}`;
        verdict.style.color = color;
    }
    if (scoreTxt) {
        scoreTxt.textContent = `${report.riskScore} / 100`;
        scoreTxt.style.color = color;
    }

    document.querySelectorAll("#simCategoryGrid .cat-tag").forEach((tag) => {
        const cat = tag.getAttribute("data-cat");
        const st = report.categoryStatus[cat] || "CLEAR";
        tag.className = "cat-tag";
        if (st === "CLASH") {
            tag.classList.add("hit-clash");
            tag.children[1].textContent = "CLASH";
        } else if (st === "WARN") {
            tag.classList.add("hit-warn");
            tag.children[1].textContent = "WARN";
        } else {
            tag.classList.add("hit-clear");
            tag.children[1].textContent = "CLEAR";
        }
    });

    if (report.validationErrors.length > 0) {
        window.logToConsole("simDetails", `Validation Errors:\n${report.validationErrors.join("\n")}`, "error");
    } else if (report.detectedFlags.length > 0) {
        const summary = report.detectedFlags
            .map((f) => `${f.type} (${f.level}: ${f.matchedKeywords.join(", ")})`)
            .join(" | ");
        window.logToConsole(
            "simDetails",
            `Pre-Flight Scan [${report.predictedOutcome} — ${report.riskScore}/100]\nDetected Risk Categories: ${summary}`,
            report.riskScore >= 60 ? "error" : "warn"
        );
    } else {
        window.logToConsole(
            "simDetails",
            `Pre-Flight Scan [${report.predictedOutcome} — ${report.riskScore}/100]\nAll length & syntax guards passed. Zero conflict triggers detected across 6 categories.`,
            "success"
        );
    }
};

window.pushSimToSubmission = function () {
    const d = document.getElementById("simDomain")?.value || "";
    const b = document.getElementById("simBody")?.value || "";
    const bg = document.getElementById("simBg")?.value || "";

    const subDomain = document.getElementById("subDomain");
    const subBody = document.getElementById("subBody");
    const subBg = document.getElementById("subBg");

    if (subDomain) subDomain.value = d;
    if (subBody) subBody.value = b;
    if (subBg) subBg.value = bg;

    window.logToConsole("simDetails", "Copied candidate agreement fields to Panel 2 (Submission Cycle).", "success");
};

function downloadJsonFile(payload, prefix) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportSimAuditJson = function () {
    if (!lastAuditReport) window.runPreFlightSim();
    if (!lastAuditReport) return;
    downloadJsonFile(lastAuditReport, "domain-risk-audit");
};

window.exportViewAuditJson = function () {
    if (!lastOnChainAuditReport) {
        return window.logToConsole(
            "viewConsole",
            "Query an on-chain view or run Submit + Finalized Readback before exporting Audit JSON.",
            "warn"
        );
    }
    downloadJsonFile(lastOnChainAuditReport, "domain-risk-onchain-audit");
};

// ============================================================================
// 4. PANEL HANDLERS (MATCHING EXACT DomainRiskManager.py CONTRACT METHODS)
// ============================================================================

// --- Panel 1: Setup & Admin ---
window.addSteward = function () {
    const acc = document.getElementById("addStewardAcc")?.value.trim();
    if (!acc) return window.logToConsole("adminConsole", "Error: Steward address required.", "error");
    window.executeTx("add_steward", [acc], "adminConsole");
};

window.registerDomain = function () {
    const domain = document.getElementById("regDomainName")?.value.trim();
    const owner = (document.getElementById("regDomainOwner")?.value.trim() || userAccount || "").trim();
    if (!domain || !owner) {
        return window.logToConsole("adminConsole", "Error: Domain and Owner address required.", "error");
    }
    window.executeTx("register_domain", [domain, owner], "adminConsole");
};

window.configureDomainRisk = function () {
    const domain = document.getElementById("cfgDomain")?.value.trim();
    const strict = document.getElementById("cfgStrict")?.value === "true";
    const minor = document.getElementById("cfgMinor")?.value === "true";
    if (!domain) return window.logToConsole("adminConsole", "Error: Domain required.", "error");
    window.executeTx("configure_domain_risk", [domain, strict, minor], "adminConsole");
};

window.setWhitelist = function () {
    const domain = document.getElementById("wlDomain")?.value.trim();
    const target = (document.getElementById("wlAccount")?.value.trim() || userAccount || "").trim();
    const status = document.getElementById("wlStatus")?.value === "true";
    if (!domain || !target) {
        return window.logToConsole("adminConsole", "Error: Domain and Target address required.", "error");
    }
    window.executeTx("set_whitelist", [domain, target, status], "adminConsole");
};

// --- Panel 2: Submissions ---
window.submitAgreement = function () {
    const domain = document.getElementById("subDomain")?.value.trim();
    const body = document.getElementById("subBody")?.value.trim();
    const bg = document.getElementById("subBg")?.value.trim() || "";
    const hook = document.getElementById("subHook")?.value.trim() || ZERO_ADDRESS;
    if (!domain || !body) {
        return window.logToConsole("subConsole", "Error: Domain and Agreement text required.", "error");
    }
    window.executeTx("submit_agreement", [domain, body, bg, hook], "subConsole");
};

window.manageSubmission = function (action) {
    const id = document.getElementById("manageId")?.value.trim();
    if (!id) return window.logToConsole("subConsole", "Error: Submission ID required.", "error");
    const u256Id = BigInt(id);

    if (action === "reload") {
        window.executeTx("reload_submission", [u256Id], "subConsole");
    } else if (action === "revoke") {
        window.executeTx("revoke_submission", [u256Id], "subConsole");
    } else if (action === "archive") {
        const cause = document.getElementById("archiveCause")?.value.trim();
        if (!cause) return window.logToConsole("subConsole", "Error: Archive cause required.", "error");
        window.executeTx("archive_record", [u256Id, cause], "subConsole");
    }
};

// --- Panel 3: AI & Execution ---
window.evaluateSubmission = function () {
    const id = document.getElementById("evalId")?.value.trim();
    if (!id) return window.logToConsole("evalConsole", "Error: Submission ID required.", "error");
    window.executeTx("evaluate_submission", [BigInt(id)], "evalConsole");
};

window.executeBatchEval = function () {
    const input = document.getElementById("batchIds")?.value.trim();
    if (!input) return window.logToConsole("evalConsole", "Error: Provide comma-separated IDs.", "error");
    const arr = input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => BigInt(s));
    window.executeTx("evaluate_batch", [arr], "evalConsole");
};

window.overrideJudgement = function () {
    const id = document.getElementById("overId")?.value.trim();
    const outcome = document.getElementById("overOutcome")?.value;
    const rationale = document.getElementById("overRationale")?.value.trim();
    if (!id || !rationale) {
        return window.logToConsole("evalConsole", "Error: Submission ID and Rationale required.", "error");
    }
    window.executeTx("override_judgement", [BigInt(id), outcome, rationale], "evalConsole");
};

window.triggerHook = function () {
    const id = document.getElementById("hookId")?.value.trim();
    if (!id) return window.logToConsole("evalConsole", "Error: Submission ID required.", "error");
    window.executeTx("trigger_hook", [BigInt(id)], "evalConsole");
};

// --- Panel 4: Read & Query Views ---
window.fetchSubmissionData = function (method) {
    const id = document.getElementById("viewId")?.value.trim();
    if (!id) return window.logToConsole("viewConsole", "Error: Submission ID required.", "error");
    window.readData(method, [BigInt(id)], "viewConsole");
};

window.getIssue = function () {
    const id = document.getElementById("viewId")?.value.trim();
    const idx = document.getElementById("issueIdx")?.value.trim();
    if (!id || idx === "") {
        return window.logToConsole("viewConsole", "Error: Submission ID and Issue Index required.", "error");
    }
    window.readData("get_issue", [BigInt(id), BigInt(idx)], "viewConsole");
};

window.getDomainState = function () {
    const actor = (document.getElementById("dsActor")?.value.trim() || userAccount || ZERO_ADDRESS).trim();
    const domain = document.getElementById("dsDomain")?.value.trim();
    if (!domain) return window.logToConsole("viewConsole", "Error: Domain required.", "error");
    window.readData("get_domain_state", [actor, domain], "viewConsole");
};

window.getEvent = function () {
    const idx = document.getElementById("eventIdx")?.value.trim();
    window.readData("get_event", [BigInt(idx || "0")], "viewConsole");
};

window.getStats = function () {
    window.readData("stats", [], "viewConsole");
    syncProtocolStats();
};

// Initial background sync on page load
syncProtocolStats();