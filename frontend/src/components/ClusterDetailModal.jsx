/**
 * ClusterDetailModal — Deep-dive modal inspector for flagged rings & clusters
 */
export default function ClusterDetailModal({ cluster, onClose }) {
  if (!cluster) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-rose)', fontWeight: 700 }}>
              Abuse Ring Deep Dive
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700 }}>
              {cluster.cluster_id}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Risk Score</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                {cluster.score.toFixed(3)}
              </div>
            </div>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Group Size</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                {cluster.size} Accounts
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Scoring Signals & Detection Triggers</div>
            <div className="tag-cloud">
              {cluster.reasons?.map((reason, i) => (
                <span key={i} className="reason-pill" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Member Accounts</div>
            <div style={{ background: 'rgba(7, 9, 19, 0.6)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {cluster.members?.map((m) => (
                <div key={m} style={{ padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                  👤 {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
