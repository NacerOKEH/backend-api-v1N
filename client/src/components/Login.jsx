import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [isLogin, setIsLogin] = useState(true); // Toggle Login/Signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        const endpoint = isLogin ? '/users/auth' : '/users/add';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                if (isLogin) {
                    // Login Success
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.payload));
                    navigate('/dashboard');
                } else {
                    // Register Success
                    setSuccessMsg('Account created successfully! Please Sign In.');
                    setIsLogin(true); // Switch back to login
                    setEmail('');
                    setPassword('');
                }
            } else {
                // Handle complex error messages (e.g., Pydantic validation errors)
                let errorMsg = 'An error occurred';
                if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                } else if (Array.isArray(data.detail)) {
                    // Pydantic returns an array of errors
                    errorMsg = data.detail.map(err => err.msg).join(', ');
                } else if (typeof data.detail === 'object') {
                    errorMsg = JSON.stringify(data.detail);
                }
                setError(errorMsg || (isLogin ? 'Login failed' : 'Registration failed'));
            }
        } catch (err) {
            console.error("Auth error:", err);
            setError('Network error. Check if authentication service is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white'
        }}>
            <div className="card" style={{ width: '400px', textAlign: 'center' }}>
                <h2 style={{ marginBottom: '2rem', color: '#3b82f6' }}>{isLogin ? 'Sign In' : 'Create Account'}</h2>

                {error && <div style={{ color: '#ef4444', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}
                {successMsg && <div style={{ color: '#10b981', marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{successMsg}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #475569', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '0.8rem',
                            borderRadius: '4px',
                            border: 'none',
                            background: loading ? '#64748b' : '#3b82f6',
                            color: 'white',
                            fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isLogin ? 'Sign Up' : 'Sign In'}
                    </span>
                </div>

                {isLogin && (
                    <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                        <p>Demo: admin@admin.com / 1234</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Login;
