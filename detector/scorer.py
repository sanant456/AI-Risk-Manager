"""
Cluster Scorer
Composite scoring formula that weighs attribute sharing, timing tightness, and promo abuse.

Scoring Formula:
    score = w_device   * device_ratio
          + w_payment  * payment_ratio
          + w_ip       * ip_ratio
          + w_address  * address_ratio
          + w_timing   * timing_score
          + w_promo    * promo_score

Weights rationale:
    - device_id  (0.35): Very hard to share innocently — strong fraud signal
    - payment_id (0.30): Same payment method across accounts = strong signal
    - ip         (0.10): NAT, VPNs, campus networks cause innocent sharing
    - address    (0.05): Real households share addresses legitimately
    - timing     (0.15): Coordinated batch creation is a behavioral tell
    - promo      (0.05): Promo abuse across ≥3 members shows intent
"""

from collections import defaultdict, Counter
from datetime import datetime
import statistics

# ── Weights ──────────────────────────────────────────────────────────────────
WEIGHTS = {
    "device_id":  0.35,
    "payment_id": 0.30,
    "ip":         0.10,
    "address":    0.05,
    "timing":     0.15,
    "promo":      0.05,
}


def _compute_sharing_ratio(members: list[dict], attr: str) -> float:
    """
    Fraction of members that share at least one attribute value with another member.
    Returns 0.0 if all values are unique, 1.0 if all values are identical.
    """
    values = [m.get(attr) for m in members if m.get(attr)]
    if len(values) < 2:
        return 0.0

    counts = Counter(values)
    # Number of members whose value appears more than once
    shared_count = sum(c for v, c in counts.items() if c > 1)
    return shared_count / len(values)


def _compute_timing_score(members: list[dict]) -> float:
    """
    Score based on the standard deviation of signup timestamps.
    Tight clustering → high score (likely coordinated).
    """
    timestamps = []
    for m in members:
        ts = m.get("signup_ts")
        if ts:
            try:
                timestamps.append(datetime.fromisoformat(ts).timestamp())
            except (ValueError, TypeError):
                continue

    if len(timestamps) < 2:
        return 0.0

    std_dev_hours = statistics.stdev(timestamps) / 3600

    if std_dev_hours < 1:       # within 1 hour
        return 1.0
    elif std_dev_hours < 6:     # within 6 hours
        return 0.75
    elif std_dev_hours < 24:    # within 1 day
        return 0.5
    elif std_dev_hours < 72:    # within 3 days
        return 0.25
    else:
        return 0.0


def _compute_promo_score(members: list[dict]) -> float:
    """
    1.0 if ≥3 members share the same promo code, else 0.0.
    """
    promos = [m.get("promo_code") for m in members if m.get("promo_code")]
    if len(promos) < 3:
        return 0.0

    counts = Counter(promos)
    max_shared = counts.most_common(1)[0][1] if counts else 0
    return 1.0 if max_shared >= 3 else 0.0


def score_cluster(cluster_id: str, member_ids: list[str],
                  account_index: dict, edges: list[tuple]) -> dict:
    """
    Score a single cluster.

    Returns:
        {
            "cluster_id": str,
            "members": [account_id, ...],
            "size": int,
            "score": float,
            "breakdown": { attr: float, ... },
            "reasons": [str, ...],
        }
    """
    members = [account_index[mid] for mid in member_ids if mid in account_index]
    if len(members) < 2:
        return {
            "cluster_id": cluster_id,
            "members": member_ids,
            "size": len(members),
            "score": 0.0,
            "breakdown": {},
            "reasons": [],
        }

    # Compute per-attribute sharing ratios
    device_ratio = _compute_sharing_ratio(members, "device_id")
    payment_ratio = _compute_sharing_ratio(members, "payment_id")
    ip_ratio = _compute_sharing_ratio(members, "ip")
    address_ratio = _compute_sharing_ratio(members, "address")
    timing = _compute_timing_score(members)
    promo = _compute_promo_score(members)

    # Composite score
    score = (
        WEIGHTS["device_id"]  * device_ratio +
        WEIGHTS["payment_id"] * payment_ratio +
        WEIGHTS["ip"]         * ip_ratio +
        WEIGHTS["address"]    * address_ratio +
        WEIGHTS["timing"]     * timing +
        WEIGHTS["promo"]      * promo
    )

    breakdown = {
        "device_id": round(device_ratio, 3),
        "payment_id": round(payment_ratio, 3),
        "ip": round(ip_ratio, 3),
        "address": round(address_ratio, 3),
        "timing": round(timing, 3),
        "promo": round(promo, 3),
    }

    # Build human-readable reasons
    reasons = []
    if device_ratio > 0:
        reasons.append(f"Shared device_id ({device_ratio:.0%} of members)")
    if payment_ratio > 0:
        reasons.append(f"Shared payment_id ({payment_ratio:.0%} of members)")
    if ip_ratio > 0:
        reasons.append(f"Shared IP address ({ip_ratio:.0%} of members)")
    if address_ratio > 0:
        reasons.append(f"Shared physical address ({address_ratio:.0%} of members)")
    if timing >= 0.75:
        reasons.append("Accounts created within a very tight time window")
    elif timing >= 0.5:
        reasons.append("Accounts created within the same day")
    if promo >= 1.0:
        reasons.append("≥3 members used the same promo code")

    return {
        "cluster_id": cluster_id,
        "members": member_ids,
        "size": len(members),
        "score": round(score, 4),
        "breakdown": breakdown,
        "reasons": reasons,
    }
