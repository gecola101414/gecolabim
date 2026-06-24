import React, { useState, useEffect } from "react";
import { 
  Coins, 
  CreditCard, 
  Sparkles, 
  Zap, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Mail,
  MessageSquare,
  ArrowRight,
  Plus
} from "lucide-react";

export function AICreditManager() {
  // Email per simulare l'utente loggato. Di default usiamo l'email fornita nei metadati
  const [email, setEmail] = useState("gecolakey@gmail.com");
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Stati per testare l'API Chat Proxy (/api/chat)
  const [promptInput, setPromptInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Recupera il saldo all'avvio e quando l'email cambia
  useEffect(() => {
    fetchBalance();
  }, [email]);

  // Controlla i parametri URL per mostrare feedback di successo/annullamento ricarica
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMessage("Ricarica di €10,00 avvenuta con successo! Il tuo saldo è stato aggiornato.");
      // Pulisce il parametro dall'URL per non ripetere il messaggio
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("payment") === "cancel") {
      setApiError("Il pagamento con Stripe è stato annullato.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchBalance = async () => {
    if (!email) return;
    setLoadingBalance(true);
    setApiError(null);
    try {
      const response = await fetch(`/api/credits?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        throw new Error("Impossibile recuperare il saldo.");
      }
      const data = await response.json();
      setBalance(data.balance);
    } catch (err: any) {
      console.error(err);
      setBalance(0.00); // Se l'utente non esiste ancora nel DB, il backend restituisce 0.00
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleCheckout = async () => {
    if (!email) {
      setApiError("Inserisci un indirizzo email valido prima di ricaricare.");
      return;
    }
    setCheckoutLoading(true);
    setApiError(null);
    setSuccessMessage(null);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "external-user-id-example", // Identificativo utente opzionale
          email: email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'avvio del pagamento.");
      }

      const data = await response.json();
      if (data.url) {
        // Reindirizza l'utente alla pagina ospitata da Stripe per completare il pagamento sicuro
        window.location.href = data.url;
      } else {
        throw new Error("URL di checkout non restituito da Stripe.");
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Impossibile avviare Stripe Checkout. Assicurati che le variabili d'ambiente STRIPE_SECRET_KEY siano inserite.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleTestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    
    setChatLoading(true);
    setApiError(null);
    setAiResponse("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: promptInput,
          email: email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Se il saldo è zero o negativo, riceveremo un errore 402
        if (response.status === 402) {
          throw new Error(`[Errore 402] ${data.message || data.error}`);
        }
        throw new Error(data.error || "Errore nella chiamata AI.");
      }

      setAiResponse(data.response);
      setPromptInput("");
      // Aggiorna subito il saldo in tempo reale dal database
      if (data.remainingBalance !== undefined) {
        setBalance(data.remainingBalance);
      } else {
        fetchBalance();
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 max-w-2xl mx-auto my-6" id="credit-manager-container">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Portafoglio Crediti AI</h2>
            <p className="text-xs text-gray-500">Gestione consumi e ricariche a consumo</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Server Master Key</span>
        </div>
      </div>

      {/* Configurazione Utente Simulata */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Simulazione Email Utente Loggato
        </label>
        <div className="flex gap-2">
          <input 
            id="simulated-user-email"
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="es. gecolakey@gmail.com"
            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
          <button 
            id="refresh-balance-btn"
            onClick={fetchBalance}
            className="px-3.5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Aggiorna
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Inserisci la tua email per simulare il tuo account. Ogni email ha un saldo separato salvato su Supabase.
        </p>
      </div>

      {/* Alert di Successo o Errore */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3 text-green-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <p>{successMessage}</p>
        </div>
      )}

      {apiError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="font-medium">{apiError}</p>
        </div>
      )}

      {/* Sezione Crediti */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Card Saldo */}
        <div className="bg-gradient-to-br from-indigo-550 to-indigo-700 text-white p-5 rounded-2xl relative overflow-hidden shadow-md">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
            <Coins className="w-36 h-36" />
          </div>
          <p className="text-xs uppercase font-semibold text-indigo-100 tracking-widest mb-1">Saldo Residuo</p>
          <div className="flex items-baseline gap-1 mb-2">
            {loadingBalance ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <span className="text-3.5xl font-black tracking-tight" id="credits-balance-display">
                € {balance !== null ? balance.toFixed(2) : "1.00"}
              </span>
            )}
          </div>
          <div className="bg-white/15 backdrop-blur-md rounded-lg px-2.5 py-1.5 text-[11px] mb-3 border border-white/10">
            🎁 <strong>Bonus di Benvenuto Attivo:</strong> Ti abbiamo regalato <strong>€1,00 di credito iniziale</strong> per verificare subito il funzionamento (pari a 100 domande)!
          </div>
          <div className="text-[11px] text-indigo-100 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span>Database sincronizzato</span>
          </div>
        </div>

        {/* Card Azione Stripe */}
        <div className="bg-white border border-gray-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              Ricarica Portafoglio
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Aggiungi €10,00 di crediti pagando in modo sicuro e certificato con Stripe.
            </p>
          </div>
          <button 
            id="stripe-topup-button"
            onClick={handleCheckout}
            disabled={checkoutLoading || loadingBalance}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            {checkoutLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Inizializzazione...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Ricarica €10 con Stripe</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Playground per testare il Proxy AI */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500 fill-current" />
          Playground Consumi AI (Proxy Check)
        </h3>
        
        <form onSubmit={handleTestChat} className="space-y-3">
          <div className="flex gap-2">
            <input 
              id="ai-playground-input"
              type="text" 
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Fai una domanda all'AI (Costo: €0.01 per richiesta)..."
              disabled={chatLoading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <button 
              id="ai-playground-submit-btn"
              type="submit"
              disabled={chatLoading || !promptInput.trim()}
              className="px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {chatLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Invia</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Risposta AI */}
        {aiResponse && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Risposta da OpenAI (gpt-4o-mini):
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiResponse}</p>
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Modello: GPT-4o-mini</span>
              <span className="bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-md">Addebitato €0.01</span>
            </div>
          </div>
        )}
      </div>

      {/* Note Informative */}
      <div className="mt-6 pt-5 border-t border-gray-100 flex gap-2.5 text-xs text-gray-400">
        <HelpCircle className="w-4 h-4 shrink-0 text-gray-300 mt-0.5" />
        <p className="leading-normal">
          Questo sistema è configurato per usare chiavi segrete server-side protette. Il database Supabase è protetto con Row Level Security (RLS) ed è modificabile solo dall'endpoint backend.
        </p>
      </div>
    </div>
  );
}
