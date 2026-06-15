import React from 'react';
import { Target, Ruler, Type, Settings2 } from 'lucide-react';

interface DimensionSettingsDialogProps {
    dimensionScale: number;
    dimensionMode: 'two-points' | 'chain';
    dimensionStyle: 'linear' | 'aligned';
    selectionMode: 'manual' | 'object';
    onUpdate: (scale: number, mode: 'two-points' | 'chain', style: 'linear' | 'aligned', selectionMode: 'manual' | 'object') => void;
    onClose: () => void;
}

export const DimensionSettingsDialog = ({ dimensionScale, dimensionMode, dimensionStyle, selectionMode, onUpdate, onClose }: DimensionSettingsDialogProps) => {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-96 border border-slate-100 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-2 mb-6 text-slate-900">
                    <Settings2 className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">Configurazione Misure</h3>
                </div>
                
                <div className="space-y-5">
                    <div>
                        <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                            <Ruler className="w-4 h-4 text-blue-500" />
                            Scala: {dimensionScale.toFixed(2)}
                        </label>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="5.0" 
                            step="0.1" 
                            value={dimensionScale} 
                            onChange={e => onUpdate(parseFloat(e.target.value), dimensionMode, dimensionStyle, selectionMode)} 
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Modalità</label>
                            <select 
                                value={dimensionMode}
                                onChange={e => onUpdate(dimensionScale, e.target.value as 'two-points' | 'chain', dimensionStyle, selectionMode)}
                                className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="two-points">2 Punti</option>
                                <option value="chain">Catena</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</label>
                            <select 
                                value={dimensionStyle}
                                onChange={e => onUpdate(dimensionScale, dimensionMode, e.target.value as 'linear' | 'aligned', selectionMode)}
                                className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="linear">Lineare</option>
                                <option value="aligned">Allineata</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
                            <Target className="w-4 h-4 text-blue-500" />
                            Selezione
                        </label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => onUpdate(dimensionScale, dimensionMode, dimensionStyle, 'manual')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md ${selectionMode === 'manual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Manuale
                            </button>
                            <button
                                onClick={() => onUpdate(dimensionScale, dimensionMode, dimensionStyle, 'object')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md ${selectionMode === 'object' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Ad Oggetto
                            </button>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={onClose} 
                    className="w-full mt-6 bg-slate-900 hover:bg-slate-800 p-3 rounded-xl text-white font-medium transition-all active:scale-95"
                >
                    Conferma
                </button>
            </div>
        </div>
    );
};
