import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiCpu, FiGrid, FiLayers, FiActivity, FiPlay, FiTrendingUp, FiServer, FiDatabase, FiHardDrive } from 'react-icons/fi';
import { BsCpuFill, BsMemory } from 'react-icons/bs';
import { HiChip } from 'react-icons/hi';
import { MdMemory } from 'react-icons/md';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <FiCpu size={28} />
        <span>Memory</span>Manager
      </Link>
      <div className="nav-links">
        <Link
          to="/"
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
        >
          <FiGrid style={{ marginRight: '0.5rem' }} />
          Dashboard
        </Link>
        <Link
          to="/memory"
          className={`nav-link ${isActive('/memory') ? 'active' : ''}`}
        >
          <FiLayers style={{ marginRight: '0.5rem' }} />
          Memory
        </Link>
        <Link
          to="/processes"
          className={`nav-link ${isActive('/processes') ? 'active' : ''}`}
        >
          <FiCpu style={{ marginRight: '0.5rem' }} />
          Processes
        </Link>
        <Link
          to="/algorithms"
          className={`nav-link ${isActive('/algorithms') ? 'active' : ''}`}
        >
          <FiActivity style={{ marginRight: '0.5rem' }} />
          Algorithms
        </Link>
        <Link
          to="/simulation"
          className={`nav-link ${isActive('/simulation') ? 'active' : ''}`}
        >
          <FiPlay style={{ marginRight: '0.5rem' }} />
          Simulation
        </Link>
        <Link
          to="/ml-comparison"
          className={`nav-link ${isActive('/ml-comparison') ? 'active' : ''}`}
          style={{
            background: isActive('/ml-comparison') ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : 'transparent',
            color: isActive('/ml-comparison') ? 'white' : 'inherit'
          }}
        >
          <FiTrendingUp style={{ marginRight: '0.5rem' }} />
          🤖 ML
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
