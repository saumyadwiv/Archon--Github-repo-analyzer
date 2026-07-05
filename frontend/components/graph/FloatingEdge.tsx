'use client';

import { useCallback } from 'react';
import { useStore, getStraightPath, Position, EdgeProps, ReactFlowState } from 'reactflow';
import { cn } from '@/lib/utils';

interface NodeLike {
  positionAbsolute?: { x: number; y: number };
  width?: number | null;
  height?: number | null;
}

// Finds where the straight line between two node centers crosses the
// rectangular border of `intersectionNode` — i.e. the point where an edge
// should visually start/end so it always takes the shortest path instead of
// detouring through a fixed handle side. Standard floating-edge geometry.
function getNodeIntersection(intersectionNode: NodeLike, targetNode: NodeLike) {
  const w = (intersectionNode.width || 1) / 2;
  const h = (intersectionNode.height || 1) / 2;
  const x2 = (intersectionNode.positionAbsolute?.x || 0) + w;
  const y2 = (intersectionNode.positionAbsolute?.y || 0) + h;
  const x1 = (targetNode.positionAbsolute?.x || 0) + (targetNode.width || 1) / 2;
  const y1 = (targetNode.positionAbsolute?.y || 0) + (targetNode.height || 1) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return { x: w * (xx3 + yy3) + x2, y: h * (-xx3 + yy3) + y2 };
}

function getEdgePosition(node: NodeLike, intersectionPoint: { x: number; y: number }) {
  const nx = Math.round(node.positionAbsolute?.x || 0);
  const ny = Math.round(node.positionAbsolute?.y || 0);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + (node.width || 0) - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + (node.height || 0) - 1) return Position.Bottom;
  return Position.Top;
}

function getEdgeParams(source: NodeLike, target: NodeLike) {
  const sourceIntersection = getNodeIntersection(source, target);
  const targetIntersection = getNodeIntersection(target, source);
  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos: getEdgePosition(source, sourceIntersection),
    targetPos: getEdgePosition(target, targetIntersection),
  };
}

const nodeSelector = (id: string) => (store: ReactFlowState) => store.nodeInternals.get(id);

/** Straight edge whose endpoints are computed geometrically each render, so
 *  lines take the shortest path between two nodes regardless of which side
 *  they happen to sit on — essential for non-hierarchical (Force/Folders)
 *  layouts where a target can be anywhere relative to its source. */
export function FloatingEdge({ id, source, target, style, markerEnd, className }: EdgeProps) {
  const sourceNode = useStore(useCallback(nodeSelector(source), [source]));
  const targetNode = useStore(useCallback(nodeSelector(target), [target]));

  if (!sourceNode || !targetNode || !sourceNode.width || !targetNode.width) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);
  const [edgePath] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  return (
    <path
      id={id}
      className={cn('react-flow__edge-path', className)}
      d={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  );
}
