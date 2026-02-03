import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useNavigate } from 'react-router-dom';
import '../App.css'

// Connect to socket only once outside component to avoid multiple connections on re-renders, 
// OR handle connection inside useEffect carefully.
const socket = io('http://localhost:8002');

const PREDEFINED_CITIES = [
    "All", "Local", "Fes", "Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir",
    "Paris", "London", "New York", "Tokyo", "Berlin", "Madrid"
];

const DEVICE_TYPES = ["Sensor", "Actuator", "Server", "Gateway"];

function Dashboard() {
    const [deviceData, setDeviceData] = useState([])
    const [devices, setDevices] = useState([])
    const [isConnected, setIsConnected] = useState(socket.connected)

    const [selectedCity, setSelectedCity] = useState(PREDEFINED_CITIES[0])
    const [forecast, setForecast] = useState(null)

    // State for selected devices (Multi-select)
    const [selectedDevices, setSelectedDevices] = useState([])
    const [searchQuery, setSearchQuery] = useState('')

    const [newDevice, setNewDevice] = useState({ name: '', city: PREDEFINED_CITIES[0], type: 'Sensor' })

    // Edit Mode State
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});

    // ...



    const navigate = useNavigate();

    // Logout function
    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        navigate('/login');
    };

    // Sync Form City with Filter City for better UX
    useEffect(() => {
        if (selectedCity === 'All') {
            // Default to first valid city (Casablanca) if All is selected
            setNewDevice(prev => ({ ...prev, city: 'Casablanca' }))
        } else {
            setNewDevice(prev => ({ ...prev, city: selectedCity }))
        }
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
                // Remove from selection if deleted
                setSelectedDevices(prev => prev.filter(d => d.device_id !== id))
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

    const fetchDevices = (init = false) => {
        fetch('http://localhost:8001/devices/')
            .then(res => res.json())
            .then(data => {
                setDevices(data)
                // Auto-select "Host PC" only on initial load if registered and nothing selected
                if (init) {
                    const hostDevice = data.find(d => d.name === "Host PC")
                    if (hostDevice && selectedDevices.length === 0) {
                        setSelectedDevices([hostDevice])
                        // If device has city "Local" or specific city, select it to view graph
                        if (hostDevice.city) setSelectedCity(hostDevice.city)
                    }
                }
            })
            .catch(err => console.error("Failed to fetch devices", err))
    }

    useEffect(() => {
        // Auth Check
        const token = sessionStorage.getItem('token');
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
                // console.log("Telemetry Data:", receivedData); // DEBUG LOG - too noisy

                setDeviceData(current => {
                    const newData = [...current, {
                        time: new Date(receivedData.timestamp * 1000).toLocaleTimeString(),
                        device_id: receivedData.device_id,
                        city: receivedData.city, // Ensure city is passed
                        ...receivedData
                    }]
                    return newData.slice(-100) // Increase buffer size slightly for multi-graph
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
        // Use the most recently selected device's city, or the global selectedCity
        const targetCity = selectedDevices.length > 0 ? selectedDevices[selectedDevices.length - 1].city : selectedCity
        if (targetCity) {
            fetch(`http://localhost:8002/monitoring/predict/${targetCity}`)
                .then(res => res.json())
                .then(data => setForecast(data))
                .catch(err => console.error("Forecast error:", err))
        } else {
            setForecast(null); // Clear forecast if 'All' is selected or no specific device
        }
    }, [selectedCity, selectedDevices])

    // Click on Device Handler (Multi-select)
    const handleDeviceClick = (device) => {
        setSelectedDevices(prev => {
            const exists = prev.find(d => d.device_id === device.device_id)
            if (exists) {
                // Deselect
                return prev.filter(d => d.device_id !== device.device_id)
            } else {
                // Select (Add to array)
                // Only update city view if we are NOT in global 'All' mode
                if (device.city && selectedCity !== 'All') setSelectedCity(device.city)
                return [...prev, device]
            }
        })
    }

    // --- FILTER LOGIC ---
    // List Filter: Show only devices in selected city OR search query matches globally OR 'All' is selected
    const filteredDevices = searchQuery
        ? devices.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : (selectedCity === 'All' ? devices : devices.filter(d => d.city === selectedCity))

    const endDevices = filteredDevices.filter(d => d.city === 'Local');
    const iotDevices = filteredDevices.filter(d => d.city !== 'Local');


    // Helper to get latest telemetry for the FOCUSED device (last selected)
    const focusedDevice = selectedDevices.length > 0 ? selectedDevices[selectedDevices.length - 1] : null;

    const latestTelemetry = focusedDevice
        ? deviceData.filter(d => d.device_id === focusedDevice.device_id).slice(-1)[0]
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

            {/* City Filter Control & Search - Always visible if no device selected */}
            {selectedDevices.length === 0 && (
                <div className="filter-controls">
                    <div>
                        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by City: </label>
                        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
                            {/* Show PREDEFINED cities so user can navigate even if no devices */}
                            {PREDEFINED_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                        </select>
                    </div>

                    <div className="search-wrapper">
                        <input
                            type="text"
                            placeholder="🔍 Search device globally..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            )}

            {selectedDevices.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid #3b82f6', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        Monitoring <strong>{selectedDevices.length}</strong> device(s).
                        {focusedDevice && <span> Focused: <strong>{focusedDevice.name}</strong></span>}
                    </div>
                    <button onClick={() => setSelectedDevices([])} style={{ padding: '4px 12px', cursor: 'pointer', borderRadius: '4px', border: 'none', background: '#3b82f6', color: 'white' }}>Clear Selection</button>
                </div>
            )}




            <div className="grid">
                <div className="card">
                    <h2>Devices ({selectedCity})</h2>
                    {/* END DEVICES SECTION */}
                    {endDevices.length > 0 && (
                        <div className="device-category">
                            <div className="section-header">
                                <span style={{ fontSize: '1.2em' }}>💻</span>
                                <h3>End Devices (Local)</h3>
                            </div>
                            <ul>
                                {endDevices.map(d => {
                                    const isSelected = selectedDevices.some(sel => sel.device_id === d.device_id);
                                    const isFocused = focusedDevice?.device_id === d.device_id;
                                    const isOnline = d.status === 'ONLINE' || isSelected; // User Request: Display used (selected) devices as Online

                                    return (
                                        <li key={d.device_id}
                                            className={`device-item ${isSelected ? 'selected-device' : ''}`}
                                            onClick={() => handleDeviceClick(d)}
                                            style={{
                                                cursor: 'pointer',
                                                borderColor: isFocused ? '#8b5cf6' : (isSelected ? '#3b82f6' : 'var(--border-color)'),
                                                borderWidth: isFocused ? '2px' : '1px',
                                                background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)'
                                            }}>
                                            <div className="device-header">
                                                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                                                <strong>{d.name}</strong>
                                                <span className="device-status" style={{ color: isOnline ? '#10b981' : '#64748b' }}>
                                                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                            <div className="device-details">
                                                <div className="detail-row"><span>City:</span> <small>{d.city}</small></div>
                                                <div className="detail-row"><span>OS:</span> <small>Windows</small></div>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}

                    {/* IOT DEVICES SECTION */}
                    <div className="device-category">
                        {iotDevices.length > 0 && (
                            <div className="section-header">
                                <span style={{ fontSize: '1.2em' }}>📡</span>
                                <h3>IoT Devices</h3>
                            </div>
                        )}

                        <ul>
                            {filteredDevices.length === 0 && <p style={{ opacity: 0.5, fontStyle: 'italic' }}>No devices in {selectedCity}</p>}

                            {iotDevices.map(d => {
                                const isSelected = selectedDevices.some(sel => sel.device_id === d.device_id);
                                const isFocused = focusedDevice?.device_id === d.device_id;
                                const isOnline = d.status === 'ONLINE' || isSelected;

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
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: isFocused ? '#8b5cf6' : (isSelected ? '#3b82f6' : 'var(--border-color)'),
                                            borderWidth: isFocused ? '2px' : '1px',
                                            background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)'
                                        }}
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
                    </div>

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
                                {PREDEFINED_CITIES.filter(c => c !== "Local" && c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
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

                <div className="card-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* GLOBAL FORECAST OR OVERVIEW WHEN NOTHING SELECTED */}
                    {selectedDevices.length === 0 && (
                        <div className="card">
                            <h2>
                                {selectedCity === 'All' ? "Global Overview" : `Hourly Forecast & Overview (${selectedCity})`}
                            </h2>
                            <div style={{ width: '100%', height: 300 }}>
                                {forecast?.hourly_forecast ? (
                                    <ResponsiveContainer>
                                        <LineChart data={forecast.hourly_forecast}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                            <Line type="monotone" dataKey="temperature" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp (°C)" />
                                            <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} name="Humidity (%)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                        {selectedCity === 'All' ? 'Select a city or device to see metrics' : 'Loading forecast...'}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* MULTI-CHART RENDERER */}
                    {selectedDevices.map(device => {
                        const deviceSpecificData = deviceData.filter(d => d.device_id === device.device_id);
                        const lastData = deviceSpecificData.length > 0 ? deviceSpecificData[deviceSpecificData.length - 1] : null;

                        return (
                            <div className="card" key={device.device_id} style={{ borderLeft: focusedDevice?.device_id === device.device_id ? '4px solid #8b5cf6' : '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2>
                                        System Monitor: {device.name}
                                        <span style={{ fontSize: '0.6em', marginLeft: '10px', color: '#94a3b8', fontWeight: 'normal' }}>({device.city})</span>
                                    </h2>
                                </div>

                                {/* PER-DEVICE STATS CARDS */}
                                {(() => {
                                    // Helper render function for cleaner JSX
                                    if (device.city === 'Local') {
                                        // Local Host PC -> System Stats
                                        return (
                                            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                                <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', padding: '15px', borderRadius: '8px' }}>
                                                    <h3 style={{ color: '#a78bfa', margin: '0 0 10px 0', fontSize: '0.9rem' }}>CPU Usage</h3>
                                                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.cpu_usage}%` : '...'}</div>
                                                </div>
                                                <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '15px', borderRadius: '8px' }}>
                                                    <h3 style={{ color: '#fbbf24', margin: '0 0 10px 0', fontSize: '0.9rem' }}>RAM Usage</h3>
                                                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.ram_usage}%` : '...'}</div>
                                                </div>
                                                <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                                                    <h3 style={{ color: '#34d399', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Disk Usage</h3>
                                                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.disk_usage || 0}%` : '...'}</div>
                                                </div>
                                            </div>
                                        )
                                    }

                                    switch (device.type) {
                                        case 'Server':
                                            return (
                                                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                                    <div className="stat-card" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Connected Users</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? lastData.connected_users : '...'}</div>
                                                    </div>
                                                    <div className="stat-card" style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid #ec4899', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#f472b6', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Active Processes</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? lastData.active_processes : '...'}</div>
                                                    </div>
                                                    <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#a78bfa', margin: '0 0 10px 0', fontSize: '0.9rem' }}>CPU Load</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.cpu_usage}%` : '...'}</div>
                                                    </div>
                                                </div>
                                            );
                                        case 'Actuator':
                                            return (
                                                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                                    <div className="stat-card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#fbbf24', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Power Usage</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.power_usage} W` : '...'}</div>
                                                    </div>
                                                    <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#34d399', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Status</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? (lastData.status ? 'ON' : 'OFF') : '...'}</div>
                                                    </div>
                                                </div>
                                            );
                                        case 'Gateway':
                                            return (
                                                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                                    <div className="stat-card" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Network In</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.network_in} Mbps` : '...'}</div>
                                                    </div>
                                                    <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#34d399', margin: '0 0 10px 0', fontSize: '0.9rem' }}>Network Out</h3>
                                                        <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#fff' }}>{lastData ? `${lastData.network_out} Mbps` : '...'}</div>
                                                    </div>
                                                </div>
                                            );
                                        case 'Sensor':
                                        default:
                                            return (
                                                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                                    <div className="stat-card" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#60a5fa', margin: '0 0 10px 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>Temperature</h3>
                                                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
                                                            {lastData ? `${lastData.temperature}°C` : '...'}
                                                        </div>
                                                    </div>
                                                    <div className="stat-card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '15px', borderRadius: '8px' }}>
                                                        <h3 style={{ color: '#34d399', margin: '0 0 10px 0', fontSize: '0.9rem', textTransform: 'uppercase' }}>Humidity</h3>
                                                        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#fff' }}>
                                                            {lastData ? `${lastData.humidity}%` : '...'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                    }
                                })()}

                                <div style={{ width: '100%', height: 250 }}>
                                    <ResponsiveContainer>
                                        <LineChart data={deviceSpecificData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#f1f5f9' }} />
                                            <Legend wrapperStyle={{ paddingTop: '10px' }} />

                                            {(() => {
                                                if (device.city === 'Local') {
                                                    return (
                                                        <>
                                                            <Line type="monotone" dataKey="cpu_usage" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="CPU (%)" />
                                                            <Line type="monotone" dataKey="ram_usage" stroke="#f59e0b" strokeWidth={2} dot={false} name="RAM (%)" />
                                                            <Line type="monotone" dataKey="disk_usage" stroke="#10b981" strokeWidth={2} dot={false} name="Disk (%)" />
                                                        </>
                                                    )
                                                }
                                                switch (device.type) {
                                                    case 'Server':
                                                        return (
                                                            <>
                                                                <Line type="monotone" dataKey="connected_users" stroke="#3b82f6" strokeWidth={2} dot={false} name="Users" />
                                                                <Line type="monotone" dataKey="active_processes" stroke="#ec4899" strokeWidth={2} dot={false} name="Processes" />
                                                            </>
                                                        )
                                                    case 'Actuator':
                                                        return (
                                                            <>
                                                                <Line type="monotone" dataKey="power_usage" stroke="#f59e0b" strokeWidth={2} dot={false} name="Power (W)" />
                                                                <Line type="step" dataKey="status" stroke="#10b981" strokeWidth={2} dot={false} name="State (1=ON)" />
                                                            </>
                                                        )
                                                    case 'Gateway':
                                                        return (
                                                            <>
                                                                <Line type="monotone" dataKey="network_in" stroke="#3b82f6" strokeWidth={2} dot={false} name="Net In (Mbps)" />
                                                                <Line type="monotone" dataKey="network_out" stroke="#10b981" strokeWidth={2} dot={false} name="Net Out (Mbps)" />
                                                            </>
                                                        )
                                                    case 'Sensor':
                                                    default:
                                                        return (
                                                            <>
                                                                <Line type="monotone" dataKey="temperature" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Temp (°C)" />
                                                                <Line type="monotone" dataKey="humidity" stroke="#10b981" strokeWidth={2} dot={false} name="Humidity (%)" />
                                                            </>
                                                        )
                                                }
                                            })()}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Weekly Forecast Section */}
            {forecast && forecast.weekly_forecast && (
                <div className="card" style={{ marginTop: '20px', overflowX: 'auto' }}>
                    <h2>7-Day Weather Forecast for {focusedDevice ? focusedDevice.city : selectedCity} (Open-Meteo)</h2>
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
