import React, { useState } from "react";
import { PREZZARIO_GECOLA, PrezzarioItem } from "../data/prezzario";
import { DimensionEntity, Entity } from "../types";
import { 
  Clipboard, 
  Search, 
  Check, 
  Trash2, 
  Download, 
  Grid, 
  Plus, 
  Layers, 
  X, 
  Sliders, 
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";

interface GecolaPrezzarioPanelProps {
  entities: Entity[];
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
  setShortcutToast: (msg: string | null) => void;
}

export const GecolaPrezzarioPanel: React.FC<GecolaPrezzarioPanelProps> = ({
  entities,
  updateEntity,
  selectedId,
  setSelectedId,
  isOpen,
  onClose,
  setShortcutToast
}) => {
  const [activeTab, setActiveTab] = useState<"prezzario" | "computo">("prezzario");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tutte");
  const [isMinimized, setIsMinimized] = useState(false);

  // Position state for a floating window
  const [position, setPosition] = useState({ x: 80, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  // Filter categories
  const categories = ["Tutte", ...Array.from(new Set(PREZZARIO_GECOLA.map(item => item.categoria)))];

  // Filter price list items
  const filteredPrezzario = PREZZARIO_GECOLA.filter(item => {
    const matchesSearch = item.codice.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.descrizione.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Tutte" || item.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter dimension entities (misure)
  const dimensionMisure = entities.filter(e => e.type === "dimension") as DimensionEntity[];

  // Calculate totals
  const computoItems = dimensionMisure.filter(d => d.includeInComputo);
  const totalComputoAmount = computoItems.reduce((acc, dim) => {
    const dx = dim.end.x - dim.start.x;
    const dy = dim.end.y - dim.start.y;
    const lengthCm = Math.hypot(dx, dy);
    const lengthM = lengthCm / 100;
    const mult = dim.moltiplicatore ?? 1.0;
    const qty = lengthM * mult;
    const price = dim.prezzarioPrezzo ?? 0.0;
    return acc + (qty * price);
  }, 0);

  // Handle Drag Start from Price List
  const handleDragStart = (e: React.DragEvent, item: PrezzarioItem) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Drag and Drop on list row to associate item directly
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnRow = (e: React.DragEvent, dimId: string) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData("text/plain");
      const item = JSON.parse(rawData) as PrezzarioItem;
      if (item && item.codice) {
        updateEntity(dimId, {
          prezzarioCodice: item.codice,
          prezzarioDescrizione: item.descrizione,
          prezzarioUnita: item.unita,
          prezzarioPrezzo: item.prezzo,
          includeInComputo: true
        });
        setShortcutToast(`Voce ${item.codice} associata con successo! 📋`);
        setTimeout(() => setShortcutToast(null), 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export Computo to TXT / CSV file
  const handleExportComputo = () => {
    if (computoItems.length === 0) {
      setShortcutToast("Nessuna misura abilitata per la computazione!");
      setTimeout(() => setShortcutToast(null), 2500);
      return;
    }

    let fileContent = `GECOLA BIM - COMPUTO METRICO ESTIMATIVO\n`;
    fileContent += `Generato il: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    fileContent += `=========================================================================================\n`;
    fileContent += `CODICE\tDESCRIZIONE\tU.M.\tQUANTITÀ\tPREZZO (€)\tTOTALE (€)\n`;
    fileContent += `-----------------------------------------------------------------------------------------\n`;

    computoItems.forEach((dim, idx) => {
      const dx = dim.end.x - dim.start.x;
      const dy = dim.end.y - dim.start.y;
      const lengthM = Math.hypot(dx, dy) / 100;
      const mult = dim.moltiplicatore ?? 1.0;
      const qty = lengthM * mult;
      const price = dim.prezzarioPrezzo ?? 0.0;
      const tot = qty * price;
      
      const code = dim.prezzarioCodice || `MIS-${idx + 1}`;
      const desc = dim.prezzarioDescrizione || `Misura lineare rilevata sul disegno (L = ${lengthM.toFixed(2)} m)`;
      const um = dim.prezzarioUnita || "m";

      fileContent += `${code}\t${desc.substring(0, 80)}...\t${um}\t${qty.toFixed(2)}\t${price.toFixed(2)}\t${tot.toFixed(2)}\n`;
    });

    fileContent += `=========================================================================================\n`;
    fileContent += `TOTALE GENERALE COMPUTO ESTIMATIVO GECOLA:\t\t\t\t\t€ ${totalComputoAmount.toFixed(2)}\n`;
    fileContent += `=========================================================================================\n`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Computo_Metrico_Gecola_${Date.now()}.txt`;
    link.click();
    
    setShortcutToast("Computo Metrico esportato con successo! 📥");
    setTimeout(() => setShortcutToast(null), 2500);
  };

  // Enable/Disable all measurements
  const handleToggleAll = (enable: boolean) => {
    dimensionMisure.forEach(dim => {
      updateEntity(dim.id, { includeInComputo: enable });
    });
    setShortcutToast(enable ? "Tutte le misure incluse nel computo!" : "Tutte le misure escluse dal computo!");
    setTimeout(() => setShortcutToast(null), 2000);
  };

  // Window dragging events
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".window-header-drag")) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${Math.max(10, Math.min(window.innerWidth - 350, position.x))}px`,
        top: `${Math.max(60, Math.min(window.innerHeight - 300, position.y))}px`,
        zIndex: 1000,
      }}
      className="w-96 bg-neutral-900 border border-neutral-700 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col transition-all text-neutral-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* HEADER DRAGGABLE */}
      <div 
        onMouseDown={handleMouseDown}
        className="window-header-drag h-10 bg-neutral-950 px-3 flex items-center justify-between cursor-move select-none border-b border-neutral-800"
      >
        <div className="flex items-center gap-2">
          <Clipboard size={14} className="text-amber-400" />
          <span className="text-[11px] font-black tracking-wider uppercase font-sans">
            Prezzario & Computo Gecola
          </span>
          {dimensionMisure.length > 0 && (
            <span className="bg-neutral-800 text-amber-400 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full">
              {dimensionMisure.length} misure
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
          >
            {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-red-950/50 rounded text-neutral-400 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col h-[380px] text-xs">
          {/* TABS SELECTOR */}
          <div className="flex bg-neutral-950 border-b border-neutral-800 p-1">
            <button
              onClick={() => setActiveTab("prezzario")}
              className={`flex-1 py-1.5 text-[10.5px] font-black rounded-lg uppercase tracking-wide transition-all ${
                activeTab === "prezzario" 
                  ? "bg-amber-500 text-neutral-950 shadow-md font-bold" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              📖 Prezzario Regionale
            </button>
            <button
              onClick={() => setActiveTab("computo")}
              className={`flex-1 py-1.5 text-[10.5px] font-black rounded-lg uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "computo" 
                  ? "bg-amber-500 text-neutral-950 shadow-md font-bold" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              📊 Computo Metrico
              {computoItems.length > 0 && (
                <span className="bg-neutral-850 text-neutral-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  €{totalComputoAmount.toFixed(0)}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: PREZZARIO REGIONALE (CATALOG) */}
          {activeTab === "prezzario" && (
            <div className="flex-1 flex flex-col overflow-hidden p-2.5 space-y-2">
              <div className="flex gap-1.5 items-center bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5">
                <Search size={12} className="text-neutral-400" />
                <input
                  type="text"
                  placeholder="Cerca codice o descrizione..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-full outline-none border-none text-neutral-200 placeholder-neutral-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-neutral-500 hover:text-neutral-300">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* CATEGORY TABS */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin select-none">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-[9.5px] font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === cat 
                        ? "bg-neutral-700 text-amber-400 border border-amber-400/30" 
                        : "bg-neutral-950 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="text-[9.5px] bg-neutral-950 text-neutral-400 p-1.5 rounded-lg border border-neutral-850 flex items-center gap-1.5">
                <AlertCircle size={12} className="text-amber-400 shrink-0" />
                <span>Trascina le voci di computo e rilasciale sulle misure</span>
              </div>

              {/* LIST ITEMS */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                {filteredPrezzario.length === 0 ? (
                  <div className="text-center py-10 text-neutral-500">
                    Nessuna voce trovata.
                  </div>
                ) : (
                  filteredPrezzario.map(item => (
                    <div
                      key={item.codice}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item)}
                      className="bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-amber-500/40 p-2 rounded-xl transition-all cursor-grab active:cursor-grabbing group relative"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-mono font-black text-amber-400 text-[10px] bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                          {item.codice}
                        </span>
                        <span className="font-mono font-black text-white text-[10.5px]">
                          € {item.prezzo.toFixed(2)} / {item.unita}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed group-hover:text-neutral-200">
                        {item.descrizione}
                      </p>
                      
                      {/* Drag handles indicator on hover */}
                      <div className="absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 text-[8px] bg-amber-500 text-neutral-950 font-extrabold px-1.5 rounded">
                        TRASCINA ⎘
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COMPUTO METRICO (ACTIVE MEASUREMENTS) */}
          {activeTab === "computo" && (
            <div className="flex-1 flex flex-col overflow-hidden p-2.5">
              {/* ACCORDION/TOOLBAR */}
              <div className="flex justify-between items-center mb-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-850">
                <span className="text-[9.5px] font-black uppercase text-neutral-400 tracking-wide">
                  Azioni Rapide
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleAll(true)}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded text-[9px]"
                  >
                    Tutte
                  </button>
                  <button
                    onClick={() => handleToggleAll(false)}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded text-[9px]"
                  >
                    Nessuna
                  </button>
                </div>
              </div>

              {/* LIST OF DRAWN MEASUREMENTS */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
                {dimensionMisure.length === 0 ? (
                  <div className="text-center py-12 text-neutral-500 flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle size={20} className="text-neutral-600" />
                    <span>Nessuna misura tracciata sul disegno CAD.</span>
                    <span className="text-[9.5px]">Usa lo strumento "Misure" per iniziare.</span>
                  </div>
                ) : (
                  dimensionMisure.map((dim, idx) => {
                    const dx = dim.end.x - dim.start.x;
                    const dy = dim.end.y - dim.start.y;
                    const lengthM = Math.hypot(dx, dy) / 100;
                    const mult = dim.moltiplicatore ?? 1.0;
                    const qty = lengthM * mult;
                    const price = dim.prezzarioPrezzo ?? 0.0;
                    const tot = qty * price;
                    const isSelected = selectedId === dim.id;

                    return (
                      <div
                        key={dim.id}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnRow(e, dim.id)}
                        onClick={() => setSelectedId(dim.id)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? "bg-amber-950/25 border-amber-500/80 shadow-md"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!dim.includeInComputo}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateEntity(dim.id, { includeInComputo: e.target.checked });
                            }}
                            className="mt-0.5 accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-neutral-100 text-[10px]">
                                Misura {idx + 1}
                              </span>
                              <span className="font-mono text-[9.5px] font-black text-amber-400 bg-neutral-900 px-1 py-0.2 rounded border border-neutral-800">
                                L = {lengthM.toFixed(2)} m
                              </span>
                            </div>

                            {/* PRICE CODE ASSOCIATION */}
                            {dim.prezzarioCodice ? (
                              <div className="bg-neutral-900 border border-neutral-850 p-1.5 rounded-lg space-y-0.5 text-[9.5px]">
                                <div className="flex justify-between font-mono">
                                  <span className="font-black text-amber-400">{dim.prezzarioCodice}</span>
                                  <span className="font-bold text-white">€ {tot.toFixed(2)}</span>
                                </div>
                                <div className="text-[9px] text-neutral-400 line-clamp-1">
                                  {dim.prezzarioDescrizione}
                                </div>
                                <div className="flex justify-between text-[8px] text-neutral-500">
                                  <span>Prezzo: € {price.toFixed(2)}/{dim.prezzarioUnita}</span>
                                  {mult !== 1 && <span>Fattore: {mult.toFixed(1)}</span>}
                                </div>
                              </div>
                            ) : (
                              <div className="border border-dashed border-neutral-800 rounded-lg p-2 text-center text-neutral-500 text-[9px] hover:bg-neutral-900/40">
                                Rilascia voce prezzario qui per associare
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* COMPUTO FOOTER */}
              <div className="mt-2.5 pt-2.5 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="block text-[8px] text-neutral-400 uppercase tracking-widest font-bold">Totale Computo</span>
                  <span className="font-mono font-black text-amber-400 text-sm">
                    € {totalComputoAmount.toFixed(2)}
                  </span>
                </div>
                
                <button
                  onClick={handleExportComputo}
                  className="flex items-center gap-1.5 bg-amber-500 text-neutral-950 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-400 shadow-md transition-all active:scale-95 text-[10px]"
                >
                  <Download size={11} />
                  Esporta Computo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
