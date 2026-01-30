import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom';
import '../App.css'

// Connect to socket only once outside component to avoid multiple connections on re-renders, 
// OR handle connection inside useEffect carefully.
const socket = io('http://localhost:8002');

const PREDEFINED_CITIES = [
    "Local", "Fes", "Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir",
    "Paris", "London", "New York", "Tokyo", "Berlin", "Madrid"
];

const DEVICE_TYPES = ["Sensor", "Actuator", "Server", "Gateway"];

function Dashboard() {
    const [deviceData, setDeviceData] = useState([])
    const [devices, setDevices] = useState([])
    const [isConnected, setIsConnected] = useState(socket.connected)

    const [selectedCity, setSelectedCity] = useState(PREDEFINED_CITIES[0])
    const [forecast, setForecast] = useState(null)

    // State for selected specific device (for "Online" status and focused data)
    const [selectedDevice, setSelectedDevice] = useState(null)

    const [newDevice, setNewDevice] = useState({ name: '', city: PREDEFINED_CITIES[0], type: 'Sensor' })

    // Edit Mode State
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    const navigate = useNavigate();

    // Logout function
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

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

    // --- EDIT LOGIC ---
    const startEdit = (e, device) => {
        e.stopPropagation();
        setEditingId(device.device_id);
        setEditFormData({ ...device });
    };

    const cancelEdit = (e) => {
        e?.stopPropagation();
        setEditingId(null);
        setEditFormData({});
    };

    const handleUpdateDevice = (e) => {
        e.stopPropagation();
        fetch(`http://localhost:8001/devices/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editFormData)
        })
            .then(res => res.json())
            .then(updatedDevice => {
                setDevices(prev => prev.map(d => d.device_id === editingId ? updatedDevice : d));
                setEditingId(null);
            })
            .catch(err => console.error("Update failed", err));
    };

    const fetchDevices = () => {
        fetch('http://localhost:8001/devices/')
            .then(res => res.json())
            .then(data => {
                setDevices(data)
                // Auto-select "Host PC" if registered and nothing selected
                const hostDevice = data.find(d => d.name === "Host PC")
                if (hostDevice && !selectedDevice) {
                    setSelectedDevice(hostDevice)
                    // If device has city "Local" or specific city, select it to view graph
                    if (hostDevice.city) setSelectedCity(hostDevice.city)
                }
            })
            .catch(err => console.error("Failed to fetch devices", err))
    }

    useEffect(() => {
        // Auth Check
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        fetchDevices()

        function onConnect() { setIsConnected(true) }
        function onDisconnect() { setIsConnected(false) }
        function onDeviceUpdate(event) {
            console.log("Socket Event Received:", event); // DEBUG LOG

            if (event.type === 'device.telemetry') {
                const receivedData = event.data;
                console.log("Telemetry Data:", receivedData); // DEBUG LOG

                setDeviceData(current => {
                    const newData = [...current, {
                        time: new Date(receivedData.timestamp * 1000).toLocaleTimeString(),
                        device_id: receivedData.device_id,
                        city: receivedData.city, // Ensure city is passed
                        ...receivedData
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
    }, [navigate])

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

    // Debug Chart Data
    if (selectedDevice && filteredData.length === 0 && deviceData.length > 0) {
        console.warn("Filtered data is empty but global data exists. Check device_id matching.",
            { selectedId: selectedDevice.device_id, sampleDataId: deviceData[0].device_id });
    }

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Cloud Native Monitoring Dashboard</h1>
                <button onClick={handleLogout} style={{ background: '#ef4444', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>Logout</button>
            </div>

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

            {/* SYSTEM STATS CARDS (CPU/RAM/DISK) - Only if Device Selected */}
            {selectedDevice && (
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                    <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', padding: '15px', borderRadius: '8px' }}>
                        <h3 style={{ color: '#a78bfa', margin: '0 0 10px 0' }}>CPU Usage</h3>
                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
                            {latestTelemetry ? `${latestTelemetry.cpu_usage}%` : '...'}
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{ width: latestTelemetry ? `${latestTelemetry.cpu_usage}%` : '0%', height: '100%', background: '#8b5cf6', transition: 'width 0.5s' }}></div>
                        </div>
                    </div>

                    <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '15px', borderRadius: '8px' }}>
                        <h3 style={{ color: '#fbbf24', margin: '0 0 10px 0' }}>RAM Usage</h3>
                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
                            {latestTelemetry ? `${latestTelemetry.ram_usage}%` : '...'}
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{ width: latestTelemetry ? `${latestTelemetry.ram_usage}%` : '0%', height: '100%', background: '#f59e0b', transition: 'width 0.5s' }}></div>
                        </div>
                    </div>

                    <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                        <h3 style={{ color: '#34d399', margin: '0 0 10px 0' }}>Disk Usage</h3>
                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
                            {latestTelemetry ? `${latestTelemetry.disk_usage || 0}%` : '...'}
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{ width: latestTelemetry ? `${latestTelemetry.disk_usage || 0}%` : '0%', height: '100%', background: '#10b981', transition: 'width 0.5s' }}></div>
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

                            // Inline Editing Mode
                            if (editingId === d.device_id) {
                                return (
                                    <li key={d.device_id} className="device-item" style={{ borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)' }}>
                                        <div className="add-device-form" style={{ border: 'none', margin: 0, padding: 0 }}>
                                            <input
                                                value={editFormData.name}
                                                onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                                placeholder="Name"
                                            />
                                            <select
                                                value={editFormData.city}
                                                onChange={e => setEditFormData({ ...editFormData, city: e.target.value })}
                                                style={{ width: '100%', padding: '0.6rem', margin: '5px 0', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                            >
                                                {PREDEFINED_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <select
                                                value={editFormData.type}
                                                onChange={e => setEditFormData({ ...editFormData, type: e.target.value })}
                                                style={{ width: '100%', padding: '0.6rem', margin: '5px 0', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                            >
                                                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                                <button onClick={handleUpdateDevice} style={{ background: '#10b981', flex: 1 }}>Save</button>
                                                <button onClick={cancelEdit} style={{ background: '#64748b', flex: 1 }}>Cancel</button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            }

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

                                    {d.city !== 'Local' && (
                                        <div className="device-actions" style={{ gap: '0.5rem' }}>
                                            <button className="delete-btn" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={(e) => startEdit(e, d)}>Edit</button>
                                            <button className="delete-btn" onClick={(e) => handleDeleteDevice(e, d.device_id)}>Delete</button>
                                        </div>
                                    )}
                                    {d.city === 'Local' && (
                                        <div className="device-actions">
                                            <span style={{ fontSize: '0.8em', color: '#64748b', fontStyle: 'italic' }}>System Device (Protected)</span>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>

                    {/* Add Device Form - Hidden for Local */}
                    {newDevice.city !== 'Local' && selectedCity !== 'Local' && (
                        <div className="add-device-form">
                            <h3>Add New Device in {newDevice.city}</h3>
                            <input
                                placeholder="Device Name"
                                value={newDevice.name}
                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                            />
                            {/* Device Type Select */}
                            <select
                                value={newDevice.type}
                                onChange={e => setNewDevice({ ...newDevice, type: e.target.value })}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                            >
                                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>

                            {/* Select for Predefined City */}
                            <select
                                value={newDevice.city}
                                onChange={e => setNewDevice({ ...newDevice, city: e.target.value })}
                                style={{ width: '100%', marginBottom: '10px', padding: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                            >
                                {PREDEFINED_CITIES.filter(c => c !== "Local").map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button onClick={handleCreateDevice}>+ Add Device</button>
                        </div>
                    )}
                    {(selectedCity === 'Local' || newDevice.city === 'Local') && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            Cannot add manual devices to Local System scope.
                        </div>
                    )}
                </div>

                <div className="card">
                    <h2>
                        {selectedDevice
                            ? `System Monitor: ${selectedDevice.name}`
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

                                {selectedDevice ? (
                                    <>
                                        <Line type="monotone" dataKey="cpu_usage" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="CPU (%)" />
                                        <Line type="monotone" dataKey="ram_usage" stroke="#f59e0b" strokeWidth={2} dot={false} name="RAM (%)" />
                                        <Line type="monotone" dataKey="disk_usage" stroke="#10b981" strokeWidth={2} dot={false} name="Disk (%)" />
                                    </>
                                ) : (
                                    <>
                                        <Line type="monotone" dataKey="temperature" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp (°C)" />
                                        <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} name="Humidity (%)" />
                                    </>
                                )}
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

export default Dashboard
