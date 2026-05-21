import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Lazy initializer for GoogleGenAI
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. API: Chat Route
app.post('/api/chat/message', async (req, res) => {
  const { message, history, personality, settings, options, customApiKey } = req.body;

  try {
    // Determine the Personality instruction
    let systemInstruction = 'You are Jarvis V2, an elite, helpful, friendly, and highly intelligent AI assistant. Provide extremely detailed, beautifully formatted, objective, and helpful responses.';
    if (personality === 'professional') {
      systemInstruction = 'You are Jarvis V2 in Professional Analyst mode. Speak in a precise, structured, objective, and scholarly tone, optimizing your responses with absolute rigor, clear lists, and formatting.';
    } else if (personality === 'cyber') {
      systemInstruction = 'You are Jarvis V2 in Tech Advisor mode. Provide expert software engineering guidance, technical insights, clear instructions, and clean, well-documented code samples.';
    } else if (personality === 'fast') {
      systemInstruction = 'You are Jarvis V2 in Concise mode. Provide extremely rapid, direct, clear, and highly focused answers, completely avoiding any fluff, intro, or filler text.';
    }

    // Try Gemini API first (Lazy & resilient)
    try {
      const client = getGeminiClient(customApiKey);
      
      const contents = history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const config: any = {
        systemInstruction,
        temperature: personality === 'fast' ? 0.2 : 0.7,
      };

      // Apply search or map tools if selected
      if (options?.enableSearch) {
        config.tools = [{ googleSearch: {} }];
      } else if (options?.enableMaps) {
        config.tools = [{ googleMaps: {} }];
        if (options.latitude && options.longitude) {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: options.latitude,
                longitude: options.longitude
              }
            }
          };
        }
      }

      const response = await client.models.generateContent({
        model: settings?.model || 'gemini-3.5-flash',
        contents,
        config
      });

      const textOutput = response.text || "No response received.";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = chunks?.map((c: any) => {
        if (c.web) {
          return { title: c.web.title, url: c.web.uri };
        } else if (c.maps) {
          return { title: c.maps.title, url: c.maps.uri };
        }
        return null;
      }).filter(Boolean) || [];

      return res.json({ text: textOutput, sources });
    } catch (geminiError: any) {
      const errStr = typeof geminiError === 'object' ? (geminiError.message || JSON.stringify(geminiError)) : String(geminiError);
      console.warn("Gemini execution failed or unconfigured, attempting OpenRouter/MiniMax fallback...", errStr);
      
      const isQuotaExceeded = errStr.includes('429') || errStr.includes('quota') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('limit');
      
      let fallbackText = "";
      let usedFallback = false;

      // Fallback: OpenRouter / MiniMax M2.5
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.MINIMAX_MODEL || 'minimax/minimax-m2.5:free',
              messages: [
                { role: 'system', content: systemInstruction },
                ...history.map((h: any) => ({ role: h.role, content: h.content })),
                { role: 'user', content: message }
              ]
            }),
          });

          if (response.ok) {
            const completion = await response.json();
            fallbackText = completion.choices?.[0]?.message?.content || "";
            if (fallbackText) {
              usedFallback = true;
            }
          }
        } catch (ofErr) {
          console.error("OpenRouter fallback fetch failed:", ofErr);
        }
      }

      if (usedFallback) {
        let prefix = "";
        if (isQuotaExceeded) {
          prefix = `⚠️ **Gemini API Quota Exceeded (429)**: The default shared API key has reached its limit.\n\nTo restore lightning-fast native Gemini generation instantly, please add your personal \`GEMINI_API_KEY\` in **Settings > Secrets**.\n\n---\n\n`;
        }
        return res.json({ text: prefix + fallbackText });
      }

      // Final local conversational simulation if all API keys are missing/failed
      let replyMessage = "";
      const isIntro = /hello|hey|hi|who are you|how are you/i.test(message);
      
      if (personality === 'cyber') {
        replyMessage = isIntro 
          ? `Hello! I am Jarvis V2, your tech assistant. Currently, I am running in offline simulated mode. To unlock full modern AI capabilities, please set up your GEMINI_API_KEY in Settings > Secrets.` 
          : `I received your tech query: "${message}". Since I am currently operating offline, please configure process.env.GEMINI_API_KEY in your secrets tab to enable live intelligence.`;
      } else if (personality === 'fast') {
        replyMessage = isIntro
          ? `Jarvis V2 Concise Mode online. Running local simulator. Configure GEMINI_API_KEY inside secrets for live processing.`
          : `Execution complete (Local Simulator). Query received: "${message}". Please configure your API secrets for active generation.`;
      } else {
        replyMessage = isIntro
          ? `Hello there! I am Jarvis V2, your friendly and helpful AI assistant. I am currently running in local offline demo mode. You can unlock fully integrated active reasoning by configuring your GEMINI_API_KEY in the Settings secrets panel.`
          : `That is an interesting topic: "${message}". Since I am running in local offline standby mode, once you configure the GEMINI_API_KEY in the secrets tab, we will be able to perform live AI analysis!`;
      }

      if (isQuotaExceeded) {
        replyMessage = `⚠️ **Gemini API Quota Exceeded (429)**: The default shared API key has reached its limit.\n\nTo restore lightning-fast native Gemini generation instantly, please add your personal \`GEMINI_API_KEY\` in your **Settings > Secrets** panel.\n\n---\n\n*Offline Response Mode:*\n${replyMessage}`;
      } else {
        const isKeyMissing = errStr.includes('is not configured') || errStr.includes('apiKey is required') || errStr.includes('API key not found');
        if (isKeyMissing) {
          replyMessage = `ℹ **API Key Ready to Configure**: Configure your personal \`GEMINI_API_KEY\` in the **Settings > Secrets** panel of AI Studio to enable live intelligent processing.\n\n---\n\n*Offline Response Mode:*\n${replyMessage}`;
        }
      }

      return res.json({ text: replyMessage });
    }
  } catch (err: any) {
    console.error("API Error in chat execution:", err);
    res.status(500).json({ error: err.message || "Failed to process chat" });
  }
});

// 2. API: Image Generation Route
app.post('/api/generate-image', async (req, res) => {
  const { prompt, aspectRatio, customApiKey } = req.body;

  try {
    try {
      const client = getGeminiClient(customApiKey);
      
      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || '1:1'
          }
        }
      });

      let base64Image = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (base64Image) {
        return res.json({ url: `data:image/png;base64,${base64Image}` });
      }
      throw new Error("No image data returned from Gemini");
    } catch (geminiImgErr: any) {
      console.warn("Gemini image generation failed or unconfigured, utilizing fallback graphic...", geminiImgErr.message);

      // Creative local high-tech fallback SVG based on client's design rules
      const svgGraphic = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
          <rect width="600" height="600" fill="#050505"/>
          <circle cx="300" cy="300" r="260" stroke="#14b8a6" stroke-width="1.5" stroke-dasharray="10 5" fill="none" opacity="0.4"/>
          <circle cx="300" cy="300" r="200" stroke="#0ea5e9" stroke-width="2.5" fill="none"/>
          <circle cx="300" cy="300" r="20" fill="#22d3ee" filter="drop-shadow(0 0 10px #22d3ee)"/>
          <path d="M 120 300 Q 300 120 480 300 Q 300 480 120 300 Z" stroke="#10b981" stroke-width="2" fill="none"/>
          <text x="300" y="470" fill="#38bdf8" font-family="'Space Grotesk', monospace" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="4">JARVIS V2 PREVIEW</text>
          <text x="300" y="510" fill="#64748b" font-family="'JetBrains Mono', monospace" font-size="11" text-anchor="middle">Prompt: "${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}"</text>
          <path d="M 230 300 L 250 320 L 290 280 L 370 360" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" fill="none" stroke-dasharray="250" stroke-dashoffset="0"/>
        </svg>
      `;
      const base64Svg = Buffer.from(svgGraphic).toString('base64');
      return res.json({ url: `data:image/svg+xml;base64,${base64Svg}` });
    }
  } catch (err: any) {
    console.error("Image API failure:", err);
    res.status(500).json({ error: err.message || "Failed to generate image asset" });
  }
});

// Configure Vite dynamic middleware server for developer convenience and boot server
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    console.log("Configuring development environment via dynamic Vite dev middleware...");
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), './')
        }
      }
    });
    
    app.use(vite.middlewares);
    
    const getIndexHtml = () => {
      return fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    };
    
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = getIndexHtml();
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production server assets delivery
    console.log("Configuring production environment serving static build assets...");
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist/index.html'));
    });
  }

  // Fixed execution port strictly matching ecosystem instructions
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS Mainframe core deployed at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal error bootstrapping JARVIS Core:", err);
});
