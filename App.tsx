
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Algorithm, 
  CellType, 
  CellData, 
  Stats, 
  VizStep,
  Heuristic
} from './types';
import { 
  CELL_SIZE, 
  ALGO_INFO, 
  COLORS 
} from './constants';
import * as Algs from './algorithms';

const createInitialGrid = (rows: number, cols: number) => {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({ type: CellType.EMPTY, r, c }))
  );
};

const App: React.FC = () => {
  const [rows, setRows] = useState(20);
  const [cols, setCols] = useState(30);
  const [grid, setGrid] = useState<CellData[][]>(() => createInitialGrid(20, 30));
  const [startCell, setStartCell] = useState<string | null>(null);
  const [endCell, setEndCell] = useState<string | null>(null);
  const [algo, setAlgo] = useState<Algorithm>(Algorithm.ASTAR);
  const [heuristic, setHeuristic] = useState<Heuristic>(Heuristic.MANHATTAN);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [mode, setMode] = useState<'wall' | 'start' | 'end'>('wall');
  const [speed, setSpeed] = useState(30);
  const [dynProb, setDynProb] = useState(0.01);
  const [obstacleDensity, setObstacleDensity] = useState(0.3);
  const [stepCount, setStepCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Configure grid then click Run.");
  const [mouseDown, setMouseDown] = useState(false);

  const genRef = useRef<Generator<VizStep, string[] | null, unknown> | null>(null);
  const intervalRef = useRef<number | null>(null);
  const gridRef = useRef(grid);
  const startRef = useRef(startCell);
  const endRef = useRef(endCell);
  const currentPathRef = useRef<string[]>([]);
  const agentPosRef = useRef<string | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { startRef.current = startCell; }, [startCell]);
  useEffect(() => { endRef.current = endCell; }, [endCell]);

  const stopSearch = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const clearVisualization = useCallback((keepWalls = true) => {
    setGrid(prev => prev.map(row => 
      row.map(cell => {
        if ([CellType.FRONTIER, CellType.EXPLORED, CellType.PATH].includes(cell.type)) {
          return { ...cell, type: CellType.EMPTY };
        }
        if (!keepWalls && cell.type === CellType.WALL) return { ...cell, type: CellType.EMPTY };
        return cell;
      })
    ));
    setDone(false);
    setStats(null);
    setStepCount(0);
    currentPathRef.current = [];
    agentPosRef.current = null;
  }, []);

  const resetAll = useCallback(() => {
    stopSearch();
    setGrid(createInitialGrid(rows, cols));
    setStartCell(null);
    setEndCell(null);
    setDone(false);
    setStats(null);
    setStepCount(0);
    setStatusMsg("Grid reset. Draw walls or set start/target.");
  }, [stopSearch, rows, cols]);

  useEffect(() => {
    resetAll();
  }, [rows, cols]);

  const handleCellAction = useCallback((r: number, c: number) => {
    if (running) return;
    setGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      const target = next[r][c];
      const k = Algs.key(r, c);

      if (mode === 'wall') {
        if (target.type === CellType.EMPTY) target.type = CellType.WALL;
        else if (target.type === CellType.WALL) target.type = CellType.EMPTY;
      } else if (mode === 'start') {
        if (startRef.current) {
          const [sr, sc] = Algs.parseKey(startRef.current);
          if (next[sr] && next[sr][sc]) next[sr][sc].type = CellType.EMPTY;
        }
        target.type = CellType.START;
        setStartCell(k);
      } else if (mode === 'end') {
        if (endRef.current) {
          const [er, ec] = Algs.parseKey(endRef.current);
          if (next[er] && next[er][ec]) next[er][ec].type = CellType.EMPTY;
        }
        target.type = CellType.END;
        setEndCell(k);
      }
      return next;
    });
  }, [mode, running]);

  const generateMaze = useCallback(() => {
    if (running) return;
    const next = createInitialGrid(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < obstacleDensity) next[r][c].type = CellType.WALL;
      }
    }
    setGrid(next);
    setStartCell(null);
    setEndCell(null);
    setStatusMsg(`Random maze generated with ${Math.round(obstacleDensity * 100)}% density.`);
  }, [running, rows, cols, obstacleDensity]);

  const runSearch = useCallback((fromPos?: string) => {
    const start = fromPos || startRef.current;
    if (!start || !endRef.current) {
      setStatusMsg("Set Start and Target points first!");
      return;
    }
    
    if (!fromPos) {
      stopSearch();
      clearVisualization();
      setRunning(true);
    }
    
    setStatusMsg(`Running ${algo}...`);

    let workingGrid = gridRef.current.map(row => row.map(cell => ({ ...cell })));
    
    let genFn: any;
    switch(algo) {
      case Algorithm.BFS: genFn = Algs.bfsGen; break;
      case Algorithm.DFS: genFn = Algs.dfsGen; break;
      case Algorithm.UCS: genFn = Algs.ucsGen; break;
      case Algorithm.GBFS: genFn = (g: any, s: any, e: any) => Algs.gbfsGen(g, s, e, heuristic); break;
      case Algorithm.ASTAR: genFn = (g: any, s: any, e: any) => Algs.astarGen(g, s, e, heuristic); break;
      case Algorithm.DLS: genFn = Algs.dlsGen; break;
      case Algorithm.IDDFS: genFn = Algs.iddfsGen; break;
      case Algorithm.BIDIRECTIONAL: genFn = Algs.bidirectionalGen; break;
      default: genFn = Algs.bfsGen;
    }

    genRef.current = genFn(workingGrid, start, endRef.current);
    const startTime = performance.now();
    let currentSteps = stepCount;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      // Dynamic obstacle logic
      if (Math.random() < dynProb) {
        const dr = Math.floor(Math.random() * rows);
        const dc = Math.floor(Math.random() * cols);
        if (workingGrid[dr][dc].type === CellType.EMPTY) {
          workingGrid[dr][dc].type = CellType.DYNAMIC;
          const dk = Algs.key(dr, dc);
          
          setGrid(prev => {
            const ng = prev.map(row => row.map(cell => ({...cell})));
            ng[dr][dc].type = CellType.DYNAMIC;
            return ng;
          });

          // Re-planning check: if obstacle is on the current path
          if (currentPathRef.current.includes(dk)) {
            setStatusMsg("Obstacle blocked path! Re-planning...");
            if (agentPosRef.current) {
              runSearch(agentPosRef.current);
              return;
            }
          }
        }
      }

      const res = genRef.current!.next();
      currentSteps++;
      setStepCount(currentSteps);

      if (res.done) {
        const elapsed = performance.now() - startTime;
        if (res.value) {
          const path = res.value as string[];
          currentPathRef.current = path;
          setStats({ 
            steps: currentSteps, 
            time: elapsed.toFixed(1), 
            pathLen: path.length 
          });
          setStatusMsg(`Path found! Length: ${path.length}. Agent moving...`);
          
          // Start agent movement simulation
          let pathIdx = 0;
          if (intervalRef.current) clearInterval(intervalRef.current);
          
          intervalRef.current = window.setInterval(() => {
            if (pathIdx >= path.length) {
              stopSearch();
              setDone(true);
              setStatusMsg("Goal reached!");
              return;
            }

            const pos = path[pathIdx];
            agentPosRef.current = pos;
            const [pr, pc] = Algs.parseKey(pos);
            
            // Check if current position was hit by dynamic obstacle
            if (gridRef.current[pr][pc].type === CellType.DYNAMIC) {
               setStatusMsg("Agent hit by obstacle! Re-planning...");
               runSearch(path[Math.max(0, pathIdx - 1)]);
               return;
            }

            setGrid(prev => prev.map(row => row.map(cell => {
              const k = Algs.key(cell.r, cell.c);
              if (k === pos) return { ...cell, type: CellType.START };
              if (path.includes(k) && cell.type !== CellType.START && cell.type !== CellType.END) {
                return { ...cell, type: CellType.PATH };
              }
              return cell;
            })));
            pathIdx++;
          }, speed);

        } else {
          stopSearch();
          setDone(true);
          setStatusMsg("No path possible.");
          setStats({ steps: currentSteps, time: elapsed.toFixed(1), pathLen: 0 });
        }
        return;
      }

      const { frontier, explored, label } = res.value as VizStep;
      if (label) setStatusMsg(label);

      setGrid(prev => prev.map(row => row.map(cell => {
        const k = Algs.key(cell.r, cell.c);
        if (cell.type === CellType.START || cell.type === CellType.END || cell.type === CellType.WALL || cell.type === CellType.DYNAMIC) {
          return cell;
        }
        if (frontier?.includes(k)) return { ...cell, type: CellType.FRONTIER };
        if (explored?.includes(k)) return { ...cell, type: CellType.EXPLORED };
        return cell;
      })));

    }, speed);
  }, [algo, heuristic, speed, dynProb, rows, cols, stepCount, stopSearch, clearVisualization]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex flex-col font-mono-custom selection:bg-blue-500/30">
      {/* Navbar */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">PathMatrix <span className="text-blue-500 italic">Pro</span></h1>
            <p className="text-[10px] text-[#8b949e] uppercase tracking-widest mt-1">Advanced AI Visualizer</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(Algorithm) as Array<keyof typeof Algorithm>).map(k => (
            <button
              key={k}
              disabled={running}
              onClick={() => setAlgo(Algorithm[k])}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-all border ${
                algo === Algorithm[k] 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-inner' 
                  : 'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:border-[#8b949e]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {Algorithm[k]}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={generateMaze}
            disabled={running}
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
          >
            Maze
          </button>
          <button 
            onClick={running ? stopSearch : () => runSearch()}
            className={`${running ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white px-6 py-1.5 rounded text-xs font-bold transition-colors`}
          >
            {running ? 'Stop' : 'Run Search'}
          </button>
          <button 
            onClick={resetAll}
            className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white px-4 py-1.5 rounded text-xs font-bold"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Control Bar */}
      <div className="bg-[#0d1117] border-b border-[#30363d] px-6 py-2 flex flex-wrap items-center gap-8 text-[11px] text-[#8b949e]">
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-tighter font-bold text-[#58a6ff]">Mode:</span>
          <div className="flex gap-1">
            {['wall', 'start', 'end'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className={`px-2 py-1 rounded capitalize border transition-all ${
                  mode === m 
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                    : 'border-transparent hover:border-[#30363d]'
                }`}
              >
                {m === 'wall' ? '✏️ Walls' : m === 'start' ? '🟢 Start' : '🎯 Target'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span>Speed: {speed}ms</span>
          <input 
            type="range" min="1" max="200" 
            value={speed} 
            onChange={e => setSpeed(+e.target.value)}
            className="w-24 accent-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <span>Dynamic: {(dynProb * 100).toFixed(1)}%</span>
          <input 
            type="range" min="0" max="50" 
            value={dynProb * 1000} 
            onChange={e => setDynProb(+e.target.value / 1000)}
            className="w-24 accent-red-500"
          />
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span> Steps: <span className="text-white font-bold">{stepCount}</span>
          </div>
          {stats && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Path: <span className="text-white font-bold">{stats.pathLen}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> {stats.time}ms
              </div>
            </>
          )}
        </div>
      </div>

      {/* Settings Bar */}
      <div className="bg-[#0d1117] border-b border-[#30363d] px-6 py-2 flex flex-wrap items-center gap-8 text-[11px] text-[#8b949e]">
        <div className="flex items-center gap-3">
          <span className="uppercase tracking-tighter font-bold text-[#58a6ff]">Grid:</span>
          <div className="flex items-center gap-2">
            <input 
              type="number" min="5" max="50" value={rows} 
              onChange={e => setRows(Math.min(50, Math.max(5, +e.target.value)))}
              className="w-12 bg-[#161b22] border border-[#30363d] rounded px-1 text-white"
            />
            <span>x</span>
            <input 
              type="number" min="5" max="80" value={cols} 
              onChange={e => setCols(Math.min(80, Math.max(5, +e.target.value)))}
              className="w-12 bg-[#161b22] border border-[#30363d] rounded px-1 text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="uppercase tracking-tighter font-bold text-[#58a6ff]">Heuristic:</span>
          <select 
            value={heuristic} 
            onChange={e => setHeuristic(e.target.value as Heuristic)}
            className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-white outline-none"
          >
            {Object.values(Heuristic).map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="uppercase tracking-tighter font-bold text-[#58a6ff]">Density:</span>
          <input 
            type="range" min="0" max="80" 
            value={obstacleDensity * 100} 
            onChange={e => setObstacleDensity(+e.target.value / 100)}
            className="w-24 accent-emerald-500"
          />
          <span>{Math.round(obstacleDensity * 100)}%</span>
        </div>
      </div>

      {/* Main Layout */}
      <main className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
        {/* Info Sidebar */}
        <aside className="w-full md:w-64 space-y-6">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              {ALGO_INFO[algo].label}
            </h3>
            <p className="text-xs text-[#8b949e] leading-relaxed">
              {ALGO_INFO[algo].desc}
            </p>
          </div>

          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
            <h3 className="text-xs font-bold text-[#8b949e] uppercase tracking-widest mb-3">Legend</h3>
            <div className="space-y-2 text-[10px]">
              {Object.entries(COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-sm border border-white/10" style={{ backgroundColor: color }}></div>
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-3 text-[10px] text-blue-400">
             <strong>Tip:</strong> Drag to paint walls. Click Start/Target button then click grid to move them.
          </div>
        </aside>

        {/* Grid Container */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-auto">
          <div className="bg-[#161b22] p-4 rounded-xl shadow-2xl border border-[#30363d]">
            <div 
              className="grid gap-[1px] bg-[#30363d] border border-[#30363d]"
              style={{ 
                gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                userSelect: 'none'
              }}
              onMouseDown={() => setMouseDown(true)}
              onMouseUp={() => setMouseDown(false)}
              onMouseLeave={() => setMouseDown(false)}
            >
              {grid.flat().map((cell) => (
                <div
                  key={`${cell.r}-${cell.c}`}
                  onMouseDown={() => handleCellAction(cell.r, cell.c)}
                  onMouseEnter={() => mouseDown && mode === 'wall' && handleCellAction(cell.r, cell.c)}
                  style={{ 
                    width: CELL_SIZE, 
                    height: CELL_SIZE, 
                    backgroundColor: COLORS[cell.type],
                  }}
                  className={`
                    flex items-center justify-center text-[10px] font-bold transition-all duration-100
                    ${cell.type === CellType.EMPTY ? 'hover:bg-[#1c2128]' : ''}
                    ${cell.type === CellType.START || cell.type === CellType.END ? 'text-black' : 'text-white/20'}
                  `}
                >
                  {cell.type === CellType.START && 'S'}
                  {cell.type === CellType.END && 'T'}
                  {cell.type === CellType.DYNAMIC && '⚡'}
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 px-6 py-2 bg-[#161b22] border border-[#30363d] rounded-full text-xs text-blue-400 animate-pulse">
            {statusMsg}
          </div>
        </div>
      </main>

      <footer className="px-6 py-3 border-t border-[#30363d] text-[10px] text-[#484f58] flex justify-between">
        <div>&copy; 2024 PathMatrix Pro Systems</div>
        <div>Engineered with Gemini Intelligence</div>
      </footer>
    </div>
  );
};

export default App;
