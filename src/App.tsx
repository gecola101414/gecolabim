/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Document, Page, pdfjs } from 'react-pdf';
import { CADCanvas, getPaperSizeMm } from "./components/CADCanvas";
import { CanvasPDFPreview } from "./components/CanvasPDFPreview";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import { RaccordoDialog } from "./components/RaccordoDialog";
import { DXFTextReaderDialog } from "./components/DXFTextReaderDialog";
import { TemplatePreview } from "./components/TemplatePreview";
import { BIMElementDialog, FinestreDialog } from "./components/BIMDialogs";
import { BIMWorkspacePanel } from "./components/BIMWorkspacePanel";
import { BIMTopBarControls } from "./components/BIMTopBarControls";
import { BIM3DViewer } from "./components/BIM3DViewer";
import { TEMPLATES } from './data/templates';
import { GUIDE_DATABASE, GuideItem } from './data/guides';
import { Entity, Point, Layer, Measurement, Tavola } from "./types";
import { mergeAllSegments } from "./utils/entityUtils";
import { parseScriptToEntities, updateScriptVariables } from "./utils/parametricParser";
import { contours } from "d3-contour";
import { simplifyPoints } from "./utils/simplify";
import {
  Minus,
  Circle,
  Square,
  MousePointer2,
  Eraser,
  Sparkles,
  MoveHorizontal,
  Scissors,
  Camera,
  Ruler,
  Move,
  DraftingCompass,
  History,
  Dot,
  Undo,
  Redo,
  Printer,
  Crosshair,
  Trash2,
  Link,
  Copy,
  Layers,
  Pen,
  PenTool,
  Pencil,
  Lightbulb,
  LightbulbOff,
  Snowflake,
  Plus,
  Check,
  Save,
  FolderOpen,
  Type,
  FileUp,
  Code,
  BookOpen,
  Grid,
  ExternalLink,
  X,
  Building,
  Lock,
  Home,
  Maximize2,
  Droplet,
  Zap,
  ChevronDown,
  ArrowDown,
  Clipboard,
  Target,
  Settings2,
  Maximize,
  RefreshCw,
  Sliders
} from "lucide-react";

const RotateScaleIcon = ({ size = 16 }: { size?: number }) => (
  <div className="relative" style={{ width: size, height: size }}>
    <RefreshCw size={size} className="absolute inset-0" />
    <Maximize size={size * 0.6} className="absolute -top-1 -right-1 bg-white rounded-full p-0.5" />
  </div>
);

const ParallelIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M5 20L15 4" />
    <path d="M9 20L19 4" />
  </svg>
);

const MirrorIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M10 5L3 12L10 19V5Z" />
    <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="3 3" />
    <path d="M14 5L21 12L14 19V5Z" strokeDasharray="2 2" />
  </svg>
);

const RaccordoIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M4 20V12A8 8 0 0 1 12 4H20" />
    <circle cx="4" cy="20" r="1" fill="currentColor" />
    <circle cx="20" cy="4" r="1" fill="currentColor" />
  </svg>
);

const OrthoIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M5 5V19H19" />
    <circle cx="5" cy="5" r="1" fill="currentColor" />
    <circle cx="19" cy="19" r="1" fill="currentColor" />
    <path d="M5 19h5v-5H5" strokeWidth="1" strokeDasharray="2,2" />
  </svg>
);

const PolylineIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3,17 9,7 16,13 21,5" />
    <circle cx="3" cy="17" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="9" cy="7" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="13" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="21" cy="5" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

const rotatePoint = (point: { x: number; y: number }, center: { x: number; y: number }, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: center.y + dx * Math.sin(rad) + dy * Math.cos(rad)
  };
};

// Helper function to find a collective center for multiple IDs
const getSelectionCenter = (ids: string[], allEntities: Entity[]) => {
  const selection = allEntities.filter(e => ids.includes(e.id));
  if (selection.length === 0) return { x: 0, y: 0 };
  if (selection.length === 1) return getEntityCenter(selection[0]);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let hasGeometry = false;

  selection.forEach(e => {
    const pts: Point[] = [];
    const entAsAny = e as any;
    if (entAsAny.start) pts.push(entAsAny.start, entAsAny.end);
    if (entAsAny.points) pts.push(...entAsAny.points);
    if (entAsAny.freehandPoints) pts.push(...entAsAny.freehandPoints);
    if (entAsAny.x !== undefined && entAsAny.y !== undefined) {
        pts.push({ x: entAsAny.x, y: entAsAny.y });
        if (entAsAny.width && entAsAny.height) {
            pts.push({ x: entAsAny.x + entAsAny.width, y: entAsAny.y + entAsAny.height });
        }
    }
    if (entAsAny.center) {
        const r = entAsAny.radius || 5;
        pts.push({ x: entAsAny.center.x - r, y: entAsAny.center.y - r });
        pts.push({ x: entAsAny.center.x + r, y: entAsAny.center.y + r });
    }
    if (entAsAny.point) pts.push(entAsAny.point);

    pts.forEach(p => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        hasGeometry = true;
    });
  });

  return hasGeometry ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : { x: 0, y: 0 };
};

// Helper to get the absolute bounding box center of any entity
const getEntityCenter = (e: any) => {
  if (e.start && e.end) return { x: (e.start.x + e.end.x) / 2, y: (e.start.y + e.end.y) / 2 };
  if (e.points && e.points.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    e.points.forEach((p: any) => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  if (e.freehandPoints && e.freehandPoints.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    e.freehandPoints.forEach((p: any) => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  if (e.x !== undefined && e.y !== undefined) {
    if (e.width !== undefined && e.height !== undefined) {
        return { x: e.x + e.width / 2, y: e.y + e.height / 2 };
    }
    return { x: e.x, y: e.y };
  }
  if (e.center) return e.center;
  if (e.point) return e.point;
  return { x: 0, y: 0 };
};

const rotateEntityFixed = (e: any, deltaAngle: number, center?: { x: number; y: number }) => {
  const rotationCenter = center || getEntityCenter(e);
  const nextAngle = (e.angle || 0) + deltaAngle;
  
  const rotated: any = { ...e, angle: nextAngle };
  
  if (e.start) rotated.start = rotatePoint(e.start, rotationCenter, deltaAngle);
  if (e.end) rotated.end = rotatePoint(e.end, rotationCenter, deltaAngle);
  if (e.points) rotated.points = e.points.map((p: any) => rotatePoint(p, rotationCenter, deltaAngle));
  if (e.freehandPoints) rotated.freehandPoints = e.freehandPoints.map((p: any) => rotatePoint(p, rotationCenter, deltaAngle));
  if (e.center) rotated.center = rotatePoint(e.center, rotationCenter, deltaAngle);
  if (e.point) rotated.point = rotatePoint(e.point, rotationCenter, deltaAngle);
  
  // Rectangles (x, y) rotate their top-left around center
  if (e.x !== undefined && e.y !== undefined && !e.start) {
      const p = rotatePoint({ x: e.x, y: e.y }, rotationCenter, deltaAngle);
      rotated.x = p.x;
      rotated.y = p.y;
  }

  // Specific BIM handling to ensure width doesn't skew
  if (e.isBIM && e.bimWidth && e.start && e.end && !center) {
    const rad = (nextAngle * Math.PI) / 180;
    const selfCenter = getEntityCenter(e);
    const hDx = Math.cos(rad) * (e.bimWidth / 2);
    const hDy = Math.sin(rad) * (e.bimWidth / 2);
    rotated.start = { x: selfCenter.x - hDx, y: selfCenter.y - hDy };
    rotated.end = { x: selfCenter.x + hDx, y: selfCenter.y + hDy };
  }
  
  return rotated;
};

const scaleEntity = (e: any, factor: number, nextScale: number, center?: { x: number; y: number }) => {
  const scalingCenter = center || getEntityCenter(e);
  const scaled: any = { ...e, scale: nextScale };
  
  const scalePoint = (p: { x: number; y: number }) => ({
    x: scalingCenter.x + (p.x - scalingCenter.x) * factor,
    y: scalingCenter.y + (p.y - scalingCenter.y) * factor
  });

  if (e.start) scaled.start = scalePoint(e.start);
  if (e.end) scaled.end = scalePoint(e.end);
  if (e.points) scaled.points = e.points.map((p: any) => scalePoint(p));
  if (e.freehandPoints) scaled.freehandPoints = e.freehandPoints.map((p: any) => scalePoint(p));
  if (e.center) scaled.center = scalePoint(e.center);
  if (e.point) scaled.point = scalePoint(e.point);
  
  if (e.x !== undefined && e.y !== undefined && !e.start) {
      const p = scalePoint({ x: e.x, y: e.y });
      scaled.x = p.x;
      scaled.y = p.y;
      if (e.width) scaled.width = e.width * factor;
      if (e.height) scaled.height = e.height * factor;
  }

  if (e.radius) scaled.radius = e.radius * factor;
  if (e.bimWidth) scaled.bimWidth = e.bimWidth * factor;
  
  return scaled;
};

export default function App() {
  const [selectedTool, setSelectedTool] = useState<string | null>(() => localStorage.getItem('selectedTool') || 'Select');
  const [quickActions, setQuickActions] = useState<{ ids: string[], pos: Point } | null>(null);
  const [capturedSelectionIds, setCapturedSelectionIds] = useState<string[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (selectedTool !== 'Select' && capturedSelectionIds.length > 0) {
      setInitialSelectedIds(capturedSelectionIds);
      setQuickActions(null);
    }
  }, [selectedTool]);

  useEffect(() => {
    if (selectedTool === 'Select' && !quickActions) {
      setCapturedSelectionIds([]);
    }
  }, [selectedTool, quickActions]);

  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      const timer = setTimeout(() => setInitialSelectedIds([]), 100);
      return () => clearTimeout(timer);
    }
  }, [initialSelectedIds]);

  const [rotationEntityId, setRotationEntityId] = useState<string | null>(null);
  const [transformSelection, setTransformSelection] = useState<string[]>([]);
  const initialBaseEntitiesRef = useRef<Entity[] | null>(null);
  const [isRotateScaleOpen, setIsRotateScaleOpen] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    if (rotationEntityId) {
      if (capturedSelectionIds.includes(rotationEntityId)) {
          setTransformSelection(capturedSelectionIds);
      } else {
          const entity = entities.find(e => e.id === rotationEntityId);
          if (entity && (entity as any).groupId) {
              const groupIds = entities.filter(e => (e as any).groupId === (entity as any).groupId).map(e => e.id);
              setTransformSelection(groupIds);
          } else {
              setTransformSelection([rotationEntityId]);
          }
      }
      initialBaseEntitiesRef.current = entities;
    } else {
      setTransformSelection([]);
      initialBaseEntitiesRef.current = null;
    }
  }, [rotationEntityId]);
  const appEntitiesRef = useRef<Entity[]>(entities);
  useEffect(() => {
    appEntitiesRef.current = entities;
  }, [entities]);
  const [layers, setLayers] = useState<Layer[]>(() => {
    const saved = localStorage.getItem('layers');
    return saved ? JSON.parse(saved) : [
      { id: "0", name: "0", visible: true, frozen: false },
      { id: "p1", name: "p1", visible: true, frozen: false },
      { id: "p2", name: "p2", visible: true, frozen: false },
      { id: "p4", name: "p4", visible: true, frozen: false },
      { id: "Maschere", name: "Maschere", visible: true, frozen: false },
      { id: "Misure", name: "Misure", visible: true, frozen: false },
      { id: "Spessori", name: "Spessori", visible: true, frozen: false },
      { id: "Hatch", name: "Hatch", visible: true, frozen: false },
    ];
  });
  const [activeLayerId, setActiveLayerId] = useState<string>(() => localStorage.getItem('activeLayerId') || "0");
  const [defaultLineStyle, setDefaultLineStyle] = useState(() => {
    const saved = localStorage.getItem('defaultLineStyle');
    return saved ? JSON.parse(saved) : {
      color: "#444444",
      lineWidth: 2,
      dashed: false,
      mode: "HB" as "2H" | "HB" | "CAD",
    };
  });
  const [defaultHatchStyle, setDefaultHatchStyle] = useState(() => {
    const saved = localStorage.getItem('defaultHatchStyle');
    return saved ? JSON.parse(saved) : {
      pattern: 'ANSI31',
      scale: 30,
      angle: 0,
      color: '#000000',
      sfumatura: 0,
    };
  });
  const [defaultTextStyle, setDefaultTextStyle] = useState(() => {
    const saved = localStorage.getItem('defaultTextStyle');
    return saved ? JSON.parse(saved) : {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: 'normal',
      textAlign: 'left' as 'left' | 'center' | 'right' | 'justify',
    };
  });
  const [eraserRadius, setEraserRadius] = useState(() => Number(localStorage.getItem('eraserRadius')) || 4);
  const [eraserType, setEraserType] = useState<'pencil' | 'all' | 'lametta'>(() => (localStorage.getItem('eraserType') as 'pencil' | 'all' | 'lametta') || 'pencil');
  const [eraserIntensity, setEraserIntensity] = useState(() => Number(localStorage.getItem('eraserIntensity')) || 55);
  const [favoritePanels, setFavoritePanels] = useState<Array<{ id: string; tools: string[]; x: number; y: number; isDocked: 'left' | 'right' | 'top' | null }>>(() => {
    const saved = localStorage.getItem('favoritePanels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.some((p: any) => p.id === 'fav-left' || p.id === 'fav-right' || p.id === 'fav-top')) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return [
      { id: "fav-left", tools: ["Orto", "Tecnigrafo", "Polilinea"], x: 10, y: 150, isDocked: 'left' },
      { id: "fav-right", tools: ["Trim", "Eraser", "Cancella", "Move", "Copy", "Join"], x: 1200, y: 150, isDocked: 'right' },
      { id: "fav-top", tools: ["Specchio", "Hatch", "Raccordo"], x: 450, y: 80, isDocked: 'top' }
    ];
  });
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const favoritesDragRef = useRef<{ isDragging: boolean; panelId: string; startX: number; startY: number; posX: number; posY: number } | null>(null);
  const [draggingToolName, setDraggingToolName] = useState<string | null>(null);
  const [draggingSource, setDraggingSource] = useState<string | null>(null);
  const [dragOverTool, setDragOverTool] = useState<{ panelId: string; toolName: string; position: 'before' | 'after' } | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
   const [isRaccordoDialogOpen, setIsRaccordoDialogOpen] = useState(false);
  const [isDXFTextReaderOpen, setIsDXFTextReaderOpen] = useState(false);
  const [selectedBIMSymbolType, setSelectedBIMSymbolType] = useState<string | null>(null);
  const [dimensionScale, setDimensionScale] = useState(() => parseFloat(localStorage.getItem('dimensionScale') || '1.0'));
  const [dimensionDecimals, setDimensionDecimals] = useState<number>(() => parseInt(localStorage.getItem('dimensionDecimals') || '2'));
  const [dimensionMode, setDimensionMode] = useState<'two-points' | 'chain'>(() => (localStorage.getItem('dimensionMode') as 'two-points' | 'chain') || 'two-points');
  const [dimensionStyle, setDimensionStyle] = useState<'linear' | 'aligned' | 'horizontal' | 'vertical' | 'auto-ortho'>(() => (localStorage.getItem('dimensionStyle') as any) || 'linear');
  const [selectionMode, setSelectionMode] = useState<'manual' | 'object'>(() => (localStorage.getItem('selectionMode') as 'manual' | 'object') || 'manual');

  useEffect(() => {
    localStorage.setItem('dimensionScale', dimensionScale.toString());
    localStorage.setItem('dimensionDecimals', dimensionDecimals.toString());
    localStorage.setItem('dimensionMode', dimensionMode);
    localStorage.setItem('dimensionStyle', dimensionStyle);
    localStorage.setItem('selectionMode', selectionMode);
    if (selectedTool !== 'RotateScale') {
        setRotationEntityId(null);
        setIsRotateScaleOpen(false);
    }
  }, [dimensionScale, dimensionDecimals, dimensionMode, dimensionStyle, selectionMode, selectedTool]);

  // BIM dedicated dialog states
  const [isBIMPorteOpen, setIsBIMPorteOpen] = useState(false);
  const [isBIMFinestreOpen, setIsBIMFinestreOpen] = useState(false);
  const [isBIMArrediOpen, setIsBIMArrediOpen] = useState(false);
  const [isBIMSanitariOpen, setIsBIMSanitariOpen] = useState(false);
  const [isBIMElettricoOpen, setIsBIMElettricoOpen] = useState(false);
  const [isBIMIdraulicoOpen, setIsBIMIdraulicoOpen] = useState(false);
  const [isBIMFinitureOpen, setIsBIMFinitureOpen] = useState(false);
  const [isRotateToolbarOpen, setIsRotateToolbarOpen] = useState(false);

  // BIM top bar reactive parameters
  const [bimWallThickness, setBimWallThickness] = useState<number>(() => parseFloat(localStorage.getItem('lastWallThickness') || '15'));
  const [bimWallHeight, setBimWallHeight] = useState<number>(() => parseFloat(localStorage.getItem('lastWallHeight') || '270'));
  const [bimWallRenderMode, setBimWallRenderMode] = useState<'solid' | 'transparent'>(() => (localStorage.getItem('lastWallRenderMode') as 'solid' | 'transparent') || 'solid');
  const [bimWallType, setBimWallType] = useState<string>(() => localStorage.getItem('lastWallType') || "Forati (Laterizio)");
  
const MASONRY_TYPES = [
  "Forati (Laterizio)", "Mattoni Pieni", "Blocchi di Cemento", "Calcestruzzo Cellulare",
  "Gasbeton", "Cartongesso", "Pietra Locale", "Blocchi Argilla Espansa",
  "Forati Alveolati", "Blocchi Insonorizzati", "Blocchi Sismici", "Pannelli Sandwich",
  "Blocchi Termici", "Blocchi Portanti", "Blocchi Faccia a Vista", "Blocchi Isolanti Grafite",
  "Blocchi Isolanti Sughero", "Blocchi Isolanti Lana Roccia", "Blocchi Isolanti Perlite", "Laterizio Porizzato"
];
  const [bimDoorWidth, setBimDoorWidth] = useState<number>(() => parseFloat(localStorage.getItem('lastDoorWidth') || '80'));
  const [bimDoorHeight, setBimDoorHeight] = useState<number>(() => parseFloat(localStorage.getItem('lastDoorHeight') || '210'));
  const [bimWindowWidth, setBimWindowWidth] = useState<number>(() => parseFloat(localStorage.getItem('lastWindowWidth') || '120'));
  const [bimWindowHeight, setBimWindowHeight] = useState<number>(() => parseFloat(localStorage.getItem('lastWindowHeight') || '140'));
  const [bimSymbolScale, setBimSymbolScale] = useState<number>(() => parseFloat(localStorage.getItem('lastBIMSymbolScale') || '1'));

  const [editingRaccordo, setEditingRaccordo] = useState<Entity | null>(null);
  const [raccordoConfig, setRaccordoConfig] = useState<{ type: 'curvo' | 'rettilineo' | 'taglia'; value: number }>({
    type: 'curvo',
    value: 10,
  });
  /* const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
  } | null>(null); */
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);
  const [tavole, setTavole] = useState<Tavola[]>([
    { id: "tav1", name: "Tavola n. 1", format: "A4", scale: 100, unit: "cm", position: { x: -30, y: -20 }, visible: true, datiCartiglio: { progetto: "GECOLA CAD", titolo: "Tavola n. 1", autore: "Ing. Domenico Gimondo", data: "2026" } },
    { id: "tav2", name: "Tavola n. 2", format: "A3", scale: 100, unit: "cm", position: { x: 30, y: -20 }, visible: false, datiCartiglio: { progetto: "GECOLA CAD", titolo: "Tavola n. 2", autore: "Ing. Domenico Gimondo", data: "2026" } },
    { id: "tav3", name: "Tavola n. 3", format: "A2", scale: 200, unit: "cm", position: { x: -40, y: 30 }, visible: false, datiCartiglio: { progetto: "GECOLA CAD", titolo: "Tavola n. 3", autore: "Ing. Domenico Gimondo", data: "2026" } },
    { id: "tav4", name: "Tavola n. 4", format: "A1", scale: 500, unit: "cm", position: { x: 40, y: 30 }, visible: false, datiCartiglio: { progetto: "GECOLA CAD", titolo: "Tavola n. 4", autore: "Ing. Domenico Gimondo", data: "2026" } },
    { id: "tav5", name: "Tavola n. 5", format: "A0", scale: 1000, unit: "cm", position: { x: 0, y: 0 }, visible: false, datiCartiglio: { progetto: "GECOLA CAD", titolo: "Tavola n. 5", autore: "Ing. Domenico Gimondo", data: "2026" } },
  ]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'penne' | 'tavole' | 'layers' | 'maschere' | 'testo' | 'gemini' | 'manuale' | 'bim'>(() => (localStorage.getItem('activeSidebarTab') as any) || 'penne');
  const [isBIMElementDialogOpen, setIsBIMElementDialogOpen] = useState(false);
  const [is3DViewOpen, setIs3DViewOpen] = useState(false);
  const [detectedAreaPoints, setDetectedAreaPoints] = useState<Point[] | { points: Point[], holes?: Point[][] } | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [hoveredGuide, setHoveredGuide] = useState<GuideItem | null>(null);
  const [guideLockedBy, setGuideLockedBy] = useState<string | null>(null);
  const [showFloatingManual, setShowFloatingManual] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState("");
  const [geminiResponse, setGeminiResponse] = useState<{
    explanation: string;
    parameters: { name: string; value: number; label: string }[];
    script: string;
  } | null>(null);
  const [geminiDslScript, setGeminiDslScript] = useState("");
  const [geminiParams, setGeminiParams] = useState<Record<string, number>>({});
  const [geminiIsLoading, setGeminiIsLoading] = useState(false);
  const [geminiInsertX, setGeminiInsertX] = useState(0);
  const [geminiInsertY, setGeminiInsertY] = useState(0);
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingCartiglioTavolaId, setEditingCartiglioTavolaId] = useState<string | null>(null);
  const [doubleClickedTavolaId, setDoubleClickedTavolaId] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [activePreviewTavolaId, setActivePreviewTavolaId] = useState<string | null>(null);
  const [rulerStyle, setRulerStyle] = useState<"tecnigrafo" | "crosshair">(() => (localStorage.getItem('rulerStyle') as any) || "crosshair");
  const [orthoMode, setOrthoMode] = useState(() => localStorage.getItem('orthoMode') === 'true');
  const [isTecnigrafoActive, setIsTecnigrafoActive] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [isShiftOrFDown, setIsShiftOrFDown] = useState(false);
  const effectiveOrthoMode = orthoMode !== isShiftOrFDown;
  
  const [cancelTrigger, setCancelTrigger] = useState(0);
  const [parallelTrigger, setParallelTrigger] = useState(0);
  const [showProperties, setShowProperties] = useState(() => localStorage.getItem('showProperties') === 'true');
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem('selectedCategory') || "Disegno");

  // File System State
  const [fileHandle, setFileHandle] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDwgModal, setShowDwgModal] = useState(false);
  const [dwgFileName, setDwgFileName] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const saveToHandle = async (handle: any) => {
    setIsSaving(true);
    try {
      const writable = await handle.createWritable();
      const stateToSave = {
        entities,
        layers,
        tavole,
        measurements,
        defaultLineStyle
      };
      await writable.write(JSON.stringify(stateToSave));
      await writable.close();
    } catch (err) {
      console.error("Failed to save to file:", err);
    } finally {
      // Short delay so the green dot is visible
      setTimeout(() => setIsSaving(false), 500); 
    }
  };

  useEffect(() => {
    if (!fileHandle) return;
    const timeoutId = setTimeout(() => {
      saveToHandle(fileHandle);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [entities, fileHandle, layers, tavole, measurements]);

  // UI Persistence Effects
  useEffect(() => {
    localStorage.setItem('selectedTool', selectedTool || '');
    if (selectedTool === 'Dimension') {
      setShowProperties(true);
    }
  }, [selectedTool]);

  useEffect(() => {
    localStorage.setItem('layers', JSON.stringify(layers));
  }, [layers]);

  useEffect(() => {
    localStorage.setItem('activeLayerId', activeLayerId);
  }, [activeLayerId]);

  useEffect(() => {
    localStorage.setItem('defaultLineStyle', JSON.stringify(defaultLineStyle));
  }, [defaultLineStyle]);

  useEffect(() => {
    localStorage.setItem('defaultHatchStyle', JSON.stringify(defaultHatchStyle));
  }, [defaultHatchStyle]);

  useEffect(() => {
    localStorage.setItem('defaultTextStyle', JSON.stringify(defaultTextStyle));
  }, [defaultTextStyle]);

  useEffect(() => {
    localStorage.setItem('eraserRadius', eraserRadius.toString());
  }, [eraserRadius]);

  useEffect(() => {
    localStorage.setItem('eraserType', eraserType);
  }, [eraserType]);

  useEffect(() => {
    localStorage.setItem('eraserIntensity', eraserIntensity.toString());
  }, [eraserIntensity]);

  useEffect(() => {
    localStorage.setItem('favoritePanels', JSON.stringify(favoritePanels));
  }, [favoritePanels]);

  useEffect(() => {
    localStorage.setItem('activeSidebarTab', activeSidebarTab);
  }, [activeSidebarTab]);

  useEffect(() => {
    if (selectedTool === 'Line' || selectedTool === 'Circle') {
      setActiveSidebarTab('penne');
      setShowProperties(true);
    }
  }, [selectedTool]);

  useEffect(() => {
    const requiredLayers = [
      { id: "0", name: "0", visible: true, frozen: false },
      { id: "p1", name: "p1", visible: true, frozen: false },
      { id: "p2", name: "p2", visible: true, frozen: false },
      { id: "p4", name: "p4", visible: true, frozen: false },
      { id: "Maschere", name: "Maschere", visible: true, frozen: false },
      { id: "Misure", name: "Misure", visible: true, frozen: false },
      { id: "Spessori", name: "Spessori", visible: true, frozen: false },
      { id: "Hatch", name: "Hatch", visible: true, frozen: false },
      { id: "BIM_Muri", name: "BIM_Muri", visible: true, frozen: false },
      { id: "BIM_Porte", name: "BIM_Porte", visible: true, frozen: false },
      { id: "BIM_Finestre", name: "BIM_Finestre", visible: true, frozen: false },
      { id: "BIM_Arredi", name: "BIM_Arredi", visible: true, frozen: false },
      { id: "BIM_Sanitari", name: "BIM_Sanitari", visible: true, frozen: false },
      { id: "BIM_Impianti_Elettrici", name: "BIM_Impianti_Elettrici", visible: true, frozen: false },
      { id: "BIM_Impianti_Idraulici", name: "BIM_Impianti_Idraulici", visible: true, frozen: false },
      { id: "BIM_Finiture", name: "BIM_Finiture", visible: true, frozen: false },
      { id: "BIM_Legenda", name: "BIM_Legenda", visible: true, frozen: false },
    ];
    setLayers(prev => {
      const updated = [...prev];
      let changed = false;
      requiredLayers.forEach(rl => {
        if (!updated.some(l => l.id === rl.id || l.name === rl.name)) {
          updated.push(rl);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('rulerStyle', rulerStyle);
  }, [rulerStyle]);

  useEffect(() => {
    localStorage.setItem('orthoMode', orthoMode.toString());
  }, [orthoMode]);

  useEffect(() => {
    localStorage.setItem('showProperties', showProperties.toString());
  }, [showProperties]);

  useEffect(() => {
    localStorage.setItem('selectedCategory', selectedCategory);
  }, [selectedCategory]);

  const handleOpenFile = async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert("Salvataggio in locale non supportato da questo browser.");
        return;
      }
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'File GECOLA CAD', accept: {'application/json': ['.gcad']} }],
      });
      const file = await handle.getFile();
      const contents = await file.text();
      const data = JSON.parse(contents);
      
      if (data.entities) setEntities(data.entities);
      if (data.layers) setLayers(data.layers);
      if (data.tavole) setTavole(data.tavole);
      if (data.measurements) setMeasurements(data.measurements);
      if (data.defaultLineStyle) setDefaultLineStyle(data.defaultLineStyle);
      
      setFileHandle(handle);
      setShortcutToast("File caricato!");
      setTimeout(() => setShortcutToast(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAsFile = async () => {
    try {
      if (!('showSaveFilePicker' in window)) {
        alert("Salvataggio in locale non supportato da questo browser.");
        return;
      }
      const handle = await (window as any).showSaveFilePicker({
        types: [{ description: 'File GECOLA CAD', accept: {'application/json': ['.gcad']} }],
        suggestedName: 'progetto_gecolacad.gcad'
      });
      setFileHandle(handle);
      await saveToHandle(handle);
      setShortcutToast("Salvato con nome!");
      setTimeout(() => setShortcutToast(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBIMElementDetected = (result: { points: Point[], holes?: Point[][] }) => {
    setDetectedAreaPoints(result);
    setEditingEntityId(null);
    setIsBIMElementDialogOpen(true);
  };

  const handleEditBIMElement = (id: string) => {
    const ent = entities.find(e => e.id === id);
    if (!ent) return;
    
    setSelectedId(id);
    if ((ent as any).bimType === 'door') {
      setIsBIMPorteOpen(true);
    } else if ((ent as any).bimType === 'window') {
      setIsBIMFinestreOpen(true);
    } else {
      setDetectedAreaPoints({
        points: (ent as any).bimPoints || (ent as any).points || [],
        holes: (ent as any).holes
      });
      setEditingEntityId(id);
      setIsBIMElementDialogOpen(true);
    }
  };

  const handleConfirmBIMElement = (data: { 
    familyId: string; 
    subFamily: string;
    name: string; 
    color: string; 
    zPlane: number; 
    zElevation: number; 
    objectHeight: number; 
    hatch: 'SOLID' | 'ANSI31' | 'CROSS' | 'NONE';
    bimRenderMode?: 'solid' | 'transparent';
  }) => {
    if (!detectedAreaPoints) return;

    if (editingEntityId) {
      // UPDATE EXISTING
      updateEntitiesWithHistory(prev => prev.map(e => {
        if (e.id === editingEntityId) {
          return {
            ...e,
            bimFamily: data.subFamily || data.familyId,
            bimName: data.name,
            backgroundColor: data.color,
            color: data.color,
            bimHatchPattern: data.hatch as any,
            pattern: data.hatch === 'NONE' ? 'SOLID' : data.hatch as any,
            bimHeight: data.objectHeight,
            height: data.objectHeight,
            bimZPlane: data.zPlane,
            bimZElevation: data.zElevation,
            bimRenderMode: data.bimRenderMode || 'solid'
          };
        }
        return e;
      }));
      setShortcutToast(`Elemento ${data.name} aggiornato ✅`);
    } else {
      // CREATE NEW
      const pts = Array.isArray(detectedAreaPoints) ? detectedAreaPoints : detectedAreaPoints.points;
      const hls = Array.isArray(detectedAreaPoints) ? undefined : detectedAreaPoints.holes;

      const newElement: Entity = {
        id: `bim-elem-${Date.now()}`,
        type: 'hatch', 
        points: pts,
        holes: hls,
        color: data.color || 'rgba(0,0,0,0.5)',
        strokeWidth: 1,
        layer: 'BIM_Elementi',
        isBIM: true,
        bimType: 'element',
        bimFamily: data.subFamily || data.familyId,
        bimName: data.name,
        backgroundColor: data.color,
        bimHatchPattern: data.hatch as any,
        pattern: data.hatch === 'NONE' ? 'SOLID' : data.hatch as any,
        bimHeight: data.objectHeight,
        height: data.objectHeight,
        bimZPlane: data.zPlane,
        bimZElevation: data.zElevation,
        bimRenderMode: data.bimRenderMode || 'solid',
        timestamp: Date.now(),
        isVisible: true,
        isFrozen: false
      } as any;

      updateEntitiesWithHistory(prev => [...prev, newElement]);
      setShortcutToast(`Rilevato ${data.name} (${data.familyId}) ✅`);
    }
    
    setTimeout(() => setShortcutToast(null), 4000);
    setIsBIMElementDialogOpen(false);
    setDetectedAreaPoints(null);
    setEditingEntityId(null);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'dxf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
          const { parseDXF } = await import("./utils/dxfImport");
          const { entities: importedEntities, newLayers } = parseDXF(text, activeLayerId, layers);
          
          if (importedEntities.length === 0) {
            alert("Nessun elemento DXF supportato trovato nel file o formato non riconosciuto.");
            return;
          }

          if (newLayers.length > 0) {
            setLayers(prev => [...prev, ...newLayers]);
          }

          updateEntitiesWithHistory(prev => [...prev, ...importedEntities]);
          setShortcutToast(`Importati ${importedEntities.length} elementi CAD!`);
          setTimeout(() => setShortcutToast(null), 3000);
        } catch (err) {
          console.error(err);
          alert("Errore nel parsing del file DXF.");
        }
      };
      reader.readAsText(file);
    } else if (extension === 'dwg') {
      setDwgFileName(file.name);
      setShowDwgModal(true);
    } else if (
      file.type.startsWith('image/') || 
      file.type.startsWith('video/') || 
      file.type.startsWith('audio/') || 
      file.type === 'application/pdf' ||
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'pdf'].includes(extension || '')
    ) {
      let mediaType: 'image' | 'video' | 'audio' | 'pdf' = 'image';
      if (file.type.startsWith('video/') || ['mp4', 'webm'].includes(extension || '')) mediaType = 'video';
      else if (file.type.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(extension || '')) mediaType = 'audio';
      else if (file.type === 'application/pdf' || extension === 'pdf') mediaType = 'pdf';

      if (mediaType === 'pdf') {
         // Use pdf To image parser
         import("./utils/pdfToImage").then(async ({ renderPdfToImage }) => {
            const result = await renderPdfToImage(file);
            if (result && result.isSinglePage) {
               // Treat single page PDF as Image
               mediaType = 'image';
               const img = new Image();
               img.onload = () => {
                 const newEntity: any = {
                   id: Date.now().toString(),
                   type: 'image',
                   point: { x: 0, y: 0 },
                   width: img.width,
                   height: img.height,
                   src: result.src,
                   mediaType,
                   name: file.name,
                   layer: activeLayerId,
                   color: '#000000',
                   lineWidth: 1,
                   dashed: false,
                   mode: 'CAD'
                 };
                 const maxD = 600;
                 if (img.width > maxD || img.height > maxD) {
                    const scale = maxD / Math.max(img.width, img.height);
                    newEntity.width = img.width * scale;
                    newEntity.height = img.height * scale;
                 }
                 updateEntitiesWithHistory(prev => [...prev, newEntity]);
                 setShortcutToast(`${file.name} (1 pagina) importato come immagine!`);
                 setTimeout(() => setShortcutToast(null), 3000);
               };
               img.src = result.src;
            } else {
               // Multipage or failed to render: fallback to PDF reader or use DataURL
               const reader = new FileReader();
               reader.onload = (e) => {
                 const src = e.target?.result as string;
                 const newEntity: any = {
                   id: Date.now().toString(),
                   type: 'image',
                   point: { x: 0, y: 0 },
                   width: 500,
                   height: 700,
                   src,
                   mediaType: 'pdf',
                   name: file.name,
                   layer: activeLayerId,
                   color: '#000000',
                   lineWidth: 1,
                   dashed: false,
                   mode: 'CAD'
                 };
                 updateEntitiesWithHistory(prev => [...prev, newEntity]);
                 setShortcutToast(`${file.name} importato!`);
                 setTimeout(() => setShortcutToast(null), 3000);
               };
               reader.readAsDataURL(file);
            }
         }).catch(err => {
            console.error("Failed to load pdfToImage utility", err);
         });
         event.target.value = '';
         return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        
        let width = 200;
        let height = 200;
        
        if (mediaType === 'image') {
           const img = new Image();
           img.onload = () => {
             const newEntity: any = {
               id: Date.now().toString(),
               type: 'image',
               point: { x: 0, y: 0 },
               width: img.width,
               height: img.height,
               src,
               mediaType,
               name: file.name,
               layer: activeLayerId,
               color: '#000000',
               lineWidth: 1,
               dashed: false,
               mode: 'CAD'
             };
             // Calculate a reasonable scaled size
             const maxD = 600;
             if (img.width > maxD || img.height > maxD) {
                const scale = maxD / Math.max(img.width, img.height);
                newEntity.width = img.width * scale;
                newEntity.height = img.height * scale;
             }
             updateEntitiesWithHistory(prev => [...prev, newEntity]);
             setShortcutToast(`${file.name} importato!`);
             setTimeout(() => setShortcutToast(null), 3000);
           };
           img.src = src;
        } else {
           // For PDF, Video, Audio
           if (mediaType === 'pdf') { width = 500; height = 700; }
           else if (mediaType === 'video') { width = 640; height = 360; }
           else if (mediaType === 'audio') { width = 300; height = 50; }
           
           const newEntity: any = {
             id: Date.now().toString(),
             type: 'image',
             point: { x: 0, y: 0 },
             width,
             height,
             src,
             mediaType,
             name: file.name,
             layer: activeLayerId,
             color: '#000000',
             lineWidth: 1,
             dashed: false,
             mode: 'CAD'
           };
           updateEntitiesWithHistory(prev => [...prev, newEntity]);
           setShortcutToast(`${file.name} importato!`);
           setTimeout(() => setShortcutToast(null), 3000);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("Formato non supportato. Selezionare .dxf, .dwg, Immagini, Video, Audio o PDF.");
    }
    
    // reset input so the same file can be imported again
    event.target.value = '';
  };

  const handleImportGemini = () => {
    if (!geminiDslScript) return;
    try {
      const p = parseScriptToEntities(geminiDslScript, { x: Number(geminiInsertX), y: Number(geminiInsertY) }, activeLayerId);
      
      // Automatic Layer Addition if any referred layers don't exist!
      const existingNames = new Set(layers.map(l => l.name));
      const layersToCreate: Layer[] = [];
      for (const reqLayer of p.referencedLayers) {
        if (!existingNames.has(reqLayer)) {
          layersToCreate.push({
            id: reqLayer,
            name: reqLayer,
            visible: true,
            frozen: false
          });
        }
      }
      if (layersToCreate.length > 0) {
        setLayers(prev => [...prev, ...layersToCreate]);
      }

      updateEntitiesWithHistory(prev => [...prev, ...p.entities]);
      setShortcutToast(`Importati ${p.entities.length} elementi parametrici!`);
      setTimeout(() => setShortcutToast(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Errore nell'importazione degli oggetti geometrici.");
    }
  };

  const cadCanvasRef = useRef<any>(null);

  // Automatic Layer Selection based on style/pen
  // Matita 2H -> Layer 0
  // HB, CAD -> p1, p2, p4
  useEffect(() => {
    let targetLayer: string | null = null;
    if (defaultLineStyle.mode === 'pencil' && defaultLineStyle.color === '#bbbbbb') {
      targetLayer = "0"; // Schizzo / Costruzione
    } else if (defaultLineStyle.mode === 'ink' || defaultLineStyle.mode === 'CAD') {
      if (defaultLineStyle.lineWidth === 0.25) targetLayer = "p1";
      else if (defaultLineStyle.lineWidth === 0.35) targetLayer = "p2";
      else if (defaultLineStyle.lineWidth >= 0.5) targetLayer = "p4";
    }

    if (targetLayer) {
      setActiveLayerId(targetLayer);
      
      // Ensure the activated layer is visible and unfrozen so the user's strokes don't vanish!
      setLayers(prev => {
        const idx = prev.findIndex(l => l.id === targetLayer);
        if (idx !== -1) {
          const l = prev[idx];
          if (!l.visible || l.frozen) {
            const updated = [...prev];
            updated[idx] = { ...l, visible: true, frozen: false };
            return updated;
          }
        }
        return prev;
      });
    }
  }, [defaultLineStyle.mode, defaultLineStyle.lineWidth, defaultLineStyle.color]);

  // Gestione Appunti (Copy & Paste) per oggetti CAD, immagini e testi (Gecolacad 7.1)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Se l'utente sta scrivendo in un campo di testo o area, lascia fare al browser
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      e.preventDefault();
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Controlla se ci sono files negli appunti (es. immagini copiate o screenshot)
      const files = clipboardData.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const src = event.target?.result as string;
              if (src) {
                const point = cadCanvasRef.current?.getCurrentMousePosition() || { x: 100, y: 100 };
                
                const img = new Image();
                img.onload = () => {
                  const ar = img.naturalWidth / img.naturalHeight || 1;
                  const defaultWidth = 300; // larghezza predefinita per inserimento CAD
                  const defaultHeight = defaultWidth / ar;

                  const newImageEntity: Entity = {
                    id: `img-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    type: 'image',
                    color: '#000000',
                    lineWidth: 1,
                    layer: activeLayerId,
                    point: { x: point.x - defaultWidth / 2, y: point.y - defaultHeight / 2 },
                    width: defaultWidth,
                    height: defaultHeight,
                    src: src,
                    name: file.name || 'Immagine Incollata',
                    angle: 0,
                    aspectRatio: ar,
                    opacity: 1
                  } as any;

                  setEntities(prev => {
                    commitToHistory(prev);
                    return [...prev, newImageEntity];
                  });

                  setShortcutToast("Immagine incollata nell'area di lavoro!");
                  setTimeout(() => setShortcutToast(null), 3000);
                };
                img.src = src;
              }
            };
            reader.readAsDataURL(file);
          }
        }
        return;
      }

      // 2. Controlla se c'è testo negli appunti (testo semplice o JSON serializzato del CAD)
      const text = clipboardData.getData('text');
      if (text) {
        try {
          if (text.startsWith('{"source":"gecolacad"') || (text.includes('"type":') && text.includes('"id":'))) {
            const data = JSON.parse(text);
            const entitiesToPaste: Entity[] = [];
            
            if (data.entities && Array.isArray(data.entities)) {
              entitiesToPaste.push(...data.entities);
            } else if (data.type && data.id) {
              entitiesToPaste.push(data);
            }

            if (entitiesToPaste.length > 0) {
              const point = cadCanvasRef.current?.getCurrentMousePosition() || { x: 100, y: 100 };
              
              // Calcola il rettangolo circoscritto (bounding box) per centrare il paste
              let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
              entitiesToPaste.forEach((ent: any) => {
                if (ent.type === 'line' || ent.type === 'dimension') {
                  if (ent.start && ent.end) {
                    minX = Math.min(minX, ent.start.x, ent.end.x);
                    maxX = Math.max(maxX, ent.start.x, ent.end.x);
                    minY = Math.min(minY, ent.start.y, ent.end.y);
                    maxY = Math.max(maxY, ent.start.y, ent.end.y);
                  }
                } else if (ent.type === 'circle' || ent.type === 'arc') {
                  if (ent.center) {
                    minX = Math.min(minX, ent.center.x - (ent.radius || 0));
                    maxX = Math.max(maxX, ent.center.x + (ent.radius || 0));
                    minY = Math.min(minY, ent.center.y - (ent.radius || 0));
                    maxY = Math.max(maxY, ent.center.y + (ent.radius || 0));
                  }
                } else if (ent.type === 'rectangle') {
                  if (ent.p1 && ent.p2) {
                    minX = Math.min(minX, ent.p1.x, ent.p2.x);
                    maxX = Math.max(maxX, ent.p1.x, ent.p2.x);
                    minY = Math.min(minY, ent.p1.y, ent.p2.y);
                    maxY = Math.max(maxY, ent.p1.y, ent.p2.y);
                  }
                } else if (ent.type === 'text' || ent.type === 'image') {
                  if (ent.point) {
                    const w = ent.width || 100;
                    const h = ent.height || 40;
                    minX = Math.min(minX, ent.point.x);
                    maxX = Math.max(maxX, ent.point.x + w);
                    minY = Math.min(minY, ent.point.y);
                    maxY = Math.max(maxY, ent.point.y + h);
                  }
                } else if (ent.type === 'hatch') {
                  if (ent.points && ent.points.length > 0) {
                    ent.points.forEach((p: Point) => {
                      minX = Math.min(minX, p.x);
                      maxX = Math.max(maxX, p.x);
                      minY = Math.min(minY, p.y);
                      maxY = Math.max(maxY, p.y);
                    });
                  }
                }
              });

              const center = (minX !== Infinity) ? {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
              } : { x: 100, y: 100 };

              const dx = point.x - center.x;
              const dy = point.y - center.y;

              const preparedEntities = entitiesToPaste.map((ent: any) => {
                const newId = `${ent.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                let updated = { ...ent, id: newId, layer: activeLayerId };
                
                if (ent.point) {
                  updated.point = { x: ent.point.x + dx, y: ent.point.y + dy };
                }
                if (ent.center) {
                  updated.center = { x: ent.center.x + dx, y: ent.center.y + dy };
                }
                if (ent.start && ent.end) {
                  updated.start = { x: ent.start.x + dx, y: ent.start.y + dy };
                  updated.end = { x: ent.end.x + dx, y: ent.end.y + dy };
                }
                if (ent.p1 && ent.p2) {
                  updated.p1 = { x: ent.p1.x + dx, y: ent.p1.y + dy };
                  updated.p2 = { x: ent.p2.x + dx, y: ent.p2.y + dy };
                }
                if (ent.points) {
                  updated.points = ent.points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
                }
                if (ent.bimPoints) {
                  updated.bimPoints = ent.bimPoints.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
                }
                if (ent.holes) {
                  updated.holes = ent.holes.map((hole: any[]) => hole.map((p: any) => ({ x: p.x + dx, y: p.y + dy })));
                }
                return updated;
              });

              setEntities(prev => {
                commitToHistory(prev);
                return [...prev, ...preparedEntities];
              });

              setShortcutToast(`Incollati ${preparedEntities.length} oggetti CAD nel disegno!`);
              setTimeout(() => setShortcutToast(null), 3000);
              return;
            }
          }
        } catch (err) {
          // Fallback a disegno del testo standard
        }

        // Se non è un oggetto CAD formattato, incolla come testo normale sul foglio
        const point = cadCanvasRef.current?.getCurrentMousePosition() || { x: 100, y: 100 };
        const newTextEntity: Entity = {
          id: `txt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          type: 'text',
          color: defaultLineStyle.color,
          lineWidth: 1,
          layer: activeLayerId,
          point: { ...point },
          text: text,
          fontFamily: defaultTextStyle.fontFamily,
          fontSize: defaultTextStyle.fontSize,
          fontWeight: defaultTextStyle.fontWeight,
          textAlign: defaultTextStyle.textAlign,
        };

        setEntities(prev => {
          commitToHistory(prev);
          return [...prev, newTextEntity];
        });

        setSelectedId(newTextEntity.id);
        setActiveSidebarTab('testo');
        
        setShortcutToast("Testo incollato nel disegno!");
        setTimeout(() => setShortcutToast(null), 3000);
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (!selectedId) return;
      const selectedEnt = entities.find(el => el.id === selectedId);
      if (selectedEnt) {
        e.preventDefault();
        const data = {
          source: "gecolacad",
          entities: [selectedEnt]
        };
        e.clipboardData?.setData('text/plain', JSON.stringify(data));
        setShortcutToast("Oggetto CAD copiato negli appunti!");
        setTimeout(() => setShortcutToast(null), 3000);
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('copy', handleCopy);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('copy', handleCopy);
    };
  }, [entities, selectedId, activeLayerId, defaultLineStyle, defaultTextStyle]);

  const [toolboxPos, setToolboxPos] = useState(() => {
    const saved = localStorage.getItem('toolboxPos');
    return saved ? JSON.parse(saved) : { top: 16, right: 16 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startTop: 0, startRight: 0 });

  const startDragging = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: toolboxPos.top,
      startRight: toolboxPos.right,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setToolboxPos({
        top: dragRef.current.startTop + deltaY,
        right: dragRef.current.startRight - deltaX,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('toolboxPos', JSON.stringify(toolboxPos));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, toolboxPos]);

  const handleRightClickShortcut = (e: React.MouseEvent) => {
    // Se c'è il dialogo del raccordo aperto, il tasto destro applica
    if (isRaccordoDialogOpen) {
        // Simuliamo un invio al form del dialogo
        const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        window.dispatchEvent(ev);
        e.preventDefault();
        return;
    }

    if (selectedTool === 'Eraser') {
      const nextType = eraserType === 'pencil' ? 'all' : (eraserType === 'all' ? 'lametta' : 'pencil');
      setEraserType(nextType);
      setShortcutToast(
        nextType === 'pencil' 
          ? "Gomma: Matita (Bianca)" 
          : nextType === 'all' 
            ? "Gomma: China/Tutto (Gialla)" 
            : "Gomma: Lametta Gillette"
      );
      setTimeout(() => setShortcutToast(null), 2000);
      e.preventDefault();
      return;
    }

    // If in Template tool, try rotating first
    if (selectedTool === 'Template' || selectedTool === 'Select') {
        const rotated = cadCanvasRef.current?.rotateMaskAtPoint(e);
        if (rotated) {
            e.preventDefault();
            return;
        }
    }

    // If in Template tool and didn't rotate, cancel it and switch to Select
    if (selectedTool === 'Template') {
      setSelectedTool('Select');
      setSelectedTemplateId(null);
      setShortcutToast("Strumento: Selezione (Magneti)");
      setTimeout(() => setShortcutToast(null), 1500);
      return;
    }

    // If not in a drawing tool, switch to Line
    if (!["Line", "Muro", "Circle", "Arc", "Hatch", "Dimension"].includes(selectedTool || '')) {
      setSelectedCategory("Disegno");
      handleToolClick("Line");
      setShortcutToast("Strumento: Linea");
      setTimeout(() => setShortcutToast(null), 1500);
    }
  };

  const handleToolClick = (tool: string) => {
    const guide = GUIDE_DATABASE[tool];
    // Only show the floating help if the manual sidebar tab is ACTIVE or was already showing
    if (guide && (activeSidebarTab === 'manuale' || showFloatingManual)) {
      setHoveredGuide(guide);
      setGuideLockedBy(tool);
      setShowFloatingManual(true);
    } else {
      setShowFloatingManual(false);
      setHoveredGuide(null);
      setGuideLockedBy(null);
    }

           if (tool === "Raccordo") {
             setSelectedTool("Raccordo");
             // Non forzare l'apertura del dialog se è già aperto o se l'utente vuole solo usare il tool
             // Lo apriamo solo la prima volta o se cliccano di nuovo
             if (!isRaccordoDialogOpen) {
                 setIsRaccordoDialogOpen(true);
             }
             setShowProperties(false);
           } else if (tool === "Parallel") {
      setSelectedTool("Parallel");
      setCancelTrigger(prev => prev + 1);
      setParallelTrigger(prev => prev + 1);
      setShowProperties(false);
      setIsRaccordoDialogOpen(false);
    } else if (tool === "Penne") {
      setActiveSidebarTab('penne');
      setShowProperties(true);
      if (selectedTool === 'Hatch' || selectedTool === 'Specchio' || selectedTool === 'Dimension') {
        setSelectedTool('Select');
      }
    } else if (tool === "Maschere") {
      setActiveSidebarTab('maschere');
      setShowProperties(true);
      if (selectedTool === 'Template') {
        setSelectedTool('Select');
      }
    } else if (tool === "Orto") {
      setOrthoMode(prev => !prev);
    } else if (tool === "Tecnigrafo") {
      const next = !isTecnigrafoActive;
      setIsTecnigrafoActive(next);
      if (next) {
        const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true });
        document.dispatchEvent(event);
      } else {
        const event = new KeyboardEvent('keyup', { key: 'q', bubbles: true });
        document.dispatchEvent(event);
      }
    } else if (tool === "Polilinea") {
      const next = !isContinuousMode;
      setIsContinuousMode(next);
      if (next) {
        setOrthoMode(true);
        setSelectedTool('Line');
      }
      setCancelTrigger(prev => prev + 1);
    } else {
      setSelectedTool(tool);
      // Ensure the correct sidebar tab opens for specific tools as requested
      if (tool === 'Hatch' || tool === 'Line' || tool === 'Circle' || tool === 'Muro' || tool === 'Eraser') {
        setActiveSidebarTab('penne');
        setShowProperties(true);
      } else if (tool === 'Testo') {
        setActiveSidebarTab('testo');
        setShowProperties(true);
      } else if (tool === 'Dimension' || tool === 'Specchio') {
        setActiveSidebarTab('penne');
        setShowProperties(true);
      } else {
        // Close other function menus to free screen space
        setShowProperties(false);
        setIsRaccordoDialogOpen(false);
      }
    }
  };

  const handleGuideHover = (key: string) => {
    // Disable automatic popup on hover as requested
    // if (GUIDE_DATABASE[key]) {
    //   setHoveredGuide(GUIDE_DATABASE[key]);
    //   setGuideLockedBy(key);
    // }
  };

  const handleGuideClick = (key: string) => {
    if (guideLockedBy === key) {
      setHoveredGuide(null);
      setGuideLockedBy(null);
    }
  };

  const selectedEntity = entities.find((e) => e.id === selectedId);

  const updateEntity = (id: string, updates: Partial<Entity>) => {
    setEntities((prev) =>
      prev.map((e) => (e.id === id ? ({ ...e, ...updates } as Entity) : e)),
    );
  };

  const categories = [
    {
      name: "Seleziona",
      icon: MousePointer2,
      tools: [{ name: "Select", icon: MousePointer2 }],
    },
    {
      name: "Disegno",
      icon: DraftingCompass,
      tools: [
        { name: "Line", icon: Minus },
        { name: "Muro", icon: Building },
        { name: "Circle", icon: Circle },
        { name: "Arc", icon: History },
        { name: "Hatch", icon: Grid },
        { name: "Specchio", icon: MirrorIcon },
        { name: "Testo", icon: Type },
        { name: "Trim", icon: Scissors },
        { name: "Eraser", icon: Eraser },
        { name: "Parallel", icon: ParallelIcon },
        { name: "RotateScale", icon: RotateScaleIcon },
        { name: "CopiaVideo", icon: Camera },
        { name: "Join", icon: Link },
        { name: "Raccordo", icon: RaccordoIcon },
        { name: "Move", icon: Move },
        { name: "Copy", icon: Copy },
        { name: "Dimension", icon: Ruler },
        { name: "Penne", icon: Pen },
        { name: "Maschere", icon: Square },
        { name: "Cancella", icon: Trash2 },
        { name: "Orto", icon: OrthoIcon },
        { name: "Tecnigrafo", icon: DraftingCompass },
        { name: "Polilinea", icon: PolylineIcon },
      ],
    },
  ];

  const handleFavoritesMouseDown = (e: React.MouseEvent, panelId: string) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    const panel = favoritePanels.find(p => p.id === panelId);
    if (!panel) return;

    setActiveDraggingId(panelId);

    // Bring this panel to top layer
    setFavoritePanels(prev => {
      const targetPanel = prev.find(p => p.id === panelId);
      if (!targetPanel) return prev;
      return [...prev.filter(p => p.id !== panelId), targetPanel];
    });

    favoritesDragRef.current = {
      isDragging: true,
      panelId: panelId,
      startX: e.clientX,
      startY: e.clientY,
      posX: panel.x,
      posY: panel.y
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!favoritesDragRef.current?.isDragging) return;
      const refData = favoritesDragRef.current;
      if (refData.panelId !== panelId) return;

      const dx = moveEvent.clientX - refData.startX;
      const dy = moveEvent.clientY - refData.startY;
      
      // We apply a very subtle damping factor to mouse moves to make dragging feel smooth and premium (rallentato/ammortizzato)
      const targetX = refData.posX + dx;
      const targetY = refData.posY + dy;

      let isDocked: 'left' | 'right' | 'top' | null = null;

      // Docking thresholds based on screen borders
      if (targetX < 45) {
        isDocked = 'left';
      } else if (window.innerWidth - moveEvent.clientX < 240) {
        isDocked = 'right';
      } else if (moveEvent.clientY < 180) {
        isDocked = 'top';
      }

      setFavoritePanels(prev => prev.map(p => {
        if (p.id === panelId) {
          return {
            ...p,
            x: isDocked === 'left' ? 0 : (isDocked === 'right' ? window.innerWidth - 65 : Math.max(10, Math.min(window.innerWidth - 100, targetX))),
            y: isDocked ? p.y : Math.max(50, Math.min(window.innerHeight - 200, targetY)),
            isDocked
          };
        }
        return p;
      }));
    };

    const handleMouseUp = () => {
      if (favoritesDragRef.current) {
        favoritesDragRef.current.isDragging = false;
      }
      setActiveDraggingId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getToolIcon = (name: string) => {
    for (const cat of categories) {
      const found = cat.tools.find(t => t.name === name);
      if (found) return found.icon;
    }
    return null;
  };

  // Undo/Redo
  const [history, setHistory] = useState<Entity[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const historyIndexRef = useRef(historyIndex);
  const historyRef = useRef(history);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const areEntitiesEqual = (list1: Entity[], list2: Entity[]) => {
    if (list1 === list2) return true;
    if (!list1 || !list2) return list1 === list2;
    if (list1.length !== list2.length) return false;
    for (let i = 0; i < list1.length; i++) {
      if (list1[i] !== list2[i]) {
        if (JSON.stringify(list1[i]) !== JSON.stringify(list2[i])) {
          return false;
        }
      }
    }
    return true;
  };

  const undo = () => {
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
    }
    
    let currentIdx = historyIndexRef.current;
    let currentHistory = historyRef.current;

    // Check if there are active uncommitted changes on the canvas
    if (!areEntitiesEqual(appEntitiesRef.current, currentHistory[currentIdx])) {
        // Push the uncommitted changes so Redo can bring them back
        const newHistory = currentHistory.slice(0, currentIdx + 1);
        newHistory.push(appEntitiesRef.current);
        historyRef.current = newHistory;
        setHistory(newHistory);
        
        // Now our history has the uncommitted state at currentIdx + 1.
        // A normal undo would step back to currentIdx.
        appEntitiesRef.current = currentHistory[currentIdx]; // Sync ref immediately
        setHistoryIndex(currentIdx);
        setEntities(currentHistory[currentIdx]);
        return;
    }

    if (currentIdx > 0) {
      const nextIdx = currentIdx - 1;
      historyIndexRef.current = nextIdx; // Update ref synchronously to prevent rapid click issues
      appEntitiesRef.current = currentHistory[nextIdx]; // Sync ref immediately
      setHistoryIndex(nextIdx);
      setEntities(currentHistory[nextIdx]);
    }
  };

  const redo = () => {
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
    }
    const currentIdx = historyIndexRef.current;
    const currentHistory = historyRef.current;
    if (currentIdx < currentHistory.length - 1) {
      const nextIdx = currentIdx + 1;
      historyIndexRef.current = nextIdx; // Update ref synchronously
      appEntitiesRef.current = currentHistory[nextIdx]; // Sync ref immediately
      setHistoryIndex(nextIdx);
      setEntities(currentHistory[nextIdx]);
    }
  };

  const updateEntitiesSilent = (
    newEntities: React.SetStateAction<Entity[]>,
  ) => {
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
    }
    setEntities(newEntities);
  };

  const commitToHistory = (snapshotToSave?: Entity[]) => {
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
    }
    const targetSnapshot = snapshotToSave || entities;
    const currentIdx = historyIndexRef.current;
    const currentHistory = historyRef.current;
    const lastState = currentHistory[currentIdx];

    if (lastState && areEntitiesEqual(lastState, targetSnapshot)) {
      return; // Do not commit duplicates
    }

    setHistory((prevHistory) => {
      const newHistory = prevHistory.slice(0, currentIdx + 1);
      newHistory.push(targetSnapshot);
      historyRef.current = newHistory;
      return newHistory;
    });
    historyIndexRef.current = currentIdx + 1;
    setHistoryIndex((prevIndex) => prevIndex + 1);
  };

  const updateEntitiesWithHistory = (
    newEntities: React.SetStateAction<Entity[]>,
  ) => {
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
    }
    setEntities((prev) => {
      const next =
        typeof newEntities === "function" ? (newEntities as Function)(prev) : newEntities;
      
      historyTimeoutRef.current = setTimeout(() => {
        const currentIdx = historyIndexRef.current;
        const currentHistory = historyRef.current;
        const lastState = currentHistory[currentIdx];

        if (lastState && areEntitiesEqual(lastState, next)) {
          historyTimeoutRef.current = null;
          return; // Do not commit duplicates
        }

        setHistory((prevHistory) => {
          const newHistory = prevHistory.slice(0, currentIdx + 1);
          newHistory.push(next);
          historyRef.current = newHistory;
          return newHistory;
        });
        historyIndexRef.current = currentIdx + 1;
        setHistoryIndex((prevIndex) => prevIndex + 1);
        historyTimeoutRef.current = null;
      }, 50);

      return next;
    });
  };

  // Auto-show properties when entity selected
  useEffect(() => {
    if (selectedId) setShowProperties(true);
  }, [selectedId]);

  const selectedCategoryTools =
    categories.find((c) => c.name === selectedCategory)?.tools || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcuts only if not in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      }

      // Escape to reset
      if (e.key === 'Escape') {
        setSelectedTool('Select');
        setSelectedId(null);
        setCancelTrigger(prev => prev + 1);
      }

      // Shift or F for temporarily toggling ortho Mode
      if (e.key === 'Shift' || key === 'f') {
        setIsShiftOrFDown(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.key === 'Shift' || key === 'f') {
        setIsShiftOrFDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [historyIndex, history, entities]); // Dependencies for shortcuts

  return (
    <div className="flex flex-col h-screen bg-neutral-100 text-neutral-900">
      {/* Ribbon */}
      <header className="h-14 border-b border-neutral-300 bg-white flex">
        <div className="flex items-center px-4 border-r border-neutral-300 bg-neutral-900 text-white select-none mr-2 relative">
          <div className="flex flex-col">
            <span className="font-sans font-black tracking-wider text-sm whitespace-nowrap">GECOLA <span className="text-amber-400">CAD</span></span>
            <span className="text-[9px] text-neutral-400 font-mono -mt-1 opacity-60">VER. 11.29</span>
          </div>
          {fileHandle && (
            <div className="absolute top-1 right-2 flex items-center justify-center pointer-events-none">
              <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-400' : 'bg-emerald-500'} transition-colors duration-300 drop-shadow-md`} title={isSaving ? "Salvataggio in corso..." : "Auto-save attivo"}></div>
            </div>
          )}
        </div>

        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => {
              setSelectedCategory(cat.name);
              // If clicking "Seleziona", immediately activate the Select tool and show properties
              if (cat.name === "Seleziona") {
                setSelectedTool("Select");
                setShowProperties(true);
              }
              if (cat.name === "BIM") {
                setActiveSidebarTab("bim");
                setShowProperties(true);
              }
            }}
            className={`px-4 flex flex-col items-center justify-center gap-0.5 ${selectedCategory === cat.name ? "bg-neutral-100" : "hover:bg-neutral-200"}`}
          >
            <cat.icon size={16} />
            <span className="text-[10px]">{cat.name}</span>
          </button>
        ))}
        <button
          onClick={() => setShowProperties(!showProperties)}
          className="flex flex-col items-center justify-center px-4 hover:bg-neutral-200 border-l border-neutral-300"
        >
          <span className="text-[10px] text-neutral-500">
            Mode: {defaultLineStyle.mode}
          </span>
          <span className="text-xs font-bold">
            {defaultLineStyle.lineWidth}
          </span>
        </button>

        <div className="flex items-center justify-center px-4 gap-3 border-l border-neutral-300 bg-neutral-50/50">
          <button
            onClick={() => { handleGuideClick('Annulla'); undo(); }}
            onMouseEnter={() => handleGuideHover('Annulla')}
            title="Annulla"
            className="p-1.5 bg-white rounded shadow-sm border border-neutral-200 hover:bg-neutral-100 hover:text-indigo-600 transition-colors text-neutral-600"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={() => { handleGuideClick('Ripristina'); redo(); }}
            onMouseEnter={() => handleGuideHover('Ripristina')}
            title="Ripristina"
            className="p-1.5 bg-white rounded shadow-sm border border-neutral-200 hover:bg-neutral-100 hover:text-indigo-600 transition-colors text-neutral-600"
          >
            <Redo size={16} />
          </button>
        </div>

        <button
          onClick={() => {
            handleGuideClick('Layers');
            if (activeSidebarTab === 'layers' && showProperties) {
              setShowProperties(false);
            } else {
              setActiveSidebarTab('layers');
              setShowProperties(true);
            }
          }}
          onMouseEnter={() => handleGuideHover('Layers')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 ${showProperties && activeSidebarTab === 'layers' ? "bg-indigo-50 text-indigo-700 font-bold" : "hover:bg-neutral-200 text-neutral-600"}`}
        >
          <Layers size={16} />
          <span className="text-[10px]">Layer</span>
        </button>

        <button
          onClick={() => {
            handleGuideClick('Penne');
            if (activeSidebarTab === 'penne' && showProperties) {
              // If we are already in the penne tab, but a specific tool help OR entity is selected,
              // we reset the state to show the default pen settings instead of closing the menu.
              if (selectedTool === 'Hatch' || selectedTool === 'Specchio' || selectedTool === 'Dimension' || selectedId) {
                setSelectedTool('Select');
                setSelectedId(null);
              } else {
                setShowProperties(false);
              }
            } else {
              setActiveSidebarTab('penne');
              setShowProperties(true);
              // Ensure we don't carry over a tool that might hide the pen settings
              if (selectedTool === 'Hatch' || selectedTool === 'Specchio' || selectedTool === 'Dimension') {
                setSelectedTool('Select');
              }
            }
          }}
          onMouseEnter={() => handleGuideHover('Penne')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 ${showProperties && activeSidebarTab === 'penne' ? "bg-neutral-100 text-indigo-600 font-bold" : "hover:bg-neutral-200"}`}
        >
          <Pen size={16} />
          <span className="text-[10px]">Penne</span>
        </button>
        <button
          onClick={() => {
            handleGuideClick('Testo');
            if (activeSidebarTab === 'testo' && showProperties) {
              setShowProperties(false);
            } else {
              setActiveSidebarTab('testo');
              setShowProperties(true);
            }
          }}
          onMouseEnter={() => handleGuideHover('Testo')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 ${showProperties && activeSidebarTab === 'testo' ? "bg-neutral-100 text-indigo-600 font-bold" : "hover:bg-neutral-200"}`}
        >
          <Type size={16} />
          <span className="text-[10px]">Testo</span>
        </button>
        <button
          onClick={() => {
            handleGuideClick('Gemini AI');
            if (activeSidebarTab === 'gemini' && showProperties) {
              setShowProperties(false);
            } else {
              setActiveSidebarTab('gemini');
              setShowProperties(true);
            }
          }}
          onMouseEnter={() => handleGuideHover('Gemini AI')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 ${showProperties && activeSidebarTab === 'gemini' ? "bg-amber-50 text-amber-700 font-bold border-x border-amber-200" : "hover:bg-neutral-200 text-neutral-600"}`}
        >
          <Sparkles size={16} className={showProperties && activeSidebarTab === 'gemini' ? "text-amber-500 animate-pulse" : "text-amber-500"} />
          <span className="text-[10px]">Gemini AI</span>
        </button>
        <button
          onClick={() => {
            handleGuideClick('BIM');
            if (activeSidebarTab === 'bim' && showProperties) {
              setShowProperties(false);
            } else {
              setActiveSidebarTab('bim');
              setSelectedCategory('BIM');
              setShowProperties(true);
            }
          }}
          onMouseEnter={() => handleGuideHover('BIM')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 ${showProperties && activeSidebarTab === 'bim' ? "bg-cyan-50 text-cyan-800 font-bold border-x border-cyan-200" : "hover:bg-neutral-200 text-neutral-600"}`}
        >
          <Building size={16} className={showProperties && activeSidebarTab === 'bim' ? "text-cyan-600 animate-pulse" : "text-cyan-600"} />
          <span className="text-[10px] font-bold">BIM</span>
        </button>
        <div className="flex-1"></div>
        <button
          onClick={() => {
            if (activeSidebarTab === 'manuale' && showProperties) {
              setShowProperties(false);
              setShowFloatingManual(false);
            } else {
              setActiveSidebarTab('manuale');
              setShowProperties(true);
              setShowFloatingManual(true);
            }
          }}
          className={`px-5 py-1.5 flex flex-col items-center justify-center gap-0.5 border-l border-neutral-300 relative select-none h-full min-w-[76px] ${showProperties && activeSidebarTab === 'manuale' ? "bg-emerald-50 text-emerald-950 font-bold border-x border-emerald-200" : "hover:bg-neutral-200 text-neutral-600"}`}
        >
          {/* Spuntatura interattiva in alto a destra */}
          <div 
            className="absolute top-1 right-1 flex items-center justify-center z-20 p-0.5 rounded cursor-pointer hover:bg-neutral-300/40"
            onClick={(e) => {
              e.stopPropagation(); // Evita l'apertura del pannello laterale quando si clicca solo la spunta
              setShowFloatingManual(!showFloatingManual);
            }}
            title={showFloatingManual ? "Help in linea ATTIVO - Ogni volta che tocchi uno strumento avrai la guida rapida pop-up (Clicca la spunta per disattivare)" : "Help in linea DISATTIVATO - Le spiegazioni automatiche non si apriranno in pop-up per non appesantire (Clicca la spunta per attivare)"}
          >
            <input
              type="checkbox"
              checked={showFloatingManual}
              onChange={() => {}} // Gestito interamente da onClick per compatibilità stopPropagation
              className="w-3 h-3 cursor-pointer accent-emerald-600 border border-neutral-300 rounded transition-all focus:ring-0"
            />
          </div>

          <BookOpen size={16} className={showProperties && activeSidebarTab === 'manuale' ? "text-emerald-600 animate-pulse" : "text-neutral-500"} />
          <span className="text-[10px] font-bold">Manuale</span>
        </button>

        <div className="flex items-center gap-1.5 px-2 border-l border-neutral-300 bg-neutral-50 h-full">
           <button onClick={() => { handleGuideClick('Apri'); handleOpenFile(); }} onMouseEnter={() => handleGuideHover('Apri')} title="Apri File" className="flex flex-col items-center justify-center p-1.5 hover:bg-neutral-200 text-neutral-600 rounded gap-0.5">
             <FolderOpen size={16} />
             <span className="text-[10px]">Apri</span>
           </button>
           <button onClick={() => { handleGuideClick('Salva'); handleSaveAsFile(); }} onMouseEnter={() => handleGuideHover('Salva')} title={fileHandle ? "Salva con nome" : "Salva"} className="flex flex-col items-center justify-center p-1.5 hover:bg-neutral-200 text-neutral-600 rounded gap-0.5">
             <Save size={16} />
             <span className="text-[10px]">Salva</span>
           </button>
           <button onClick={() => { handleGuideClick('Importa'); importInputRef.current?.click(); }} onMouseEnter={() => handleGuideHover('Importa')} title="Importa file .dxf o .dwg" className="flex flex-col items-center justify-center p-1.5 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 rounded gap-0.5 border-l border-neutral-200 pl-2 transition-colors">
             <FileUp size={16} />
             <span className="text-[10px] font-bold">Importa</span>
           </button>
           <button onClick={() => { handleGuideClick('Lettore DXF'); setIsDXFTextReaderOpen(true); }} onMouseEnter={() => handleGuideHover('Lettore DXF')} title="Genera disegno da testo/codice DXF" className="flex flex-col items-center justify-center p-1.5 hover:bg-teal-50 text-teal-600 hover:text-teal-700 rounded gap-0.5 border-l border-neutral-200 pl-2 transition-colors">
             <Code size={16} />
             <span className="text-[10px] font-bold">Lettore DXF</span>
           </button>
        </div>
        <button
          onClick={() => {
            handleGuideClick('Tavole CAD');
            if (activeSidebarTab === 'tavole' && showProperties) {
              setShowProperties(false);
            } else {
              setActiveSidebarTab('tavole');
              setShowProperties(true);
            }
          }}
          onMouseEnter={() => handleGuideHover('Tavole CAD')}
          className={`px-4 flex flex-col items-center justify-center gap-0.5 ${showProperties && activeSidebarTab === 'tavole' ? "bg-indigo-50 border-x border-indigo-200" : "hover:bg-neutral-200 border-l border-neutral-300"}`}
        >
          <Layers size={16} className={`${activeSidebarTab === 'tavole' && showProperties ? "text-indigo-600 animate-pulse" : "text-neutral-500"}`} />
          <span className={`text-[10px] font-bold ${activeSidebarTab === 'tavole' && showProperties ? "text-indigo-700" : "text-neutral-600"}`}>Tavole CAD</span>
        </button>
        <button
          onClick={async () => {
            handleGuideClick('Salva');
            const { exportDXF } = await import("./utils/dxfExport");
            exportDXF(entities, layers, "disegno.dxf");
          }}
          onMouseEnter={() => handleGuideHover('Salva')}
          className="px-4 flex flex-col items-center justify-center gap-0.5 hover:bg-neutral-200 text-blue-600 border-l border-neutral-300"
        >
          <span className="font-bold text-sm">DXF</span>
          <span className="text-[10px] font-bold">Salva CAD</span>
        </button>
      </header>
      <div className="h-8 bg-white border-b border-neutral-300 flex items-center px-4 gap-2">
        {selectedCategory === "BIM" ? (
          <BIMTopBarControls
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            selectedBIMSymbolType={selectedBIMSymbolType}
            setSelectedBIMSymbolType={setSelectedBIMSymbolType}
            cadCanvasRef={cadCanvasRef}
            defaultHatchStyle={defaultHatchStyle}
            setDefaultHatchStyle={setDefaultHatchStyle}
            bimWallThickness={bimWallThickness}
            setBimWallThickness={setBimWallThickness}
            bimWallHeight={bimWallHeight}
            setBimWallHeight={setBimWallHeight}
            bimDoorWidth={bimDoorWidth}
            setBimDoorWidth={setBimDoorWidth}
            bimDoorHeight={bimDoorHeight}
            setBimDoorHeight={setBimDoorHeight}
            bimWindowWidth={bimWindowWidth}
            setBimWindowWidth={setBimWindowWidth}
            bimWindowHeight={bimWindowHeight}
            setBimWindowHeight={setBimWindowHeight}
            bimSymbolScale={bimSymbolScale}
            setBimSymbolScale={(val) => {
              setBimSymbolScale(val);
              localStorage.setItem('lastBIMSymbolScale', val.toString());
            }}
            setIsBIMFinestreOpen={setIsBIMFinestreOpen}
            onOpen3DView={() => setIs3DViewOpen(true)}
          />
        ) : (
          selectedCategoryTools.map((tool) => (
            <button
              key={tool.name}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", tool.name);
                e.dataTransfer.setData("source", "toolbar");
                setDraggingToolName(tool.name);
                setDraggingSource("toolbar");
              }}
              onDragEnd={() => {
                setDraggingToolName(null);
                setDraggingSource(null);
                setDragOverTool(null);
              }}
              onMouseEnter={() => handleGuideHover(tool.name)}
              onClick={() => handleToolClick(tool.name)}
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs cursor-grab active:cursor-grabbing border border-transparent transition-all hover:border-neutral-300 ${
                selectedTool === tool.name 
                  ? "bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold shadow-xs" 
                  : "hover:bg-neutral-200"
              }`}
              title="Trascina e rilascia nel foglio per creare un menu speciale preferiti!"
            >
              <tool.icon size={12} />
              {tool.name}
            </button>
          ))
        )}
        {selectedCategory === "Seleziona" && (
          <>
            <div className="h-4 w-[1px] bg-neutral-300 mx-1" />
            <span className="text-[11px] text-neutral-500 font-medium">
              Menu Righelli:
            </span>
            <button
              onClick={() => {
                handleGuideClick("Classico (Tecnigrafo)");
                setRulerStyle("tecnigrafo");
              }}
              onMouseEnter={() => handleGuideHover("Classico (Tecnigrafo)")}
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs transition ${rulerStyle === "tecnigrafo" ? "bg-amber-100 text-amber-950 border border-amber-300 font-medium" : "hover:bg-neutral-200"}`}
            >
              <DraftingCompass size={12} />
              Classico (Tecnigrafo)
            </button>
            <button
              onClick={() => {
                handleGuideClick("Incrocio CAD");
                setRulerStyle("crosshair");
              }}
              onMouseEnter={() => handleGuideHover("Incrocio CAD")}
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs transition ${rulerStyle === "crosshair" ? "bg-amber-100 text-amber-950 border border-amber-300 font-medium" : "hover:bg-neutral-200"}`}
            >
              <Crosshair size={12} />
              Incrocio CAD
            </button>
            <div className="h-4 w-[1px] bg-neutral-300 mx-1" />
            <span className="text-[11px] text-neutral-500 font-medium">
              Clipboard (Appunti):
            </span>
            <button
              onClick={async () => {
                if (selectedId) {
                  const selectedEnt = entities.find(el => el.id === selectedId);
                  if (selectedEnt) {
                    try {
                      const data = {
                        source: "gecolacad",
                        entities: [selectedEnt]
                      };
                      await navigator.clipboard.writeText(JSON.stringify(data));
                      setShortcutToast("Oggetto CAD copiato negli appunti!");
                      setTimeout(() => setShortcutToast(null), 3000);
                    } catch (err) {
                      setShortcutToast("Impossibile copiare. Usa Ctrl+C sul foglio!");
                      setTimeout(() => setShortcutToast(null), 3000);
                    }
                  }
                } else {
                  setShortcutToast("Seleziona prima un oggetto da copiare!");
                  setTimeout(() => setShortcutToast(null), 3000);
                }
              }}
              className="px-2 py-0.5 rounded flex items-center gap-1 text-xs transition bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800"
              title="Copia l'oggetto CAD selezionato negli appunti (Ctrl+C)"
            >
              <Copy size={12} />
              Copia Oggetto
            </button>
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) {
                    const pasteEvent = new ClipboardEvent('paste', {
                      clipboardData: new DataTransfer()
                    });
                    pasteEvent.clipboardData?.setData('text', text);
                    window.dispatchEvent(pasteEvent);
                  } else {
                    setShortcutToast("Gli appunti sono vuoti!");
                    setTimeout(() => setShortcutToast(null), 3000);
                  }
                } catch (err) {
                  setShortcutToast("Premi Ctrl+V sul foglio per incollare testi, immagini o oggetti!");
                  setTimeout(() => setShortcutToast(null), 4000);
                }
              }}
              className="px-2 py-0.5 rounded flex items-center gap-1 text-xs transition bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-800"
              title="Incolla testi, immagini o oggetti CAD dagli appunti (Ctrl+V)"
            >
              <Clipboard size={12} />
              Incolla (Ctrl+V)
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              handleGuideClick("Modo Orto");
              setOrthoMode(!orthoMode); // explicitly toggle the stored state, not the effective one
            }}
            onMouseEnter={() => handleGuideHover("Modo Orto")}
            className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs transition ${
              effectiveOrthoMode 
                ? "bg-indigo-100 text-indigo-900 border border-indigo-300" 
                : "hover:bg-neutral-200"
            }`}
          >
            <OrthoIcon size={12} />
            <span>Ortho</span>
          </button>
          <button
            onClick={() => {
              const next = !isTecnigrafoActive;
              setIsTecnigrafoActive(next);
              if (next) {
                const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true });
                document.dispatchEvent(event);
              } else {
                const event = new KeyboardEvent('keyup', { key: 'q', bubbles: true });
                document.dispatchEvent(event);
              }
            }}
            className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs transition ${
              isTecnigrafoActive 
                ? "bg-amber-100 text-amber-900 border border-amber-300" 
                : "hover:bg-neutral-200"
            }`}
          >
            <DraftingCompass size={12} />
            <span>Tecnigrafo</span>
          </button>
          
          <button
            onClick={() => {
              const next = !isContinuousMode;
              setIsContinuousMode(next);
              if (next && selectedTool === 'Select') {
                setOrthoMode(true);
                setSelectedTool('Line');
              }
              setCancelTrigger(prev => prev + 1);
            }}
            className={`px-2 py-0.5 rounded flex items-center gap-1 text-xs transition-all ${
              isContinuousMode 
                ? "bg-amber-100 text-amber-950 border border-amber-300 font-bold shadow-[0_0_8px_rgba(245,158,11,0.2)]" 
                : "hover:bg-neutral-200"
            }`}
          >
            <PolylineIcon size={12} className={isContinuousMode ? "text-amber-600" : ""} />
            <span>Polilinea</span>
          </button>
          <div className="flex gap-1 rounded bg-neutral-200 p-0.5">
            <button
              onClick={() => {
                handleGuideClick("Penne");
                setDefaultLineStyle({ mode: 'CAD', color: '#000000', lineWidth: 1, dashed: false });
                setActiveSidebarTab('penne');
                setShowProperties(true);
                handleToolClick("Line");
              }}
              onMouseEnter={() => handleGuideHover("Penne")}
              className={`px-3 py-1 rounded text-[10px] font-bold ${defaultLineStyle.mode === 'CAD' ? 'bg-white shadow-sm font-extrabold text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              CAD
            </button>
            <div className="flex items-center gap-1 border-l border-neutral-300 pl-2 ml-1">
              <span className="text-[9px] font-bold text-neutral-400 mr-1">Kina:</span>
              {[0.25, 0.5, 1, 2].map(w => (
                <button
                  key={w}
                  onClick={() => {
                    handleGuideClick("Penne");
                    setDefaultLineStyle({ mode: 'ink', color: '#000000', lineWidth: w, dashed: false });
                    setActiveSidebarTab('penne');
                    setShowProperties(true);
                    handleToolClick("Line");
                  }}
                  className={`w-7 h-6 rounded flex items-center justify-center text-[9px] font-black transition-all ${defaultLineStyle.mode === 'ink' && defaultLineStyle.lineWidth === w ? 'bg-indigo-600 text-white shadow-md scale-110' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'}`}
                >
                  {w}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 border-l border-neutral-300 pl-2 ml-1">
              <span className="text-[9px] font-bold text-neutral-400 mr-1">Matita:</span>
              {['2H', 'HB', '2B'].map(m => (
                <button
                  key={m}
                  onClick={() => {
                    handleGuideClick("Penne");
                    const color = m === '2H' ? '#bbbbbb' : (m === 'HB' ? '#444444' : '#111111');
                    const width = m === '2H' ? 1 : (m === 'HB' ? 2 : 3);
                    setDefaultLineStyle({ mode: 'pencil', color, lineWidth: width, dashed: false });
                    setActiveSidebarTab('penne');
                    setShowProperties(true);
                    handleToolClick("Line");
                  }}
                  className={`px-1.5 h-6 rounded flex items-center justify-center text-[9px] font-black transition-all ${defaultLineStyle.mode === 'pencil' && (m === '2H' ? defaultLineStyle.color === '#bbbbbb' : (m === 'HB' ? defaultLineStyle.color === '#444444' : defaultLineStyle.color === '#111111')) ? 'bg-amber-500 text-white shadow-md scale-110' : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden relative">
        <main
          className="flex-1 overflow-hidden relative"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const toolName = e.dataTransfer.getData("text/plain");
            const source = e.dataTransfer.getData("source");
            
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (toolName) {
              let isDocked: 'left' | 'right' | 'top' | null = null;
              let finalX = x;

              if (x < 50) {
                isDocked = 'left';
                finalX = 0;
              } else if (window.innerWidth - e.clientX < 240) {
                isDocked = 'right';
                finalX = window.innerWidth - 60;
              } else if (e.clientY < 185) {
                isDocked = 'top';
              }

              const newPanelId = `fav-${Date.now()}`;
              const newPanel = {
                id: newPanelId,
                tools: [toolName],
                x: isDocked === 'left' ? 0 : (isDocked === 'right' ? window.innerWidth - 65 : Math.max(10, x - 24)),
                y: Math.max(50, y - 24),
                isDocked
              };

              if (source && source.startsWith("favorites-")) {
                const sourcePanelId = source.replace("favorites-", "");
                setFavoritePanels(prev => {
                  const filtered = prev.map(p => {
                    if (p.id === sourcePanelId) {
                      return { ...p, tools: p.tools.filter(t => t !== toolName) };
                    }
                    return p;
                  }).filter(p => p.tools.length > 0);
                  return [...filtered, newPanel];
                });
              } else if (source === "toolbar") {
                setFavoritePanels(prev => [...prev, newPanel]);
              }
            }
          }}
        >
          <CADCanvas
            ref={cadCanvasRef}
            entities={entities}
            activeTool={selectedTool}
            setActiveTool={setSelectedTool}
            setEntities={updateEntitiesWithHistory}
            setEntitiesSilent={updateEntitiesSilent}
            defaultTextStyle={defaultTextStyle}
            onCommitHistory={commitToHistory}
            onSelect={(id, entity) => {
              setSelectedId(id);
              if (id) {
                setShowProperties(true);
                const ent = entity || entities.find(e => e.id === id);
                if (ent && ent.type === 'text') {
                  setActiveSidebarTab('testo');
                } else if (ent && ent.isBIM) {
                  setActiveSidebarTab('bim');
                } else {
                  setActiveSidebarTab('penne');
                }
              }
            }}
            onContextMenu={handleRightClickShortcut}
            activeLayerId={activeLayerId}
            layers={layers}
            defaultLineStyle={defaultLineStyle}
            setDefaultLineStyle={setDefaultLineStyle}
            eraserRadius={eraserRadius}
            setEraserRadius={setEraserRadius}
            dimensionScale={dimensionScale}
            dimensionDecimals={dimensionDecimals}
            dimensionMode={dimensionMode}
            dimensionStyle={dimensionStyle}
            selectionMode={selectionMode}
            selectedEntityIds={capturedSelectionIds}
            onSelectionComplete={(ids, pos) => {
              if (ids.length === 0) {
                setQuickActions(null);
                setCapturedSelectionIds([]);
                return;
              }
              setQuickActions({ ids, pos });
              setCapturedSelectionIds(ids);
              // Also auto-select the first one for the sidebar
              if (ids.length > 0) setSelectedId(ids[0]);
            }}
            initialSelectedIds={initialSelectedIds}
            onDoubleClickDimension={(dim) => {
              setSelectedId(dim.id);
              setShowProperties(true);
              setActiveSidebarTab('penne');
            }}
            onDoubleClickBIMElement={(entity) => {
              setSelectedId(entity.id);
              setShowProperties(true);
              if (entity.bimType === 'door') {
                setIsBIMPorteOpen(true);
              } else if (entity.bimType === 'window') {
                setIsBIMFinestreOpen(true);
              } else if (entity.bimAreaType || (entity as any).bimFamily) {
                setIsBIMElementDialogOpen(true);
              }
            }}
            eraserType={eraserType}
            setEraserType={setEraserType}
            eraserIntensity={eraserIntensity}
            setEraserIntensity={setEraserIntensity}
            rulerStyle={rulerStyle}
            orthoMode={orthoMode}
            setOrthoMode={setOrthoMode}
            isContinuousMode={isContinuousMode}
            cancelTrigger={cancelTrigger}
            parallelTrigger={parallelTrigger}
            tavole={tavole}
            onUpdateTavole={setTavole}
            onDoubleClickTavola={setDoubleClickedTavolaId}
            selectedTemplateId={selectedTemplateId}
            selectedEntityId={selectedId}
            selectedBIMSymbolType={selectedBIMSymbolType}
            setSelectedBIMSymbolType={setSelectedBIMSymbolType}
            bimSymbolScale={bimSymbolScale}
            defaultHatchStyle={defaultHatchStyle}
            bimWallHeight={bimWallHeight}
            bimDoorHeight={bimDoorHeight}
            bimWindowHeight={bimWindowHeight}
            bimWallThickness={bimWallThickness}
            bimWallType={bimWallType}
            bimWallRenderMode={bimWallRenderMode}
            onActionStart={() => {
              setHoveredGuide(null);
              setGuideLockedBy(null);
            }}
            raccordoConfig={raccordoConfig}
            onEditRaccordo={(raccordoEntity) => {
              setEditingRaccordo(raccordoEntity);
              setIsRaccordoDialogOpen(true);
            }}
            onAreaDetected={handleBIMElementDetected}
            highlightedPoints={detectedAreaPoints}
            rotationEntityId={rotationEntityId}
            onSelectForRotation={(id) => {
                setRotationEntityId(id);
                setIsRotateScaleOpen(true);
            }}
          />

          {isRotateScaleOpen && (
            <div className="absolute top-24 right-4 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-neutral-200 p-4 z-50 flex flex-col gap-4 w-72 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-50 p-2 rounded-lg">
                            <RotateScaleIcon size={18} />
                        </div>
                        <h3 className="text-[13px] font-bold text-neutral-800 tracking-tight">
                            Trasforma Oggetto
                        </h3>
                    </div>
                    <button onClick={() => { setIsRotateScaleOpen(false); setSelectedTool('Select'); }} className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 hover:bg-neutral-100 rounded-md">✕</button>
                </div>

                {!rotationEntityId ? (
                    <div className="py-8 text-center px-4 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                        <RefreshCw size={24} className="text-neutral-300 mx-auto mb-2 animate-spin-slow" />
                        <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">Seleziona un elemento nel disegno per visualizzare le opzioni di rotazione e scala</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ROTAZIONE */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                <RefreshCw size={10} /> Rotazione
                            </label>
                            
                            <div className="grid grid-cols-4 gap-1.5">
                                {[0, 90, 180, 270].map(angle => (
                                    <button
                                        key={angle}
                                        onClick={() => {
                                            if (!initialBaseEntitiesRef.current) return;
                                            const baseCenter = getSelectionCenter(transformSelection, initialBaseEntitiesRef.current);
                                            
                                            updateEntitiesWithHistory(prev => {
                                                const currentEntities = [...prev];
                                                return currentEntities.map(e => {
                                                    if (transformSelection.includes(e.id)) {
                                                        const baseEntity = initialBaseEntitiesRef.current!.find(be => be.id === e.id);
                                                        const currentEntAngle = (baseEntity as any)?.angle || 0;
                                                        const delta = angle - currentEntAngle;
                                                        return rotateEntityFixed(baseEntity || e, delta, baseCenter);
                                                    }
                                                    return e;
                                                });
                                            });
                                        }}
                                        className="py-2 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-all rounded-md text-[10px] font-bold border border-neutral-200 text-neutral-600 hover:text-indigo-600 shadow-sm"
                                    >
                                        {angle}°
                                    </button>
                                ))}
                            </div>

                            <div className="pt-1">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-medium text-neutral-500 italic">Angolo Libero</span>
                                    <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                        {(entities.find(e => e.id === rotationEntityId) as any)?.angle || 0}°
                                    </span>
                                </div>
                                <input 
                                    type="range"
                                    min="-180"
                                    max="180"
                                    step="1"
                                    value={(entities.find(e => e.id === rotationEntityId) as any)?.angle || 0}
                                    onChange={(e) => {
                                        const nextAngle = parseInt(e.target.value);
                                        if (!initialBaseEntitiesRef.current) return;
                                        const baseCenter = getSelectionCenter(transformSelection, initialBaseEntitiesRef.current);

                                        updateEntitiesSilent(prev => prev.map(ent => {
                                            if (transformSelection.includes(ent.id)) {
                                                const baseEntity = initialBaseEntitiesRef.current!.find(be => be.id === ent.id);
                                                const entity = baseEntity || ent;
                                                const currentAngle = (entity as any).angle || 0;
                                                const delta = nextAngle - currentAngle;
                                                return rotateEntityFixed(entity, delta, baseCenter);
                                            }
                                            return ent;
                                        }));
                                    }}
                                    onMouseUp={() => commitToHistory()}
                                    className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-neutral-200"
                                />
                            </div>
                        </div>

                        {/* SCALA / INGRANDIMENTO */}
                        <div className="space-y-3 pt-2 border-t border-neutral-100">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Maximize size={10} /> Ingrandimento
                            </label>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-medium text-neutral-500 italic">Fattore di Scala</span>
                                    <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                        x{((entities.find(e => e.id === rotationEntityId) as any)?.scale || 1).toFixed(2)}
                                    </span>
                                </div>
                                <input 
                                    type="range"
                                    min="0.1"
                                    max="5"
                                    step="0.05"
                                    value={(entities.find(e => e.id === rotationEntityId) as any)?.scale || 1}
                                    onChange={(e) => {
                                        const nextScale = parseFloat(e.target.value);
                                        if (!initialBaseEntitiesRef.current) return;
                                        const baseCenter = getSelectionCenter(transformSelection, initialBaseEntitiesRef.current);

                                        updateEntitiesSilent(prev => prev.map(ent => {
                                            if (transformSelection.includes(ent.id)) {
                                                const baseEntity = initialBaseEntitiesRef.current!.find(be => be.id === ent.id);
                                                const entity = baseEntity || ent;
                                                const currentBaseScale = (entity as any).scale || 1;
                                                const factor = nextScale / currentBaseScale;
                                                return scaleEntity(entity, factor, nextScale, baseCenter);
                                            }
                                            return ent;
                                        }));
                                    }}
                                    onMouseUp={() => commitToHistory()}
                                    className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-neutral-200"
                                />
                                <div className="flex justify-between text-[8px] text-neutral-300 font-bold px-0.5 pt-1 uppercase">
                                    <span>Ridotto</span>
                                    <span>Normale (x1)</span>
                                    <span>Ingrandito</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}

          {isBIMElementDialogOpen && (
            <BIMElementDialog
              isOpen={isBIMElementDialogOpen}
              onClose={() => {
                setIsBIMElementDialogOpen(false);
                setDetectedAreaPoints(null);
                setEditingEntityId(null);
              }}
              onConfirm={handleConfirmBIMElement}
              points={detectedAreaPoints || undefined}
              initialData={editingEntityId ? (() => {
                const e = entities.find(ent => ent.id === editingEntityId);
                if (!e) return undefined;
                return {
                  familyId: (e as any).bimAreaType || 'Fondazioni',
                  subFamily: (e as any).bimFamily || (e as any).bimSubFamily || '',
                  name: (e as any).bimName || '',
                  color: (e as any).backgroundColor || e.color,
                  zPlane: (e as any).bimZPlane || (e as any).zPlane || 0,
                  zElevation: (e as any).bimZElevation || (e as any).zElevation || 0,
                  objectHeight: (e as any).bimHeight || (e as any).height || 270,
                  hatch: (e as any).bimHatchPattern || 'SOLID',
                  bimRenderMode: (e as any).bimRenderMode || 'solid'
                };
              })() : undefined}
            />
          )}
          <FinestreDialog
            isOpen={isBIMFinestreOpen}
            onClose={() => {
              setIsBIMFinestreOpen(false);
              setSelectedId(null);
            }}
            lastWindowWidth={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimWidth || bimWindowWidth;
            })()}
            lastWindowHeight={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimWindowHeight || bimWindowHeight;
            })()}
            lastWindowZElevation={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimZElevation !== undefined ? (e as any).bimZElevation : parseFloat(localStorage.getItem('lastWindowZElevation') || '100');
            })()}
            lastWindowType={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimWindowType || localStorage.getItem('lastWindowType') || 'singola';
            })()}
            lastWindowFlipLeft={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimFlipLeft !== undefined ? (e as any).bimFlipLeft : (localStorage.getItem('lastWindowFlip') === 'true');
            })()}
            lastWindowFlipSide={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.bimFlipSide !== undefined ? (e as any).bimFlipSide : (localStorage.getItem('lastWindowFlipSide') === 'true');
            })()}
            lastWindowRotation={(() => {
              const e = entities.find(ent => ent.id === selectedId);
              return (e as any)?.angle !== undefined ? (e as any).angle : parseFloat(localStorage.getItem('lastWindowRotation') || '0');
            })()}
            onConfirmWindow={(width, height, type, trasmittanza, prezzario, zElevation, flipLeft, flipSide, rotation) => {
              if (selectedId) {
                // Update existing
                updateEntitiesWithHistory(prev => prev.map(e => {
                  if (e.id === selectedId) {
                    const entAsAny = e as any;
                    let nextElem = {
                      ...e,
                      bimWidth: width,
                      bimWindowHeight: height,
                      bimWindowType: type,
                      bimZElevation: zElevation,
                      bimFlipLeft: flipLeft,
                      bimFlipSide: flipSide,
                      angle: rotation,
                      prezzario,
                      trasmittanza
                    };

                    // Update geometry if rotation or width changed
                    if (entAsAny.start && entAsAny.end) {
                      const cx = (entAsAny.start.x + entAsAny.end.x) / 2;
                      const cy = (entAsAny.start.y + entAsAny.end.y) / 2;
                      const rad = (rotation * Math.PI) / 180;
                      const hDx = Math.cos(rad) * (width / 2);
                      const hDy = Math.sin(rad) * (width / 2);
                      
                      (nextElem as any).start = { x: cx - hDx, y: cy - hDy };
                      (nextElem as any).end = { x: cx + hDx, y: cy + hDy };
                    }
                    
                    return nextElem;
                  }
                  return e;
                }));
                setShortcutToast("Infisso aggiornato ✅");
              } else {
                // Set defaults for new
                setBimWindowWidth(width);
                setBimWindowHeight(height);
                localStorage.setItem('lastWindowZElevation', zElevation.toString());
                localStorage.setItem('lastWindowFlip', flipLeft.toString());
                localStorage.setItem('lastWindowFlipSide', flipSide.toString());
                localStorage.setItem('lastWindowRotation', rotation.toString());
                cadCanvasRef.current?.setBIMDefaults(width, height, 'window', zElevation, type, flipLeft, flipSide, rotation);
                setSelectedBIMSymbolType('window');
                setShortcutToast("Seleziona un punto sul muro per inserire la finestra");
              }
              setIsBIMFinestreOpen(false);
              setSelectedId(null);
            }}
          />

          {is3DViewOpen && (
            <BIM3DViewer 
              entities={entities} 
              onClose={() => setIs3DViewOpen(false)} 
              setEntities={updateEntitiesWithHistory}
            />
          )}
          
          {doubleClickedTavolaId && !pdfPreviewUrl && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center p-4 z-50 pointer-events-auto">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                {(() => {
                  const tav = tavole.find(t => t.id === doubleClickedTavolaId);
                  if (!tav) return null;
                  return (
                    <>
                      <div className="px-4 border-b border-neutral-100 flex items-center justify-between py-3">
                        <h3 className="font-bold text-neutral-800 text-sm">Parametri Tavola - {tav.name}</h3>
                        <button onClick={() => setDoubleClickedTavolaId(null)} className="text-neutral-400 hover:text-neutral-600">✕</button>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Foglio</label>
                            <select
                              value={tav.format}
                              onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? { ...t, format: e.target.value as any } : t))}
                              className="w-full bg-neutral-50 border border-neutral-300 text-sm rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            >
                              <option value="A4">A4</option>
                              <option value="A3">A3</option>
                              <option value="A2">A2</option>
                              <option value="A1">A1</option>
                              <option value="A0">A0</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Scala 1:</label>
                            <input
                              type="number"
                              min="1"
                              value={tav.scale}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, scale: val } : t));
                              }}
                              className="w-full bg-neutral-50 border border-neutral-300 text-sm rounded p-1.5 text-center font-bold focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-1">Unità</label>
                            <select
                              value={tav.unit}
                              onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? { ...t, unit: e.target.value as any } : t))}
                              className="w-full bg-neutral-50 border border-neutral-300 text-sm rounded p-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            >
                              <option value="m">Metri</option>
                              <option value="cm">Cm</option>
                              <option value="mm">Mm</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4 pt-4 border-t border-neutral-100">
                          <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Cartiglio</h4>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-neutral-600">Progetto</label>
                            <input 
                              type="text"
                              className="border border-neutral-300 rounded p-1.5 text-sm w-full bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                              value={tav.datiCartiglio.progetto}
                              onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, progetto: e.target.value}} : t))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-neutral-600">Titolo</label>
                            <input 
                              type="text"
                              className="border border-neutral-300 rounded p-1.5 text-sm w-full bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                              value={tav.datiCartiglio.titolo}
                              onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, titolo: e.target.value}} : t))}
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-[10px] font-semibold text-neutral-600">Autore</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded p-1.5 text-sm w-full bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={tav.datiCartiglio.autore}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, autore: e.target.value}} : t))}
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-1/3">
                              <label className="text-[10px] font-semibold text-neutral-600">Data</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded p-1.5 text-sm w-full bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={tav.datiCartiglio.data}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, data: e.target.value}} : t))}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mt-4 pt-4 border-t border-neutral-100 bg-red-50/30 p-2 rounded">
                          <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Calibrazione Righello (Stampante)
                          </h4>
                          <p className="text-[10px] text-neutral-500 leading-tight">
                            Se stampando al 100% la "verifica 10mm" sul foglio misura diversamente (es. 9mm), inserisci qui la misura esatta letta col righello. Il CAD compenserà l'errore della stampante.
                          </p>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-semibold text-neutral-600">Misura reale linea di verifica (in mm)</label>
                            <input 
                              type="number"
                              step="0.1"
                              placeholder="10"
                              className="border border-neutral-300 rounded p-1.5 text-sm w-full bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-mono"
                              value={tav.measuredCalibrationMm || 10}
                              onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, measuredCalibrationMm: parseFloat(e.target.value) || 10} : t))}
                            />
                          </div>
                        </div>

                      </div>
                      <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
                        <button
                          onClick={async () => {
                            const { exportNativePDF } = await import("./utils/pdfExport");
                            const url = exportNativePDF(entities, tav.format, tav.scale, tav.unit, tav, 'bloburl');
                            if (url) {
                              setPdfPreviewUrl(url);
                              setActivePreviewTavolaId(tav.id);
                            }
                          }}
                          className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded text-sm font-bold shadow-sm hover:bg-indigo-200 transition-colors flex items-center justify-center gap-1"
                        >
                          Anteprima di Stampa
                        </button>
                        <button
                          onClick={() => setDoubleClickedTavolaId(null)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
                        >
                          Chiudi
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {pdfPreviewUrl && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6 z-[60] pointer-events-auto">
              <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-5xl flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between bg-neutral-50 shrink-0 border-neutral-200">
                  <h3 className="font-bold text-neutral-800 flex items-center gap-2">
                    <Printer size={18} className="text-indigo-600" />
                    Anteprima di Stampa PDF
                  </h3>
                  <div className="flex items-center gap-2">
                    <a 
                      href={pdfPreviewUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold text-sm transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink size={14} />
                      Apri / Stampa a pagina intera
                    </a>
                    <button 
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = pdfPreviewUrl;
                        a.download = "anteprima.pdf";
                        a.click();
                      }}
                      className="px-3 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded font-bold text-sm transition-colors"
                    >
                      Scarica File
                    </button>
                    <button 
                      onClick={() => {
                        setPdfPreviewUrl(null);
                        setActivePreviewTavolaId(null);
                      }} 
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold text-sm transition-colors"
                    >
                      Chiudi Anteprima
                    </button>
                  </div>
                </div>
                <div id="pdf-scroll-container" className="flex-1 bg-neutral-100 p-4 flex flex-col h-full overflow-hidden justify-center items-center">
                  {(() => {
                    const previewTav = tavole.find(t => t.id === activePreviewTavolaId);
                    if (previewTav) {
                      return <CanvasPDFPreview entities={entities} tavola={previewTav} />;
                    }
                    return (
                      <iframe 
                        src={pdfPreviewUrl} 
                        className="w-full h-full border-none rounded bg-white shadow-inner flex-1" 
                        title="Anteprima PDF"
                      />
                    );
                  })()}
                  <div className="mt-2 text-center text-xs text-neutral-500 font-medium pb-1 shrink-0">
                    💡 Per stampare o salvare in PDF vettoriale reale con retini perfetti, clicca su <span className="font-bold text-orange-700">"Apri / Stampa a pagina intera"</span> o <span className="font-bold text-indigo-700">"Scarica File"</span>.
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Dynamic Floating/Docked Favorites Toolbars / Menu Speciali Preferiti */}
          {(() => {
            const leftDockedPanels = favoritePanels.filter(p => p.isDocked === 'left');
            const rightDockedPanels = favoritePanels.filter(p => p.isDocked === 'right');
            const topDockedPanels = favoritePanels.filter(p => p.isDocked === 'top');

            return favoritePanels.map((panel) => {
              const isDocked = panel.isDocked;
              const leftIndex = leftDockedPanels.findIndex(p => p.id === panel.id);
              const rightIndex = rightDockedPanels.findIndex(p => p.id === panel.id);
              const topIndex = topDockedPanels.findIndex(p => p.id === panel.id);
              const isDraggingThis = activeDraggingId === panel.id;
              
              // Dynamic placement coordinates with dampening transitions for satisfying dragging glide effect
              let placementStyle: React.CSSProperties = {
                left: panel.x,
                top: panel.y,
                transition: isDraggingThis
                  ? 'left 0.12s cubic-bezier(0.12, 0.85, 0.2, 1), top 0.12s cubic-bezier(0.12, 0.85, 0.2, 1)'
                  : 'left 0.3s cubic-bezier(0.16, 1, 0.3, 1), top 0.3s cubic-bezier(0.16, 1, 0.3, 1), right 0.3s, width 0.2s, height 0.2s',
              };

              if (isDocked === 'left' && !isDraggingThis) {
                placementStyle = {
                  left: leftIndex * 72,
                  top: '15%',
                  height: '70%',
                  maxHeight: '520px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                };
              } else if (isDocked === 'right' && !isDraggingThis) {
                placementStyle = {
                  right: rightIndex * 72,
                  top: '15%',
                  height: '70%',
                  maxHeight: '520px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                };
              } else if (isDocked === 'top' && !isDraggingThis) {
                placementStyle = {
                  left: `calc(50% - ${110 + topIndex * 76}px)`,
                  top: topIndex * 76 + 64,
                  height: '72px',
                  width: `${panel.tools.length * 64 + 58}px`,
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                };
              }

              return (
                <div
                  key={panel.id}
                  style={placementStyle}
                  className={`absolute z-30 select-none bg-white/80 backdrop-blur-md border border-neutral-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.06)] overflow-hidden flex pointer-events-auto ${
                    isDocked === 'top' ? 'flex-row items-center max-h-[72px]' : 'flex-col'
                  } ${
                    isDraggingThis
                      ? "ring-2 ring-indigo-500/30 shadow-indigo-500/10 scale-[1.01] z-40" 
                      : ""
                  } ${
                    isDocked === 'left' 
                      ? 'rounded-r-xl border-l-0' 
                      : isDocked === 'right' 
                        ? 'rounded-l-xl border-r-0' 
                        : isDocked === 'top'
                          ? 'rounded-b-xl border-t-0 max-w-none'
                          : 'rounded-xl max-w-[85px]'
                  }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const toolName = e.dataTransfer.getData("text/plain") || draggingToolName;
                  const source = e.dataTransfer.getData("source") || draggingSource;

                  if (toolName) {
                    setDragOverTool(null);
                    setDraggingToolName(null);
                    setDraggingSource(null);

                    setFavoritePanels(prev => {
                      // 1. Remove the dragging tool from its source panel
                      let updatedPanels = [...prev];
                      if (source && source.startsWith("favorites-")) {
                        const sourcePanelId = source.replace("favorites-", "");
                        updatedPanels = updatedPanels.map(p => {
                          if (p.id === sourcePanelId) {
                            return { ...p, tools: p.tools.filter(t => t !== toolName) };
                          }
                          return p;
                        }).filter(p => p.tools.length > 0);
                      } else {
                        // If from toolbar, remove first from this panel to prevent duplicates
                        updatedPanels = updatedPanels.map(p => {
                          if (p.id === panel.id) {
                            return { ...p, tools: p.tools.filter(t => t !== toolName) };
                          }
                          return p;
                        });
                      }

                      // 2. Append to the end of the panel
                      return updatedPanels.map(p => {
                        if (p.id === panel.id) {
                          if (p.tools.includes(toolName)) return p;
                          return { ...p, tools: [...p.tools, toolName] };
                        }
                        return p;
                      });
                    });
                  }
                }}
              >
                {/* Horizontal or vertical discrete drag handle at top or side */}
                <div
                  onMouseDown={(e) => handleFavoritesMouseDown(e, panel.id)}
                  className={`px-2 text-neutral-600 flex items-center justify-between cursor-move text-[9px] uppercase font-mono font-bold tracking-wider ${
                    isDocked === 'top' 
                      ? 'flex-col py-1 border-r border-neutral-200/60 h-full justify-center gap-1.5 min-w-[42px]' 
                      : `py-1.5 border-b border-neutral-200/60 ${isDocked ? 'flex-col gap-1' : ''}`
                  }`}
                  title="Trascina per spostare o sganciare"
                >
                  <div className="flex flex-col items-center gap-0.5 pointer-events-none">
                    <div className="flex gap-0.5">
                      <div className="w-1 h-1 bg-neutral-400 rounded-full" />
                      <div className="w-1 h-1 bg-neutral-400 rounded-full" />
                      <div className="w-1 h-1 bg-neutral-400 rounded-full" />
                    </div>
                  </div>

                  <span className="text-[8px] font-bold text-neutral-500 tracking-tighter block text-center truncate w-full scale-95 origin-center">
                    {isDocked ? 'Snodato' : '★ Menu'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setFavoritePanels(prev => prev.filter(p => p.id !== panel.id));
                    }}
                    title="Chiudi pannello"
                    className="text-neutral-400 hover:text-red-500 transition-colors p-0.5"
                  >
                    ✕
                  </button>
                </div>

                {/* Horizontal or Vertical list of tools */}
                <div className={`p-1.5 flex bg-white items-center justify-start ${
                  isDocked === 'top' 
                    ? 'flex-row gap-1.5 h-full overflow-x-auto px-2' 
                    : `flex-col gap-1.5 min-w-[72px] overflow-y-auto ${isDocked ? 'h-full' : 'max-h-[360px]'}`
                }`}>
                  {panel.tools.length === 0 ? (
                    <div className="text-[8px] text-neutral-400 text-center w-full p-2">
                       Vuoto
                    </div>
                  ) : (
                    panel.tools.map((toolName) => {
                      const IconComp = getToolIcon(toolName);
                      const isToolActive = 
                        selectedTool === toolName ||
                        (toolName === "Orto" && effectiveOrthoMode) ||
                        (toolName === "Tecnigrafo" && isTecnigrafoActive) ||
                        (toolName === "Polilinea" && isContinuousMode);

                      const isThisOver = dragOverTool && dragOverTool.panelId === panel.id && dragOverTool.toolName === toolName;

                      return (
                        <div
                          key={toolName}
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", toolName);
                            e.dataTransfer.setData("source", `favorites-${panel.id}`);
                            setDraggingToolName(toolName);
                            setDraggingSource(`favorites-${panel.id}`);
                          }}
                          onDragEnd={() => {
                            setDraggingToolName(null);
                            setDraggingSource(null);
                            setDragOverTool(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            let position: 'before' | 'after' = 'before';
                            if (isDocked === 'top') {
                              const mouseX = e.clientX - rect.left;
                              if (mouseX > rect.width / 2) {
                                position = 'after';
                              }
                            } else {
                              const mouseY = e.clientY - rect.top;
                              if (mouseY > rect.height / 2) {
                                position = 'after';
                              }
                            }
                            setDragOverTool({
                              panelId: panel.id,
                              toolName: toolName,
                              position: position
                            });
                          }}
                          onDragLeave={() => {
                            setDragOverTool(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const dragName = e.dataTransfer.getData("text/plain") || draggingToolName;
                            const dragSource = e.dataTransfer.getData("source") || draggingSource;

                            if (dragName) {
                              setDragOverTool(null);
                              setDraggingToolName(null);
                              setDraggingSource(null);

                              setFavoritePanels(prev => {
                                // 1. Remove the dragging tool from its source panel
                                let updatedPanels = [...prev];
                                if (dragSource && dragSource.startsWith("favorites-")) {
                                  const sourcePanelId = dragSource.replace("favorites-", "");
                                  updatedPanels = updatedPanels.map(p => {
                                    if (p.id === sourcePanelId) {
                                      return { ...p, tools: p.tools.filter(t => t !== dragName) };
                                    }
                                    return p;
                                  }).filter(p => p.tools.length > 0);
                                } else {
                                  // If from toolbar, remove first to prevent duplicates/reorder
                                  updatedPanels = updatedPanels.map(p => {
                                    if (p.id === panel.id) {
                                      return { ...p, tools: p.tools.filter(t => t !== dragName) };
                                    }
                                    return p;
                                  });
                                }

                                // 2. Insert into the target panel at the correct position
                                return updatedPanels.map(p => {
                                  if (p.id === panel.id) {
                                    const targetIndex = p.tools.indexOf(toolName);
                                    if (targetIndex === -1) {
                                      return { ...p, tools: [...p.tools, dragName] };
                                    }
                                    
                                    const isAfter = dragOverTool && dragOverTool.panelId === panel.id && dragOverTool.toolName === toolName && dragOverTool.position === 'after';
                                    const insertIndex = isAfter ? targetIndex + 1 : targetIndex;
                                    
                                    const nextTools = [...p.tools];
                                    nextTools.splice(insertIndex, 0, dragName);
                                    return { ...p, tools: nextTools };
                                  }
                                  return p;
                                });
                              });
                            }
                          }}
                          className="group relative"
                        >
                          {isThisOver && (
                            <div 
                              className={`absolute z-10 bg-indigo-500 shadow-[0_0_8px_rgba(78,70,229,0.8)] animate-pulse pointer-events-none rounded-full ${
                                isDocked === 'top'
                                  ? `top-0 bottom-0 w-1 ${dragOverTool.position === 'before' ? 'left-0' : 'right-0'}`
                                  : `left-0 right-0 h-1 ${dragOverTool.position === 'before' ? 'top-0' : 'bottom-0'}`
                              }`}
                            />
                          )}
                          <button
                            onClick={() => handleToolClick(toolName)}
                            className={`p-1 rounded-lg transition-all flex flex-col items-center justify-center gap-0.5 w-[58px] h-[58px] cursor-grab active:cursor-grabbing hover:scale-105 ${
                              isToolActive 
                                ? "bg-indigo-600 border-2 border-indigo-500 text-white font-bold shadow-[0_0_15px_rgba(79,70,229,0.6)] scale-[1.03]" 
                                : "bg-neutral-50 border border-neutral-200/50 text-neutral-700 hover:bg-indigo-50/70 hover:text-indigo-950 hover:border-indigo-400/50"
                            }`}
                            title={`${toolName} - Trascina per spostare o rimuovere`}
                          >
                            {IconComp ? <IconComp size={20} className={`${isToolActive ? "text-white" : "text-neutral-600 group-hover:text-indigo-600"} transition-colors`} /> : null}
                            <span className={`text-[8.5px] font-sans font-semibold truncate w-full text-center tracking-tight leading-none ${isToolActive ? "text-white font-black" : "text-neutral-500"}`}>
                              {toolName}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFavoritePanels(prev => {
                                return prev.map(p => {
                                  if (p.id === panel.id) {
                                    return { ...p, tools: p.tools.filter(t => t !== toolName) };
                                  }
                                  return p;
                                }).filter(p => p.tools.length > 0);
                              });
                            }}
                            className="absolute -top-1 -right-1 hidden group-hover:flex w-3.5 h-3.5 bg-red-500 hover:bg-red-600 text-white rounded-full items-center justify-center text-[7px] border border-white font-black"
                            title="Rimuovi"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          });
        })()}



          {/* Minimalist centered transparent watermark */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none select-none text-center z-10 opacity-100 transition-opacity duration-300">
            <span className="text-[10px] font-sans tracking-wider text-black font-thin">
              Copyright © 2026 Domenico Gimondo
            </span>
            <span className="text-[9px] font-mono tracking-[0.3em] text-black/80 font-normal mt-0.5 uppercase">
              AETERNA
            </span>
          </div>
        </main>

        {shortcutToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-neutral-800 text-white px-4 py-2 rounded-md shadow-lg pointer-events-none z-50 text-sm animate-pulse">
            {shortcutToast}
          </div>
        )}

        {/* Properties Panel (Drawer) */}
        {showProperties && (
          <div className={`w-80 border-l transition-all overflow-y-auto overflow-x-hidden flex flex-col h-full p-4 ${
            selectedTool === 'Dimension' 
              ? 'bg-slate-950 border-slate-800 text-slate-100 shadow-[2px_0_24px_rgba(0,0,0,0.5)]' 
              : 'bg-white border-neutral-300 text-neutral-800'
          }`}>
            <h3 className={`font-bold mb-4 flex justify-between items-center border-b pb-2 ${
              selectedTool === 'Dimension' 
                ? 'text-slate-200 border-slate-800' 
                : 'text-neutral-800 border-neutral-100'
            }`}>
              <span className="text-xs font-black uppercase tracking-wider font-mono flex items-center gap-2">
                {selectedTool === 'Dimension' ? (
                  <>
                    <Settings2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Configurazione Misura</span>
                  </>
                ) : (
                  <span>
                    {activeSidebarTab === "tavole" ? "Gestione Tavole" 
                      : activeSidebarTab === "layers" ? "Gestione Layers" 
                      : activeSidebarTab === "maschere" ? "Archivio Maschere" 
                      : activeSidebarTab === "testo" ? "Impostazioni Testo"
                      : activeSidebarTab === "gemini" ? "Disegno Gemini AI"
                      : activeSidebarTab === "bim" ? "Tecnologia BIM / I.A."
                      : "Mazzo Penne & Stili"}
                  </span>
                )}
              </span>
              <button 
                onClick={() => {
                  if (selectedTool === 'Dimension') setSelectedTool('Select');
                  setShowProperties(false);
                }} 
                className={`font-bold font-mono text-sm p-1 transition-colors ${
                  selectedTool === 'Dimension' 
                    ? 'text-slate-500 hover:text-slate-300' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                ✕
              </button>
            </h3>

            <div className="space-y-4 flex-1">
              {selectedTool === 'Dimension' ? (
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                    <p className="text-[11px] text-slate-300 leading-normal font-sans">
                      <span className="font-bold text-emerald-400">📊 STRUMENTO MISURE:</span> Configura i parametri di quotatura. Seleziona un metodo di immissione e clicca sul disegno.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* SELEZIONE MODE: MANUAL VS OBJECT */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-emerald-400" />
                        Metodo Selezione
                      </label>
                      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button
                          onClick={() => setSelectionMode('manual')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            selectionMode === 'manual'
                              ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <Ruler className="w-3.5 h-3.5" />
                          2p / Manuale
                        </button>
                        <button
                          onClick={() => setSelectionMode('object')}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
                            selectionMode === 'object'
                              ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <Target className="w-3.5 h-3.5" />
                          Ad Oggetto
                        </button>
                      </div>
                    </div>

                    {/* SCALE FACTOR */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                          <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                          Scala Dimensioni
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-emerald-400 text-xs font-black bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded">
                            {dimensionScale.toFixed(2)}x
                          </span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={dimensionScale}
                        onChange={(e) => setDimensionScale(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* SELECTS ROW */}
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* DIMENSION MODE */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                          Modalità
                        </label>
                        <select
                          value={dimensionMode}
                          onChange={(e) => setDimensionMode(e.target.value as 'two-points' | 'chain')}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        >
                          <option value="two-points" className="bg-slate-950 text-slate-200">2 Punti</option>
                          <option value="chain" className="bg-slate-950 text-slate-200">Catena</option>
                        </select>
                      </div>

                      {/* DIMENSION STYLE */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                          Tipo Stile
                        </label>
                        <select
                          value={dimensionStyle}
                          onChange={(e) => setDimensionStyle(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        >
                          <option value="linear" className="bg-slate-950 text-slate-200">Lineare (Auto)</option>
                          <option value="aligned" className="bg-slate-950 text-slate-200">Allineata</option>
                          <option value="horizontal" className="bg-slate-950 text-slate-200">Orto Orizzontale</option>
                          <option value="vertical" className="bg-slate-950 text-slate-200">Orto Verticale</option>
                          <option value="auto-ortho" className="bg-slate-950 text-slate-200">Auto Orto</option>
                        </select>
                      </div>
                    </div>

                    {/* DECIMAL PRECISION FIELD */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                        Approssimazione Decimale Globale
                      </label>
                      <select
                        value={dimensionDecimals}
                        onChange={(e) => setDimensionDecimals(parseInt(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs font-bold text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        <option value="0" className="bg-slate-950 text-slate-200">Nessun Decimale (es: 100)</option>
                        <option value="1" className="bg-slate-950 text-slate-200">1 Decimale (es: 100,5)</option>
                        <option value="2" className="bg-slate-950 text-slate-200">2 Decimali (es: 100,54)</option>
                        <option value="3" className="bg-slate-950 text-slate-200">3 Decimali (es: 100,538)</option>
                        <option value="4" className="bg-slate-950 text-slate-200">4 Decimali (es: 100,5378)</option>
                      </select>
                    </div>
                  </div>

                  {/* INFO FEEDBACK ACCORDING TO SELECTION MODE */}
                  <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-1.5 text-xs">
                    <span className="font-bold text-emerald-400 block tracking-wide uppercase text-[10px]">
                      {selectionMode === 'manual' ? "📌 GUIDA 2 PUNTI" : "🎯 GUIDA AD OGGETTO"}
                    </span>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      {selectionMode === 'manual' 
                        ? (dimensionMode === 'chain' 
                           ? "Clicca il primo punto, poi il secondo per tracciare la prima misura. Successivamente clicca altri punti per posizionare le altre misure in catena adiacente."
                           : "Traccia la linea di misura facendo clic sul primo punto e poi sul secondo. Sposta il cursore per regolare l'altezza dell'allineamento e fai clic per fissarla.")
                        : "Sposta il mouse e fai clic su un segmento/linea o sul lato di un rettangolo. Il segmento selezionato lampeggerà in verde, poi potrai muovere il mouse per posizionare la misura."
                      }
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedTool('Select');
                      setShowProperties(false);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Chiudi Configurazione
                  </button>
                </div>
              ) : activeSidebarTab === "bim" ? (
                <BIMWorkspacePanel
                  entities={entities}
                  selectedTool={selectedTool}
                  setSelectedTool={setSelectedTool}
                  setEntities={setEntities}
                  onCommitHistory={commitToHistory}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  cadCanvasRef={cadCanvasRef}
                  selectedTemplateId={selectedTemplateId}
                  setSelectedTemplateId={setSelectedTemplateId}
                  onOpenPorte={() => setIsBIMPorteOpen(true)}
                  onOpenFinestre={() => setIsBIMFinestreOpen(true)}
                  onOpenArredi={() => setIsBIMArrediOpen(true)}
                  onOpenSanitari={() => setIsBIMSanitariOpen(true)}
                  onOpenElettrico={() => setIsBIMElettricoOpen(true)}
                  onOpenIdraulico={() => setIsBIMIdraulicoOpen(true)}
                  onOpenFiniture={() => setIsBIMFinitureOpen(true)}
                  onEditArea={handleEditBIMElement}
                  onOpen3DView={() => setIs3DViewOpen(true)}
                />
              ) : selectedTool === 'Muro' ? (
                <div className="space-y-4">
                  <div className="bg-cyan-50 border border-cyan-200 p-3 rounded-lg shadow-sm">
                    <p className="text-[11px] text-cyan-900 leading-normal font-sans">
                      <span className="font-bold">🧱 IMPOSTAZIONI MURO:</span> Definisci la tipologia e le dimensioni.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">Spessore (cm)</label>
                      <input
                        type="number"
                        value={bimWallThickness}
                        onChange={(e) => {
                          setBimWallThickness(parseInt(e.target.value) || 15);
                          localStorage.setItem('lastWallThickness', e.target.value);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-300 rounded p-2 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">Altezza (cm)</label>
                      <input
                        type="number"
                        value={bimWallHeight}
                        onChange={(e) => {
                          setBimWallHeight(parseInt(e.target.value) || 270);
                          localStorage.setItem('lastWallHeight', e.target.value);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-300 rounded p-2 text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">Render 3D</label>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => {
                          setBimWallRenderMode('solid');
                          localStorage.setItem('lastWallRenderMode', 'solid');
                          localStorage.setItem('bimWallRenderMode', 'solid');
                        }} className={`flex-1 text-[9px] font-bold py-1.5 rounded border ${bimWallRenderMode === 'solid' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-neutral-100 border-neutral-300'}`}>Solido</button>
                        <button type="button" onClick={() => {
                          setBimWallRenderMode('transparent');
                          localStorage.setItem('lastWallRenderMode', 'transparent');
                          localStorage.setItem('bimWallRenderMode', 'transparent');
                        }} className={`flex-1 text-[9px] font-bold py-1.5 rounded border ${bimWallRenderMode === 'transparent' ? 'bg-cyan-500/20 border-cyan-500' : 'bg-neutral-100 border-neutral-300'}`}>Parete</button>
                      </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">Tipo Muratura</label>
                      <select
                        value={bimWallType}
                        onChange={(e) => {
                          setBimWallType(e.target.value);
                          localStorage.setItem('lastWallType', e.target.value);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-300 rounded p-2 text-xs font-mono"
                      >
                        {MASONRY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                  </div>
                </div>
              ) : activeSidebarTab === "gemini" ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg shadow-sm">
                    <p className="text-[11px] text-amber-900 leading-normal font-sans">
                      <span className="font-bold">🔮 DIALOGA CON GEMINI CAD:</span> Descrivi cosa vuoi disegnare. Riceverai un codice parametrico visualizzabile ed modificabile in tempo reale.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Prompt input */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">
                        Cosa desideri disegnare?
                      </label>
                      <textarea
                        className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-300 text-xs rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-neutral-400 font-sans leading-relaxed"
                        rows={3}
                        value={geminiPrompt}
                        onChange={(e) => setGeminiPrompt(e.target.value)}
                        placeholder="Es: un tavolo da pranzo 160x80 con 6 sedie, oppure una scala con 5 alzate..."
                      />
                    </div>

                    {/* Presets */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block font-mono">Esempi rapidi:</span>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          { label: "Tavolo e sedie", text: "tavolo rettangolare 160x90 con 6 sedie attorno" },
                          { label: "Ingranaggio", text: "ingranaggio circolare raggio 35 con 10 denti rettangolari" },
                          { label: "Scala a gradini", text: "una scala a gradini con 5 alzate da 18 e pedate da 28" },
                          { label: "Piscina ovale", text: "piscina ovale formata da un rettangolo centrale 100x50 e due semicerchi laterali" }
                        ].map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setGeminiPrompt(preset.text)}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[9px] px-1.5 py-1 rounded transition-colors font-medium border border-neutral-200 text-left truncate"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={async () => {
                        if (!geminiPrompt.trim()) return;
                        setGeminiIsLoading(true);
                        try {
                          const response = await fetch("/api/ai-draw", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: geminiPrompt })
                          });
                          if (!response.ok) {
                            throw new Error("Generazione fallita.");
                          }
                          const data = await response.json();
                          if (data.script) {
                            setGeminiResponse(data);
                            setGeminiDslScript(data.script);
                            
                            // Initialize parameters
                            const initialParams: Record<string, number> = {};
                            if (data.parameters) {
                              data.parameters.forEach((p: any) => {
                                initialParams[p.name] = p.value;
                              });
                            }
                            setGeminiParams(initialParams);
                          }
                        } catch (err: any) {
                          console.error(err);
                          alert("Impossibile connettersi o ricevere dati da Gemini: " + err.message);
                        } finally {
                          setGeminiIsLoading(false);
                        }
                      }}
                      disabled={geminiIsLoading || !geminiPrompt.trim()}
                      className={`w-full py-2 px-3 rounded-md font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
                        geminiIsLoading 
                          ? "bg-neutral-200 text-neutral-400 cursor-not-allowed" 
                          : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:from-amber-700 text-white hover:shadow-md cursor-pointer"
                      }`}
                    >
                      <Sparkles size={14} className={geminiIsLoading ? "animate-spin text-amber-500" : "text-white"} />
                      <span>{geminiIsLoading ? "Elaborazione IA..." : "Chiedi a Gemini"}</span>
                    </button>

                    {/* Gemini Result / Script Area */}
                    {geminiResponse && (
                      <div className="space-y-4 pt-3 border-t border-neutral-100">
                        {/* Explanation */}
                        {geminiResponse.explanation && (
                          <div className="bg-neutral-50 border border-neutral-200 rounded p-2 text-[10.5px] text-neutral-600 leading-relaxed font-sans">
                            <span className="font-bold text-neutral-800 block mb-0.5">Note di Progetto:</span>
                            {geminiResponse.explanation}
                          </div>
                        )}

                        {/* Interactive Sliders/Inputs for Parameters */}
                        {geminiResponse.parameters && geminiResponse.parameters.length > 0 && (
                          <div className="space-y-2 bg-indigo-50/50 border border-indigo-100 rounded p-2.5">
                            <span className="text-[9px] font-black uppercase text-indigo-800 tracking-wider font-mono flex items-center gap-1">
                              <Sparkles size={10} className="text-indigo-500 animate-pulse" />
                              Parametri Dinamici (Tweak)
                            </span>
                            
                            <div className="space-y-1.5">
                              {geminiResponse.parameters.map((p, idx) => {
                                const currentVal = geminiParams[p.name] !== undefined ? geminiParams[p.name] : p.value;
                                return (
                                  <div key={idx} className="space-y-0.5">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-600">
                                      <span className="truncate max-w-[150px]">{p.label || p.name}</span>
                                      <span className="font-mono text-indigo-700 font-black bg-indigo-100/50 px-1.5 py-0.5 rounded text-[8.5px]">{currentVal}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={Math.max(1, Math.round(p.value * 0.2))}
                                        max={Math.round(p.value * 5)}
                                        value={currentVal}
                                        onChange={(e) => {
                                          const newVal = Number(e.target.value);
                                          const updated = { ...geminiParams, [p.name]: newVal };
                                          setGeminiParams(updated);
                                          
                                          // Immediately rewrite variable declaration inside DSL script
                                          const updatedScript = updateScriptVariables(geminiDslScript, updated);
                                          setGeminiDslScript(updatedScript);
                                        }}
                                        className="flex-1 accent-indigo-600 h-1 bg-neutral-300 rounded-lg appearance-none cursor-pointer"
                                      />
                                      <input
                                        type="number"
                                        value={currentVal}
                                        onChange={(e) => {
                                          const newVal = Number(e.target.value);
                                          const updated = { ...geminiParams, [p.name]: newVal };
                                          setGeminiParams(updated);
                                          
                                          // Immediately rewrite variable declaration
                                          const updatedScript = updateScriptVariables(geminiDslScript, updated);
                                          setGeminiDslScript(updatedScript);
                                        }}
                                        className="w-12 bg-white border border-neutral-300 rounded text-center text-[10px] font-bold py-0.5 outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Interactive Script Text Area */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-mono">
                              Codice Disegno (DSL)
                            </label>
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold uppercase font-mono px-1.5 rounded">
                              Modificabile!
                            </span>
                          </div>
                          
                          <textarea
                            className="w-full bg-slate-900 text-emerald-400 text-[10px] leading-tight font-mono rounded p-2 min-h-[140px] focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-inner border border-slate-700"
                            value={geminiDslScript}
                            onChange={(e) => setGeminiDslScript(e.target.value)}
                            spellCheck={false}
                          />
                        </div>

                        {/* Insertion offset */}
                        <div className="space-y-1 bg-neutral-50 rounded p-2 border border-neutral-200">
                          <label className="text-[9px] font-black uppercase text-neutral-400 tracking-widest block font-mono mb-1">
                            Punto di Inserimento (X, Y)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded px-1.5 py-0.5">
                              <span className="text-[9px] text-neutral-400 font-bold font-mono">X:</span>
                              <input
                                type="number"
                                className="w-full text-xs font-bold outline-none border-none p-0 bg-transparent text-neutral-800"
                                value={geminiInsertX}
                                onChange={(e) => setGeminiInsertX(Number(e.target.value))}
                              />
                            </div>
                            <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded px-1.5 py-0.5">
                              <span className="text-[9px] text-neutral-400 font-bold font-mono">Y:</span>
                              <input
                                type="number"
                                className="w-full text-xs font-bold outline-none border-none p-0 bg-transparent text-neutral-800"
                                value={geminiInsertY}
                                onChange={(e) => setGeminiInsertY(Number(e.target.value))}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Apply Drawing Button */}
                        <button
                          onClick={handleImportGemini}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-widest rounded-md flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                        >
                          <Check size={14} />
                          <span>Importa nel Disegno</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeSidebarTab === "testo" ? (
                <div className="space-y-6">
                  {selectedEntity && selectedEntity.type === 'text' ? (
                     <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 p-3 rounded-lg shadow-sm">
                       <p className="text-[10px] leading-tight font-mono font-bold">
                         MODIFICA TESTO SELEZIONATO
                       </p>
                     </div>
                  ) : (
                     <div className="bg-neutral-800 text-neutral-100 p-3 rounded-lg shadow-lg border border-neutral-700">
                       <p className="text-[10px] leading-tight font-mono opacity-80">
                         <span className="text-amber-400 font-bold">INSERIMENTO TESTO:</span><br/>
                         Seleziona lo strumento Testo e clicca nell'area di lavoro.
                       </p>
                     </div>
                  )}
                  
                  <div className="space-y-4">
                    {selectedEntity && selectedEntity.type === 'text' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Contenuto Testo</label>
                          <textarea 
                            className="w-full bg-white border border-neutral-300 text-xs rounded p-2 focus:ring-2 focus:ring-indigo-500"
                            rows={3}
                            value={(selectedEntity as import('./types').TextEntity).text}
                            onChange={(e) => updateEntity(selectedEntity.id, { text: e.target.value })}
                          />
                        </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Famiglia Carattere</label>
                      <select 
                        className="w-full bg-white border border-neutral-300 text-xs rounded p-2 font-semibold"
                        value={selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).fontFamily : defaultTextStyle.fontFamily}
                        onChange={(e) => {
                            if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { fontFamily: e.target.value });
                            else setDefaultTextStyle(prev => ({ ...prev, fontFamily: e.target.value }));
                        }}
                      >
                        <option value="sans-serif">Sans Serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Grandezza Testo</label>
                       <input 
                         type="number"
                         min="8"
                         max="144"
                         className="w-full bg-white border border-neutral-300 text-xs rounded p-2 font-semibold text-center"
                         value={selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).fontSize : defaultTextStyle.fontSize}
                         onChange={(e) => {
                             if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { fontSize: Number(e.target.value) });
                             else setDefaultTextStyle(prev => ({ ...prev, fontSize: Number(e.target.value) }));
                         }}
                       />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Stile (Grassetto)</label>
                      <div className="flex gap-2">
                         <button 
                           onClick={() => {
                               if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { fontWeight: 'normal' });
                               else setDefaultTextStyle(prev => ({ ...prev, fontWeight: 'normal' }));
                           }}
                           className={`flex-1 p-2 border rounded text-xs transition-all ${(selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).fontWeight : defaultTextStyle.fontWeight) === 'normal' ? 'bg-indigo-600 text-white font-bold' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                         >Normale</button>
                         <button 
                           onClick={() => {
                               if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { fontWeight: 'bold' });
                               else setDefaultTextStyle(prev => ({ ...prev, fontWeight: 'bold' }));
                           }}
                           className={`flex-1 p-2 border rounded text-xs transition-all ${(selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).fontWeight : defaultTextStyle.fontWeight) === 'bold' ? 'bg-indigo-600 text-white font-bold' : 'bg-neutral-50 hover:bg-neutral-100 font-bold'}`}
                         >Grassetto</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Allineamento</label>
                      <div className="flex gap-2">
                         {['left', 'center', 'right', 'justify'].map((align) => (
                           <button 
                             key={align}
                             onClick={() => {
                                 if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { textAlign: align as any });
                                 else setDefaultTextStyle(prev => ({ ...prev, textAlign: align as any }));
                             }}
                             className={`flex-1 p-2 border rounded text-xs transition-all flex justify-center items-center ${(selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).textAlign : defaultTextStyle.textAlign) === align ? 'bg-indigo-600 text-white' : 'bg-neutral-50 hover:bg-neutral-100'}`}
                           >
                              {align === 'left' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>}
                              {align === 'center' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line></svg>}
                              {align === 'right' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>}
                              {align === 'justify' && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line></svg>}
                           </button>
                         ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">Colore Testo</label>
                       <div className="grid grid-cols-5 gap-2">
                         {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'].map((c) => {
                             const isSelected = selectedEntity && selectedEntity.type === 'text' ? (selectedEntity as import('./types').TextEntity).color === c : defaultLineStyle.color === c;
                             return (
                               <button
                                 key={c}
                                 onClick={() => {
                                     if (selectedEntity && selectedEntity.type === 'text') updateEntity(selectedEntity.id, { color: c });
                                     else setDefaultLineStyle(prev => ({ ...prev, color: c }));
                                 }}
                                 className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform ${isSelected ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md" : "hover:scale-105 border border-black/10"}`}
                                 style={{ backgroundColor: c }}
                               >
                                 {isSelected && <Check size={10} className="text-white drop-shadow-md" />}
                               </button>
                             );
                         })}
                       </div>
                    </div>
                  </div>
                </div>
              ) : activeSidebarTab === "penne" ? (
                <div className="space-y-6">
                  {selectedEntity ? (
                    selectedEntity.type === "hatch" ? (
                    <div className="space-y-4 font-sans">
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg shadow-sm">
                        <p className="text-[10px] leading-tight font-mono font-bold uppercase">
                          ⚙️ MODIFICA RIEMPIMENTO (HATCH)
                        </p>
                      </div>
                      
                      {/* Pattern Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Stile Retino (Pattern)</label>
                        <select
                          className="w-full bg-white border border-neutral-300 text-xs rounded p-2 font-semibold capitalize focus:ring-2 focus:ring-indigo-500"
                          value={(selectedEntity as any).pattern || 'ANSI31'}
                          onChange={(e) => updateEntity(selectedEntity.id, { pattern: e.target.value })}
                        >
                          <option value="Solid">Pieno (Solid)</option>
                          <option value="ANSI31">ANSI31 (Obliquo Semplice)</option>
                          <option value="ANSI32">ANSI32 (Obliquo Doppio)</option>
                          <option value="ANSI33">ANSI33 (Dashed/Solid Obliquo)</option>
                          <option value="ANSI34">ANSI34 (Obliquo Tratteggiato)</option>
                          <option value="Grid">Griglia (Quadrettato)</option>
                          <option value="Cross">Incrocio (Griglia 45°)</option>
                          <option value="Stripe">Strisce Verticali</option>
                          <option value="Horizontal">Strisce Orizzontali</option>
                          <option value="Zigzag">Zig-Zag</option>
                          <option value="Waves">Onde</option>
                          <option value="Brick">Mattoni CAD</option>
                          <option value="Checker">Scacchiera (Checker)</option>
                          <option value="Triangles">Triangoli</option>
                          <option value="Honey">Nido d'ape (Honey)</option>
                          <option value="Gravel">Ghiaia (Pebbles)</option>
                          <option value="Cobble">Ciottolato (Cobble)</option>
                          <option value="Plaid">Tartan (Plaid)</option>
                          <option value="Stars">Stelle</option>
                          <option value="Basket">Basket Weave</option>
                        </select>
                      </div>
                      
                      {/* Scale Slider / Input */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Dimensione / Scala</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).scale || 15}</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="180"
                          step="1"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={(selectedEntity as any).scale || 15}
                          onChange={(e) => updateEntity(selectedEntity.id, { scale: Number(e.target.value) })}
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="2"
                            max="500"
                            className="w-full bg-white border border-neutral-300 text-xs rounded p-1.5 text-center font-mono font-semibold"
                            value={(selectedEntity as any).scale || 15}
                            onChange={(e) => updateEntity(selectedEntity.id, { scale: Math.max(2, Number(e.target.value)) })}
                          />
                        </div>
                      </div>

                      {/* Angle Slider / Input */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Inclinazione Retino (°)</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).angle || 0}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={(selectedEntity as any).angle || 0}
                          onChange={(e) => updateEntity(selectedEntity.id, { angle: Number(e.target.value) })}
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="360"
                            className="w-full bg-white border border-neutral-300 text-xs rounded p-1.5 text-center font-mono font-semibold"
                            value={(selectedEntity as any).angle || 0}
                            onChange={(e) => updateEntity(selectedEntity.id, { angle: Number(e.target.value) % 360 })}
                          />
                        </div>
                      </div>

                      {/* Color selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Colore del Retino</label>
                        <div className="grid grid-cols-5 gap-2 mt-2">
                          {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'].map((c) => (
                            <button
                              key={c}
                              onClick={() => updateEntity(selectedEntity.id, { color: c })}
                              className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform ${selectedEntity.color === c ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md" : "hover:scale-105 border border-black/10"}`}
                              style={{ backgroundColor: c }}
                            >
                              {selectedEntity.color === c && <Check size={10} className="text-white drop-shadow-md" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sfumatura (Radial Gradient) Slider */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Sfumatura (Gradiente)</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).sfumatura || 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={(selectedEntity as any).sfumatura || 0}
                          onChange={(e) => updateEntity(selectedEntity.id, { sfumatura: Number(e.target.value) })}
                        />
                        <p className="text-[9px] text-neutral-400 leading-tight">Crea una sfumatura radiale dal centro (ideale per riempimenti solidi)</p>
                      </div>
                    </div>
                  ) : selectedEntity.type === "image" ? (
                    <div className="space-y-4 font-sans">
                      <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-lg shadow-sm">
                        <p className="text-[10px] leading-tight font-mono font-bold uppercase">
                          🖼️ MODIFICA IMMAGINE
                        </p>
                      </div>
                      
                      {/* Scale / Width Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Larghezza</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{Math.round((selectedEntity as any).width || 100)}</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="2000"
                          step="10"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={(selectedEntity as any).width || 100}
                          onChange={(e) => {
                            const newW = Number(e.target.value);
                            const ar = (selectedEntity as any).aspectRatio || 1;
                            updateEntity(selectedEntity.id, { width: newW, height: newW / ar });
                          }}
                        />
                      </div>

                      {/* Angle Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Rotazione (°)</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).angle || 0}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={(selectedEntity as any).angle || 0}
                          onChange={(e) => updateEntity(selectedEntity.id, { angle: Number(e.target.value) })}
                        />
                      </div>

                      {/* Opacity Slider */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Opacità (%)</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{Math.round(((selectedEntity as any).opacity ?? 1) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="1"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          value={Math.round(((selectedEntity as any).opacity ?? 1) * 100)}
                          onChange={(e) => updateEntity(selectedEntity.id, { opacity: Number(e.target.value) / 100 })}
                        />
                        <p className="text-[9px] text-neutral-400 leading-tight">Regola la trasparenza per ricalcare o posizionare sfondi</p>
                      </div>

                      {/* Brightness / Contrast */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Luminosità</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).brightness ?? 100}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          step="5"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          value={(selectedEntity as any).brightness ?? 100}
                          onChange={(e) => updateEntity(selectedEntity.id, { brightness: Number(e.target.value) })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Contrasto</label>
                          <span className="text-[10px] font-mono font-bold text-neutral-600">{(selectedEntity as any).contrast ?? 100}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          step="5"
                          className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          value={(selectedEntity as any).contrast ?? 100}
                          onChange={(e) => updateEntity(selectedEntity.id, { contrast: Number(e.target.value) })}
                        />
                      </div>

                      {/* Ritaglio (Crop) */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                        <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans mb-1">Ritaglia Immagine (%)</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between items-center bg-neutral-50 px-2 py-1 border border-neutral-200 rounded">
                            <span className="text-[9px] text-neutral-500 uppercase tracking-wide">← Sinistra</span>
                            <input
                              type="number" min="0" max="90" step="1"
                              className="w-10 text-right text-[10px] bg-transparent outline-none font-mono"
                              value={(selectedEntity as any).crop?.left || 0}
                              onChange={(e) => updateEntity(selectedEntity.id, { crop: { ...(selectedEntity as any).crop, left: Math.min(90, Math.max(0, Number(e.target.value))) } })}
                            />
                          </div>
                          <div className="flex justify-between items-center bg-neutral-50 px-2 py-1 border border-neutral-200 rounded">
                            <span className="text-[9px] text-neutral-500 uppercase tracking-wide">Destra →</span>
                            <input
                              type="number" min="0" max="90" step="1"
                              className="w-10 text-right text-[10px] bg-transparent outline-none font-mono"
                              value={(selectedEntity as any).crop?.right || 0}
                              onChange={(e) => updateEntity(selectedEntity.id, { crop: { ...(selectedEntity as any).crop, right: Math.min(90, Math.max(0, Number(e.target.value))) } })}
                            />
                          </div>
                          <div className="flex justify-between items-center bg-neutral-50 px-2 py-1 border border-neutral-200 rounded">
                            <span className="text-[9px] text-neutral-500 uppercase tracking-wide">↑ Sopra</span>
                            <input
                              type="number" min="0" max="90" step="1"
                              className="w-10 text-right text-[10px] bg-transparent outline-none font-mono"
                              value={(selectedEntity as any).crop?.top || 0}
                              onChange={(e) => updateEntity(selectedEntity.id, { crop: { ...(selectedEntity as any).crop, top: Math.min(90, Math.max(0, Number(e.target.value))) } })}
                            />
                          </div>
                          <div className="flex justify-between items-center bg-neutral-50 px-2 py-1 border border-neutral-200 rounded">
                            <span className="text-[9px] text-neutral-500 uppercase tracking-wide">Sotto ↓</span>
                            <input
                              type="number" min="0" max="90" step="1"
                              className="w-10 text-right text-[10px] bg-transparent outline-none font-mono"
                              value={(selectedEntity as any).crop?.bottom || 0}
                              onChange={(e) => updateEntity(selectedEntity.id, { crop: { ...(selectedEntity as any).crop, bottom: Math.min(90, Math.max(0, Number(e.target.value))) } })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Blend Mode Toggle */}
                      <div className="pt-2 border-t border-neutral-100">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={(selectedEntity as any).blendMode === 'multiply'}
                              onChange={(e) => updateEntity(selectedEntity.id, { blendMode: e.target.checked ? 'multiply' : 'normal' })}
                              className="peer sr-only"
                            />
                            <div className="w-8 h-4 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-neutral-700 block transition-colors group-hover:text-blue-700">Rendi Sfondo Trasparente</span>
                            <span className="text-[9px] text-neutral-400 block leading-tight mt-0.5">Applica fusione Moltiplica (il bianco scompare)</span>
                          </div>
                        </label>
                      </div>

                      {/* Convert to CAD Vectors */}
                      <div className="pt-3 border-t border-neutral-100 space-y-3">
                        <div className="bg-orange-50 border border-orange-200 p-2 rounded-lg space-y-2">
                          <p className="text-[10px] uppercase font-bold text-orange-800 tracking-wider flex items-center gap-1"><Sparkles size={12}/> Vettorializzazione Avanzata</p>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-bold text-orange-900 block font-sans">Risoluzione Tracciato</label>
                              <span className="text-[9px] font-mono text-orange-800">{(selectedEntity as any).traceResolution || 1500}px</span>
                            </div>
                            <input
                              type="range" min="500" max="2500" step="100"
                              className="w-full h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                              value={(selectedEntity as any).traceResolution || 1500}
                              onChange={(e) => updateEntity(selectedEntity.id, { traceResolution: Number(e.target.value) })}
                            />
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[9px] font-bold text-orange-900 block font-sans">Semplificazione Linee</label>
                              <span className="text-[9px] font-mono text-orange-800">{(selectedEntity as any).traceSimplify ?? 0.5}</span>
                            </div>
                            <input
                              type="range" min="0.1" max="5.0" step="0.1"
                              className="w-full h-1 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                              value={(selectedEntity as any).traceSimplify ?? 0.5}
                              onChange={(e) => updateEntity(selectedEntity.id, { traceSimplify: Number(e.target.value) })}
                            />
                            <p className="text-[8px] text-orange-700 leading-tight">Meno semplificazione (sinistra) = più dettagli e angoli esatti.</p>
                          </div>

                          <div className="pt-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <div className="relative flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={(selectedEntity as any).traceSmooth ?? false}
                                  onChange={(e) => updateEntity(selectedEntity.id, { traceSmooth: e.target.checked })}
                                  className="peer sr-only"
                                />
                                <div className="w-8 h-4 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-orange-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-600"></div>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-orange-900 block font-sans transition-colors group-hover:text-orange-700">Ammorbidisci Contorni (Smooth)</span>
                                <span className="text-[8px] text-orange-700 block leading-tight mt-0.5">Disabilitalo per piante architettoniche con angoli retti.</span>
                              </div>
                            </label>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const img = selectedEntity as any;
                            const imgElement = document.createElement('img');
                            imgElement.crossOrigin = 'anonymous';
                            imgElement.src = img.src;
                            imgElement.onload = () => {
                              const maxDim = img.traceResolution || 1500; // max resolution for tracing
                              const w = imgElement.naturalWidth;
                              const h = imgElement.naturalHeight;
                              const scaleToFit = Math.min(1, maxDim / Math.max(w, h));
                              
                              const traceW = Math.max(1, Math.floor(w * scaleToFit));
                              const traceH = Math.max(1, Math.floor(h * scaleToFit));
                              
                              const cvs = document.createElement('canvas');
                              cvs.width = traceW;
                              cvs.height = traceH;
                              const cx = cvs.getContext('2d');
                              if (!cx) return;
                              
                              // Handle cropping
                              const left = (img.crop?.left || 0) / 100;
                              const top = (img.crop?.top || 0) / 100;
                              const right = (img.crop?.right || 0) / 100;
                              const bottom = (img.crop?.bottom || 0) / 100;
                              
                              const sx = left * w;
                              const sy = top * h;
                              const sw = w * (1 - left - right);
                              const sh = h * (1 - top - bottom);
                              
                              if (sw <= 0 || sh <= 0) return;

                              // Apply Brightness / Contrast during drawing so it affects trace
                              let filters = [];
                              if (img.brightness !== undefined) filters.push(`brightness(${img.brightness}%)`);
                              if (img.contrast !== undefined) filters.push(`contrast(${img.contrast}%)`);
                              if (filters.length > 0) {
                                cx.filter = filters.join(' ');
                              }
                              
                              cx.drawImage(imgElement, sx, sy, sw, sh, 0, 0, traceW, traceH);
                              const idata = cx.getImageData(0, 0, traceW, traceH);
                              const data = idata.data;
                              
                              const values = new Float32Array(traceW * traceH);
                              for (let i = 0; i < traceW * traceH; i++) {
                                const r = data[i*4];
                                const g = data[i*4 + 1];
                                const b = data[i*4 + 2];
                                const a = data[i*4 + 3];

                                if (img.blendMode === 'multiply') {
                                  // Trasparenza in bianco (moltiplica). Il disegno è dove i pixel sono scuri.
                                  const brightness = (r + g + b) / 3;
                                  values[i] = 1 - (brightness / 255);
                                } else {
                                  // Se non usa la moltiplica, guardiamo l'alpha o il pixel non bianco
                                  if (a < 50) {
                                    values[i] = 0;
                                  } else {
                                    const brightness = (r + g + b) / 3;
                                    values[i] = 1 - (brightness / 255);
                                  }
                                }
                              }
                              
                              // We use 0.5 threshold to find boundaries
                              const isSmooth = img.traceSmooth ?? false;
                              const geoms = contours().size([traceW, traceH]).smooth(isSmooth).thresholds([0.5])(values);
                              
                              const newEntities: Entity[] = [];
                              const baseId = `cad-svg-${Date.now()}`;
                              const imgRenderW = img.width * (1 - left - right);
                              const imgRenderH = img.height * (1 - top - bottom);

                              const entScaleX = imgRenderW / traceW;
                              const entScaleY = imgRenderH / traceH;
                              
                              const angleRad = (img.angle || 0) * Math.PI / 180;
                              const cosA = Math.cos(angleRad);
                              const sinA = Math.sin(angleRad);
                              
                              // Center of original image placement
                              // The image is rendered from -img.width/2 to img.width/2 in its local space.
                              // Wait, the CADCanvas rendering logic:
                              // cx = img.point.x + img.width / 2;
                              // cy = img.point.y + img.height / 2;
                              // dx = -img.width / 2 + img.width * left;
                              // dy = -img.height / 2 + img.height * top;
                              
                              const centerX = img.point.x + img.width / 2;
                              const centerY = img.point.y + img.height / 2;
                              const offsetX = -img.width / 2 + img.width * left;
                              const offsetY = -img.height / 2 + img.height * top;

                              let eCount = 0;
                              
                              for (const contour of geoms) {
                                  if (!contour.coordinates || contour.coordinates.length === 0) continue;
                                  for (const polygon of contour.coordinates) {
                                      for (const ring of polygon) {
                                          if (ring.length < 3) continue;

                                          // Convert ring coordinates into full CAD point coords
                                          const pts = ring.map(pt => {
                                              let p1x = pt[0] * entScaleX;
                                              let p1y = pt[1] * entScaleY;

                                              // add offset
                                              let relX = p1x + offsetX;
                                              let relY = p1y + offsetY;
                                              
                                              // rotation
                                              let rotX = relX * cosA - relY * sinA;
                                              let rotY = relX * sinA + relY * cosA;
                                              
                                              return { x: centerX + rotX, y: centerY + rotY };
                                          });

                                          // Simplify
                                          const simplified = simplifyPoints(pts, img.traceSimplify ?? 0.5);
                                          if (simplified.length < 2) continue;

                                          for (let i = 0; i < simplified.length - 1; i++) {
                                              newEntities.push({
                                                  type: 'line',
                                                  id: `${baseId}-${eCount++}`,
                                                  color: img.color || '#000000',
                                                  lineWidth: 1,
                                                  layer: img.layer || '0',
                                                  start: simplified[i],
                                                  end: simplified[i+1]
                                              });
                                          }
                                      }
                                  }
                              }

                              if (newEntities.length > 0) {
                                  setEntities(prev => {
                                      const next = prev.filter(e => e.id !== img.id).concat(newEntities);
                                      commitToHistory(next);
                                      return next;
                                  });
                                  setSelectedId(null);
                                  setShortcutToast(`Successo! Immagine convertita in ${newEntities.length} linee vettoriali!`);
                                  setTimeout(() => setShortcutToast(null), 4000);
                              } else {
                                  setShortcutToast(`Nessun tratto rilevato nell'immagine.`);
                                  setTimeout(() => setShortcutToast(null), 3000);
                              }
                            };
                          }}
                          className="w-full relative overflow-hidden group py-2 px-3 rounded-lg flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%] opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                          <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                          <span className="text-xs font-bold tracking-wide">Vettorializza in Linee CAD</span>
                        </button>
                        <p className="text-[9px] text-neutral-400 leading-tight mt-1.5 text-center">Trasforma l'immagine in tracce CAD in modo da poter usare la gomma o agganciare i punti.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm">
                        Tipo Strumento:
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() =>
                              updateEntity(selectedEntity.id, { mode: "pencil" })
                            }
                            className={`p-2 rounded flex-1 text-xs font-bold transition-all ${selectedEntity.mode === "pencil" ? "bg-amber-600 text-white" : "bg-neutral-200"}`}
                          >
                            Matita
                          </button>
                          <button
                            onClick={() =>
                              updateEntity(selectedEntity.id, { mode: "ink" })
                            }
                            className={`p-2 rounded flex-1 text-xs font-bold transition-all ${selectedEntity.mode === "ink" ? "bg-indigo-600 text-white" : "bg-neutral-200"}`}
                          >
                            Kina
                          </button>
                          <button
                            onClick={() =>
                              updateEntity(selectedEntity.id, { mode: "CAD" })
                            }
                            className={`p-2 rounded flex-1 text-xs font-bold transition-all ${selectedEntity.mode === "CAD" ? "bg-emerald-600 text-white" : "bg-neutral-200"}`}
                          >
                            CAD
                          </button>
                        </div>
                      </label>
                      <label className="block text-sm">
                        Pennino:
                        <div className="flex gap-2 mt-1">
                          {[1, 2.5, 4].map((w) => (
                            <button
                              key={w}
                              onClick={() =>
                                updateEntity(selectedEntity.id, { lineWidth: w })
                              }
                              className={`p-2 rounded flex-1 text-xs font-bold ${selectedEntity.lineWidth === w ? "bg-indigo-600 text-white" : "bg-neutral-200 text-neutral-900 border border-neutral-400"}`}
                            >
                              p{w === 1 ? '1' : w === 2.5 ? '2' : '4'} ({w} mm)
                            </button>
                          ))}
                        </div>
                      </label>
                      <label className="block text-sm mt-4">
                        Colore:
                        <div className="grid grid-cols-5 gap-2 mt-2">
                          {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'].map((c) => (
                            <button
                              key={c}
                              onClick={() => updateEntity(selectedEntity.id, { color: c })}
                              className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform ${selectedEntity.color === c ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md" : "hover:scale-105 border border-black/10"}`}
                              style={{ backgroundColor: c }}
                            >
                              {selectedEntity.color === c && <Check size={10} className="text-white drop-shadow-md" />}
                            </button>
                          ))}
                        </div>
                      </label>

                      {/* MISURE GEOMETRICHE CAD DEDICATE */}
                      {selectedEntity && ['line', 'rectangle', 'circle', 'arc', 'hatch'].includes(selectedEntity.type) && (
                        <div className="mt-4 border-t border-neutral-100 pt-3.5 space-y-2 font-sans text-neutral-800">
                          <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <Sliders size={12} className="text-indigo-600 animate-pulse" />
                            Misure Geometriche Elemento
                          </span>
                          {(() => {
                            const type = selectedEntity.type as string;
                            if (type === 'line') {
                              const line = selectedEntity as any;
                              const start = line.start || { x: 0, y: 0 };
                              const end = line.end || { x: 0, y: 0 };
                              const lengthCm = Math.hypot(end.x - start.x, end.y - start.y);
                              const lengthM = lengthCm / 100;
                              
                              return (
                                <div className="space-y-1.5 bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-xl">
                                  <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="text-neutral-500 font-semibold">Lunghezza Reale:</span>
                                    <span className="font-mono font-black text-indigo-950 text-[11px] bg-white border border-indigo-100 px-2 py-0.5 rounded">
                                      {lengthCm.toFixed(1)} cm / {lengthM.toFixed(3)} m
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-indigo-50/50 text-[9px]">
                                    <div className="flex justify-between">
                                      <span className="text-neutral-400 font-mono">X1: {start.x.toFixed(0)}</span>
                                      <span className="text-neutral-400 font-mono">Y1: {start.y.toFixed(0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-400 font-mono">X2: {end.x.toFixed(0)}</span>
                                      <span className="text-neutral-400 font-mono">Y2: {end.y.toFixed(0)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            if (type === 'rectangle') {
                              const rect = selectedEntity as any;
                              const p1 = rect.p1 || { x: 0, y: 0 };
                              const p2 = rect.p2 || { x: 0, y: 0 };
                              const w = Math.abs(p2.x - p1.x);
                              const h = Math.abs(p2.y - p1.y);
                              
                              const areaSqCm = w * h;
                              const areaSqM = areaSqCm / 10000;
                              const perimeterCm = 2 * (w + h);
                              const perimeterM = perimeterCm / 100;
                              
                              return (
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 border border-neutral-200/50 p-2.5 rounded-xl">
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Superficie Base</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{areaSqM.toFixed(3)} mq</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Perimetro</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{perimeterM.toFixed(2)} m</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100 col-span-2 flex justify-between items-center px-2 py-1.5 align-middle">
                                    <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Dimensioni Lati</span>
                                    <span className="font-mono font-black text-indigo-700 text-[10.5px]">{w.toFixed(1)} × {h.toFixed(1)} cm</span>
                                  </div>
                                </div>
                              );
                            }
                            if (type === 'circle') {
                              const circle = selectedEntity as any;
                              const r = circle.radius || 0;
                              const d = 2 * r;
                              const circCm = 2 * Math.PI * r;
                              const circM = circCm / 100;
                              const areaSqCm = Math.PI * r * r;
                              const areaSqM = areaSqCm / 10000;
                              
                              return (
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 border border-neutral-200/50 p-2.5 rounded-xl">
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Superficie Area</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{areaSqM.toFixed(3)} mq</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Circonferenza</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{circM.toFixed(2)} m</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100 flex justify-between items-center col-span-2 px-2 py-1">
                                    <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Raggio</span>
                                    <span className="font-mono font-black text-indigo-700 text-[10.5px]">{r.toFixed(1)} cm</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100 flex justify-between items-center col-span-2 px-2 py-1">
                                    <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Diametro</span>
                                    <span className="font-mono font-black text-indigo-700 text-[10.5px]">{d.toFixed(1)} cm</span>
                                  </div>
                                </div>
                              );
                            }
                            if (type === 'arc') {
                              const arc = selectedEntity as any;
                              const r = arc.radius || 0;
                              const spanAng = Math.abs(arc.endAngle - arc.startAngle) || 0;
                              const arcLenCm = r * spanAng * Math.PI / 180;
                              const arcLenM = arcLenCm / 100;
                              
                              return (
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 border border-neutral-200/50 p-2.5 rounded-xl">
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider font-sans">Sviluppo Arco</span>
                                    <span className="font-mono font-black text-indigo-750 text-[10.5px]">{arcLenM.toFixed(3)} m</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider font-sans">Apertura Angolo</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{spanAng.toFixed(1)}°</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100 flex justify-between items-center col-span-2 px-2 py-1">
                                    <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Raggio dell'Arco</span>
                                    <span className="font-mono font-black text-indigo-700 text-[10.5px]">{r.toFixed(1)} cm</span>
                                  </div>
                                </div>
                              );
                            }
                            if (type === 'hatch') {
                              const hatch = selectedEntity as any;
                              const pts = hatch.points || [];
                              
                              let area = 0;
                              const len = pts.length;
                              for (let i = 0; i < len; i++) {
                                const p1 = pts[i];
                                const p2 = pts[(i + 1) % len];
                                area += p1.x * p2.y - p2.x * p1.y;
                              }
                              const areaSqM = Math.abs(area) / 20000;
                              
                              let perimeter = 0;
                              for (let i = 0; i < len; i++) {
                                const p = pts[i];
                                const nextP = pts[(i + 1) % len];
                                perimeter += Math.sqrt((nextP.x - p.x)**2 + (nextP.y - p.y)**2);
                              }
                              const perimeterM = perimeter / 100;
                              
                              return (
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 border border-neutral-200/50 p-2.5 rounded-xl">
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Superficie Campitura</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{areaSqM.toFixed(3)} mq</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100">
                                    <span className="block text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Perimetro</span>
                                    <span className="font-mono font-black text-neutral-800 text-[10.5px]">{perimeterM.toFixed(2)} m</span>
                                  </div>
                                  <div className="bg-white p-2 rounded-lg border border-neutral-100 flex justify-between items-center col-span-2 px-2 py-1">
                                    <span className="text-[7.5px] text-neutral-400 font-extrabold uppercase tracking-wider">Numero Vertici</span>
                                    <span className="font-mono font-black text-indigo-700 text-[10.5px]">{len} punti</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {selectedEntity.type === "dimension" && (
                        <div className="space-y-4 pt-2 border-t border-neutral-100 font-sans">
                          {/* Testo Personalizzato */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest block">
                              Testo Personalizzato
                            </label>
                            <input
                              type="text"
                              value={(selectedEntity as any).customText || ""}
                              placeholder="Default (Misurato)"
                              onChange={(e) =>
                                updateEntity(selectedEntity.id, {
                                  customText: e.target.value,
                                })
                              }
                              className="w-full bg-neutral-100 border border-neutral-200 text-xs rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-neutral-800"
                            />
                          </div>

                          {/* Scala Locale */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">
                                Scala Quota Locale
                              </label>
                              <span className="font-mono text-indigo-600 font-bold text-xs bg-indigo-50 px-1.5 py-0.5 rounded">
                                {((selectedEntity as any).scale ?? 1.0).toFixed(2)}x
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="5.0"
                              step="0.1"
                              value={(selectedEntity as any).scale ?? 1.0}
                              onChange={(e) =>
                                updateEntity(selectedEntity.id, {
                                  scale: parseFloat(e.target.value),
                                })
                              }
                              className="w-full h-1 accent-indigo-600 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Decimali Locale */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest block">
                              Precisione Decimali
                            </label>
                            <select
                              value={(selectedEntity as any).decimals ?? ""}
                              onChange={(e) =>
                                updateEntity(selectedEntity.id, {
                                  decimals: e.target.value === "" ? undefined : parseInt(e.target.value),
                                })
                              }
                              className="w-full bg-white border border-neutral-200 text-xs rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-neutral-700"
                            >
                              <option value="">Eredita Globale</option>
                              <option value="0">0 (Nessun Decimale)</option>
                              <option value="1">1 Decimale</option>
                              <option value="2">2 Decimali</option>
                              <option value="3">3 Decimali</option>
                              <option value="4">4 Decimali</option>
                            </select>
                          </div>

                          {/* Tipo Orientamento Quota */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-widest block">
                              Orientamento Quota
                            </label>
                            <select
                              value={(selectedEntity as any).style ?? 1}
                              onChange={(e) =>
                                updateEntity(selectedEntity.id, {
                                  style: parseInt(e.target.value),
                                })
                              }
                              className="w-full bg-white border border-neutral-200 text-xs rounded p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold text-neutral-700"
                            >
                              <option value={1}>Lineare (Auto)</option>
                              <option value={2}>Allineata</option>
                              <option value={3}>Verticale Constrained</option>
                              <option value={4}>Orizzontale Constrained</option>
                              <option value={5}>Auto Orto</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </>
                  )) : (
                    <>
                      {selectedTool === 'Hatch' ? (
                      <div className="space-y-4">
                        <div className="bg-emerald-950 border border-emerald-800 text-emerald-100 p-4 rounded-xl shadow-lg">
                          <p className="text-xs leading-normal font-sans">
                            <span className="text-emerald-400 font-extrabold block mb-2 text-[10px] font-mono tracking-widest uppercase">✨ RIEMPIMENTO (HATCH):</span>
                            Clicca in un qualsiasi punto interno a un'area chiusa per riempirla automaticamente con un retino geometrico (Hatch).
                          </p>
                          <div className="mt-3 text-[10px] text-emerald-300 font-medium space-y-2 pr-1">
                            <div>• I contorni esterni devono intersecarsi o toccarsi completamente.</div>
                          </div>
                        </div>

                        {/* Default Hatch Settings */}
                        <div className="space-y-4 pt-2 border-t border-neutral-100">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Impostazioni Predefinite</p>
                          
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Stile Retino (Pattern)</label>
                            <select
                              className="w-full bg-white border border-neutral-300 text-xs rounded p-2 font-semibold capitalize"
                              value={defaultHatchStyle.pattern}
                              onChange={(e) => setDefaultHatchStyle(prev => ({ ...prev, pattern: e.target.value }))}
                            >
                              <option value="Solid">Pieno (Solid)</option>
                              <option value="ANSI31">ANSI31 (Obliquo Semplice)</option>
                              <option value="ANSI32">ANSI32 (Obliquo Doppio)</option>
                              <option value="ANSI33">ANSI33 (Dashed/Solid Obliquo)</option>
                              <option value="ANSI34">ANSI34 (Obliquo Tratteggiato)</option>
                              <option value="Grid">Griglia (Quadrettato)</option>
                              <option value="Cross">Incrocio (Griglia 45°)</option>
                              <option value="Stripe">Strisce Verticali</option>
                              <option value="Horizontal">Strisce Orizzontali</option>
                              <option value="Zigzag">Zig-Zag</option>
                              <option value="Brick">Mattoni CAD</option>
                              <option value="Checker">Scacchiera (Checker)</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Scala Retino</label>
                              <span className="text-[10px] font-mono font-bold text-neutral-600">{defaultHatchStyle.scale}</span>
                            </div>
                            <input
                              type="range"
                              min="4"
                              max="180"
                              step="1"
                              className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              value={defaultHatchStyle.scale}
                              onChange={(e) => setDefaultHatchStyle(prev => ({ ...prev, scale: Number(e.target.value) }))}
                            />
                          </div>

                          <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block">Inclinazione (°)</label>
                                <span className="text-[10px] font-mono font-bold text-neutral-600">{defaultHatchStyle.angle}°</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="360"
                                step="1"
                                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={defaultHatchStyle.angle}
                                onChange={(e) => setDefaultHatchStyle(prev => ({ ...prev, angle: Number(e.target.value) }))}
                              />
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Sfumatura Predefinita</label>
                                <span className="text-[10px] font-mono font-bold text-neutral-600">{(defaultHatchStyle as any).sfumatura || 0}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                value={(defaultHatchStyle as any).sfumatura || 0}
                                onChange={(e) => setDefaultHatchStyle(prev => ({ ...prev, sfumatura: Number(e.target.value) }))}
                              />
                              <p className="text-[9px] text-neutral-400 leading-tight">I nuovi riempimenti solidi useranno questa sfumatura</p>
                            </div>
                          </div>
                        </div>
                    ) : selectedTool === 'Specchio' ? (
                      <div className="bg-indigo-950 border border-indigo-800 text-indigo-100 p-4 rounded-xl shadow-lg">
                        <p className="text-xs leading-normal font-sans">
                          <span className="text-indigo-400 font-extrabold block mb-2 text-[10px] font-mono tracking-widest uppercase">✨ SPECCHIO (MIRROR):</span>
                          Crea un asse di simmetria come un normale segmento... poi seleziona gli oggetti.
                        </p>
                      </div>
                    ) : selectedTool === 'Eraser' ? (
                      <div className="space-y-4">
                        <div className="bg-neutral-900 border border-neutral-800 text-white p-3.5 rounded-xl shadow-xs">
                          <p className="text-xs leading-normal font-sans mb-3">
                            <span className="text-amber-400 font-extrabold block mb-2 text-[10px] font-mono tracking-widest uppercase">✨ GOMME DI PRECISIONE:</span>
                            Entrambe le gomme hanno una punta sagomata ideale per cancellature di precisione assoluta.
                          </p>
                          <div className="bg-neutral-800/80 p-2.5 rounded-lg border border-neutral-700 space-y-1 text-[10px] text-neutral-300">
                            <div className="flex items-center gap-1.5 font-bold text-amber-300">
                              <MousePointer2 size={10} /> CLIC DESTRO SUL FOGLIO
                            </div>
                            <p className="font-sans leading-relaxed text-[9px]">Clicca col tasto destro del mouse sulla tavola da disegno per scambiare al volo le due gomme!</p>
                          </div>
                        </div>

                        {/* Switch Eraser Type Options in UI */}
                        <div className="space-y-4 pt-2 border-t border-neutral-100">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Tipo di Gomma Attiva</p>
                          <div className="space-y-2">
                            <button
                              onClick={() => setEraserType('pencil')}
                              className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${eraserType === 'pencil' ? 'bg-neutral-100 border-neutral-400 ring-2 ring-neutral-200' : 'bg-white border-neutral-200 hover:bg-neutral-50 shadow-xs'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded bg-neutral-200 border border-neutral-400 shadow-xs inline-block"></span>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${eraserType === 'pencil' ? 'text-neutral-800' : 'text-neutral-500'}`}>Matita (Bianca-Grigia)</span>
                              </div>
                              <span className="text-[9px] text-neutral-400 leading-normal">Cancella solo linee a matita dura/media/morbida. Non tocca la china.</span>
                            </button>

                            <button
                              onClick={() => setEraserType('all')}
                              className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${eraserType === 'all' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-100' : 'bg-white border-neutral-200 hover:bg-neutral-50 shadow-xs'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded bg-amber-400 border border-amber-600 shadow-xs inline-block"></span>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${eraserType === 'all' ? 'text-amber-800' : 'text-neutral-500'}`}>China/Tutto (Gialla)</span>
                              </div>
                              <span className="text-[9px] text-neutral-400 leading-normal">Cancella china, matita, testi, retini, quote e tutto il resto.</span>
                            </button>

                            <button
                              onClick={() => setEraserType('lametta')}
                              className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1 ${eraserType === 'lametta' ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-200' : 'bg-white border-neutral-200 hover:bg-neutral-50 shadow-xs'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-2.5 bg-slate-300 border border-slate-500 rounded-xs inline-block relative"></span>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${eraserType === 'lametta' ? 'text-slate-800' : 'text-neutral-500'}`}>Lametta Gillette (China e altro)</span>
                              </div>
                              <span className="text-[9px] text-neutral-400 leading-normal">La mitica lametta. Cancella all'istante solo sotto la punta sottile dello spigolo.</span>
                            </button>
                          </div>

                          {/* Eraser controls based on chosen type */}
                          {eraserType === 'lametta' ? (
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1">
                              <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-slate-400 animate-pulse"></span>
                                Caratteristiche Lametta
                              </p>
                              <p className="text-[9px] text-slate-500 leading-relaxed">
                                La lametta Gillette rimuove istantaneamente ogni genere di tratto sul punto esatto dello spigolo inclinato. <strong>Spessore (2.5px) e intensità di raschiatura sono costanti e preimpostati</strong> per un lavoro di sbarbatura d'epoca perfetto.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 pt-2 border-t border-neutral-100">
                              {/* Eraser radius slider */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Spessore Punta Gomma</label>
                                  <span className="text-[10px] font-mono font-bold text-neutral-600">{eraserRadius} mm (px)</span>
                                </div>
                                <input
                                  type="range"
                                  min="5"
                                  max="100"
                                  step="5"
                                  value={eraserRadius}
                                  onChange={(e) => setEraserRadius(Number(e.target.value))}
                                  className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 font-bold"
                                />
                                <p className="text-[9px] text-neutral-400 leading-tight">Larghezza dell'area di azione della gomma.</p>
                              </div>

                              {/* Eraser intensity slider */}
                              <div className="space-y-1.5 pt-2 border-t border-neutral-100/50">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block font-sans">Intensità Cancellazione (%)</label>
                                  <span className="text-[10px] font-mono font-bold text-neutral-600">{eraserIntensity}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  step="5"
                                  value={eraserIntensity}
                                  onChange={(e) => setEraserIntensity(Number(e.target.value))}
                                  className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 font-bold"
                                />
                                <p className="text-[9px] text-neutral-400 leading-tight">Opacità rimossa a ogni passaggio (sfumatura o cancellazione drastica).</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-neutral-800 text-neutral-100 p-3 rounded-lg shadow-lg border border-neutral-700">
                          <p className="text-[10px] leading-tight font-mono opacity-80">
                            <span className="text-amber-400 font-bold">PENNE TECNICHE:</span><br/>
                            Scegli lo spessore del pennino. Il layer viene aggiornato automaticamente in base alla selezione.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">
                               <Sparkles size={10} /> Stile Tecnico CAD
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {[0.25, 0.5, 1, 2].map(w => (
                                <button
                                  key={w}
                                  onClick={() => {
                                    setDefaultLineStyle({ mode: "CAD", color: '#000000', lineWidth: w, dashed: false });
                                    handleToolClick("Line");
                                  }}
                                  className={`p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${defaultLineStyle.mode === "CAD" && defaultLineStyle.lineWidth === w ? "bg-emerald-900 border-emerald-700 ring-4 ring-emerald-200 shadow-md transform -translate-y-0.5" : "bg-neutral-50 border-neutral-200 hover:bg-white"}`}
                                >
                                  <span className={`text-[10px] font-black ${defaultLineStyle.mode === "CAD" && defaultLineStyle.lineWidth === w ? "text-white" : "text-neutral-500"}`}>
                                    {w}
                                  </span>
                                  <span className="text-[8px] text-neutral-400">mm</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">
                               <PenTool size={10} /> Pennini Kina
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {[0.25, 0.5, 1, 2].map(w => (
                                <button
                                  key={w}
                                  onClick={() => {
                                    setDefaultLineStyle({ mode: "ink", color: '#000000', lineWidth: w, dashed: false });
                                    handleToolClick("Line");
                                  }}
                                  className={`p-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${defaultLineStyle.mode === "ink" && defaultLineStyle.lineWidth === w ? "bg-indigo-900 border-neutral-700 ring-4 ring-neutral-200 shadow-md transform -translate-y-0.5" : "bg-neutral-50 border-neutral-200 hover:bg-white"}`}
                                >
                                  <span className={`text-[10px] font-black ${defaultLineStyle.mode === "ink" && defaultLineStyle.lineWidth === w ? "text-white" : "text-neutral-500"}`}>
                                    {w}
                                  </span>
                                  <span className="text-[8px] text-neutral-400">mm</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">
                               <Pencil size={10} /> Matite di Grafite
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              {['2H', 'HB', '2B'].map(m => {
                                const color = m === '2H' ? '#bbbbbb' : (m === 'HB' ? '#444444' : '#111111');
                                const width = m === '2H' ? 1 : (m === 'HB' ? 2 : 3);
                                const isSelected = defaultLineStyle.mode === 'pencil' && defaultLineStyle.color === color;
                                return (
                                  <button
                                    key={m}
                                    onClick={() => {
                                      setDefaultLineStyle({ mode: "pencil", color, lineWidth: width, dashed: false });
                                      handleToolClick("Line");
                                    }}
                                    className={`p-2.5 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${isSelected ? "bg-amber-50 border-amber-300 ring-4 ring-amber-100 shadow-md transform -translate-y-0.5" : "bg-neutral-50 border-neutral-200 hover:bg-white"}`}
                                  >
                                    <span className={`text-[10px] font-black ${isSelected ? "text-amber-800" : "text-neutral-500"}`}>{m}</span>
                                    <span className="text-[8px] text-neutral-400">{m === '2H' ? 'Dura' : (m === 'HB' ? 'Media' : 'Morb.')}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2 mt-4">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest flex items-center gap-2">
                               <Crosshair size={10} /> Colore Matita
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                              {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => {
                                    setDefaultLineStyle(prev => ({ ...prev, color: c }));
                                    handleToolClick("Line");
                                  }}
                                  className={`w-full aspect-square rounded-full flex items-center justify-center transition-transform ${defaultLineStyle.color === c ? "ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md" : "hover:scale-105 border border-black/10"}`}
                                  style={{ backgroundColor: c }}
                                >
                                  {defaultLineStyle.color === c && <Check size={10} className="text-white drop-shadow-md" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : activeSidebarTab === "layers" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-200">
                        <h4 className="text-[10px] font-black text-neutral-800 uppercase tracking-wider font-mono">
                          Gestione Layers
                        </h4>
                        <button 
                          onClick={() => {
                             const newId = `Layer ${layers.length}`;
                             setLayers([...layers, { id: newId, name: newId, visible: true, frozen: false }]);
                             setActiveLayerId(newId);
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors"
                          title="Nuovo Layer"
                        >
                          <Plus size={14} />
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                        {layers.map((l) => (
                          <div
                            key={l.id}
                            className={`flex items-center gap-1 p-1.5 rounded-lg border transition-all ${activeLayerId === l.id ? "bg-white border-indigo-300 shadow-sm ring-1 ring-indigo-100" : "bg-neutral-50/50 border-neutral-200/60 hover:bg-white hover:border-neutral-300"}`}
                          >
                            <div className="flex-1 px-2 py-1 flex items-center min-w-0">
                              {editingLayerId === l.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  className="w-full text-xs border border-indigo-300 rounded px-1 outline-none font-bold text-indigo-700"
                                  value={l.name}
                                  onChange={(e) => setLayers(layers.map((layer) => layer.id === l.id ? { ...layer, name: e.target.value } : layer))}
                                  onBlur={() => setEditingLayerId(null)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingLayerId(null); }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <button 
                                  onClick={() => setActiveLayerId(l.id)}
                                  className={`flex-1 text-left truncate focus:outline-none flex flex-col items-start ${activeLayerId === l.id ? "text-indigo-700 font-bold" : "text-neutral-600 font-semibold"}`}
                                  title="Imposta come corrente. Doppio click per rinominare."
                                  onDoubleClick={() => setEditingLayerId(l.id)}
                                >
                                  <span className="truncate w-full">{l.name}</span>
                                  {activeLayerId === l.id && <span className="block text-[8px] uppercase tracking-wider text-indigo-400 mt-0.5">Corrente</span>}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 px-1">
                                <button
                                  onClick={() =>
                                    setLayers(
                                      layers.map((layer) =>
                                        layer.id === l.id
                                          ? { ...layer, visible: !layer.visible }
                                          : layer,
                                      ),
                                    )
                                  }
                                  title={l.visible ? "Spegni (Nascondi)" : "Accendi (Mostra)"}
                                  className={`p-1.5 rounded-md transition-colors ${l.visible ? "text-amber-500 hover:bg-amber-50" : "text-neutral-300 hover:bg-neutral-100"}`}
                                >
                                  {l.visible ? <Lightbulb size={14} /> : <LightbulbOff size={14} />}
                                </button>
                                <button
                                  onClick={() =>
                                    setLayers(
                                      layers.map((layer) =>
                                        layer.id === l.id
                                          ? { ...layer, frozen: !layer.frozen }
                                          : layer,
                                      ),
                                    )
                                  }
                                  title={l.frozen ? "Scongela (Sblocca)" : "Congela (Blocca)"}
                                  className={`p-1.5 rounded-md transition-colors ${l.frozen ? "text-blue-500 bg-blue-50 hover:bg-blue-100 border border-blue-200" : "text-neutral-300 hover:bg-neutral-100 border border-transparent"}`}
                                >
                                  <Snowflake size={14} />
                                </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : activeSidebarTab === 'tavole' ? (
                <>
                  <p className="text-xs text-neutral-500 mb-4 font-normal leading-relaxed">
                    Trascina i riquadri blu (tavola n. 1..5) sul foglio per selezionare l'area di stampa reale da esportare in PDF.
                  </p>

                  <div className="space-y-4">
                    {tavole.map((tav) => (
                      <div key={tav.id} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50/50 hover:bg-neutral-50 transition-all shadow-xs">
                        {/* Title and Visibility */}
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-neutral-200/50">
                          <span className="text-xs font-black text-neutral-800 font-mono tracking-tight">{tav.name}</span>
                          <div className="flex gap-1 items-center">
                            <button
                              onClick={() => {
                                setEditingCartiglioTavolaId(editingCartiglioTavolaId === tav.id ? null : tav.id);
                              }}
                              className={`p-1 rounded text-xs transition-all ${editingCartiglioTavolaId === tav.id ? "bg-indigo-100 text-indigo-700" : "text-neutral-500 hover:bg-neutral-200"}`}
                              title="Modifica Cartiglio"
                            >
                              <Pen size={12} />
                            </button>
                            <button
                              onClick={() => {
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, visible: !t.visible } : t));
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${tav.visible ? "bg-indigo-600 text-white shadow-xs" : "bg-neutral-200 text-neutral-600"}`}
                            >
                              {tav.visible ? "Visibile" : "Nascosto"}
                            </button>
                          </div>
                        </div>

                        {editingCartiglioTavolaId === tav.id && (
                          <div className="mb-3 space-y-1.5 p-2 bg-white border border-neutral-200 rounded text-xs">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] font-bold text-neutral-500 uppercase">Progetto</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded px-1.5 py-0.5 w-full bg-neutral-50 focus:bg-white"
                                value={tav.datiCartiglio.progetto}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, progetto: e.target.value}} : t))}
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] font-bold text-neutral-500 uppercase">Titolo</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded px-1.5 py-0.5 w-full bg-neutral-50 focus:bg-white"
                                value={tav.datiCartiglio.titolo}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, titolo: e.target.value}} : t))}
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] font-bold text-neutral-500 uppercase">Autore</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded px-1.5 py-0.5 w-full bg-neutral-50 focus:bg-white"
                                value={tav.datiCartiglio.autore}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, autore: e.target.value}} : t))}
                              />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[8px] font-bold text-neutral-500 uppercase">Data</label>
                              <input 
                                type="text"
                                className="border border-neutral-300 rounded px-1.5 py-0.5 w-full bg-neutral-50 focus:bg-white"
                                value={tav.datiCartiglio.data}
                                onChange={(e) => setTavole(tavole.map(t => t.id === tav.id ? {...t, datiCartiglio: {...t.datiCartiglio, data: e.target.value}} : t))}
                              />
                            </div>
                          </div>
                        )}

                        {/* Controls (Format / Scale / Unit) Grid */}
                        <div className="grid grid-cols-3 gap-1.5 mt-2">
                          {/* Paper format selector */}
                          <div>
                            <label className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Foglio</label>
                            <select
                              value={tav.format}
                              onChange={(e) => {
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, format: e.target.value as any } : t));
                              }}
                              className="w-full bg-white border border-neutral-300 text-xs rounded p-1 font-semibold"
                            >
                              <option value="A4">A4</option>
                              <option value="A3">A3</option>
                              <option value="A2">A2</option>
                              <option value="A1">A1</option>
                              <option value="A0">A0</option>
                            </select>
                          </div>

                          {/* Scale selector */}
                          <div>
                            <label className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Scala 1:</label>
                            <input
                              type="number"
                              min="1"
                              value={tav.scale}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value));
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, scale: val } : t));
                              }}
                              className="w-full bg-white border border-neutral-300 text-xs rounded p-1 text-center font-black"
                            />
                          </div>

                          {/* Unit selector */}
                          <div>
                            <label className="block text-[8px] text-neutral-500 font-bold uppercase tracking-wider mb-0.5">Unità</label>
                            <select
                              value={tav.unit}
                              onChange={(e) => {
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, unit: e.target.value as any } : t));
                              }}
                              className="w-full bg-white border border-neutral-300 text-xs rounded p-1 font-semibold"
                            >
                              <option value="m">Metri (m)</option>
                              <option value="cm">Cm (cm)</option>
                              <option value="mm">Mm (mm)</option>
                            </select>
                          </div>
                        </div>

                        {/* Opzioni Retino / Griglia di Supporto */}
                        <div className="mt-3 border-t border-neutral-200/60 pt-2.5 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="block text-[9px] font-black text-indigo-700 uppercase tracking-widest font-mono">
                              📏 RETINO DI SUPPORTO (GRIGLIA)
                            </span>
                            
                            {/* Attiva/Disattiva Toggle Switch */}
                            <button
                              type="button"
                              onClick={() => {
                                const isGridActive = tav.gridType && tav.gridType !== "none";
                                const nextGrid = isGridActive ? "none" : (localStorage.getItem('lastGridType') as any || "10cm");
                                setTavole(tavole.map(t => t.id === tav.id ? { ...t, gridType: nextGrid } : t));
                              }}
                              className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase transition-all flex items-center gap-1 cursor-pointer ${
                                tav.gridType && tav.gridType !== "none"
                                  ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400"
                                  : "bg-neutral-200 text-neutral-650 hover:bg-neutral-300"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${tav.gridType && tav.gridType !== "none" ? "bg-white animate-ping" : "bg-neutral-450"}`}></span>
                              {tav.gridType && tav.gridType !== "none" ? "Retino Attivo" : "Retino Disattivato"}
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] text-neutral-500 font-bold uppercase mb-1">Passo Retino</label>
                              <select
                                value={tav.gridType || "none"}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== "none") {
                                    localStorage.setItem('lastGridType', val);
                                  }
                                  setTavole(tavole.map(t => t.id === tav.id ? { ...t, gridType: val as any } : t));
                                }}
                                className="w-full bg-white border border-neutral-300 text-[10px] rounded p-1 font-semibold"
                              >
                                <option value="none">Nessun Retino (Spento)</option>
                                <option value="1cm">Ogni 1 cm</option>
                                <option value="10cm">Ogni 10 cm</option>
                                <option value="100cm">Ogni 100 cm (1m)</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-[8px] text-neutral-500 font-bold uppercase mb-1">Colore Retino</label>
                              <select
                                value={tav.gridColor || "rgba(99, 102, 241, 0.15)"}
                                onChange={(e) => {
                                  setTavole(tavole.map(t => t.id === tav.id ? { ...t, gridColor: e.target.value } : t));
                                }}
                                className="w-full bg-white border border-neutral-300 text-[10px] rounded p-1 font-semibold"
                              >
                                <option value="rgba(99, 102, 241, 0.15)">🔵 Viola Cobalto</option>
                                <option value="rgba(6, 182, 212, 0.18)">🌐 Cyan Grigio</option>
                                <option value="rgba(249, 115, 22, 0.15)">🟠 Arancione</option>
                                <option value="rgba(0, 0, 0, 0.1)">⚫ Grigio Trasparente</option>
                                <option value="rgba(239, 68, 68, 0.15)">🔴 Rosso Snapping</option>
                              </select>
                            </div>
                          </div>
                          
                          {tav.gridType && tav.gridType !== "none" && (
                            <button
                              type="button"
                              onClick={() => {
                                const paper = getPaperSizeMm(tav.format);
                                let factor = 1000;
                                if (tav.unit === 'cm') factor = 10;
                                if (tav.unit === 'mm') factor = 1;
                                const scale = tav.scale || 100;
                                const w = paper.w * (scale / factor);
                                const h = paper.h * (scale / factor);
                                
                                let spacingVal = 10;
                                if (tav.gridType === '1cm') {
                                  if (tav.unit === 'm') spacingVal = 0.01;
                                  else if (tav.unit === 'cm') spacingVal = 1;
                                  else if (tav.unit === 'mm') spacingVal = 10;
                                } else if (tav.gridType === '10cm') {
                                  if (tav.unit === 'm') spacingVal = 0.1;
                                  else if (tav.unit === 'cm') spacingVal = 10;
                                  else if (tav.unit === 'mm') spacingVal = 100;
                                } else if (tav.gridType === '100cm') {
                                  if (tav.unit === 'm') spacingVal = 1.0;
                                  else if (tav.unit === 'cm') spacingVal = 100;
                                  else if (tav.unit === 'mm') spacingVal = 1000;
                                }
                                
                                const startX = Math.floor(tav.position.x / spacingVal) * spacingVal;
                                const endX = Math.ceil((tav.position.x + w) / spacingVal) * spacingVal;
                                const startY = Math.floor(tav.position.y / spacingVal) * spacingVal;
                                const endY = Math.ceil((tav.position.y + h) / spacingVal) * spacingVal;
                                
                                const newEntities: any[] = [];
                                const timestamp = Date.now();
                                
                                // Vertical lines
                                for (let x = startX; x <= endX; x += spacingVal) {
                                  if (x >= tav.position.x && x <= tav.position.x + w) {
                                    newEntities.push({
                                      id: `grid-v-${x}-${timestamp}-${Math.random()}`,
                                      type: 'line',
                                      start: { x: x, y: tav.position.y },
                                      end: { x: x, y: tav.position.y + h },
                                      color: '#94a3b8',
                                      lineWidth: 1,
                                      layer: 'Hatch',
                                      dashed: true
                                    });
                                  }
                                }
                                // Horizontal lines
                                for (let y = startY; y <= endY; y += spacingVal) {
                                  if (y >= tav.position.y && y <= tav.position.y + h) {
                                    newEntities.push({
                                      id: `grid-h-${y}-${timestamp}-${Math.random()}`,
                                      type: 'line',
                                      start: { x: tav.position.x, y: y },
                                      end: { x: tav.position.x + w, y: y },
                                      color: '#94a3b8',
                                      lineWidth: 1,
                                      layer: 'Hatch',
                                      dashed: true
                                    });
                                  }
                                }
                                
                                setEntities(prev => [...prev, ...newEntities]);
                              }}
                              className="w-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-extrabold py-1 px-2 rounded border border-neutral-300 text-[9px] transition-all flex items-center justify-center gap-1 uppercase tracking-wide cursor-pointer"
                            >
                              <Plus size={10} />
                              Disegna Griglia sul Foglio (CAD Hatch)
                            </button>
                          )}
                        </div>

                        {/* Action buttons (printable preview) */}
                        <div className="flex gap-2 mt-3 pt-2">
                          <button
                            onClick={async () => {
                            const { exportNativePDF } = await import("./utils/pdfExport");
                            const url = exportNativePDF(entities, tav.format, tav.scale, tav.unit, tav, 'bloburl');
                            if (url) {
                              setPdfPreviewUrl(url);
                              setActivePreviewTavolaId(tav.id);
                            }
                            }}
                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-1.5 px-2 rounded-md text-[10px] transition-colors flex items-center justify-center gap-1 shadow-sm uppercase tracking-wider"
                          >
                            Anteprima
                          </button>
                          <button
                            onClick={async () => {
                              const { exportNativePDF } = await import("./utils/pdfExport");
                              exportNativePDF(entities, tav.format, tav.scale, tav.unit, tav);
                            }}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-1.5 px-2 rounded-md text-[10px] transition-colors flex items-center justify-center gap-1 shadow-sm uppercase tracking-wider"
                          >
                            <Printer size={10} className="stroke-white" />
                            <span>Salva PDF</span>
                          </button>
                        </div>
                        <div className="mt-2 text-[9px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                           <span className="font-bold">⚠️ SCALA DI STAMPA:</span><br/>
                           Per mantenere la scala reale (es. 400cm = 4cm su carta), imposta <span className="font-bold underline italic">"Scala: 100%"</span> o <span className="font-bold underline italic">"Dimensioni Effettive"</span> nel pannello di stampa. Evita "Adatta alla pagina".
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : activeSidebarTab === 'manuale' ? (
                <div className="space-y-4 font-sans text-neutral-700">
                  <div className="border-b border-neutral-200 pb-2">
                    <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <BookOpen size={13} className="text-emerald-600" />
                      🇮🇹 MANUALE IN LINEA GECOLA
                    </h4>
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Fai clic su qualsiasi elemento o passa il mouse sopra un pulsante per aprirne la spiegazione.
                    </p>
                  </div>

                  {/* Active Selected/Hovered Tool Detail */}
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-emerald-700 font-mono block uppercase">
                      Pannello Dettaglio Attivo:
                    </span>
                    {hoveredGuide ? (
                      <div>
                        <div className="flex items-center gap-1.5 justify-between">
                          <h5 className="text-xs font-black text-emerald-950 font-sans">{hoveredGuide.title}</h5>
                          {hoveredGuide.hotkey && (
                            <span className="text-[8px] bg-emerald-200 text-emerald-950 px-1 font-mono rounded">
                              {hoveredGuide.hotkey}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                          {hoveredGuide.description}
                        </p>
                        {hoveredGuide.tip && (
                          <div className="mt-2 text-[10px] leading-relaxed text-indigo-700 bg-white border border-indigo-100 p-2 rounded">
                            <span className="font-extrabold text-amber-500">💡 Suggerimento:</span> {hoveredGuide.tip}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-[11px] text-neutral-400 italic">
                        Passa il puntatore del mouse sopra un pulsante qualsiasi della barra superiore o seleziona un comando dall'indice per visualizzarne la scheda tecnica qui in tempo reale.
                      </div>
                    )}
                  </div>

                  {/* General Index Section */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black tracking-widest text-neutral-400 font-mono block uppercase">
                      Indice dei comandi disponibili:
                    </span>
                    <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
                      {Object.entries(GUIDE_DATABASE).map(([key, guide]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setHoveredGuide(guide);
                            setGuideLockedBy(key);
                          }}
                          className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex flex-col gap-0.5 ${guideLockedBy === key ? "bg-white border-emerald-500 ring-2 ring-emerald-100 shadow-xs" : "bg-neutral-50 border-neutral-100 hover:bg-white hover:border-neutral-200"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-800">{key}</span>
                            <span className="text-[9px] text-neutral-400 font-mono">{guide.hotkey}</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 line-clamp-1">{guide.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Command Bar */}
      <footer className="h-8 border-t border-slate-800 bg-slate-900 px-4 flex items-center text-sm">
        <span className="text-slate-500 mr-2 uppercase tracking-wide font-mono text-xs">
          Command:
        </span>
        <input
          type="text"
          className="bg-transparent flex-1 outline-none font-mono text-xs text-white"
          placeholder="Type a command (f.ex. L, C, R)..."
        />
      </footer>

      {/* Hidden file input for DXF/DWG/Images/Video/Audio/PDF uploader */}
      <input
        ref={importInputRef}
        type="file"
        accept=".dxf,.dwg,image/*,video/*,audio/*,.pdf"
        onChange={handleImportFile}
        className="hidden"
        style={{ display: 'none' }}
      />

      {/* DWG Proprietary File Instructions Modal */}
      {showDwgModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 select-none animate-fade-in" onClick={() => setShowDwgModal(false)}>
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl shadow-2xl max-w-sm w-full relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-xs font-black uppercase text-red-400 tracking-wider font-mono flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-red-900/55 border border-red-700 rounded text-[9px] text-red-300">Formato DWG</span>
                Notifica Informativa
              </h3>
              <button onClick={() => setShowDwgModal(false)} className="text-slate-500 hover:text-white font-mono text-xs font-bold leading-none">
                ✕
              </button>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Hai caricato il file <span className="font-semibold text-yellow-400 font-mono">"{dwgFileName}"</span>.
              <br/><br/>
              Il formato <span className="font-bold text-white">DWG</span> di AutoCAD è un formato file binario compresso e con copyright proprietario non leggibile nativamente dai moderni browser web.
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 mb-4">
              <span className="text-[10px] font-black text-indigo-400 font-mono block uppercase mb-1.5">Come procedere per il disegno:</span>
              <ul className="text-[10.5px] text-slate-400 list-decimal pl-4 space-y-2 leading-relaxed">
                <li>
                  Converti il file DWG in formato <span className="text-indigo-300 font-semibold font-mono">DXF Vettoriale</span> (es. R12 o AutoCAD 2000 per compatibilità ottimale).
                </li>
                <li>
                  Puoi usare convertitori gratuiti come <span className="text-indigo-300 underline font-semibold">ODA File Converter</span>, convertitori online o esportarlo direttamente da AutoCAD.
                </li>
                <li>
                  Importa il file convertito <span className="text-emerald-400 font-bold font-mono">.dxf</span> qui per rigenerare all'istante l'intero disegno vettoriale sul foglio!
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold tracking-wide font-sans transition-colors shadow-md"
                onClick={() => setShowDwgModal(false)}
              >
                Ho capito, Chiudi
              </button>
            </div>
          </div>
        </div>
      )}


      <RaccordoDialog
        key={editingRaccordo ? `edit-${editingRaccordo.id}` : 'new-raccordo'}
        isOpen={isRaccordoDialogOpen}
        onClose={() => {
          if (editingRaccordo?.raccordoMetadata) {
            // Restore to the original config saved in metadata
            const meta = editingRaccordo.raccordoMetadata;
            cadCanvasRef.current?.editRaccordo(
              meta.id1,
              meta.id2,
              meta.clickPt1,
              meta.clickPt2,
              editingRaccordo.id,
              meta.config,
              meta.originalLine1,
              meta.originalLine2
            );
          }
          setIsRaccordoDialogOpen(false);
          setEditingRaccordo(null);
        }}
        initialConfig={editingRaccordo?.raccordoMetadata ? editingRaccordo.raccordoMetadata.config : raccordoConfig}
        onChange={(config) => {
          if (editingRaccordo?.raccordoMetadata) {
            const meta = editingRaccordo.raccordoMetadata;
            cadCanvasRef.current?.editRaccordo(
              meta.id1,
              meta.id2,
              meta.clickPt1,
              meta.clickPt2,
              editingRaccordo.id,
              config,
              meta.originalLine1,
              meta.originalLine2
            );
          } else {
            setRaccordoConfig(config);
          }
        }}
        onSave={(config) => {
          if (editingRaccordo?.raccordoMetadata) {
            const meta = editingRaccordo.raccordoMetadata;
            const rId = editingRaccordo.id;
            
            // Clear editingRaccordo so onClose does not trigger restoration revert
            setEditingRaccordo(null);
            setIsRaccordoDialogOpen(false);

            // Apply final configuration and commit to history
            cadCanvasRef.current?.editRaccordo(
              meta.id1,
              meta.id2,
              meta.clickPt1,
              meta.clickPt2,
              rId,
              config,
              meta.originalLine1,
              meta.originalLine2
            );
            
            setShortcutToast(`Raccordo modificato: ${config.type === 'curvo' ? 'Curvo r=' : 'Rettilineo d='}${config.value} cm`);
            setTimeout(() => setShortcutToast(null), 4000);
          } else {
            setRaccordoConfig(config);
            setSelectedTool("Raccordo");
            setIsRaccordoDialogOpen(false);
            setShortcutToast(`Raccordo pronto: ${config.type === 'curvo' ? 'Curvo r=' : 'Rettilineo d='}${config.value} cm`);
            setTimeout(() => setShortcutToast(null), 4000);
          }
        }}
      />



      {/* DXF text reader dialog */}
      <DXFTextReaderDialog
        isOpen={isDXFTextReaderOpen}
        onClose={() => setIsDXFTextReaderOpen(false)}
        activeLayerId={activeLayerId}
        layers={layers}
        onImport={(importedEntities, newLayers, mergeMode) => {
          if (newLayers.length > 0) {
            setLayers(prev => [...prev, ...newLayers]);
          }

          if (mergeMode === 'replace') {
            updateEntitiesWithHistory(importedEntities);
          } else {
            updateEntitiesWithHistory(prev => [...prev, ...importedEntities]);
          }

          setShortcutToast(`Generati con successo ${importedEntities.length} elementi vettoriali DXF!`);
          setTimeout(() => setShortcutToast(null), 4000);
        }}
      />

      {/* Floating Interactive Manual Companion */}
      {showFloatingManual && hoveredGuide && (
        <div className="fixed bottom-6 left-6 z-50 w-80 bg-neutral-900/40 backdrop-blur-lg text-neutral-100 rounded-lg shadow-xl border border-neutral-700/30 p-4 transition-all duration-300 transform scale-100 ease-out flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 flex-nowrap">
            <div className="flex items-center gap-1.5 text-emerald-400 font-sans font-bold text-xs uppercase tracking-wider">
              <BookOpen size={14} className="animate-pulse" />
              <span>Manuale Interattivo</span>
            </div>
            <button 
              onClick={() => {
                setHoveredGuide(null);
                setGuideLockedBy(null);
                setShowFloatingManual(false);
              }}
              className="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded p-1 transition-colors"
              title="Chiudi Manuale"
            >
              <X size={14} />
            </button>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-100 flex items-center justify-between gap-1">
              <span className="truncate">{hoveredGuide.title}</span>
              {hoveredGuide.hotkey && (
                <span className="text-[9px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                  {hoveredGuide.hotkey}
                </span>
              )}
            </h4>
            <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
              {hoveredGuide.description}
            </p>
            {hoveredGuide.tip && (
              <div className="mt-2.5 p-2 bg-indigo-950/40 border border-indigo-900/40 rounded text-[11px] text-indigo-300 flex items-start gap-1">
                <span className="text-amber-400 font-bold shrink-0">💡</span>
                <span>{hoveredGuide.tip}</span>
              </div>
            )}
          </div>
          <div className="text-[9px] text-neutral-400 pt-1 text-right italic font-medium">
            Scompare automaticamente quando premi il pulsante o lo strumento!
          </div>
        </div>
      )}

      <AnimatePresence>
        {quickActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-[9999] bg-white dark:bg-neutral-800 rounded-full shadow-2xl border border-neutral-200 dark:border-neutral-700 p-1.5 flex items-center gap-1"
            style={{ 
              left: quickActions.pos.x, 
              top: Math.max(80, quickActions.pos.y - 80),
              transform: 'translateX(-50%)' 
            }}
          >
            <button 
              onClick={() => {
                setInitialSelectedIds(quickActions.ids);
                setSelectedTool('Move');
                setQuickActions(null);
              }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 px-3"
              title="Sposta"
            >
              <Move size={16} />
              <span className="text-xs font-medium">Sposta</span>
            </button>
            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            <button 
              onClick={() => {
                setInitialSelectedIds(quickActions.ids);
                setSelectedTool('Copy');
                setQuickActions(null);
              }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 px-3"
              title="Copia"
            >
              <Copy size={16} />
              <span className="text-xs font-medium">Copia</span>
            </button>
            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            <button 
              onClick={() => {
                setRotationEntityId(quickActions.ids[0]);
                setIsRotateScaleOpen(true);
                setQuickActions(null);
              }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 px-3"
              title="Ruota"
            >
              <RefreshCw size={16} />
              <span className="text-xs font-medium">Ruota</span>
            </button>
            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            <button 
              onClick={() => {
                const newGroupId = Date.now().toString();
                updateEntitiesWithHistory(prev => prev.map(ent => {
                  if (quickActions.ids.includes(ent.id)) {
                    return { ...ent, groupId: newGroupId };
                  }
                  return ent;
                }));
                setQuickActions(null);
                setShortcutToast("Oggetti uniti (Join)");
                setTimeout(() => setShortcutToast(null), 2000);
              }}
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 px-3"
              title="Join"
            >
              <Link size={16} />
              <span className="text-xs font-medium">Join</span>
            </button>
            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            <button 
              onClick={() => {
                updateEntitiesWithHistory(prev => prev.filter(ent => !quickActions.ids.includes(ent.id)));
                setQuickActions(null);
              }}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors text-red-500 flex items-center gap-1.5 px-3"
              title="Cancella"
            >
              <Trash2 size={16} />
              <span className="text-xs font-medium">Cancella</span>
            </button>
            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-0.5" />
            <button 
              onClick={() => setQuickActions(null)}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-full transition-colors text-neutral-400"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BIM Dialog Submenus were removed and redesigned in the inline top bars for higher efficiency */}
    </div>
  );
}
