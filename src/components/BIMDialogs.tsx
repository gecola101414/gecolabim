import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Building, 
  X, 
  Layers, 
  Check, 
  Home, 
  Sparkles, 
  ShieldAlert, 
  Zap, 
  Droplet, 
  Grid,
  ChevronRight,
  Maximize2,
  Lightbulb,
  Plug,
  Power,
  Repeat,
  Server,
  Tv,
  Wifi,
  ToggleRight,
  Shuffle,
  CircleDot,
  ArrowDownToLine,
  Box,
  Bell,
  Volume2,
  Thermometer,
  Flashlight,
  Siren,
  Sun,
  Phone,
  Video,
  Trash2,
  Plus,
  Search,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock
} from "lucide-react";
import { Point, Entity, Floor } from '../types';
import { TEMPLATES, Template } from '../data/templates';
import { TemplatePreview } from './TemplatePreview';
import { BIM_FAMILIES, BIMFamily } from '../data/bimFamilies';

// --- DRAGGABLE WRAPPER HELPERS ---
function useDraggableDialog(isOpen: boolean, defaultPos: { x: number; y: number }) {
  const [position, setPosition] = useState(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      // Position appropriately on screen
      const w = window.innerWidth;
      setPosition({
        x: Math.max(20, Math.floor(w - 400)), // Right side of the viewport
        y: 120
      });
    }
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only left-click
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;

    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return { position, handlePointerDown, handlePointerMove, handlePointerUp };
}

// 1. --- MURI (WALLS) DIALOG ---
interface MuriDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastWallThickness: number;
  setBIMWallThickness: (t: number) => void;
  onActivateWallDrawing: (thickness: number, renderMode: 'solid' | 'transparent') => void;
}
export const MuriDialog: React.FC<MuriDialogProps> = ({
  isOpen,
  onClose,
  lastWallThickness,
  setBIMWallThickness,
  onActivateWallDrawing
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 120 });
  const [thickness, setThickness] = useState<number>(lastWallThickness || 15);
  const [wallHeight, setWallHeight] = useState<number>(270);
  const [wallStyle, setWallStyle] = useState<'standard' | 'double' | 'filled'>('standard');
  const [insulation, setInsulation] = useState<'none' | 'cappotto' | 'cavity'>('none');
  const [renderMode, setRenderMode] = useState<'solid' | 'transparent'>('solid');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBIMWallThickness(thickness);
    onActivateWallDrawing(thickness, renderMode);
  };

  const presetSpessori = [10, 15, 30, 40];

  return (
    <div 
      className="fixed z-[100] select-none animate-fade-in bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-cyan-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Building size={14} />
          <span>🧱 Sottomenu Muri BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 pb-2">
        <div>
          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
            Spessore del Muro (cm)
          </label>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {presetSpessori.map(sp => (
              <button
                type="button"
                key={sp}
                onClick={() => setThickness(sp)}
                className={`py-1.5 px-2 rounded font-mono text-xs font-bold border transition ${
                  thickness === sp ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {sp} cm
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            max="150"
            value={thickness}
            onChange={(e) => setThickness(parseInt(e.target.value) || 15)}
            className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 text-xs font-mono font-semibold focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 mt-1">Altezza (cm)</label>
            <input
              type="number"
              min="100"
              max="600"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseInt(e.target.value) || 270)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1 mt-1">Stratigrafia</label>
            <select
              value={insulation}
              onChange={(e: any) => setInsulation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="none">Standard</option>
              <option value="cappotto">Cappotto (12cm)</option>
              <option value="cavity">Intercapedine</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Stile Disegno</label>
          <div className="grid grid-cols-3 gap-2">
            {(['standard', 'double', 'filled'] as any[]).map(st => (
              <button
                type="button"
                key={st}
                onClick={() => setWallStyle(st)}
                className={`text-[9.5px] py-1.5 rounded border transition-colors ${
                  wallStyle === st ? 'bg-cyan-600/10 border-cyan-500 text-cyan-300 font-bold' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {st === 'standard' ? 'Standard' : st === 'double' ? 'Doppia riga' : 'Riempito'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Rendering 3D</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRenderMode('solid')} className={`flex-1 py-1.5 text-[10px] rounded border ${renderMode === 'solid' ? 'bg-cyan-600/20 border-cyan-500' : 'bg-slate-900 border-slate-800'}`}>Solido (Pieno)</button>
            <button type="button" onClick={() => setRenderMode('transparent')} className={`flex-1 py-1.5 text-[10px] rounded border ${renderMode === 'transparent' ? 'bg-cyan-600/20 border-cyan-500' : 'bg-slate-900 border-slate-800'}`}>Trasparente (Parete)</button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 p-2.5 bg-slate-900 rounded border border-slate-900 leading-normal">
          💡 I muri definiti verranno mappati sul Layer <strong>BIM_Muri</strong> e disegnati in parallelo con asse centrale.
        </p>

        <button
          type="submit"
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-2.5 rounded-lg text-xs tracking-wider transition-all shadow-md cursor-pointer"
        >
          AVVIA DISEGNO MURO ✍️
        </button>
      </form>
    </div>
  );
};


// 2. --- PORTE (DOORS) DIALOG ---
interface PorteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastDoorWidth: number;
  lastDoorHeight: number;
  onConfirmDoor: (width: number, height: number, type: string, flip: boolean) => void;
  onDelete?: () => void;
}
export const PorteDialog: React.FC<PorteDialogProps> = ({
  isOpen,
  onClose,
  lastDoorWidth,
  lastDoorHeight,
  onConfirmDoor,
  onDelete
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 120 });
  const [width, setWidth] = useState<number>(lastDoorWidth || 80);
  const [height, setHeight] = useState<number>(lastDoorHeight || 210);
  const [doorType, setDoorType] = useState<string>('singola');
  const [flip, setFlip] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmDoor(width, height, doorType, flip);
  };

  const presetMisure = [70, 80, 90, 100, 120];

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-rose-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <ChevronRight size={14} className="text-rose-500 rotate-90" />
          <span>🚪 Sottomenu Porte BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 pb-2">
        <div>
          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Larghezza Porta (cm)</label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {presetMisure.map(w => (
              <button
                type="button"
                key={w}
                onClick={() => setWidth(w)}
                className={`py-1 px-1.5 rounded font-mono text-[10px] font-bold border transition ${
                  width === w ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {w}cm
              </button>
            ))}
          </div>
          <input
            type="number"
            min="30"
            max="300"
            value={width}
            onChange={(e) => setWidth(parseInt(e.target.value) || 80)}
            className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 text-xs font-mono focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Altezza (cm)</label>
            <input
              type="number"
              min="100"
              max="300"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 210)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tipologia</label>
            <select
              value={doorType}
              onChange={(e: any) => setDoorType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs"
            >
              <option value="singola">Battente Singola</option>
              <option value="doppia">Doppio Battente</option>
              <option value="scorrevole">Scorrevole (Scrigno)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 py-1 bg-slate-900/50 p-2 rounded border border-slate-850">
          <input
            type="checkbox"
            id="door-flip"
            checked={flip}
            onChange={(e) => setFlip(e.target.checked)}
            className="cursor-pointer"
          />
          <label htmlFor="door-flip" className="text-[10px] text-slate-300 font-bold select-none cursor-pointer">
            Inverti direzione specchio / swing (sinistra)
          </label>
        </div>

        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="bg-red-600/10 hover:bg-red-600/20 text-red-500 font-black px-4 py-2.5 rounded-lg text-xs tracking-wider transition cursor-pointer flex items-center justify-center border border-red-500/20"
              title="Cancella Oggetto"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2.5 rounded-lg text-xs tracking-wider transition shadow-md cursor-pointer uppercase"
          >
            ATTIVA PORTA IN LOCAZIONE 🚪
          </button>
        </div>
      </form>
    </div>
  );
};


// 3. --- FINESTRE (WINDOWS) DIALOG ---
interface FinestreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastWindowWidth: number;
  lastWindowHeight: number;
  lastWindowZElevation?: number;
  lastWindowType?: string;
  lastWindowFlipLeft?: boolean;
  lastWindowFlipSide?: boolean;
  lastWindowRotation?: number;
  onConfirmWindow: (
    width: number, 
    height: number, 
    type: string, 
    trasmittanza: number, 
    prezzario: string, 
    zElevation: number, 
    flipLeft: boolean, 
    flipSide: boolean, 
    rotation: number
  ) => void;
  onDelete?: () => void;
}
export const FinestreDialog: React.FC<FinestreDialogProps> = ({
  isOpen,
  onClose,
  lastWindowWidth,
  lastWindowHeight,
  lastWindowZElevation = 100,
  lastWindowType = 'singola',
  lastWindowFlipLeft = false,
  lastWindowFlipSide = false,
  lastWindowRotation = 0,
  onConfirmWindow,
  onDelete
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 120 });
  const [width, setWidth] = useState<number>(lastWindowWidth || 120);
  const [height, setHeight] = useState<number>(lastWindowHeight || 140);
  const [zElevation, setZElevation] = useState<number>(lastWindowZElevation || 100);
  const [winType, setWinType] = useState<string>(lastWindowType || 'singola');
  const [flipLeft, setFlipLeft] = useState<boolean>(lastWindowFlipLeft);
  const [flipSide, setFlipSide] = useState<boolean>(lastWindowFlipSide);
  const [rotation, setRotation] = useState<number>(lastWindowRotation);

  const [trasmittanza, setTrasmittanza] = useState<number>(0.0);
  const [prezzario, setPrezzario] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmWindow(width, height, winType, trasmittanza, prezzario, zElevation, flipLeft, flipSide, rotation);
  };

  const presetMisure = [80, 100, 120, 140, 180, 240];

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Maximize2 size={14} className="text-blue-500" />
          <span>🪟 Proprietà Infisso BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 pb-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Larghezza Infisso (cm)</label>
            <div className="grid grid-cols-6 gap-1 mb-2">
              {presetMisure.map(w => (
                <button
                  type="button"
                  key={w}
                  onClick={() => setWidth(w)}
                  className={`py-1 px-1 rounded font-mono text-[9.5px] font-bold border transition ${
                    width === w ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="30"
              max="400"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 120)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 text-xs font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Altezza (cm)</label>
            <input
              type="number"
              min="50"
              max="250"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 140)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Quota Z (Soglia)</label>
            <input
              type="number"
              min="0"
              max="200"
              value={zElevation}
              onChange={(e) => setZElevation(parseInt(e.target.value) || 100)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Rotazione (°)</label>
            <input
              type="number"
              min="0"
              max="360"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value) ?? 0)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono border-blue-500/30 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tipologia</label>
            <select
              value={winType}
              onChange={(e: any) => setWinType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs focus:outline-none focus:border-blue-400"
            >
              <option value="singola">Battente Singola</option>
              <option value="doppia">Doppio Battente</option>
              <option value="portafinestra">Portafinestra</option>
              <option value="vasistas">Basi / Vasistas</option>
              <option value="vetrata">Vetrata Fissa</option>
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Trasmittanza</label>
            <input
              type="number"
              step="0.01"
              value={trasmittanza}
              onChange={(e) => setTrasmittanza(parseFloat(e.target.value) || 0.0)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Prezzario</label>
            <input
              type="text"
              value={prezzario}
              onChange={(e) => setPrezzario(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
              placeholder="Voce..."
            />
          </div>

          {(winType !== 'vetrata' && winType !== 'vasistas') && (
            <>
              <div className="col-span-2 flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Apertura (Sinistra / Destra)</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${!flipLeft ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>Sx</span>
                  <button
                    type="button"
                    onClick={() => setFlipLeft(!flipLeft)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${flipLeft ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${flipLeft ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-[10px] ${flipLeft ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>Dx</span>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded">
                <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Verso Apertura (Interno / Esterno)</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${!flipSide ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>Int</span>
                  <button
                    type="button"
                    onClick={() => setFlipSide(!flipSide)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${flipSide ? 'bg-blue-600' : 'bg-slate-700'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${flipSide ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-[10px] ${flipSide ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>Est</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="bg-red-600/10 hover:bg-red-600/20 text-red-500 font-black px-4 py-2.5 rounded-lg text-xs tracking-wider transition cursor-pointer flex items-center justify-center border border-red-500/20"
              title="Cancella Oggetto"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 rounded-lg text-xs tracking-wider transition shadow-md cursor-pointer uppercase"
          >
            CONFERMA E POSIZIONA
          </button>
        </div>
      </form>
    </div>
  );
};


// 4. --- ARREDI (FURNITURE) DIALOG ---
interface ArrediDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateId: string | null;
  onSelectFurnitureTemplate: (id: string) => void;
}
export const ArrediDialog: React.FC<ArrediDialogProps> = ({
  isOpen,
  onClose,
  selectedTemplateId,
  onSelectFurnitureTemplate
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 125 });
  const [filterStr, setFilterStr] = useState<string>('');

  if (!isOpen) return null;

  const items = TEMPLATES.filter(t => t.category === 'Arredi' && t.name.toLowerCase().includes(filterStr.toLowerCase()));

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-indigo-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Layers size={14} className="text-indigo-500" />
          <span>🛋️ Sottomenu Arredi BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2 pb-2">
        <input
          type="text"
          placeholder="Cerca arredo..."
          value={filterStr}
          onChange={(e) => setFilterStr(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 text-white p-2 rounded text-xs text-left focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
          {items.map(t => (
            <button
              type="button"
              key={t.id}
              onClick={() => onSelectFurnitureTemplate(t.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                selectedTemplateId === t.id ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-bold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/50"
              }`}
            >
              <div className="w-12 h-12 flex items-center justify-center p-1 bg-slate-800 border border-slate-700 rounded-md mb-1.5 overflow-hidden">
                <TemplatePreview template={t} size={40} />
              </div>
              <span className="text-[9px] font-bold leading-tight line-clamp-1">{t.name}</span>
            </button>
          ))}
        </div>

        <p className="text-[9px] text-slate-400 mt-1 pl-1 leading-normal">
          💡 Clicca l'arredo e posizionalo con un click sulla planimetria. Verrà posizionato sul layer automatico <strong>BIM_Arredi</strong>.
        </p>
      </div>
    </div>
  );
};


// 5. --- SANITARI (SANITARY) DIALOG ---
interface SanitariDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateId: string | null;
  onSelectSanitaryTemplate: (id: string) => void;
}
export const SanitariDialog: React.FC<SanitariDialogProps> = ({
  isOpen,
  onClose,
  selectedTemplateId,
  onSelectSanitaryTemplate
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 125 });

  if (!isOpen) return null;

  const items = TEMPLATES.filter(t => t.category === 'Bagno');

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-emerald-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Droplet size={14} className="text-emerald-500 animate-pulse" />
          <span>🚿 Sanitari & Bagno BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <div className="space-y-3 overflow-y-auto pr-2 pb-2">
        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
          {items.map(t => (
            <button
              type="button"
              key={t.id}
              onClick={() => onSelectSanitaryTemplate(t.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                selectedTemplateId === t.id ? "bg-emerald-600/10 border-emerald-500 text-emerald-300 font-bold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/50"
              }`}
            >
              <div className="w-12 h-12 flex items-center justify-center p-1 bg-slate-800 border border-slate-700 rounded-md mb-1.5 overflow-hidden">
                <TemplatePreview template={t} size={40} />
              </div>
              <span className="text-[9px] font-bold leading-tight line-clamp-1">{t.name}</span>
            </button>
          ))}
        </div>

        <p className="text-[9px] text-slate-400 mt-1 pl-1 leading-normal">
          💡 Verrà posizionato sul layer automatico <strong>BIM_Sanitari</strong> per la gestione separata degli scarichi.
        </p>
      </div>
    </div>
  );
};


// 6. --- IMPIANTI ELETTRICI DIALOG ---
interface ElettricoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddElectricSymbol: (symbolType: string, label: string) => void;
}
export const ElettricoDialog: React.FC<ElettricoDialogProps> = ({
  isOpen,
  onClose,
  onAddElectricSymbol
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 130 });

  if (!isOpen) return null;

  const symbols = [
    { type: 'punto_luce', name: 'Punto Luce', desc: 'Punto luce a soffitto/rosone CEI', color: '#64748b', icon: Lightbulb },
    { type: 'presa_standard', name: 'Presa Bipasso 10/16A', desc: 'Presa standard universale CEI', color: '#64748b', icon: Plug },
    { type: 'presa_schuko', name: 'Presa Schuko', desc: 'Presa universale tedesca', color: '#64748b', icon: Zap },
    { type: 'presa_tv', name: 'Presa TV', desc: 'Presa antenna TV', color: '#64748b', icon: Tv },
    { type: 'presa_dati', name: 'Presa Dati LAN', desc: 'Presa rete RJ45 / LAN', color: '#64748b', icon: Wifi },
    { type: 'interruttore', name: 'Interruttore', desc: 'Comando singolo polo', color: '#64748b', icon: Power },
    { type: 'interruttore_bipolare', name: 'Int. Bipolare', desc: 'Comando doppio polo', color: '#64748b', icon: ToggleRight },
    { type: 'deviatore', name: 'Deviatore', desc: 'Comando incrociato 2 vie', color: '#64748b', icon: Repeat },
    { type: 'invertitore', name: 'Invertitore', desc: 'Comando incrociato 3+ vie', color: '#64748b', icon: Shuffle },
    { type: 'pulsante', name: 'Pulsante', desc: 'Comando a impulso', color: '#64748b', icon: CircleDot },
    { type: 'pulsante_tirante', name: 'Tirante', desc: 'Pulsante a tirante bagno', color: '#64748b', icon: ArrowDownToLine },
    { type: 'quadro', name: 'Quadro Generale', desc: 'Quadro elettrico (Q.E.G)', color: '#64748b', icon: Server },
    { type: 'scatola_derivazione', name: 'Scatola Deriv.', desc: 'Scatola di derivazione', color: '#64748b', icon: Box },
    { type: 'suoneria', name: 'Suoneria', desc: 'Campanello o ronzatore principale', color: '#64748b', icon: Bell },
    { type: 'ronzatore', name: 'Ronzatore', desc: 'Segnalatore acustico', color: '#64748b', icon: Volume2 },
    { type: 'termostato', name: 'Termostato', desc: 'Controllo termico ambientale', color: '#64748b', icon: Thermometer },
    { type: 'faretto', name: 'Faretto Incasso', desc: 'Punto luce a faretto', color: '#64748b', icon: Flashlight },
    { type: 'lampada_emergenza', name: 'Lamp. Emergenza', desc: 'Luce di emergenza autonoma', color: '#64748b', icon: Siren },
    { type: 'applique', name: 'Applique', desc: 'Punto luce a parete', color: '#64748b', icon: Sun },
    { type: 'citofono', name: 'Citofono', desc: 'Unità interna citofonica', color: '#64748b', icon: Phone },
    { type: 'videocitofono', name: 'Videocitofono', desc: 'Unità interna videocitofonica', color: '#64748b', icon: Video },
  ];

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Zap size={14} className="text-amber-500 animate-pulse" />
          <span>⚡ Impianto Elettrico BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <div className="space-y-2 overflow-y-auto pr-2 pb-2">
        <span className="text-[9px] text-slate-400 font-bold block uppercase pb-1 border-b border-slate-900 tracking-widest">Procedi al posizionamento</span>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {symbols.map(sym => (
            <button
              type="button"
              key={sym.type}
              onClick={() => onAddElectricSymbol(sym.type, sym.name)}
              className="w-full text-left p-2 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-900/50 hover:border-slate-700 transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-center">
                  <sym.icon size={16} style={{ color: sym.color }} />
                </div>
                <div>
                  <span className="text-[10.5px] font-bold block text-slate-200">{sym.name}</span>
                  <span className="text-[8px] text-slate-500 leading-none">{sym.desc}</span>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sym.color }}></span>
            </button>
          ))}
        </div>

        <p className="text-[9px] text-slate-400 mt-2 pl-1 leading-normal italic text-slate-500">
          💡 Simboli CEI standard calcolati geometricamente sul Layer <strong>BIM_Impianti_Elettrici</strong>. Cerca un punto all'interno del disegno.
        </p>
      </div>
    </div>
  );
};


// 7. --- IMPIANTI IDRAULICI DIALOG ---
interface IdraulicoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddHydraulicSymbol: (symbolType: string, label: string) => void;
}
export const IdraulicoDialog: React.FC<IdraulicoDialogProps> = ({
  isOpen,
  onClose,
  onAddHydraulicSymbol
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 130 });

  if (!isOpen) return null;

  const symbols = [
    { type: 'carico_af', name: '🔵 Carico Acqua Fredda (AF)', desc: 'Ingresso adduzione idrica fredda', color: '#2563eb' },
    { type: 'carico_ac', name: '🔴 Carico Acqua Calda (AC)', desc: 'Ingresso adduzione calda', color: '#dc2626' },
    { type: 'scarico_idr', name: '⚪ Scarico Fognario Nero', desc: 'Scarico WC o scarichi grigi cucina', color: '#9ca3af' },
    { type: 'caldaia', name: '🔥 Caldaia a Condensazione', desc: 'Impianto generazione calore', color: '#f97316' },
    { type: 'collettore', name: '🔌 Collettore riscaldamento', desc: 'Cassetta di distribuzione radiante/radiatori', color: '#eab308' },
  ];

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-blue-400 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Droplet size={14} className="text-blue-500 animate-pulse" />
          <span>🚰 Impianto Idraulico BIM</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <div className="space-y-2 overflow-y-auto pr-2 pb-2">
        <span className="text-[9px] text-slate-400 font-bold block uppercase pb-1 border-b border-slate-900 tracking-widest">Procedi al posizionamento</span>
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {symbols.map(sym => (
            <button
              type="button"
              key={sym.type}
              onClick={() => onAddHydraulicSymbol(sym.type, sym.name.substring(2))}
              className="w-full text-left p-2 rounded-lg bg-slate-900 border border-slate-850 hover:bg-slate-900/50 hover:border-slate-700 transition flex items-center justify-between"
            >
              <div>
                <span className="text-[10.5px] font-bold block text-slate-200">{sym.name}</span>
                <span className="text-[8px] text-slate-500 leading-none">{sym.desc}</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sym.color }}></span>
            </button>
          ))}
        </div>

        <p className="text-[9px] text-slate-400 mt-2 pl-1 leading-normal italic text-slate-500">
          💡 Simboli di adduzione e scarico generati geometricamente in pianta sul Layer <strong>BIM_Impianti_Idraulici</strong>.
        </p>
      </div>
    </div>
  );
};


// 8. --- FINITURE (FINISHES) DIALOG ---
interface FinitureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultHatchStyle: any;
  setDefaultHatchStyle: (style: any) => void;
  onActivateFlooringHatch: () => void;
}
export const FinitureDialog: React.FC<FinitureDialogProps> = ({
  isOpen,
  onClose,
  defaultHatchStyle,
  setDefaultHatchStyle,
  onActivateFlooringHatch
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 130 });
  const [pattern, setPattern] = useState<string>(defaultHatchStyle?.pattern || 'ANSI31');
  const [scale, setScale] = useState<number>(defaultHatchStyle?.scale || 30);
  const [angle, setAngle] = useState<number>(defaultHatchStyle?.angle || 0);
  const [color, setColor] = useState<string>(defaultHatchStyle?.color || '#000000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDefaultHatchStyle({
      pattern,
      scale,
      angle,
      color,
      sfumatura: 0
    });
    // Active floor placing tool
    onActivateFlooringHatch();
  };

  const patternOptions = [
    { id: 'ANSI31', name: 'Parquet trasversale' },
    { id: 'GRID', name: 'Piastrella Ceramica (Griglia)' },
    { id: 'BRICK', name: 'Gres Porcellanato Brick' },
    { id: 'ANSI32', name: 'Spina di Pesce (Chevron)' },
    { id: 'SOLID', name: 'Tinta unita (Massetto)' },
  ];

  return (
    <div 
      className="fixed z-[100] bg-slate-950 border border-slate-800 p-5 rounded-xl shadow-2xl max-w-sm w-full text-white max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h3 className="text-xs font-black uppercase text-rose-300 tracking-wider font-mono flex items-center gap-2 pointer-events-none">
          <Grid size={14} className="text-rose-400" />
          <span>🎨 Finiture e Pavimentazione</span>
        </h3>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none p-1">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 pb-2">
        <div>
          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Pattern della Pavimentazione</label>
          <select
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-white p-2 rounded text-xs focus:outline-none focus:border-rose-400"
          >
            {patternOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Scala Piastrelle/Grezza</label>
            <input
              type="number"
              min="2"
              max="200"
              value={scale}
              onChange={(e) => setScale(parseInt(e.target.value) || 30)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Angolo di Posa (°)</label>
            <input
              type="number"
              min="0"
              max="360"
              value={angle}
              onChange={(e) => setAngle(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-800 text-white p-1.5 rounded text-xs font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Colore Fuga / Pavimento</label>
          <div className="flex gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-8 bg-transparent border-0 cursor-pointer rounded-md overflow-hidden"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-white rounded p-1 px-2 text-xs font-mono"
            />
          </div>
        </div>

        <p className="text-[9.5px] text-slate-400 p-2 bg-slate-900 rounded border border-slate-900/50 leading-normal">
          💡 Clicca 'APPLICA PAVIMENTAZIONE' e poi clicca all'interno di una stanza per applicare in automatico la finitura sul Layer <strong>BIM_Finiture</strong>!
        </p>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-black py-2.5 rounded-lg text-xs tracking-wider transition shadow-md cursor-pointer"
        >
          APPLICA REGOLAMENTO PAVIMENTI 📐
        </button>
      </form>
    </div>
  );
};

// 9. --- AREA FUNZIONALE DIALOG ---
interface BIMElementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { 
    familyId: string;
    subFamily: string;
    name: string; 
    color: string; 
    zPlane: number;
    zElevation: number;
    objectHeight: number;
    hatch: 'SOLID' | 'ANSI31' | 'CROSS' | 'NONE';
    bimRenderMode?: 'solid' | 'transparent' | 'parete_verticale' | 'parete_orizzontale';
    duplicate?: boolean;
  }) => void;
  points?: Point[] | { points: Point[], holes?: Point[][] };
  initialData?: {
    familyId: string;
    subFamily: string;
    name: string;
    color: string;
    zPlane: number;
    zElevation: number;
    objectHeight: number;
    hatch: 'SOLID' | 'ANSI31' | 'CROSS' | 'NONE';
    bimRenderMode?: 'solid' | 'transparent' | 'parete_verticale' | 'parete_orizzontale';
  };
  onDelete?: () => void;
  floors: Floor[];
  isMultiAreaMode?: boolean;
  onToggleMultiAreaMode?: (checked: boolean) => void;
}

export const BIMElementDialog: React.FC<BIMElementDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  points,
  initialData,
  onDelete,
  floors,
  isMultiAreaMode,
  onToggleMultiAreaMode
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 300, y: 130 });
  
  // Persistent family choice
  const [familyId, setFamilyId] = useState<string>(() => localStorage.getItem('last_bim_family') || BIM_FAMILIES[0].id);
  const [subFamily, setSubFamily] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(() => BIM_FAMILIES.find(f => f.id === (localStorage.getItem('last_bim_family') || BIM_FAMILIES[0].id))?.defaultColor || '#34d399');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [zElevationInput, setZElevationInput] = useState<string>('0');
  const [objectHeightInput, setObjectHeightInput] = useState<string>('270');
  const [hatch, setHatch] = useState<'SOLID' | 'ANSI31' | 'CROSS' | 'NONE'>('SOLID');
  const [bimRenderMode, setBimRenderMode] = useState<'solid' | 'transparent' | 'parete_verticale' | 'parete_orizzontale'>('solid');
  
  const [customFamilyMode, setCustomFamilyMode] = useState(false);
  const [customFamilyName, setCustomFamilyName] = useState('');
  const [shouldDuplicate, setShouldDuplicate] = useState(false);

  const currentFamily = useMemo(() => BIM_FAMILIES.find(f => f.id === familyId), [familyId]);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (hasInitializedRef.current) {
        return; // Skip if already initialized for this open session
      }
      hasInitializedRef.current = true;

      // Find the best matching floor for initialData or saved last_bim_zPlane
      const targetZPlane = initialData ? initialData.zPlane : parseFloat(localStorage.getItem('last_bim_zPlane') || '0') || 0;
      let bestFloor = floors.find(f => f.elevation === targetZPlane);
      if (!bestFloor && floors.length > 0) {
        bestFloor = floors.reduce((prev, curr) => 
          Math.abs(curr.elevation - targetZPlane) < Math.abs(prev.elevation - targetZPlane) ? curr : prev
        );
      }
      if (bestFloor) {
        setSelectedFloorId(bestFloor.id);
      } else if (floors.length > 0) {
        setSelectedFloorId(floors[0].id);
      }

      setShouldDuplicate(false);

      if (initialData) {
        setFamilyId(initialData.familyId);
        setSubFamily(initialData.subFamily);
        setName(initialData.name);
        setColor(initialData.color);
        setZElevationInput(initialData.zElevation.toString());
        setObjectHeightInput(initialData.objectHeight.toString());
        setHatch(initialData.hatch);
        setBimRenderMode(initialData.bimRenderMode || 'solid');
      } else {
        const lastFam = localStorage.getItem('last_bim_family') || BIM_FAMILIES[0].id;
        const famObj = BIM_FAMILIES.find(f => f.id === lastFam);
        
        setFamilyId(lastFam);
        setSubFamily('');
        setName(famObj?.name || '');
        setColor(famObj?.defaultColor || '#34d399');
        setZElevationInput(localStorage.getItem('last_bim_zElevation') || '0');
        setObjectHeightInput(localStorage.getItem('last_bim_height') || '270');
        setHatch('SOLID');
        
        const isLinear = points && !Array.isArray(points) && (points as any).isLinear;
        setBimRenderMode(isLinear ? 'parete_verticale' : 'solid');
      }
    } else {
      hasInitializedRef.current = false;
    }
  }, [isOpen, initialData, floors]);

  const handleFamilyChange = (id: string) => {
    setFamilyId(id);
    localStorage.setItem('last_bim_family', id);
    const fam = BIM_FAMILIES.find(f => f.id === id);
    if (fam && !initialData) {
      setName(fam.name);
      setColor(fam.defaultColor);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedFloor = floors.find(f => f.id === selectedFloorId);
    const actualZPlane = matchedFloor ? matchedFloor.elevation : 0;

    localStorage.setItem('last_bim_zPlane', actualZPlane.toString());
    localStorage.setItem('last_bim_zElevation', zElevationInput);
    localStorage.setItem('last_bim_height', objectHeightInput);
    
    const parsedZElevation = parseFloat(zElevationInput.replace(',', '.')) || 0;
    const parsedObjectHeight = parseFloat(objectHeightInput.replace(',', '.')) || 270;

    onConfirm({ 
      familyId: customFamilyMode ? 'custom' : familyId,
      subFamily: customFamilyMode ? customFamilyName : subFamily,
      name: name || (customFamilyMode ? customFamilyName : (currentFamily?.name || '')), 
      color, 
      zPlane: actualZPlane,
      zElevation: parsedZElevation,
      objectHeight: Math.max(0.1, parsedObjectHeight), 
      hatch,
      bimRenderMode,
      duplicate: shouldDuplicate
    });
  };

  return (
    <div 
      className="fixed z-[200] bg-slate-950 border-2 border-indigo-500/50 p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-[420px] max-w-full text-white backdrop-blur-2xl max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-white/10 pb-3 mb-4 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="flex flex-col text-left text-ellipsis overflow-hidden">
          <h3 className="text-base font-black uppercase text-indigo-400 tracking-widest font-mono flex items-center gap-2">
            <Building size={16} className="animate-pulse" />
            <span>{initialData ? 'MODIFICA ELEMENTO BIM' : 'RILEVAMENTO ELEMENTO BIM'}</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-bold font-mono uppercase tracking-tighter">Standard Internazionale BIM</span>
        </div>
        <button type="button" onClick={onClose} className="bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-lg p-2 transition-colors">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 pb-2 scrollbar-none">
        
        {/* FAMILY SELECTION */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs text-slate-400 font-black uppercase tracking-widest font-mono italic">Famiglia di Appartenenza</label>
            <button 
              type="button" 
              onClick={() => setCustomFamilyMode(!customFamilyMode)}
              className="text-[10px] px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-all font-bold"
            >
              {customFamilyMode ? '- ANNULLA' : '+ PERSONALIZZATA'}
            </button>
          </div>
          
          {customFamilyMode ? (
            <input
              type="text"
              placeholder="Nome Nuova Famiglia..."
              value={customFamilyName}
              onChange={(e) => setCustomFamilyName(e.target.value)}
              autoFocus
              className="w-full bg-indigo-500/10 border border-indigo-500/30 text-white rounded-lg p-3 text-sm font-bold focus:outline-none focus:border-indigo-400 transition-colors"
            />
          ) : (
            <div className="relative">
              <select
                value={familyId}
                onChange={(e) => handleFamilyChange(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-white rounded-lg p-3 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                {BIM_FAMILIES.map(fam => (
                  <option key={fam.id} value={fam.id} className="bg-slate-900 text-slate-200">
                    {fam.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-3.5 pointer-events-none opacity-50">
                <ChevronDown size={16} />
              </div>
            </div>
          )}
          {currentFamily && !customFamilyMode && (
            <p className="text-[10px] text-slate-500 mt-1 font-medium font-mono uppercase tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
              📂 {currentFamily.category} - {currentFamily.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 font-black uppercase tracking-widest mb-1.5 font-mono italic">Identificativo / Mark</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg p-3 text-sm font-bold focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Es. Muro M1, Pilastro P2..."
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 font-black uppercase tracking-widest mb-1.5 font-mono italic">Retino (Hatch)</label>
            <select
              value={hatch}
              onChange={(e) => setHatch(e.target.value as any)}
              className="w-full bg-slate-900 border border-white/10 text-white rounded-lg p-3 text-xs font-bold focus:outline-none focus:border-indigo-500"
            >
              <option value="SOLID" className="bg-slate-900">Colore Pieno</option>
              <option value="ANSI31" className="bg-slate-900">Tratteggio (ANSI31)</option>
              <option value="CROSS" className="bg-slate-900">Reticolo (Cross)</option>
              <option value="NONE" className="bg-slate-900">Solo Contorno</option>
            </select>
          </div>

          <div>
             <label className="block text-xs text-slate-400 font-black uppercase tracking-widest mb-1.5 font-mono italic">Colore Rappresent.</label>
             <div className="flex items-center gap-2 h-11 bg-white/5 border border-white/10 rounded-lg px-2 overflow-hidden">
                <input
                 type="color"
                 value={color.startsWith('rgba') ? '#6366f1' : color}
                 onChange={(e) => setColor(e.target.value)}
                 className="w-full h-9 bg-transparent border-0 cursor-pointer p-0"
               />
             </div>
          </div>

          {/* Piano di Riferimento (finestra a tendina) */}
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 font-black uppercase tracking-widest mb-1.5 font-mono italic">
              Piano di Riferimento (1° Dato)
            </label>
            <div className="relative">
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-white rounded-lg p-3 text-sm font-bold focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {[...floors].sort((a,b) => b.elevation - a.elevation).map(floor => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name} (Quota: {floor.elevation} cm)
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-3.5 pointer-events-none opacity-50">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* Quota di Partenza (2° Dato) & Altezza dell'oggetto */}
          <div className="col-span-2 grid grid-cols-2 gap-4 bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
            <div>
              <label className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 font-mono">
                Quota di Partenza (2° Dato) (cm)
              </label>
              <input
                type="text"
                value={zElevationInput}
                onChange={(e) => setZElevationInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-cyan-400 rounded p-2.5 text-sm font-mono font-bold focus:outline-none focus:border-indigo-500"
                placeholder="Es. -6 o +10"
              />
              <span className="text-[9px] text-slate-500 italic mt-1 block">Può essere negativo (es. massetto -6)</span>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 font-mono">
                Altezza Oggetto (cm)
              </label>
              <input
                type="text"
                value={objectHeightInput}
                onChange={(e) => setObjectHeightInput(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-white rounded p-2.5 text-sm font-mono font-bold focus:outline-none focus:border-indigo-500"
                placeholder="Sempre positiva"
              />
              <span className="text-[9px] text-slate-500 italic mt-1 block">Sempre positiva</span>
            </div>
          </div>
          <div className="col-span-2 pt-4 border-t border-white/5">
            <label className="block text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2 font-mono italic">Rendering 3D / Tipo Elemento</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button 
                type="button" 
                onClick={() => setBimRenderMode('solid')} 
                className={`py-2 px-1 text-[10px] rounded-lg border font-bold cursor-pointer transition-all ${
                  bimRenderMode === 'solid' 
                    ? 'bg-cyan-600/20 border-cyan-500 text-white' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
                title="Rappresentazione volumetrica piena estruesa in 3D"
              >
                Solido (Pieno)
              </button>
              <button 
                type="button" 
                onClick={() => setBimRenderMode('parete_verticale')} 
                className={`py-2 px-1 text-[10px] rounded-lg border font-bold cursor-pointer transition-all ${
                  bimRenderMode === 'parete_verticale' 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
                title="Genera solo le pareti verticali sul perimetro (spessore simbolico)"
              >
                Parete Verticale
              </button>
              <button 
                type="button" 
                onClick={() => setBimRenderMode('parete_orizzontale')} 
                className={`py-2 px-1 text-[10px] rounded-lg border font-bold cursor-pointer transition-all ${
                  bimRenderMode === 'parete_orizzontale' 
                    ? 'bg-emerald-600/20 border-emerald-500 text-white' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
                title="Genera lastre orizzontali (pavimenti o soffitti, spessore simbolico)"
              >
                Parete Orizzontale
              </button>
            </div>
            {/* Explanatory subtitle helper */}
            <p className="text-[9px] text-slate-500 mt-1.5 italic font-medium leading-normal">
              {bimRenderMode === 'solid' && "🧱 Volume pieno solido con riempimento 3D completo."}
              {bimRenderMode === 'parete_verticale' && "🧱 Parete Verticale: prende solo il perimetro e l'altezza, spessore simbolico."}
              {bimRenderMode === 'parete_orizzontale' && "🥞 Parete Orizzontale: crea solai/soffitti con perimetro e area, spessore simbolico."}
            </p>
          </div>
        </div>

        {onToggleMultiAreaMode && (
          <div className="bg-slate-900 border border-emerald-500/30 p-3.5 rounded-xl flex items-start gap-3 mt-4">
            <input
              id="bim-multiarea-checkbox"
              type="checkbox"
              checked={isMultiAreaMode}
              onChange={(e) => onToggleMultiAreaMode(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950 accent-emerald-500 cursor-pointer mt-0.5"
            />
            <label htmlFor="bim-multiarea-checkbox" className="text-xs text-emerald-400 font-black uppercase tracking-wider cursor-pointer flex-1 select-none">
              <span>Aggiungi Altre Figure ➕</span>
              <span className="block text-[10px] text-slate-400 font-medium normal-case tracking-normal mt-0.5 leading-relaxed">
                Continua a cliccare su altre aree nel disegno per unirle a questa figura prima di salvare.
              </span>
            </label>
          </div>
        )}

        {initialData && (
          <div className="bg-slate-900 border border-amber-500/30 p-3.5 rounded-xl flex items-start gap-3 mt-4">
            <input
              id="bim-duplicate-checkbox"
              type="checkbox"
              checked={shouldDuplicate}
              onChange={(e) => setShouldDuplicate(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950 accent-indigo-500 cursor-pointer mt-0.5"
            />
            <label htmlFor="bim-duplicate-checkbox" className="text-xs text-amber-400 font-black uppercase tracking-wider cursor-pointer flex-1 select-none">
              <span>Duplica Elemento ⎘</span>
              <span className="block text-[10px] text-slate-400 font-medium normal-case tracking-normal mt-0.5 leading-relaxed">
                Genera un nuovo oggetto pari a quello evidenziato con i parametri modificati invece di aggiornarlo. Molto utile per alzare/copiare elementi identici sui vari piani.
              </span>
            </label>
          </div>
        )}

        <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between gap-3">
          <p className="text-[11px] text-indigo-400 font-medium leading-relaxed italic">
            💡 La selezione verrà mantenuta per i prossimi caricamenti veloci degli elementi.
          </p>
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/40">
            <Sparkles size={16} className="text-indigo-400" />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="bg-red-600/10 hover:bg-red-600/20 text-red-500 font-black px-4.5 py-4 rounded-xl text-xs tracking-widest transition-all cursor-pointer flex items-center justify-center border border-red-500/20 active:scale-95"
              title="Cancella Elemento"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl text-xs tracking-widest transition-all shadow-[0_10px_20px_rgba(79,70,229,0.3)] cursor-pointer uppercase active:scale-[0.98] border border-indigo-400/30"
          >
            {initialData ? (shouldDuplicate ? 'DUPLICA ELEMENTO BIM ⎘' : 'AGGIORNA ELEMENTO BIM') : 'CARICA ELEMENTO BIM ✅'}
          </button>
        </div>
      </form>
    </div>
  );
};

// 10. --- GESTIONE PIANI DIALOG (STORY MANAGER) ---
interface FloorManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  floors: Floor[];
  onUpdateFloors: (newFloors: Floor[]) => void;
}

export const FloorManagerDialog: React.FC<FloorManagerDialogProps> = ({
  isOpen,
  onClose,
  floors,
  onUpdateFloors,
}) => {
  const { position, handlePointerDown, handlePointerMove, handlePointerUp } = useDraggableDialog(isOpen, { x: 400, y: 150 });

  if (!isOpen) return null;

  // Sort floors descending by elevation
  const sortedFloors = [...floors].sort((a, b) => b.elevation - a.elevation);

  const handleUpdateFloorName = (id: string, newName: string) => {
    const updated = floors.map(f => f.id === id ? { ...f, name: newName } : f);
    onUpdateFloors(updated);
  };

  const handleUpdateFloorElevation = (id: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    const updated = floors.map(f => f.id === id ? { ...f, elevation: isNaN(parsed) ? 0 : parsed } : f);
    onUpdateFloors(updated);
  };

  const handleDeleteFloor = (id: string) => {
    const updated = floors.filter(f => f.id !== id);
    onUpdateFloors(updated);
  };

  const handleAddAboveGround = () => {
    const aboveGroundFloors = floors.filter(f => f.type === 'fuori_terra');
    let nextNum = 0;
    let highestElev = 0;
    
    aboveGroundFloors.forEach(f => {
      const match = f.name.match(/Piano\s+(\d+)/i);
      if (match) {
        const num = parseInt(match[1]);
        if (num > nextNum) nextNum = num;
      }
      if (f.elevation > highestElev) highestElev = f.elevation;
    });

    const newNum = nextNum + 1;
    const newElev = highestElev + 300; // default 3 meters per story
    const newFloor: Floor = {
      id: `floor_above_${Date.now()}`,
      name: `Piano ${newNum}`,
      elevation: newElev,
      type: 'fuori_terra'
    };
    onUpdateFloors([...floors, newFloor]);
  };

  const handleAddUnderground = () => {
    const undergroundFloors = floors.filter(f => f.type === 'interrato');
    let lowestNum = 0;
    let lowestElev = 0;

    undergroundFloors.forEach(f => {
      const match = f.name.match(/Piano\s+(-\d+)/i);
      if (match) {
        const num = parseInt(match[1]);
        if (num < lowestNum) lowestNum = num;
      }
      if (f.elevation < lowestElev) lowestElev = f.elevation;
    });

    const newNum = lowestNum - 1;
    const newElev = lowestElev - 300; // default 3 meters per story
    const newFloor: Floor = {
      id: `floor_under_${Date.now()}`,
      name: `Piano ${newNum}`,
      elevation: newElev,
      type: 'interrato'
    };
    onUpdateFloors([...floors, newFloor]);
  };

  return (
    <div 
      className="fixed z-[250] bg-slate-950 border-2 border-indigo-500/50 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] max-w-md w-full text-white backdrop-blur-2xl max-h-[85vh] flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="flex justify-between items-center border-b border-white/10 pb-3 mb-4 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="flex flex-col text-left">
          <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest font-mono flex items-center gap-2 pointer-events-none">
            <Building size={14} className="text-indigo-400" />
            <span>🏢 GESTIONE PIANI (STORY MANAGER)</span>
          </h3>
          <span className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-tighter pointer-events-none">Impostazione dei livelli di progetto</span>
        </div>
        <button type="button" onClick={onClose} className="bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl mb-4 text-[10px] text-slate-400 leading-relaxed font-mono">
        <p className="font-bold text-indigo-400 mb-1">📐 NOTA SULLE QUOTE DEI PIANI:</p>
        I piani si considerano sempre a <span className="text-indigo-300 font-bold">filo pavimento finito</span>. 
        Le quote Z sono espresse in <span className="text-cyan-400 font-bold">centimetri (cm)</span>. 
        I valori negativi indicano i livelli interrati (es. Piano -1, Piano -2).
      </div>

      {/* Floor List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
        {sortedFloors.map((floor) => (
          <div 
            key={floor.id} 
            className={`flex items-center gap-2 p-2 rounded-xl border ${
              floor.elevation === 0 
                ? 'bg-emerald-500/5 border-emerald-500/20' 
                : floor.type === 'interrato' 
                  ? 'bg-blue-500/5 border-blue-500/10' 
                  : 'bg-slate-900/60 border-white/5'
            }`}
          >
            {/* Type badge */}
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              floor.type === 'interrato' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {floor.type === 'interrato' ? 'SOTTO' : 'FUORI'}
            </span>

            {/* Name Input */}
            <input 
              type="text"
              value={floor.name}
              onChange={(e) => handleUpdateFloorName(floor.id, e.target.value)}
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              placeholder="Nome Piano"
            />

            {/* Elevation Input */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
              <span className="text-[10px] text-slate-500 font-bold font-mono">Z:</span>
              <input 
                type="number"
                value={floor.elevation}
                onChange={(e) => handleUpdateFloorElevation(floor.id, e.target.value)}
                className="w-16 bg-transparent text-xs font-mono font-bold text-cyan-400 focus:outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-slate-500 font-mono font-bold">cm</span>
            </div>

            {/* Delete button */}
            <button 
              type="button"
              onClick={() => handleDeleteFloor(floor.id)}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
              title="Elimina Piano"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add buttons and Close */}
      <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddAboveGround}
            className="flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold py-2 rounded-xl text-xs transition-colors border border-amber-500/20 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Piano Fuori Terra</span>
          </button>
          <button
            type="button"
            onClick={handleAddUnderground}
            className="flex items-center justify-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold py-2 rounded-xl text-xs transition-colors border border-blue-500/20 cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Piano Interrato</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs tracking-widest transition-all cursor-pointer uppercase text-center"
        >
          Salva e Chiudi
        </button>
      </div>
    </div>
  );
};

