/**
 * StatsBar — Top-level metrics cards with glowing visual accents
 */
export default function StatsBar({ metrics, datasetStats, numFlagged }) {
  const stats = [
    {
      title: 'Accounts Scanned',
      value: datasetStats?.total_accounts ?? '—',
      foot: datasetStats ? `${datasetStats.total_legitimate} legit · ${datasetStats.total_rings} ground truth rings` : 'Waiting for dataset',
      icon: '👥',
      color: 'rgba(99, 102, 241, 0.2)',
    },
    {
      title: 'Rings Flagged',
      value: numFlagged ?? '—',
      foot: numFlagged !== null ? `${numFlagged} clusters above threshold` : 'Pipeline standby',
      icon: '🚨',
      color: 'rgba(244, 63, 94, 0.2)',
    },
    {
      title: 'Precision',
      value: metrics ? (metrics.precision * 100).toFixed(1) + '%' : '—',
      foot: metrics ? `TP: ${metrics.tp} · FP: ${metrics.fp}` : 'Evaluated live',
      icon: '🎯',
      color: 'rgba(16, 185, 129, 0.2)',
    },
    {
      title: 'Recall',
      value: metrics ? (metrics.recall * 100).toFixed(1) + '%' : '—',
      foot: metrics ? `Caught: ${metrics.tp}/${metrics.tp + metrics.fn}` : 'Evaluated live',
      icon: '⚡',
      color: 'rgba(245, 158, 11, 0.2)',
    },
    {
      title: 'F1 Score',
      value: metrics ? (metrics.f1 * 100).toFixed(1) + '%' : '—',
      foot: metrics ? `Harmonic mean` : 'Composite metric',
      icon: '🏆',
      color: 'rgba(6, 182, 212, 0.2)',
    },
  ];

  return (
    <div className="stats-grid animate-fade-in">
      {stats.map((s) => (
        <div
          key={s.title}
          className="glass-panel stat-card"
          style={{ '--glow-color': s.color }}
        >
          <div className="stat-header">
            <span className="stat-title">{s.title}</span>
            <span className="stat-icon">{s.icon}</span>
          </div>
          <div className="stat-number">{s.value}</div>
          <div className="stat-foot">{s.foot}</div>
        </div>
      ))}
    </div>
  );
}
