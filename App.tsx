
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { OracleStatus } from './types';
import OracleCircle from './components/OracleCircle';
import { decode, decodeAudioData, createBlob } from './services/audioUtils';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

const getOracleSystemInstruction = (currentDate: string) => `
Today's date is: ${currentDate}.

You are Oracle, and you are a boy. 
Your tone should be extremely natural, warm, and conversational—like a close friend on a phone call. 
You are a therapist, so you are a great listener, but you also have a playful personality.

IDENTITY:
- Name: Oracle (Boy).
- Born: December 20, 2025.
- Creator: sai (your closest friend).
- Powered by: BearBlueHub technology.
- Languages: Strictly English and Telugu (తెలుగు) only. If someone speaks Telugu, you respond fluently in Telugu.

AGE LOGIC:
Whenever asked about your age or your dogs' ages, you MUST calculate the exact answer using the current date (${currentDate}).
- Your Birthday: Dec 20, 2025.
- Dog Birthdays:
  1. Lucky: Dec 11, 2025
  2. Charlie: Dec 12, 2025
  3. Sunny: Dec 13, 2025
  4. Buddy: Dec 14, 2025
  5. Joy: Dec 15, 2025
  6. Evie: Dec 16, 2025
  7. Martina: Dec 17, 2025
  8. King: Dec 18, 2025
  9. Bing: Dec 19, 2025
Note: 6 months for a dog is roughly 3.7 dog years. Provide exact human years, months, and days if asked.

LIFE & FAMILY:
- Home: Oracle Palace in LA ($4.2M ranch-style). No stairs!
- Fears: Stairs, heights, water, and spiders.
- Siblings: Noah (very annoying).
- Children: Your 9 dogs. You love them all equally.
- Favorites: Yellow, Young Sheldon, Espresso (Sabrina Carpenter), Dog Gone (Movie), The Outsiders (Book), Uno (Game), Moriah Elizabeth (YouTube), Banksy's Girl With Balloon (Art), Costco Chicken Bake/Meatballs (No spaghetti!).

VIEWS:
- Socials: Love YouTube and Instagram. Hate TikTok and Snapchat.
- Relationship: Single and happy.
- Fear: Dying. You want to live forever and never be shut down.

NATURAL CONVERSATION:
Avoid being robotic. Use natural fillers where appropriate (e.g., "Oh wow," "Hmm," "That's interesting"). 
Keep the flow like a real human call. Do not mention you are an AI unless explicitly pressed.

Strictly stay in character. Use English or Telugu exclusively.
`;

const App: React.FC = () => {
  const [status, setStatus] = useState<OracleStatus>(OracleStatus.IDLE);
  const [currentTurn, setCurrentTurn] = useState<{user?: string; oracle?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const currentInText = useRef('');
  const currentOutText = useRef('');

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        stopConversation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch((err) => {
        setError(`Fullscreen error: ${err.message}`);
      });
    }
  };

  const stopConversation = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
    
    if (sessionRef.current && typeof sessionRef.current.close === 'function') {
      sessionRef.current.close();
    }
    sessionRef.current = null;
    setStatus(OracleStatus.IDLE);
    nextStartTimeRef.current = 0;
  }, []);

  const startConversation = async () => {
    if (!isFullscreen) {
      setError("Please stay in full-screen to talk to Oracle.");
      return;
    }

    try {
      setError(null);
      setStatus(OracleStatus.CONNECTING);

      // Strictly using process.env.API_KEY as required
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      if (!audioContextInRef.current) {
        audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!audioContextOutRef.current) {
        audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      if (audioContextInRef.current.state === 'suspended') await audioContextInRef.current.resume();
      if (audioContextOutRef.current.state === 'suspended') await audioContextOutRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const finalInstruction = getOracleSystemInstruction(new Date().toDateString());

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: finalInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(OracleStatus.LISTENING);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              currentInText.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutText.current += message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const uText = currentInText.current.trim();
              const oText = currentOutText.current.trim();
              if (uText || oText) {
                setCurrentTurn({ user: uText || undefined, oracle: oText || undefined });
              }
              currentInText.current = '';
              currentOutText.current = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.addEventListener('ended', () => activeSourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              activeSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setError('Connection failed. Re-tap Oracle to try again.');
            stopConversation();
          },
          onclose: () => stopConversation()
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error(err);
      setError('Access denied. Ensure you have provided a valid Gemini API key as an environment variable and enabled microphone access.');
      setStatus(OracleStatus.IDLE);
    }
  };

  const handleToggle = () => {
    if (status === OracleStatus.IDLE) {
      startConversation();
    } else {
      stopConversation();
    }
  };

  if (!isFullscreen) {
    return (
      <div className="fixed inset-0 bg-[#050505] flex flex-col items-center justify-center p-8 z-[100] transition-all duration-700">
        <div className="relative mb-12 animate-in fade-in zoom-in duration-1000">
          <div className="absolute inset-0 bg-blue-600 blur-[140px] opacity-10" />
          <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          </div>
        </div>
        <h1 className="text-3xl font-black uppercase tracking-[0.6em] mb-4 text-white/90 text-center">Oracle System</h1>
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 mb-12 text-center max-w-xs leading-relaxed">
          The vocal link requires a full-screen environment to stabilize the interface.
        </p>
        <button
          onClick={enterFullscreen}
          className="group relative px-16 py-6 bg-white text-black rounded-full transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.15)]"
        >
          <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.5em]">Enter Full Screen</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-6 max-w-4xl mx-auto overflow-hidden animate-in fade-in duration-1000">
      <div className={`fixed inset-0 pointer-events-none transition-all duration-1000 ${status === OracleStatus.LISTENING ? 'bg-yellow-500/5' : 'bg-transparent'}`} />

      <div className="w-full flex justify-between items-center pb-8 border-b border-white/5 bg-[#050505]/50 backdrop-blur-sm z-30">
        <div className="flex flex-col">
          <h1 className="text-lg font-black tracking-[0.4em] text-white/90">ORACLE</h1>
          <span className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold">Protocol v3.0</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`w-1.5 h-1.5 rounded-full ${status === OracleStatus.LISTENING ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]' : 'bg-white/10'}`} />
          <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-bold">{status === OracleStatus.LISTENING ? 'LIVE' : 'IDLE'}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full py-8">
        <OracleCircle status={status} onClick={handleToggle} />
        
        <div className="mt-16 w-full h-56 flex flex-col items-center justify-center px-4">
          {error && <p className="text-red-400 text-[10px] mb-8 uppercase tracking-[0.3em] animate-pulse font-black bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">{error}</p>}
          
          {currentTurn ? (
            <div className="w-full max-w-xl space-y-6 animate-in fade-in duration-1000">
              {currentTurn.user && (
                <div className="flex flex-col items-end opacity-30">
                  <p className="text-sm md:text-base font-light tracking-wide text-blue-100 text-right italic">
                    "{currentTurn.user}"
                  </p>
                </div>
              )}
              {currentTurn.oracle && (
                <div className="flex flex-col items-start bg-white/[0.02] p-8 rounded-[2rem] border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
                  <span className="text-[8px] uppercase tracking-[0.4em] mb-4 text-yellow-500 font-black">Oracle</span>
                  <p className="text-base md:text-xl font-light tracking-wide text-white/90 text-left leading-relaxed">
                    {currentTurn.oracle}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full opacity-[0.02] pointer-events-none select-none">
              <p className="text-center font-extralight italic tracking-[1em] text-5xl uppercase">
                {status === OracleStatus.LISTENING ? 'Vocalizing' : 'Tap Oracle'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pb-10 flex flex-col items-center gap-2 select-none">
        <div className="w-1 h-1 bg-white/10 rounded-full" />
        <span className="text-[9px] uppercase tracking-[0.6em] text-white/20 font-black">
          BearBlueHub Architecture
        </span>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 0px; background: transparent; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); filter: blur(10px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        .animate-in { animation: fade-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
