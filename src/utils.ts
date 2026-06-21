export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: string;
  start: Point;
  end: Point;
  [key: string]: any;
}

export function getIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;

  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return null; // parallel

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  const eps = 1e-4;
  if (ua >= -eps && ua <= 1 + eps && ub >= -eps && ub <= 1 + eps) {
    const tClamped = Math.max(0, Math.min(1, ua));
    return {
      x: x1 + tClamped * (x2 - x1),
      y: y1 + tClamped * (y2 - y1)
    };
  }
  return null;
}

export function trimEntities(entities: Entity[], selectedIds: string[]): Entity[] {
  let newEntities = [...entities];
  
  // If no specific selection, run on all lines
  const activeIds = selectedIds.length > 0 ? selectedIds : entities.filter(e => e.type === 'line').map(e => e.id);
  const activeLines = newEntities.filter(ent => activeIds.includes(ent.id) && ent.type === 'line') as Entity[];
  const allLines = newEntities.filter(e => e.type === 'line') as Entity[];

  const intersectionsOnLine: Record<string, Point[]> = {};
  activeLines.forEach(entA => {
    intersectionsOnLine[entA.id] = [];
    allLines.forEach(entB => {
      if (entA.id === entB.id) return;
      const inter = getIntersection(entA.start, entA.end, entB.start, entB.end);
      if (inter) {
        intersectionsOnLine[entA.id].push(inter);
      }
    });
  });

  let changedAny = false;

  activeLines.forEach(entA => {
    const length = Math.hypot(entA.end.x - entA.start.x, entA.end.y - entA.start.y);
    if (length === 0) return;

    let pts = intersectionsOnLine[entA.id] || [];
    
    // Filter points to those strictly ON the segment (not perfectly at endpoints)
    pts = pts.filter(p => {
        const d_start = Math.hypot(p.x - entA.start.x, p.y - entA.start.y);
        const d_end = Math.hypot(p.x - entA.end.x, p.y - entA.end.y);
        return d_start > 0.05 && d_end > 0.05; 
    });

    // Deduplicate points that are very close to each other
    const deduped: Point[] = [];
    pts.forEach(p => {
        if (!deduped.some(d => Math.hypot(d.x - p.x, d.y - p.y) < 1.0)) {
            deduped.push(p);
        }
    });
    pts = deduped;

    if (pts.length === 0) return;

    // Sort intersections by distance to the start point
    pts.sort((a, b) => {
        return Math.hypot(a.x - entA.start.x, a.y - entA.start.y) - Math.hypot(b.x - entA.start.x, b.y - entA.start.y);
    });

    let newStart = entA.start;
    let newEnd = entA.end;

    // Check first piece (start overhang)
    const pFirst = pts[0];
    const distFirst = Math.hypot(pFirst.x - entA.start.x, pFirst.y - entA.start.y);
    
    // An endpoint is "connected" if it is close to ANY other line's endpoint or body
    const isStartConnected = allLines.some(other => {
        if (other.id === entA.id) return false;
        // Check if endpoints touch
        const touch = Math.hypot(other.start.x - entA.start.x, other.start.y - entA.start.y) < 1.0 ||
                      Math.hypot(other.end.x - entA.start.x, other.end.y - entA.start.y) < 1.0;
        if (touch) return true;
        // Check if start touches the body of another line (T-junction from the other side)
        const dBody = distanceToSegment(entA.start, other.start, other.end);
        return dBody < 1.0;
    });

    let startTrimmed = false;
    // For AI Trim, if it's dangling (not connected), we trim it to the first intersection.
    if (!isStartConnected) {
        newStart = pFirst;
        startTrimmed = true;
    }

    // Check last piece (end overhang)
    const pLast = pts[pts.length - 1];
    const distLast = Math.hypot(pLast.x - entA.end.x, pLast.y - entA.end.y);
    const isEndConnected = allLines.some(other => {
        if (other.id === entA.id) return false;
        const touch = Math.hypot(other.start.x - entA.end.x, other.start.y - entA.end.y) < 1.0 ||
                      Math.hypot(other.end.x - entA.end.x, other.end.y - entA.end.y) < 1.0;
        if (touch) return true;
        const dBody = distanceToSegment(entA.end, other.start, other.end);
        return dBody < 1.0;
    });

    if (!isEndConnected) {
        // Prevent collapsing if there's only 1 point and we already trimmed the start
        if (pts.length === 1 && startTrimmed) {
             // Drop the side that is shorter (looks more like an overhang)
             if (distLast < distFirst) {
                 // The end was shorter! Revert start, trim end.
                 newStart = entA.start;
                 newEnd = pLast;
             }
        } else {
             newEnd = pLast;
        }
    }

    if (newStart !== entA.start || newEnd !== entA.end) {
        newEntities = newEntities.map(ent => ent.id === entA.id ? {...ent, start: newStart, end: newEnd} : ent);
        changedAny = true;
    }
  });

  return newEntities;
}

// Helper to compute distance from point p to segment v-w
function distanceToSegment(p: Point, v: Point, w: Point) {
  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
