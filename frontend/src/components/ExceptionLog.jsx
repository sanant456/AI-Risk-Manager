/**
 * ExceptionLog — Real-time False Positive and False Negative analysis
 */
export default function ExceptionLog({ exceptions }) {
  if (!exceptions) {
    return (
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>📋</span> Exception Log
          </div>
        </div>
        <div className="panel-body">
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
            <div style={{ fontSize: '0.85rem' }}>Run detection to view real false-positive and false-negative edge cases</div>
          </div>
        </div>
      </div>
    );
  }

  const { false_positive, false_negative } = exceptions;

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span>📋</span> Exception & Edge-Case Analysis
        </div>
        <span className="pill-tag">Live Auditing</span>
      </div>
      <div className="panel-body">
        <div className="exception-box">
          {false_positive && (
            <div className="exception-card fp animate-fade-in">
              <div className="exception-header">
                ⚠️ False Positive — Legitimate Household / Shared IP
              </div>
              <div className="exception-desc">{false_positive.explanation}</div>
              {false_positive.cluster_id && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                  Cluster: {false_positive.cluster_id} · Members: {false_positive.members?.length} · Score: {false_positive.score?.toFixed(3)}
                </div>
              )}
            </div>
          )}

          {false_negative && (
            <div className="exception-card fn animate-fade-in">
              <div className="exception-header">
                🔴 False Negative — Evasion / Slow-Roll Ring
              </div>
              <div className="exception-desc">{false_negative.explanation}</div>
              {false_negative.ring_id && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                  Ground Truth Ring: {false_negative.ring_id} · Missed: {false_negative.missed_count}/{false_negative.total_members} members
                </div>
              )}
            </div>
          )}

          {!false_positive && !false_negative && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.9rem' }}>
              🎯 Zero Exceptions — Perfect Precision and Recall at current threshold!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
