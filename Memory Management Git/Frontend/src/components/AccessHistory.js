import React from 'react';

const AccessHistory = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>
        No access history yet. Start accessing pages to see the history.
      </p>
    );
  }

  return (
    <div className="history-list">
      {history.slice().reverse().map((item, index) => (
        <div className="history-item" key={index}>
          <span className={`history-badge ${item.action}`}>
            {item.action === 'hit' ? 'HIT' : 'FAULT'}
          </span>
          <span>
            Page <strong>{item.processId}-{item.pageNumber}</strong>
          </span>
          <span style={{ color: 'var(--muted)' }}>
            → Frame {item.frameIndex}
          </span>
          {item.replaced && (
            <span style={{ color: 'var(--warning)' }}>
              (Replaced: {item.replaced})
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default AccessHistory;
