
import { Room, Device } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { Home, SquareDot } from "lucide-react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";

interface RoomCardProps {
  room: Room;
}

const RoomCard: React.FC<RoomCardProps> = ({ room }) => {
  const [activeDevices, setActiveDevices] = useState<number>(0);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDevices = useCallback(async () => {
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
      
      setTotalDevices(deviceList.length);
      const activeCount = deviceList.filter(device => device.device_status === "ON").length;
      setActiveDevices(activeCount);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setIsLoading(false);
    }
  }, [room.roomId]);
  
  useEffect(() => {
    fetchDevices();
    
    // Add event listener for device updates
    const handleDeviceUpdate = () => {
      console.log("Device update detected, refreshing room:", room.room_name);
      fetchDevices();
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, [room.roomId, fetchDevices, room.room_name]);

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
