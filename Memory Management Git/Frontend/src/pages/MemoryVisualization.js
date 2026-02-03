import React, { useState, useEffect } from 'react';
import { FiLayers, FiRefreshCw, FiZap } from 'react-icons/fi';
import { memoryAPI } from '../services/api';
import MemoryFrame from '../components/MemoryFrame';
import AccessHistory from '../components/AccessHistory';
import StatCard from '../components/StatCard';

const MemoryVisualization = () => {
  const [memoryState, setMemoryState] = useState(null);
  const [algorithm, setAlgorithm] = useState('FIFO');
  const [frameStatuses, setFrameStatuses] = useState({});
  const [accessInput, setAccessInput] = useState({ processId: 'P1', pageNumber: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMemoryState();
  }, []);

  const fetchMemoryState = async () => {
    try {
      const res = await memoryAPI.getState();
      setMemoryState(res.data);
      setAlgorithm(res.data.config?.algorithm || 'FIFO');
    } catch (error) {
      console.error('Error fetching memory state:', error);
    }
  };

  const handleAlgorithmChange = async (newAlgo) => {
    try {
      await memoryAPI.setAlgorithm(newAlgo);
      setAlgorithm(newAlgo);
      fetchMemoryState();
    } catch (error) {
      console.error('Error changing algorithm:', error);
    }
  };

  const handleAccessPage = async () => {
    setLoading(true);
    try {
      const res = await memoryAPI.accessPage(accessInput.processId, accessInput.pageNumber);
      const result = res.data.result;
      
      // Set status for animation
      setFrameStatuses({ [result.frameIndex]: result.hit ? 'hit' : 'fault' });
      
      // Clear status after animation
      setTimeout(() => setFrameStatuses({}), 500);
      
      setMemoryState(prev => ({
        ...prev,
        memory: res.data.state
      }));
    } catch (error) {
      console.error('Error accessing page:', error);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    try {
      await memoryAPI.reset();
      fetchMemoryState();
    } catch (error) {
      console.error('Error resetting memory:', error);
    }
  };

  const frames = memoryState?.memory?.frames || Array(16).fill(null);
  const history = memoryState?.memory?.history || [];
  const pageFaults = memoryState?.memory?.pageFaults || 0;
  const pageHits = memoryState?.memory?.pageHits || 0;
  const hitRatio = memoryState?.memory?.hitRatio || 0;

  return (
    <div className="container">
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiLayers /> Memory Visualization
        </h2>
        <button className="btn btn-danger" onClick={handleReset}>
          <FiRefreshCw size={16} /> Reset Memory
        </button>
      </div>

      <div className="stats-grid fade-in">
        <StatCard label="Page Faults" value={pageFaults} colorClass="danger" />
        <StatCard label="Page Hits" value={pageHits} colorClass="success" />
        <StatCard label="Hit Ratio" value={`${(hitRatio * 100).toFixed(1)}%`} colorClass="primary" />
        <StatCard label="Algorithm" value={algorithm} colorClass="warning" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Access Page</h3>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Process ID</label>
              <input
                type="text"
                className="form-input"
                value={accessInput.processId}
                onChange={(e) => setAccessInput(prev => ({ ...prev, processId: e.target.value }))}
                placeholder="P1"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Page Number</label>
              <input
                type="number"
                className="form-input"
                value={accessInput.pageNumber}
                onChange={(e) => setAccessInput(prev => ({ ...prev, pageNumber: parseInt(e.target.value) || 0 }))}
                min="0"
              />
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleAccessPage}
            disabled={loading}
            style={{ width: '100%' }}
          >
            <FiZap size={16} /> Access Page
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Select Algorithm</h3>
          </div>
          <div className="algorithm-tabs">
            {['FIFO', 'LRU', 'LFU'].map(algo => (
              <button
                key={algo}
                className={`algorithm-tab ${algorithm === algo ? 'active' : ''}`}
                onClick={() => handleAlgorithmChange(algo)}
              >
                {algo}
              </button>
            ))}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {algorithm === 'FIFO' && 'First-In-First-Out: Replaces the oldest page in memory'}
            {algorithm === 'LRU' && 'Least Recently Used: Replaces the page not used for the longest time'}
            {algorithm === 'LFU' && 'Least Frequently Used: Replaces the page with lowest access count'}
          </p>
        </div>
      </div>

      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">RAM Frames</h3>
          <span style={{ color: 'var(--muted)' }}>
            {frames.filter(f => f !== null).length} / {frames.length} occupied
          </span>
        </div>
        <div className="memory-grid">
          {frames.map((content, index) => (
            <MemoryFrame
              key={index}
              frameNumber={index}
              content={content}
              status={frameStatuses[index]}
            />
          ))}
        </div>
      </div>

      <div className="card fade-in" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Access History</h3>
          <span style={{ color: 'var(--muted)' }}>{history.length} operations</span>
        </div>
        <AccessHistory history={history} />
      </div>
    </div>
  );
};

export default MemoryVisualization;
