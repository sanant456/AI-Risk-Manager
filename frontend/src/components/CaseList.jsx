/**
 * CaseList — Interactive list of flagged abuse rings
 */
export default function CaseList({ flaggedClusters, onSelectCluster }) {
  if (!flaggedClusters || flaggedClusters.length === 0) {
    return (
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>🚨</span> Flagged Abuse Rings
          </div>
        </div>
        <div className="panel-body">
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: 600 }}>No rings flagged</div>
            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
              All clusters scored below the current sensitivity threshold.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span>🚨</span> Flagged Abuse Rings
        </div>
        <span className="pill-tag">{flaggedClusters.length} Rings Identified</span>
      </div>
      <div className="panel-body">
        <div className="case-scroll-list">
          {flaggedClusters.map((cluster) => (
            <div
              key={cluster.cluster_id}
              className="ring-card animate-fade-in"
              onClick={() => onSelectCluster && onSelectCluster(cluster)}
            >
              <div className="ring-card-head">
                <span className="ring-id">{cluster.cluster_id}</span>
                <span className="score-badge">
                  Score: {cluster.score.toFixed(3)}
                </span>
              </div>
              <div className="ring-meta">
                {cluster.size} linked accounts ({cluster.members.slice(0, 3).join(', ')}
                {cluster.members.length > 3 ? ` +${cluster.members.length - 3} more` : ''})
              </div>
              <div className="tag-cloud">
                {cluster.reasons?.map((reason, i) => (
                  <span key={i} className="reason-pill">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
