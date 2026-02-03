import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import MemoryVisualization from './pages/MemoryVisualization';
import ProcessManager from './pages/ProcessManager';
import AlgorithmComparison from './pages/AlgorithmComparison';
import Simulation from './pages/Simulation';
import MLComparison from './pages/MLComparison';

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/memory" element={<MemoryVisualization />} />
          <Route path="/processes" element={<ProcessManager />} />
          <Route path="/algorithms" element={<AlgorithmComparison />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/ml-comparison" element={<MLComparison />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
