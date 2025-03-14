
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, Users, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PanicMode } from "@/lib/types";

const Navigation = () => {
  const location = useLocation();
  const [panicMode, setPanicMode] = useState<boolean>(false);
  
  useEffect(() => {
    const panicModeRef = doc(db, "panic_mode", "current");
    
    const unsubscribe = onSnapshot(panicModeRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as PanicMode;
        setPanicMode(data.is_panic_mode);
      }
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 px-4 py-2 glass-card border-t border-border/30 transition-standard",
      panicMode ? "bg-destructive/80" : "bg-white/80"
    )}>
      <div className="container mx-auto">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link 
            to="/" 
            className={cn(
              "flex flex-col items-center p-2 rounded-lg transition-standard",
              location.pathname === "/" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Rooms</span>
          </Link>
          
          <Link 
            to="/members" 
            className={cn(
              "flex flex-col items-center p-2 rounded-lg transition-standard",
              location.pathname === "/members" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Members</span>
          </Link>
          
          {panicMode && (
            <div className="flex flex-col items-center p-2 text-destructive-foreground animate-pulse-gentle">
              <AlertTriangle className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Panic Mode</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
