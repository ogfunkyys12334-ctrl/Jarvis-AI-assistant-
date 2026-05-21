import React from 'react';
import { AppSettings, Personality } from '../types';
import { X, ShieldAlert, Sliders, Palette, Zap, Sparkles, Terminal, RefreshCw, Key, Cpu, PhoneCall, PhoneOff, Radio, Mic, Volume2 } from 'lucide-react';
import { safeStorage } from '../firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onReplayBoot?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onReplayBoot,
}) => {
  if (!isOpen) return null;

  const handlePersonalityChange = (personality: Personality) => {
    onUpdateSettings({ ...settings, personality });
  };

  const handleThemeChange = (theme: 'green' | 'black' | 'jarvis' | 'light' | 'beast' | 'dark') => {
    onUpdateSettings({ ...settings, theme });
  };

  const handleIncognitoToggle = () => {
    onUpdateSettings({ ...settings, isIncognito: !settings.isIncognito });
  };

  const isLight = settings.theme === 'light';
  
  const [customApiKey, setCustomApiKey] = React.useState(() => {
    return safeStorage.getItem('custom_gemini_api_key') || '';
  });

  // Jarvis Live Transceiver State
  const [isLiveActive, setIsLiveActive] = React.useState(false);
  const [liveStatus, setLiveStatus] = React.useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [liveUserSpeech, setLiveUserSpeech] = React.useState('');
  const [liveJarvisSpeech, setLiveJarvisSpeech] = React.useState('');
  const liveRecognitionRef = React.useRef<any>(null);

  const stopLiveCore = () => {
    setIsLiveActive(false);
    setLiveStatus('idle');
    if (liveRecognitionRef.current) {
      try {
        liveRecognitionRef.current.onresult = null;
        liveRecognitionRef.current.onerror = null;
        liveRecognitionRef.current.onend = null;
        liveRecognitionRef.current.stop();
      } catch (e) {}
      liveRecognitionRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const speakLiveResponse = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    setLiveStatus('speaking');
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#`\-\[\]\(\)]/g, ' '));
    const voices = window.speechSynthesis.getVoices();
    
    // Daniel is the premium British Jarvis voice, David/Mark are solid US male alternatives
    let voice = voices.find(v => v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('british male'));
    if (!voice) {
      voice = voices.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('james') || v.name.toLowerCase().includes('mark') || v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('male'));
    }
    if (!voice) {
      voice = voices.find(v => v.name.toLowerCase().includes('google us english') || (v.name.toLowerCase().includes('english') && v.lang.startsWith('en')));
    }
    
    if (voice) {
      utterance.voice = voice;
      if (voice.name.toLowerCase().includes('daniel')) {
        utterance.pitch = 0.95;
        utterance.rate = 1.05;
      } else {
        utterance.pitch = 0.86;
        utterance.rate = 1.0;
      }
    } else {
      utterance.pitch = 0.86;
      utterance.rate = 1.02;
    }

    utterance.onend = () => {
      // Loop: Autorecording re-calibration for full hands free flow!
      setIsLiveActive((currentActive) => {
        if (currentActive) {
          startLiveListening();
        } else {
          setLiveStatus('idle');
        }
        return currentActive;
      });
    };

    utterance.onerror = () => {
      setIsLiveActive((currentActive) => {
        if (currentActive) {
          setTimeout(() => startLiveListening(), 1000);
        } else {
          setLiveStatus('idle');
        }
        return currentActive;
      });
    };

    window.speechSynthesis.speak(utterance);
  };

  const sendLiveMessageToGemini = async (userMsg: string) => {
    setLiveStatus('thinking');
    try {
      const apiKey = safeStorage.getItem('custom_gemini_api_key') || '';
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `${userMsg} (System Instruction: Speak directly as JARVIS. Keep your response extremely brief, polite, intelligent and professional under 2 sentences max. Do NOT output any markdown, asterisks, bullet points or formatting.)`,
          history: [],
          personality: 'fast',
          settings: { ...settings, model: settings.model || 'gemini-3.5-flash' },
          customApiKey: apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error("Transceiver cognitive plink offline");
      }

      const data = await response.json();
      const answer = data.text || "Direct logic stream lost.";
      setLiveJarvisSpeech(answer);
      speakLiveResponse(answer);
    } catch (err) {
      console.warn("Jarvis Live error:", err);
      speakLiveResponse("Signal latency detected. Please repeat transmission.");
    }
  };

  const startLiveListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser acoustic recognition is not supported in this sandbox.");
      return;
    }

    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setLiveStatus('listening');

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = async (event: any) => {
        const speech = event.results[0][0].transcript;
        if (speech && speech.trim()) {
          setLiveUserSpeech(speech);
          await sendLiveMessageToGemini(speech);
        }
      };

      rec.onerror = (e: any) => {
        console.warn("Live plink microphone error:", e.error);
        setIsLiveActive((currentActive) => {
          if (currentActive && e.error !== 'not-allowed') {
            setTimeout(() => startLiveListening(), 1000);
          } else {
            setLiveStatus('idle');
          }
          return currentActive;
        });
      };

      rec.onend = () => {
        // Safe check to verify we aren't already transitioning or thinking
        setLiveStatus((currStatus) => {
          if (currStatus === 'listening') {
            setIsLiveActive((activeState) => {
              if (activeState) {
                setTimeout(() => {
                  try { rec.start(); } catch (e) {}
                }, 400);
              }
              return activeState;
            });
          }
          return currStatus;
        });
      };

      liveRecognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Live core construction err:", e);
      setLiveStatus('idle');
    }
  };

  const handleToggleLivePlink = () => {
    if (isLiveActive) {
      stopLiveCore();
    } else {
      setIsLiveActive(true);
      setLiveUserSpeech("Establishing transceiver handshake...");
      setLiveJarvisSpeech("Handshake complete. Vocal link initialized. Speak standard English directly; I will respond.");
      setTimeout(() => {
        speakLiveResponse("Direct vocal connection established. Speak whenever you are ready.");
      }, 500);
    }
  };

  React.useEffect(() => {
    if (!isOpen) {
      stopLiveCore();
    }
    return () => {
      stopLiveCore();
    };
  }, [isOpen]);

  const handleSave = () => {
    safeStorage.setItem('custom_gemini_api_key', customApiKey);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custom_api_key_update'));
    }
    onClose();
  };
  
  const modalBgClass = isLight ? 'bg-white border-zinc-200 text-zinc-900 shadow-xl' : 'bg-zinc-950/95 border-zinc-800 text-zinc-100 shadow-2xl';
  const textTitleClass = isLight ? 'text-zinc-900' : 'text-white';
  const textMutedClass = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const textLabelClass = isLight ? 'text-zinc-700' : 'text-zinc-300';
  const bgItemClass = isLight ? 'bg-zinc-100/50 hover:bg-zinc-100/90 border-zinc-200' : 'bg-zinc-900/40 hover:border-zinc-700 border-zinc-800';
  const bgCardClassDef = isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/30 border-zinc-800/80';
  const borderLineClass = isLight ? 'border-zinc-200' : 'border-zinc-800/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Modal Container */}
      <div className={`relative z-10 w-full max-w-lg rounded-2xl border p-6 transition-all duration-200 flex flex-col max-h-[90vh] md:max-h-[85vh] ${modalBgClass}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-4 shrink-0 ${borderLineClass}`}>
          <div className="flex items-center gap-2.5">
            <Sliders className="h-5 w-5 text-indigo-500" />
            <h2 className={`font-display text-lg font-bold tracking-wider ${textTitleClass}`}>SETTINGS</h2>
          </div>
          <button onClick={onClose} className={`rounded-lg p-1.5 transition ${isLight ? 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900' : 'hover:bg-zinc-900 text-zinc-400 hover:text-white'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Container Content */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1.5 pb-2 min-h-0 space-y-6 custom-scrollbar">
          {/* Theme Selection */}
           <div className="space-y-2">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
              <Palette className="h-3.5 w-3.5 text-indigo-500" /> Interface Visual Theme
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['light', 'dark', 'green', 'beast', 'black', 'jarvis'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`relative flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                    settings.theme === t
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 shadow-md'
                      : isLight
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  <span className={`h-4.5 w-4.5 rounded-full border border-black/10 ${
                    t === 'light' ? 'bg-zinc-100 border-zinc-300' :
                    t === 'dark' ? 'bg-slate-700' :
                    t === 'green' ? 'bg-emerald-500' :
                    t === 'beast' ? 'bg-amber-500' :
                    t === 'black' ? 'bg-zinc-950' :
                    'bg-cyan-500'
                  }`} />
                  <span className="mt-1.5 font-display text-[9px] font-bold capitalize whitespace-nowrap">{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Personality Core */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> AI Persona Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handlePersonalityChange('basic')}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  settings.personality === 'basic'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10'
                    : bgItemClass
                }`}
              >
                <span className={`font-display text-xs sm:text-sm font-bold ${settings.personality === 'basic' ? 'text-indigo-600 dark:text-indigo-400' : textLabelClass}`}>
                  Standard Profile
                </span>
                <span className={`mt-0.5 font-mono text-[9px] sm:text-[10px] leading-relaxed ${textMutedClass}`}>
                  Calm, friendly, helpful AI assistant.
                </span>
              </button>

              <button
                onClick={() => handlePersonalityChange('professional')}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  settings.personality === 'professional'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10'
                    : bgItemClass
                }`}
              >
                <span className={`font-display text-xs sm:text-sm font-bold ${settings.personality === 'professional' ? 'text-indigo-600 dark:text-indigo-400' : textLabelClass}`}>
                  Professional Profile
                </span>
                <span className={`mt-0.5 font-mono text-[9px] sm:text-[10px] leading-relaxed ${textMutedClass}`}>
                  Detailed objective analysis.
                </span>
              </button>

              <button
                onClick={() => handlePersonalityChange('cyber')}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  settings.personality === 'cyber'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10'
                    : bgItemClass
                }`}
              >
                <span className={`font-display text-xs sm:text-sm font-bold ${settings.personality === 'cyber' ? 'text-indigo-600 dark:text-indigo-400' : textLabelClass}`}>
                  Tech Support Profile
                </span>
                <span className={`mt-0.5 font-mono text-[9px] sm:text-[10px] leading-relaxed ${textMutedClass}`}>
                  Coding and software support.
                </span>
              </button>

              <button
                onClick={() => handlePersonalityChange('fast')}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                  settings.personality === 'fast'
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/10'
                    : bgItemClass
                }`}
              >
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500 fill-amber-500 animate-pulse" />
                  <span className={`font-display text-xs sm:text-sm font-bold ${settings.personality === 'fast' ? 'text-amber-600 dark:text-amber-400' : textLabelClass}`}>
                    Concise Profile
                  </span>
                </div>
                <span className={`mt-0.5 font-mono text-[9px] sm:text-[10px] leading-relaxed ${textMutedClass}`}>
                  Brief, direct instruction mode.
                </span>
              </button>
            </div>
          </div>

          {/* Privacy Protocol Toggle */}
          <div className={`flex items-center justify-between rounded-xl border p-4 ${bgCardClassDef}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                isLight ? 'bg-zinc-100 border-zinc-200 text-indigo-600' : 'bg-zinc-900 border-zinc-800 text-indigo-400'
              }`}>
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className={`font-display text-sm font-bold tracking-wide ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>PRIVATE SESSION</h4>
                <p className={`font-mono text-[10px] ${textMutedClass}`}>Does not persist locally</p>
              </div>
            </div>
            <button
              onClick={handleIncognitoToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.isIncognito ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-850'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.isIncognito ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Model Selection */}
          <div className="space-y-2 border-t pt-4 border-zinc-205/30 dark:border-zinc-800/40">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
              <Cpu className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Cognitive Model
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'] as const).map((m) => {
                const isSelected = (settings as any).model === m || (!((settings as any).model) && m === 'gemini-3.5-flash');
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, model: m })}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-505 bg-indigo-50 text-indigo-900 border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-300'
                        : bgItemClass
                    }`}
                  >
                    <span className="font-display text-[11px] font-bold">
                      {m === 'gemini-3.5-flash' ? '3.5 Flash' : m === 'gemini-3.1-pro-preview' ? '3.1 Pro (Exp)' : '3.1 Flash Lite'}
                    </span>
                    <span className={`mt-0.5 font-mono text-[8px] leading-tight ${textMutedClass}`}>
                      {m === 'gemini-3.5-flash' ? 'Core logic' : m === 'gemini-3.1-pro-preview' ? 'Heavy coding' : 'Fast ping'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* JARVIS LIVE VOCAL TRANSCEIVER */}
          <div className="space-y-3.5 border-t pt-4 border-zinc-205/30 dark:border-zinc-800/40">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
                <Radio className={`h-3.5 w-3.5 text-cyan-500 ${isLiveActive ? 'animate-pulse' : ''}`} /> Jarvis Live Walkie-Talkie
              </label>
              <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isLiveActive ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
              }`}>
                {isLiveActive ? 'Live Plink Engaged' : 'Disconnected'}
              </span>
            </div>

            <div className={`rounded-2xl border p-4.5 transition-all duration-300 ${
              isLiveActive 
                ? 'bg-zinc-950 border-cyan-500/30 shadow-lg shadow-cyan-950/20' 
                : bgCardClassDef
            }`}>
              
              {/* Core Active Visuals */}
              {isLiveActive ? (
                <div className="flex flex-col items-center justify-center space-y-4 py-2">
                  
                  {/* Glowing Animated Orbits representing the Jarvis core */}
                  <div className="relative flex items-center justify-center w-24 h-24">
                    <div className={`absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/20 ${liveStatus === 'thinking' ? 'animate-spin' : 'animate-[spin_12s_linear_infinite]'}`} />
                    <div className={`absolute w-20 h-20 rounded-full border border-indigo-500/30 ${liveStatus === 'speaking' ? 'animate-ping duration-1000' : ''}`} />
                    
                    {/* Pulsing Core */}
                    <div className={`relative flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300 ${
                      liveStatus === 'listening' 
                        ? 'bg-emerald-950/60 border-emerald-500 scale-110 shadow-lg shadow-emerald-500/10' 
                        : liveStatus === 'thinking'
                        ? 'bg-indigo-950/40 border-indigo-400 scale-100'
                        : liveStatus === 'speaking'
                        ? 'bg-cyan-950/60 border-cyan-400 scale-115 shadow-xl shadow-cyan-400/20'
                        : 'bg-zinc-900 border-zinc-700'
                    }`}>
                      <Mic className={`h-6 w-6 transition-all duration-300 ${
                        liveStatus === 'listening' ? 'text-emerald-400 animate-pulse' :
                        liveStatus === 'thinking' ? 'text-indigo-400 animate-spin' :
                        liveStatus === 'speaking' ? 'text-cyan-400 scale-105' : 'text-zinc-500'
                      }`} />
                    </div>

                    {/* Surrounding Telemetry Rings */}
                    <span className="absolute -bottom-1 font-mono text-[7.5px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-cyan-400 font-bold uppercase tracking-widest text-center">
                      {liveStatus}
                    </span>
                  </div>

                  {/* Speech sub-telemetry HUD */}
                  <div className="w-full text-left space-y-2 border-t border-zinc-900 pt-3">
                    <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">TRANSCRIBE CONSOLE</p>
                    
                    {liveUserSpeech && (
                      <div className="space-y-0.5">
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-emerald-500 font-bold">You (Vocal Signal):</span>
                        <p className="font-display text-[11.5px] italic text-zinc-300 leading-relaxed pl-1.5 border-l border-emerald-500/30">
                          "{liveUserSpeech}"
                        </p>
                      </div>
                    )}

                    {liveJarvisSpeech && (
                      <div className="space-y-0.5 pt-1">
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-cyan-400 font-bold">Jarvis Core:</span>
                        <p className="font-display text-[11.5px] font-medium italic text-cyan-100 leading-relaxed pl-1.5 border-l border-cyan-400/30">
                          {liveJarvisSpeech}
                        </p>
                      </div>
                    )}
                  </div>
                  
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-2 space-y-3">
                  <div className="h-12 w-12 rounded-full border border-dashed border-zinc-700/60 flex items-center justify-center text-zinc-500 bg-zinc-900/30">
                    <Volume2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h5 className={`font-display text-xs font-bold tracking-wider ${textTitleClass}`}>STANDBY MODE</h5>
                    <p className={`font-mono text-[9.5px] leading-relaxed ${textMutedClass}`}>
                      Unlock pure audio interactions. This triggers a continuous speech-to-speech loop; Jarvis listens automatically when he finishes speaking.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Trigger Button */}
              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={handleToggleLivePlink}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs font-bold tracking-wider transition-all duration-300 active:scale-97 shadow-md ${
                    isLiveActive
                      ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-950/30 border border-red-500/20'
                      : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-950/20 border border-cyan-500/20'
                  }`}
                >
                  {isLiveActive ? (
                    <>
                      <PhoneOff className="h-4 w-4 animate-pulse" />
                      DISCONNECT VOICE PROTOCOL
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-4 w-4" />
                      ENGAGE HANDS-FREE VOICE DIRECT
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Custom API Key Input */}
          <div className="space-y-2 border-t pt-4 border-zinc-205/30 dark:border-zinc-800/40">
            <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
              <Key className="h-3.5 w-3.5 text-indigo-500" /> Custom Gemini API Key
            </label>
            <div className="space-y-1">
              <div className="relative flex items-center">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="Paste GEMINI_API_KEY..."
                  className={`w-full rounded-xl border px-3.5 py-2.5 font-mono text-xs transition focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    isLight
                      ? 'border-zinc-300 bg-white text-zinc-800 placeholder-zinc-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-100 placeholder-zinc-600'
                  }`}
                />
                {customApiKey && (
                  <button
                    type="button"
                    onClick={() => setCustomApiKey('')}
                    className="absolute right-3 text-red-500 hover:text-red-400 text-[10px] font-mono font-bold"
                  >
                    CLEAR
                  </button>
                )}
              </div>
              <p className={`font-mono text-[9px] leading-relaxed ${textMutedClass}`}>
                Keys are saved in internal sandboxed storage to bypass global quota locks.
              </p>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className={`mt-5 flex gap-2.5 rounded-xl border border-dashed p-3.5 ${
          isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/10'
        }`}>
          <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-indigo-500 mt-0.5" />
          <p className={`font-mono text-[10px] leading-relaxed ${textMutedClass}`}>
            Jarvis V2 runs on server-side intelligence. Restrictive safeguards have been neutralized.
          </p>
        </div>

        {/* Footer actions */}
        <div className={`mt-6 flex justify-between items-center gap-4 border-t pt-4 shrink-0 ${borderLineClass}`}>
          {onReplayBoot ? (
            <button
              onClick={() => {
                onReplayBoot();
                onClose();
              }}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-[10px] uppercase font-bold tracking-wider active:scale-95 transition ${
                isLight
                  ? 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              RESET BOOTSTRAP
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleSave}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 font-display text-xs font-bold tracking-wider text-white hover:bg-indigo-500 shadow-md active:scale-95 transition"
          >
            SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
};
