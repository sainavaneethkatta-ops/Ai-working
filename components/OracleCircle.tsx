
import React from 'react';
import { OracleStatus } from '../types';

interface OracleCircleProps {
  status: OracleStatus;
  onClick?: () => void;
}

const OracleCircle: React.FC<OracleCircleProps> = ({ status, onClick }) => {
  const isListening = status === OracleStatus.LISTENING;
  
  // Blue for idle (not listening), Yellow for active (listening)
  const baseColor = isListening ? 'bg-[#FFD700]' : 'bg-[#3B82F6]';
  const glowColor = isListening ? 'shadow-[0_0_80px_rgba(255,215,0,0.3)]' : 'shadow-[0_0_60px_rgba(59,130,246,0.2)]';
  const pulseClass = isListening ? 'animate-[pulse_2s_infinite]' : '';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div 
        className="relative w-72 h-72 flex items-center justify-center cursor-pointer group"
        onClick={onClick}
      >
        {/* Outer ambient glow */}
        <div 
          className={`absolute inset-0 rounded-full blur-[100px] opacity-20 transition-all duration-1000 ${isListening ? 'bg-yellow-400' : 'bg-blue-600'}`}
        />
        
        {/* Animated Rings */}
        <div 
          className={`absolute inset-0 border-[1px] rounded-full transition-all duration-1000 ease-out border-white/10 group-hover:border-white/20 ${isListening ? 'scale-125 opacity-10' : 'scale-100 opacity-5'}`}
        />
        <div 
          className={`absolute inset-4 border-[1px] rounded-full transition-all duration-1000 delay-100 ease-out border-white/10 group-hover:border-white/20 ${isListening ? 'scale-110 opacity-20' : 'scale-100 opacity-10'}`}
        />
        
        {/* The Core Circle */}
        <div 
          className={`w-40 h-40 rounded-full z-10 transition-all duration-700 ease-in-out transform flex items-center justify-center shadow-2xl active:scale-90 ${baseColor} ${glowColor} ${pulseClass} ${isListening ? 'scale-105' : 'scale-100'}`}
        >
          <div className="flex flex-col items-center justify-center gap-1 select-none">
             <span className="text-black font-extrabold text-[12px] uppercase tracking-[0.3em] opacity-90">
               {status === OracleStatus.CONNECTING ? '...' : 'ORACLE'}
             </span>
             {isListening && (
               <div className="flex gap-1">
                 <div className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-1 h-1 bg-black rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-1 h-1 bg-black rounded-full animate-bounce"></div>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Status Label Below Circle */}
      <div className="mt-12 text-center transition-all duration-500 pointer-events-none select-none">
        <span className={`text-[10px] font-bold tracking-[0.4em] uppercase transition-colors duration-500 ${isListening ? 'text-yellow-400 opacity-100' : 'text-blue-400 opacity-60'}`}>
          {status === OracleStatus.CONNECTING ? 'Linking...' : isListening ? 'Mic Active' : 'Tap Oracle to Start'}
        </span>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1.05); filter: brightness(1); }
          50% { transform: scale(1.1); filter: brightness(1.2); }
        }
      `}</style>
    </div>
  );
};

export default OracleCircle;
