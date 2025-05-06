// src/components/LoadingSpinner.tsx
import { Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils"; // Assuming you have the cn utility from shadcn

interface LoadingSpinnerProps {
  size?: number; // Optional size prop
  className?: string; // Allow passing additional classes
}

const LoadingSpinner = ({ size = 24, className }: LoadingSpinnerProps) => {
  return (
    <Loader2
      className={cn("animate-spin text-primary", className)} // Apply animation and base color
      style={{ width: `${size}px`, height: `${size}px` }} // Use style for dynamic size
    />
  );
};

// Optional: A component to center the spinner on the page
export const CenteredLoadingSpinner = ({ size = 36 }: { size?: number }) => {
   return (
     <div className="flex justify-center items-center min-h-screen w-full">
         <LoadingSpinner size={size} />
     </div>
   );
}

export default LoadingSpinner;