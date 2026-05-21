import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Terminal, Sparkles, Send, Mic, Play, Settings, Compass, HelpCircle,
  Clock, LogIn, Maximize2, ShieldAlert, Image, Globe, MapPin, User,
  Volume2, VolumeX, Menu, Plus, Key, HelpCircle as HelpIcon, Trash2, Zap
} from 'lucide-react';
import {
  onAuthStateChanged, signInWithPopup, signOut, isFirebaseConfigured, auth, googleProvider,
  collection, addDoc, onSnapshot, query, orderBy, db, deleteDoc, safeStorage, safeSessionStorage
} from './firebase';
import { sendChatMessage, generateMediaImage } from './services/gemini';
import { HistorySidebar } from './components/HistorySidebar';
import { SettingsModal } from './components/SettingsModal';
import { MediaDisplay } from './components/MediaDisplay';
import { AppSettings, ChatSession, Message, Personality } from './types';
import ReactMarkdown from 'react-markdown';

// Prompt Suggestions
const JARVIS_SUGGESTIONS = [
  { text: "Create an image of a serene mountain lake during sunset", type: "image", icon: Image },
  { text: "Draft a polite email request for a deadline extension", type: "text", icon: Terminal },
  { text: "Search for highly rated tech hubs or cafes nearby", type: "location", icon: MapPin },
  { text: "Explain deep learning neural networks in simple analogies", type: "text", icon: Sparkles }
];

export default function App() {
  // 1. Core Loader States (Defaulted to loaded instantly for a seamless normal assistant experience)
  const [bootProgress, setBootProgress] = useState(100);
  const [bootStage, setBootStage] = useState<'BOOTING' | 'LOADING' | 'READY' | 'COMPLETED'>('COMPLETED');
  const [eyeOpenRatio, setEyeOpenRatio] = useState(1);
  const [bootText, setBootText] = useState('System ready.');
  const [isAppLoaded, setIsAppLoaded] = useState(true);

  // 2. Main Interface States
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted so voice synthesis doesn't talk unexpectedly

  // Config defaults
  const [settings, setSettings] = useState<AppSettings>({
    personality: 'basic',
    language: 'en',
    isIncognito: false,
    theme: 'light', // Default to normal elegant clean light theme
    movie: { aspectRatio: '16:9', resolution: '1080p', style: 'cinematic' },
    app: { platform: 'android', theme: 'cyber', viewMode: 'laptop' }
  });

  // Chat parameters
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // Custom tool toggles
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableMaps, setEnableMaps] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Track coordinates for eye flutter during booting
  const [flutterTime, setFlutterTime] = useState(0);

  // --- 1. Booting Animation Engine ---
  useEffect(() => {
    if (isAppLoaded) return;

    let timer: any;
    let progressInterval: any;
    let eyeTimer: any;

    // Flutter path calculations during pure booting phase (0s - 3s)
    let animateFlutter = setInterval(() => {
      setFlutterTime(prev => prev + 0.1);
    }, 100);

    // Timeline control
    progressInterval = setInterval(() => {
      setBootProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        
        let increment = 1.2;
        if (prev > 35 && prev < 75) increment = 0.8; // Slow down in mid boot
        if (prev > 85) increment = 1.6; // High performance calibration sprint
        return Math.min(prev + increment, 100);
      });
    }, 80);

    // Stage 1: Booting (Closed twitching eye)
    setBootStage('BOOTING');
    setBootText('System Core: JARVIS is booting...');
    setEyeOpenRatio(0);

    // Stage 2: Loading (Eyes smoothly peel open)
    timer = setTimeout(() => {
      setBootStage('LOADING');
      setBootText('Mainframe Online. JARVIS is loading...');
      
      // Animate eye-open ratio linearly from 0 to 1 over 3 seconds
      eyeTimer = setInterval(() => {
        setEyeOpenRatio(prev => {
          if (prev >= 1) {
            clearInterval(eyeTimer);
            return 1;
          }
          return prev + 0.04;
        });
      }, 100);
    }, 3200);

    // Stage 3: Ready (Wide glowing eyes)
    const readyTimer = setTimeout(() => {
      setBootStage('READY');
      setBootText('Neural Synapses Aligned. Calibration Complete.');
      setEyeOpenRatio(1);
    }, 6500);

    // Stage 4: App Open
    const finalTimer = setTimeout(() => {
      setBootStage('COMPLETED');
      setIsAppLoaded(true);
      try {
        safeStorage.setItem('jarvis_boot_done', 'true');
        safeSessionStorage.setItem('jarvis_boot_done_session', 'true');
      } catch (e) {
        console.warn("Write blocked inside iframe sandbox", e);
      }
      if (typeof window !== 'undefined') {
        (window as any).__jarvis_boot_done_global = true;
      }
      
      // Speech welcome greeting
      if (isSpeechSupported && !isMuted) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance("Welcome back, operator. JARVIS system protocols completely online.");
        utter.rate = 1.05;
        utter.pitch = 0.95;
        window.speechSynthesis.speak(utter);
      }
    }, 8700);

    return () => {
      clearTimeout(timer);
      clearTimeout(readyTimer);
      clearTimeout(finalTimer);
      clearInterval(progressInterval);
      clearInterval(animateFlutter);
      if (eyeTimer) clearInterval(eyeTimer);
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel();
      }
    };
  }, [isAppLoaded]);

  // Update flutter noise when eye is booting shut
  useEffect(() => {
    if (bootStage === 'BOOTING') {
      const wiggle = Math.sin(flutterTime * 2) * 0.03;
      setEyeOpenRatio(Math.max(0, wiggle));
    }
  }, [flutterTime, bootStage]);

  // --- 2. Location Gathering ---
  useEffect(() => {
    if (enableMaps && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          console.log("Device coordinates synced for Maps grounding:", pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.log("Geolocation retrieval blocked. Standard region grounding applied.", err)
      );
    }
  }, [enableMaps]);

  // --- 3. Firebase Auth sync ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (userCred: any) => {
      if (userCred) {
        setUser({
          uid: userCred.uid,
          displayName: userCred.displayName || 'Authorized Operator',
          email: userCred.email || 'operator@jarvis.mainframe',
          photoURL: userCred.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'
        });
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  // --- 4. Load Chat Sessions from Firebase / LocalFallback ---
  useEffect(() => {
    if (authChecking) return;

    let qRef;
    if (isFirebaseConfigured && db && user) {
      // Synced database
      qRef = query(collection(db, 'sessions'), orderBy('timestamp', 'desc'));
    } else {
      // Local database
      qRef = { path: 'sessions', type: 'collection' };
    }

    const unsub = onSnapshot(qRef, (snapshot: any) => {
      const fetched: ChatSession[] = [];
      snapshot.forEach((doc: any) => {
        fetched.push({ id: doc.id, ...doc.data() });
      });

      // Maintain sorting locally
      fetched.sort((a, b) => b.timestamp - a.timestamp);

      setSessions(fetched);
      if (fetched.length > 0 && !activeSessionId) {
        setActiveSessionId(fetched[0].id);
      }
    });

    return () => unsub();
  }, [user, authChecking]);

  // --- 5. Fetch Messages for Active Thread ---
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    let qRef;
    if (isFirebaseConfigured && db && user) {
      qRef = query(
        collection(db, `sessions/${activeSessionId}/messages`),
        orderBy('timestamp', 'asc')
      );
    } else {
      qRef = { path: `sessions/${activeSessionId}/messages`, type: 'collection' };
    }

    const unsub = onSnapshot(qRef, (snapshot: any) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc: any) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
    });

    return () => unsub();
  }, [activeSessionId, user]);

  // Scroll messages safely is now deactivated to prevent unwanted jumpy interface behaviors
  useEffect(() => {
    // Disabled auto scrolling down per user preference
    // messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // --- 6. Auth Actions ---
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Authentication handshake failed:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    } catch (err) {
      console.error("Deauthorization handshake failed:", err);
    }
  };

  const handleReplayBoot = () => {
    try {
      safeStorage.removeItem('jarvis_boot_done');
      safeSessionStorage.removeItem('jarvis_boot_done_session');
    } catch (e) {
      console.warn("Storage access failed", e);
    }
    if (typeof window !== 'undefined') {
      delete (window as any).__jarvis_boot_done_global;
    }
    setBootProgress(0);
    setBootStage('BOOTING');
    setEyeOpenRatio(0);
    setIsAppLoaded(false);
  };

  // --- 7. Session Actions ---
  const handleCreateNewThread = async (titleOfThread = 'Dynamic Command Line') => {
    const threadData = {
      title: titleOfThread,
      timestamp: Date.now(),
      userId: user?.uid || 'anonymous_local_channel'
    };

    try {
      let ref;
      if (isFirebaseConfigured && db && user) {
        ref = await addDoc(collection(db, 'sessions'), threadData);
      } else {
        ref = await addDoc({ path: 'sessions', type: 'collection' }, threadData);
      }
      setActiveSessionId(ref.id);
      return ref.id;
    } catch (err) {
      console.error("Failed to create thread:", err);
    }
  };

  const handleDeleteSession = async (sessionIdToDelete: string) => {
    try {
      let ref;
      if (isFirebaseConfigured && db && user) {
        ref = { path: `sessions/${sessionIdToDelete}`, type: 'doc' };
      } else {
        ref = { path: `sessions/${sessionIdToDelete}`, type: 'doc' };
      }
      await deleteDoc(ref);
      if (activeSessionId === sessionIdToDelete) {
        setActiveSessionId(null);
      }
    } catch (err) {
      console.error("Purge failure:", err);
    }
  };

  const handleWipeAllData = async () => {
    try {
      if (isFirebaseConfigured && db && user) {
        for (const s of sessions) {
          await deleteDoc({ path: `sessions/${s.id}`, type: 'doc' });
        }
      }
      safeStorage.removeItem('local_sessions_list');
      sessions.forEach(s => {
        safeStorage.removeItem(`local_msg_sessions/${s.id}/messages`);
        safeStorage.removeItem(`doc_sessions/${s.id}`);
      });
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
    } catch (err) {
      console.error("Critical wipe database failure:", err);
    }
  };

  // --- 8. Speech Transcription & Synthesis ---
  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Acoustic Recognition is not natively supported in this sandbox browser. We recommend using Google Chrome.");
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Silences speech when user wishes to talk
      
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setThinkingStage('Awaiting acoustic modulation...');
      };

      rec.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        if (speechResult) {
          setInputMessage(speechResult);
          // Auto-submit command for true futuristic vocal response capability
          setTimeout(() => {
            handleDispatchCommand(speechResult);
          }, 400);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error("Speech Recognition build failure:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn("Failed to stop recognition nicely:", err);
      }
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const speakVoiceOutput = (textToSpeak: string) => {
    if (!isSpeechSupported || isMuted) return;
    try {
      // Clean markdown tags beforehand so voice is clean
      const cleaned = textToSpeak.replace(/[*_#`\-\[\]\(\)]/g, ' ');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      
      const voices = window.speechSynthesis.getVoices();
      
      // Select best male classy Jarvis voice (Daniel is the legendary class-A butler voice, David is standard)
      let voice = voices.find(v => v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('british male')); 
      if (!voice) {
        voice = voices.find(v => v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('james') || v.name.toLowerCase().includes('mark') || v.name.toLowerCase().includes('guy') || v.name.toLowerCase().includes('male'));
      }
      if (!voice) {
        voice = voices.find(v => v.name.toLowerCase().includes('google us english') || (v.name.toLowerCase().includes('english') && v.lang.startsWith('en')));
      }
      if (!voice) {
        voice = voices.find(v => v.lang.startsWith('en'));
      }
      
      if (voice) {
        utterance.voice = voice;
        // Jarvis typical sound profile tuning: slightly deeper pitch, confident and calm speed rate.
        if (voice.name.toLowerCase().includes('daniel')) {
          utterance.pitch = 0.95;
          utterance.rate = 1.05;
        } else {
          utterance.pitch = 0.86; // Deeper pitch to simulate deep male voice for standard ones
          utterance.rate = 1.0;
        }
      } else {
        utterance.pitch = 0.86;
        utterance.rate = 1.02;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (speechErr) {
      console.warn("Speech Synthesis engine failure:", speechErr);
    }
  };

  // --- 9. Command Dispatcher (AI chat + Image trigger) ---
  const handleDispatchCommand = async (payloadOverride?: string) => {
    const activeText = payloadOverride || inputMessage;
    if (!activeText.trim()) return;

    setInputMessage('');
    setIsThinking(true);
    setThinkingStage('Calibrating neural registers...');

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const cleanTitle = activeText.length > 25 ? `${activeText.slice(0, 25)}...` : activeText;
      currentSessionId = await handleCreateNewThread(cleanTitle) || null;
    }

    if (!currentSessionId) {
      setIsThinking(false);
      return;
    }

    // Save User message
    const userMsg: Omit<Message, 'id'> = {
      role: 'user',
      content: activeText,
      type: 'text',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, { id: 'temp_user_msg', ...userMsg } as Message]);

    try {
      let ref;
      if (isFirebaseConfigured && db && user) {
        ref = collection(db, `sessions/${currentSessionId}/messages`);
      } else {
        ref = { path: `sessions/${currentSessionId}/messages`, type: 'collection' };
      }
      await addDoc(ref, userMsg);
    } catch (err) {
      console.error("Fail writing user command:", err);
    }

    // Action execution routing
    const isImageQuery = /generate image|draw|create image|photograph|render/i.test(activeText);

    if (isImageQuery) {
      setThinkingStage('Synthesizing light values...');
      try {
        const result = await generateMediaImage(activeText, '1:1');
        
        const assistantMsg: Omit<Message, 'id'> = {
          role: 'assistant',
          content: `Holographic visual synthesized in local deck workspace based on instruction: "${activeText}".`,
          type: 'image',
          mediaUrl: result.url,
          timestamp: Date.now()
        };

        let ref;
        if (isFirebaseConfigured && db && user) {
          ref = collection(db, `sessions/${currentSessionId}/messages`);
        } else {
          ref = { path: `sessions/${currentSessionId}/messages`, type: 'collection' };
        }
        await addDoc(ref, assistantMsg);
        speakVoiceOutput("Visual render processed successfully.");
      } catch (err: any) {
        console.error("Synthesizer errored:", err);
        const assistantMsgErr: Omit<Message, 'id'> = {
          role: 'assistant',
          content: `Mainframe synthesizer failed: ${err.message || "Unspecified stream interruption."}`,
          type: 'text',
          timestamp: Date.now()
        };
        
        let ref;
        if (isFirebaseConfigured && db && user) {
          ref = collection(db, `sessions/${currentSessionId}/messages`);
        } else {
          ref = { path: `sessions/${currentSessionId}/messages`, type: 'collection' };
        }
        await addDoc(ref, assistantMsgErr);
      }
    } else {
      // Text grounding swap
      setThinkingStage('Querying quantum layers...');
      try {
        const historyContext = messages.slice(-8).map(m => ({
          role: m.role,
          content: m.content
        }));

        const result = await sendChatMessage(
          activeText,
          historyContext,
          settings.personality,
          settings,
          {
            enableSearch,
            enableMaps,
            latitude: userLocation?.lat,
            longitude: userLocation?.lng
          }
        );

        const assistantMsg: Omit<Message, 'id'> = {
          role: 'assistant',
          content: result.text,
          type: 'text',
          timestamp: Date.now(),
          sources: result.sources
        };

        let ref;
        if (isFirebaseConfigured && db && user) {
          ref = collection(db, `sessions/${currentSessionId}/messages`);
        } else {
          ref = { path: `sessions/${currentSessionId}/messages`, type: 'collection' };
        }
        await addDoc(ref, assistantMsg);
        speakVoiceOutput(result.text);
      } catch (err: any) {
        console.error("Logical routing core fail:", err);
        const assistantMsgErr: Omit<Message, 'id'> = {
          role: 'assistant',
          content: `Cognitive core interrupted: ${err.message || "Fatal mainframe logic loop."}`,
          type: 'text',
          timestamp: Date.now()
        };
        
        let ref;
        if (isFirebaseConfigured && db && user) {
          ref = collection(db, `sessions/${currentSessionId}/messages`);
        } else {
          ref = { path: `sessions/${currentSessionId}/messages`, type: 'collection' };
        }
        await addDoc(ref, assistantMsgErr);
      }
    }

    setIsThinking(false);
  };

  // --- Dynamic UI Class Resolvers ---
  const getThemeClass = () => {
    switch (settings.theme) {
      case 'dark':
        return {
          bg: 'bg-[#0b0f17] text-zinc-100',
          panel: 'bg-[#111723] border-[#1d273b] text-zinc-200',
          accent: 'text-indigo-400 border-indigo-500/20 bg-indigo-950/20',
          btn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
          glow: 'shadow-glow-indigo',
          input: 'bg-[#0d121c] border-[#1d273b] text-zinc-100 placeholder-zinc-500'
        };
      case 'green':
        return {
          bg: 'bg-[#030703] text-emerald-400',
          panel: 'bg-[#060c06] border-emerald-950 text-emerald-300',
          accent: 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20',
          btn: 'bg-emerald-600 hover:bg-emerald-500 text-black',
          glow: 'shadow-glow-emerald',
          input: 'bg-[#040804] border-emerald-950/50 text-emerald-100 placeholder-emerald-800'
        };
      case 'beast':
        return {
          bg: 'bg-[#070402] text-amber-500',
          panel: 'bg-[#0d0905] border-amber-950 text-amber-400',
          accent: 'text-amber-500 border-amber-500/20 bg-amber-950/20',
          btn: 'bg-amber-500 hover:bg-amber-400 text-black',
          glow: 'shadow-glow-amber',
          input: 'bg-[#080503] border-amber-950/50 text-amber-100 placeholder-amber-800'
        };
      case 'light':
        return {
          bg: 'bg-zinc-50 text-zinc-800',
          panel: 'bg-white border-zinc-200 text-zinc-700',
          accent: 'text-indigo-600 border-indigo-200 bg-indigo-50',
          btn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
          glow: 'shadow-md',
          input: 'bg-zinc-100 border-zinc-200 text-zinc-900 placeholder-zinc-400'
        };
      case 'black':
        return {
          bg: 'bg-[#020202] text-zinc-200',
          panel: 'bg-[#090909] border-zinc-920 text-zinc-300',
          accent: 'text-zinc-200 border-zinc-800 bg-zinc-900/40',
          btn: 'bg-zinc-100 hover:bg-white text-black',
          glow: 'shadow-none',
          input: 'bg-[#050505] border-zinc-900 text-zinc-100 placeholder-zinc-600'
        };
      default: // jarvis
        return {
          bg: 'bg-[#03080f] text-cyan-400',
          panel: 'bg-[#050c18] border-cyan-950 text-cyan-300',
          accent: 'text-cyan-400 border-cyan-500/20 bg-cyan-950/20',
          btn: 'bg-cyan-500 hover:bg-cyan-400 text-black',
          glow: 'shadow-glow-cyan',
          input: 'bg-[#040915] border-cyan-950/50 text-cyan-100 placeholder-cyan-900'
        };
    }
  };

  const curThemeList = getThemeClass();

  return (
    <div className={`relative flex h-screen w-screen overflow-hidden ${curThemeList.bg}`}>
      
      {/* 1. INITIAL JARVIS BOOTLOADER / ANIMATED HUMAN-EYE STARTUP SCREEN */}
      <AnimatePresence>
        {!isAppLoaded && (
          <motion.div
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black p-6 text-white overflow-hidden select-none"
          >
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.03)_0%,transparent_70%)]" />

            <div className="relative flex flex-col items-center max-w-xl w-full">
              {/* TWO HUMAN EYES SIDE-BY-SIDE WITH EYEBROWS */}
              <div className="flex gap-8 md:gap-12 justify-center items-center mb-16 relative">
                
                {/* LEFT EYE */}
                <div className="flex flex-col items-center gap-4">
                  {/* Left Eyebrow */}
                  <motion.div 
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 0.95 }}
                    transition={{ delay: 0.5, duration: 1.5 }}
                    className="w-24 h-4 bg-white rounded-full opacity-90 blur-[0.2px] shadow-[0_0_15px_rgba(255,255,255,0.7),0_0_25px_rgba(6,182,212,0.3)] origin-center"
                    style={{ transform: 'rotate(-4deg)' }}
                  />
                  {/* Left Eye SVG */}
                  <div className="relative h-24 w-40 overflow-hidden rounded-[40%] bg-black shadow-[0_0_20px_rgba(6,182,212,0.45)] border border-zinc-900">
                    <svg
                      viewBox="0 0 200 120"
                      className="h-full w-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <radialGradient id="irisGradientLeft" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="50%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#0891b2" />
                        </radialGradient>
                        <clipPath id="leftEyeClipPath">
                          <path
                            d={`M 15 60 Q 100 ${60 - eyeOpenRatio * 44} 185 60 Q 100 ${60 + eyeOpenRatio * 44} 15 60 Z`}
                          />
                        </clipPath>
                      </defs>

                      {/* Closed outline guideline */}
                      <path
                        d="M 15 60 Q 100 60 185 60"
                        stroke="#1e293b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                      />

                      {/* Eyeball clipped to eye opening */}
                      <g clipPath="url(#leftEyeClipPath)">
                        {/* White Sclera */}
                        <rect x="0" y="0" width="200" height="120" fill="#ffffff" />
                        
                        {/* Iris */}
                        <circle cx="100" cy="60" r="30" fill="url(#irisGradientLeft)" />
                        
                        {/* Iris detailing */}
                        <circle cx="100" cy="60" r="22" stroke="#0e7490" strokeWidth="2" fill="none" opacity="0.4" />
                        
                        {/* Pupil */}
                        <circle cx="100" cy="60" r="14" fill="#000000" />
                        
                        {/* Highlights */}
                        <circle cx="95" cy="55" r="3.5" fill="#ffffff" opacity="0.9" />
                        <circle cx="104" cy="64" r="1.5" fill="#ffffff" opacity="0.6" />
                      </g>

                      {/* Eyelid frame outlines */}
                      <path
                        d={`M 15 60 Q 100 ${60 - eyeOpenRatio * 44} 185 60`}
                        stroke={bootStage === 'BOOTING' ? '#334155' : '#000000'}
                        strokeWidth="5"
                        fill="none"
                      />
                      <path
                        d={`M 15 60 Q 100 ${60 + eyeOpenRatio * 44} 185 60`}
                        stroke={bootStage === 'BOOTING' ? '#334155' : '#000000'}
                        strokeWidth="5"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>

                {/* RIGHT EYE */}
                <div className="flex flex-col items-center gap-4">
                  {/* Right Eyebrow */}
                  <motion.div 
                    initial={{ y: 5, opacity: 0 }}
                    animate={{ y: 0, opacity: 0.95 }}
                    transition={{ delay: 0.5, duration: 1.5 }}
                    className="w-24 h-4 bg-white rounded-full opacity-90 blur-[0.2px] shadow-[0_0_15px_rgba(255,255,255,0.7),0_0_25px_rgba(6,182,212,0.3)] origin-center"
                    style={{ transform: 'rotate(4deg)' }}
                  />
                  {/* Right Eye SVG */}
                  <div className="relative h-24 w-40 overflow-hidden rounded-[40%] bg-black shadow-[0_0_20px_rgba(6,182,212,0.45)] border border-zinc-900">
                    <svg
                      viewBox="0 0 200 120"
                      className="h-full w-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <radialGradient id="irisGradientRight" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#22d3ee" />
                          <stop offset="50%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#0891b2" />
                        </radialGradient>
                        <clipPath id="rightEyeClipPath">
                          <path
                            d={`M 15 60 Q 100 ${60 - eyeOpenRatio * 44} 185 60 Q 100 ${60 + eyeOpenRatio * 44} 15 60 Z`}
                          />
                        </clipPath>
                      </defs>

                      {/* Closed outline guideline */}
                      <path
                        d="M 15 60 Q 100 60 185 60"
                        stroke="#1e293b"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        fill="none"
                      />

                      {/* Eyeball clipped to eye opening */}
                      <g clipPath="url(#rightEyeClipPath)">
                        {/* White Sclera */}
                        <rect x="0" y="0" width="200" height="120" fill="#ffffff" />
                        
                        {/* Iris */}
                        <circle cx="100" cy="60" r="30" fill="url(#irisGradientRight)" />
                        
                        {/* Iris detailing */}
                        <circle cx="100" cy="60" r="22" stroke="#0e7490" strokeWidth="2" fill="none" opacity="0.4" />
                        
                        {/* Pupil */}
                        <circle cx="100" cy="60" r="14" fill="#000000" />
                        
                        {/* Highlights */}
                        <circle cx="95" cy="55" r="3.5" fill="#ffffff" opacity="0.9" />
                        <circle cx="104" cy="64" r="1.5" fill="#ffffff" opacity="0.6" />
                      </g>

                      {/* Eyelid frame outlines */}
                      <path
                        d={`M 15 60 Q 100 ${60 - eyeOpenRatio * 44} 185 60`}
                        stroke={bootStage === 'BOOTING' ? '#334155' : '#000000'}
                        strokeWidth="5"
                        fill="none"
                      />
                      <path
                        d={`M 15 60 Q 100 ${60 + eyeOpenRatio * 44} 185 60`}
                        stroke={bootStage === 'BOOTING' ? '#334155' : '#000000'}
                        strokeWidth="5"
                        fill="none"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Title & Progress Bar from Screenshot */}
              <div className="w-full text-center space-y-6">
                <motion.h1
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-mono text-xl sm:text-2xl font-bold tracking-[6px] text-cyan-400 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                >
                  JARVIS IS BOOTING...
                </motion.h1>

                {/* Progress bar container */}
                <div className="relative h-2 max-w-sm mx-auto w-full bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${bootProgress}%` }}
                    transition={{ ease: "easeOut" }}
                    className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. CHAT SESSION COMPILATION WRAPPER */}
      {isAppLoaded && (
        <div className="flex h-full w-full flex-row overflow-hidden relative">
          
          {/* Dashboard overlay line scanlines */}
          <div className="jarvis-scanline" />

          {/* Sidebar */}
          <HistorySidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={setActiveSessionId}
            onDeleteSession={handleDeleteSession}
            onNewSession={handleCreateNewThread}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onLogout={handleLogout}
            onWipeAllData={handleWipeAllData}
            onSendSystemCommand={handleDispatchCommand}
            user={user}
            theme={settings.theme}
          />

          {/* Main Workspace Frame */}
          <main className="flex flex-1 flex-col overflow-hidden relative z-10">
            {/* Main Header navigation bar */}
            <header className={`flex h-16 shrink-0 items-center justify-between border-b ${curThemeList.panel} px-6 z-20`}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="rounded-lg p-2.5 hover:bg-zinc-900 transition lg:hidden"
                  title="Reveal database threads index"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
                      Jarvis V2
                    </span>
                    <span className="rounded-full bg-indigo-50 dark:bg-zinc-900 border border-indigo-100 dark:border-zinc-800 px-2 py-0.5 font-mono text-[9px] font-bold text-indigo-600 dark:text-indigo-400 capitalize">
                      {settings.personality}
                    </span>
                  </div>
                </div>
              </div>

              {/* Utility shortcuts */}
              <div className="flex items-center gap-2">
                {/* Voice mute toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`rounded-lg p-2.5 bg-transparent border border-transparent transition hover:bg-zinc-900 ${
                    isMuted ? 'text-zinc-600' : curThemeList.accent
                  }`}
                  title={isMuted ? "Voice synthesis disabled" : "Voice synthesis enabled"}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 animate-pulse" />}
                </button>

                {/* Configuration settings button */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  id="settings-trigger-btn"
                  className="rounded-lg p-2.5 bg-transparent border border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 transition"
                  title="Mainframe control settings"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {/* Authentication prompt */}
                {!user ? (
                  <button
                    onClick={handleLogin}
                    id="login-trigger-btn"
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-display text-xs font-bold tracking-wider text-black max-sm:px-2 rounded-xl active:scale-95 transition"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">AUTHORIZE CLIENT</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="h-8 w-8 rounded-full border border-zinc-700 max-sm:hidden"
                    />
                  </div>
                )}
              </div>
            </header>

            {/* Conversation Grid Pane */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {messages.length === 0 ? (
                /* Primary Suggestion interface when session is blank */
                <div className="flex h-full flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
                  {/* Beautiful Sparkles Logo */}
                  <div className="flex items-center justify-center mb-6 p-4">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 shadow-lg shadow-indigo-500/5">
                      <Sparkles className="h-8 w-8 animate-pulse text-indigo-600" />
                    </div>
                  </div>
                  
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
                    What can I help you with today?
                  </h2>
                  <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
                    Jarvis V2 is your helpful, intelligent, and smart AI companion, ready to write, code, search, or generate diagrams and images. Choose a quick start prompt below.
                  </p>

                  {/* Suggestion list */}
                  <div className="mt-8 grid grid-cols-1 gap-3 w-full sm:grid-cols-2">
                    {JARVIS_SUGGESTIONS.map((suggestion, index) => {
                      const IconComp = suggestion.icon;
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            setInputMessage(suggestion.text);
                            handleDispatchCommand(suggestion.text);
                          }}
                          className={`flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition duration-200 hover:scale-[1.02] ${curThemeList.input}`}
                        >
                          <div className={`rounded-lg p-2 ${curThemeList.accent}`}>
                            <IconComp className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="font-display text-sm font-bold text-slate-800 dark:text-zinc-100">{suggestion.text}</p>
                            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-indigo-500">
                              Quick start {suggestion.type} assistant
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Actual rendered message logs */
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.map((msg) => {
                    const isAssistant = msg.role === 'assistant';
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-4 ${isAssistant ? '' : 'flex-row-reverse'}`}
                      >
                        {/* Avatar */}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                          isAssistant
                            ? `${curThemeList.accent} border-cyan-500/10`
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                        }`}>
                          {isAssistant ? <Terminal className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>

                        {/* Content Speech Bubble wrapper fitted to theme */}
                        <div className={`flex flex-col max-w-[85%] ${isAssistant ? '' : 'items-end'}`}>
                          <div className={`rounded-2xl border px-5 py-3.5 leading-relaxed text-[14.5px] ${
                            isAssistant
                              ? `${curThemeList.panel} text-zinc-200`
                              : `${curThemeList.accent} text-white font-medium`
                          }`}>
                            
                            {/* ReactMarkdown rendering for rich math output */}
                            <ReactMarkdown className="prose prose-invert max-w-none text-zinc-200 prose-sm font-display prose-headings:font-display prose-p:leading-relaxed prose-code:font-mono prose-code:bg-zinc-950/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                              {msg.content}
                            </ReactMarkdown>

                            {/* Dynamic generated media delivery context */}
                            {msg.mediaUrl && (
                              <MediaDisplay url={msg.mediaUrl} type={msg.type} theme={settings.theme} />
                            )}
                          </div>

                          {/* Render Grounding sources */}
                          {isAssistant && msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {msg.sources.map((src, sIdx) => (
                                <a
                                  key={sIdx}
                                  href={src.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1 font-mono text-[9px] text-[#06b6d4] hover:text-[#22d3ee] hover:border-zinc-700 transition"
                                >
                                  <Globe className="h-3 w-3" />
                                  <span className="truncate max-w-[120px]">{src.title}</span>
                                </a>
                              ))}
                            </div>
                          )}
                          
                          {/* Metadata time labels */}
                          <span className="mt-1.5 font-mono text-[9.5px] text-zinc-600">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Operational loading / thinking state */}
                  {isThinking && (
                    <div className="flex gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${curThemeList.accent}`}>
                        <div className="h-5 w-5 rounded-full border-2 border-dashed border-cyan-400 rotate-clock animate-spin" />
                      </div>
                      <div className={`flex flex-col border border-dashed border-zinc-800 bg-zinc-950/20 px-5 py-4 rounded-2xl max-w-[85%]`}>
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 stroke-[1.5] text-cyan-400" />
                          <span className="font-mono text-xs uppercase tracking-widest text-[#06b6d4]">{thinkingStage}</span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-zinc-500 animate-pulse">Computing alternative possibilities on current registers...</p>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Action Panel Footer bar */}
            <div className={`border-t ${curThemeList.panel} bg-black/10 p-4`}>
              <div className="max-w-4xl mx-auto space-y-3">
                
                {/* Advanced tool toggle panel */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/60 pb-2">
                  <div className="flex flex-wrap gap-2.5">
                    
                    {/* Google Search grounding tool */}
                    <button
                      onClick={() => setEnableSearch(!enableSearch)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] font-bold transition ${
                        enableSearch
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-zinc-850 bg-zinc-900/10 text-zinc-500 hover:text-zinc-300'
                      }`}
                      title="Ground query in Google Web Search indices"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      SEARCH CORES
                    </button>

                    {/* Google Maps grounding tool */}
                    <button
                      onClick={() => setEnableMaps(!enableMaps)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] font-bold transition ${
                        enableMaps
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-zinc-850 bg-zinc-900/10 text-zinc-500 hover:text-zinc-300'
                      }`}
                      title="Apply physical geographic boundaries"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      COORD LINK
                    </button>
                  </div>

                  {settings.personality === 'fast' && (
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-amber-500 px-2 py-0.5 rounded bg-amber-950/20 border border-amber-500/20">
                      <Zap className="h-3 w-3 animate-pulse fill-amber-500" />
                      BEAST MATRIX COGNITION ENGAGED
                    </div>
                  )}
                </div>

                {/* Actual command entry container */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleDispatchCommand();
                  }}
                  className="flex gap-2.5 items-center relative"
                >
                  <input
                    type="text"
                    onChange={(e) => setInputMessage(e.target.value)}
                    value={inputMessage}
                    id="user-input-field"
                    placeholder={settings.personality === 'fast' ? "INPUT DIRECTIVE COMMAND..." : "Speak command to JARVIS..."}
                    className={`flex-1 rounded-xl border px-4 py-3.5 font-display text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${curThemeList.input}`}
                  />

                  {/* Mic / voice input trigger with dynamic visual state */}
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`rounded-xl p-3 relative transition-all duration-300 ${
                      isListening
                        ? 'bg-red-600 text-white border border-red-500 shadow-md shadow-red-400'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-white'
                    }`}
                    title={isListening ? "Listening... Click to terminate calibration" : "Engage vocal recognition system"}
                  >
                    {isListening && (
                      <span className="absolute -inset-1.5 rounded-xl bg-red-500/45 animate-ping" />
                    )}
                    <Mic className={`h-4.5 w-4.5 relative z-10 ${isListening ? 'scale-110' : ''}`} />
                  </button>

                  {/* Submission dispatch */}
                  <button
                    type="submit"
                    className={`rounded-xl p-3.5 font-bold transition active:scale-95 flex items-center justify-center ${curThemeList.btn}`}
                    title="Dispatch commands to core matrix"
                  >
                    <Send className="h-4.5 w-4.5" />
                  </button>
                </form>
              </div>
            </div>
          </main>

          {/* Model Settings dialogue */}
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={setSettings}
            onReplayBoot={handleReplayBoot}
          />
        </div>
      )}
    </div>
  );
}
