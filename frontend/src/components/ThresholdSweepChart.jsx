/**
 * ThresholdSweepChart — Displays precision, recall, and F1 trade-offs across thresholds
 */
export default function ThresholdSweepChart({ sweepData, currentThreshold }) {
  if (!sweepData || sweepData.length === 0) return null;

  return (
    <div className="glass-panel full-width-col">
      <div className="panel-header">
        <div className="panel-title">
          <span>📈</span> Sensitivity Sweep & Trade-off Matrix
        </div>
        <span className="pill-tag">Threshold Optimization</span>
      </div>
      <div className="panel-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px', overflowX: 'auto' }}>
          {sweepData.map((step) => {
            const isSelected = Math.abs(step.threshold - currentThreshold) < 0.02;
            return (
              <div
                key={step.threshold}
                style={{
                  padding: '10px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                  border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                  t={step.threshold.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent-emerald)' }}>
                  {(step.f1 * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  P:{(step.precision * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                  R:{(step.recall * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
