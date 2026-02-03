import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCpu, FiLayers, FiActivity, FiPlay, FiRefreshCw } from 'react-icons/fi';
import { memoryAPI, processAPI } from '../services/api';
import StatCard from '../components/StatCard';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [memoryState, setMemoryState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, processRes, memoryRes] = await Promise.all([
        memoryAPI.getStats().catch(() => ({ data: null })),
        processAPI.getAll().catch(() => ({ data: { processes: [] } })),
        memoryAPI.getState().catch(() => ({ data: null }))
      ]);
      
      setStats(statsRes.data);
      setProcesses(processRes.data?.processes || []);
      setMemoryState(memoryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const initializeMemory = async () => {
    try {
      await memoryAPI.initialize({ totalFrames: 16, frameSize: 4, algorithm: 'FIFO' });
      fetchData();
    } catch (error) {
      console.error('Error initializing memory:', error);
    }
  };

  const currentAlgo = memoryState?.config?.algorithm || 'FIFO';
  const comparison = stats?.comparison || {};

  return (
    <div className="container">
      <div className="hero fade-in">
        <h1>🧠 Memory Management System</h1>
        <p>
          Interactive simulation of Operating System memory management concepts 
          including Paging, Page Faults, and Replacement Algorithms
        </p>
      </div>

      <div className="stats-grid fade-in">
        <StatCard 
          label="Active Processes" 
          value={processes.filter(p => p.status === 'active').length} 
          colorClass="primary" 
        />
        <StatCard 
          label="Total Frames" 
          value={memoryState?.config?.totalFrames || 16} 
          colorClass="secondary" 
        />
        <StatCard 
          label="Current Algorithm" 
          value={currentAlgo} 
          colorClass="warning" 
        />
        <StatCard 
          label="Page Faults" 
          value={comparison[currentAlgo]?.pageFaults || 0} 
          colorClass="danger" 
        />
      </div>

      <div className="quick-access fade-in">
        <Link to="/memory" className="quick-access-btn">
          <FiLayers size={32} />
          <span>View Memory</span>
        </Link>
        <Link to="/processes" className="quick-access-btn">
          <FiCpu size={32} />
          <span>Manage Processes</span>
        </Link>
        <Link to="/algorithms" className="quick-access-btn">
          <FiActivity size={32} />
          <span>Compare Algorithms</span>
        </Link>
        <Link to="/simulation" className="quick-access-btn">
          <FiPlay size={32} />
          <span>Run Simulation</span>
        </Link>
      </div>

      <div className="grid grid-2 fade-in">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FiActivity /> Algorithm Performance
            </h3>
            <button className="btn btn-sm btn-secondary" onClick={fetchData}>
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
          <div className="comparison-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {['FIFO', 'LRU', 'LFU'].map(algo => (
              <div 
                key={algo} 
                className={`comparison-card ${algo === currentAlgo ? 'winner' : ''}`}
                style={{ padding: '1rem' }}
              >
                <h3 style={{ fontSize: '1.1rem' }}>{algo}</h3>
                <div className="comparison-stat">
                  <div className="label">Page Faults</div>
                  <div className="value" style={{ fontSize: '1.5rem', color: 'var(--danger)' }}>
                    {comparison[algo]?.pageFaults || 0}
                  </div>
                </div>
                <div className="comparison-stat">
                  <div className="label">Hit Ratio</div>
                  <div className="value" style={{ fontSize: '1rem', color: 'var(--success)' }}>
                    {((comparison[algo]?.hitRatio || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <FiCpu /> Active Processes
            </h3>
            <button className="btn btn-sm btn-primary" onClick={initializeMemory}>
              Initialize Memory
            </button>
          </div>
          {processes.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
              No processes yet. Create a process to get started.
            </p>
          ) : (
            <div className="process-list">
              {processes.slice(0, 5).map(process => (
                <div className="process-item" key={process.processId}>
                  <div className="process-info">
                    <span className="process-id">{process.processId}</span>
                    <span>{process.name}</span>
                  </div>
                  <div>
                    <span className={`process-status ${process.status}`}>
                      {process.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card fade-in" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">📚 Concepts Demonstrated</h3>
        </div>
        <div className="grid grid-4" style={{ gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'var(--dark)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Paging</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Divides processes into fixed-size pages mapped to memory frames
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--dark)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Page Faults</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Occurs when a requested page is not in physical memory
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--dark)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Page Replacement</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              FIFO, LRU, LFU algorithms to select victim pages
            </p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--dark)', borderRadius: '8px' }}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Data Structures</h4>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              Queue, Doubly Linked List, Hash Map, Min Heap
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
