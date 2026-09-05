# Abuse-Ring Sentinel

> **AI Risk Manager** — Razorpay AI Buildathon, Track 02  
> Detects coordinated account-abuse rings using shared identifiers and behavioral timing.

---

## What It Does

Abuse-Ring Sentinel identifies groups of fake accounts likely created by the same person or group to exploit promos, referrals, or returns. It works by:

1. **Building a similarity graph** from shared identifiers (device, payment method, IP, address)
2. **Clustering** connected accounts using Union-Find
3. **Scoring** each cluster based on how strongly the sharing signals point to abuse vs. legitimate use
4. **Flagging** clusters above a tunable threshold

The dashboard lets you **adjust detection sensitivity in real time** and see how precision/recall trade off — including real examples of false positives and false negatives.

---

## Scoring Formula

Each cluster receives a composite score from 0 to 1:

```
score = 0.35 × device_sharing_ratio
      + 0.30 × payment_sharing_ratio
      + 0.10 × ip_sharing_ratio
      + 0.05 × address_sharing_ratio
      + 0.15 × timing_score
      + 0.05 × promo_score
```

### Why These Weights?

| Signal | Weight | Rationale |
|--------|--------|-----------|
| `device_id` | **0.35** | Hardest to share innocently — different people rarely use the same physical device to create accounts |
| `payment_id` | **0.30** | Same payment method across accounts is a strong signal; legitimate users have their own cards/wallets |
| `ip` | **0.10** | Weaker signal — NAT routers, VPNs, campus networks, and shared WiFi cause innocent IP sharing |
| `address` | **0.05** | Weakest signal — real family members/roommates share addresses. This must NOT dominate scoring |
| `timing` | **0.15** | Signup timestamp clustering (std dev < 1 hour → 1.0, < 6h → 0.75, < 1 day → 0.5, else → 0.0). Coordinated batch creation is a behavioral tell that's independent of identifiers |
| `promo` | **0.05** | ≥3 members sharing the same promo code → 1.0, else 0.0. Small weight because promo reuse alone isn't abuse — but combined with other signals, it indicates intent |

The weights are designed so that **address + IP sharing alone** (the household scenario) scores well below the default threshold (0.40), while **device + payment sharing** pushes clusters firmly above it.

---

## How to Run Locally

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip / npm

### 1. Install Python dependencies

```bash
pip install fastapi uvicorn pydantic
```

### 2. Run the evaluation (standalone)

```bash
python3 eval/evaluate.py
```

This generates a synthetic dataset, runs the detector, and prints precision/recall/F1 with a threshold sweep table.

### 3. Start the API server

```bash
python3 api/main.py
# or
uvicorn api.main:app --reload --port 8000
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and click **"Generate & Detect"**.

---

## Project Structure

```
├── data/
│   └── generate.py          # Synthetic dataset generator
├── detector/
│   ├── graph.py              # Bucket-based similarity graph
│   ├── cluster.py            # Union-Find connected components
│   ├── scorer.py             # Composite scoring formula
│   └── pipeline.py           # Orchestrator
├── eval/
│   └── evaluate.py           # Evaluation: precision, recall, F1, threshold sweep
├── api/
│   ├── main.py               # FastAPI backend
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx            # Main dashboard
│       └── components/        # StatsBar, GraphView, SensitivitySlider, CaseList, ExceptionLog
├── docs/
│   └── architecture.md       # Data flow diagram
└── README.md
```

---

## Known Limitations

1. **Zero-overlap evasion**: If a ring member uses entirely distinct identifiers (new device, new payment, different IP, different address), they will not be linked to the ring. The detector requires at least one shared identifier to create an edge.

2. **Slow-roll attacks**: The timing signal assumes batch creation. If an attacker creates accounts over weeks/months, the timing score drops to zero and only identifier sharing remains.

3. **Multi-hop evasion**: If members A–B share a device and B–C share a payment method, but A–C share nothing, they're still clustered together via B. However, the per-pair sharing is diluted, potentially dropping the cluster score below threshold.

4. **IP churn**: Mobile networks and VPNs cause IP addresses to be reassigned. Today's shared IP may be coincidental. This is why IP weight is only 0.10.

5. **No account behavior modeling**: The detector only uses signup-time attributes. It doesn't analyze post-signup behavior (purchase patterns, refund rates, promo redemption timing).

6. **Scale**: The current implementation is in-memory and suited for demo-sized datasets (hundreds of accounts). Production would need a graph database or distributed processing.

---

## Defense-Only

This project is **strictly defense-only**. It does not contain:
- Tools for generating fraudulent accounts
- Evasion strategies or fingerprint spoofing code
- Any code that could be repurposed for fraud

The synthetic data generator creates obviously fake data (random UUIDs, generic names) and is designed solely for testing the detection pipeline.

---

## Metrics Integrity

**All metrics (precision, recall, F1, confusion matrix) are computed live** by running the detector against ground truth labels. There are zero hardcoded numbers anywhere in the codebase. The evaluation script (`eval/evaluate.py`) can be run independently to verify.
