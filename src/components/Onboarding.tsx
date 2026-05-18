import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, ChevronRight, Upload, Sparkles, BookOpen, GraduationCap, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { documentService, courseService } from '@/services/firestoreService';
import { cn } from '@/lib/utils';
import * as pdfjs from 'pdfjs-dist';

// Use a CDN worker for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface OnboardingProps {
  onComplete: () => void;
  userId: string;
}

export default function Onboarding({ onComplete, userId }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [courseName, setCourseName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
      setUploadProgress(Math.round((i / pdf.numPages) * 100));
    }
    
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      // 1. Create Course
      const courseId = await courseService.create(courseName, `Course created during onboarding for ${courseName}`);
      
      if (!courseId) throw new Error("Failed to create course");

      // 2. Extract Text
      const text = await extractTextFromPDF(file);
      
      // 3. Save Document
      await documentService.create(file.name.replace('.pdf', ''), text, '', courseId);

      // 4. Move to AI Loading step
      setStep(3);
      
      // Artificial delay for the AI logo animation
      setTimeout(() => {
        onComplete();
      }, 4000);

    } catch (err) {
      console.error('Onboarding Error:', err);
      setError('Failed to process document. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#fdfcfb] z-[100] flex items-center justify-center p-6 sm:p-12 overflow-hidden">
      <div className="absolute top-12 left-12 flex items-center gap-2">
        <Wind className="w-5 h-5 text-slate-900" />
        <span className="text-xl font-bold font-display">Windyu</span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h1 className="text-4xl font-display font-medium text-slate-900 tracking-tight">
                What are we studying <br />
                <span className="human-serif text-slate-400">today?</span>
              </h1>
              <p className="text-slate-500">
                Let's start by creating your first course. This helps keep your study materials organized.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                placeholder="Course Name (e.g. Physics 101, History of Art)"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="h-14 px-6 rounded-2xl bg-white border-slate-200 text-lg font-display focus:ring-slate-900 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && courseName && setStep(2)}
              />
              <Button
                disabled={!courseName}
                onClick={() => setStep(2)}
                className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full space-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center text-white">
                <BookOpen className="w-6 h-6" />
              </div>
              <h1 className="text-4xl font-display font-medium text-slate-900 tracking-tight">
                Upload your study <br />
                <span className="human-serif text-slate-400">materials.</span>
              </h1>
              <p className="text-slate-500">
                Upload a PDF for <span className="font-bold text-slate-900">{courseName}</span>. 
                Our AI will analyze it to help you study more effectively.
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              
              <button
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full aspect-video rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all group relative overflow-hidden",
                  isUploading 
                    ? "bg-slate-50 border-slate-200 text-slate-400" 
                    : "bg-white border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-600 shadow-sm"
                )}
              >
                {isUploading ? (
                  <>
                    <div className="relative w-16 h-16">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-2 border-slate-200 border-t-slate-900 rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black">{uploadProgress}%</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">Extracting content...</span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-900">Click to upload PDF</p>
                      <p className="text-xs text-slate-400 mt-1">or drag and drop here</p>
                    </div>
                  </>
                )}
              </button>

              {error && (
                <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <Button
                variant="ghost"
                disabled={isUploading}
                onClick={() => setStep(1)}
                className="w-full text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em]"
              >
                Go Back
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center space-y-12 text-center"
          >
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -inset-12 bg-blue-100 rounded-full blur-3xl"
              />
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: -3 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="w-32 h-32 bg-slate-900 rounded-[32px] flex items-center justify-center shadow-2xl relative z-10"
              >
                <Wind className="w-16 h-16 text-white stroke-[2]" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -top-4 -right-4 w-12 h-12 bg-white rounded-full shadow-lg border border-slate-100 flex items-center justify-center"
              >
                <Sparkles className="w-6 h-6 text-blue-500" />
              </motion.div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-display font-medium text-slate-900">
                Initializing your <br />
                <span className="human-serif text-slate-400">Personal Tutor.</span>
              </h2>
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        opacity: [0.2, 1, 0.2],
                        scale: [1, 1.5, 1],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="w-1.5 h-1.5 rounded-full bg-slate-900"
                    />
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Ready in seconds
                </p>
              </div>
            </div>
            
            <div className="max-w-xs space-y-4">
               <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 text-left flex gap-3">
                 <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                 <p className="text-xs text-blue-800 leading-relaxed">
                   <strong>Done!</strong> "{courseName}" materials have been analyzed. I'm ready to explain concepts and answer your questions.
                 </p>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-12 left-0 right-0 flex justify-center gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 transition-all rounded-full",
              step === i ? "w-8 bg-slate-900" : "w-1 bg-slate-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}
