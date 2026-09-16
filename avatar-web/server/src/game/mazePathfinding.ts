/**
 * mazePathfinding.ts — Thuật toán tìm đường & điều hướng trong Mê cung Avatar HD (Map 28).
 *
 * Tọa độ Avatar:
 * - Tile size chuẩn: 24x24 px.
 * - Hướng di chuyển (Base.direct native):
 *   0 = Phải (RIGHT)
 *   1 = Xuống (DOWN)
 *   2 = Trái (LEFT)
 *   3 = Lên (UP)
 */

export interface Point {
  x: number;
  y: number;
}

export interface Waypoint {
  x: number;
  y: number;
  direct: number;
}

export interface PathfindingResult {
  reachable: boolean;
  distance: number;
  waypoints: Waypoint[];
}

export const TILE_SIZE = 24;

export const DIRECTION = Object.freeze({
  RIGHT: 0,
  DOWN: 1,
  LEFT: 2,
  UP: 3,
} as const);

export type MovementDirection = (typeof DIRECTION)[keyof typeof DIRECTION];

/** Chuyển tọa độ pixel sang tọa độ ô tile */
export function pixelToTile(p: Point): Point {
  return {
    x: Math.floor(p.x / TILE_SIZE),
    y: Math.floor(p.y / TILE_SIZE),
  };
}

/** Chuyển tọa độ ô tile sang tâm của ô pixel */
export function tileToPixelCenter(p: Point): Point {
  return {
    x: p.x * TILE_SIZE + Math.floor(TILE_SIZE / 2),
    y: p.y * TILE_SIZE + Math.floor(TILE_SIZE / 2),
  };
}

/**
 * Xác định hướng di chuyển giữa 2 điểm pixel kế tiếp.
 */
export function getMovementDirection(from: Point, to: Point): MovementDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? DIRECTION.RIGHT : DIRECTION.LEFT;
  }
  return dy >= 0 ? DIRECTION.DOWN : DIRECTION.UP;
}

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent?: Node;
  direct: number;
}

/**
 * Tìm đường đi ngắn nhất từ start tới target bằng thuật toán A*.
 *
 * @param start Tọa độ pixel bắt đầu của Avatar.
 * @param target Tọa độ pixel đích đến (rương hoặc quà).
 * @param isObstacle Hàm kiểm tra ô (tileX, tileY) có phải tường/chướng ngại vật không.
 * @param maxSearchDepth Số bước mở rộng tối đa (mặc định 2000 ô).
 */
export function findMazePath(
  start: Point,
  target: Point,
  isObstacle: (tileX: number, tileY: number) => boolean,
  maxSearchDepth = 2500,
): PathfindingResult {
  const startTile = pixelToTile(start);
  const targetTile = pixelToTile(target);

  if (startTile.x === targetTile.x && startTile.y === targetTile.y) {
    return {
      reachable: true,
      distance: 0,
      waypoints: [
        {
          x: target.x,
          y: target.y,
          direct: getMovementDirection(start, target),
        },
      ],
    };
  }

  const openSet: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: startTile.x,
    y: startTile.y,
    g: 0,
    h: Math.abs(startTile.x - targetTile.x) + Math.abs(startTile.y - targetTile.y),
    f: 0,
    direct: 0,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const keyOf = (x: number, y: number): string => `${x},${y}`;

  // 4 hướng di chuyển: Phải (0), Xuống (1), Trái (2), Lên (3)
  const MOVES = [
    { dx: 1, dy: 0, dir: DIRECTION.RIGHT },
    { dx: 0, dy: 1, dir: DIRECTION.DOWN },
    { dx: -1, dy: 0, dir: DIRECTION.LEFT },
    { dx: 0, dy: -1, dir: DIRECTION.UP },
  ];

  let iterations = 0;
  let bestNode: Node | undefined;

  while (openSet.length > 0 && iterations < maxSearchDepth) {
    iterations++;

    // Lấy node có f nhỏ nhất
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i]!.f < openSet[lowestIdx]!.f) {
        lowestIdx = i;
      }
    }
    const current = openSet.splice(lowestIdx, 1)[0]!;

    // Kiểm tra đã đến đích
    if (current.x === targetTile.x && current.y === targetTile.y) {
      bestNode = current;
      break;
    }

    closedSet.add(keyOf(current.x, current.y));

    for (const move of MOVES) {
      const nx = current.x + move.dx;
      const ny = current.y + move.dy;
      const nKey = keyOf(nx, ny);

      if (closedSet.has(nKey)) continue;

      // Cho phép đi vào ô đích ngay cả khi ô đích có vật thể rương đứng chặn
      const isTarget = nx === targetTile.x && ny === targetTile.y;
      if (!isTarget && isObstacle(nx, ny)) continue;

      const tentativeG = current.g + 1;
      const existing = openSet.find((n) => n.x === nx && n.y === ny);

      if (!existing) {
        const h = Math.abs(nx - targetTile.x) + Math.abs(ny - targetTile.y);
        const neighbor: Node = {
          x: nx,
          y: ny,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
          direct: move.dir,
        };
        openSet.push(neighbor);
      } else if (tentativeG < existing.g) {
        existing.g = tentativeG;
        existing.f = tentativeG + existing.h;
        existing.parent = current;
        existing.direct = move.dir;
      }
    }
  }

  if (!bestNode) {
    return {
      reachable: false,
      distance: -1,
      waypoints: [],
    };
  }

  // Truy vết ngược lộ trình
  const tilePath: Array<{ x: number; y: number; direct: number }> = [];
  let curr: Node | undefined = bestNode;
  while (curr?.parent) {
    tilePath.push({ x: curr.x, y: curr.y, direct: curr.direct });
    curr = curr.parent;
  }
  tilePath.reverse();

  // Chuyển tilePath thành danh sách Waypoints pixel
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < tilePath.length; i++) {
    const step = tilePath[i]!;
    if (i === tilePath.length - 1) {
      // Điểm cuối cùng là tọa độ thực của target
      waypoints.push({
        x: target.x,
        y: target.y,
        direct: step.direct,
      });
    } else {
      const center = tileToPixelCenter(step);
      waypoints.push({
        x: center.x,
        y: center.y,
        direct: step.direct,
      });
    }
  }

  return {
    reachable: true,
    distance: waypoints.length,
    waypoints,
  };
}
