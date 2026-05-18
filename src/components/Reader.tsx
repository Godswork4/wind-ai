import React, { useState, useEffect, useRef } from 'react';
import { ReadingDocument, highlightService, noteService, Highlight, Note } from '@/services/firestoreService';
import { 
  ChevronLeft, 
  Highlighter, 
  StickyNote, 
  Sparkles, 
  Copy, 
  Trash2,
  BrainCircuit,
  Lightbulb,
  X,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ReaderProps {
  doc: ReadingDocument;
  onBack: () => void;
}

export default function Reader({ doc, onBack }: ReaderProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState('notes');
  const [newNote, setNewNote] = useState('');
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect | null } | null>(null);
  const [selectedColor, setSelectedColor] = useState('#fde047'); // Default yellow
  const [aiResponse, setAiResponse] = useState<{ type: 'summary' | 'explanation', content: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const colors = [
    { name: 'yellow', value: '#fde047', bg: 'bg-yellow-200/60', border: 'border-yellow-300' },
    { name: 'green', value: '#86efac', bg: 'bg-green-200/60', border: 'border-green-300' },
    { name: 'blue', value: '#93c5fd', bg: 'bg-blue-200/60', border: 'border-blue-300' },
    { name: 'purple', value: '#d8b4fe', bg: 'bg-purple-200/60', border: 'border-purple-300' },
    { name: 'orange', value: '#fdba74', bg: 'bg-orange-200/60', border: 'border-orange-300' },
  ];

  useEffect(() => {
    const unsubH = highlightService.subscribe(doc.id, setHighlights);
    const unsubN = noteService.subscribe(doc.id, setNotes);
    return () => {
      unsubH();
      unsubN();
    };
  }, [doc.id]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: sel.toString(),
        rect
      });
    } else {
      setSelection(null);
    }
  };

  const addHighlight = async () => {
    if (!selection) return;
    // For simplicity in this demo, we just store the text. 
    // In a production app, we'd store character offsets for persistent rendering.
    await highlightService.create(doc.id, {
      documentId: doc.id,
      text: selection.text,
      range: { start: 0, end: 0 }, // Simplified
      color: selectedColor
    });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleAiAction = async (type: 'summary' | 'explanation', overrideText?: string) => {
    setIsAiLoading(true);
    // Keep selection for context until response is back if possible, 
    // but the selection toolbar might get in the way.
    // For now, we open the modal immediately by setting a placeholder response or just using isAiLoading.
    setAiResponse(null); 
    
    try {
      const endpoint = type === 'summary' ? '/api/ai/summarize' : '/api/ai/explain';
      const textToProcess = overrideText || selection?.text || "General knowledge";
      
      const body = type === 'summary' 
        ? { text: doc.content } 
        : { text: textToProcess, context: doc.content };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setAiResponse({ type, content: data.summary || data.explanation });
    } catch (e) {
      console.error(e);
      // Optional: show error message
    } finally {
      setIsAiLoading(false);
      setSelection(null);
    }
  };

  const saveNote = async () => {
    if (!newNote.trim()) return;
    await noteService.createOrUpdate(doc.id, newNote);
    setNewNote('');
  };

  const renderContentWithHighlights = () => {
    const sortedHighlights = [...highlights].sort((a, b) => b.text.length - a.text.length);
    
    return doc.content.split('\n').map((para, i) => {
      let elements: (string | React.ReactNode)[] = [para];
      
      highlights.forEach(h => {
        const colorConfig = colors.find(c => c.value === h.color) || colors[0];
        
        elements = elements.flatMap(el => {
          if (typeof el !== 'string') return [el];
          const parts = el.split(h.text);
          const result: (string | React.ReactNode)[] = [];
          parts.forEach((part, index) => {
            result.push(part);
            if (index < parts.length - 1) {
              result.push(
                <span 
                  key={`${h.id}-${index}`} 
                  className={cn("rounded px-0.5 border-b transition-colors whitespace-pre-wrap", colorConfig.bg, colorConfig.border)}
                  title="Citation captured"
                >
                  {h.text}
                </span>
              );
            }
          });
          return result;
        });
      });

      return (
        <p key={i} className="mb-6">
          {elements}
        </p>
      );
    });
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#fdfcfb] relative p-4 md:p-8 gap-8 overflow-hidden font-sans">
      {/* Back Button Overlay for Mobile */}
      <div className="md:hidden absolute top-4 left-4 z-20 text-slate-500">
        <Button variant="secondary" size="icon" onClick={onBack} className="rounded-full shadow-lg bg-white border-slate-200">
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Reader Area */}
      <div className="flex-1 overflow-hidden flex flex-col pro-card bg-white relative">
        {/* Reading Controls */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 bg-white z-10">
          <div className="flex gap-4 items-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack} 
              className="text-slate-400 hover:text-slate-900 font-bold uppercase tracking-widest text-[10px] hidden md:flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Library
            </Button>
            <div className="h-4 w-px bg-slate-100 hidden md:block"></div>
            <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-800 rounded-md text-[10px] font-black uppercase tracking-[0.2em] border border-orange-100">
              <Highlighter className="w-3 h-3" />
              Focusing
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="human-serif text-xs text-slate-300">
              {doc.title.substring(0, 40)}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-8 md:p-16 lg:p-24 selection:bg-orange-100 selection:text-orange-900">
          <div 
            ref={contentRef}
            onMouseUp={handleMouseUp}
            className="max-w-3xl mx-auto text-xl leading-[1.9] text-slate-800 font-serif"
          >
            {renderContentWithHighlights()}
          </div>
        </ScrollArea>
      </div>

      {/* Right Sidebar */}
      <aside className="w-full md:w-85 flex flex-col gap-8 shrink-0 h-[500px] md:h-full overflow-hidden">
        {/* Notes & Insights Context */}
        <div className="flex-1 pro-card flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-[#fdfcfb]">
              <TabsList className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="notes" className="rounded-lg h-9 text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="highlights" className="rounded-lg h-9 text-[10px] font-black uppercase tracking-[0.15em] data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Highlights
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <TabsContent value="notes" className="h-full flex flex-col m-0 p-6 space-y-6">
                <ScrollArea className="flex-1 pr-3">
                  <div className="space-y-5">
                    {notes.map(note => (
                      <div key={note.id} className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm transition-all hover:border-orange-200 group">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-orange-600/60 uppercase tracking-[0.2em] italic">
                              Saved Note
                            </span>
                            <button 
                              onClick={() => handleAiAction('explanation', note.content)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-orange-50 text-orange-400 transition-all"
                              title="Ask AI to explain this note"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-[9px] text-slate-300 font-bold">
                            {note.updatedAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed font-sans">{note.content}</p>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <div className="text-center py-24 text-slate-300">
                         <StickyNote className="w-14 h-14 mx-auto stroke-1 opacity-20" />
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6 opacity-40 text-slate-400">Your Notes</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="pt-4 space-y-3">
                  <Textarea 
                    placeholder="Write a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="border-slate-100 focus-visible:ring-slate-900 resize-none h-28 p-4 text-sm rounded-xl bg-slate-50/50 shadow-inner"
                  />
                  <Button onClick={saveNote} className="pro-btn-primary w-full h-12 text-[10px] uppercase tracking-[0.3em] font-black">
                    Save Note
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="highlights" className="h-full m-0 p-6 overflow-y-auto">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Citations</span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>
                  {highlights.map(h => (
                    <motion.div 
                      key={h.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative group bg-orange-50/30 rounded-xl border border-orange-100/50 p-5"
                    >
                      <p className="text-[15px] text-slate-800 italic font-medium leading-relaxed font-serif">
                        "{h.text}"
                      </p>
                      <button 
                        className="absolute -top-2 -right-2 h-7 w-7 bg-white border border-slate-200 text-slate-400 hover:text-red-600 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                        onClick={() => highlightService.delete(doc.id, h.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* AI Action Card */}
        <div className="pro-card bg-slate-900 border-none p-7 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full -mr-16 -mt-16 opacity-10 blur-3xl group-hover:opacity-30 transition-opacity"></div>
          <div className="relative z-10 space-y-5 text-center">
            <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em] flex items-center justify-center gap-2">
              <BrainCircuit className="w-4 h-4" />
              AI Assistant
            </h4>
            <Button 
              className="w-full h-14 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] transition-all"
              onClick={() => handleAiAction('summary')}
              disabled={isAiLoading}
            >
              {isAiLoading ? "Thinking..." : "Summarize Page"}
            </Button>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide">
              Highlight text to ask AI for explanations.
            </p>
          </div>
        </div>
      </aside>

      {/* AI Detail Modal */}
      <AnimatePresence>
        {(aiResponse || isAiLoading) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.98, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-[#fdfcfb]">
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200 transition-colors",
                    isAiLoading ? "bg-slate-200 animate-pulse" : "bg-slate-900"
                  )}>
                    <Sparkles className={cn("w-6 h-6", isAiLoading ? "text-slate-400" : "text-white")} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-medium text-slate-900 tracking-tight">
                      {isAiLoading ? "Thinking..." : "AI Insight"}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
                      {aiResponse?.type || (isAiLoading ? "Analysis" : "")} Session
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setAiResponse(null); setIsAiLoading(false); }} className="rounded-full hover:bg-slate-100 h-10 w-10">
                  <X className="w-5 h-5 text-slate-400" />
                </Button>
              </div>
              <ScrollArea className="flex-1 px-12 py-12 md:px-16 md:py-16">
                <div className="prose prose-slate prose-orange prose-lg max-w-none font-sans leading-[1.8]">
                  {isAiLoading ? (
                    <div className="space-y-6">
                      <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                      <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                      <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse" />
                      <div className="h-4 bg-slate-100 rounded w-full animate-pulse opacity-50" />
                    </div>
                  ) : (
                    <ReactMarkdown>{aiResponse?.content || ''}</ReactMarkdown>
                  )}
                </div>
              </ScrollArea>
              <div className="p-6 bg-[#fdfcfb] border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] opacity-80">
                  {isAiLoading ? "Processing your data..." : "AI help for your documents."}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Selection Toolbar */}
      <AnimatePresence>
        {selection && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            style={{
              position: 'fixed',
              top: (selection.rect?.top || 0) - 75,
              left: (selection.rect?.left || 0) + (selection.rect?.width || 0) / 2,
              transform: 'translateX(-50%)',
              zIndex: 100
            }}
            className="flex items-center bg-slate-900 text-white rounded-[20px] shadow-2xl overflow-hidden border border-slate-700 p-1.5"
          >
            <div className="flex items-center gap-1.5 px-3 border-r border-slate-700 mr-1.5">
              {colors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all border-2",
                    selectedColor === color.value ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            
            <button 
              onClick={addHighlight} 
              className="flex items-center h-10 px-4 hover:bg-slate-800 text-[9px] font-black uppercase tracking-[0.2em] transition-colors rounded-xl"
            >
              <Highlighter className="w-3.5 h-3.5 mr-2 text-white" />
              Highlight
            </button>
            <div className="h-6 w-px bg-slate-700 mx-1"></div>
            <button 
              onClick={() => handleAiAction('explanation')} 
              className="flex items-center h-10 px-4 hover:bg-slate-800 text-[9px] font-black uppercase tracking-[0.2em] transition-colors rounded-xl"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2 text-orange-400" />
              Explore
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
