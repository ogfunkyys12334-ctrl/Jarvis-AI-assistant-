export type MessageRole = 'user' | 'assistant';
export type Personality = 'basic' | 'professional' | 'cyber' | 'fast' | 'beast';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'movie' | 'app';
  mediaUrl?: string;
  timestamp: number;
  sources?: { title: string; url: string }[];
  attachments?: Attachment[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export interface MovieSettings {
  aspectRatio: '16:9' | '9:16' | '1:1';
  resolution: '720p' | '1080p';
  style: 'cinematic' | 'anime' | 'realistic' | '3d-render';
}

export interface AppSettings {
  personality: Personality;
  language: string;
  isIncognito: boolean;
  theme: 'green' | 'black' | 'jarvis' | 'light' | 'beast' | 'dark';
  movie: MovieSettings;
  app: {
    platform: 'android' | 'ios' | 'pwa';
    theme: 'modern' | 'minimal' | 'cyber';
    viewMode: 'laptop' | 'mobile';
  };
}

export interface GenerationState {
  isGenerating: boolean;
  progress?: string;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}
