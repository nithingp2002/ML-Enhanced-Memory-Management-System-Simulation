import React, { useState } from 'react';
import { FiActivity, FiPlay, FiTrash2, FiPlus } from 'react-icons/fi';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { algorithmAPI } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AlgorithmComparison = () => {
  const [sequence, setSequence] = useState([]);
  const [frameCount, setFrameCount] = useState(4);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inputPage, setInputPage] = useState({ processId: 'P1', pageNumber: 0 });

  const addToSequence = () => {
    setSequence(prev => [...prev, { ...inputPage }]);
    setInputPage(prev => ({ ...prev, pageNumber: prev.pageNumber + 1 }));
  };

  const removeFromSequence = (index) => {
    setSequence(prev => prev.filter((_, i) => i !== index));
  };

  const clearSequence = () => {
    setSequence([]);
    setResults(null);
  };

  const generateRandomSequence = () => {
    const newSequence = [];
    for (let i = 0; i < 15; i++) {
      newSequence.push({
        processId: 'P1',
        pageNumber: Math.floor(Math.random() * 8)
      });
    }
    setSequence(newSequence);
  };

  const runComparison = async () => {
    if (sequence.length === 0) return;
    
    setLoading(true);
    try {
      const res = await algorithmAPI.compare(sequence, frameCount);
      setResults(res.data);
    } catch (error) {
      console.error('Error comparing algorithms:', error);
    }
    setLoading(false);
  };

  const chartData = results ? {
    labels: ['FIFO', 'LRU', 'LFU'],
    datasets: [
      {
        label: 'Page Faults',
        data: [
          results.comparison.FIFO.pageFaults,
          results.comparison.LRU.pageFaults,
          results.comparison.LFU.pageFaults
        ],
        backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(34, 197, 94, 0.7)'],
        borderColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderWidth: 2
      },
      {
        label: 'Page Hits',
        data: [
          results.comparison.FIFO.pageHits,
          results.comparison.LRU.pageHits,
          results.comparison.LFU.pageHits
        ],
        backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(14, 165, 233, 0.7)', 'rgba(168, 85, 247, 0.7)'],
        borderColor: ['#6366f1', '#0ea5e9', '#a855f7'],
        borderWidth: 2
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cdd6f4' }
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
  };

  return (
    <div className="container">
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiActivity /> Algorithm Comparison
        </h2>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Build Reference Sequence</h3>
            <button className="btn btn-sm btn-secondary" onClick={generateRandomSequence}>
              Generate Random
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Process ID</label>
              <input
                type="text"
                className="form-input"
                value={inputPage.processId}
                onChange={(e) => setInputPage(prev => ({ ...prev, processId: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Page #</label>
              <input
                type="number"
                className="form-input"
                value={inputPage.pageNumber}
                onChange={(e) => setInputPage(prev => ({ ...prev, pageNumber: parseInt(e.target.value) || 0 }))}
                min="0"
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" onClick={addToSequence}>
                <FiPlus size={16} />
              </button>
            </div>
          </div>

          <div className="sequence-tags" style={{ minHeight: '60px' }}>
            {sequence.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>Add pages to build reference sequence</p>
            ) : (
              sequence.map((page, index) => (
                <span key={index} className="sequence-tag">
                  {page.processId}-{page.pageNumber}
                  <button onClick={() => removeFromSequence(index)}>×</button>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configuration</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label">Number of Frames</label>
            <input
              type="number"
              className="form-input"
              value={frameCount}
              onChange={(e) => setFrameCount(parseInt(e.target.value) || 3)}
              min="1"
              max="16"
            />
          </div>

          <div className="btn-group" style={{ marginTop: '1rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={runComparison}
              disabled={loading || sequence.length === 0}
              style={{ flex: 1 }}
            >
              <FiPlay size={16} /> Run Comparison
            </button>
            <button className="btn btn-danger" onClick={clearSequence}>
              <FiTrash2 size={16} /> Clear
            </button>
          </div>
        </div>
      </div>

      {results && (
        <>
          <div className="comparison-grid fade-in" style={{ marginBottom: '1.5rem' }}>
            {['FIFO', 'LRU', 'LFU'].map(algo => (
              <div 
                key={algo}
                className={`comparison-card ${results.winner.best === algo ? 'winner' : ''}`}
              >
                {results.winner.best === algo && (
                  <span style={{ 
                    background: 'var(--success)', 
                    color: 'white', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    marginBottom: '0.5rem',
                    display: 'inline-block'
                  }}>
                    🏆 BEST
                  </span>
                )}
                <h3>{algo}</h3>
                <div className="comparison-stat">
                  <div className="label">Page Faults</div>
                  <div className="value" style={{ color: 'var(--danger)' }}>
                    {results.comparison[algo].pageFaults}
                  </div>
                </div>
                <div className="comparison-stat">
                  <div className="label">Page Hits</div>
                  <div className="value" style={{ color: 'var(--success)' }}>
                    {results.comparison[algo].pageHits}
                  </div>
                </div>
                <div className="comparison-stat">
                  <div className="label">Hit Ratio</div>
                  <div className="value" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                    {results.comparison[algo].hitRatio}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card fade-in">
            <div className="card-header">
              <h3 className="card-title">Visual Comparison</h3>
            </div>
            <div className="chart-container">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          <div className="card fade-in" style={{ marginTop: '1.5rem' }}>
            <div className="card-header">
              <h3 className="card-title">Step-by-Step Execution</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="page-table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Page</th>
                    <th>FIFO Result</th>
                    <th>LRU Result</th>
                    <th>LFU Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.comparison.FIFO.steps.map((step, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{step.page}</strong></td>
                      <td>
                        <span className={`history-badge ${step.hit ? 'hit' : 'fault'}`}>
                          {step.hit ? 'HIT' : 'FAULT'}
                        </span>
                      </td>
                      <td>
                        <span className={`history-badge ${results.comparison.LRU.steps[i].hit ? 'hit' : 'fault'}`}>
                          {results.comparison.LRU.steps[i].hit ? 'HIT' : 'FAULT'}
                        </span>
                      </td>
                      <td>
                        <span className={`history-badge ${results.comparison.LFU.steps[i].hit ? 'hit' : 'fault'}`}>
                          {results.comparison.LFU.steps[i].hit ? 'HIT' : 'FAULT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AlgorithmComparison;
