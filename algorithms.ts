
import { CellType, VizStep } from './types';
import { ROWS, COLS } from './constants';

export const key = (r: number, c: number) => `${r},${c}`;
export const parseKey = (k: string) => k.split(",").map(Number);

const inBounds = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

// 8-directional movement
const DIRS = [
  [-1, 0], [-1, 1], [0, 1], [1, 1],
  [1, 0], [1, -1], [0, -1], [-1, -1],
];

const getNeighbors = (grid: any[][], r: number, c: number) => {
  const result: [number, number][] = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc)) {
      const type = grid[nr][nc].type;
      if (type !== CellType.WALL && type !== CellType.DYNAMIC) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
};

const cost = (r1: number, c1: number, r2: number, c2: number) => 
  Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1 ? 1.414 : 1;

const reconstructPath = (came: Record<string, string>, start: string, end: string) => {
  const path: string[] = [];
  let cur = end;
  while (cur && cur !== start) {
    path.unshift(cur);
    cur = came[cur];
  }
  if (cur === start) path.unshift(start);
  return path;
};

export function* bfsGen(grid: any[][], start: string, end: string) {
  const queue = [start];
  const visited = new Set([start]);
  const came: Record<string, string> = {};
  
  while (queue.length) {
    const cur = queue.shift()!;
    yield { frontier: [...queue], explored: Array.from(visited), current: cur } as VizStep;
    if (cur === end) return reconstructPath(came, start, end);
    
    const [r, c] = parseKey(cur);
    for (const [nr, nc] of getNeighbors(grid, r, c)) {
      const nk = key(nr, nc);
      if (!visited.has(nk)) {
        visited.add(nk);
        came[nk] = cur;
        queue.push(nk);
      }
    }
  }
  return null;
}

export function* dfsGen(grid: any[][], start: string, end: string) {
  const stack = [start];
  const visited = new Set<string>();
  const came: Record<string, string> = {};

  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    
    yield { frontier: [...stack], explored: Array.from(visited), current: cur } as VizStep;
    if (cur === end) return reconstructPath(came, start, end);
    
    const [r, c] = parseKey(cur);
    for (const [nr, nc] of getNeighbors(grid, r, c)) {
      const nk = key(nr, nc);
      if (!visited.has(nk)) {
        came[nk] = cur;
        stack.push(nk);
      }
    }
  }
  return null;
}

export function* ucsGen(grid: any[][], start: string, end: string) {
  let pq = [{ k: start, cost: 0 }];
  const visited = new Set<string>();
  const costMap: Record<string, number> = { [start]: 0 };
  const came: Record<string, string> = {};

  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost);
    const { k: cur, cost: curCost } = pq.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);

    yield { frontier: pq.map(x => x.k), explored: Array.from(visited), current: cur } as VizStep;
    if (cur === end) return reconstructPath(came, start, end);

    const [r, c] = parseKey(cur);
    for (const [nr, nc] of getNeighbors(grid, r, c)) {
      const nk = key(nr, nc);
      const newCost = curCost + cost(r, c, nr, nc);
      if (!visited.has(nk) && (costMap[nk] === undefined || newCost < costMap[nk])) {
        costMap[nk] = newCost;
        came[nk] = cur;
        pq.push({ k: nk, cost: newCost });
      }
    }
  }
  return null;
}

export function* dlsGen(grid: any[][], start: string, end: string, limit = 15) {
  const stack = [{ k: start, depth: 0 }];
  const visited = new Map<string, number>(); // key -> minDepth
  const came: Record<string, string> = {};

  while (stack.length) {
    const { k: cur, depth } = stack.pop()!;
    
    if (visited.has(cur) && visited.get(cur)! <= depth) continue;
    visited.set(cur, depth);

    yield { frontier: stack.map(x => x.k), explored: Array.from(visited.keys()), current: cur } as VizStep;
    if (cur === end) return reconstructPath(came, start, end);

    if (depth < limit) {
      const [r, c] = parseKey(cur);
      for (const [nr, nc] of getNeighbors(grid, r, c)) {
        const nk = key(nr, nc);
        came[nk] = cur;
        stack.push({ k: nk, depth: depth + 1 });
      }
    }
  }
  return null;
}

export function* iddfsGen(grid: any[][], start: string, end: string) {
  for (let limit = 0; limit < ROWS * COLS; limit += 2) {
    const gen = dlsGen(grid, start, end, limit);
    let step;
    while (!(step = gen.next()).done) {
      yield { ...step.value, label: `IDDFS: Depth ${limit}` } as VizStep;
    }
    if (step.value) return step.value;
  }
  return null;
}

export function* bidirectionalGen(grid: any[][], start: string, end: string) {
  const fwd = { queue: [start], visited: new Set([start]), came: {} as Record<string, string> };
  const bwd = { queue: [end], visited: new Set([end]), came: {} as Record<string, string> };
  
  while (fwd.queue.length || bwd.queue.length) {
    if (fwd.queue.length) {
      const cur = fwd.queue.shift()!;
      yield { 
        frontier: [...fwd.queue, ...bwd.queue], 
        explored: [...Array.from(fwd.visited), ...Array.from(bwd.visited)], 
        current: cur,
        label: "Scanning Start →"
      } as VizStep;
      
      if (bwd.visited.has(cur)) {
        const p1 = reconstructPath(fwd.came, start, cur);
        const p2 = reconstructPath(bwd.came, end, cur).reverse();
        return [...p1, ...p2.slice(1)];
      }
      const [r, c] = parseKey(cur);
      for (const [nr, nc] of getNeighbors(grid, r, c)) {
        const nk = key(nr, nc);
        if (!fwd.visited.has(nk)) {
          fwd.visited.add(nk);
          fwd.came[nk] = cur;
          fwd.queue.push(nk);
        }
      }
    }
    if (bwd.queue.length) {
      const cur = bwd.queue.shift()!;
      yield { 
        frontier: [...fwd.queue, ...bwd.queue], 
        explored: [...Array.from(fwd.visited), ...Array.from(bwd.visited)], 
        current: cur,
        label: "Scanning Target ←"
      } as VizStep;
      
      if (fwd.visited.has(cur)) {
        const p1 = reconstructPath(fwd.came, start, cur);
        const p2 = reconstructPath(bwd.came, end, cur).reverse();
        return [...p1, ...p2.slice(1)];
      }
      const [r, c] = parseKey(cur);
      for (const [nr, nc] of getNeighbors(grid, r, c)) {
        const nk = key(nr, nc);
        if (!bwd.visited.has(nk)) {
          bwd.visited.add(nk);
          bwd.came[nk] = cur;
          bwd.queue.push(nk);
        }
      }
    }
  }
  return null;
}
