# Architecture — Abuse-Ring Sentinel

This document describes the data flow through the system, from synthetic data generation to the dashboard display. Each section explains what happens at that stage and why.

---

## Overview

The system has six stages, flowing left to right:

```
Generator → Graph Builder → Clustering → Scoring → API → Dashboard
```

Each stage takes the output of the previous one and adds a layer of analysis. By the end, the dashboard shows which account groups look like coordinated abuse — and which don't.

---

## Stage 1: Data Generator

**What it does:** Creates a synthetic dataset of 300–500 fake accounts that simulate real-world patterns.

**How it works:**
- Generates 6–10 "abuse rings" — groups of 3–7 accounts that share identifying information (same device, same payment method, same IP) and were created within minutes of each other
- Generates 3–5 "innocent households" — groups of 2–4 accounts that share only an address and IP (like a family sharing a home WiFi router), but signed up weeks or months apart
- Fills the rest with completely independent accounts (noise)

**Why this matters:** The innocent households are the critical test. A good detector must flag the abuse rings WITHOUT also flagging real families. This is the core precision/recall tradeoff.

**Output:** A list of accounts (what the detector sees) and a separate ground-truth file (what we use later to check if the detector was right).

---

## Stage 2: Graph Builder

**What it does:** Creates a network (graph) where accounts are dots (nodes) and shared identifiers are lines (edges) between them.

**How it works:**
- For each identifier type (device ID, payment ID, IP address, physical address), it builds an index: "which accounts share this exact value?"
- If two accounts share a device ID, they get connected by an edge labeled "device_id"
- Two accounts can have multiple edges (e.g., they share both device AND IP)

**Why not compare every pair?** With 400 accounts, comparing every pair would mean 80,000 comparisons. Instead, we index by attribute value and only compare accounts that already share something. This is much faster.

**Output:** A graph with ~400 nodes and edges wherever accounts share identifiers.

---

## Stage 3: Clustering (Union-Find)

**What it does:** Groups connected accounts into clusters. If account A shares a device with B, and B shares a payment method with C, then A-B-C are all in the same cluster.

**How it works:** Uses a data structure called Union-Find (also known as Disjoint Set Union). When we see an edge between two accounts, we merge their groups. At the end, each group is a "candidate cluster" — a set of accounts that might be an abuse ring.

**Why Union-Find?** It's extremely fast (nearly O(1) per operation) and handles transitive connections automatically. If A→B and B→C, it correctly puts A, B, and C in the same group without explicit A→C comparison.

**Output:** A list of clusters, each containing 2 or more accounts that are connected by at least one shared identifier.

---

## Stage 4: Scoring

**What it does:** Assigns a risk score (0.0 to 1.0) to each cluster based on how much the sharing pattern looks like coordinated abuse versus innocent coincidence.

**How it works:** For each cluster, it computes:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Device sharing | 35% | What fraction of members use the same device? |
| Payment sharing | 30% | What fraction share a payment method? |
| IP sharing | 10% | What fraction share an IP address? |
| Address sharing | 5% | What fraction share a physical address? |
| Timing tightness | 15% | How close together were the signup times? |
| Promo code reuse | 5% | Do ≥3 members use the same promo code? |

The final score is a weighted sum. A cluster of accounts sharing a device and payment method, created within an hour, scores ~0.65–0.80. A household sharing just an address and IP, with months-apart signups, scores ~0.15–0.20.

**Why these weights?** Device and payment method are strong signals because real people don't share them. IP and address are weak signals because real households share them. The weights are tuned so innocent households stay well below the flagging threshold.

**Output:** Each cluster now has a score, a breakdown showing which signals contributed, and human-readable reasons explaining why it scored the way it did.

---

## Stage 5: API Server

**What it does:** Provides a simple web interface (HTTP endpoints) that the dashboard can talk to.

**Endpoints:**

| Endpoint | What it does |
|----------|-------------|
| POST /generate | Creates a new synthetic dataset |
| POST /detect | Runs the detection pipeline with a given threshold |
| GET /metrics | Returns precision, recall, F1, and confusion matrix |
| GET /clusters | Returns all clusters, their scores, and graph data for visualization |

**Why a separate API?** It decouples the Python detection logic from the JavaScript dashboard. The dashboard just calls these endpoints and displays the results.

**Output:** JSON responses that the frontend renders.

---

## Stage 6: Dashboard

**What it does:** Visualizes everything for the user in an interactive interface.

**Components:**

1. **Stats Bar** — Shows accounts scanned, rings flagged, precision, recall, and F1 at a glance
2. **Account Graph** — A force-directed network visualization where flagged rings appear in red and cleared clusters in blue. You can drag, zoom, and hover for details
3. **Sensitivity Slider** — Adjusts the detection threshold from 0.05 (very sensitive, catches everything but has false positives) to 0.90 (very strict, very few flags). Moving the slider re-runs detection in real time
4. **Case List** — Each flagged ring with its score and the specific reasons it was flagged (e.g., "Shared device_id (100% of members), Accounts created within a very tight time window")
5. **Exception Log** — Shows one real false-positive (an innocent cluster that would be wrongly flagged at a lower threshold) and one real false-negative (an abuse ring that was missed), with plain-language explanations of why each happened

**Why show exceptions?** The buildathon track values honest metrics. Showing what the detector gets wrong — and explaining why — demonstrates genuine understanding of the precision/recall tradeoff.

---

## Data Flow Summary

```
[Synthetic Generator]
        │
        ▼
   accounts.json ──────────────────┐
        │                          │
        ▼                          ▼
 [Graph Builder]            ground_truth.json
        │                          │
        ▼                          │
  similarity graph                 │
        │                          │
        ▼                          │
   [Clustering]                    │
        │                          │
        ▼                          │
  candidate clusters               │
        │                          │
        ▼                          │
    [Scoring]                      │
        │                          │
        ▼                          ▼
  scored clusters ──────►  [Evaluation]
        │                    │
        ▼                    ▼
     [API] ◄──────── precision/recall/F1
        │
        ▼
   [Dashboard]
```

The ground truth never enters the detection pipeline — it's only used after detection to compute metrics. This ensures the metrics are honest: the detector can't "cheat" by looking at the answers.
