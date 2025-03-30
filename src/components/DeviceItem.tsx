import { Device, CurrentPrivilegedUser } from "@/lib/types";
import { useState, useEffect } from "react";
import { 
  Lightbulb, Fan, Tv, Lock, Refrigerator, Power, Trash2, MoreHorizontal, AlertTriangle, Users, Pin, Save
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  
  const [isPinDialogOpen, setIsPinDialogOpen] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>(device.pin || "X");
  const [isSavingPin, setIsSavingPin] = useState<boolean>(false);
  
  useEffect(() => {
    setStatus(device.device_status);
    
    const deviceRef = doc(db, "devices", device.deviceId);
    const unsubscribeDevice = onSnapshot(deviceRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setStatus(data.device_status);
        setNewPin(data.pin || "X");
      }
    });
    
    const panicModeRef = doc(db, "panic_mode", "current");
    const unsubscribePanic = onSnapshot(panicModeRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setPanicMode(docSnapshot.data()?.is_panic_mode || false);
      }
    });
    
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const privilegedUserId = data.current_most_privileged_user_id || "";
        setPrivilegedUser(privilegedUserId);
        
        if (privilegedUserId) {
          const isDeviceAssigned = device.assignedMembers.includes(privilegedUserId);
          setIsAssigned(isDeviceAssigned);
          
          if (!isDeviceAssigned && status === "ON" && !isAdmin) {
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
          setIsAssigned(true);
        }
      }
    });
    
    const handleDeviceUpdate = () => {
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
  }, [device, isAdmin]);

  const toggleDevice = async () => {
    if (isUpdating || !canControl || panicMode) {
      return;
    }
    
    if (privilegedUser && !isAssigned && !isAdmin) {
      toast.error("Device not assigned to the current privileged user");
      return;
    }
    
    try {
      setIsUpdating(true);
      
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
      
      toast.success(`${device.device_name} turned ${newStatus}`);
      
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error toggling device:", error);
      toast.error("Failed to update device status");
    } finally {
      setIsUpdating(false);
    }
  };

  const updateDevicePin = async () => {
    if (!isAdmin || isSavingPin) {
      return;
    }
    
    try {
      setIsSavingPin(true);
      
      if (newPin !== "X" && !/^\d+$/.test(newPin)) {
        toast.error("Pin must be a number or 'X' for unassigned");
        return;
      }
      
      const deviceRef = doc(db, "devices", device.deviceId);
      await updateDoc(deviceRef, {
        pin: newPin
      });
      
      toast.success(`Pin updated for ${device.device_name}`);
      setIsPinDialogOpen(false);
      
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error updating device pin:", error);
      toast.error("Failed to update pin");
    } finally {
      setIsSavingPin(false);
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

  const isControlDisabled = !canControl || panicMode || isUpdating || (!isAdmin && privilegedUser && !isAssigned);
  const controlRestrictionReason = !canControl ? 
    "No members present in home" : 
    (panicMode ? "Panic mode active" : 
      (!isAdmin && privilegedUser && !isAssigned ? "Not assigned to privileged user" : ""));

  return (
    <div className={cn(
      "glass-card p-4 rounded-xl transition-standard",
      status === "ON" ? "bg-white/90" : "bg-white/60",
      !isAssigned && privilegedUser && !isAdmin ? "border-l-4 border-l-amber-400" : "",
      !canControl && !isAdmin ? "border-l-4 border-l-amber-400" : ""
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{device.device_category}</span>
              {isAdmin && (
                <button 
                  onClick={() => setIsPinDialogOpen(true)}
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors",
                    device.pin === "X" ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                  )}
                >
                  <Pin className="w-3 h-3" />
                  {device.pin === "X" ? "No Pin" : `Pin: ${device.pin}`}
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isControlDisabled && controlRestrictionReason && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 mr-1 text-amber-500">
                    {!canControl && !isAdmin ? 
                      <Users className="w-4 h-4" /> : 
                      <AlertTriangle className="w-4 h-4" />
                    }
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{controlRestrictionReason}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <Switch 
            checked={status === "ON"} 
            onCheckedChange={toggleDevice}
            disabled={isControlDisabled}
            className={cn(
              !isControlDisabled ? "" : "opacity-50 cursor-not-allowed"
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
                <DropdownMenuItem onClick={() => setIsPinDialogOpen(true)}>
                  <Pin className="mr-2 h-4 w-4" />
                  <span>Edit Pin Number</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDeleteDevice(device.deviceId)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Device</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Pin Number</DialogTitle>
            <DialogDescription>
              Set the Raspberry Pi pin number for this device. Use "X" if the device has no pin assigned.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label htmlFor="pin-number" className="text-sm font-medium">
                Pin Number
              </label>
              <Input
                id="pin-number"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter pin number or X"
              />
              <p className="text-xs text-muted-foreground">
                Valid values: Numbers (1, 2, 3, etc.) or "X" for unassigned
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={updateDevicePin}
              disabled={isSavingPin}
              className="gap-2"
            >
              {isSavingPin ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Pin</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceItem;
