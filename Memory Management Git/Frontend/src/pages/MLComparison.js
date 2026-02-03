import React, { useState, useEffect, useRef } from 'react';
import { FiCpu, FiPlay, FiTrash2, FiDatabase, FiZap, FiRefreshCw } from 'react-icons/fi';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { algorithmAPI, pythonMLAPI } from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const MLComparison = () => {
  const [sequence, setSequence] = useState([]);
  const [frameCount, setFrameCount] = useState(4);
  const [results, setResults] = useState(null);
  const resultsRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [workloadType, setWorkloadType] = useState('locality');
  const [workloadLength, setWorkloadLength] = useState(50);
  const [uniquePages, setUniquePages] = useState(8);
  const [localityFactor, setLocalityFactor] = useState(0.7);
  const [pythonMLStats, setPythonMLStats] = useState(null);
  const [error, setError] = useState(null);
  const [genCount, setGenCount] = useState(0); // Track generation count

  // AbortController refs for cancelling stuck requests
  const abortControllerRef = useRef(null);

  // Load stats on mount - NON-BLOCKING
  useEffect(() => {
    pythonMLAPI.getStats()
      .then(res => setPythonMLStats(res.data?.stats || res.data))
      .catch(e => console.log('Stats load failed (non-critical):', e.message));
  }, []);

  // Reset generation counter when workload type changes
  useEffect(() => {
    setGenCount(0);
    setSequence([]);
    setPythonMLStats(null); // Reset trained status in UI since backend clears it
  }, [workloadType]);

  // GENERATE WORKLOAD - Bulletproof version with timeout
  const generateWorkload = () => {
    // If already generating, cancel and restart
    if (abortControllerRef.current) {
      console.log('[GEN] Cancelling previous request');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // Small delay before restarting
      setIsGenerating(false);
      setTimeout(() => generateWorkload(), 100);
      return;
    }

    console.log('[GEN] Starting with params:', { workloadType, workloadLength, uniquePages, localityFactor });
    setIsGenerating(true);
    setError(null);

    // Create new abort controller with timeout
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Auto-timeout after 10 seconds
    const timeoutId = setTimeout(() => {
      console.log('[GEN] Timeout - aborting');
      controller.abort();
    }, 10000);

    const requestBody = {
      type: workloadType,
      length: parseInt(workloadLength) || 50,
      uniquePages: parseInt(uniquePages) || 8,
      localityFactor: parseFloat(localityFactor) || 0.7
    };
    console.log('[GEN] Request body:', requestBody);

    fetch('http://localhost:5000/api/algorithms/generate-workload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        console.log('[GEN] Response status:', res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[GEN] Success, items:', data.sequence?.length, 'first item:', data.sequence?.[0]);
        if (data.sequence && data.sequence.length > 0) {
          setSequence([...data.sequence]); // Create new array to force re-render
          setGenCount(c => c + 1); // Increment generation counter
          console.log('[GEN] Sequence set');
        } else {
          console.error('[GEN] No sequence in response:', data);
          setError('No sequence returned from server');
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.log('[GEN] Aborted');
        } else {
          console.error('[GEN] Error:', err);
          setError('Generate failed: ' + err.message);
        }
      })
      .finally(() => {
        console.log('[GEN] Cleanup');
        clearTimeout(timeoutId);
        setIsGenerating(false);
        abortControllerRef.current = null;
      });
  };

  // TRAIN MODELS - with timeout protection
  const trainModels = () => {
    if (sequence.length < 10) {
      alert('Need at least 10 items to train');
      return;
    }

    // If already training, let it continue (don't stack)
    if (isTraining) {
      console.log('[TRAIN] Already in progress');
      return;
    }

    console.log('[TRAIN] Starting with workload type:', workloadType);
    setIsTraining(true);

    const pageNumbers = sequence.map(s => s.pageNumber ?? s);

    // Timeout after 60 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    fetch('http://localhost:5000/api/python-ml/train-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sequences: [pageNumbers],
        workloadType: workloadType
      }),
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[TRAIN] Success:', data);
        const cumInfo = data.cumulative_info || {};
        if (cumInfo.type_changed) {
          alert(`✅ Models trained!\n\n⚠️ Workload type changed - previous data was auto-reset.\nNow training on: ${cumInfo.workload_type}`);
        } else {
          alert(`✅ Models trained!\n\n📊 Cumulative training:\n• Workload: ${cumInfo.workload_type}\n• Sequences: ${cumInfo.accumulated_sequences}`);
        }
        pythonMLAPI.getStats()
          .then(res => setPythonMLStats(res.data?.stats || res.data))
          .catch(() => { });
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          alert('❌ Training timed out - try again');
        } else {
          console.error('[TRAIN] Error:', err);
          alert('❌ Training failed: ' + err.message);
        }
      })
      .finally(() => {
        console.log('[TRAIN] Cleanup');
        clearTimeout(timeoutId);
        setIsTraining(false);
      });
  };

  // RUN COMPARISON - with timeout protection
  const runComparison = () => {
    // If already comparing, let it continue
    if (isComparing) {
      console.log('[COMPARE] Already in progress');
      return;
    }

    if (sequence.length === 0) return;

    console.log('[COMPARE] Starting...');
    setIsComparing(true);
    setError(null);

    const pageNumbers = sequence.map(s => s.pageNumber ?? s);

    // Timeout after 45 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    // Run both requests in parallel with abort signal
    Promise.all([
      fetch('http://localhost:5000/api/algorithms/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence, frameCount: frameCount || 4 }),
        signal: controller.signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),

      fetch('http://localhost:5000/api/python-ml/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: pageNumbers, frameCount: frameCount || 4 }),
        signal: controller.signal
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    ])
      .then(([tRes, mRes]) => {
        clearTimeout(timeoutId);
        console.log('[COMPARE] Traditional:', tRes.success, 'ML:', mRes.results ? 'OK' : 'FAIL');
        if (tRes.comparison && mRes.results) {
          const cmp = {
            ...tRes.comparison,
            'Random Forest': {
              pageFaults: mRes.results?.random_forest?.stats?.page_faults || 0,
              hitRatio: mRes.results?.random_forest?.stats?.hit_ratio || '0%',
              predictionAccuracy: ((mRes.results?.random_forest?.model_stats?.test_accuracy || 0)).toFixed(1) + '%'
            },
            'XGBoost': {
              pageFaults: mRes.results?.xgboost?.stats?.page_faults || 0,
              hitRatio: mRes.results?.xgboost?.stats?.hit_ratio || '0%',
              predictionAccuracy: ((mRes.results?.xgboost?.model_stats?.test_accuracy || 0)).toFixed(1) + '%'
            },
            'LSTM': {
              pageFaults: mRes.results?.lstm?.stats?.page_faults || 0,
              hitRatio: mRes.results?.lstm?.stats?.hit_ratio || '0%',
              predictionAccuracy: ((mRes.results?.lstm?.model_stats?.test_accuracy || 0)).toFixed(1) + '%'
            }
          };

          const all = [
            { n: 'FIFO', f: cmp.FIFO?.pageFaults || 999 },
            { n: 'LRU', f: cmp.LRU?.pageFaults || 999 },
            { n: 'LFU', f: cmp.LFU?.pageFaults || 999 },
            { n: 'Random Forest', f: cmp['Random Forest']?.pageFaults || 999 },
            { n: 'XGBoost', f: cmp['XGBoost']?.pageFaults || 999 },
            { n: 'LSTM', f: cmp['LSTM']?.pageFaults || 999 }
          ].sort((a, b) => a.f - b.f);

          setResults({
            comparison: cmp,
            winner: { best: all[0].n, ranking: all.map(a => a.n), details: all }
          });

          // Scroll to results after a short delay
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setError('Comparison timed out - try again');
        } else {
          console.error('[COMPARE] Error:', err);
          setError('Comparison failed: ' + err.message);
        }
      })
      .finally(() => {
        console.log('[COMPARE] Cleanup');
        clearTimeout(timeoutId);
        setIsComparing(false);
      });
  };

  const resetModels = () => {
    if (!window.confirm('Reset all ML models?')) return;
    pythonMLAPI.reset(frameCount)
      .then(() => {
        setResults(null);
        setPythonMLStats(null);
        alert('✅ Models reset!');
      })
      .catch(e => alert('Error: ' + e.message));
  };

  const clearAll = () => {
    setSequence([]);
    setResults(null);
    setError(null);
  };

  // Force reset stuck states
  const forceReset = () => {
    console.log('[FORCE RESET] Clearing all states');
    setIsGenerating(false);
    setIsComparing(false);
    setIsTraining(false);
    setError(null);
  };

  const chartData = results ? {
    labels: ['FIFO', 'LRU', 'LFU', 'Random Forest', 'XGBoost', 'LSTM'],
    datasets: [{
      label: 'Page Faults',
      data: [
        results.comparison?.FIFO?.pageFaults || 0,
        results.comparison?.LRU?.pageFaults || 0,
        results.comparison?.LFU?.pageFaults || 0,
        results.comparison?.['Random Forest']?.pageFaults || 0,
        results.comparison?.['XGBoost']?.pageFaults || 0,
        results.comparison?.['LSTM']?.pageFaults || 0
      ],
      backgroundColor: [
        'rgba(239,68,68,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)',
        'rgba(139,92,246,0.7)', 'rgba(6,182,212,0.7)', 'rgba(236,72,153,0.7)'
      ]
    }]
  } : null;

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#cdd6f4' } } },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#6c7086' }, grid: { color: '#45475a' } },
      x: { ticks: { color: '#cdd6f4' }, grid: { color: '#45475a' } }
    }
  };

  return (
    <div className="container">
      <h2 style={{ marginBottom: '1.5rem' }}><FiCpu /> ML Algorithm Comparison</h2>

      {/* Error display */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Debug: State indicator */}
      <div style={{ background: 'var(--surface0)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>States:</span>
        <span style={{ color: isGenerating ? '#f59e0b' : '#22c55e' }}>Gen: {isGenerating ? '⏳' : '✓'}</span>
        <span style={{ color: isComparing ? '#f59e0b' : '#22c55e' }}>Cmp: {isComparing ? '⏳' : '✓'}</span>
        <span style={{ color: isTraining ? '#f59e0b' : '#22c55e' }}>Train: {isTraining ? '⏳' : '✓'}</span>
        <button onClick={forceReset} style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Force Reset
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header"><h3>sklearn Models</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => pythonMLAPI.getStats().then(r => setPythonMLStats(r.data?.stats || r.data)).catch(() => { })}><FiRefreshCw /></button>
            <button className="btn btn-primary" onClick={trainModels} disabled={sequence.length < 10}>{isTraining ? 'Training...' : 'Train'}</button>
            <button className="btn btn-danger" onClick={resetModels}>Reset</button>
          </div>
        </div>
        <div className="grid grid-3" style={{ gap: '1rem', marginTop: '1rem' }}>
          {[{ k: 'random_forest', n: 'Random Forest' }, { k: 'xgboost', n: 'XGBoost' }, { k: 'lstm', n: 'LSTM' }].map(m => (
            <div key={m.k} style={{ padding: '1rem', background: 'var(--surface0)', borderRadius: '8px', borderLeft: `3px solid var(--primary)` }}>
              <div style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{m.n}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{pythonMLStats?.[m.k]?.trained ? 'Trained' : 'Not trained'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3><FiDatabase /> Workload</h3>
        <div className="grid grid-4" style={{ gap: '1rem', margin: '1rem 0' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Type</label>
            <select className="form-input" value={workloadType} onChange={e => setWorkloadType(e.target.value)}>
              <option value="random">Random</option><option value="sequential">Sequential</option><option value="locality">Locality</option><option value="loop">Loop</option><option value="working-set">Working Set</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Length</label>
            <input type="number" className="form-input" value={workloadLength}
              onChange={e => setWorkloadLength(e.target.value === '' ? '' : parseInt(e.target.value))}
              onBlur={e => setWorkloadLength(parseInt(e.target.value) || 50)}
              min="10" max="500" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Unique Pages</label>
            <input type="number" className="form-input" value={uniquePages}
              onChange={e => setUniquePages(e.target.value === '' ? '' : parseInt(e.target.value))}
              onBlur={e => setUniquePages(parseInt(e.target.value) || 8)}
              min="4" max="20" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Frames</label>
            <input type="number" className="form-input" value={frameCount}
              onChange={e => setFrameCount(e.target.value === '' ? '' : parseInt(e.target.value))}
              onBlur={e => setFrameCount(parseInt(e.target.value) || 4)}
              min="2" max="16" />
          </div>
        </div>
        {workloadType === 'locality' && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>Locality Factor: {(localityFactor * 100).toFixed(0)}%</label>
            <input type="range" value={localityFactor} onChange={e => setLocalityFactor(parseFloat(e.target.value))} min="0.1" max="0.95" step="0.05" style={{ width: '100%' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={generateWorkload}><FiZap /> {isGenerating ? 'Generating...' : 'Generate'}</button>
          <button className="btn btn-primary" onClick={runComparison} disabled={!sequence.length}><FiPlay /> {isComparing ? 'Comparing...' : 'Compare'}</button>
          <button className="btn btn-danger" onClick={clearAll}><FiTrash2 /> Clear</button>
        </div>
        {sequence.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface0)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1rem' }}>✓ Generated #{genCount}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{sequence.length} items</span>
            </div>
            <div style={{ color: 'var(--text)', fontSize: '1.1rem', wordBreak: 'break-all', lineHeight: '1.6' }}>
              {sequence.slice(0, sequence.length >= 20 ? 20 : sequence.length).map(p => p.pageNumber).join(', ')}{sequence.length > 20 ? ' ...' : ''}
            </div>
          </div>
        )}
      </div>

      {results && (<div ref={resultsRef}>
        <h3 style={{ marginBottom: '1rem' }}>📊 Results</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {['FIFO', 'LRU', 'LFU', 'Random Forest', 'XGBoost', 'LSTM'].map(a => (
            <div key={a} className="card" style={{ textAlign: 'center', border: results.winner?.best === a ? '2px solid var(--success)' : 'none', padding: '1rem' }}>
              {results.winner?.best === a && <span style={{ background: 'var(--success)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>BEST</span>}
              <h4 style={{ marginTop: '0.5rem' }}>{a}</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--danger)' }}>{results.comparison?.[a]?.pageFaults || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Page Faults</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--success)' }}>{results.comparison?.[a]?.hitRatio || '0%'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Hit Ratio</div>
            </div>
          ))}
        </div>
        <div className="card"><h3>Page Faults</h3><div style={{ height: '300px' }}>{chartData && <Bar data={chartData} options={chartOpts} />}</div></div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>🚀 ML Improvement Analysis</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Comparison against the best performing traditional algorithm (FIFO/LRU/LFU) for this sequence.
          </p>
          <div className="grid grid-3" style={{ gap: '1rem' }}>
            {['Random Forest', 'XGBoost', 'LSTM'].map(model => {
              const mlFaults = results.comparison?.[model]?.pageFaults || 0;
              const traditionalFaults = Math.min(
                results.comparison?.FIFO?.pageFaults || 9999,
                results.comparison?.LRU?.pageFaults || 9999,
                results.comparison?.LFU?.pageFaults || 9999
              );

              const diff = traditionalFaults - mlFaults;
              const percent = traditionalFaults > 0 ? ((diff / traditionalFaults) * 100).toFixed(1) : 0;
              const isBetter = diff >= 0; // 0 diff is considered neutral/better than negative

              return (
                <div key={model} style={{
                  padding: '1rem',
                  background: 'var(--surface0)',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--muted)')}`
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{model}</div>
                  <div style={{
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color: diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--text)'),
                    marginTop: '0.25rem'
                  }}>
                    {diff > 0 ? '▼' : (diff < 0 ? '▲' : '=')} {Math.abs(percent)}%
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {diff > 0 ? 'fewer' : (diff < 0 ? 'more' : 'same')} faults than best traditional
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3>🤖 ML vs DL Comparison</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Traditional Machine Learning (Random Forest, XGBoost) vs Deep Learning (LSTM)
          </p>
          <div style={{ height: '350px' }}>
            <Bar
              data={{
                labels: ['Page Faults', 'Training Accuracy'],
                datasets: [
                  {
                    label: 'Random Forest (ML)',
                    data: [
                      results.comparison?.['Random Forest']?.pageFaults || 0,
                      parseFloat(results.comparison?.['Random Forest']?.predictionAccuracy) || 0
                    ],
                    backgroundColor: 'rgba(139,92,246,0.7)',
                    borderColor: 'rgba(139,92,246,1)',
                    borderWidth: 2
                  },
                  {
                    label: 'XGBoost (ML)',
                    data: [
                      results.comparison?.['XGBoost']?.pageFaults || 0,
                      parseFloat(results.comparison?.['XGBoost']?.predictionAccuracy) || 0
                    ],
                    backgroundColor: 'rgba(6,182,212,0.7)',
                    borderColor: 'rgba(6,182,212,1)',
                    borderWidth: 2
                  },
                  {
                    label: 'LSTM (Deep Learning)',
                    data: [
                      results.comparison?.['LSTM']?.pageFaults || 0,
                      parseFloat(results.comparison?.['LSTM']?.predictionAccuracy) || 0
                    ],
                    backgroundColor: 'rgba(236,72,153,0.7)',
                    borderColor: 'rgba(236,72,153,1)',
                    borderWidth: 2
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                    labels: {
                      color: '#cdd6f4',
                      font: { size: 12, weight: 'bold' }
                    }
                  },
                  title: {
                    display: true,
                    text: 'Traditional ML vs Deep Learning Performance',
                    color: '#cdd6f4',
                    font: { size: 14, weight: 'bold' }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#6c7086' },
                    grid: { color: '#45475a' }
                  },
                  x: {
                    ticks: { color: '#cdd6f4' },
                    grid: { color: '#45475a' }
                  }
                }
              }}
            />
          </div>
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface0)', borderRadius: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>📊 Traditional ML</div>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, paddingLeft: '1.5rem' }}>
                  <li>Random Forest & XGBoost</li>
                  <li>Fast training (1-3 seconds)</li>
                  <li>Works well with small datasets</li>
                  <li>Explicit feature engineering</li>
                </ul>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>🧠 Deep Learning</div>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, paddingLeft: '1.5rem' }}>
                  <li>LSTM (PyTorch)</li>
                  <li>Slower training (15-30 seconds)</li>
                  <li>Needs large datasets</li>
                  <li>Learns features automatically</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>)}
    </div>
  );
};

export default MLComparison;
