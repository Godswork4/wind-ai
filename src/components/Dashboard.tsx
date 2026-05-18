import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/services/AuthContext';
import { documentService, ReadingDocument, Course, courseService } from '@/services/firestoreService';
import { Plus, Book, Clock, Trash2, ChevronRight, Hash, GraduationCap, BookMarked, Users, Sparkles, BookOpen, Library, Menu, X, Send, User, Bot, History, LogOut, Mic, MicOff, Volume2, Wind, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface DashboardProps {
  onSelectDoc: (doc: ReadingDocument) => void;
  activeTab?: string;
}

export default function Dashboard({ onSelectDoc, activeTab = 'library' }: DashboardProps) {
  const { user, logout } = useAuth();
  const [docs, setDocs] = useState<ReadingDocument[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tutor' | 'files' | 'courses'>('tutor');

  // Courses State
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isWalkthroughActive, setIsWalkthroughActive] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  // Voice State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceReady, setIsVoiceReady] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState('');
  
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    const unsubDocs = documentService.subscribe(user.uid, setDocs);
    const unsubCourses = courseService.subscribe(user.uid, setCourses);
    return () => {
      unsubDocs();
      unsubCourses();
    };
  }, [user]);

  // Voice Mode Logic
  const startVoiceMode = async () => {
    try {
      setIsVoiceActive(true);
      setVoiceError(null);
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const libraryContext = docs.slice(0, 10).map(d => `--- DOCUMENT: ${d.title} ---\n${d.content}`).join('\n\n');
        ws.send(JSON.stringify({ setup: { libraryContext } }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'ready') {
          setIsVoiceReady(true);
          startMicCapture();
        } else if (data.audio) {
          playAudioChunk(data.audio);
        } else if (data.transcription) {
          setVoiceTranscription(data.transcription);
        } else if (data.interrupted) {
          // In actual implementation we'd clear the audio queue here
          nextStartTimeRef.current = audioCtx.currentTime;
        }
      };

      ws.onclose = () => stopVoiceMode();
      ws.onerror = (err) => {
        console.error("WS Error:", err);
        stopVoiceMode();
      };

    } catch (err) {
      console.error("Voice Mode Error:", err);
      stopVoiceMode();
    }
  };

  const startMicCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      if (!audioContextRef.current) return;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64 = pcmToBase64(inputData);
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        }
      };
    } catch (err) {
      console.error("Mic Capture Error:", err);
      setVoiceError(err instanceof Error ? err.message : String(err));
      if (wsRef.current) wsRef.current.close();
    }
  };

  const stopVoiceMode = () => {
    setIsVoiceActive(false);
    setIsVoiceReady(false);
    setVoiceTranscription('');
    setVoiceError(null);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const pcmToBase64 = (float32Array: Float32Array) => {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      pcm16[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff;
    }
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playAudioChunk = async (base64: string) => {
    if (!audioContextRef.current) return;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Convert back to Int16Array, then to Float32Array
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 0x7fff;
    }
    
    const buffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    
    const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const handleChat = async () => {
    if (!query.trim() || isAiLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsAiLoading(true);

    try {
      // Use library context for more relevant answers
      // Filter context based on selected course if in academy/walkthrough mode
      const relevantDocs = selectedCourseId 
        ? docs.filter(d => d.courseId === selectedCourseId)
        : docs.slice(0, 10);
        
      const libraryContext = relevantDocs.map(d => `--- DOCUMENT: ${d.title} ---\n${d.content}`).join('\n\n');
      
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, libraryContext })
      });

      const data = await res.json();
      
      if (data.response) {
        const aiMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newTitle || !newContent) return;
    await documentService.create(newTitle, newContent, newSourceUrl, selectedCourseId || '');
    setNewTitle('');
    setNewContent('');
    setNewSourceUrl('');
    setIsAdding(false);
  };

  const handleAddCourse = async () => {
    if (!newCourseTitle) {
      toast.error("Please enter a course title");
      return;
    }
    
    setIsCreatingCourse(true);
    try {
      await courseService.create(newCourseTitle, newCourseDesc);
      setNewCourseTitle('');
      setNewCourseDesc('');
      setIsAddingCourse(false);
      toast.success("Course created successfully");
    } catch (error) {
      toast.error("Failed to create course");
    } finally {
      setIsCreatingCourse(false);
    }
  };

  const handleDeleteCourse = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this course? All associated documents will remain but their course link will be broken.')) {
      try {
        await courseService.delete(id);
        if (selectedCourseId === id) setSelectedCourseId(null);
        toast.success("Course deleted");
      } catch (error) {
        toast.error("Failed to delete course");
      }
    }
  };

  const startWalkthrough = () => {
    if (!selectedCourseId) return;
    setMessages([{
      role: 'assistant',
      content: "Welcome to your AI Study Walkthrough! I've analyzed your course documents. Today we'll cover the core concepts step-by-step. Ready to begin?",
      timestamp: new Date()
    }]);
    setIsWalkthroughActive(true);
    setActiveView('tutor');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this document?')) {
      await documentService.delete(id);
    }
  };

  return (
    <div className="h-full bg-[#fdfcfb] flex relative overflow-hidden">
      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Courses View */}
        <AnimatePresence mode="wait">
          {activeView === 'courses' && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 bg-[#fdfcfb] z-20 overflow-y-auto px-4 py-32 md:px-12"
            >
              <div className="max-w-4xl mx-auto space-y-12">
                <header className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100">
                      <GraduationCap className="w-3 h-3 text-blue-600" />
                      <span className="text-[8px] font-black uppercase tracking-[0.3em] text-blue-600">My Courses</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsAddingCourse(true)}
                      className="h-8 text-[9px] font-black uppercase tracking-widest bg-white border-slate-100 flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      Create Course
                    </Button>
                  </div>
                  <h1 className="text-4xl font-display font-medium text-slate-900">My Courses</h1>
                  <p className="text-slate-500 max-w-xl">Organize your files into subjects and start guided study sessions.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full py-12 px-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-4"
                    >
                      <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">No Courses Yet</h4>
                        <p className="text-xs text-slate-400">Create your first Course to organize your files.</p>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => setIsAddingCourse(true)}
                        className="bg-blue-600 hover:bg-black text-[10px] font-black uppercase tracking-widest h-9"
                      >
                        Create Your First Course
                      </Button>
                    </motion.div>
                  )}
                  {courses.map(course => (
                    <Card 
                      key={course.id}
                      className={cn(
                        "group cursor-pointer transition-all border-slate-100/60 hover:shadow-xl hover:shadow-slate-100 relative overflow-hidden",
                        selectedCourseId === course.id ? "ring-2 ring-slate-900 bg-white" : "bg-white/50"
                      )}
                      onClick={() => setSelectedCourseId(course.id)}
                    >
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            selectedCourseId === course.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
                          )}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <button 
                            onClick={(e) => handleDeleteCourse(e, course.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div>
                          <h3 className="font-display font-medium text-slate-900">{course.title}</h3>
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1">{course.description}</p>
                        </div>
                        <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                            {docs.filter(d => d.courseId === course.id).length} Materials
                          </span>
                          {selectedCourseId === course.id && (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); startWalkthrough(); }} className="h-7 text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-700">
                              Start Walkthrough
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}

                  <button 
                    onClick={() => setIsAddingCourse(true)}
                    className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-100 text-slate-300 hover:border-slate-300 hover:text-slate-400 transition-all min-h-[180px]"
                  >
                    <Plus className="w-8 h-8 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest">New Course</span>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isAddingCourse && (
                  <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 w-full max-w-md space-y-6"
                    >
                      <div className="space-y-2">
                        <h3 className="text-xl font-display font-medium">Create New Course</h3>
                        <p className="text-sm text-slate-400">Add a new subject to keep your files organized.</p>
                      </div>
                      <div className="space-y-4">
                        <Input placeholder="Course Title (e.g. Physics 101)" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} className="rounded-xl bg-slate-50 border-none" />
                        <Textarea placeholder="Course description..." value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} className="rounded-xl bg-slate-50 border-none min-h-[100px]" />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Button variant="ghost" disabled={isCreatingCourse} className="flex-1 rounded-xl uppercase font-black text-xs" onClick={() => setIsAddingCourse(false)}>Cancel</Button>
                        <Button 
                          disabled={isCreatingCourse} 
                          className="flex-1 bg-slate-900 text-white rounded-xl uppercase font-black text-xs h-11" 
                          onClick={handleAddCourse}
                        >
                          {isCreatingCourse ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Course"}
                        </Button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Controls & Logo */}
        <div className="absolute top-8 left-8 z-30 flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/50 backdrop-blur-md border border-slate-100 rounded-2xl shadow-sm">
            <Wind className="w-4 h-4 text-slate-900 stroke-[2.5]" />
            <span className="text-xs font-bold text-slate-900 tracking-tight font-display">Windyu</span>
          </div>
        </div>

        <div className="absolute top-8 right-8 z-30 flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={isVoiceActive ? stopVoiceMode : startVoiceMode}
            className={cn(
               "rounded-full backdrop-blur-md border border-slate-100 shadow-sm transition-all w-10 h-10",
               isVoiceActive ? "bg-red-50 text-red-500 border-red-100 animate-pulse" : "bg-white/50 text-slate-600 hover:bg-white"
            )}
          >
            {isVoiceActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-full bg-white/50 backdrop-blur-md border border-slate-100 shadow-sm hover:bg-white transition-all w-10 h-10"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
        </div>

        {/* Chat Area & Files View */}
        <div className="flex-1 overflow-y-auto px-4 py-12 md:px-12 bg-transparent scroll-smooth">
          {activeView === 'files' ? (
            <div className="max-w-5xl mx-auto space-y-12 pb-32 pt-20">
              <header className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                  <Library className="w-3 h-3 text-slate-400" />
                  <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">My Files</span>
                </div>
                <h1 className="text-4xl font-display font-medium text-slate-900">Documents</h1>
                <p className="text-slate-500 max-w-xl">Your collection of research, links, and notes. Choose any file to start reading.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map(doc => (
                  <Card 
                    key={doc.id}
                    onClick={() => onSelectDoc(doc)}
                    className="group cursor-pointer hover:shadow-xl hover:shadow-slate-100 transition-all border-slate-100 p-6 bg-white rounded-[24px]"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <Book className="w-6 h-6" />
                      </div>
                      <button onClick={(e) => handleDelete(e, doc.id)} className="p-2 rounded-xl hover:bg-red-50 text-slate-200 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="text-lg font-display font-medium text-slate-900 mb-2 line-clamp-1">{doc.title}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-6 leading-relaxed">{doc.content}</p>
                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        {doc.courseId && (
                           <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded-lg">
                             {courses.find(c => c.id === doc.courseId)?.title}
                           </span>
                        )}
                        <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{doc.updatedAt?.toDate().toLocaleDateString()}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-12 pb-32">
              {messages.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-8 pt-40"
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100/50">
                    <div className="w-1 h-1 rounded-full bg-slate-400 animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400">Tutor Online</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {['Summarize my files', 'Explain research', 'Key themes', 'Step-by-step Study'].map((tip) => (
                      <button 
                        key={tip}
                        onClick={() => tip === 'Step-by-step Study' ? setActiveView('courses') : setQuery(tip)}
                        className="px-4 py-1.5 rounded-xl bg-white border border-slate-100 text-[9px] font-black text-slate-400 hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest shadow-sm"
                      >
                        {tip}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-6 pt-20">
                  {messages.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-4 items-start",
                        msg.role === 'user' ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden",
                        msg.role === 'user' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-400"
                      )}>
                        {msg.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          (() => {
                            const citationMatch = msg.content.match(/\[(.*?)\]/);
                            const sourceTitle = citationMatch ? citationMatch[1] : null;
                            const sourceDoc = docs.find(d => d.title === sourceTitle);
                            
                            let domain = null;
                            if (sourceDoc?.sourceUrl) {
                              try {
                                domain = new URL(sourceDoc.sourceUrl).hostname;
                              } catch {
                                // Fallback for non-url strings
                              }
                            }
                            
                            if (domain) {
                              return <img src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`} alt={domain} className="w-full h-full object-cover" />;
                            }
                            return <Bot className="w-4 h-4" />;
                          })()
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[85%] p-4 md:p-5 rounded-[24px] text-sm md:text-base leading-relaxed shadow-sm transition-all",
                        msg.role === 'user' 
                          ? "bg-slate-900 text-white rounded-tr-none shadow-md shadow-slate-200 font-medium" 
                          : "bg-white border border-slate-100 text-slate-800 rounded-tl-none border-l-4 border-l-slate-400 font-serif"
                      )}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-slate max-w-none prose-sm md:prose-base dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isAiLoading && (
                    <div className="flex gap-4 items-start animate-pulse">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-slate-200" />
                      </div>
                      <div className="h-16 w-1/3 bg-slate-50 rounded-[24px] rounded-tl-none border border-slate-100" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unified Input - Sleeker & More Compact */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-20">
          <div className="relative group">
            <div className="absolute -inset-1 bg-slate-100 rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700"></div>
            <div className="relative bg-white border border-slate-200 rounded-[28px] p-1.5 shadow-2xl shadow-slate-200/40 transition-all group-focus-within:border-slate-300">
              <div className="flex items-center">
                <div className="pl-4 pr-1">
                  <Sparkles className="w-5 h-5 text-slate-300 group-focus-within:text-slate-900 transition-all" />
                </div>
                <input 
                  type="text"
                  placeholder="Ask your tutor about your library..."
                  className="flex-1 h-11 bg-transparent border-none focus:ring-0 text-base font-display placeholder:text-slate-300"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                />
                <Button 
                  onClick={handleChat}
                  disabled={!query.trim() || isAiLoading}
                  className="h-11 w-11 rounded-[22px] bg-slate-900 hover:bg-black transition-all hover:scale-105 active:scale-95 shrink-0" 
                  size="icon"
                >
                  {isAiLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Mode Overlay */}
      <AnimatePresence>
        {isVoiceActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl z-[60] flex flex-col items-center justify-center p-8"
          >
            <div className="absolute top-8 right-8">
              <Button variant="ghost" size="icon" onClick={stopVoiceMode} className="text-white hover:bg-white/10 rounded-full">
                <X className="w-8 h-8" />
              </Button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full space-y-12">
              <div className="relative">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{ 
                    duration: 3, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -inset-24 bg-blue-500/20 rounded-full blur-3xl"
                />
                <motion.div 
                   animate={isVoiceReady ? {
                     scale: [1, 1.05, 1],
                     rotate: [0, 5, -5, 0]
                   } : {}}
                   transition={{ duration: 4, repeat: Infinity }}
                   className="w-48 h-48 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center relative z-10"
                >
                  <Volume2 className={cn("w-16 h-16 transition-all", isVoiceReady ? "text-blue-400 scale-110" : "text-white/20")} />
                </motion.div>
              </div>

              <div className="text-center space-y-6">
                <h3 className="text-white text-2xl font-display font-medium">
                  {voiceError ? "Hardware Error" : (isVoiceReady ? "Windyu Listening..." : "Connecting to Cortex...")}
                </h3>
                <div className="min-h-[100px] flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {voiceError ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-red-400 text-sm font-medium bg-red-400/10 px-6 py-4 rounded-2xl border border-red-400/20 max-w-md"
                      >
                        <p className="font-bold mb-1">Microphone Access Denied</p>
                        <p className="text-xs opacity-80 leading-relaxed">
                          Please ensure you have granted microphone permissions in your browser and that you are not in a restricted iframe. 
                          Try opening the app in a new tab if the issue persists.
                        </p>
                      </motion.div>
                    ) : voiceTranscription ? (
                      <motion.p 
                        key={voiceTranscription}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-white/60 text-lg md:text-xl font-serif italic max-w-lg leading-relaxed text-center"
                      >
                        "{voiceTranscription}"
                      </motion.p>
                    ) : (
                      <motion.p exit={{ opacity: 0 }} className="text-white/20 text-sm uppercase tracking-widest font-black">
                        Start speaking to your tutor
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="pb-12 text-white/40 text-[10px] uppercase tracking-[0.3em] font-black">
              Windyu Multimodal Live
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Side Navigation Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm z-40"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-100 shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8 space-y-12">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Navigation</h3>
                  <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {[
                    { icon: Sparkles, label: 'Tutor', active: activeView === 'tutor', onClick: () => { setActiveView('tutor'); setIsSidebarOpen(false); } },
                    { icon: Library, label: 'Files', active: activeView === 'files', onClick: () => { setActiveView('files'); setIsSidebarOpen(false); } },
                    { icon: GraduationCap, label: 'Courses', active: activeView === 'courses', onClick: () => { setActiveView('courses'); setIsSidebarOpen(false); } },
                    { icon: Users, label: 'Friends', active: false },
                  ].map((item, i) => (
                    <button 
                      key={i}
                      onClick={item.onClick}
                      disabled={!item.onClick}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200",
                        item.active 
                          ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                          : "bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">{item.label}</span>
                      {item.active && <motion.div layoutId="active-indicator" className="ml-auto w-1 h-1 rounded-full bg-white" />}
                    </button>
                  ))}
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Courses</h4>
                    <Button variant="ghost" size="sm" onClick={() => { setActiveView('courses'); setIsAddingCourse(true); setIsSidebarOpen(false); }} className="h-7 px-2 rounded-lg text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors uppercase tracking-widest">New Course</Button>
                  </div>

                  <div className="flex items-center justify-between px-1 mt-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Library Documents</h4>
                    <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="h-7 px-2 rounded-lg text-[10px] font-black text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors uppercase tracking-widest">Add New</Button>
                  </div>
                  
                  {isAdding && (
                    <Card className="shadow-xl border-slate-100 p-4 space-y-4 rounded-2xl bg-white">
                      <Input placeholder="Title (e.g. Wikipedia: Quantum computing)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="h-10 text-xs rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                      <div className="flex gap-2">
                        <Input placeholder="Source URL (optional)" value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} className="h-10 text-xs rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all flex-1" />
                        <select 
                          className="h-10 text-xs rounded-xl bg-slate-50 border-transparent px-3 text-slate-500 focus:bg-white transition-all outline-none"
                          value={selectedCourseId || ''}
                          onChange={(e) => setSelectedCourseId(e.target.value || null)}
                        >
                          <option value="">Select Course</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                      <Textarea placeholder="Context content..." value={newContent} onChange={e => setNewContent(e.target.value)} className="min-h-[150px] text-xs rounded-xl bg-slate-50 border-transparent focus:bg-white transition-all" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="flex-1 text-[10px] font-bold uppercase tracking-wider">Cancel</Button>
                        <Button size="sm" onClick={handleAdd} className="flex-1 bg-slate-900 text-white hover:bg-black rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider">Save Document</Button>
                      </div>
                    </Card>
                  )}

                  <div className="space-y-2">
                    {docs.slice(0, 8).map((doc) => (
                      <div 
                        key={doc.id}
                        onClick={() => { onSelectDoc(doc); setIsSidebarOpen(false); }}
                        className="group flex items-center justify-between p-4 rounded-xl bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">
                            {doc.sourceUrl ? (
                              <img src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(doc.sourceUrl).hostname}`} alt="" className="w-4 h-4 opacity-70" />
                            ) : (
                              <Book className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <h5 className="text-[12px] font-medium text-slate-700 line-clamp-1">{doc.title}</h5>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Edited {doc.updatedAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              {doc.courseId && (
                                <>
                                  <span className="text-[9px] text-slate-300">•</span>
                                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-tight truncate max-w-[80px]">
                                    {courses.find(c => c.id === doc.courseId)?.title}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <button onClick={(e) => handleDelete(e, doc.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              <div className="pt-8 border-t border-slate-100">
                <div className="p-4 rounded-2xl bg-slate-900 flex items-center justify-between text-white shadow-lg overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl -mr-12 -mt-12" />
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">{user?.displayName || user?.email?.split('@')[0]}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Plan</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => logout()} className="relative z-10 rounded-xl hover:bg-white/10 text-white transition-colors">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
    </div>
  );
}
