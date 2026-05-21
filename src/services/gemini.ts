import { Message, Personality, AppSettings } from '../types';
import { safeStorage } from '../firebase';

export interface ChatOptions {
  enableSearch?: boolean;
  enableMaps?: boolean;
  latitude?: number;
  longitude?: number;
  useFallbackModel?: boolean; // If true, use OpenRouter / MiniMax M2.5
}

export async function sendChatMessage(
  messageText: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  personality: Personality,
  settings: AppSettings,
  options: ChatOptions = {}
): Promise<{ text: string; sources?: { title: string; url: string }[]; mediaType?: 'image' | 'text' }> {
  try {
    const customApiKey = safeStorage.getItem('custom_gemini_api_key') || '';
    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageText,
        history,
        personality,
        settings,
        options,
        customApiKey,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

export async function generateMediaImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '3:4' | '4:3' = '1:1'
): Promise<{ url: string }> {
  try {
    const customApiKey = safeStorage.getItem('custom_gemini_api_key') || '';
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, aspectRatio, customApiKey }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Image generation failed' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}
