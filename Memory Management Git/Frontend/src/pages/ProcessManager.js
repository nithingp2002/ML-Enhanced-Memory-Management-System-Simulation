import React, { useState, useEffect } from 'react';
import { FiCpu, FiPlus, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import { processAPI, memoryAPI } from '../services/api';
import PageTable from '../components/PageTable';

const ProcessManager = () => {
  const [processes, setProcesses] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [newProcess, setNewProcess] = useState({ name: '', size: 16 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProcesses();
  }, []);

  const fetchProcesses = async () => {
    try {
      const res = await processAPI.getAll();
      setProcesses(res.data.processes || []);
    } catch (error) {
      console.error('Error fetching processes:', error);
    }
  };

  const createProcess = async (e) => {
    e.preventDefault();
    if (!newProcess.name || !newProcess.size) return;
    
    setLoading(true);
    try {
      await processAPI.create(newProcess);
      setNewProcess({ name: '', size: 16 });
      fetchProcesses();
    } catch (error) {
      console.error('Error creating process:', error);
    }
    setLoading(false);
  };

  const deleteProcess = async (processId) => {
    try {
      await processAPI.delete(processId);
      await memoryAPI.deallocate(processId);
      if (selectedProcess?.processId === processId) {
        setSelectedProcess(null);
      }
      fetchProcesses();
    } catch (error) {
      console.error('Error deleting process:', error);
    }
  };

  const clearAllProcesses = async () => {
    try {
      await processAPI.clearAll();
      await memoryAPI.reset();
      setSelectedProcess(null);
      fetchProcesses();
    } catch (error) {
      console.error('Error clearing processes:', error);
    }
  };

  return (
    <div className="container">
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiCpu /> Process Manager
        </h2>
        <button className="btn btn-danger" onClick={clearAllProcesses}>
          <FiTrash2 size={16} /> Clear All
        </button>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FiPlus /> Create New Process
              </h3>
            </div>
            <form onSubmit={createProcess}>
              <div className="form-group">
                <label className="form-label">Process Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newProcess.name}
                  onChange={(e) => setNewProcess(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter process name"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Size (KB)</label>
                <input
                  type="number"
                  className="form-input"
                  value={newProcess.size}
                  onChange={(e) => setNewProcess(prev => ({ ...prev, size: parseInt(e.target.value) || 0 }))}
                  min="1"
                  max="64"
                  required
                />
                <small style={{ color: 'var(--muted)' }}>
                  Will create {Math.ceil(newProcess.size / 4)} pages (4KB each)
                </small>
              </div>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%' }}
              >
                <FiPlus size={16} /> Create Process
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active Processes</h3>
              <button className="btn btn-sm btn-secondary" onClick={fetchProcesses}>
                <FiRefreshCw size={14} />
              </button>
            </div>
            {processes.length === 0 ? (
              <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
                No processes. Create one to get started.
              </p>
            ) : (
              <div className="process-list">
                {processes.map(process => (
                  <div 
                    className="process-item" 
                    key={process.processId}
                    style={{ 
                      cursor: 'pointer',
                      borderColor: selectedProcess?.processId === process.processId ? 'var(--primary)' : 'var(--border)'
                    }}
                    onClick={() => setSelectedProcess(process)}
                  >
                    <div className="process-info">
                      <span className="process-id">{process.processId}</span>
                      <div>
                        <div>{process.name}</div>
                        <small style={{ color: 'var(--muted)' }}>
                          {process.size}KB • {process.numPages} pages
                        </small>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`process-status ${process.status}`}>
                        {process.status}
                      </span>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProcess(process.processId);
                        }}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3 className="card-title">Page Table</h3>
            {selectedProcess && (
              <span style={{ color: 'var(--primary)' }}>
                {selectedProcess.processId} - {selectedProcess.name}
              </span>
            )}
          </div>
          {selectedProcess ? (
            <PageTable 
              pages={selectedProcess.pages} 
              processId={selectedProcess.processId} 
            />
          ) : (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem' }}>
              Select a process to view its page table
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessManager;
