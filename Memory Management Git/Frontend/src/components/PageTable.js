import React from 'react';

const PageTable = ({ pages, processId }) => {
  if (!pages || pages.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>No pages to display</p>;
  }

  return (
    <table className="page-table">
      <thead>
        <tr>
          <th>Page #</th>
          <th>Frame #</th>
          <th>Valid</th>
          <th>Access Count</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((page, index) => (
          <tr key={index}>
            <td>{page.pageNumber}</td>
            <td>{page.frameNumber !== null ? page.frameNumber : '-'}</td>
            <td>
              <span 
                style={{ 
                  color: page.inMemory ? 'var(--success)' : 'var(--danger)' 
                }}
              >
                {page.inMemory ? '✓' : '✗'}
              </span>
            </td>
            <td>{page.accessCount || 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PageTable;
