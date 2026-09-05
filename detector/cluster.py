"""
Union-Find (Disjoint Set Union) for clustering connected components.
"""


class UnionFind:
    """Weighted union-find with path compression."""

    def __init__(self):
        self.parent = {}
        self.rank = {}

    def find(self, x):
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])  # path compression
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        # union by rank
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1


def find_clusters(edges: list[tuple]) -> dict[str, list[str]]:
    """
    Given edges [(id_a, id_b, shared_attrs), ...], return connected components.

    Returns:
        { cluster_id: [account_id, ...] }
    """
    uf = UnionFind()

    # Register all nodes and merge connected ones
    for id_a, id_b, _attrs in edges:
        uf.union(id_a, id_b)

    # Group by root
    from collections import defaultdict
    components = defaultdict(list)
    all_nodes = set()
    for id_a, id_b, _ in edges:
        all_nodes.add(id_a)
        all_nodes.add(id_b)

    for node in all_nodes:
        root = uf.find(node)
        components[root].append(node)

    # Assign readable cluster IDs and filter singletons
    clusters = {}
    for i, (root, members) in enumerate(sorted(components.items(), key=lambda x: -len(x[1]))):
        if len(members) >= 2:
            clusters[f"cluster-{i+1:03d}"] = sorted(members)

    return clusters
