import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileDown, X, Check, AlertCircle, Plus, Clipboard, LayoutGrid } from 'lucide-react';
import { PrezzarioItem } from '../types';

interface PriceListImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: PrezzarioItem[]) => void;
}

export const PriceListImporter: React.FC<PriceListImporterProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [isOver, setIsOver] = useState(false);
  const [parsedItems, setParsedItems] = useState<PrezzarioItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const parsePastedData = (text: string) => {
    try {
      let items: PrezzarioItem[] = [];
      const cleanText = text.trim();
      
      // 1. Try JSON parsing
      if (cleanText.startsWith('{') || cleanText.startsWith('[')) {
        try {
          const data = JSON.parse(cleanText);
          const rawItems = Array.isArray(data) ? data : [data];
          items = rawItems.map((it: any) => ({
            codice: it.codice || it.code || 'NP.NEW.000',
            descrizione: it.descrizione || it.description || 'Nessuna descrizione',
            unita: it.unita || it.um || it.unit || 'cad',
            prezzo: parseFloat(it.prezzo || it.price || 0),
            categoria: it.categoria || it.category || 'Importati',
            incidenzaManodopera: parseFloat(it.incidenzaManodopera || it.labor || 0),
            prezzario: it.prezzario || it.catalog || 'Esterno'
          }));
        } catch (e) {
          // fallback
        }
      }

      // 2. CSV / TSV / Copy-Paste line-by-line parsing
      if (items.length === 0) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 0) {
          // Detect separator using the first line
          const firstLine = lines[0];
          const separators = [/\t/, /;/, /,/, /\|/];
          let bestSep = /\t/;
          let maxParts = 0;
          for (const s of separators) {
            const count = firstLine.split(s).length;
            if (count > maxParts) {
              maxParts = count;
              bestSep = s;
            }
          }

          // Let's check if the first line is a header
          const firstLineParts = firstLine.split(bestSep).map(p => p.trim().toLowerCase());
          let codeIdx = -1;
          let descIdx = -1;
          let umIdx = -1;
          let priceIdx = -1;
          let laborIdx = -1;
          let catalogIdx = -1;

          firstLineParts.forEach((part, idx) => {
            if (part.includes('codice') || part.includes('code') || part.includes('art') || part.includes('articolo')) codeIdx = idx;
            else if (part.includes('descriz') || part.includes('descr') || part.includes('description') || part.includes('voce') || part.includes('designazione')) descIdx = idx;
            else if (part.includes('um') || part.includes('u.m') || part.includes('unit') || part.includes('misura')) umIdx = idx;
            else if (part.includes('prezz') || part.includes('price') || part.includes('tariffa') || part.includes('importo')) priceIdx = idx;
            else if (part.includes('manodopera') || part.includes('incid') || part.includes('labor')) laborIdx = idx;
            else if (part.includes('prezzario') || part.includes('listino') || part.includes('catalog')) catalogIdx = idx;
          });

          const hasHeader = (codeIdx !== -1 || descIdx !== -1 || priceIdx !== -1);
          const startIndex = hasHeader ? 1 : 0;

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(bestSep).map(p => p.trim());
            if (parts.length >= 3) {
              let codice = '';
              let descrizione = '';
              let unita = 'cad';
              let prezzo = 0;
              let incidenzaManodopera = 0;
              let prezzario = 'Esterno';

              if (hasHeader) {
                if (codeIdx !== -1 && parts[codeIdx]) codice = parts[codeIdx];
                if (descIdx !== -1 && parts[descIdx]) descrizione = parts[descIdx];
                if (umIdx !== -1 && parts[umIdx]) unita = parts[umIdx];
                if (priceIdx !== -1 && parts[priceIdx]) {
                  const rawPrice = parts[priceIdx].replace(/[^\d.,-]/g, '').replace(',', '.');
                  prezzo = parseFloat(rawPrice) || 0;
                }
                if (laborIdx !== -1 && parts[laborIdx]) {
                  const rawLabor = parts[laborIdx].replace(/[^\d.,-]/g, '').replace(',', '.');
                  incidenzaManodopera = parseFloat(rawLabor) || 0;
                }
                if (catalogIdx !== -1 && parts[catalogIdx]) prezzario = parts[catalogIdx];
              } else {
                // Heuristic parsing for raw tabular data without headers
                let foundPriceIdx = -1;
                for (let j = parts.length - 1; j >= 0; j--) {
                  const cleanVal = parts[j].replace(/[^\d.,-]/g, '').replace(',', '.');
                  const pFloat = parseFloat(cleanVal);
                  if (!isNaN(pFloat) && pFloat > 0 && cleanVal.length > 0) {
                    prezzo = pFloat;
                    foundPriceIdx = j;
                    break;
                  }
                }

                const commonUms = ['m', 'ml', 'mq', 'mc', 'cad', 'kg', 'l', 'nr', 'ora', 'ore', 'ton', 'cad.', 'mq.', 'ml.', 'mc.', 'n.'];
                let foundUmIdx = -1;
                for (let j = 0; j < parts.length; j++) {
                  if (j === foundPriceIdx) continue;
                  const pLow = parts[j].toLowerCase();
                  if (commonUms.includes(pLow) || commonUms.includes(pLow + '.')) {
                    unita = parts[j];
                    foundUmIdx = j;
                    break;
                  }
                }

                if (foundUmIdx === -1) {
                  for (let j = 0; j < parts.length; j++) {
                    if (j === foundPriceIdx) continue;
                    const val = parts[j];
                    if (val.length >= 1 && val.length <= 4 && isNaN(Number(val))) {
                      unita = val;
                      foundUmIdx = j;
                      break;
                    }
                  }
                }

                let maxLen = 0;
                let foundDescIdx = -1;
                for (let j = 0; j < parts.length; j++) {
                  if (j === foundPriceIdx || j === foundUmIdx) continue;
                  if (parts[j].length > maxLen) {
                    maxLen = parts[j].length;
                    foundDescIdx = j;
                  }
                }
                if (foundDescIdx !== -1) {
                  descrizione = parts[foundDescIdx];
                }

                let foundCodeIdx = -1;
                for (let j = 0; j < parts.length; j++) {
                  if (j === foundPriceIdx || j === foundUmIdx || j === foundDescIdx) continue;
                  const val = parts[j];
                  if (val.length > 0 && val.length < 25 && (val.includes('.') || val.includes('-') || /\d/.test(val))) {
                    codice = val;
                    foundCodeIdx = j;
                    break;
                  }
                }
                if (foundCodeIdx === -1) {
                  for (let j = 0; j < parts.length; j++) {
                    if (j === foundPriceIdx || j === foundUmIdx || j === foundDescIdx) continue;
                    const val = parts[j];
                    if (val.length > 0 && val.length < 25) {
                      codice = val;
                      foundCodeIdx = j;
                      break;
                    }
                  }
                }

                for (let j = 0; j < parts.length; j++) {
                  if (j === foundPriceIdx || j === foundUmIdx || j === foundDescIdx || j === foundCodeIdx) continue;
                  if (parts[j].length > 0) {
                    prezzario = parts[j];
                    break;
                  }
                }
              }

              if (!codice) codice = `NP.NEW.${100 + i}`;
              if (!descrizione) descrizione = `Voce di Computo senza descrizione (Riga ${i + 1})`;

              items.push({
                codice,
                descrizione,
                unita,
                prezzo,
                categoria: 'Importati',
                incidenzaManodopera,
                prezzario
              });
            }
          }
        }
      }

      if (items.length > 0) {
        setParsedItems(items);
        setError(null);
      } else {
        setError("Impossibile riconoscere il formato dei dati. Assicurati che le righe abbiano almeno Codice, Descrizione, U.M. e Prezzo separati da Tab, Comma o che sia un formato JSON valido.");
      }
    } catch (err) {
      setError("Errore durante il parsing dei dati.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    // Support dropping files (CSV, TSV, JSON)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          parsePastedData(text);
        }
      };
      reader.readAsText(file);
      return;
    }

    const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (text) {
      parsePastedData(text);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      parsePastedData(text);
    }
  };

  const handleConfirm = () => {
    onImport(parsedItems);
    setParsedItems([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-slate-950 border-2 border-indigo-500/50 rounded-2xl shadow-2xl max-w-2xl w-full text-white overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex justify-between items-center p-5 border-b border-white/10 bg-indigo-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <FileDown className="text-indigo-400" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 font-mono">
                Importazione Prezzario Esterno
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">Trascina o incolla le voci dal tuo applicativo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-4">
          {parsedItems.length === 0 ? (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              className={`
                flex flex-col items-center justify-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer
                ${isOver ? 'bg-indigo-500/20 border-indigo-500 scale-[1.02]' : 'bg-slate-900 border-white/10 hover:border-white/20'}
              `}
            >
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Plus className={`text-indigo-400 transition-transform duration-500 ${isOver ? 'rotate-90 scale-125' : ''}`} size={32} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-300 mb-1">Rilascia qui i dati o Incolla (Ctrl+V)</p>
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Prezzario • Codice • Descrizione • U.M. • Prezzo • Manodopera</p>
              </div>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 bg-slate-950 border border-white/5 rounded text-[9px] text-slate-500">CSV</span>
                <span className="px-2 py-1 bg-slate-950 border border-white/5 rounded text-[9px] text-slate-500">Excel / TSV</span>
                <span className="px-2 py-1 bg-slate-950 border border-white/5 rounded text-[9px] text-slate-500">JSON</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Elementi Riconosciuti ({parsedItems.length})</h4>
                <button 
                  onClick={() => setParsedItems([])}
                  className="text-[10px] text-rose-400 hover:underline font-bold uppercase tracking-wider"
                >
                  Svuota Lista
                </button>
              </div>
              <div className="grid gap-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin">
                {parsedItems.map((it, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-white/10 p-3 rounded-xl flex items-start gap-3 group hover:border-emerald-500/30 transition-colors">
                    <div className="bg-slate-950 border border-white/10 p-2 rounded-lg text-xs font-mono font-bold text-emerald-400">
                      {it.codice}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-300 truncate">{it.descrizione}</span>
                        <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[8px] font-bold rounded uppercase">
                          {it.prezzario}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
                        <span className="flex items-center gap-1"><LayoutGrid size={10} /> {it.unita}</span>
                        <span className="flex items-center gap-1 font-bold text-emerald-500">€ {it.prezzo.toFixed(2)}</span>
                        {it.incidenzaManodopera !== undefined && (
                          <span className="flex items-center gap-1">🛠️ Inc. MO: {it.incidenzaManodopera}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400 animate-shake">
              <AlertCircle size={20} />
              <p className="text-[11px] font-medium">{error}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-white/10 bg-slate-950 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors"
          >
            Annulla
          </button>
          <button 
            disabled={parsedItems.length === 0}
            onClick={handleConfirm}
            className={`
              flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all
              ${parsedItems.length > 0 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'}
            `}
          >
            Importa nel Catalogo
          </button>
        </div>
      </motion.div>
    </div>
  );
};
