"""
Similarity Graph Builder
Bucket-based approach: O(accounts × attributes), NOT O(n²).
"""

from collections import defaultdict


# Attributes to index — each maps account field → shared-attribute type
INDEXED_ATTRIBUTES = ["device_id", "payment_id", "ip", "address"]


def build_graph(accounts: list[dict]) -> dict:
    """
    Build a similarity graph from account records.

    Returns:
        {
            "edges": [ (id_a, id_b, [shared_attrs]) ],
            "account_index": { id: account_dict },
            "buckets": { attr: { value: [ids] } }
        }
    """
    account_index = {acc["id"]: acc for acc in accounts}

    # Step 1: Build buckets — attr_value → list of account IDs
    buckets = {}
    for attr in INDEXED_ATTRIBUTES:
        buckets[attr] = defaultdict(list)
        for acc in accounts:
            val = acc.get(attr)
            if val:
                buckets[attr][val].append(acc["id"])

    # Step 2: Derive edges from buckets
    # Track edges as a dict: (id_a, id_b) → set of shared attrs
    edge_map = defaultdict(set)

    for attr in INDEXED_ATTRIBUTES:
        for value, ids in buckets[attr].items():
            if len(ids) < 2:
                continue
            # All pairs in this bucket share this attribute
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    a, b = min(ids[i], ids[j]), max(ids[i], ids[j])
                    edge_map[(a, b)].add(attr)

    # Convert to list format
    edges = [
        (a, b, list(attrs))
        for (a, b), attrs in edge_map.items()
    ]

    # NetworkX Graph Analytics
    import networkx as nx
    G = nx.Graph()
    for acc in accounts:
        G.add_node(acc["id"])
    for a, b, attrs in edges:
        G.add_edge(a, b, weight=len(attrs))

    degree_centrality = nx.degree_centrality(G) if len(G) > 0 else {}
    pagerank_scores = nx.pagerank(G) if len(G) > 0 else {}

    return {
        "edges": edges,
        "account_index": account_index,
        "buckets": buckets,
        "nx_graph": G,
        "degree_centrality": degree_centrality,
        "pagerank_scores": pagerank_scores,
    }
