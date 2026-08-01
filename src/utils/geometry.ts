import { Point, Entity, LineEntity, CircleEntity, ArcEntity } from '../types';

export const distToSegment = (p: Point, a: Point, b: Point): number => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
};

export const isAngleInArc = (angle: number, startAngle: number, endAngle: number) => {
    let s = startAngle % 360;
    let e = endAngle % 360;
    let a = angle % 360;
    if (s < 0) s += 360;
    if (e < 0) e += 360;
    if (a < 0) a += 360;

    if (s <= e) {
        return a >= s && a <= e;
    } else {
        return a >= s || a <= e;
    }
};

export const getIntersections = (entA: Entity, entB: Entity): Point[] => {
    const pts: Point[] = [];
    if (entA.id === entB.id) return pts;

    const getPolylineSegmentsIntersections = (lineStart: Point, lineEnd: Point, poly: Point[]): Point[] => {
        const intersections: Point[] = [];
        for (let i = 0; i < poly.length - 1; i++) {
            const p3 = poly[i];
            const p4 = poly[i+1];
            const x1 = lineStart.x, y1 = lineStart.y, x2 = lineEnd.x, y2 = lineEnd.y;
            const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
            const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
            if (denom !== 0) {
                const t = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
                const u = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
                const eps = 1e-4;
                if (t >= -eps && t <= 1 + eps && u >= -eps && u <= 1 + eps) {
                    const tClamped = Math.max(0, Math.min(1, t));
                    intersections.push({ x: x1 + tClamped * (x2 - x1), y: y1 + tClamped * (y2 - y1) });
                }
            }
        }
        return intersections;
    };

    // Both are lines
    if (entA.type === 'line' && entB.type === 'line') {
        const lineA = entA as LineEntity;
        const lineB = entB as LineEntity;
        const polyA = lineA.inkPoints;
        const polyB = lineB.inkPoints;

        if (polyA && polyA.length > 1 && polyB && polyB.length > 1) {
            polyA.forEach((_, i) => {
                if (i === polyA.length - 1) return;
                const ptsSub = getPolylineSegmentsIntersections(polyA[i], polyA[i+1], polyB);
                pts.push(...ptsSub);
            });
            return pts;
        } else if (polyA && polyA.length > 1) {
            return getPolylineSegmentsIntersections(lineB.start, lineB.end, polyA);
        } else if (polyB && polyB.length > 1) {
            return getPolylineSegmentsIntersections(lineA.start, lineA.end, polyB);
        } else {
            const x1 = lineA.start.x, y1 = lineA.start.y, x2 = lineA.end.x, y2 = lineA.end.y;
            const x3 = lineB.start.x, y3 = lineB.start.y, x4 = lineB.end.x, y4 = lineB.end.y;
            const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
            
            const eps = 0.001; // Extreme precision for CAD inters
            
            if (Math.abs(denom) > 1e-12) {
                const t = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
                const u = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
                
                const overlapEps = 0.005; 
                if (t >= -overlapEps && t <= 1 + overlapEps && u >= -overlapEps && u <= 1 + overlapEps) {
                    const tClamped = Math.max(0, Math.min(1, t));
                    pts.push({ x: x1 + tClamped * (x2 - x1), y: y1 + tClamped * (y2 - y1) });
                }
            } else {
                // Parallel lines - check for overlapping segments
                const d2A = Math.pow(x2-x1,2) + Math.pow(y2-y1,2);
                if (d2A > 1e-10) {
                    // Check if lineB endpoints lie on lineA
                    [lineB.start, lineB.end].forEach(p => {
                        const t = ((p.x - x1) * (x2 - x1) + (p.y - y1) * (y2 - y1)) / d2A;
                        if (t >= 0 && t <= 1) {
                            const dist = Math.hypot(p.x - (x1 + t*(x2-x1)), p.y - (y1 + t*(y2-y1)));
                            if (dist < eps) pts.push(p);
                        }
                    });
                    // Check if lineA endpoints lie on lineB
                    const d2B = Math.pow(x4-x3,2) + Math.pow(y4-y3,2);
                    if (d2B > 1e-10) {
                        [lineA.start, lineA.end].forEach(p => {
                            const t = ((p.x - x3) * (x4 - x3) + (p.y - y3) * (y4 - y3)) / d2B;
                            if (t >= 0 && t <= 1) {
                                const dist = Math.hypot(p.x - (x3 + t*(x4-x3)), p.y - (y3 + t*(y4-y3)));
                                if (dist < eps) pts.push(p);
                            }
                        });
                    }
                }
            }
            
            // Proximity checks: if an endpoint is very close to the other segment
            if (distToSegment({x: x3, y: y3}, lineA.start, lineA.end) < eps) pts.push({x: x3, y: y3});
            if (distToSegment({x: x4, y: y4}, lineA.start, lineA.end) < eps) pts.push({x: x4, y: y4});
            if (distToSegment({x: x1, y: y1}, lineB.start, lineB.end) < eps) pts.push({x: x1, y: y1});
            if (distToSegment({x: x2, y: y2}, lineB.start, lineB.end) < eps) pts.push({x: x2, y: y2});
        }
    }
    // line and circle / arc
    else if ((entA.type === 'line' && (entB.type === 'circle' || entB.type === 'arc')) ||
             ((entA.type === 'circle' || entA.type === 'arc') && entB.type === 'line')) {
        const line = entA.type === 'line' ? entA as LineEntity : entB as LineEntity;
        const circle = entA.type === 'line' ? entB as (CircleEntity | ArcEntity) : entA as (CircleEntity | ArcEntity);
        
        const getCircleSegmentIntersections = (s: Point, e: Point): Point[] => {
            const subPts: Point[] = [];
            const d = { x: e.x - s.x, y: e.y - s.y };
            const v = { x: s.x - circle.center.x, y: s.y - circle.center.y };
            const a = d.x * d.x + d.y * d.y;
            const b = 2 * (v.x * d.x + v.y * d.y);
            const c = (v.x * v.x + v.y * v.y) - circle.radius * circle.radius;
            if (a !== 0) {
                const discriminant = b * b - 4 * a * c;
                if (discriminant >= 0) {
                    const sqrtD = Math.sqrt(discriminant);
                    const t1 = (-b - sqrtD) / (2 * a);
                    const t2 = (-b + sqrtD) / (2 * a);
                    const epsLineCircle = 0.05; 
                    [t1, t2].forEach(t => {
                        if (t >= -epsLineCircle && t <= 1 + epsLineCircle) {
                            const tClamped = Math.max(0, Math.min(1, t));
                            const p = { x: s.x + tClamped * d.x, y: s.y + tClamped * d.y };
                            if (circle.type === 'arc') {
                                const angle = Math.atan2(p.y - circle.center.y, p.x - circle.center.x) * 180 / Math.PI;
                                if (isAngleInArc(angle, circle.startAngle, circle.endAngle)) {
                                    subPts.push(p);
                                }
                            } else {
                                subPts.push(p);
                            }
                        }
                    });
                }
            }
            return subPts;
        };

        if (line.inkPoints && line.inkPoints.length > 1) {
            line.inkPoints.forEach((_, i) => {
                if (i === line.inkPoints!.length - 1) return;
                const subPts = getCircleSegmentIntersections(line.inkPoints![i], line.inkPoints![i+1]);
                pts.push(...subPts);
            });
        } else {
            const subPts = getCircleSegmentIntersections(line.start, line.end);
            pts.push(...subPts);
        }
    }
    // Circle/Arc and Circle/Arc
    else if ((entA.type === 'circle' || entA.type === 'arc') && (entB.type === 'circle' || entB.type === 'arc')) {
        const c1 = entA as (CircleEntity | ArcEntity);
        const c2 = entB as (CircleEntity | ArcEntity);
        const dx = c2.center.x - c1.center.x;
        const dy = c2.center.y - c1.center.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < c1.radius + c2.radius && dist > Math.abs(c1.radius - c2.radius) && dist > 1e-10) {
            const a = (c1.radius * c1.radius - c2.radius * c2.radius + dist * dist) / (2 * dist);
            const h = Math.sqrt(Math.max(0, c1.radius * c1.radius - a * a));
            const x2 = c1.center.x + a * dx / dist;
            const y2 = c1.center.y + a * dy / dist;
            
            const rx = -dy * (h / dist);
            const ry = dx * (h / dist);
            
            const p1 = { x: x2 + rx, y: y2 + ry };
            const p2 = { x: x2 - rx, y: y2 - ry };
            
            [p1, p2].forEach(p => {
                let valid = true;
                if (c1.type === 'arc') {
                    const ang = Math.atan2(p.y - c1.center.y, p.x - c1.center.x) * 180 / Math.PI;
                    if (!isAngleInArc(ang, c1.startAngle, c1.endAngle)) valid = false;
                }
                if (c2.type === 'arc') {
                    const ang = Math.atan2(p.y - c2.center.y, p.x - c2.center.x) * 180 / Math.PI;
                    if (!isAngleInArc(ang, c2.startAngle, c2.endAngle)) valid = false;
                }
                if (valid) pts.push(p);
            });
        }
    }
    return pts;
};
