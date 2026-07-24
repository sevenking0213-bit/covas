import type { CSSProperties } from 'react';
import type { WorkspaceAnnotation } from '@covas/shared-types';

const getStroke = (annotation: WorkspaceAnnotation) => String(annotation.style?.stroke ?? '#2563eb');
const getStrokeWidth = (annotation: WorkspaceAnnotation) => Number(annotation.style?.strokeWidth ?? 6);

const sharedShapeProps = {
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function renderAnnotation(annotation: WorkspaceAnnotation) {
  if (annotation.type === 'rect') {
    return (
      <rect
        key={annotation.id}
        x={annotation.geometry.x}
        y={annotation.geometry.y}
        width={annotation.geometry.width}
        height={annotation.geometry.height}
        stroke={getStroke(annotation)}
        strokeWidth={getStrokeWidth(annotation)}
        {...sharedShapeProps}
      />
    );
  }

  if (annotation.type === 'ellipse') {
    return (
      <ellipse
        key={annotation.id}
        cx={annotation.geometry.x + annotation.geometry.width / 2}
        cy={annotation.geometry.y + annotation.geometry.height / 2}
        rx={annotation.geometry.width / 2}
        ry={annotation.geometry.height / 2}
        stroke={getStroke(annotation)}
        strokeWidth={getStrokeWidth(annotation)}
        {...sharedShapeProps}
      />
    );
  }

  if (annotation.type === 'arrow') {
    const [x1, y1, x2, y2] = annotation.geometry.points;
    return (
      <g key={annotation.id}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={getStroke(annotation)}
          strokeWidth={getStrokeWidth(annotation)}
          {...sharedShapeProps}
        />
        <polygon
          points={buildArrowHeadPoints(x1, y1, x2, y2)}
          fill={getStroke(annotation)}
        />
      </g>
    );
  }

  if (annotation.type === 'brush' || annotation.type === 'highlight') {
    return (
      <polyline
        key={annotation.id}
        points={annotation.geometry.points.join(' ')}
        stroke={getStroke(annotation)}
        strokeWidth={getStrokeWidth(annotation)}
        opacity={annotation.type === 'highlight' ? 0.35 : 1}
        {...sharedShapeProps}
      />
    );
  }

  if (annotation.type === 'text') {
    const textStyle: CSSProperties = {
      fill: String(annotation.style?.color ?? '#1d4ed8'),
      fontSize: Number(annotation.style?.fontSize ?? 32),
      fontWeight: 600,
    };

    return (
      <text
        key={annotation.id}
        x={annotation.geometry.x}
        y={annotation.geometry.y}
        dominantBaseline="hanging"
        style={textStyle}
      >
        {annotation.text}
      </text>
    );
  }

  return null;
}

function buildArrowHeadPoints(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = 14;
  const spread = Math.PI / 7;
  const leftX = x2 - length * Math.cos(angle - spread);
  const leftY = y2 - length * Math.sin(angle - spread);
  const rightX = x2 - length * Math.cos(angle + spread);
  const rightY = y2 - length * Math.sin(angle + spread);

  return `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`;
}
