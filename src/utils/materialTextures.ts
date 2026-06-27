
import * as THREE from 'three';

/**
 * Procedural texture generator for realistic BIM materials
 */
export const createBIMMaterialTexture = (
  type: 'concrete' | 'masonry' | 'partition' | 'plaster' | 'stone',
  variant: 'side' | 'top' = 'side'
): THREE.CanvasTexture => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (type === 'concrete') {
    // Base color (Light Cement gray - natural)
    ctx.fillStyle = variant === 'top' ? '#cbd5e1' : '#94a3b8';
    ctx.fillRect(0, 0, size, size);

    // Add fine noise
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grey = Math.random() * 40 - 20;
      ctx.fillStyle = `rgba(${170 + grey}, ${170 + grey}, ${170 + grey}, 0.15)`;
      ctx.fillRect(x, y, 1, 1);
    }

    if (variant === 'side') {
      // Formwork board patterns (tavole di armatura) - typical of construction sites
      const boardHeight = size / 6;
      for (let i = 0; i < 6; i++) {
        const y = i * boardHeight;
        
        // Board joints (darker and more defined)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();

        // Wood grain simulation within board (more visible)
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let j = 0; j < 18; j++) {
          const gy = y + Math.random() * boardHeight;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(size/3, gy + 12, size*2/3, gy - 12, size, gy);
          ctx.stroke();
        }

        // Bolt holes (distanziatori/casseri) - characteristic holes in concrete walls
        const holes = 3;
        for (let h = 0; h < holes; h++) {
          const hx = (size / holes) * h + size / (holes * 2);
          const hy = y + boardHeight / 2;
          
          // Outer hole shadow
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.arc(hx, hy, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner detail (the bolt itself)
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.arc(hx, hy, 2, 0, Math.PI * 2);
          ctx.fill();

          // Subtle circular ring highlight
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hx, hy, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
        // Top view: more aggregates for a rough construction look
        for (let i = 0; i < 400; i++) {
          const x = Math.random() * size;
          const y = Math.random() * size;
          const r = Math.random() * 2 + 0.5;
          ctx.fillStyle = `rgba(60, 60, 60, 0.2)`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
    }
  } 
  else if (type === 'plaster') {
    // Plaster (Intonaco): Off-white/light gray with fine mineral grain
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, size, size);

    // Fine mineral grain
    for (let i = 0; i < 30000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const noise = Math.random() * 20 - 10;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(${240 + noise}, ${240 + noise}, ${240 + noise}, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // Subtle trowel marks
    ctx.strokeStyle = 'rgba(0,0,0,0.02)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const startX = Math.random() * size;
      const startY = Math.random() * size;
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(startX + 50, startY + 50, startX + 100, startY);
      ctx.stroke();
    }
  }
  else if (type === 'masonry' || type === 'partition') {
    const isPartition = type === 'partition';
    
    if (variant === 'top') {
      // Top view of Swiss Bricks (Poroton/Laterizio): Grid of holes with thick defined edges
      // Use a more natural "Poroton" orange-red color
      const baseColor = isPartition ? '#e27b58' : '#cd5c3a'; 
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, size, size);

      const holesX = isPartition ? 6 : 8;
      const holesY = isPartition ? 10 : 12;
      const padding = size * 0.04;
      const holeW = (size - padding * 2) / holesX;
      const holeH = (size - padding * 2) / holesY;
      const holeGap = isPartition ? 6 : 10; // Wider gaps for thicker walls between holes as requested

      for (let i = 0; i < holesX; i++) {
        for (let j = 0; j < holesY; j++) {
          const hx = padding + i * holeW + holeGap/2;
          const hy = padding + j * holeH + holeGap/2;
          const hw = holeW - holeGap;
          const hh = holeH - holeGap;
          
          // Outer defined edge of the hole (thick contour - highly requested)
          ctx.strokeStyle = 'rgba(40,10,0,0.6)';
          ctx.lineWidth = 3.5; 
          
          // Deep dark hole
          ctx.fillStyle = 'rgba(10,2,0,1.0)';
          
          const radius = 1.0;
          const drawRect = (x: number, y: number, w: number, h: number) => {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
          };

          drawRect(hx, hy, hw, hh);
          ctx.fill();
          ctx.stroke();

          // Internal wall highlight (gives three-dimensionality to the hollow brick)
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(hx + 0.5, hy + 0.5);
          ctx.lineTo(hx + hw - 0.5, hy + 0.5);
          ctx.stroke();
        }
      }
      
      // Surface grain/clay imperfections
      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = Math.random() * 20 - 10;
        ctx.fillStyle = `rgba(0,0,0,0.1)`;
        ctx.fillRect(x, y, 1, 1);
      }
    } else {
      // Side view: Vertical scoring and brick bonding
      ctx.fillStyle = '#cbd5e1'; // Mortar color (Cementitious)
      ctx.fillRect(0, 0, size, size);

      const rows = isPartition ? 10 : 7;
      const cols = isPartition ? 3 : 2;
      const h = size / rows;
      const w = size / cols;
      const mortar = isPartition ? 5 : 8;

      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (w / 2);
        for (let c = -1; c < cols + 1; c++) {
          const x = c * w + offset + mortar/2;
          const y = r * h + mortar/2;
          const bw = w - mortar;
          const bh = h - mortar;

          const hueVar = Math.random() * 8 - 4;
          const lightVar = Math.random() * 10 - 5;
          
          if (isPartition) {
              ctx.fillStyle = `hsl(${22 + hueVar}, ${60}%, ${65 + lightVar}%)`;
          } else {
              ctx.fillStyle = `hsl(${20 + hueVar}, ${65}%, ${55 + lightVar}%)`;
          }
          
          ctx.fillRect(x, y, bw, bh);

          // Highly visible vertical scoring (typical of laterizio)
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 1.2;
          const lines = isPartition ? 10 : 16;
          for (let i = 1; i < lines; i++) {
            const lx = x + bw * (i/lines);
            ctx.beginPath();
            ctx.moveTo(lx, y);
            ctx.lineTo(lx, y + bh);
            ctx.stroke();
          }

          // Ambient occlusion/Shadows for depth
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y + bh - 2.5, bw, 2.5); 
          ctx.fillRect(x + bw - 2.5, y, 2.5, bh); 
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(x, y, bw, 2); 
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  return texture;
};
