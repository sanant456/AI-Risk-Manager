/**
 * GraphView — Force-directed graph of linked accounts
 * Flagged rings in glowing red, cleared clusters in cyan/blue.
 */
import { useRef, useEffect, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const COLORS = {
  flaggedNode: '#f43f5e',
  flaggedGlow: 'rgba(244, 63, 94, 0.4)',
  flaggedEdge: 'rgba(244, 63, 94, 0.45)',
  clearedNode: '#06b6d4',
  clearedGlow: 'rgba(6, 182, 212, 0.3)',
  clearedEdge: 'rgba(6, 182, 212, 0.25)',
};

export default function GraphView({ graphData, onSelectNode }) {
  const fgRef = useRef();

  const data = useMemo(() => {
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
    const fg = fgRef.current;
    if (fg && data.nodes.length > 0) {
      fg.d3Force('charge').strength(-140);
      fg.d3Force('link').distance(60);
      setTimeout(() => fg.zoomToFit(400, 50), 400);
    }
  }, [data]);

  const handleZoomFit = () => {
    fgRef.current?.zoomToFit(400, 50);
  };

  if (!data.nodes.length) {
    return (
      <div className="glass-panel full-width-col">
        <div className="panel-header">
          <div className="panel-title">
            <span>🔗</span> Account Network Topology
          </div>
        </div>
        <div className="panel-body">
          <div className="graph-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🕸️</div>
              <div>Click <strong>"Generate & Detect"</strong> to run detection and render account network</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel full-width-col">
      <div className="panel-header">
        <div className="panel-title">
          <span>🔗</span> Account Network Topology
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="pill-tag">{data.nodes.length} Nodes · {data.links.length} Links</span>
        </div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        <div className="graph-wrapper">
          <div className="graph-controls">
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={handleZoomFit}>
              🎯 Recenter
            </button>
          </div>
          <ForceGraph2D
            ref={fgRef}
            graphData={data}
            nodeRelSize={6}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const radius = 6;
              ctx.beginPath();
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);

              // Glow ring for flagged nodes
              if (node.flagged) {
                ctx.fillStyle = COLORS.flaggedGlow;
                ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
                ctx.fillStyle = COLORS.flaggedNode;
              } else {
                ctx.fillStyle = COLORS.clearedNode;
              }
              ctx.fill();

              // Render text labels on zoom
              if (globalScale > 1.4) {
                const label = node.name?.split(' ')[0] || node.id;
                const fontSize = 10 / globalScale;
                ctx.font = `${fontSize}px Outfit, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(label, node.x, node.y + radius + 3);
              }
            }}
            linkColor={(link) => {
              const src = typeof link.source === 'object' ? link.source : data.nodes.find((n) => n.id === link.source);
              return src?.flagged ? COLORS.flaggedEdge : COLORS.clearedEdge;
            }}
            linkWidth={1.8}
            backgroundColor="transparent"
            height={480}
            enableNodeDrag={true}
            enableZoomPanInteraction={true}
            onNodeClick={(node) => onSelectNode && onSelectNode(node)}
          />
          <div className="graph-legend-bar">
            <div className="legend-badge">
              <div className="legend-color" style={{ background: COLORS.flaggedNode, boxShadow: '0 0 8px #f43f5e' }}></div>
              Flagged Ring Node
            </div>
            <div className="legend-badge">
              <div className="legend-color" style={{ background: COLORS.clearedNode, boxShadow: '0 0 8px #06b6d4' }}></div>
              Cleared Node
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
