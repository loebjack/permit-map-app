import React, { useState, useEffect } from 'react';
import Map from './components/Map';
import Sidebar from './components/Sidebar';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    permitType: ''
  });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchPermits();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPermits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.permitType) params.append('permitType', filters.permitType);

      const response = await fetch(`${API_URL}/permits?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPermits(data.data);
      }
    } catch (error) {
      console.error('Error fetching permits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleSearch = () => {
    fetchPermits();
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        stats={stats}
        permitCount={permits.length}
        loading={loading}
      />
      <Map permits={permits} />
    </div>
  );
}

export default App;