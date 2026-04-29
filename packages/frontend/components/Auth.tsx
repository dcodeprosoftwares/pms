'use client';

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!propertyName) throw new Error('Please enter your property name.');
        if (!mobile || mobile.length < 10) throw new Error('Please enter a valid mobile number.');

        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
              mobile: mobile,
              property_name: propertyName
            }
          }
        });
        if (error) throw error;
        setIsSuccess(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-container">
        <div className="auth-card-wrapper">
          <div className="auth-card success-card">
            <div className="success-icon">📧</div>
            <h1 className="auth-title">Verify Your Email</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Registration successful! Please verify your mail id from mail inbox to activate your account.
            </p>
            <button 
              className="auth-submit-btn" 
              onClick={() => { setIsSuccess(false); setIsSignUp(false); }}
            >
              Back to Login
            </button>
          </div>
        </div>
        <style jsx>{`
          .auth-container {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #f8fafc;
            padding: 24px;
          }
          .auth-card-wrapper {
            width: 100%;
            max-width: 440px;
            animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .auth-card {
            background: white;
            border-radius: 24px;
            padding: 48px 40px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            text-align: center;
          }
          .success-icon {
            font-size: 64px;
            margin-bottom: 24px;
          }
          .auth-title {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 12px;
          }
          .auth-subtitle {
            font-size: 15px;
            color: #64748b;
            line-height: 1.6;
          }
          .auth-submit-btn {
            background: #0f172a;
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 24px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-container">
              <img 
                src="/weazy-logo.png" 
                alt="Weazy Logo" 
                className="auth-logo"
              />
            </div>
            <h1 className="auth-title">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="auth-subtitle">
              {isSignUp 
                ? 'Join Weazy Cloud PMS and grow your business' 
                : 'Enter your credentials to manage your property'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {isSignUp && (
              <div className="input-group">
                <label className="input-label">Property Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">🏨</span>
                  <input 
                    type="text" 
                    placeholder="e.g. Grand Weazy Resort" 
                    value={propertyName}
                    onChange={(e) => setPropertyName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input 
                  type="email" 
                  placeholder="name@hotel.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {isSignUp && (
              <div className="input-group">
                <label className="input-label">Mobile Number</label>
                <div className="input-wrapper">
                  <span className="input-icon">📱</span>
                  <input 
                    type="tel" 
                    placeholder="+91 98765 43210" 
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input 
                  type="password" 
                  placeholder={isSignUp ? "Choose Password for future login" : "••••••••"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className={`auth-submit-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <span className="loader" />
              ) : (
                isSignUp ? 'Get Started Free' : 'Sign In'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isSignUp ? 'Already have an account?' : 'New to Weazy?'}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="auth-toggle-btn"
              >
                {isSignUp ? 'Sign In' : 'Register Now'}
              </button>
            </p>
          </div>
        </div>
        
        <div className="auth-bottom-links">
          <span>&copy; 2026 Weazy Cloud Technologies</span>
          <span className="separator">•</span>
          <span>Privacy Policy</span>
          <span className="separator">•</span>
          <span>Terms of Service</span>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f8fafc;
          background-image: 
            radial-gradient(#e2e8f0 1px, transparent 1px), 
            radial-gradient(#e2e8f0 1px, transparent 1px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          position: relative;
          padding: 24px;
        }

        .auth-card-wrapper {
          width: 100%;
          max-width: 440px;
          animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .auth-card {
          background: white;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 
            0 1px 3px 0 rgba(0, 0, 0, 0.1), 
            0 1px 2px 0 rgba(0, 0, 0, 0.06),
            0 20px 25px -5px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-logo-container {
          width: 72px;
          height: 72px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: #f1f5f9;
          padding: 12px;
        }

        .auth-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .auth-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }

        .auth-subtitle {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          margin-left: 2px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          font-size: 16px;
          opacity: 0.5;
        }

        .input-wrapper input {
          width: 100%;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px 12px 42px;
          color: #0f172a;
          font-size: 15px;
          transition: all 0.2s;
        }

        .input-wrapper input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
        }

        .auth-error {
          background: #fff1f2;
          border: 1px solid #fecdd3;
          padding: 12px;
          border-radius: 10px;
          color: #be123c;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .auth-submit-btn {
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-submit-btn:hover:not(:disabled) {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        }

        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .auth-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-footer {
          margin-top: 24px;
          text-align: center;
          color: #64748b;
          font-size: 14px;
        }

        .auth-toggle-btn {
          background: none;
          border: none;
          color: #6366f1;
          font-weight: 700;
          cursor: pointer;
          margin-left: 6px;
          transition: color 0.2s;
        }

        .auth-toggle-btn:hover {
          color: #4f46e5;
          text-decoration: underline;
        }

        .auth-bottom-links {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
          color: #94a3b8;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        .separator {
          opacity: 0.5;
        }

        .loader {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 480px) {
          .auth-card {
            padding: 32px 20px;
          }
        }
      `}</style>
    </div>
  );
}
