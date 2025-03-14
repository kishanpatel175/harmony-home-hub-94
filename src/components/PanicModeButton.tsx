
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";
import { useEffect } from "react";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";

const PanicModeButton = () => {
  const [activating, setActivating] = useState(false);

  const activatePanicMode = async () => {
    if (activating) return;
    
    try {
      setActivating(true);
      
      // Update panic mode status
      const panicModeRef = doc(db, "panic_mode", "current");
      await updateDoc(panicModeRef, {
        is_panic_mode: true,
        activatedAt: serverTimestamp()
      });
      
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
    } catch (error) {
      console.error("Error activating panic mode:", error);
      toast.error("Failed to activate panic mode. Please try again.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <Button 
      variant="destructive" 
      className="w-full flex items-center justify-center gap-2 py-6 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      onClick={activatePanicMode}
      disabled={activating}
    >
      <AlertTriangle className="w-5 h-5" />
      <span className="font-medium">Activate Panic Mode</span>
    </Button>
  );
};

export default PanicModeButton;
