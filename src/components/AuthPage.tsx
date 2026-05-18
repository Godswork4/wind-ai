import React, { useState } from 'react';
import { useAuth } from '@/services/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'motion/react';
import { ChevronLeft, Mail, Lock, ArrowRight, Github } from 'lucide-react';

interface AuthPageProps {
  onBack: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onBack }) => {
  const { login, loginWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await login();
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcfb] flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]"></div>
      </div>

      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        className="absolute top-12 left-10 flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all uppercase tracking-[0.3em] text-[9px] font-black group"
      >
        <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
        Return to Sanctuary
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="text-center mb-16">
          <div className="w-16 h-16 bg-slate-900 rounded-[20px] flex items-center justify-center transform -rotate-3 mx-auto mb-10 shadow-2xl shadow-slate-200">
            <span className="text-white font-bold italic text-3xl">W</span>
          </div>
          <h1 className="text-6xl lg:text-8xl font-display font-medium text-slate-900 leading-[0.95] tracking-tighter mb-6 px-4">
            {isSignUp ? (
              <>Begin your <br />
                <span className="relative inline-block overflow-hidden px-1">
                  <motion.span 
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="human-serif text-slate-400 block italic leading-none pb-2"
                  >
                    journey.
                  </motion.span>
                </span>
              </>
            ) : (
              <>Welcome <br />
                <span className="relative inline-block overflow-hidden px-1">
                  <motion.span 
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                    className="human-serif text-slate-400 block italic leading-none pb-2"
                  >
                    back.
                  </motion.span>
                </span>
              </>
            )}
          </h1>
          <p className="text-xl text-slate-500 max-w-md mx-auto leading-relaxed font-sans font-normal px-4 opacity-90">
            {isSignUp 
              ? 'Join our community of scholars and start building your personal library of insights.' 
              : 'Return to your sanctuary and continue your process of mastery.'
            }
          </p>
        </div>

        <div className="pro-card p-10 sm:p-16 bg-white mx-auto max-w-md">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-5">
              <div className="relative group">
                <Mail className="absolute left-5 top-[18px] w-4 h-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-14 h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:ring-slate-900 focus:bg-white border-none shadow-inner text-base transition-all font-sans"
                  required
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-[18px] w-4 h-4 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-14 h-14 rounded-2xl border-slate-100 bg-slate-50/30 focus:ring-slate-900 focus:bg-white border-none shadow-inner text-base transition-all font-sans"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] text-center animate-pulse">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="pro-btn-primary w-full h-16 text-[10px] font-black uppercase tracking-[0.4em] shadow-xl shadow-slate-200 group"
            >
              {isLoading ? 'Authenticating...' : isSignUp ? 'Create Pulse' : 'Enter Space'}
              {!isLoading && <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="relative my-12">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase tracking-[0.4em] font-black">
              <span className="bg-white px-6 text-slate-300">Sanctuary Access</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            variant="outline"
            className="w-full h-16 rounded-2xl border-slate-100 hover:bg-slate-50 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center justify-center gap-4 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google Authenticator
          </Button>

          <p className="mt-10 text-center text-slate-400 text-[11px] font-medium tracking-tight">
            {isSignUp ? 'Already joined?' : 'New here?'}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 font-black text-slate-900 uppercase tracking-widest text-[10px] hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
