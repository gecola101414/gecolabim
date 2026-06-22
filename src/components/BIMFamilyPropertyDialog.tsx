import React from 'react';
import { X, AlignLeft, Layers } from 'lucide-react';
import { CADEntity } from '../types';
import { computeMetrics } from '../utils/bimMetrics';

interface BIMFamilyPropertyDialogProps {
  family: string;
  entities: CADEntity[];
  onClose: () => void;
}

export const BIMFamilyPropertyDialog: React.FC<BIMFamilyPropertyDialogProps> = ({
  family,
  entities,
  onClose
}) => {
  const familyMembers = entities.filter(ent => ent.isBIM && (((ent as any).bimFamily || (ent as any).bimAreaType || 'Altri Elementi') === family));
  
  const metrics = familyMembers.map(ent => ({ ent, metrics: computeMetrics(ent) }));
  
  const totalArea = metrics.reduce((acc, obj) => acc + obj.metrics.areaMq, 0);
  const totalPerimetro = metrics.reduce((acc, obj) => acc + obj.metrics.perimetroM, 0);
  const totalVolume = metrics.reduce((acc, obj) => acc + obj.metrics.volumeMc, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-slate-900 border border-cyan-500/30 text-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <Layers className="text-cyan-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {family}
              </h2>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Proprietà e Riepilogo Famiglia BIM
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Totals */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Superficie Totale</span>
              <span className="text-2xl font-black text-cyan-400 mt-1 font-mono">{totalArea.toFixed(2)} mq</span>
              <span className="text-[9px] text-slate-500 mt-0.5">Somma aree XY</span>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Sviluppo Lineare Totale</span>
              <span className="text-2xl font-black text-cyan-400 mt-1 font-mono">{totalPerimetro.toFixed(2)} m</span>
              <span className="text-[9px] text-slate-500 mt-0.5">Somma perimetri/lunghezze</span>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Volume Totale</span>
              <span className="text-2xl font-black text-cyan-500 mt-1 font-mono">{totalVolume.toFixed(2)} mc</span>
              <span className="text-[9px] text-slate-500 mt-0.5">Ingombro volumetrico</span>
            </div>
          </div>

          <div className="w-full h-px bg-white/10" />

          {/* Members Table */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-2">
                <AlignLeft size={16} className="text-slate-400" />
                <h3 className="font-bold text-slate-200">Elementi della Famiglia ({familyMembers.length})</h3>
             </div>
             
             <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50">
               <div className="grid grid-cols-6 gap-2 p-3 bg-slate-900 border-b border-slate-700/50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                 <div className="col-span-2">Descrizione/ID</div>
                 <div className="text-right">Altezza (m)</div>
                 <div className="text-right">Area (mq)</div>
                 <div className="text-right">Perimetro (m)</div>
                 <div className="text-right">Volume (mc)</div>
               </div>
               <div className="divide-y divide-slate-700/50 max-h-[300px] overflow-y-auto">
                 {metrics.map(({ent, metrics}, i) => (
                   <div key={ent.id || i} className="grid grid-cols-6 gap-2 p-3 text-xs items-center hover:bg-slate-700/30 transition-colors">
                     <div className="col-span-2 flex items-center gap-2 font-medium truncate">
                       <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: (ent as any).backgroundColor || ent.color || '#06b6d4' }} />
                       <span className="truncate" title={(ent as any).bimName || 'Elemento'}>{(ent as any).bimName || 'Elemento'}</span>
                     </div>
                     <div className="text-right font-mono text-slate-300">{metrics.altezzaM.toFixed(2)}</div>
                     <div className="text-right font-mono text-cyan-400">{metrics.areaMq.toFixed(2)}</div>
                     <div className="text-right font-mono text-slate-300">{metrics.perimetroM.toFixed(2)}</div>
                     <div className="text-right font-mono text-cyan-500">{metrics.volumeMc.toFixed(2)}</div>
                   </div>
                 ))}
               </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
