
import { Room, Device } from "@/lib/types";
import { useState, useEffect } from "react";
import { Home, SquareDot, Power } from "lucide-react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { toast } from "@/components/ui/sonner";

interface RoomCardProps {
  room: Room;
}

const RoomCard: React.FC<RoomCardProps> = ({ room }) => {
  const [activeDevices, setActiveDevices] = useState<number>(0);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTogglingAll, setIsTogglingAll] = useState<boolean>(false);
  const [allOn, setAllOn] = useState<boolean>(false);

  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const devicesQuery = query(
        collection(db, "devices"),
        where("roomId", "==", room.roomId)
      );
      
      const devicesSnapshot = await getDocs(devicesQuery);
      const deviceList = devicesSnapshot.docs.map(doc => ({
        ...doc.data(),
        deviceId: doc.id
      })) as Device[];
      
      setDevices(deviceList);
      setTotalDevices(deviceList.length);
      const activeCount = deviceList.filter(device => device.device_status === "ON").length;
      setActiveDevices(activeCount);
      setAllOn(activeCount > 0 && activeCount === deviceList.length);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDevices();
  }, [room.roomId]);

  const toggleAllDevices = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isTogglingAll || devices.length === 0) return;
    
    try {
      setIsTogglingAll(true);
      
      // Determine the target state (if any devices are ON, turn all OFF; otherwise turn all ON)
      const newStatus: "ON" | "OFF" = allOn ? "OFF" : "ON";
      
      // Use batch write to update all devices
      const batch = writeBatch(db);
      
      devices.forEach(device => {
        const deviceRef = doc(db, "devices", device.deviceId);
        batch.update(deviceRef, { device_status: newStatus });
      });
      
      await batch.commit();
      
      // Update local state without waiting for a refetch
      const updatedDevices = devices.map(device => ({
        ...device,
        device_status: newStatus
      }));
      
      setDevices(updatedDevices);
      setActiveDevices(newStatus === "ON" ? devices.length : 0);
      setAllOn(newStatus === "ON");
      
      toast.success(`All devices in ${room.room_name} turned ${newStatus.toLowerCase()}`);
      
      // Refresh device data after a short delay to ensure firebase has updated
      setTimeout(() => {
        fetchDevices();
      }, 500);
      
    } catch (error) {
      console.error("Error toggling devices:", error);
      toast.error("Failed to update devices");
    } finally {
      setIsTogglingAll(false);
    }
  };

  return (
    <Link 
      to={`/room/${room.roomId}`}
      className="block transition-standard hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="glass-card p-4 rounded-xl h-full">
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Home className="w-5 h-5 text-primary" />
            </div>
            
            <Toggle
              pressed={allOn}
              disabled={isTogglingAll || totalDevices === 0}
              onClick={toggleAllDevices}
              variant="outline"
              size="sm"
              className={cn(
                isTogglingAll ? 'opacity-50' : '',
                'relative z-10'
              )}
              aria-label={`Toggle all devices in ${room.room_name}`}
            >
              <Power className={cn(
                "h-4 w-4",
                allOn ? "text-primary" : "text-muted-foreground"
              )} />
            </Toggle>
          </div>
          
          <h3 className="font-medium text-lg mb-2">{room.room_name}</h3>
          
          {isLoading ? (
            <div className="h-4 w-16 bg-muted animate-pulse rounded mt-auto" />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-auto">
              <SquareDot className={cn(
                "w-4 h-4", 
                activeDevices > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              <span>
                {totalDevices === 0 
                  ? "No devices" 
                  : `${activeDevices} of ${totalDevices} active`}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default RoomCard;
