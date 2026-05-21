import React, { useState } from 'react';
import { Eye, Clock, Download, ExternalLink } from 'lucide-react';

interface MediaDisplayProps {
  url: string;
  type: 'image' | 'video' | 'audio' | 'movie' | 'app';
  title?: string;
  theme?: string;
}

export const MediaDisplay: React.FC<MediaDisplayProps> = ({
  url,
  type,
  title,
  theme,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getBorderColor = () => {
    switch (theme) {
      case 'green': return 'border-emerald-500/30 hover:border-emerald-500/80';
      case 'beast': return 'border-amber-500/30 hover:border-amber-500/80';
      case 'light': return 'border-indigo-600/30 hover:border-indigo-600/80';
      default: return 'border-cyan-500/30 hover:border-cyan-500/80';
    }
  };

  const getOverlayBg = () => {
    switch (theme) {
      case 'light': return 'bg-white/90';
      default: return 'bg-black/80';
    }
  };

  const textHeading = theme === 'light' ? 'text-zinc-900' : 'text-white';
  const textSub = theme === 'light' ? 'text-zinc-600' : 'text-zinc-400';

  if (type === 'image') {
    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative mt-3.5 max-w-sm overflow-hidden rounded-xl border ${getBorderColor()} bg-zinc-950 transition-all duration-300 ease-out`}
      >
        <img
          src={url}
          alt={title || "Generated holographic visualization"}
          className="h-full w-full object-cover max-h-[350px] transition-transform duration-500 hover:scale-105"
        />

        {/* Hover Action Overlay */}
        <div className={`absolute inset-0 flex flex-col justify-between p-4 transition-all duration-300 ${
          isHovered ? 'opacity-100 backdrop-blur-sm' : 'opacity-0'
        } ${getOverlayBg()}`}>
          <div className="flex items-center justify-between">
            <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-[#06b6d4]">
              JARVIS RENDER
            </span>
            <div className="flex gap-1.5">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                title="Open in dynamic tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={url}
                download={`jarvis_render_${Date.now()}.png`}
                className="rounded-lg p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                title="Download quantum master asset"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display text-sm font-bold truncate text-white">{title || "Quantum Asset"}</h4>
            <p className="mt-0.5 font-mono text-[10px] text-zinc-400">Resolution: 1024x1024. Aspect Ratio: 1:1</p>
          </div>
        </div>
      </div>
    );
  }

  // General audio player
  if (type === 'audio') {
    return (
      <div className={`mt-3.5 p-4 rounded-xl border ${getBorderColor()} bg-zinc-950/60 flex flex-col gap-2 max-w-md`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span className="font-display text-xs font-bold text-zinc-200">JARVIS CORE AUDIO SYNTHESIS</span>
          </div>
          <span className="font-mono text-[9px] bg-cyan-950/30 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800/20">24000Hz PCM</span>
        </div>
        <audio controls src={url} className="w-full mt-2" />
      </div>
    );
  }

  return null;
};
