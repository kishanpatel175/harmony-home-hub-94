
import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { PanicMode } from "@/lib/types";

// Create a custom event for device updates
export const deviceUpdateEvent = new EventTarget();
export const DEVICE_UPDATE_EVENT = "device-status-updated";

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
        // Activate panic mode - turn on door locks, turn off all other devices
        // Get all devices
        const devicesRef = collection(db, "devices");
        const devicesSnapshot = await getDocs(devicesRef);
        
        // Use a batch to update all devices
        const batch = writeBatch(db);
        
        devicesSnapshot.forEach((deviceDoc) => {
          const deviceRef = doc(db, "devices", deviceDoc.id);
          const deviceData = deviceDoc.data();
          
          // Turn on door locks (unlock them), turn off everything else
          if (deviceData.device_category === "Door Lock") {
            batch.update(deviceRef, { device_status: "ON" }); // Door locks ON = unlocked
          } else {
            batch.update(deviceRef, { device_status: "OFF" }); // Turn off other devices
          }
        });
        
        await batch.commit();
        
        // Dispatch custom event to notify components that device statuses have changed
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
        
        toast.success("Panic mode activated. All doors unlocked and devices turned off.");
      } else {
        // Deactivate panic mode
        // Also dispatch the event when deactivating
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
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
      className={`w-full flex items-center justify-center gap-2 py-6 rounded-xl transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] ${
        isPanicMode ? 
          "border-destructive text-destructive panic-button-active" : 
          "shadow-lg"
      }`}
      onClick={togglePanicMode}
      disabled={activating}
    >
      {isPanicMode ? (
        <>
          <div className="relative">
            <AlertCircle className="w-5 h-5" />
            <Zap className="w-3 h-3 absolute -top-1 -right-1 text-destructive animate-pulse" />
          </div>
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
