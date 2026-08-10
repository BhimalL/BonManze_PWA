import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Module } from '../types';

interface VoiceIntelligenceProps {
  onCommand: (cmd: { action: 'navigate' | 'info'; target?: Module; message?: string }) => void;
}

const VoiceIntelligence: React.FC<VoiceIntelligenceProps> = ({ onCommand }) => {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startVoiceSession = async () => {
    setIsActive(true);
    setIsProcessing(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Fixed: Initializing GoogleGenAI instance right before the call and using exact parameter formatting.
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
      
      // Simple voice-to-action simulation using generateContent for reliability in demo
      // In a real Live API setup, we would use the streaming PCM logic
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "The user is about to give a voice command to a restaurant management system. Simulate the AI acknowledging the user is ready.",
      });

      // Simulation of command recognition
      setTimeout(() => {
        setIsProcessing(false);
      }, 1500);

    } catch (err) {
      console.error("Microphone access denied or API error", err);
      setIsActive(false);
    }
  };

  return (
    <button
      onClick={() => isActive ? setIsActive(false) : startVoiceSession()}
      className={`relative flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        isActive 
          ? 'bg-danger text-white shadow-lg shadow-danger/20 animate-pulse' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {isActive ? (
        <>
          <Volume2 className="size-4 animate-bounce" />
          Listening...
        </>
      ) : (
        <>
          <Mic className="size-4" />
          Voice Control
        </>
      )}
      
      {isActive && (
        <div className="absolute -top-12 right-0 bg-slate-900 text-white p-3 rounded-2xl text-[10px] whitespace-nowrap shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          Try: "Open POS" or "Check Stock"
        </div>
      )}
    </button>
  );
};

export default VoiceIntelligence;