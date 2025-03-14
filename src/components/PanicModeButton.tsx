
import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { PanicMode } from "@/lib/types";

const PanicModeButton = () => {
  const [activating, setActivating] = useState(false);
  const [isPanicMode, setIsPanicMode] = useState(false);
  
  useEffect(() => {
    // Listen for panic mode changes
    const panicModeRef = doc(db, "panic_mode", "current");
    
    const unsubscribePanic = onSnapshot(panicModeRef, (doc) => {
      if (doc.exists()) {
        setIsPanicMode(doc.data()?.is_panic_mode || false);
      }
    });
    
    return () => {
      unsubscribePanic();
    };
  }, []);

  const togglePanicMode = async () => {
    if (activating) return;
    
    try {
      setActivating(true);
      
      // Update panic mode status
      const panicModeRef = doc(db, "panic_mode", "current");
      await updateDoc(panicModeRef, {
        is_panic_mode: !isPanicMode,
        activatedAt: serverTimestamp()
      });
      
      if (!isPanicMode) {
        // Activate panic mode - turn off devices, unlock doors
        // Get all devices
        const devicesRef = collection(db, "devices");
        const devicesSnapshot = await getDocs(devicesRef);
        
        // Use a batch to update all devices
        const batch = writeBatch(db);
        
        devicesSnapshot.forEach((deviceDoc) => {
          const deviceRef = doc(db, "devices", deviceDoc.id);
          const deviceData = deviceDoc.data();
          
          // Turn off everything except door locks
          if (deviceData.device_category === "Door Lock") {
            batch.update(deviceRef, { device_status: "OFF" }); // Unlock doors
          } else {
            batch.update(deviceRef, { device_status: "OFF" }); // Turn off other devices
          }
        });
        
        await batch.commit();
        
        toast.success("Panic mode activated. All doors unlocked and devices turned off.");
      } else {
        // Deactivate panic mode
        toast.success("Panic mode deactivated.");
      }
      
    } catch (error) {
      console.error("Error toggling panic mode:", error);
      toast.error(`Failed to ${isPanicMode ? 'deactivate' : 'activate'} panic mode. Please try again.`);
    } finally {
      setActivating(false);
    }
  };

  return (
    <Button 
      variant={isPanicMode ? "outline" : "destructive"}
      className={`w-full flex items-center justify-center gap-2 py-6 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
        isPanicMode ? "border-destructive text-destructive" : ""
      }`}
      onClick={togglePanicMode}
      disabled={activating}
    >
      {isPanicMode ? (
        <>
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Deactivate Panic Mode</span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">Activate Panic Mode</span>
        </>
      )}
    </Button>
  );
};

export default PanicModeButton;
