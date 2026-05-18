import React, { useState, useEffect } from 'react';
import { useAuth, AuthProvider } from '@/services/AuthContext';
import Dashboard from '@/components/Dashboard';
import { Toaster } from 'sonner';
import Reader from '@/components/Reader';
import AuthPage from '@/components/AuthPage';
import Onboarding from '@/components/Onboarding';
import { ReadingDocument, documentService } from '@/services/firestoreService';
import { BookOpen, LogOut, User as UserIcon, Wind, Sparkles, Highlighter, BrainCircuit, StickyNote, GraduationCap, BookMarked, Users, Library, Plus, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

function WindyuApp() {
  const { user, logout, loading } = useAuth();
  const [selectedDoc, setSelectedDoc] = useState<ReadingDocument | null>(null);
  const [activeTab, setActiveTab] = useState('library');
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const [docsCount, setDocsCount] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      const unsub = documentService.subscribe(user.uid, (docs) => {
        setDocsCount(docs.length);
      }, (err) => {
        console.error("Firestore subscription error:", err);
        setDocsCount(0); // Fallback to 0 if there's an error
      });
      return unsub;
    } else {
      setDocsCount(null); // Reset docsCount when user logs out
    }
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#fdfcfb]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Wind className="w-12 h-12 text-slate-400" />
        </motion.div>
      </div>
    );
  }

  // Simplified logic: If user is logged in, show dashboard even if docs haven't loaded yet
  // Dashboard will show its own loading states
  if (user) {
    if (docsCount === 0) {
      return <Onboarding userId={user.uid} onComplete={() => setDocsCount(1)} />;
    }
    
    return (
      <div className="h-screen flex flex-col bg-[#fdfcfb] overflow-hidden font-sans">
        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!selectedDoc ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full"
              >
                <Dashboard onSelectDoc={setSelectedDoc} activeTab={activeTab} />
              </motion.div>
            ) : (
              <motion.div
                key="reader"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <Reader doc={selectedDoc} onBack={() => setSelectedDoc(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  if (showAuth) {
    return <AuthPage onBack={() => setShowAuth(false)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col overflow-x-hidden">
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-20 flex items-center justify-between px-8 bg-transparent max-w-7xl mx-auto w-full z-40 shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center transform -rotate-3 shadow-lg shadow-slate-200">
            <Wind className="text-white w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight font-display ml-1">Windyu</span>
        </div>
        
        <div className="relative">
          <Button 
            onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
            variant="ghost"
            size="icon"
            className={cn(
              "w-10 h-10 rounded-full bg-white border border-slate-100 shadow-sm text-slate-600 transition-all active:scale-95",
              isAuthMenuOpen && "bg-slate-900 text-white border-slate-900"
            )}
          >
            <UserIcon className="w-5 h-5" />
          </Button>
          
          <AnimatePresence>
            {isAuthMenuOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsAuthMenuOpen(false)}
                  className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40"
                />
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="fixed inset-y-0 right-0 w-full sm:w-80 bg-white shadow-2xl z-50 p-8 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-2">
                      <Wind className="w-5 h-5 text-slate-900" />
                      <span className="text-xl font-bold font-display">Windyu</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsAuthMenuOpen(false)} className="rounded-full">
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 px-4">Account</p>
                    <button 
                      onClick={() => { setShowAuth(true); setIsAuthMenuOpen(false); }}
                      className="w-full px-4 py-4 text-left text-lg font-bold text-slate-900 hover:bg-slate-50 rounded-2xl transition-all flex items-center justify-between group"
                    >
                      Sign in
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900 transition-all group-hover:translate-x-1" />
                    </button>
                    <button 
                      onClick={() => { setShowAuth(true); setIsAuthMenuOpen(false); }}
                      className="w-full px-4 py-4 text-left text-lg font-bold text-blue-600 hover:bg-blue-50/50 rounded-2xl transition-all flex items-center justify-between group"
                    >
                      Create account
                      <ChevronRight className="w-5 h-5 text-blue-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                    </button>
                  </div>

                  <div className="mt-auto pt-12 border-t border-slate-100">
                     <div className="flex gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <button className="hover:text-slate-900 transition-colors">Privacy</button>
                        <button className="hover:text-slate-900 transition-colors">Terms</button>
                     </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col md:flex-row items-center p-8 md:p-24 gap-16 max-w-7xl mx-auto w-full">
        <div className="flex-1 space-y-10 text-center md:text-left">
          <motion.h1 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 }}
             className="text-6xl lg:text-8xl font-display font-medium text-slate-900 leading-[0.95] tracking-tighter"
           >
             Master your studies <br />
             <span className="relative inline-block overflow-hidden pb-2">
              <motion.span 
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="human-serif text-slate-400 block italic"
              >
                with ease.
              </motion.span>
              <motion.div 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.2, duration: 0.8, ease: "circOut" }}
                className="absolute bottom-1 left-0 right-0 h-px bg-slate-200 origin-left"
              />
            </span>
           </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-500 max-w-md mx-auto md:mx-0 leading-relaxed"
          >
            Capture, organize, and synthesize your learning with a tool that feels more like a journal than a software.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-6 justify-center md:justify-start pt-4"
          >
            <Button 
              onClick={() => setShowAuth(true)}
              size="lg" 
              className="h-16 px-12 text-lg bg-slate-900 hover:bg-black text-white font-bold rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)] transition-all active:scale-95"
            >
              Try Windyu
            </Button>
            <Button 
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              variant="outline"
              size="lg"
              className="h-16 px-12 text-lg bg-white hover:bg-slate-50 text-slate-900 border border-slate-100 font-bold rounded-2xl shadow-sm transition-all active:scale-95"
            >
              Learn more
            </Button>
          </motion.div>
        </div>

        {/* Visual Element */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="flex-1 w-full relative"
        >
          <motion.div 
            animate={{ y: [0, -15, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="aspect-square bg-slate-50 rounded-[40px] border border-slate-100 flex items-center justify-center p-8 overflow-hidden"
          >
             <div className="w-full h-full bg-white rounded-3xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.12)] border border-slate-100 p-10 space-y-6">
                <div className="h-4 w-1/3 bg-slate-50 rounded-full"></div>
                <div className="h-10 w-1/2 bg-orange-50/50 rounded-xl"></div>
                <div className="space-y-3 pt-6">
                  <div className="h-3.5 w-full bg-slate-50 rounded-full"></div>
                  <div className="h-3.5 w-full bg-slate-50 rounded-full opacity-80"></div>
                  <div className="h-3.5 w-3/4 bg-slate-50 rounded-full opacity-60"></div>
                </div>
                <div className="pt-10 flex gap-4">
                  <div className="h-12 flex-1 bg-slate-900 rounded-2xl shadow-xl"></div>
                  <div className="h-12 flex-1 border border-slate-200 rounded-2xl"></div>
                </div>
             </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Features Minimal Grid */}
      <section id="how-it-works" className="bg-white py-32 px-8 border-t border-slate-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16">
          {[
            { icon: Highlighter, title: "Study Help", desc: "Highlight what matters most and keep those sparks of insight forever." },
            { icon: BrainCircuit, title: "AI Tutor", desc: "Our AI helps explain complex topics as if you're talking to a mentor." },
            { icon: StickyNote, title: "My Library", desc: "Build a library of your own thoughts, linked to every text you read." }
          ].map((feature, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.1 }}
              className="space-y-6"
            >
              <div className="w-14 h-14 bg-[#fdfcfb] rounded-2xl flex items-center justify-center text-slate-900 border border-slate-100 shadow-sm">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-display font-medium text-slate-900">{feature.title}</h3>
              <p className="text-slate-500 text-base leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* How to Use Section */}
        <div className="pt-40 pb-12 max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl lg:text-5xl font-display font-medium text-slate-900 tracking-tight mb-6">
              Mastering <span className="relative inline-block overflow-hidden px-1">
                <motion.span 
                  initial={{ y: "100%", opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  className="human-serif text-slate-400 block italic leading-none"
                >
                  Windyu
                </motion.span>
              </span>
            </h2>
            <p className="text-xl text-slate-500 max-w-lg mx-auto">
              A simple framework to transform raw information into structured knowledge.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                title: "Add Files",
                desc: "Paste your source material—lectures, research, or notes—into your library.",
                icon: Plus,
                color: "bg-slate-50 text-slate-900"
              },
              {
                step: "02",
                title: "Read",
                desc: "Open any document for a distraction-free, focused reading experience.",
                icon: BookOpen,
                color: "bg-blue-50 text-blue-700"
              },
              {
                step: "03",
                title: "Learn",
                desc: "Leverage AI to extract core themes, summarize, and bridge concepts.",
                icon: Sparkles,
                color: "bg-purple-50 text-purple-700"
              },
              {
                step: "04",
                title: "Master",
                desc: "Organize your insights into courses and build your intellectual legacy.",
                icon: GraduationCap,
                color: "bg-emerald-50 text-emerald-700"
              }
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -10 }}
                className="relative group p-8 rounded-[32px] bg-white border border-slate-100 hover:border-slate-200 hover:shadow-2xl hover:shadow-slate-200/40 transition-all cursor-default"
              >
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-full flex items-center justify-center text-[10px] font-black text-slate-300 border border-slate-100 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-800 transition-colors shadow-sm">
                  {item.step}
                </div>
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", item.color)}>
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-display font-medium text-slate-900 mb-4">{item.title}</h3>
                <p className="text-slate-500 text-base leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Want to learn more section */}
        <div className="pt-40 max-w-7xl mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              <div className="space-y-4">
                <h2 className="text-4xl font-display font-medium text-slate-900 tracking-tight">
                  Want to learn more?
                </h2>
                <p className="text-xl text-slate-500">
                  Here are some answers to common questions.
                </p>
              </div>
              <div className="space-y-2">
                {[
                  "What makes Windyu different from other AI-powered note-taking apps?",
                  "What are the main advantages of Windyu compared to other AI learning apps?",
                  "I use both iOS and Android devices. Can Windyu be used across operating systems?",
                  "Does my work in Windyu sync in real-time between my phone and computer?",
                  "How do I report a result in Windyu that I believe creates a safety concern or is inappropriate?"
                ].map((q, i) => (
                  <button key={i} className="w-full group flex items-center justify-between p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all border border-transparent text-left">
                    <span className="text-sm font-medium text-slate-700 leading-relaxed max-w-[85%]">{q}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
           </div>
        </div>

        <footer className="mt-40 pt-12 pb-24 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 grayscale brightness-50 opacity-40">
            <Wind className="w-5 h-5 text-slate-900" />
            <span className="text-sm font-bold text-slate-900 tracking-tight font-display">Windyu</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      <WindyuApp />
    </AuthProvider>
  );
}
