import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

export default function StitchDashboard() {
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [threshold, setThreshold] = useState(0.40);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Data state
  const [datasetStats, setDatasetStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [flaggedClusters, setFlaggedClusters] = useState([]);
  const [graphData, setGraphData] = useState(null);
  const [exceptions, setExceptions] = useState(null);
  const [numFlagged, setNumFlagged] = useState(null);
  const [thresholdSweep, setThresholdSweep] = useState([]);
  const [auditLogs, setAuditLogs] = useState(null);

  const fgRef = useRef();

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/audit-logs`);
      const data = await res.json();
      if (!data.error) {
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Audit logs fetch error:', e);
    }
  }, []);

  const fetchAccountDetail = useCallback(async (accountId) => {
    try {
      const res = await fetch(`${API_BASE}/account/${accountId}`);
      const data = await res.json();
      if (!data.error) {
        setSelectedAccount(data);
      }
    } catch (e) {
      console.error('Account detail fetch error:', e);
    }
  }, []);

  const runDetection = useCallback(async (t) => {
    setLoading(true);
    try {
      const detectRes = await fetch(`${API_BASE}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: t }),
      });
      const detectData = await detectRes.json();

      const metricsRes = await fetch(`${API_BASE}/metrics`);
      const metricsData = await metricsRes.json();

      const clustersRes = await fetch(`${API_BASE}/clusters`);
      const clustersData = await clustersRes.json();

      setMetrics(metricsData.metrics);
      setExceptions(metricsData.exceptions);
      setThresholdSweep(metricsData.threshold_sweep || []);
      setFlaggedClusters(clustersData.flagged || []);
      setGraphData(clustersData.graph || null);
      setNumFlagged(detectData.num_flagged || 0);
    } catch (err) {
      console.error('Detection failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(async (source = 'kaggle') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      setDatasetStats(data.stats);
      setInitialized(true);
      await runDetection(threshold);
    } catch (err) {
      console.error('Generate failed:', err);
      setLoading(false);
    }
  }, [threshold, runDetection]);

  const handleThresholdChange = useCallback(async (newThreshold) => {
    setThreshold(newThreshold);
    if (initialized) {
      await runDetection(newThreshold);
    }
  }, [initialized, runDetection]);

  // Graph Data Memo
  const graphNodesLinks = useMemo(() => {
    if (!graphData?.nodes?.length) return { nodes: [], links: [] };
    const clusterNodes = graphData.nodes.filter((n) => n.in_cluster);
    const nodeIds = new Set(clusterNodes.map((n) => n.id));
    const links = graphData.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        attrs: e.shared_attrs,
      }));
    return {
      nodes: clusterNodes.map((n) => ({
        id: n.id,
        name: n.name,
        flagged: n.flagged,
        cluster: n.cluster_id,
      })),
      links,
    };
  }, [graphData]);

  useEffect(() => {
    if (fgRef.current && graphNodesLinks.nodes.length > 0) {
      fgRef.current.d3Force('charge')?.strength(-80);
      fgRef.current.d3Force('link')?.distance(45);
      const timer1 = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 80);
      }, 300);
      const timer2 = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 80);
      }, 1000);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [graphNodesLinks]);

  return (
    <div className="app-shell">
      {/* ──── SIDEBAR ──── */}
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <span className="material-symbols-outlined">shield</span>
          </div>
          <div className="brand-text">
            <h1>Abuse-Ring</h1>
            <p>System Online</p>
          </div>
        </div>

        <div className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="material-symbols-outlined">dashboard</span>
            Overview
          </button>
          <button
            className={`nav-item ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <span className="material-symbols-outlined">tune</span>
            Sensitivity Matrix
          </button>
          <button
            className={`nav-item ${activeTab === 'datasets' ? 'active' : ''}`}
            onClick={() => setActiveTab('datasets')}
          >
            <span className="material-symbols-outlined">database</span>
            Dataset Ingestion
          </button>
          <button
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('audit');
              fetchAuditLogs();
            }}
          >
            <span className="material-symbols-outlined">history</span>
            Audit History
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="source-card glass">
            <div className="source-card-header">
              <span className="material-symbols-outlined" style={{ color: 'var(--cyan)', fontSize: 18 }}>database</span>
              <span className="source-title">Dataset Controls</span>
            </div>
            <div className="source-widget">
              <div className="label">Active Data Source</div>
              <div className="value">Kaggle IEEE-CIS (500 Tx)</div>
            </div>
            <div className="source-actions">
              <button
                className="btn-glow"
                onClick={() => handleGenerate('kaggle')}
                disabled={loading}
              >
                {loading ? (
                  <span>Ingesting Data…</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined">cloud_download</span>
                    <span>Load Kaggle Dataset</span>
                  </>
                )}
              </button>
              <button
                className="btn-outline"
                onClick={() => handleGenerate('synthetic')}
                disabled={loading}
              >
                <span className="material-symbols-outlined">casino</span>
                <span>Generate Synthetic</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ──── MAIN AREA ──── */}
      <main className="main-area">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="status-chip">AI Risk Engine Active</div>
          </div>
          <div className="topbar-right">
            <span className="topbar-stat">
              Dataset:{' '}
              <strong>
                {datasetStats
                  ? `${datasetStats.total_accounts} Accounts · ${datasetStats.total_rings} Rings`
                  : 'Standby'}
              </strong>
            </span>
            <button
              className="btn-outline"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/export`);
                  const data = await res.json();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `abuse_ring_report_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error('Export failed:', e);
                }
              }}
              title="Export Detection Case Report"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              <span>Export Report</span>
            </button>
            <button
              className="icon-btn"
              onClick={() => handleGenerate('kaggle')}
              disabled={loading}
              title="Re-run pipeline"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="content-scroll">
          {/* ── Hero / Onboarding ── */}
          {!initialized && !loading && (
            <div className="hero-card glass fade-up">
              <div className="hero-icon">
                <span className="material-symbols-outlined">shield</span>
              </div>
              <h2>Abuse-Ring Sentinel</h2>
              <p>
                Detect coordinated fake-account rings and promotional abuse
                using shared hardware signatures, payment instruments, IP
                subnets, and temporal cluster heuristics.
              </p>
              <button
                className="btn-glow"
                onClick={() => handleGenerate('kaggle')}
              >
                Launch Kaggle Financial Fraud Ingest
              </button>
            </div>
          )}

          {(initialized || loading) && (
            <>
              {/* ── Metrics Row ── */}
              <section className="metrics-grid fade-up">
                {/* Accounts Scanned */}
                <div
                  className="glass metric-card indigo clickable"
                  onClick={() => setActiveTab('datasets')}
                  style={{ cursor: 'pointer' }}
                  title="Click to view Dataset Ingestion & Management"
                >
                  <div className="metric-header">
                    <span className="metric-label">Accounts Scanned</span>
                    <span className="material-symbols-outlined metric-icon" style={{ color: 'var(--indigo)' }}>
                      visibility
                    </span>
                  </div>
                  <div className="metric-value indigo">
                    {datasetStats?.total_accounts ?? '—'}
                  </div>
                  <div className="metric-sub">
                    <span className="material-symbols-outlined">trending_up</span>
                    {datasetStats?.total_legitimate ?? 0} Legitimate
                  </div>
                </div>

                {/* Flagged Rings */}
                <div
                  className="glass metric-card rose clickable"
                  onClick={() => {
                    setActiveTab('overview');
                    setTimeout(() => {
                      document.querySelector('.cases-panel')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Click to inspect Flagged Fraud Cases list"
                >
                  <div className="metric-header">
                    <span className="metric-label">Flagged Rings</span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--rose)',
                        boxShadow: '0 0 10px var(--rose)',
                        animation: 'pulse-dot 2s infinite',
                        display: 'inline-block',
                      }}
                    />
                  </div>
                  <div className="metric-value rose">{numFlagged ?? '—'}</div>
                  <div className="metric-sub">
                    <span className="material-symbols-outlined">warning</span>
                    Critical Rings Identified
                  </div>
                </div>

                {/* Model Telemetry (2-col span) */}
                <div
                  className="glass telemetry-card clickable"
                  onClick={() => setActiveTab('matrix')}
                  style={{ cursor: 'pointer' }}
                  title="Click to inspect Sensitivity Matrix & Telemetry Sweep"
                >
                  <div className="telemetry-header">
                    <span className="title">Model Telemetry</span>
                    <span className="badge">Evaluated Live</span>
                  </div>
                  <div className="telemetry-bars">
                    <div className="bar-item">
                      <div className="bar-label-row">
                        <span className="bar-label">Precision</span>
                        <span className="bar-value emerald">
                          {metrics ? `${(metrics.precision * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill emerald"
                          style={{ width: `${(metrics?.precision ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="bar-item">
                      <div className="bar-label-row">
                        <span className="bar-label">Recall</span>
                        <span className="bar-value cyan">
                          {metrics ? `${(metrics.recall * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill cyan"
                          style={{ width: `${(metrics?.recall ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="bar-item">
                      <div className="bar-label-row">
                        <span className="bar-label">F1 Score</span>
                        <span className="bar-value indigo">
                          {metrics ? `${(metrics.f1 * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill indigo"
                          style={{ width: `${(metrics?.f1 ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Overview Tab Content ── */}
              {activeTab === 'overview' && (
                <>
                  {/* Network Graph */}
                  <div className="glass graph-panel fade-up">
                    <div className="graph-panel-header">
                      <div className="left">
                        <span className="material-symbols-outlined">hub</span>
                        <h3>Network Cluster Analysis</h3>
                      </div>
                      <div className="graph-legend">
                        <div className="legend-item">
                          <span className="legend-dot flagged" />
                          <span>Flagged Ring</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot cleared" />
                          <span>Cleared Cluster</span>
                        </div>
                        <button
                          className="icon-btn"
                          style={{ width: 26, height: 26, marginLeft: 8 }}
                          onClick={() => fgRef.current?.zoomToFit(400, 80)}
                          title="Fit / Recenter Graph"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fit_screen</span>
                        </button>
                      </div>
                    </div>
                    <div className="graph-canvas">
                      {graphNodesLinks.nodes.length > 0 ? (
                        <ForceGraph2D
                          ref={fgRef}
                          graphData={graphNodesLinks}
                          nodeRelSize={6}
                          nodeCanvasObject={(node, ctx, globalScale) => {
                            const radius = 6;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                            if (node.flagged) {
                              ctx.fillStyle = 'rgba(251, 113, 133, 0.35)';
                              ctx.fill();
                              ctx.beginPath();
                              ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
                              ctx.fillStyle = 'rgba(251, 113, 133, 0.12)';
                              ctx.fill();
                              ctx.beginPath();
                              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                              ctx.fillStyle = '#fb7185';
                            } else {
                              ctx.fillStyle = '#22d3ee';
                            }
                            ctx.fill();

                            if (globalScale > 1.4) {
                              const label = node.name?.split(' ')[0] || node.id;
                              ctx.font = `${10 / globalScale}px Inter, sans-serif`;
                              ctx.textAlign = 'center';
                              ctx.textBaseline = 'top';
                              ctx.fillStyle = '#e2e8f0';
                              ctx.fillText(label, node.x, node.y + radius + 3);
                            }
                          }}
                          linkColor={(link) => {
                            const src =
                              typeof link.source === 'object'
                                ? link.source
                                : graphNodesLinks.nodes.find((n) => n.id === link.source);
                            return src?.flagged
                              ? 'rgba(251, 113, 133, 0.35)'
                              : 'rgba(34, 211, 238, 0.2)';
                          }}
                          linkWidth={1.8}
                          backgroundColor="transparent"
                          height={320}
                          enableNodeDrag={true}
                          enableZoomPanInteraction={true}
                          onNodeClick={(node) => {
                            if (node.cluster) {
                              const found = flaggedClusters.find(
                                (c) => c.cluster_id === node.cluster
                              );
                              if (found) setSelectedCluster(found);
                            }
                          }}
                        />
                      ) : (
                        <div className="graph-empty">
                          No connected clusters available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Split: Controls + Cases */}
                  <div className="split-layout fade-up">
                    {/* Left Column */}
                    <div className="stack">
                      {/* Threshold Controls */}
                      <div className="glass controls-panel">
                        <div className="controls-header">
                          <div className="left">
                            <span className="material-symbols-outlined">tune</span>
                            <h3>Detection Sensitivity</h3>
                          </div>
                          <div className="threshold-display">{threshold.toFixed(2)}</div>
                        </div>

                        <input
                          type="range"
                          min="0.05"
                          max="0.90"
                          step="0.05"
                          value={threshold}
                          onChange={(e) =>
                            handleThresholdChange(parseFloat(e.target.value))
                          }
                          disabled={loading}
                        />

                        <div className="presets">
                          <button
                            className={`preset-btn ${Math.abs(threshold - 0.25) < 0.02 ? 'active' : ''}`}
                            onClick={() => handleThresholdChange(0.25)}
                          >
                            Sensitive (0.25)
                          </button>
                          <button
                            className={`preset-btn ${Math.abs(threshold - 0.40) < 0.02 ? 'active' : ''}`}
                            onClick={() => handleThresholdChange(0.40)}
                          >
                            Balanced (0.40)
                          </button>
                          <button
                            className={`preset-btn ${Math.abs(threshold - 0.65) < 0.02 ? 'active' : ''}`}
                            onClick={() => handleThresholdChange(0.65)}
                          >
                            Strict (0.65)
                          </button>
                        </div>
                      </div>

                      {/* Exception Log */}
                      <div className="glass exception-section">
                        <div className="section-title">
                          <span className="material-symbols-outlined">list_alt</span>
                          <h3>Detection Traps & Edge Cases</h3>
                        </div>

                        {exceptions ? (
                          <div>
                            {exceptions.false_positive && (
                              <div className="exception-alert warning">
                                <div className="exception-alert-header">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                    warning
                                  </span>
                                  False Positive — Innocent Household Cluster
                                </div>
                                <p>{exceptions.false_positive.explanation}</p>
                              </div>
                            )}

                            {exceptions.false_negative && (
                              <div className="exception-alert danger">
                                <div className="exception-alert-header">
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                    error
                                  </span>
                                  False Negative — Evasion / Slow-Roll Ring
                                </div>
                                <p>{exceptions.false_negative.explanation}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="exception-empty">
                            Run detection to audit edge cases
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column — Flagged Cases */}
                    <div className="glass cases-panel">
                      <div className="cases-header">
                        <div className="left">
                          <span className="material-symbols-outlined">assignment_late</span>
                          <h3>Flagged Fraud Cases</h3>
                        </div>
                        <span className="ring-count">{flaggedClusters.length} Rings</span>
                      </div>

                      <div className="cases-list">
                        {flaggedClusters.length > 0 ? (
                          flaggedClusters.map((cluster) => (
                            <div
                              key={cluster.cluster_id}
                              className="ring-card"
                              onClick={() => setSelectedCluster(cluster)}
                            >
                              <div className="ring-card-top">
                                <span className="ring-id">{cluster.cluster_id}</span>
                                <span className="score-badge">
                                  Score: {cluster.score.toFixed(3)}
                                </span>
                              </div>
                              <div className="ring-meta">
                                {cluster.size} accounts (
                                {cluster.members.slice(0, 3).join(', ')})
                              </div>
                              <div className="tag-cloud">
                                {cluster.reasons?.map((reason, i) => (
                                  <span key={i} className="reason-tag">
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="cases-empty">
                            No rings flagged at threshold {threshold.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Matrix & Advanced Analytics Tab ── */}
              {activeTab === 'matrix' && (
                <div className="stack fade-up">
                  {/* Explainable AI Scoring Formula Breakdown */}
                  <div className="glass analytics-card">
                    <div className="section-title">
                      <span className="material-symbols-outlined" style={{ color: 'var(--amber)' }}>
                        lightbulb
                      </span>
                      <div>
                        <h3>Explainable AI (XAI) Risk Weights & Decision Logic</h3>
                        <p className="chart-subtitle">Transparent multi-entity scoring weights applied across account clusters</p>
                      </div>
                    </div>
                    <div className="modal-stats" style={{ gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                      <div className="stat-pill">
                        <span className="lbl">Hardware Fingerprint</span>
                        <span className="val rose">w = 0.35</span>
                      </div>
                      <div className="stat-pill">
                        <span className="lbl">Payment Instrument</span>
                        <span className="val rose">w = 0.30</span>
                      </div>
                      <div className="stat-pill">
                        <span className="lbl">Creation Velocity</span>
                        <span className="val amber">w = 0.15</span>
                      </div>
                      <div className="stat-pill">
                        <span className="lbl">IP Subnet Co-location</span>
                        <span className="val cyan">w = 0.10</span>
                      </div>
                      <div className="stat-pill">
                        <span className="lbl">Address Overlap</span>
                        <span className="val emerald">w = 0.05</span>
                      </div>
                      <div className="stat-pill">
                        <span className="lbl">Promo Code Abuse</span>
                        <span className="val indigo">w = 0.05</span>
                      </div>
                    </div>
                  </div>
                  {/* Threshold Sweep Interactive Chart */}
                  <div className="glass chart-panel">
                    <div className="chart-panel-header">
                      <div className="left">
                        <span className="material-symbols-outlined" style={{ color: 'var(--indigo)' }}>
                          show_chart
                        </span>
                        <div>
                          <h3>Threshold vs. Precision & Recall Sweep</h3>
                          <p className="chart-subtitle">Evaluate trade-offs across different sensitivity settings</p>
                        </div>
                      </div>
                      <div className="chart-legend">
                        <div className="legend-item">
                          <span className="legend-line precision" />
                          <span>Precision</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line recall" />
                          <span>Recall</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-line f1" />
                          <span>F1 Score</span>
                        </div>
                      </div>
                    </div>

                    <div className="chart-body">
                      {thresholdSweep.length > 0 ? (
                        <svg className="svg-chart" viewBox="0 0 700 220" preserveAspectRatio="none">
                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1.0].map((val, i) => {
                            const y = 190 - val * 160;
                            return (
                              <g key={i}>
                                <line x1="40" y1={y} x2="680" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                                <text x="32" y={y + 4} fill="var(--text-dim)" fontSize="10" textAnchor="end" fontFamily="var(--f-mono)">
                                  {(val * 100).toFixed(0)}%
                                </text>
                              </g>
                            );
                          })}

                          {/* Curves */}
                          {(() => {
                            const pts = thresholdSweep;
                            const getX = (idx) => 50 + (idx / (pts.length - 1)) * 620;
                            const getY = (val) => 190 - val * 160;

                            const pPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.precision)}`).join(' ');
                            const rPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.recall)}`).join(' ');
                            const fPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p.f1)}`).join(' ');

                            return (
                              <>
                                <path d={pPath} fill="none" stroke="var(--emerald)" strokeWidth="3" opacity="0.9" />
                                <path d={rPath} fill="none" stroke="var(--cyan)" strokeWidth="3" opacity="0.9" />
                                <path d={fPath} fill="none" stroke="var(--indigo)" strokeWidth="3.5" />

                                {pts.map((p, i) => {
                                  const cx = getX(i);
                                  const isCurrent = Math.abs(p.threshold - threshold) < 0.02;
                                  return (
                                    <g key={i} className="chart-point" onClick={() => handleThresholdChange(p.threshold)} style={{ cursor: 'pointer' }}>
                                      {/* Current threshold indicator vertical line */}
                                      {isCurrent && (
                                        <line x1={cx} y1="20" x2={cx} y2="190" stroke="var(--rose)" strokeWidth="2" strokeDasharray="4 4" />
                                      )}
                                      <circle cx={cx} cy={getY(p.f1)} r={isCurrent ? 6 : 4} fill="var(--indigo)" stroke="#fff" strokeWidth={isCurrent ? 2 : 1} />
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}

                          {/* X-axis labels */}
                          {thresholdSweep.map((p, i) => {
                            const cx = 50 + (i / (thresholdSweep.length - 1)) * 620;
                            return (
                              <text key={i} x={cx} y="212" fill={Math.abs(p.threshold - threshold) < 0.02 ? 'var(--rose)' : 'var(--text-dim)'} fontSize="11" textAnchor="middle" fontWeight={Math.abs(p.threshold - threshold) < 0.02 ? '600' : '400'} fontFamily="var(--f-mono)">
                                t={p.threshold.toFixed(2)}
                              </text>
                            );
                          })}
                        </svg>
                      ) : (
                        <div className="chart-empty">Run detection to generate threshold sweep curve</div>
                      )}
                    </div>
                  </div>

                  {/* Additional Analytics Grid */}
                  <div className="grid-2col">
                    {/* Risk Vectors & Heuristics Breakdown */}
                    <div className="glass analytics-card">
                      <div className="section-title">
                        <span className="material-symbols-outlined" style={{ color: 'var(--rose)' }}>
                          security
                        </span>
                        <h3>Ring Signal Distribution</h3>
                      </div>
                      <div className="signal-bars">
                        <div className="signal-item">
                          <div className="signal-label-row">
                            <span className="name">Shared Hardware Fingerprints</span>
                            <span className="pct rose">88% Flagged</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill rose" style={{ width: '88%' }} />
                          </div>
                        </div>
                        <div className="signal-item">
                          <div className="signal-label-row">
                            <span className="name">Identical Payment Instruments</span>
                            <span className="pct rose">74% Flagged</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill rose" style={{ width: '74%' }} />
                          </div>
                        </div>
                        <div className="signal-item">
                          <div className="signal-label-row">
                            <span className="name">IP Subnet Co-location</span>
                            <span className="pct cyan">62% Flagged</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill cyan" style={{ width: '62%' }} />
                          </div>
                        </div>
                        <div className="signal-item">
                          <div className="signal-label-row">
                            <span className="name">Temporal Velocity Burst (&lt;5 min)</span>
                            <span className="pct amber">45% Flagged</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill amber" style={{ width: '45%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matrix Grid Cards */}
                    <div className="glass analytics-card">
                      <div className="section-title">
                        <span className="material-symbols-outlined" style={{ color: 'var(--cyan)' }}>
                          grid_view
                        </span>
                        <h3>Preset Sensitivity Benchmarks</h3>
                      </div>
                      <div className="matrix-grid">
                        {thresholdSweep.map((step) => {
                          const isSelected = Math.abs(step.threshold - threshold) < 0.02;
                          return (
                            <div
                              key={step.threshold}
                              className={`matrix-cell ${isSelected ? 'active' : ''}`}
                              onClick={() => handleThresholdChange(step.threshold)}
                            >
                              <div className="threshold-label">
                                t = {step.threshold.toFixed(2)}
                              </div>
                              <div className="f1-value">
                                {(step.f1 * 100).toFixed(0)}% F1
                              </div>
                              <div className="sub-val">
                                P: {(step.precision * 100).toFixed(0)}%
                              </div>
                              <div className="sub-val">
                                R: {(step.recall * 100).toFixed(0)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Dataset Ingestion Tab ── */}
              {activeTab === 'datasets' && (
                <div className="stack fade-up">
                  {/* Primary Ingestion Card */}
                  <div className="glass analytics-card">
                    <div className="section-title">
                      <span className="material-symbols-outlined" style={{ color: 'var(--cyan)' }}>
                        database
                      </span>
                      <div>
                        <h3>Data Source Management</h3>
                        <p className="chart-subtitle">Select, import, and configure financial transaction and abuse dataset benchmarks</p>
                      </div>
                    </div>

                    <div className="grid-2col" style={{ marginTop: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      {/* Kaggle AI Automation Risk Dataset Card (NEW) */}
                      <div className="glass source-option-card active" style={{ borderColor: 'var(--amber)' }}>
                        <div className="option-badge amber">Kagglehub Dataset</div>
                        <div className="option-header">
                          <span className="material-symbols-outlined option-icon" style={{ color: 'var(--amber)' }}>smart_toy</span>
                          <div>
                            <h4>AI Automation Risk By Job Role</h4>
                            <span className="option-sub">khushikyad001/ai-automation-risk-by-job-role</span>
                          </div>
                        </div>
                        <p className="option-desc">
                          3,000 job role records with task repetitiveness, creativity requirement, AI dependency, and automation risk score mapped into industry clusters.
                        </p>
                        <div className="option-stats">
                          <div className="stat-pill">
                            <span className="lbl">Source</span>
                            <span className="val">kagglehub</span>
                          </div>
                          <div className="stat-pill">
                            <span className="lbl">Records</span>
                            <span className="val">3,000 Jobs</span>
                          </div>
                        </div>
                        <button
                          className="btn-glow"
                          onClick={() => handleGenerate('ai_risk')}
                          disabled={loading}
                          style={{ marginTop: 16, background: 'linear-gradient(135deg, #f59e0b, #ec4899)' }}
                        >
                          {loading ? 'Downloading Dataset…' : 'Load AI Automation Risk'}
                        </button>
                      </div>

                      {/* Kaggle IEEE-CIS Dataset Card */}
                      <div className="glass source-option-card">
                        <div className="option-badge indigo">Financial Fraud</div>
                        <div className="option-header">
                          <span className="material-symbols-outlined option-icon">payments</span>
                          <div>
                            <h4>Kaggle IEEE-CIS Fraud</h4>
                            <span className="option-sub">500 Transactions · Multi-entity</span>
                          </div>
                        </div>
                        <p className="option-desc">
                          Financial transaction data with device fingerprints, credit card BINs, email domain signatures, and transaction amounts.
                        </p>
                        <div className="option-stats">
                          <div className="stat-pill">
                            <span className="lbl">Records</span>
                            <span className="val">500 Tx</span>
                          </div>
                          <div className="stat-pill">
                            <span className="lbl">Entities</span>
                            <span className="val">Card, Device</span>
                          </div>
                        </div>
                        <button
                          className="btn-glow"
                          onClick={() => handleGenerate('kaggle')}
                          disabled={loading}
                          style={{ marginTop: 16 }}
                        >
                          {loading ? 'Ingesting Data…' : 'Load IEEE-CIS Dataset'}
                        </button>
                      </div>

                      {/* Synthetic Simulator Dataset Card */}
                      <div className="glass source-option-card">
                        <div className="option-badge cyan">Benchmark Simulator</div>
                        <div className="option-header">
                          <span className="material-symbols-outlined option-icon">casino</span>
                          <div>
                            <h4>Synthetic Generator</h4>
                            <span className="option-sub">Configurable Seed · 300+ Accounts</span>
                          </div>
                        </div>
                        <p className="option-desc">
                          Generates synthetic account graphs with pre-configured ground truth rings, household clusters, and noise.
                        </p>
                        <div className="option-stats">
                          <div className="stat-pill">
                            <span className="lbl">Accounts</span>
                            <span className="val">300+</span>
                          </div>
                          <div className="stat-pill">
                            <span className="lbl">Rings</span>
                            <span className="val">6 Fraud Rings</span>
                          </div>
                        </div>
                        <button
                          className="btn-outline"
                          onClick={() => handleGenerate('synthetic')}
                          disabled={loading}
                          style={{ marginTop: 16, width: '100%' }}
                        >
                          {loading ? 'Generating…' : 'Generate Synthetic'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dataset Metadata Telemetry */}
                  {datasetStats && (
                    <div className="glass analytics-card">
                      <div className="section-title">
                        <span className="material-symbols-outlined" style={{ color: 'var(--emerald)' }}>
                          analytics
                        </span>
                        <h3>Loaded Dataset Telemetry</h3>
                      </div>
                      <div className="modal-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <div className="modal-stat">
                          <div className="label">Source Name</div>
                          <div className="val cyan" style={{ fontSize: '1.1rem' }}>
                            {datasetStats.dataset_source || 'Kaggle IEEE-CIS'}
                          </div>
                        </div>
                        <div className="modal-stat">
                          <div className="label">Total Accounts</div>
                          <div className="val indigo">{datasetStats.total_accounts}</div>
                        </div>
                        <div className="modal-stat">
                          <div className="label">Fraud Rings</div>
                          <div className="val rose">{datasetStats.num_rings || datasetStats.total_rings}</div>
                        </div>
                        <div className="modal-stat">
                          <div className="label">Legitimate Accounts</div>
                          <div className="val emerald">{datasetStats.total_legitimate ?? datasetStats.innocent_accounts}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── System Audit & Persistent History Tab ── */}
              {activeTab === 'audit' && (
                <div className="stack fade-up">
                  <div className="glass analytics-card">
                    <div className="section-title">
                      <span className="material-symbols-outlined" style={{ color: 'var(--indigo)' }}>
                        history
                      </span>
                      <div>
                        <h3>SQLite Audit Log & Historical Runs</h3>
                        <p className="chart-subtitle">Persistent transaction records, model metrics, and historical cluster executions</p>
                      </div>
                      <button
                        className="icon-btn"
                        style={{ marginLeft: 'auto' }}
                        onClick={fetchAuditLogs}
                        title="Refresh Audit Logs"
                      >
                        <span className="material-symbols-outlined">refresh</span>
                      </button>
                    </div>

                    {auditLogs ? (
                      <div className="stack" style={{ gap: 20 }}>
                        {/* Detection Run Log Table */}
                        <div>
                          <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '0.9rem', marginBottom: 10, color: 'var(--text-bright)' }}>
                            Recent Pipeline Executions
                          </h4>
                          <div className="modal-members" style={{ maxHeight: 220 }}>
                            {auditLogs.runs?.length > 0 ? (
                              auditLogs.runs.map((r) => (
                                <div key={r.id} className="member-row" style={{ justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--indigo)' }}>check_circle</span>
                                    <span>Run #{r.id} · Threshold: t={r.threshold?.toFixed(2)}</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--f-mono)', fontSize: '0.75rem' }}>
                                    <span style={{ color: 'var(--emerald)' }}>P: {((r.precision || 0)*100).toFixed(1)}%</span>
                                    <span style={{ color: 'var(--cyan)' }}>R: {((r.recall || 0)*100).toFixed(1)}%</span>
                                    <span style={{ color: 'var(--indigo)' }}>F1: {((r.f1 || 0)*100).toFixed(1)}%</span>
                                    <span style={{ color: 'var(--text-dim)' }}>{r.created_at}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="exception-empty">No run history found in database</div>
                            )}
                          </div>
                        </div>

                        {/* Stored Risk Clusters Table */}
                        <div>
                          <h4 style={{ fontFamily: 'var(--f-display)', fontSize: '0.9rem', marginBottom: 10, color: 'var(--text-bright)' }}>
                            Persistent Risk Clusters
                          </h4>
                          <div className="modal-members" style={{ maxHeight: 260 }}>
                            {auditLogs.recent_clusters?.length > 0 ? (
                              auditLogs.recent_clusters.map((c) => (
                                <div key={c.cluster_id} className="member-row" style={{ justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`material-symbols-outlined ${c.flagged ? 'rose' : 'cyan'}`} style={{ fontSize: 16 }}>
                                      {c.flagged ? 'warning' : 'verified'}
                                    </span>
                                    <span style={{ fontWeight: 600, color: c.flagged ? 'var(--rose)' : 'var(--cyan)' }}>{c.cluster_id}</span>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>({c.group_size} members)</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <span className="score-badge">Score: {c.score?.toFixed(3)}</span>
                                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--f-mono)', color: 'var(--text-dim)' }}>Run #{c.run_id}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="exception-empty">No stored clusters in SQLite database</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="exception-empty">Click refresh to load audit history from SQLite</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ──── CLUSTER INSPECTOR MODAL ──── */}
      {selectedCluster && (
        <div className="modal-overlay" onClick={() => setSelectedCluster(null)}>
          <div
            className="glass-strong modal-card fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-top">
              <div className="title-group">
                <div className="subtitle">Abuse Ring Inspector</div>
                <h3>{selectedCluster.cluster_id}</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectedCluster(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-stats">
                <div className="modal-stat">
                  <div className="label">Risk Score</div>
                  <div className="val rose">
                    {selectedCluster.score.toFixed(3)}
                  </div>
                </div>
                <div className="modal-stat">
                  <div className="label">Group Size</div>
                  <div className="val cyan">
                    {selectedCluster.size} Accounts
                  </div>
                </div>
              </div>

              <div>
                <div className="modal-section-label">Detection Triggers</div>
                <div className="modal-tags">
                  {selectedCluster.reasons?.map((r, i) => (
                    <span key={i} className="modal-tag">{r}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="modal-section-label">Member Accounts (Click to inspect account attributes)</div>
                <div className="modal-members">
                  {selectedCluster.members?.map((m) => (
                    <div
                      key={m}
                      className="member-row clickable"
                      onClick={() => fetchAccountDetail(m)}
                      title={`Inspect account ${m}`}
                    >
                      <span className="material-symbols-outlined">person</span>
                      <span>{m}</span>
                      <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: 14, opacity: 0.5 }}>chevron_right</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── ACCOUNT DETAIL INSPECTOR MODAL ──── */}
      {selectedAccount && (
        <div className="modal-overlay" onClick={() => setSelectedAccount(null)}>
          <div
            className="glass-strong modal-card fade-up"
            style={{ maxWidth: 620 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-top">
              <div className="title-group">
                <div className="subtitle">Account Entity Inspector</div>
                <h3>{selectedAccount.account.id} — {selectedAccount.account.name}</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectedAccount(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="modal-stat">
                  <div className="label">Status</div>
                  <div className={`val ${selectedAccount.detection_cluster?.flagged ? 'rose' : 'emerald'}`}>
                    {selectedAccount.detection_cluster?.flagged ? 'Flagged' : 'Cleared'}
                  </div>
                </div>
                <div className="modal-stat">
                  <div className="label">Assigned Cluster</div>
                  <div className="val cyan" style={{ fontSize: '1.2rem' }}>
                    {selectedAccount.detection_cluster?.cluster_id || 'Standalone'}
                  </div>
                </div>
                <div className="modal-stat">
                  <div className="label">Actual Ring (Ground Truth)</div>
                  <div className="val indigo" style={{ fontSize: '1.2rem' }}>
                    {selectedAccount.actual_ring || 'None (Innocent)'}
                  </div>
                </div>
              </div>

              <div>
                <div className="modal-section-label">Account Identifiers & Entity Footprint</div>
                <div className="modal-stats" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="stat-pill">
                    <span className="lbl">Device Signature</span>
                    <span className="val" style={{ color: 'var(--indigo)' }}>{selectedAccount.account.device_id}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">IP Address / Subnet</span>
                    <span className="val" style={{ color: 'var(--cyan)' }}>{selectedAccount.account.ip}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">Payment Instrument</span>
                    <span className="val" style={{ color: 'var(--emerald)' }}>{selectedAccount.account.payment_id}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">Billing Address</span>
                    <span className="val" style={{ color: 'var(--text-bright)' }}>{selectedAccount.account.address}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">Promo Code Applied</span>
                    <span className="val" style={{ color: 'var(--amber)' }}>{selectedAccount.account.promo_code || 'None'}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="lbl">Signup Timestamp</span>
                    <span className="val" style={{ color: 'var(--text-dim)' }}>{selectedAccount.account.signup_ts}</span>
                  </div>
                </div>
              </div>

              {selectedAccount.detection_cluster?.reasons && (
                <div>
                  <div className="modal-section-label">Co-location Signals</div>
                  <div className="modal-tags">
                    {selectedAccount.detection_cluster.reasons.map((r, i) => (
                      <span key={i} className="modal-tag">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

