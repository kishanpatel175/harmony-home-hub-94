
import { Device, CurrentPrivilegedUser } from "@/lib/types";
import { useState, useEffect } from "react";
import { 
  Lightbulb, Fan, Tv, Lock, Refrigerator, Power, Trash2, MoreHorizontal, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/firebase";
import { doc, updateDoc, onSnapshot, getDoc } from "firebase/firestore";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";

interface DeviceItemProps {
  device: Device;
  canControl: boolean;
  onDeleteDevice: (deviceId: string) => void;
  isAdmin: boolean;
}

const DeviceItem: React.FC<DeviceItemProps> = ({ 
  device, 
  canControl,
  onDeleteDevice,
  isAdmin
}) => {
  const [status, setStatus] = useState<"ON" | "OFF">(device.device_status);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [panicMode, setPanicMode] = useState<boolean>(false);
  const [privilegedUser, setPrivilegedUser] = useState<string>("");
  const [isAssigned, setIsAssigned] = useState<boolean>(true);
  
  useEffect(() => {
    // Set initial status from device prop
    setStatus(device.device_status);
    
    // Listen for device status changes
    const deviceRef = doc(db, "devices", device.deviceId);
    const unsubscribeDevice = onSnapshot(deviceRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setStatus(data.device_status);
      }
    });
    
    // Listen for panic mode changes
    const panicModeRef = doc(db, "panic_mode", "current");
    const unsubscribePanic = onSnapshot(panicModeRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setPanicMode(docSnapshot.data()?.is_panic_mode || false);
      }
    });
    
    // Listen to current privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const privilegedUserId = data.current_most_privileged_user_id || "";
        setPrivilegedUser(privilegedUserId);
        
        // Check if device is assigned to privileged user
        if (privilegedUserId) {
          // Fix: properly check if the device is assigned to the privileged user
          const isDeviceAssigned = device.assignedMembers.includes(privilegedUserId);
          setIsAssigned(isDeviceAssigned);
          
          // Auto turn off unassigned devices when privileged user changes
          if (!isDeviceAssigned && status === "ON") {
            try {
              const deviceRef = doc(db, "devices", device.deviceId);
              await updateDoc(deviceRef, {
                device_status: "OFF"
              });
              setStatus("OFF");
            } catch (error) {
              console.error("Error turning off unassigned device:", error);
            }
          }
        } else {
          // If no privileged user, allow control of all devices (default behavior)
          setIsAssigned(true);
        }
      }
    });
    
    // Listen for device update events
    const handleDeviceUpdate = () => {
      // Refresh device status
      const refreshDeviceStatus = async () => {
        try {
          const deviceDoc = await getDoc(doc(db, "devices", device.deviceId));
          if (deviceDoc.exists()) {
            setStatus(deviceDoc.data().device_status);
          }
        } catch (error) {
          console.error("Error refreshing device status:", error);
        }
      };
      
      refreshDeviceStatus();
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      unsubscribeDevice();
      unsubscribePanic();
      unsubscribePrivileged();
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, [device]);

  const toggleDevice = async () => {
    // Fix: Remove status from dependency array to avoid old state
    if (isUpdating || !canControl || panicMode) return;
    
    // If there's a privileged user and device is not assigned, don't allow toggling
    if (privilegedUser && !isAssigned) {
      toast.error("Device not assigned to the current privileged user");
      return;
    }
    
    try {
      setIsUpdating(true);
      
      // Get fresh status from Firestore to ensure we're working with latest data
      const deviceDoc = await getDoc(doc(db, "devices", device.deviceId));
      if (!deviceDoc.exists()) {
        toast.error("Device not found");
        return;
      }
      
      const currentStatus = deviceDoc.data().device_status;
      const newStatus = currentStatus === "ON" ? "OFF" : "ON";
      
      const deviceRef = doc(db, "devices", device.deviceId);
      await updateDoc(deviceRef, {
        device_status: newStatus
      });
      
      // Don't set status here, let the onSnapshot handler update it
      toast.success(`${device.device_name} turned ${newStatus}`);
      
      // Notify other components about device status change
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
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
      status === "ON" ? "bg-white/90" : "bg-white/60",
      !isAssigned && privilegedUser ? "border-l-4 border-l-amber-400" : ""
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
          {!isAssigned && privilegedUser ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 mr-1 text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Not assigned to privileged user</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
          
          <Switch 
            checked={status === "ON"} 
            onCheckedChange={toggleDevice}
            disabled={!canControl || panicMode || isUpdating || (privilegedUser && !isAssigned)}
            className={cn(
              canControl && !panicMode && (isAssigned || !privilegedUser) ? "" : "opacity-50 cursor-not-allowed"
            )}
          />
          
          {isAdmin && (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceItem;
