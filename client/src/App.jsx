import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

const socket = io('http://localhost:8002')

const PREDEFINED_CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir",
  "Paris", "London", "New York", "Tokyo", "Berlin", "Madrid"
];

function App() {
  const [deviceData, setDeviceData] = useState([])
  const [devices, setDevices] = useState([])
  const [isConnected, setIsConnected] = useState(socket.connected)

  const [selectedCity, setSelectedCity] = useState(PREDEFINED_CITIES[0])
  const [forecast, setForecast] = useState(null)

  // State for selected specific device (for "Online" status and focused data)
  const [selectedDevice, setSelectedDevice] = useState(null)

  const [newDevice, setNewDevice] = useState({ name: '', city: PREDEFINED_CITIES[0], type: 'Sensor' })

  // Sync Form City with Filter City for better UX
  useEffect(() => {
    setNewDevice(prev => ({ ...prev, city: selectedCity }))
  }, [selectedCity])

  const handleCreateDevice = () => {
    if (!newDevice.name || !newDevice.city) return alert("Name and City required")

    const payload = {
      name: newDevice.name,
      type: newDevice.type,
      city: newDevice.city,
      ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
      mac_address: "AA:BB:CC:DD" + Math.floor(Math.random() * 10000),
      firmware_version: "v1.2",
      latitude: "0",
      longitude: "0"
    }

    fetch('http://localhost:8001/devices/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(() => {
        setNewDevice(prev => ({ ...prev, name: '' }))
        setSelectedCity(newDevice.city) // Force switch to view the new device
        fetchDevices()
      })
      .catch(err => console.error("Add failed", err))
  }

  const handleDeleteDevice = (e, id) => {
    e.stopPropagation()
    if (!window.confirm("Delete this device?")) return

    fetch(`http://localhost:8001/devices/${id}`, { method: 'DELETE' })
      .then(() => {
        setDevices(prev => prev.filter(d => d.device_id !== id))
        if (selectedDevice?.device_id === id) setSelectedDevice(null)
      })
  }

  const fetchDevices = () => {
    fetch('http://localhost:8001/devices/')
      .then(res => res.json())
      .then(data => setDevices(data))
      .catch(err => console.error("Failed to fetch devices", err))
  }

  useEffect(() => {
    fetchDevices()

    function onConnect() { setIsConnected(true) }
    function onDisconnect() { setIsConnected(false) }
    function onDeviceUpdate(event) {
      if (event.type === 'device.telemetry') {
        setDeviceData(current => {
          const newData = [...current, {
            time: new Date(event.data.timestamp * 1000).toLocaleTimeString(),
            device_id: event.data.device_id,
            city: event.data.city,
            ...event.data
          }]
          return newData.slice(-50)
        })
      } else if (event.type === 'device.updated' || event.type === 'device.created') {
        fetchDevices()
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

  // Forecast Logic
  useEffect(() => {
    const targetCity = selectedDevice ? selectedDevice.city : selectedCity
    if (targetCity) {
      fetch(`http://localhost:8002/monitoring/predict/${targetCity}`)
        .then(res => res.json())
        .then(data => setForecast(data))
        .catch(err => console.error("Forecast error:", err))
    }
  }, [selectedCity, selectedDevice])

  // Click on Device Handler
  const handleDeviceClick = (device) => {
    if (selectedDevice?.device_id === device.device_id) {
      setSelectedDevice(null) // Deselect
    } else {
      setSelectedDevice(device)
      if (device.city) setSelectedCity(device.city)
    }
  }

  // --- FILTER LOGIC ---
  // List Filter: Show only devices in selected city
  const filteredDevices = devices.filter(d => d.city === selectedCity)

  // Chart Filter: Show telemetry for selected Device OR selected City
  const filteredData = selectedDevice
    ? deviceData.filter(d => d.device_id === selectedDevice.device_id)
    : deviceData.filter(d => d.city === selectedCity)

  // Chart Data Source
  const chartData = (selectedCity && !selectedDevice && forecast?.hourly_forecast)
    ? forecast.hourly_forecast
    : filteredData

  // Helper to get latest telemetry for selected device (for Cards)
  const latestTelemetry = selectedDevice
    ? deviceData.filter(d => d.device_id === selectedDevice.device_id).slice(-1)[0]
    : null;

  return (
    <div className="container">
      <h1>Cloud Native Monitoring Dashboard</h1>
      <div className="status">
        Status: <span style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>

      {/* City Filter Control - Always visible if no device selected */}
      {!selectedDevice && (
        <div className="filter-controls" style={{ marginBottom: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by City: </label>
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} style={{ padding: '5px' }}>
            {/* Show PREDEFINED cities so user can navigate even if no devices */}
            {PREDEFINED_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
      )}

      {selectedDevice && (
        <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid #3b82f6', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Executing <strong>psutil</strong> monitoring for: <strong>{selectedDevice.name}</strong> ({selectedDevice.city})
          </div>
          <button onClick={() => setSelectedDevice(null)} style={{ padding: '4px 12px', cursor: 'pointer', borderRadius: '4px', border: 'none', background: '#3b82f6', color: 'white' }}>Back to Overview</button>
        </div>
      )}

      {/* SYSTEM STATS CARDS (CPU/RAM) - Only if Device Selected */}
      {selectedDevice && (
        <div className="stats-grid">
          <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6' }}>
            <h3 style={{ color: '#a78bfa' }}>CPU Usage</h3>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
              {latestTelemetry ? `${latestTelemetry.cpu_usage}%` : '...'}
            </div>
            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: latestTelemetry ? `${latestTelemetry.cpu_usage}%` : '0%', height: '100%', background: '#8b5cf6', transition: 'width 0.5s' }}></div>
            </div>
          </div>

          <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b' }}>
            <h3 style={{ color: '#fbbf24' }}>RAM Usage</h3>
            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
              {latestTelemetry ? `${latestTelemetry.ram_usage}%` : '...'}
            </div>
            <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
              <div style={{ width: latestTelemetry ? `${latestTelemetry.ram_usage}%` : '0%', height: '100%', background: '#f59e0b', transition: 'width 0.5s' }}></div>
            </div>
          </div>
        </div>
      )}


      <div className="grid">
        <div className="card">
          <h2>Devices ({selectedCity})</h2>
          <ul>
            {filteredDevices.length === 0 && <p style={{ opacity: 0.5, fontStyle: 'italic' }}>No devices in {selectedCity}</p>}

            {filteredDevices.map(d => {
              const isSelected = selectedDevice?.device_id === d.device_id;
              const isOnline = selectedDevice
                ? isSelected
                : d.status === 'ONLINE';

              return (
                <li
                  key={d.device_id}
                  className={`device-item ${isSelected ? 'selected-device' : ''}`}
                  onClick={() => handleDeviceClick(d)}
                  style={{ cursor: 'pointer', borderColor: isSelected ? '#3b82f6' : 'var(--border-color)', background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)' }}
                >
                  <div className="device-header">
                    <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                    <strong>{d.name}</strong>
                    <span className="device-status" style={{ color: isOnline ? '#10b981' : '#64748b' }}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>

                  <div className="device-details">
                    <div className="detail-row">
                      <span>City:</span> <small>{d.city || "Unknown"}</small>
                    </div>
                    <div className="detail-row">
                      <span>IP:</span> <small>{d.ip_address || "N/A"}</small>
                    </div>
                    <div className="detail-row">
                      <span>Type:</span> <small>{d.type || "N/A"}</small>
                    </div>
                  </div>

                  <div className="device-actions">
                    <button className="delete-btn" onClick={(e) => handleDeleteDevice(e, d.device_id)}>Delete</button>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Add Device Form */}
          <div className="add-device-form">
            <h3>Add New Device in {newDevice.city}</h3>
            <input
              placeholder="Device Name"
              value={newDevice.name}
              onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
            />
            {/* Select for Predefined City */}
            <select
              value={newDevice.city}
              onChange={e => setNewDevice({ ...newDevice, city: e.target.value })}
              style={{ width: '100%', marginBottom: '10px', padding: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
            >
              {PREDEFINED_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleCreateDevice}>+ Add Device</button>
          </div>
        </div>

        <div className="card">
          <h2>
            {selectedDevice
              ? `Live Monitor: ${selectedDevice.name}`
              : `Hourly Forecast & Overview (${selectedCity})`
            }
          </h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="temperature" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp (°C)" />
                <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Weekly Forecast Section */}
      {forecast && forecast.weekly_forecast && (
        <div className="card" style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h2>7-Day Weather Forecast for {selectedDevice ? selectedDevice.city : selectedCity} (Open-Meteo)</h2>
          <div style={{ display: 'flex', gap: '15px', paddingBottom: '10px' }}>
            {forecast.weekly_forecast.map((day, index) => (
              <div key={index} className="weekly-card">
                <div className="date">
                  {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="condition">{day.condition}</div>
                <div className="temps">
                  <span>{day.max_temp}°</span>
                  <span>{day.min_temp}°</span>
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
