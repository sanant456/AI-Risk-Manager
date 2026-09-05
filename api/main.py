"""
Abuse-Ring Sentinel — FastAPI Backend
Exposes: generate dataset, run detection, get metrics, get clusters.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import random

from data.generate import generate_dataset
from detector.pipeline import run_pipeline
from eval.evaluate import compute_metrics, find_exceptions, threshold_sweep

app = FastAPI(
    title="Abuse-Ring Sentinel",
    description="AI-powered detection of coordinated account-abuse rings",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state ──────────────────────────────────────────────────────────
state = {
    "accounts": None,
    "ground_truth": None,
    "dataset_stats": None,
    "pipeline_result": None,
    "metrics": None,
    "exceptions": None,
    "threshold_sweep": None,
}


# ── Models ───────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    source: Optional[str] = Field("kaggle", description="Dataset source: 'kaggle' or 'synthetic'")


class DetectRequest(BaseModel):
    threshold: float = Field(0.40, ge=0.05, le=0.95, description="Detection sensitivity threshold")


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/generate")
def generate(req: GenerateRequest = None):
    """Generate or load a dataset (Kaggle Financial Fraud or Synthetic)."""
    seed = req.seed if req else None
    source = req.source if req else "kaggle"
    
    if seed is None:
        seed = random.randint(1, 999999)

    if source == "ai_risk":
        from data.kaggle_loader import load_ai_automation_risk_dataset
        dataset = load_ai_automation_risk_dataset(seed=seed)
    elif source == "kaggle":
        from data.kaggle_loader import load_kaggle_as_abuse_rings
        dataset = load_kaggle_as_abuse_rings(seed=seed)
    else:
        dataset = generate_dataset(seed=seed)

    state["accounts"] = dataset["accounts"]
    state["ground_truth"] = dataset["ground_truth"]
    state["dataset_stats"] = dataset["stats"]
    
    # Save to SQLite Database
    from data.db import save_dataset_to_db
    save_dataset_to_db(dataset["accounts"], dataset["ground_truth"])

    # Reset pipeline results
    state["pipeline_result"] = None
    state["metrics"] = None
    state["exceptions"] = None
    state["threshold_sweep"] = None

    return {
        "status": "ok",
        "seed": seed,
        "source": source,
        "stats": dataset["stats"],
    }


@app.post("/detect")
def detect(req: DetectRequest = None):
    """Run the detection pipeline on the current dataset."""
    if state["accounts"] is None:
        return {"error": "No dataset loaded. Call POST /generate first."}

    threshold = req.threshold if req else 0.40

    # Run pipeline
    result = run_pipeline(state["accounts"], threshold=threshold)
    state["pipeline_result"] = result

    # Compute metrics
    all_ids = [a["id"] for a in state["accounts"]]
    metrics = compute_metrics(result["flagged"], state["ground_truth"], all_ids)
    state["metrics"] = metrics

    # Log to SQLite Database
    from data.db import log_detection_run
    log_detection_run(threshold, metrics, result)

    # Find exceptions
    exceptions = find_exceptions(result["flagged"], result["cleared"], state["ground_truth"])
    state["exceptions"] = exceptions

    # Threshold sweep (only compute once per dataset)
    if state["threshold_sweep"] is None:
        state["threshold_sweep"] = threshold_sweep(state["accounts"], state["ground_truth"])

    return {
        "status": "ok",
        "threshold": threshold,
        "metrics": metrics,
        "num_flagged": len(result["flagged"]),
        "num_cleared": len(result["cleared"]),
        "total_clusters": len(result["all_clusters"]),
    }


@app.get("/metrics")
def get_metrics():
    """Get current precision, recall, F1, and confusion matrix."""
    if state["metrics"] is None:
        return {"error": "No detection results. Call POST /detect first."}

    return {
        "metrics": state["metrics"],
        "threshold_sweep": state["threshold_sweep"],
        "exceptions": state["exceptions"],
        "dataset_stats": state["dataset_stats"],
    }


@app.get("/clusters")
def get_clusters():
    """Get all clusters with scores, members, and flag status."""
    if state["pipeline_result"] is None:
        return {"error": "No detection results. Call POST /detect first."}

    result = state["pipeline_result"]

    # Build graph data for visualization
    graph_edges = []
    for id_a, id_b, attrs in result["graph"]["edges"]:
        graph_edges.append({
            "source": id_a,
            "target": id_b,
            "shared_attrs": attrs,
        })

    # Build node data
    flagged_ids = set()
    cluster_map = {}
    for cluster in result["flagged"]:
        for mid in cluster["members"]:
            flagged_ids.add(mid)
            cluster_map[mid] = cluster["cluster_id"]
    for cluster in result["cleared"]:
        for mid in cluster["members"]:
            cluster_map[mid] = cluster["cluster_id"]

    graph_nodes = []
    for acc in state["accounts"]:
        aid = acc["id"]
        graph_nodes.append({
            "id": aid,
            "name": acc["name"],
            "flagged": aid in flagged_ids,
            "cluster_id": cluster_map.get(aid),
            "in_cluster": aid in cluster_map,
        })

    return {
        "flagged": result["flagged"],
        "cleared": result["cleared"],
        "all_clusters": result["all_clusters"],
        "threshold": result["threshold"],
        "graph": {
            "nodes": graph_nodes,
            "edges": graph_edges,
        },
    }


@app.get("/account/{account_id}")
def get_account_detail(account_id: str):
    """Get complete attribute details for a single account."""
    if state["accounts"] is None:
        return {"error": "No dataset loaded"}
    
    acc = next((a for a in state["accounts"] if a["id"] == account_id), None)
    if not acc:
        return {"error": f"Account {account_id} not found"}
    
    is_abuse = state["ground_truth"].get(account_id) if state["ground_truth"] else None
    
    # Find cluster membership
    cluster_info = None
    if state["pipeline_result"]:
        for c in state["pipeline_result"]["all_clusters"]:
            if account_id in c["members"]:
                cluster_info = {
                    "cluster_id": c["cluster_id"],
                    "score": c["score"],
                    "flagged": c["score"] >= state["pipeline_result"]["threshold"],
                    "reasons": c["reasons"],
                    "group_size": c["size"],
                }
                break
                
    return {
        "account": acc,
        "actual_ring": is_abuse,
        "detection_cluster": cluster_info,
    }


@app.get("/export")
def export_report():
    """Export detection case report and metadata summary."""
    if state["pipeline_result"] is None:
        return {"error": "No detection results to export"}
    
    return {
        "export_ts": random.randint(1700000000, 1800000000),
        "dataset_stats": state["dataset_stats"],
        "threshold": state["pipeline_result"]["threshold"],
        "metrics": state["metrics"],
        "flagged_cases": state["pipeline_result"]["flagged"],
        "cleared_cases": state["pipeline_result"]["cleared"],
        "exceptions": state["exceptions"],
    }


@app.get("/audit-logs")
def get_audit_logs():
    """Retrieve persistent detection run history and cluster audit logs from SQLite."""
    try:
        from data.db import get_db_connection
        conn = get_db_connection()
        runs = [dict(r) for r in conn.execute("SELECT * FROM detection_runs ORDER BY id DESC LIMIT 10").fetchall()]
        recent_clusters = [dict(c) for c in conn.execute("SELECT * FROM clusters ORDER BY score DESC LIMIT 15").fetchall()]
        conn.close()
        return {
            "status": "ok",
            "runs": runs,
            "recent_clusters": recent_clusters,
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "abuse-ring-sentinel",
        "dataset_loaded": state["accounts"] is not None,
        "total_accounts": len(state["accounts"]) if state["accounts"] else 0,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

