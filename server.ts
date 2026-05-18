import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  const PRIVATE_AI_URL = "http://40.233.117.141:11434/api/generate";

  async function askPrivateAI(prompt: string, systemInstruction: string) {
    try {
      const fullPrompt = `${systemInstruction}\n\n${prompt}`;
      const response = await fetch(PRIVATE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5:0.5b",
          prompt: fullPrompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Private AI error: ${response.status}`);
      }

      const data: any = await response.json();
      return data.response;
    } catch (error) {
      console.error("Failed to connect to Private AI:", error);
      throw error;
    }
  }

  // API routes go here FIRST
  console.log("[Server] Registering API routes...");
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/ai/summarize", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });

      const systemInstruction = "You are 'Wind', an expert AI educational assistant for students at LAUTECH. Give highly accurate, concise, and academically sound responses.";
      const prompt = `Summarize this text for a LAUTECH student, focusing on core concepts and potential exam questions: \n\n${text}`;
      
      const summary = await askPrivateAI(prompt, systemInstruction);
      res.json({ summary });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { text, context } = req.body;
      const systemInstruction = "You are 'Wind', an expert AI educational assistant for students at LAUTECH. Give highly accurate, concise, and academically sound responses.";
      const prompt = `Explain this concept simply for a student: "${text}". \n\nContext: ${context}`;
      
      const explanation = await askPrivateAI(prompt, systemInstruction);
      res.json({ explanation });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to explain concept" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { query, libraryContext } = req.body;
      const systemInstruction = "You are 'Wind', an expert AI educational assistant for students at LAUTECH. Give highly accurate, concise, and academically sound responses. Always cite your sources from the library context using [Source Title] notation.";
      const prompt = `User Question: "${query}"\n\nRelevant Library Context: ${libraryContext}`;
      
      const aiResponse = await askPrivateAI(prompt, systemInstruction);
      res.json({ response: aiResponse });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to generate AI response" });
    }
  });

  // Multimodal Live API (WebSocket)
  const wss = new WebSocketServer({ server, path: "/api/live" });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to Live API");
    
    let session: any;

    clientWs.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.setup) {
          const { libraryContext } = message.setup;
          session = await ai.live.connect({
            model: "gemini-2.0-flash-exp",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoide" } },
              },
              systemInstruction: `You are 'Wind', an expert AI educational assistant for students at LAUTECH. Give highly accurate, concise, and academically sound responses.
              Speak at a crisp, natural, and slightly brisk pace with a clear tone. do not sound deep or slow.
              Always cite your sources from the library context using [Source Title] notation.
              Relevant Library Context: ${libraryContext}`
            },
            callbacks: {
              onmessage: (msg: LiveServerMessage) => {
                const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ audio }));
                }
                if (msg.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
                const transcription = msg.serverContent?.modelTurn?.parts?.[0]?.text;
                if (transcription) {
                   clientWs.send(JSON.stringify({ transcription }));
                }
              },
            },
          });
          console.log("Gemini Live Session connected");
          clientWs.send(JSON.stringify({ status: "ready" }));
        } else if (message.audio && session) {
          session.sendRealtimeInput({
            audio: { data: message.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (err) {
        console.error("WS Error:", err);
      }
    });

    clientWs.on("close", () => {
      if (session) session.close();
      console.log("Client disconnected from Live API");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Bootstrapped successfully`);
    console.log(`[Server] Running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

console.log("[Server] Starting initialization...");
startServer().catch(err => {
  console.error("[Server] Critical startup error:", err);
  process.exit(1);
});
