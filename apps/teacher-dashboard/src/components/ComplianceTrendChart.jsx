import React from 'react';
import { TrendingUp } from 'lucide-react';

/**
 * ComplianceTrendChart Component
 * Renders class average handwashing score trend graph in Playful Geometric styling.
 */
export function ComplianceTrendChart({ data = [] }) {
  const defaultData = [
    { day: 'Mon', avgScore: 72 },
    { day: 'Tue', avgScore: 78 },
    { day: 'Wed', avgScore: 84 },
    { day: 'Thu', avgScore: 81 },
    { day: 'Fri', avgScore: 89 },
    { day: 'Sat', avgScore: 92 },
    { day: 'Sun', avgScore: 95 }
  ];

  const chartData = data.length > 0 ? data : defaultData;
  const width = 600;
  const height = 230;
  const padding = 40;

  const maxScore = 100;
  const minScore = 50;

  // Calculate SVG line path points
  const points = chartData.map((d, index) => {
    const x = padding + (index / (chartData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.avgScore - minScore) / (maxScore - minScore)) * (height - padding * 2);
    return { x, y, score: d.avgScore, day: d.day };
  });

  const pathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      padding: '24px',
      border: '2.5px solid #1E293B',
      boxShadow: '4px 4px 0px 0px #1E293B',
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            Class Compliance Trend
          </h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Weekly Class Average Score
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          background: '#D1FAE5',
          color: '#1E293B',
          padding: '4px 12px',
          borderRadius: '9999px',
          fontWeight: 800,
          border: '1.5px solid #1E293B',
          boxShadow: '2px 2px 0px 0px #1E293B',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <TrendingUp size={14} strokeWidth={2.5} color="#1E293B" />
          <span>+18% Improvement</span>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '460px' }}>
          {/* Background grid lines */}
          {[60, 80, 100].map(val => {
            const y = height - padding - ((val - minScore) / (maxScore - minScore)) * (height - padding * 2);
            return (
              <g key={val}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x={padding - 10} y={y + 4} fill="#94A3B8" fontSize="11" fontWeight="700" textAnchor="end">{val}</text>
              </g>
            );
          })}

          {/* Gradient fill under line */}
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
            fill="url(#scoreGradient)"
          />

          {/* Trend Line */}
          <path d={pathD} fill="none" stroke="#8B5CF6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, idx) => (
            <g key={idx}>
              {/* Outer dark outline */}
              <circle cx={p.x} cy={p.y} r="6.5" fill="#1E293B" />
              {/* Inner colored point */}
              <circle cx={p.x} cy={p.y} r="4.5" fill="#FBBF24" />
              <text x={p.x} y={height - padding + 20} fill="#64748B" fontSize="11" fontWeight="700" textAnchor="middle">{p.day}</text>
              <text x={p.x} y={p.y - 12} fill="#1E293B" fontSize="11" fontWeight="800" textAnchor="middle" fontFamily="Outfit, sans-serif">{p.score}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default ComplianceTrendChart;
