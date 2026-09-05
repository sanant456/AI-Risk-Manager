/**
 * SensitivitySlider — Live threshold sensitivity controller with quick presets
 */
import { useState, useCallback } from 'react';

export default function SensitivitySlider({ threshold, onThresholdChange, disabled }) {
  const [localValue, setLocalValue] = useState(threshold);

  const handleChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setLocalValue(val);
  }, []);

  const handleRelease = useCallback(() => {
    onThresholdChange(localValue);
  }, [localValue, onThresholdChange]);

  const applyPreset = (val) => {
    setLocalValue(val);
    onThresholdChange(val);
  };

  const getLabel = (val) => {
    if (val < 0.25) return '🛡️ Maximum Protection (High Sensitivity)';
    if (val < 0.50) return '⚖️ Balanced Detection (Recommended)';
    if (val < 0.70) return '🎯 High Precision (Conservative)';
    return '🔒 Strict Verification (Low Sensitivity)';
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <span>⚙️</span> Detection Threshold Sensitivity
        </div>
      </div>
      <div className="panel-body">
        <div className="slider-box">
          <div className="slider-value-display">
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Sensitivity</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                {getLabel(localValue)}
              </div>
            </div>
            <div className="threshold-num">{localValue.toFixed(2)}</div>
          </div>

          <input
            type="range"
            min="0.05"
            max="0.90"
            step="0.05"
            value={localValue}
            onChange={handleChange}
            onMouseUp={handleRelease}
            onTouchEnd={handleRelease}
            disabled={disabled}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>0.05 (Aggressive)</span>
            <span>0.40 (Optimal)</span>
            <span>0.90 (Strict)</span>
          </div>

          <div className="preset-pills">
            <button
              className={`preset-btn ${Math.abs(localValue - 0.25) < 0.02 ? 'active' : ''}`}
              onClick={() => applyPreset(0.25)}
            >
              Sensitive (0.25)
            </button>
            <button
              className={`preset-btn ${Math.abs(localValue - 0.40) < 0.02 ? 'active' : ''}`}
              onClick={() => applyPreset(0.40)}
            >
              Default (0.40)
            </button>
            <button
              className={`preset-btn ${Math.abs(localValue - 0.65) < 0.02 ? 'active' : ''}`}
              onClick={() => applyPreset(0.65)}
            >
              Strict (0.65)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
