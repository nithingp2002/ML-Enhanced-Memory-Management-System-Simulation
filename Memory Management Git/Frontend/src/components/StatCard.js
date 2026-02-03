import React from 'react';

const StatCard = ({ label, value, colorClass = '' }) => {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass}`}>{value}</div>
    </div>
  );
};

export default StatCard;
