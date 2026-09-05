"""
Detection Pipeline Orchestrator
Ties together: graph building → clustering → scoring → threshold filtering.
"""

from .graph import build_graph
from .cluster import find_clusters
from .scorer import score_cluster


DEFAULT_THRESHOLD = 0.40


def run_pipeline(accounts: list[dict], threshold: float = None) -> dict:
    """
    Run the full detection pipeline.

    Args:
        accounts: List of account dicts (the detector NEVER sees ground truth).
        threshold: Score threshold for flagging. Defaults to 0.40.

    Returns:
        {
            "all_clusters": [ scored_cluster_dict, ... ],
            "flagged": [ scored_cluster_dict, ... ],
            "cleared": [ scored_cluster_dict, ... ],
            "threshold": float,
            "graph": { edges, account_index, buckets },
        }
    """
    if threshold is None:
        threshold = DEFAULT_THRESHOLD

    # Step 1: Build similarity graph
    graph = build_graph(accounts)

    # Step 2: Find connected components
    clusters = find_clusters(graph["edges"])

    # Step 3: Score each cluster
    scored = []
    for cluster_id, member_ids in clusters.items():
        result = score_cluster(
            cluster_id, member_ids,
            graph["account_index"], graph["edges"]
        )
        scored.append(result)

    # Sort by score descending
    scored.sort(key=lambda c: c["score"], reverse=True)

    # Step 4: Apply threshold
    flagged = [c for c in scored if c["score"] >= threshold]
    cleared = [c for c in scored if c["score"] < threshold]

    return {
        "all_clusters": scored,
        "flagged": flagged,
        "cleared": cleared,
        "threshold": threshold,
        "graph": graph,
    }
