import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, Maximize2, Minimize2, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AIAssistant: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your RMS Intelligence Assistant. How can I help you analyze your restaurant performance today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      // Fixed: Initializing GoogleGenAI using the exact naming and property structure required.
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: `You are a professional restaurant management consultant AI for a high-end Restaurant Management System. 
            CONTEXT: The restaurant is "Midtown Manhattan Flagship". 
            KPIs: Daily Revenue $42k, 24/30 Tables Active, 18 pending deliveries.
            Respond concisely and professionally based on these data-driven insights.`
        }
      });

      // Fixed: Accessing the .text property directly as per the Correct Method guideline.
      const aiResponse = response.text || "I'm sorry, I couldn't process that request.";
      setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Error connecting to Intelligence Core. Please check API configuration." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-[100] bg-white rounded-[32px] shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 overflow-hidden ${
      isExpanded ? 'w-[600px] h-[800px]' : 'w-[400px] h-[550px]'
    }`}>
      {/* Header */}
      <div className="p-6 bg-primary text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="size-6 text-white" />
          </div>
          <div>
            <h3 className="font-black text-lg leading-tight">RMS Intelligence</h3>
            <p className="text-[10px] uppercase font-bold tracking-widest text-white/70">Powered by Gemini</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${
              m.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none shadow-lg shadow-primary/10' 
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analyzing Data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <div className="flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about operations..."
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="size-12 bg-primary text-white rounded-xl flex items-center justify-center hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
          >
            <Send className="size-5" />
          </button>
        </div>
        <p className="text-[9px] text-center text-slate-400 mt-3 font-bold uppercase tracking-widest">
          Enterprise AI may provide inaccuracies. Verify critical data.
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;