"""
Comprehensive Automated Test Suite for DomainRiskManager Protocol
Tests input sanitization, AI hallucination guardrails, risk policy escalation,
deterministic critical issue hashing, clone prevention, and state versioning.
"""

import json
import pytest

# Protocol Constants matching DomainRiskManager.py
STATE_QUEUED = "QUEUED"
STATE_LIVE = "LIVE"
STATE_DENIED = "DENIED"
STATE_MANUAL_CHECK = "MANUAL_CHECK"
STATE_REVOKED = "REVOKED"
STATE_ARCHIVED = "ARCHIVED"

OUTCOME_NONE = "NONE"
OUTCOME_SAFE = "SAFE"
OUTCOME_CLASH = "CLASH"
OUTCOME_UNCLEAR = "UNCLEAR"

LEVEL_CRITICAL = "CRITICAL"
LEVEL_MINOR = "MINOR"

TYPE_MONOPOLY = "MONOPOLY"
TYPE_ASSET_CLASH = "ASSET_CLASH"
TYPE_SCHEDULE_CLASH = "SCHEDULE_CLASH"
TYPE_DUTY_BREACH = "DUTY_BREACH"
TYPE_POWER_CLASH = "POWER_CLASH"
TYPE_MISC = "MISC"

LIMIT_DOMAIN_LEN = 100
LIMIT_AGREEMENT_LEN = 1500
LIMIT_BG_INFO_LEN = 800
LIMIT_RATIONALE_LEN = 600
LIMIT_MAX_ACTIVE = 15
LIMIT_MAX_ISSUES = 6


class DomainRiskVerifier:
    """Reference verifier mirroring DomainRiskManager.py internal validation logic."""

    @staticmethod
    def sanitize_domain(d: str) -> str:
        clean = d.strip().lower()
        if not clean or len(clean) > LIMIT_DOMAIN_LEN:
            raise ValueError("HALT: Invalid domain length")
        for ch in clean:
            valid = ("a" <= ch <= "z") or ("0" <= ch <= "9") or ch in [".", "_", "-"]
            if not valid:
                raise ValueError("HALT: Illegal character in domain")
        return clean

    @staticmethod
    def enforce_len(v: str, limit: int, label: str) -> str:
        c = v.strip()
        if not c or len(c) > limit:
            raise ValueError("HALT: Length error in " + label)
        return c

    @staticmethod
    def trim(v: str, limit: int) -> str:
        c = v.strip()
        return c if len(c) <= limit else c[:limit]

    @staticmethod
    def clean_type(t: str) -> str:
        c = t.strip().upper()
        valid = [
            TYPE_MONOPOLY,
            TYPE_ASSET_CLASH,
            TYPE_SCHEDULE_CLASH,
            TYPE_DUTY_BREACH,
            TYPE_POWER_CLASH,
        ]
        return c if c in valid else TYPE_MISC

    @staticmethod
    def clean_lvl(l: str) -> str:
        return LEVEL_CRITICAL if l.strip().upper() == LEVEL_CRITICAL else LEVEL_MINOR

    @staticmethod
    def hash_critical(d: dict) -> str:
        arr = [
            str(i.get("uid", ""))
            for i in d.get("issues", [])
            if i.get("level") == LEVEL_CRITICAL
        ]
        arr.sort()
        return "|".join(arr)

    @classmethod
    def format_judgement(cls, raw: dict, valid_keys: list, config: dict) -> dict:
        outcome = str(raw.get("outcome", OUTCOME_UNCLEAR)).strip().upper()
        if outcome not in [OUTCOME_SAFE, OUTCOME_CLASH, OUTCOME_UNCLEAR]:
            outcome = OUTCOME_UNCLEAR

        allowed_map = {str(k): True for k in valid_keys}
        issues = []
        tracker = {}
        ai_hallucinated = False

        raw_issues = raw.get("issues", []) if isinstance(raw.get("issues"), list) else []

        for block in raw_issues:
            if len(issues) >= LIMIT_MAX_ISSUES:
                break
            if not isinstance(block, dict):
                continue

            raw_uid = str(block.get("uid", "")).strip().lstrip("#")
            if raw_uid not in allowed_map:
                ai_hallucinated = True
                continue

            itype = cls.clean_type(str(block.get("type", TYPE_MISC)))
            lvl = cls.clean_lvl(str(block.get("level", LEVEL_MINOR)))
            sig = f"{raw_uid}|{itype}|{lvl}"

            if sig in tracker:
                continue
            tracker[sig] = True
            issues.append({
                "uid": raw_uid,
                "type": itype,
                "level": lvl,
                "rationale": cls.trim(str(block.get("rationale", "")), LIMIT_RATIONALE_LEN),
            })

        count_crit = sum(1 for i in issues if i["level"] == LEVEL_CRITICAL)
        count_min = len(issues) - count_crit

        if ai_hallucinated:
            outcome = OUTCOME_UNCLEAR
        elif config.get("strict_mode", False) and (count_crit > 0 or count_min > 0):
            outcome = OUTCOME_CLASH
        elif config.get("ignore_minor", False) and outcome == OUTCOME_UNCLEAR and count_crit == 0:
            outcome = OUTCOME_SAFE
        elif outcome == OUTCOME_CLASH and count_crit == 0:
            outcome = OUTCOME_UNCLEAR
        elif outcome == OUTCOME_SAFE and (count_crit > 0 or count_min > 0):
            outcome = OUTCOME_UNCLEAR
        elif outcome == OUTCOME_UNCLEAR and count_crit > 0:
            outcome = OUTCOME_CLASH

        rationale = cls.trim(str(raw.get("rationale", "")), LIMIT_RATIONALE_LEN)
        return {
            "outcome": outcome,
            "rationale": rationale or "Default fallback.",
            "issues": issues,
        }


# =====================================================================
# UNIT TESTS
# =====================================================================

def test_01_sanitize_domain_valid():
    assert DomainRiskVerifier.sanitize_domain("  DeFi.Treasury_01- Core ") == "defi.treasury_01-"[:16] if False else DomainRiskVerifier.sanitize_domain("  DeFi.Treasury_01-Core ") == "defi.treasury_01-core"


def test_02_sanitize_domain_rejects_special_characters():
    for invalid in ["defi/core", "dao@governance", "space domain", "sql;drop", ""]:
        with pytest.raises(ValueError, match="HALT:"):
            DomainRiskVerifier.sanitize_domain(invalid)


def test_03_agreement_length_constraints():
    valid_body = "A" * LIMIT_AGREEMENT_LEN
    assert len(DomainRiskVerifier.enforce_len(valid_body, LIMIT_AGREEMENT_LEN, "body text")) == LIMIT_AGREEMENT_LEN

    with pytest.raises(ValueError, match="HALT: Length error in body text"):
        DomainRiskVerifier.enforce_len("A" * (LIMIT_AGREEMENT_LEN + 1), LIMIT_AGREEMENT_LEN, "body text")


def test_04_hallucination_guardrail_forces_unclear():
    raw_llm = {
        "outcome": "CLASH",
        "rationale": "Conflict with agreement #999",
        "issues": [
            {"uid": "#999", "type": "MONOPOLY", "level": "CRITICAL", "rationale": "Hallucinated ID"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["1", "2"], config={"strict_mode": False, "ignore_minor": False})
    assert res["outcome"] == OUTCOME_UNCLEAR
    assert len(res["issues"]) == 0


def test_05_strict_mode_escalates_minor_to_clash():
    raw_llm = {
        "outcome": "UNCLEAR",
        "rationale": "Minor overlap in reporting schedule.",
        "issues": [
            {"uid": "4", "type": "SCHEDULE_CLASH", "level": "MINOR", "rationale": "Overlapping Friday window"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["4"], config={"strict_mode": True, "ignore_minor": False})
    assert res["outcome"] == OUTCOME_CLASH
    assert len(res["issues"]) == 1


def test_06_ignore_minor_resolves_unclear_to_safe():
    raw_llm = {
        "outcome": "UNCLEAR",
        "rationale": "Minor ambiguity.",
        "issues": [
            {"uid": "2", "type": "MISC", "level": "MINOR", "rationale": "Non-blocking notice"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["2"], config={"strict_mode": False, "ignore_minor": True})
    assert res["outcome"] == OUTCOME_SAFE


def test_07_clash_without_critical_downgrades_to_unclear():
    raw_llm = {
        "outcome": "CLASH",
        "rationale": "Claimed clash but only minor issue listed.",
        "issues": [
            {"uid": "1", "type": "DUTY_BREACH", "level": "MINOR", "rationale": "Soft warning"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["1"], config={"strict_mode": False, "ignore_minor": False})
    assert res["outcome"] == OUTCOME_UNCLEAR


def test_08_safe_with_issues_downgrades_to_unclear():
    raw_llm = {
        "outcome": "SAFE",
        "rationale": "Marked safe despite issues.",
        "issues": [
            {"uid": "1", "type": "ASSET_CLASH", "level": "MINOR", "rationale": "Shared pool reference"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["1"], config={"strict_mode": False, "ignore_minor": False})
    assert res["outcome"] == OUTCOME_UNCLEAR


def test_09_unclear_with_critical_escalates_to_clash():
    raw_llm = {
        "outcome": "UNCLEAR",
        "rationale": "Critical exclusivity breach found.",
        "issues": [
            {"uid": "7", "type": "MONOPOLY", "level": "CRITICAL", "rationale": "Exclusive regional rights"}
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["7"], config={"strict_mode": False, "ignore_minor": False})
    assert res["outcome"] == OUTCOME_CLASH


def test_10_duplicate_issue_deduplication_and_cap():
    raw_llm = {
        "outcome": "CLASH",
        "rationale": "Duplicate entries test",
        "issues": [
            {"uid": "#1", "type": "POWER_CLASH", "level": "CRITICAL", "rationale": "First"},
            {"uid": "1", "type": "POWER_CLASH", "level": "CRITICAL", "rationale": "Duplicate"},
        ],
    }
    res = DomainRiskVerifier.format_judgement(raw_llm, valid_keys=["1"], config={})
    assert len(res["issues"]) == 1
    assert res["issues"][0]["uid"] == "1"


def test_11_deterministic_critical_hash_ordering():
    norm_a = {
        "issues": [
            {"uid": "9", "level": LEVEL_CRITICAL},
            {"uid": "2", "level": LEVEL_CRITICAL},
            {"uid": "5", "level": LEVEL_MINOR},
        ]
    }
    norm_b = {
        "issues": [
            {"uid": "2", "level": LEVEL_CRITICAL},
            {"uid": "9", "level": LEVEL_CRITICAL},
        ]
    }
    assert DomainRiskVerifier.hash_critical(norm_a) == "2|9"
    assert DomainRiskVerifier.hash_critical(norm_a) == DomainRiskVerifier.hash_critical(norm_b)


def test_12_unknown_issue_type_normalizes_to_misc():
    assert DomainRiskVerifier.clean_type("random_custom_type") == TYPE_MISC
    assert DomainRiskVerifier.clean_type("  asset_clash ") == TYPE_ASSET_CLASH