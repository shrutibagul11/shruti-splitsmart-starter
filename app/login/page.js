
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push('/');
        } else {
          setMessage(
            'Account created! Please check your email to confirm your account.'
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push('/');
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <form onSubmit={handleAuth} style={styles.card}>
        <div style={styles.logo}>S</div>

        <h1 style={styles.title}>SplitSmart</h1>

        <p style={styles.subtitle}>
          {isSignup
            ? 'Create your account to get started'
            : 'Welcome back! Log in to continue'}
        </p>

        <label style={styles.label}>Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          style={styles.input}
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          style={styles.input}
        />

        <button
          type="submit"
          disabled={loading}
          style={styles.button}
        >
          {loading
            ? 'Please wait...'
            : isSignup
              ? 'Create Account'
              : 'Log In'}
        </button>

        {message && <p style={styles.message}>{message}</p>}

        <p style={styles.switchText}>
          {isSignup
            ? 'Already have an account?'
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage('');
            }}
            style={styles.switchButton}
          >
            {isSignup ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    background: '#f4f7fb',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderRadius: 20,
    background: '#ffffff',
    boxShadow: '0 15px 45px rgba(0,0,0,0.08)',
  },
  logo: {
    width: 45,
    height: 45,
    margin: '0 auto',
    display: 'grid',
    placeItems: 'center',
    borderRadius: 13,
    background: '#2563eb',
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 800,
  },
  title: {
    textAlign: 'center',
    fontSize: 27,
    marginBottom: 5,
    color: '#172554',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 28,
    fontSize: 14,
  },
  label: {
    display: 'block',
    marginBottom: 7,
    fontSize: 14,
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    width: '100%',
    padding: 13,
    marginBottom: 20,
    border: '1px solid #cbd5e1',
    borderRadius: 9,
    fontSize: 15,
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: 14,
    border: 'none',
    borderRadius: 9,
    background: '#2563eb',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  message: {
    marginTop: 15,
    textAlign: 'center',
    color: '#2563eb',
    fontSize: 14,
  },
  switchText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    color: '#64748b',
  },
  switchButton: {
    marginLeft: 6,
    border: 'none',
    background: 'none',
    color: '#2563eb',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
