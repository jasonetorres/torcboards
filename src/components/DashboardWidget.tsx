import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, MoreVertical as ArrowsOutLineVertical, MoreHorizontal as ArrowsOutLineHorizontal } from 'lucide-react';
import type { WidgetType } from '../store/dashboardSlice';
import { cn } from '../lib/utils'; // Assuming you have cn utility

interface DashboardWidgetProps {
  id: string;
  type: WidgetType; // Keep type for potential future styling based on type
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

  // Responsive Column Span Logic (same as before)
  let colSpanClass = 'col-span-1';
  if (size.cols === 2) {
    colSpanClass = 'col-span-1 sm:col-span-2';
  } else if (size.cols === 3) {
    colSpanClass = 'col-span-1 sm:col-span-2 lg:col-span-3';
  }

  // Inline Styles for DND and grid (same as before)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    gridRow: `span ${size.rows}`,
    // minHeight can be managed by content or specific widget styling if needed
    // minHeight: type === 'quote' ? '120px' : type === 'aiCalendar' ? '350px' : '200px',
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
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // --- Main Card Styling Applied Here ---
      className={cn(
        colSpanClass,
        "relative flex flex-col",
        "bg-card/80 backdrop-blur-sm shadow-lg border-border/50 text-card-foreground rounded-lg", // Consistent card styling
        "overflow-hidden touch-manipulation", // Base classes
        isDragging ? "shadow-xl opacity-80" : "" // Dragging style
      )}
    >
      {/* Controls Overlay - Remains similar */}
      <div
        className="absolute top-1 right-1 z-20 flex items-center gap-1 bg-background/70 backdrop-blur-sm p-1 rounded-md opacity-100 shadow"
      >
        <button
          onClick={handleResizeHorizontal}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 touch-manipulation"
          title="Cycle horizontal size"
          aria-label="Cycle horizontal size"
        >
          <ArrowsOutLineHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={handleResizeVertical}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 touch-manipulation"
          title="Cycle vertical size"
          aria-label="Cycle vertical size"
        >
          <ArrowsOutLineVertical className="h-4 w-4" />
        </button>
        <button
          onClick={handleRemoveClick}
          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted/50 touch-manipulation"
          title="Remove widget"
          aria-label="Remove widget"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 touch-manipulation"
          title="Drag to reorder"
          aria-label="Drag handle"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Content Area - This will now hold the direct widget content */}
      {/* Apply consistent padding similar to CardBody */}
      <div className="p-4 sm:p-6 pt-10 flex-grow flex flex-col overflow-y-auto">
        {/* pt-10 ensures content is below controls overlay */}
        {/* The children (widget content) will fill this area */}
        {children}
      </div>
    </div>
  );
}