import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("La chiave API 'GEMINI_API_KEY' non è configurata. Assicurati di aver aggiunto la variabile d'ambiente 'GEMINI_API_KEY' nelle impostazioni del tuo progetto su Vercel (Environment Variables) e di aver effettuato un nuovo deploy.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// API routes
app.post("/api/ai-draw", async (req, res) => {
  try {
      const { prompt, basePosition } = req.body;
      
      const systemInstruction = 
        "Sei un assistente CAD professionale che progetta forme geometriche parametriche e disegni tecnici 2D.\n" +
        "Il tuo compito è convertire la descrizione dell'utente in un disegno parametrico scritto in un semplice linguaggio DSL.\n\n" +
        "Le regole del DSL sono le seguenti:\n" +
        "1. Puoi dichiarare variabili parametriche all'inizio del file, ad esempio:\n" +
        "   LARGHEZZA = 120\n" +
        "   ALTEZZA = 80\n" +
        "   RAGGIO = 15\n\n" +
        "2. Puoi disegnare elementi geometrici inserendo un comando per riga. Puoi utilizzare le variabili dichiarate nei parametri delle coordinate e dimensioni, risolvendo semplici espressioni matematiche (es: LARGHEZZA/2 o -ALTEZZA/2).\n" +
        "Le coordinare devono essere relative al centro (0, 0).\n" +
        "I comandi supportati sono:\n" +
        "   - LINE x1 y1 x2 y2 [colore] [spessore_linea] [layer] [dashed_bool]\n" +
        '     Esempio: LINE -LARGHEZZA/2 -ALTEZZA/2 LARGHEZZA/2 -ALTEZZA/2 "#000000" 1\n' +
        "   - CIRCLE cx cy r [colore] [spessore_linea] [layer]\n" +
        '     Esempio: CIRCLE 0 0 RAGGIO "#ef4444" 2.5\n' +
        "   - RECTANGLE x1 y1 x2 y2 [colore] [spessore_linea] [layer]\n" +
        '     Esempio: RECTANGLE -LARGHEZZA/2 -ALTEZZA/2 LARGHEZZA/2 ALTEZZA/2 "#000000" 1\n' +
        "   - ARC cx cy r startAngle endAngle [colore] [spessore_linea] [layer]\n" +
        '     Esempio: ARC 0 0 50 0 180 "#000000" 1\n' +
        "   - POINT x y [colore] [layer]\n" +
        '   - TEXT x y textContent [fontSize] [colore] [layer] [fontWeight]\n' +
        '     Esempio: TEXT 0 0 "Tavolo" 14 "#000000" "0" "bold"\n\n' +
        "Crea sempre il disegno centrato intorno alla coordinata (0,0), in modo che l'utente possa poi traslarlo o posizionarlo dove desidera.\n" +
        "Aggiungi commenti chiari (usando #) nel codice DSL per spiegare ogni sezione del disegno (es. # Contorno tavolo, # Sedie superiori).\n\n" +
        "Restituisci la risposta esclusivamente in formato JSON valido, secondo questo schema:\n" +
        "{\n" +
        '  "explanation": "Spiegazione in italiano del disegno generato e dei parametri utilizzati.",\n' +
        '  "parameters": [\n' +
        '    { "name": "NOME_VARIABILE", "value": DEFAULT_NUMBER, "label": "Label leggibile in italiano" }\n' +
        '  ],\n' +
        '  "script": "Il codice DSL completo con le dichiarazioni delle variabili in alto e i comandi di disegno in basso."\n' +
        "}";

      const response = await getAi().models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Genera una rappresentazione parametrica per: "${prompt}"`,
          config: {
              systemInstruction,
              responseMimeType: "application/json"
          }
      });

      const text = response.text || "{}";
      const result = JSON.parse(text);
      res.json(result);
  } catch (error: any) {
      console.error("Gemini AI-draw generation error:", error);
      res.status(500).json({ error: error?.message || "Errore durante la generazione del disegno parametrico" });
  }
});

// IP rate limiting for AI renders (10 per day per IP)
const aiRenderIpLimits = new Map<string, { date: string; count: number }>();

const getClientIp = (req: any): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded)) {
      return forwarded[0].trim();
    }
  }
  return req.socket.remoteAddress || "unknown_ip";
};

app.post("/api/ai-render", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const todayStr = new Date().toLocaleDateString("it-IT");

    const limitObj = aiRenderIpLimits.get(ip);
    if (limitObj && limitObj.date === todayStr) {
      if (limitObj.count >= 10) {
        res.status(429).json({
          success: false,
          error: "Hai raggiunto il limite massimo di 10 rendering gratuiti per oggi. Torna domani per altri test!"
        });
        return;
      }
      limitObj.count += 1;
    } else {
      aiRenderIpLimits.set(ip, { date: todayStr, count: 1 });
    }

    const { description, aspectRatio = "16:9", image } = req.body;
    if (!description) {
      res.status(400).json({ error: "La descrizione è obbligatoria per generare il rendering." });
      return;
    }

    // Step 1: Expand the prompt into a detailed professional English prompt
    const promptEnhanceRes = await getAi().models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate and expand this user brief description of architectural materials or structure into a highly detailed, professional English architectural rendering prompt for a photorealistic image generation model. 

IMPORTANT: The prompt MUST explicitly state that the reference image is STRICTLY for structural layout, camera perspective, and geometry. The final rendering must METICULOUSLY preserve the exact viewing angle, camera position, orientation, and zoom of the reference image without adding unrequested background structures or altering the viewpoint. The original colors and line drawings must be completely ignored and replaced ONLY with the materials, textures, lighting, and colors described in this prompt.

Keep it concise but highly descriptive, focus on lighting, materials, textures, and rendering quality. Do not include introductory text, just the final prompt.

User Brief Description: "${description}"`,
      config: {
        systemInstruction: "You are a professional architectural photographer and render specialist. You write perfect prompts for image generators to produce stunning, realistic, highly detailed, photorealistic architectural render visualizations. Ensure your prompts enforce that the reference image's layout and perspective are strictly preserved while applying the prompted materials and lighting.",
      }
    });

    const expandedPrompt = promptEnhanceRes.text?.trim() || description;
    console.log("Expanded rendering prompt:", expandedPrompt);

    // Step 2: Generate the image using gemini-2.5-flash-image
    const parts: any[] = [];
    if (image) {
      // Extract base64 and mime type if it's a data URI
      const matches = image.match(/^data:(image\/[a-zA-Z]*);base64,([^"]*)$/);
      if (matches && matches.length === 3) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }
    
    // Explicitly prepend a strong directive to the final prompt 
    // to force the model to respect the input image geometry.
    const finalPromptForImage = image 
      ? `[CRITICAL: You MUST keep the EXACT same 3D geometry, perspective, camera angle, and structural layout as the provided reference image. Do not invent new rooms, buildings, or alter the shape. ONLY apply the following materials, textures, and lighting:] ${expandedPrompt}`
      : expandedPrompt;

    parts.push({ text: finalPromptForImage });

    const imageRes = await getAi().models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    let base64Image = "";
    if (imageRes.candidates?.[0]?.content?.parts) {
      for (const part of imageRes.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("Il modello non ha restituito alcuna immagine.");
    }

    res.json({
      success: true,
      expandedPrompt,
      imageUrl: base64Image
    });

  } catch (error: any) {
    console.error("Gemini AI-render error:", error);
    res.status(500).json({ error: error?.message || "Impossibile generare l'immagine di rendering realistica" });
  }
});

export { app };
export default app;
