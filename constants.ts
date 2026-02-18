
import { Algorithm, CellType } from './types';

export const ROWS = 22;
export const COLS = 35;
export const CELL_SIZE = 28;

export const ALGO_INFO: Record<Algorithm, { label: string; desc: string }> = {
  [Algorithm.BFS]: {
    label: "Breadth-First Search",
    desc: "Guarantees shortest path in unweighted grids. Explores neighbors layer by layer."
  },
  [Algorithm.DFS]: {
    label: "Depth-First Search",
    desc: "Explores deep into a branch before backtracking. Memory efficient but doesn't guarantee shortest path."
  },
  [Algorithm.UCS]: {
    label: "Uniform Cost Search",
    desc: "Optimal for weighted grids. Expands nodes by lowest cumulative cost."
  },
  [Algorithm.DLS]: {
    label: "Depth-Limited Search",
    desc: "DFS with a fixed depth limit. Useful for limiting search scope."
  },
  [Algorithm.IDDFS]: {
    label: "Iterative Deepening DFS",
    desc: "Combines DFS space efficiency with BFS optimality by incrementing depth limits."
  },
  [Algorithm.BIDIRECTIONAL]: {
    label: "Bidirectional Search",
    desc: "Runs two simultaneous searches: one from start and one from end to meet in the middle."
  }
};

export const COLORS = {
  [CellType.EMPTY]: '#0d1117',
  [CellType.WALL]: '#21262d',
  [CellType.START]: '#238636',
  [CellType.END]: '#f78166',
  [CellType.FRONTIER]: '#d29922',
  [CellType.EXPLORED]: '#1f4d2e',
  [CellType.PATH]: '#3fb950',
  [CellType.DYNAMIC]: '#8b3a3a',
};
