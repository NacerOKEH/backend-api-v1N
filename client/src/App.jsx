import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

const socket = io('http://localhost:8002')

function App() {
  const [deviceData, setDeviceData] = useState([])
  const [devices, setDevices] = useState([])
  const [isConnected, setIsConnected] = useState(socket.connected)

  const [selectedCity, setSelectedCity] = useState('All')
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    // 1. Fetch initial devices (from Device Management)
    fetch('http://localhost:8001/devices/')
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("Failed to fetch devices", err))

    // 2. Socket setup
    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    function onDeviceUpdate(event) {
      console.log("Update:", event)
      if (event.type === 'device.telemetry') {
        // Add to chart data
        setDeviceData(current => {
          const newData = [...current, {
            time: new Date(event.data.timestamp * 1000).toLocaleTimeString(),
            ...event.data
          }]
          return newData.slice(-50) // Keep last 50 for better flow
        })
      } else if (event.type === 'device.updated' || event.type === 'device.created') {
        // Refresh list
        fetch('http://localhost:8001/devices/')
          .then(res => res.json())
          .then(data => setDevices(data))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('device_update', onDeviceUpdate)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('device_update', onDeviceUpdate)
    }
  }, [])

  // Fetch forecast when city changes
  useEffect(() => {
    if (selectedCity && selectedCity !== 'All') {
      fetch(`http://localhost:8002/monitoring/predict/${selectedCity}`)
        .then(res => res.json())
        .then(data => setForecast(data))
        .catch(err => console.error("Forecast error:", err))
    } else {
      setForecast(null)
    }
  }, [selectedCity])

  // Filter data based on selection
  const filteredData = selectedCity === 'All'
    ? deviceData
    : deviceData.filter(d => d.city === selectedCity)

  // Get unique cities from data for the dropdown
  const cities = ['All', ...new Set(deviceData.map(d => d.city).filter(Boolean))]

  return (
    <div className="container">
      <h1>Cloud Native Monitoring Dashboard</h1>
      <div className="status">
        Status: <span style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* City Filter Control */}
      <div className="filter-controls" style={{ marginBottom: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by City: </label>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Devices</h2>
          <ul>
            {devices.map(d => (
              <li key={d.device_id}>
                <strong>{d.name}</strong> - {d.status}
                <br />
                <small>{d.ip_address}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Real-time Telemetry {selectedCity !== 'All' && `(${selectedCity})`}</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="temperature" stroke="#8884d8" name="Temp (°C)" />
                <Line type="monotone" dataKey="humidity" stroke="#82ca9d" name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weekly Forecast Section */}
      {forecast && forecast.weekly_forecast && (
        <div className="card" style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h2>7-Day Weather Forecast for {selectedCity} (Open-Meteo)</h2>
          <div style={{ display: 'flex', gap: '15px', paddingBottom: '10px' }}>
            {forecast.weekly_forecast.map((day, index) => (
              <div key={index} style={{
                minWidth: '120px',
                padding: '15px',
                border: '1px solid #eee',
                borderRadius: '8px',
                textAlign: 'center',
                background: index === 0 ? '#e3f2fd' : 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '5px' }}>
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.85em', color: '#666', marginBottom: '8px' }}>{day.condition}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '1.1em' }}>
                  <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>{day.max_temp}°</span>
                  <span style={{ color: '#1976d2' }}>{day.min_temp}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
