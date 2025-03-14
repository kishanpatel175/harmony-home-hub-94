
import { Device, CurrentPrivilegedUser } from "@/lib/types";
import { useState, useEffect } from "react";
import { 
  Lightbulb, Fan, Tv, Lock, Refrigerator, Power, Trash2, MoreHorizontal 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DeviceItemProps {
  device: Device;
  canControl: boolean;
  onDeleteDevice: (deviceId: string) => void;
}

const DeviceItem: React.FC<DeviceItemProps> = ({ 
  device, 
  canControl,
  onDeleteDevice 
}) => {
  const [status, setStatus] = useState<"ON" | "OFF">(device.device_status);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [panicMode, setPanicMode] = useState<boolean>(false);
  
  useEffect(() => {
    setStatus(device.device_status);
    
    // Listen for panic mode changes
    const panicModeRef = doc(db, "panic_mode", "current");
    
    const unsubscribe = onSnapshot(panicModeRef, (doc) => {
      if (doc.exists()) {
        setPanicMode(doc.data()?.is_panic_mode || false);
      }
    });
    
    return () => unsubscribe();
  }, [device]);

  const toggleDevice = async () => {
    if (isUpdating || !canControl || panicMode) return;
    
    try {
      setIsUpdating(true);
      const newStatus = status === "ON" ? "OFF" : "ON";
      
      const deviceRef = doc(db, "devices", device.deviceId);
      await updateDoc(deviceRef, {
        device_status: newStatus
      });
      
      setStatus(newStatus);
      toast.success(`${device.device_name} turned ${newStatus}`);
    } catch (error) {
      console.error("Error toggling device:", error);
      toast.error("Failed to update device status");
    } finally {
      setIsUpdating(false);
    }
  };

  const getDeviceIcon = () => {
    switch (device.device_category) {
      case "Light":
        return <Lightbulb className="w-5 h-5" />;
      case "Fan":
        return <Fan className="w-5 h-5" />;
      case "TV":
        return <Tv className="w-5 h-5" />;
      case "Door Lock":
        return <Lock className="w-5 h-5" />;
      case "Refrigerator":
        return <Refrigerator className="w-5 h-5" />;
      default:
        return <Power className="w-5 h-5" />;
    }
  };

  return (
    <div className={cn(
      "glass-card p-4 rounded-xl transition-standard",
      status === "ON" ? "bg-white/90" : "bg-white/60" 
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            status === "ON" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {getDeviceIcon()}
          </div>
          
          <div>
            <h3 className="font-medium">{device.device_name}</h3>
            <p className="text-sm text-muted-foreground">{device.device_category}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch 
            checked={status === "ON"} 
            onCheckedChange={toggleDevice}
            disabled={!canControl || panicMode || isUpdating}
            className={canControl && !panicMode ? "" : "opacity-50 cursor-not-allowed"}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Device Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDeleteDevice(device.deviceId)}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Device</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default DeviceItem;
