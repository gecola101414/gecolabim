import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());

// --- INIZIALIZZAZIONE LAZY (PIGRANTE) PER STRIPE E SUPABASE ---
// Previene il crash all'avvio nel caso in cui le chiavi d'ambiente non siano inserite.
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY non configurata nel file di ambiente (.env).");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeClient;
}

let supabaseAdmin: any = null;
function getSupabase(): any {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Credenziali Supabase (SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY) non configurate nel file di ambiente (.env).");
  }
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return supabaseAdmin;
}

// 1. API WEBHOOK DI STRIPE (/api/webhook)
// Questo endpoint deve essere registrato PRIMA di express.json() per ricevere il corpo RAW (grezzo)
// necessario a verificare l'autenticità e la firma della richiesta Stripe.
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req: any, res: any) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("Firma Stripe o webhook secret mancante nelle intestazioni.");
    res.status(400).send("Firma o segreto webhook mancante.");
    return;
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Errore di verifica firma Webhook Stripe: ${err.message}`);
    res.status(400).send(`Errore Webhook: ${err.message}`);
    return;
  }

  // Gestione dell'evento di pagamento completato
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const email = session.metadata?.email;
    const amount = session.metadata?.amount;

    if (!email || !amount) {
      console.error("Metadata di Stripe incompleti nel webhook:", session.metadata);
      res.status(400).send("Metadata mancanti nella sessione.");
      return;
    }

    try {
      const supabase = getSupabase();
      const amountFloat = parseFloat(amount);

      console.log(`Elaborazione ricarica di €${amountFloat} per l'utente ${email} (${userId})`);

      // Controlliamo se esiste già l'utente per aggiornare o inserire (upsert)
      const { data: creditRecord, error: fetchError } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("email", email)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (creditRecord) {
        // Aggiorna il saldo esistente incrementandolo
        const newBalance = parseFloat(creditRecord.balance) + amountFloat;
        const { error: updateError } = await supabase
          .from("user_credits")
          .update({ balance: newBalance })
          .eq("email", email);

        if (updateError) throw updateError;
        console.log(`Saldo aggiornato con successo per ${email}: €${newBalance}`);
      } else {
        // Inserisce un nuovo record
        const { error: insertError } = await supabase
          .from("user_credits")
          .insert({
            id: userId && userId !== "anonymous" ? userId : undefined,
            email: email,
            balance: amountFloat,
          });

        if (insertError) throw insertError;
        console.log(`Nuovo portafoglio creato con successo per ${email} con €${amountFloat}`);
      }

      res.json({ received: true, status: "success" });
      return;
    } catch (dbError: any) {
      console.error("Errore durante l'aggiornamento del saldo nel database:", dbError);
      res.status(500).send(`Errore interno nel database: ${dbError.message}`);
      return;
    }
  }

  res.json({ received: true });
});

// Registriamo il parser JSON per tutte le altre rotte successive
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// 2. API DI RECUPERO CREDITI (/api/credits)
// Recupera il saldo residuo in tempo reale basato sull'email dell'utente
app.get("/api/credits", async (req: any, res: any) => {
  try {
    const { email } = req.query;
    if (!email) {
      res.status(400).json({ error: "L'indirizzo email è obbligatorio." });
      return;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Errore Supabase nel recupero dei crediti:", error);
      res.status(500).json({ error: "Impossibile recuperare il saldo dal database." });
      return;
    }

    const balance = data ? parseFloat(data.balance) : 0.00;
    res.json({ email, balance });
  } catch (error: any) {
    console.error("Errore generico in /api/credits:", error);
    res.status(500).json({ error: error.message || "Errore del server." });
  }
});

// 3. API CREAZIONE SESSIONE STRIPE (/api/checkout)
// Avvia la procedura di ricarica dei crediti
app.post("/api/checkout", async (req: any, res: any) => {
  try {
    const { userId, email } = req.body;

    if (!email) {
      res.status(400).json({ error: "L'indirizzo email dell'utente è obbligatorio per avviare il checkout." });
      return;
    }

    const stripe = getStripe();
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

    console.log(`Inizializzazione Stripe Checkout per email: ${email}`);

    // Creiamo una sessione singola per il pagamento di €10.00
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Ricarica Portafoglio AI Gecolacad",
              description: "Acquisto di €10,00 di crediti spendibili per consumi AI interni all'applicazione (es. gpt-4o-mini).",
            },
            unit_amount: 1000, // €10.00 espresso in centesimi
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Passiamo l'ID e l'email dell'utente nei metadata in modo da poterli estrarre nel webhook di risposta
      metadata: {
        userId: userId || "anonymous",
        email: email,
        amount: "10.00",
      },
      success_url: `${appUrl}?payment=success`,
      cancel_url: `${appUrl}?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Errore creazione Stripe Session:", error);
    res.status(500).json({ error: error.message || "Impossibile avviare il pagamento con Stripe." });
  }
});

// 4. API CHAT / PROXY AI CON VERIFICA CREDITI (/api/chat)
// Esegue il proxy delle richieste AI scalando una tariffa fissa ad ogni risposta
app.post("/api/chat", async (req: any, res: any) => {
  try {
    const { prompt, email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email dell'utente mancante nella richiesta." });
      return;
    }
    if (!prompt) {
      res.status(400).json({ error: "Prompt dell'utente mancante nella richiesta." });
      return;
    }

    const supabase = getSupabase();

    // Passaggio 1: Recupero del saldo dell'utente nel database
    const { data: userRecord, error: dbError } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("email", email)
      .maybeSingle();

    if (dbError) {
      console.error("Errore database in /api/chat:", dbError);
      res.status(500).json({ error: "Errore nel verificare i crediti disponibili nel database." });
      return;
    }

    const balance = userRecord ? parseFloat(userRecord.balance) : 0.00;

    // Se il saldo è insufficiente (<= 0), blocca la chiamata e restituisce errore 402 (Payment Required)
    if (balance <= 0) {
      res.status(402).json({
        error: "Credito insufficiente",
        message: "Il tuo saldo crediti è pari a €0,00. Effettua una ricarica di €10 per sbloccare l'assistente AI.",
      });
      return;
    }

    // Passaggio 2: Se il saldo è positivo, esegui la chiamata a OpenAI (o fallback a Gemini)
    const openAIKey = process.env.OPENAI_API_KEY;
    let aiResponseText = "";

    if (openAIKey) {
      console.log(`Chiamata a OpenAI GPT-4o-mini per ${email}`);
      const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
      });

      if (!openAIResponse.ok) {
        const errorDetail = await openAIResponse.text();
        throw new Error(`Errore API OpenAI (Status: ${openAIResponse.status}): ${errorDetail}`);
      }

      const openAIData = await openAIResponse.json();
      aiResponseText = openAIData.choices?.[0]?.message?.content || "";
    } else {
      // Fallback a Gemini se non è configurata la chiave OpenAI
      console.warn("OPENAI_API_KEY non trovata. Eseguo fallback su Gemini API.");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      aiResponseText = response.text || "";
    }

    // Passaggio 3: Aggiorna il database decrementando il saldo (ad esempio tariffa fissa di €0.01 per richiesta)
    const costPerRequest = 0.01;
    const newBalance = Math.max(0.00, balance - costPerRequest);

    const { error: updateError } = await supabase
      .from("user_credits")
      .update({ balance: newBalance })
      .eq("email", email);

    if (updateError) {
      console.error("Errore nell'aggiornamento del saldo decurtato:", updateError);
    } else {
      console.log(`Addebitato €${costPerRequest} a ${email}. Nuovo saldo: €${newBalance}`);
    }

    res.json({
      success: true,
      response: aiResponseText,
      cost: costPerRequest,
      remainingBalance: newBalance,
    });
  } catch (error: any) {
    console.error("Errore durante l'elaborazione di /api/chat:", error);
    res.status(500).json({ error: error.message || "Errore interno dell'assistente AI." });
  }
});

// API routes FIRST
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

        const response = await ai.models.generateContent({
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
        res.status(500).json({ error: error?.message || "Failed to generate parametric drawing" });
    }
  });

  app.post("/api/ai-render", async (req, res) => {
    try {
      const { description, aspectRatio = "16:9" } = req.body;
      if (!description) {
        res.status(400).json({ error: "Description is required" });
        return;
      }

      // Step 1: Expand the prompt into a detailed professional English prompt
      const promptEnhanceRes = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Translate and expand this user brief description of architectural materials or structure into a highly detailed, professional English architectural rendering prompt for a photorealistic image generation model. 

Keep it concise but highly descriptive, focus on lighting, materials, textures, and rendering quality. Do not include introductory text, just the final prompt.

User Brief Description: "${description}"`,
        config: {
          systemInstruction: "You are a professional architectural photographer and render specialist. You write perfect prompts for image generators to produce stunning, realistic, highly detailed, photorealistic architectural render visualizations with soft natural light, depth of field, clear textures (wood, concrete, brick, steel, glass), and clean compositions.",
        }
      });

      const expandedPrompt = promptEnhanceRes.text?.trim() || description;
      console.log("Expanded rendering prompt:", expandedPrompt);

      // Step 2: Generate the image using gemini-2.5-flash-image
      const imageRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: expandedPrompt,
            },
          ],
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
        throw new Error("No image was returned from the generative model.");
      }

      res.json({
        success: true,
        expandedPrompt,
        imageUrl: base64Image
      });

    } catch (error: any) {
      console.error("Gemini AI-render error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate realistic rendering image" });
    }
  });

  // Export the Express app for serverless deployments like Vercel
  export { app };

  // Only start the server listening if we are running in standalone mode (not as a serverless function)
  async function runStandalone() {
    if (process.env.VERCEL !== "1") {
      if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }

      const PORT = 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  runStandalone();
