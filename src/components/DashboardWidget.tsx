import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical as ArrowsOutLineVertical, MoreHorizontal as ArrowsOutLineHorizontal } from 'lucide-react';
import type { WidgetType } from '../store/useDashboardStore';

interface DashboardWidgetProps {
  id: string;
  type: WidgetType;
  onRemove: () => void;
  size: { cols: number; rows: number };
  onResize: (size: { cols: number; rows: number }) => void;
  children: React.ReactNode;
}

export function DashboardWidget({ 
  id, 
  type, 
  onRemove, 
  size,
  onResize,
  children 
}: DashboardWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const [showControls, setShowControls] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    gridColumn: `span ${size.cols}`,
    gridRow: `span ${size.rows}`,
    minHeight: type === 'quote' ? '100px' : type === 'calendar' ? '350px' : '200px',
  };

  const handleResizeHorizontal = () => {
    const newCols = size.cols === 3 ? 1 : size.cols + 1;
    onResize({ ...size, cols: newCols });
  };

  const handleResizeVertical = () => {
    const newRows = size.rows === 3 ? 1 : size.rows + 1;
    onResize({ ...size, rows: newRows });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-card text-card-foreground p-4 rounded-lg shadow-md ${
        isDragging ? 'shadow-lg' : ''
      } overflow-hidden touch-manipulation`}
      onTouchStart={() => setShowControls(true)}
    >
      <div 
        className={`absolute top-2 right-2 flex items-center gap-1 sm:gap-2 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 sm:opacity-100'
        }`}
      >
        <button
          onClick={handleResizeHorizontal}
          className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted/80 touch-manipulation"
          title="Resize horizontally"
        >
          <ArrowsOutLineHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={handleResizeVertical}
          className="text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted/80 touch-manipulation"
          title="Resize vertically"
        >
          <ArrowsOutLineVertical className="h-4 w-4" />
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-2 rounded-full hover:bg-muted/80 touch-manipulation"
        >
          ✕
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-2 rounded-full hover:bg-muted/80 touch-manipulation"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      <div className="pt-12 sm:pt-8">
        {children}
      </div>
    </div>
  );
}