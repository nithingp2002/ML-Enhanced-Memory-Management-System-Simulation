import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiPlay, FiPause, FiSkipForward, FiRotateCcw, FiSettings } from 'react-icons/fi';
import { memoryAPI } from '../services/api';
import MemoryFrame from '../components/MemoryFrame';
import StatCard from '../components/StatCard';

const Simulation = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [algorithm, setAlgorithm] = useState('FIFO');
  const [frameCount] = useState(8);
  const [memoryState, setMemoryState] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [sequence, setSequence] = useState([]);
  const [frameStatuses, setFrameStatuses] = useState({});
  const [log, setLog] = useState([]);
  const intervalRef = useRef(null);

  const initializeSimulation = useCallback(async () => {
    try {
      await memoryAPI.initialize({ totalFrames: frameCount, algorithm });
      await memoryAPI.reset();
      
      // Generate random sequence
      const newSequence = [];
      for (let i = 0; i < 20; i++) {
        newSequence.push({
          processId: `P${Math.floor(Math.random() * 3) + 1}`,
          pageNumber: Math.floor(Math.random() * 6)
        });
      }
      setSequence(newSequence);
      setCurrentStep(0);
      setLog([]);
      
      const res = await memoryAPI.getState();
      setMemoryState(res.data);
    } catch (error) {
      console.error('Error initializing:', error);
    }
  }, [frameCount, algorithm]);

  const executeStep = useCallback(async () => {
    if (currentStep >= sequence.length) {
      setIsRunning(false);
      return;
    }

    const { processId, pageNumber } = sequence[currentStep];
    
    try {
      const res = await memoryAPI.accessPage(processId, pageNumber);
      const result = res.data.result;
      
      setFrameStatuses({ [result.frameIndex]: result.hit ? 'hit' : 'fault' });
      setTimeout(() => setFrameStatuses({}), 300);
      
      setMemoryState(prev => ({
        ...prev,
        memory: res.data.state
      }));
      
      setLog(prev => [...prev, {
        step: currentStep + 1,
        page: `${processId}-${pageNumber}`,
        result: result.hit ? 'HIT' : 'FAULT',
        frame: result.frameIndex,
        replaced: result.replaced
      }]);
      
      setCurrentStep(prev => prev + 1);
    } catch (error) {
      console.error('Error executing step:', error);
      setIsRunning(false);
    }
  }, [currentStep, sequence]);

  useEffect(() => {
    initializeSimulation();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [initializeSimulation]);

  useEffect(() => {
    if (isRunning && currentStep < sequence.length) {
      intervalRef.current = setInterval(() => {
        executeStep();
      }, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentStep, speed, sequence.length, executeStep]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);
  const handleStep = () => {
    if (currentStep < sequence.length) {
      executeStep();
    }
  };

  const handleReset = async () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    await initializeSimulation();
  };

  const handleAlgorithmChange = async (newAlgo) => {
    setAlgorithm(newAlgo);
    try {
      await memoryAPI.setAlgorithm(newAlgo);
      handleReset();
    } catch (error) {
      console.error('Error changing algorithm:', error);
    }
  };

  const frames = memoryState?.memory?.frames || Array(frameCount).fill(null);
  const pageFaults = memoryState?.memory?.pageFaults || 0;
  const pageHits = memoryState?.memory?.pageHits || 0;
  const hitRatio = memoryState?.memory?.hitRatio || 0;

  return (
    <div className="container">
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiPlay /> Interactive Simulation
        </h2>
        <div className="btn-group">
          {!isRunning ? (
            <button 
              className="btn btn-success" 
              onClick={handleStart}
              disabled={currentStep >= sequence.length}
            >
              <FiPlay size={16} /> Start
            </button>
          ) : (
            <button className="btn btn-warning" onClick={handlePause}>
              <FiPause size={16} /> Pause
            </button>
          )}
          <button 
            className="btn btn-primary" 
            onClick={handleStep}
            disabled={isRunning || currentStep >= sequence.length}
          >
            <FiSkipForward size={16} /> Step
          </button>
          <button className="btn btn-danger" onClick={handleReset}>
            <FiRotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      <div className="stats-grid fade-in">
        <StatCard label="Current Step" value={`${currentStep}/${sequence.length}`} colorClass="primary" />
        <StatCard label="Page Faults" value={pageFaults} colorClass="danger" />
        <StatCard label="Page Hits" value={pageHits} colorClass="success" />
        <StatCard label="Hit Ratio" value={`${(hitRatio * 100).toFixed(1)}%`} colorClass="warning" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><FiSettings /> Settings</h3>
          </div>
          
          <div className="form-group">
            <label className="form-label">Algorithm</label>
            <div className="algorithm-tabs">
              {['FIFO', 'LRU', 'LFU'].map(algo => (
                <button
                  key={algo}
                  className={`algorithm-tab ${algorithm === algo ? 'active' : ''}`}
                  onClick={() => handleAlgorithmChange(algo)}
                  disabled={isRunning}
                >
                  {algo}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Animation Speed: {speed}ms</label>
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Reference Sequence</h3>
          </div>
          <div className="sequence-tags">
            {sequence.map((page, index) => (
              <span 
                key={index} 
                className="sequence-tag"
                style={{
                  opacity: index < currentStep ? 0.5 : 1,
                  background: index === currentStep ? 'var(--success)' : 
                             index < currentStep ? 'var(--muted)' : 'var(--primary)'
                }}
              >
                {page.processId}-{page.pageNumber}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card fade-in">
        <div className="card-header">
          <h3 className="card-title">RAM Frames ({algorithm})</h3>
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
          <h3 className="card-title">Execution Log</h3>
        </div>
        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
          {log.length === 0 ? (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
              Start the simulation to see the execution log
            </p>
          ) : (
            <table className="page-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Page</th>
                  <th>Result</th>
                  <th>Frame</th>
                  <th>Replaced</th>
                </tr>
              </thead>
              <tbody>
                {log.slice().reverse().map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.step}</td>
                    <td><strong>{entry.page}</strong></td>
                    <td>
                      <span className={`history-badge ${entry.result.toLowerCase()}`}>
                        {entry.result}
                      </span>
                    </td>
                    <td>{entry.frame}</td>
                    <td>{entry.replaced || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Simulation;
