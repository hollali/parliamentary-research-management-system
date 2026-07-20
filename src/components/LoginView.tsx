import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { forgotPassword, resetPasswordWithToken } from '../lib/api';
import { Shield, BookOpen, Mail, Lock, Eye, EyeOff, Gavel, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setShowReset(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      onLoginSuccess();
    } else {
      setError('Invalid credentials.');
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    setError('');
    const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || (import.meta.env.DEV ? 'password123' : undefined);
    if (!demoPassword) {
      setError('Demo logins are not available in production.');
      setLoading(false);
      return;
    }
    const success = await login(demoEmail, demoPassword);
    setLoading(false);
    if (success) {
      onLoginSuccess();
    } else {
      setError('Demo login failed. Is the backend running?');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetPassword || !resetConfirm) {
      setResetError('Please fill in all fields');
      return;
    }
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match');
      return;
    }
    setResetLoading(true);
    try {
      await resetPasswordWithToken(resetToken, resetPassword);
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f9fa] relative overflow-hidden font-sans">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 z-0 bg-blue-100/50 overflow-hidden">
        <div className="absolute inset-0 bg-[#001551] opacity-90" 
             style={{
               backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)',
               backgroundSize: '32px 32px'
             }} 
        />
        {/* Subtle Ambient Gradients */}
        <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-[#b7c4ff] opacity-25 blur-[120px] rounded-full" />
        <div className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-[#d5e3fd] opacity-25 blur-[120px] rounded-full" />
      </div>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-300 flex items-stretch min-h-175 shadow-2xl rounded-xl overflow-hidden mx-4 md:mx-10 bg-white">
        
        {/* Left Column: Institutional Branding */}
        <section className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-[#3a485c] text-white">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center p-0.5 shadow-lg">
                <img 
                  src="/logo.png" 
                  alt="Parliament of Ghana Seal" 
                  className="w-11 h-11 object-contain"
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight text-white leading-none">PRRMS</h1>
                <p className="text-xs uppercase tracking-widest text-gray-300 mt-1 font-semibold">Parliamentary Research</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-bold leading-tight text-white">
              Securing the future of legislative insight.
            </h2>
            <p className="text-base text-gray-300 leading-relaxed max-w-md">
              Access the unified management system for parliamentary research projects, statistics, and legislative briefs.
            </p>
          </div>

          <div className="pt-8 border-t border-gray-500/30">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-[#1d4ed8] flex items-center justify-center text-white shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">High-Security Environment</p>
                <p className="text-xs text-gray-300">Authenticated sessions only</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Portal Login Form */}
        <section className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="max-w-100 mx-auto w-full space-y-6">
            
            {/* Mobile Branding */}
            <div className="lg:hidden flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center p-0.5 shadow-md">
                <img 
                  src="/logo.png" 
                  alt="Parliament of Ghana Seal" 
                  className="w-9 h-9 object-contain"
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div>
                <h1 className="font-sans font-bold text-lg text-gray-900 leading-none">PRRMS</h1>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Research Management</p>
              </div>
            </div>

            <header>
              <h2 className="text-2xl font-bold text-[#191c1d] mb-1">{showReset ? 'Set New Password' : showForgot ? 'Reset Password' : 'Portal Login'}</h2>
              <p className="text-sm text-[#434655]">
                {showReset
                  ? 'Enter your new password below.'
                  : showForgot
                    ? 'Enter your registered email to receive a password reset link.'
                    : 'Enter your official credentials to access the system.'}
              </p>
            </header>

            {error && (
              <div className="bg-[#ffdad6] text-[#93000a] p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            {showReset ? (
              resetSent ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs font-semibold space-y-1">
                    <p className="font-bold">Password reset successful</p>
                    <p>Your password has been updated. You can now log in with your new password.</p>
                  </div>
                  <button
                    onClick={() => { setShowReset(false); setResetToken(''); setResetPassword(''); setResetConfirm(''); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0037b0] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {resetError && (
                    <div className="bg-[#ffdad6] text-[#93000a] p-3 rounded-lg text-xs font-semibold">
                      {resetError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2" htmlFor="reset-password">
                      <Lock className="w-4 h-4 text-[#747686]" />
                      New Password
                    </label>
                    <input
                      id="reset-password"
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full px-4 py-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg focus:ring-2 focus:ring-[#0037b0] outline-none text-sm font-sans"
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2" htmlFor="reset-confirm">
                      <Lock className="w-4 h-4 text-[#747686]" />
                      Confirm Password
                    </label>
                    <input
                      id="reset-confirm"
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full px-4 py-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg focus:ring-2 focus:ring-[#0037b0] outline-none text-sm font-sans"
                      required
                      minLength={8}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#0037b0] hover:bg-[#1d4ed8] text-white py-3.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setResetToken(''); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0037b0] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                </form>
              )
            ) : showForgot ? (
              forgotSent ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs font-semibold space-y-1">
                    <p className="font-bold">Reset link sent</p>
                    <p>If an account exists with <span className="font-bold">{forgotEmail}</span>, a password reset link has been sent. Check your inbox and follow the instructions.</p>
                  </div>
                  <button
                    onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0037b0] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2" htmlFor="forgot-email">
                      <Mail className="w-4 h-4 text-[#747686]" />
                      Registered Email Address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@parliament.gov"
                      className="w-full px-4 py-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg focus:ring-2 focus:ring-[#0037b0] outline-none text-sm font-sans"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-[#0037b0] hover:bg-[#1d4ed8] text-white py-3.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setForgotEmail(''); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#0037b0] hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                  </button>
                </form>
              )
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2" htmlFor="email">
                  <Mail className="w-4 h-4 text-[#747686]" />
                  Email Address
                </label>
                <input 
                  id="email"
                  type="email" 
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="name@parliament.gov" 
                  className="w-full px-4 py-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg focus:ring-2 focus:ring-[#0037b0] outline-none text-sm font-sans"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-2" htmlFor="password">
                    <Lock className="w-4 h-4 text-[#747686]" />
                    Password
                  </label>
                  <a href="#forgot" className="text-xs text-[#0037b0] hover:underline" onClick={(e) => { e.preventDefault(); setShowForgot(true); }}>Forgot password?</a>
                </div>
                <div className="relative">
                  <input 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full px-4 py-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg focus:ring-2 focus:ring-[#0037b0] outline-none text-sm font-sans"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-[#0037b0] hover:bg-[#1d4ed8] text-white py-3.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Authenticate & Access'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            )}

            {!showForgot && (
            <>
            {/* Quick Demo Logins block */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2.5">
              <h4 className="text-xs font-bold text-[#0039b5] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Select Role to Evaluate:
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <button 
                  onClick={() => handleDemoLogin('admin@parliament.gh')}
                  className="flex justify-between items-center bg-white hover:bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 transition-colors text-left text-xs font-medium"
                >
                  <div>
                    <p className="text-gray-900 font-bold">Admin Officer</p>
                    <p className="text-gray-500 text-[10px]">Kwame Asante (Admin)</p>
                  </div>
                  <span className="text-[10px] bg-[#dce1ff] text-[#0039b5] px-2 py-0.5 rounded-full font-bold">Admin Panel</span>
                </button>

                <button 
                  onClick={() => handleDemoLogin('kofi.osei@parliament.gh')}
                  className="flex justify-between items-center bg-white hover:bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 transition-colors text-left text-xs font-medium"
                >
                  <div>
                    <p className="text-gray-900 font-bold">Research Officer</p>
                    <p className="text-gray-500 text-[10px]">Kofi Osei</p>
                  </div>
                  <span className="text-[10px] bg-[#7ffc97]/20 text-[#00501f] px-2 py-0.5 rounded-full font-bold">Workspace</span>
                </button>

                <button 
                  onClick={() => handleDemoLogin('hon.boateng@parliament.gh')}
                  className="flex justify-between items-center bg-white hover:bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 transition-colors text-left text-xs font-medium"
                >
                  <div>
                    <p className="text-gray-900 font-bold">Honorable Member</p>
                    <p className="text-gray-500 text-[10px]">Hon. Emmanuel Boateng</p>
                  </div>
                  <span className="text-[10px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">Portal Form</span>
                </button>
              </div>
            </div>

            {/* Disclaimer Section */}
            <footer className="pt-6 border-t border-[#c4c5d7] mt-8">
              <div className="flex items-start space-x-3">
                <Gavel className="w-5 h-5 text-[#ba1a1a] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#191c1d]">Official Government Use Only</p>
                  <p className="text-[10px] text-[#434655] leading-relaxed">
                    This is a restricted computer system. All activity is logged and subject to auditing. Unauthorized access or use is prohibited and may be subject to criminal and/or civil penalties. By logging in, you agree to the Terms of Service and Privacy Policy.
                  </p>
                </div>
              </div>
              <div className="flex justify-center items-center text-gray-400 mt-6 pt-4 border-t border-gray-100">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider">Secure Session</span>
                </div>
              </div>
            </footer>
            </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
