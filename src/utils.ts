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

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1)
    };
  }
  return null;
}

export function trimEntities(entities: Entity[], selectedIds: string[]): Entity[] {
  let newEntities = [...entities];
  const selectedEntities = newEntities.filter(ent => selectedIds.includes(ent.id) && ent.type === 'line') as Entity[];

  // Helper to get all intersections for a line
  const intersectionsOnLine: Record<string, Point[]> = {};
  selectedEntities.forEach(entA => {
    intersectionsOnLine[entA.id] = [entA.start, entA.end];
    selectedEntities.forEach(entB => {
      if (entA.id === entB.id) return;
      const inter = getIntersection(entA.start, entA.end, entB.start, entB.end);
      if (inter) intersectionsOnLine[entA.id].push(inter);
    });
  });
  
  selectedEntities.forEach(entA => {
    const length = Math.hypot(entA.end.x - entA.start.x, entA.end.y - entA.start.y);
    if (length === 0) return;

    let bestStart = entA.start;
    let bestEnd = entA.end;

    // We only care about intersections that are *very* close to the existing endpoints, 
    // implying they were meant to be trimmed there.
    const tolerance = length * 0.1; // 10%

    // Find nearest intersection for start
    let minStartDist = Infinity;
    intersectionsOnLine[entA.id].forEach(p => {
        const d = Math.hypot(p.x - entA.start.x, p.y - entA.start.y);
        if (d > 0.001 && d < tolerance && d < minStartDist) {
            minStartDist = d;
            bestStart = p;
        }
    });
    
    // Find nearest intersection for end
    let minEndDist = Infinity;
    intersectionsOnLine[entA.id].forEach(p => {
        const d = Math.hypot(p.x - entA.end.x, p.y - entA.end.y);
        if (d > 0.001 && d < tolerance && d < minEndDist) {
            minEndDist = d;
            bestEnd = p;
        }
    });

    if (minStartDist !== Infinity || minEndDist !== Infinity) {
        newEntities = newEntities.map(ent => ent.id === entA.id ? {...ent, start: bestStart, end: bestEnd} : ent);
    }
  });

  return newEntities;
}
