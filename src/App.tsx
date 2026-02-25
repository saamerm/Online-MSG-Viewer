import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { Upload, FileText, Download, AlertCircle, Loader2, Mail, Calendar, User, Users } from 'lucide-react';
import { parseMsg, ParsedEmail, Attachment } from './utils/msgParser';

// Sonesta Brand Colors
const COLORS = {
  primary: '#000000', // Black
  secondary: '#4A4A4A', // Dark Gray
  accent: '#C5A059', // Gold-ish accent for active states
  bg: '#FFFFFF', // White
  error: '#EF4444',
};

export default function App() {
  const [parsedData, setParsedData] = useState<ParsedEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.msg')) {
      setError("Please upload a valid .msg file.");
      return;
    }

    setLoading(true);
    setError(null);
    setParsedData(null);

    try {
      const data = await parseMsg(file);
      setParsedData(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to parse the file. It might be corrupted or not a valid Outlook message.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const resetViewer = () => {
    setParsedData(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-amber-100 selection:text-black">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={resetViewer}>
            <img 
              src="https://newsroom.sonesta.com/wp-content/uploads/2024/09/SonestaInternationalHotels_Logo_Black_RGB-1-e1725287338753.png" 
              alt="Sonesta Logo" 
              className="h-12 w-auto object-contain"
            />
            <div className="h-8 w-px bg-gray-300 mx-2 hidden sm:block"></div>
            <h1 className="text-xl font-medium text-gray-800 hidden sm:block tracking-tight">Document Parser</h1>
          </div>
          {parsedData && (
            <button 
              onClick={resetViewer}
              className="text-sm font-medium text-gray-500 hover:text-black transition-colors"
            >
              Parse Another File
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {!parsedData && !loading ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-semibold text-gray-900 mb-3">Upload MeetingPackage Export</h2>
                <p className="text-gray-500 text-lg">Drag and drop your .msg file here to view its contents instantly.</p>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative group cursor-pointer
                  border-2 border-dashed rounded-2xl p-12
                  flex flex-col items-center justify-center text-center
                  transition-all duration-300 ease-in-out
                  ${isDragging 
                    ? 'border-amber-500 bg-amber-50 scale-[1.02] shadow-xl' 
                    : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 shadow-sm'
                  }
                `}
              >
                <input 
                  type="file" 
                  accept=".msg" 
                  onChange={handleFileInput} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <div className={`
                  p-4 rounded-full mb-4 transition-colors duration-300
                  ${isDragging ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'}
                `}>
                  <Upload className="w-10 h-10" />
                </div>
                
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {isDragging ? "Drop file to parse" : "Click or drag file to upload"}
                </h3>
                <p className="text-sm text-gray-500">Supported format: .msg (Outlook Message)</p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </motion.div>
              )}
            </motion.div>
          ) : loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-96"
            >
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
              <p className="text-gray-500 font-medium animate-pulse">Parsing document structure...</p>
            </motion.div>
          ) : (
            <motion.div 
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Sidebar: Metadata & Attachments */}
              <div className="lg:col-span-1 space-y-6">
                {/* Metadata Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      Message Details
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">From</label>
                      <div className="flex items-start gap-2 text-gray-900 font-medium">
                        <User className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                        <span className="break-words">{parsedData?.headers.from}</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">Date</label>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{parsedData?.headers.date}</span>
                      </div>
                    </div>

                    {(parsedData?.headers.to?.length ?? 0) > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">To</label>
                        <div className="flex items-start gap-2 text-gray-600 text-sm">
                          <Users className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {parsedData?.headers.to.map((recipient, idx) => (
                              <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{recipient}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attachments Card */}
                {(parsedData?.attachments?.length ?? 0) > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        Attachments
                      </h3>
                      <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                        {parsedData?.attachments.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {parsedData?.attachments.map((att: Attachment, idx: number) => (
                        <li key={idx} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{att.fileName}</p>
                              <p className="text-xs text-gray-500">{(att.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <a 
                            href={att.url} 
                            download={att.fileName}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-all"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Main Content: Subject & Body */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
                  <div className="p-8 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                      {parsedData?.headers.subject}
                    </h1>
                  </div>
                  
                  <div className="p-8 bg-white">
                    <div 
                      className="prose prose-stone max-w-none prose-headings:font-semibold prose-a:text-amber-600 hover:prose-a:text-amber-700 prose-img:rounded-lg prose-img:shadow-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(parsedData?.body || "", { 
                          ADD_TAGS: ['img'], 
                          ADD_ATTR: ['src', 'alt', 'width', 'height', 'style'] 
                        }) 
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
