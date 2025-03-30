
import { Room, Device } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { Home, SquareDot, Sparkles, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";

interface RoomCardProps {
  room: Room;
  isAdmin?: boolean;
  hasPresentMembers?: boolean;
}

const RoomCard: React.FC<RoomCardProps> = ({ 
  room, 
  isAdmin = false,
  hasPresentMembers = true
}) => {
  const [activeDevices, setActiveDevices] = useState<number>(0);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasAnimated, setHasAnimated] = useState<boolean>(false);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const canControl = isAdmin || hasPresentMembers;

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const devicesQuery = query(
        collection(db, "devices"),
        where("roomId", "==", room.roomId)
      );
      
      // Make sure we're getting fresh data from the server 
      const devicesSnapshot = await getDocs(devicesQuery);
      const deviceList = devicesSnapshot.docs.map(doc => ({
        ...doc.data(),
        deviceId: doc.id
      })) as Device[];
      
      setTotalDevices(deviceList.length);
      const activeCount = deviceList.filter(device => device.device_status === "ON").length;
      setActiveDevices(activeCount);
      
      // Set animation flag when data is loaded
      if (!hasAnimated) {
        setHasAnimated(true);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setIsLoading(false);
    }
  }, [room.roomId, hasAnimated]);
  
  useEffect(() => {
    fetchDevices();
    
    // Enhanced event listener to handle all types of updates with appropriate response
    const handleDeviceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      // If this is a privileged user change, force an immediate update
      if (customEvent.detail?.type === 'privileged_user_changed' || 
          customEvent.detail?.type === 'privileged_user_document_changed') {
        console.log("Privileged user changed, refreshing room immediately:", room.room_name);
        setForceUpdate(prev => prev + 1);
        fetchDevices();
      } else {
        // Normal device update
        console.log("Device update detected, refreshing room:", room.room_name);
        fetchDevices();
      }
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, [room.roomId, fetchDevices, room.room_name, forceUpdate]);

  return (
    <Link 
      to={`/room/${room.roomId}`}
      className={cn(
        "block transition-standard hover:scale-[1.02] active:scale-[0.98]",
        hasAnimated ? "animate-fade-in" : ""
      )}
      style={{ 
        animationDelay: `${Math.random() * 0.5}s`
      }}
    >
      <div className={cn(
        "neo-card p-4 rounded-xl h-full", 
        activeDevices > 0 ? "border-l-4 border-l-primary" : "",
        !canControl && !isAdmin ? "border border-amber-400/30" : ""
      )}>
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3 relative group">
              <Home className="w-5 h-5 text-primary relative z-10" />
              {activeDevices > 0 && (
                <div className="absolute inset-0 bg-primary/20 rounded-full transform scale-0 group-hover:scale-125 transition-transform duration-300 opacity-0 group-hover:opacity-100"></div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {room.roomId.slice(0, 4)}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-medium text-lg">{room.room_name}</h3>
            {activeDevices > 0 && (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
          </div>
          
          {!canControl && !isAdmin && (
            <div className="text-xs text-amber-500 flex items-center gap-1 mb-2">
              <Users className="w-3 h-3" />
              <span>Control disabled (no members present)</span>
            </div>
          )}
          
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
