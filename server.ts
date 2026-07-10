import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please configure it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Endpoint to optimize user prompt
app.post("/api/optimize", async (req, res) => {
  try {
    const { prompt, mode = "balanced" } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "A non-empty prompt string is required." });
    }

    const ai = getGeminiClient();

    let modeInstruction = "";
    if (mode === "aggressive") {
      modeInstruction = "Prune aggressively. Remove all fluff, unnecessary context, and polite phrasing. Make it as concise as possible while retaining only the core instruction and critical variables.";
    } else if (mode === "conservative") {
      modeInstruction = "Prune carefully. Focus on removing wordiness, redundancy, and filler, but keep detailed constraints and context intact.";
    } else {
      modeInstruction = "Prune in a balanced way. Keep all essential details, formatting rules, and constraints, but remove filler, repetitive requests, polite preambles, and conversational fluff.";
    }

    const systemInstruction = `You are an expert Prompt Pruning Optimizer.
Your job is to optimize LLM prompts to be extremely concise, direct, and token-efficient, while preserving the user's original intent, core meaning, context, and key parameters.

Follow these strict rules:
1. NEVER change or dilute the user's core intent.
2. NEVER remove important facts, figures, names, specific constraints, or example formatting.
3. Remove repeated phrases, filler words, unnecessary adjectives, polite preambles ("Please do this...", "I would like you to..."), and self-referential fluff.
4. Improve clarity, structural formatting, and readability. Use bullet points or code blocks if they make the prompt more readable.
5. Mode for this optimization: ${modeInstruction}
6. Provide accurate estimates of the percentage reduction in token count and a quality score out of 100 based on conciseness and intent preservation.
7. List specifically what was removed, simplified, and preserved.`;

    const contents = `Please optimize this prompt:
"${prompt}"`;

    let response;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        originalPrompt: { type: Type.STRING },
        optimizedPrompt: { type: Type.STRING },
        removed: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Items, phrases, or conversational preambles removed from the original prompt."
        },
        simplified: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Phrases, instructions, or sentences that were rewritten for brevity."
        },
        preserved: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Key facts, criteria, numbers, formatting rules, or constraints that were preserved to maintain intent."
        },
        estimatedTokenReduction: {
          type: Type.INTEGER,
          description: "Percentage reduction in token/word length (0-100)."
        },
        qualityScore: {
          type: Type.INTEGER,
          description: "Overall quality score of the optimized prompt (0-100), based on clarity, structural improvement, and intent preservation."
        },
        reason: {
          type: Type.STRING,
          description: "Brief summary explaining how the prompt was optimized."
        }
      },
      required: [
        "originalPrompt",
        "optimizedPrompt",
        "removed",
        "simplified",
        "preserved",
        "estimatedTokenReduction",
        "qualityScore",
        "reason"
      ]
    };

    while (attempts < maxAttempts) {
      try {
        const modelToUse = attempts === 0 ? "gemini-3.5-flash" : "gemini-3.1-flash-lite";
        console.log(`Sending content generation request using model: ${modelToUse} (Attempt ${attempts + 1}/${maxAttempts})`);
        response = await ai.models.generateContent({
          model: modelToUse,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema
          }
        });
        break; // Success!
      } catch (err: any) {
        attempts++;
        lastError = err;
        console.warn(`Gemini API attempt ${attempts} failed:`, err.message || err);
        
        const errMsg = (err.message || "").toLowerCase();
        const isRetryable = 
          errMsg.includes("503") || 
          errMsg.includes("unavailable") || 
          errMsg.includes("demand") || 
          errMsg.includes("overloaded") || 
          errMsg.includes("rate limit") || 
          errMsg.includes("429");
        
        if (isRetryable && attempts < maxAttempts) {
          // Exponential backoff
          const delay = 1000 * attempts;
          console.log(`Temporary API bottleneck detected. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to generate content after multiple attempts.");
    }

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini API.");
    }

    const result = JSON.parse(text);
    res.json(result);
  } catch (error: any) {
    console.error("API error in /api/optimize:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred." });
  }
});

// Configure Vite or static assets depending on environment
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

init();
