
export enum CellType {
  EMPTY = 'empty',
  WALL = 'wall',
  START = 'start',
  END = 'end',
  FRONTIER = 'frontier',
  EXPLORED = 'explored',
  PATH = 'path',
  DYNAMIC = 'dynamic'
}

export enum Algorithm {
  BFS = 'BFS',
  DFS = 'DFS',
  UCS = 'UCS',
  DLS = 'DLS',
  IDDFS = 'IDDFS',
  BIDIRECTIONAL = 'Bidirectional'
}

export interface CellData {
  type: CellType;
  r: number;
  c: number;
}

export interface Stats {
  steps: number;
  time: string;
  pathLen: number;
}

export interface VizStep {
  frontier?: string[];
  explored?: string[];
  current?: string;
  label?: string;
}
