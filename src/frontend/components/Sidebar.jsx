import React from 'react';

function Sidebar({ filters, onFilterChange, onSearch, stats, permitCount, loading }) {
  return (
    <div style={{
      width: '350px',
      backgroundColor: '#f8f9fa',
      padding: '20px',
      overflowY: 'auto',
      borderRight: '1px solid #dee2e6'
    }}>
      <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
        Permit Map Generator
      </h1>

      {/* Stats */}
      {stats && (
        <div style={{
          backgroundColor: 'white',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Database Stats</h3>
          <p style={{ fontSize: '14px', color: '#6c757d' }}>
            Total Permits: <strong>{stats.total}</strong>
          </p>
          <p style={{ fontSize: '14px', color: '#6c757d', marginTop: '5px' }}>
            Showing: <strong>{permitCount}</strong>
          </p>
        </div>
      )}

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Filters</h3>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
            Permit Type
          </label>
          <select
            value={filters.permitType}
            onChange={(e) => onFilterChange({ ...filters, permitType: e.target.value })}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">All Types</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>

        <button
          onClick={onSearch}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#e7f3ff',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px',
        fontSize: '13px',
        color: '#004085'
      }}>
        <h4 style={{ marginBottom: '8px' }}>How to Use</h4>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Set your filters above</li>
          <li>Click "Search" to load permits</li>
          <li>Click markers on the map for details</li>
          <li>Export map as needed</li>
        </ol>
      </div>
    </div>
  );
}

export default Sidebar;