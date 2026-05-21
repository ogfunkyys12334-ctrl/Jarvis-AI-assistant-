import React from 'react';
import { ChatSession } from '../types';
import { MessageSquare, Trash2, Plus, Sparkles, LogOut, Terminal, Layers, Globe, Radio, Eye, Compass } from 'lucide-react';

interface HistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onWipeAllData: () => void;
  onSendSystemCommand?: (cmd: string) => void;
  user: any;
  theme: string;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  isOpen,
  onClose,
  onLogout,
  onWipeAllData,
  onSendSystemCommand,
  user,
  theme
}) => {
  const [satCoords, setSatCoords] = React.useState({ lat: 34.0522, lng: -118.2437, alt: 421.4, speed: 27584 });

  React.useEffect(() => {
    const intv = setInterval(() => {
      setSatCoords(prev => {
        let nextLat = prev.lat + (Math.random() - 0.5) * 0.08;
        let nextLng = prev.lng + (Math.random() - 0.5) * 0.08;
        if (nextLat > 90) nextLat = -90;
        if (nextLat < -90) nextLat = 90;
        if (nextLng > 180) nextLng = -180;
        if (nextLng < -180) nextLng = 180;
        return {
          lat: parseFloat(nextLat.toFixed(4)),
          lng: parseFloat(nextLng.toFixed(4)),
          alt: parseFloat((prev.alt + (Math.random() - 0.5) * 0.2).toFixed(1)),
          speed: Math.round(prev.speed + (Math.random() - 0.5) * 4)
        };
      });
    }, 4000);
    return () => clearInterval(intv);
  }, []);

  // Theme color styling mapper
  const getThemeColor = () => {
    switch (theme) {
      case 'green': return 'text-emerald-400 hover:text-emerald-300';
      case 'jarvis': return 'text-cyan-400 hover:text-cyan-300';
      case 'beast': return 'text-amber-500 hover:text-amber-400';
      case 'light': return 'text-indigo-600 hover:text-indigo-500';
      default: return 'text-zinc-300 hover:text-white';
    }
  };

  const borderClass = theme === 'light' ? 'border-zinc-200' : 'border-zinc-800';
  const bgClass = theme === 'light' ? 'bg-white' : 'bg-zinc-950/95';
  const itemHoverClass = theme === 'light' ? 'hover:bg-zinc-100' : 'hover:bg-zinc-900/50';

  return (
    <>
      {/* Mobile Backing Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Main Sidebar Layout */}
      <aside
        id="history-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r ${borderClass} ${bgClass} transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header Branding */}
        <div className={`flex h-16 items-center justify-between border-b ${borderClass} px-5`}>
          <div className="flex items-center gap-2.5">
            <div className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${
              theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-950/30 text-indigo-400'
            }`}>
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-cyan-400">
               JARVIS V2
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-zinc-800 lg:hidden"
            title="Close sidebar"
          >
            <Plus className="h-5 w-5 transform rotate-45 text-zinc-500 hover:text-zinc-200" />
          </button>
        </div>

        {/* Action button – New Chat */}
        <div className="p-4">
          <button
            onClick={() => {
              onNewSession();
              onClose();
            }}
            id="new-chat-btn"
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-display text-sm font-semibold tracking-wider transition-all duration-200 ${
              theme === 'light'
                ? 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 hover:shadow-sm'
                : 'border-zinc-800 bg-zinc-900/40 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            <Plus className="h-4 w-4" />
            NEW CHAT
          </button>
        </div>

        {/* Sessions thread scroll */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            RECENT CHATS
          </div>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 stroke-[1.2] text-zinc-600 mb-2" />
              <p className="font-mono text-xs text-zinc-500">No active threads</p>
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              let activeBg = 'bg-zinc-900/80 border-l-2 border-cyan-500';
              if (theme === 'light') activeBg = 'bg-indigo-50 text-indigo-900 border-l-2 border-indigo-600';
              if (theme === 'beast') activeBg = 'bg-zinc-900/80 border-l-2 border-amber-500';

              return (
                <div
                  key={sess.id}
                  className={`group relative flex items-center justify-between rounded-lg transition-all duration-150 ${
                    isActive ? activeBg : `${itemHoverClass} text-zinc-400 hover:text-zinc-200`
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(sess.id);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left font-display text-sm truncate"
                  >
                    <MessageSquare className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-cyan-400' : 'text-zinc-600 group-hover:text-zinc-400'
                    }`} />
                    <span className="truncate pr-4 font-medium">{sess.title}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(sess.id);
                    }}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-opacity duration-150"
                    title="Delete Chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* SATELLITE INTEL PANEL */}
        <div className={`mx-4 my-2.5 rounded-xl border p-4 font-mono text-xs ${
          theme === 'light'
            ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
            : 'bg-black/40 border-zinc-800/60 text-zinc-350'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="font-display text-[10px] font-extrabold tracking-widest text-cyan-400">GEOSPATIAL-6 ACTIVE</span>
            </div>
            <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold">ONLINE</span>
          </div>

          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">LATITUDE</span>
              <span className="font-mono font-bold">{satCoords.lat > 0 ? `${satCoords.lat}° N` : `${Math.abs(satCoords.lat)}° S`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">LONGITUDE</span>
              <span className="font-mono font-bold">{satCoords.lng > 0 ? `${satCoords.lng}° E` : `${Math.abs(satCoords.lng)}° W`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ALTITUDE</span>
              <span className="font-mono">{satCoords.alt} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">ORBIT SPEED</span>
              <span className="font-mono">{satCoords.speed.toLocaleString()} km/h</span>
            </div>
          </div>

          {/* Interactive controls */}
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            <button
              onClick={() => {
                if (onSendSystemCommand) {
                  onSendSystemCommand(`Analyze live geospatial orbital telemetry diagnostics at: Latitude ${satCoords.lat}, Longitude ${satCoords.lng}. Perform detailed terrain, environment and infrastructure analytics.`);
                }
              }}
              className={`flex items-center justify-center gap-1 rounded bg-zinc-900/40 dark:bg-zinc-900 border border-zinc-700/60 p-1.5 text-[9px] font-bold tracking-wider hover:bg-zinc-250 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition active:scale-95`}
              title="Query Satellite Data"
            >
              <Compass className="h-3 w-3 text-cyan-400" />
              TRANSMIT
            </button>
            <button
              onClick={() => {
                if (onSendSystemCommand) {
                  onSendSystemCommand(`generate image of deep satellite photogrammetry scanner output showing the earth surface from space at Latitude ${satCoords.lat}, Longitude ${satCoords.lng}, futuristic hud borders, highly detailed satellite photorealistic style`);
                }
              }}
              className={`flex items-center justify-center gap-1 rounded bg-cyan-950/20 border border-cyan-850 p-1.5 text-[9px] font-bold tracking-wider text-cyan-400 hover:bg-cyan-950/40 transition active:scale-95`}
              title="Capture Image of Satellite Location"
            >
              <Eye className="h-3 w-3" />
              SNAP IMAGE
            </button>
          </div>
        </div>

        {/* Universal Footer section with Wipe All Data and/or User */}
        <div className={`mt-auto border-t ${borderClass} p-4 space-y-3`}>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to absolute-wipe ALL chats and database records? This cannot be undone.")) {
                onWipeAllData();
              }
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-mono text-[11px] font-bold tracking-wider transition-all duration-150 active:scale-95 ${
              theme === 'light'
                ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-red-950/30 bg-red-950/10 text-red-500 hover:bg-red-950/20 hover:text-red-400'
            }`}
            title="Wipe database history"
          >
            <Trash2 className="h-3.5 w-3.5" />
            WIPE ALL DATA
          </button>

          {user && (
            <div className={`flex items-center justify-between rounded-xl p-3 ${
              theme === 'light' ? 'bg-zinc-50 border border-zinc-200' : 'bg-black/20'
            }`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
                  alt={user.displayName || 'Authorized User'}
                  className="h-10 w-10 rounded-full border border-zinc-700 object-cover"
                />
                <div className="overflow-hidden">
                  <h4 className={`font-display text-sm font-bold tracking-wide truncate ${theme === 'light' ? 'text-zinc-850' : 'text-zinc-100'}`}>
                    {user.displayName || 'User'}
                  </h4>
                  <p className="font-mono text-[10px] text-zinc-500 truncate">
                    {user.email || 'offline@jarvis.ai'}
                  </p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className={`rounded-lg p-2 ${getThemeColor()} bg-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-900 transition`}
                title="De-authorize session"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
