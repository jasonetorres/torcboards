import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, MoreVertical as ArrowsOutLineVertical, MoreHorizontal as ArrowsOutLineHorizontal } from 'lucide-react';
import type { WidgetType } from '../store/dashboardSlice';
import { cn } from '../lib/utils';

interface DashboardWidgetProps {
  id: string;
  type: WidgetType;
  onRemove: () => void;
  size: { cols: number; rows: number };
  onResize: (newSize: { cols: number; rows: number; }) => void;
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

  let colSpanClass = 'col-span-1';
  if (size.cols === 2) {
    colSpanClass = 'col-span-1 sm:col-span-2';
  } else if (size.cols === 3) {
    colSpanClass = 'col-span-1 sm:col-span-2 lg:col-span-3';
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    gridRow: `span ${size.rows}`,
  };

  const handleResizeHorizontal = (event: React.MouseEvent) => {
    event.stopPropagation();
    const maxCols = 3;
    const newCols = size.cols >= maxCols ? 1 : size.cols + 1;
    onResize({ ...size, cols: newCols });
  };

  const handleResizeVertical = (event: React.MouseEvent) => {
    event.stopPropagation();
    const maxRows = 3;
    const newRows = size.rows >= maxRows ? 1 : size.rows + 1;
    onResize({ ...size, rows: newRows });
  };

  const handleRemoveClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onRemove();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        colSpanClass,
        "relative flex flex-col min-h-[200px]",
        "bg-card/80 backdrop-blur-sm shadow-lg border-border/50 text-card-foreground rounded-lg",
        "overflow-hidden touch-manipulation",
        isDragging ? "shadow-xl opacity-80" : ""
      )}
    >
      <div className="absolute top-1 right-1 z-20 flex items-center gap-1 bg-background/70 backdrop-blur-sm p-0.5 rounded-md opacity-100 shadow">
        <button
          onClick={handleResizeHorizontal}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50 touch-manipulation"
          title="Cycle horizontal size"
          aria-label="Cycle horizontal size"
        >
          <ArrowsOutLineHorizontal className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleResizeVertical}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50 touch-manipulation"
          title="Cycle vertical size"
          aria-label="Cycle vertical size"
        >
          <ArrowsOutLineVertical className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleRemoveClick}
          className="text-muted-foreground hover:text-destructive p-0.5 rounded hover:bg-muted/50 touch-manipulation"
          title="Remove widget"
          aria-label="Remove widget"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50 touch-manipulation"
          title="Drag to reorder"
          aria-label="Drag handle"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="p-3 sm:p-4 pt-8 flex-grow flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}