import React from 'react'; // Removed useState
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, MoreVertical as ArrowsOutLineVertical, MoreHorizontal as ArrowsOutLineHorizontal } from 'lucide-react';
import type { WidgetType } from '../store/dashboardSlice';

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

  // Removed showControls state

  // --- Responsive Column Span Logic ---
  let colSpanClass = 'col-span-1';
  if (size.cols === 2) {
    colSpanClass = 'col-span-1 sm:col-span-2';
  } else if (size.cols === 3) {
    colSpanClass = 'col-span-1 sm:col-span-2 lg:col-span-3';
  }

  // --- Inline Styles ---
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    gridRow: `span ${size.rows}`,
    minHeight: type === 'quote' ? '120px' : type === 'calendar' ? '350px' : '200px',
  };

  // --- Resize Handlers ---
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

  // Combine listeners for the drag handle
  const combinedListeners = { ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Apply responsive column span and other base classes
      // Removed onMouseEnter, onMouseLeave, onFocus, onBlur handlers
      // Removed tabIndex={0} and focus styles unless needed for other reasons
      className={`${colSpanClass} relative flex flex-col bg-card text-card-foreground rounded-lg shadow-md ${
        isDragging ? 'shadow-xl opacity-80' : '' // Style while dragging
      } overflow-hidden touch-manipulation`}
      // tabIndex={0} // Optional: Keep if you want the widget itself to be focusable for other reasons
    >
      {/* Controls Overlay - Always Visible */}
      <div
        // Removed conditional opacity/pointer-events based on showControls
        // Removed aria-hidden
        className={`absolute top-1 right-1 flex items-center gap-1 bg-card/80 backdrop-blur-sm p-1 rounded-md opacity-100`}
      >
        <button
          onClick={handleResizeHorizontal}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 touch-manipulation"
          title="Cycle horizontal size"
          aria-label="Cycle horizontal size"
        >
          <ArrowsOutLineHorizontal className="h-4 w-4" />
        </button>
        <button
          onClick={handleResizeVertical}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 touch-manipulation"
          title="Cycle vertical size"
          aria-label="Cycle vertical size"
        >
          <ArrowsOutLineVertical className="h-4 w-4" />
        </button>
        <button
          onClick={handleRemoveClick}
          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted/80 touch-manipulation"
          title="Remove widget"
          aria-label="Remove widget"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {/* Drag Handle */}
        <div
          {...attributes}
          {...combinedListeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/80 touch-manipulation"
          title="Drag to reorder"
          aria-label="Drag handle"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>

      {/* Content Area - Adjust padding top if controls always visible need different spacing */}
      <div className="pt-10 flex-grow flex flex-col"> {/* Increased pt slightly */}
        {/* Ensure children can grow if needed */}
        <div className="flex-grow">
            {children}
        </div>
      </div>
    </div>
  );
}