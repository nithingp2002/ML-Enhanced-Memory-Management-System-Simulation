import React from 'react';

const MemoryFrame = ({ frameNumber, content, status }) => {
  const getStatusClass = () => {
    if (status === 'hit') return 'hit';
    if (status === 'fault') return 'fault';
    if (content) return 'occupied';
    return '';
  };

  return (
    <div className={`memory-frame ${getStatusClass()}`}>
      <div className="frame-number">Frame {frameNumber}</div>
      <div className={`frame-content ${!content ? 'frame-empty' : ''}`}>
        {content || 'Empty'}
      </div>
    </div>
  );
};

export default MemoryFrame;
