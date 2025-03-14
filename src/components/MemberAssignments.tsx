
import { useState, useEffect } from "react";
import { Room, Device, Member } from "@/lib/types";
import { db } from "@/lib/firebase";
import { 
  collection, query, getDocs, doc, updateDoc, arrayUnion, arrayRemove, writeBatch
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Check, Home, Tv, X, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MemberAssignmentsProps {
  member: Member;
  onUpdate?: () => void;
}

const MemberAssignments: React.FC<MemberAssignmentsProps> = ({ member, onUpdate }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [localMember, setLocalMember] = useState<Member>(member);
  const [pendingChanges, setPendingChanges] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Track changes for rooms and devices
  const [roomChanges, setRoomChanges] = useState<{
    add: string[];
    remove: string[];
  }>({ add: [], remove: [] });
  
  const [deviceChanges, setDeviceChanges] = useState<{
    add: string[];
    remove: string[];
  }>({ add: [], remove: [] });
  
  // Fetch all rooms and devices
  useEffect(() => {
    const fetchRoomsAndDevices = async () => {
      try {
        setLoading(true);
        
        // Fetch rooms
        const roomsQuery = query(collection(db, "rooms"));
        const roomsSnapshot = await getDocs(roomsQuery);
        const roomsList = roomsSnapshot.docs.map(doc => ({
          ...doc.data(),
          roomId: doc.id
        })) as Room[];
        
        // Fetch devices
        const devicesQuery = query(collection(db, "devices"));
        const devicesSnapshot = await getDocs(devicesQuery);
        const devicesList = devicesSnapshot.docs.map(doc => ({
          ...doc.data(),
          deviceId: doc.id
        })) as Device[];
        
        setRooms(roomsList);
        setDevices(devicesList);
      } catch (error) {
        console.error("Error fetching rooms and devices:", error);
        toast.error("Failed to load rooms and devices");
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoomsAndDevices();
    // Update local member state when the member prop changes
    setLocalMember(member);
    // Reset changes when member changes
    setRoomChanges({ add: [], remove: [] });
    setDeviceChanges({ add: [], remove: [] });
    setPendingChanges(false);
  }, [member]);
  
  const toggleRoomAssignment = (roomId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Mark to remove room from member's assignments
        setRoomChanges(prev => ({
          add: prev.add.filter(id => id !== roomId),
          remove: [...prev.remove.filter(id => id !== roomId), roomId]
        }));
        
        // Update local state immediately for UI feedback
        setLocalMember(prev => ({
          ...prev,
          assignedRooms: prev.assignedRooms.filter(id => id !== roomId)
        }));
      } else {
        // Mark to add room to member's assignments
        setRoomChanges(prev => ({
          remove: prev.remove.filter(id => id !== roomId),
          add: [...prev.add.filter(id => id !== roomId), roomId]
        }));
        
        // Update local state immediately for UI feedback
        setLocalMember(prev => ({
          ...prev,
          assignedRooms: [...prev.assignedRooms, roomId]
        }));
      }
      
      setPendingChanges(true);
    } catch (error) {
      console.error("Error toggling room assignment:", error);
      toast.error("Failed to update room assignment");
    }
  };
  
  const toggleDeviceAssignment = (deviceId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Mark to remove device from member's assignments
        setDeviceChanges(prev => ({
          add: prev.add.filter(id => id !== deviceId),
          remove: [...prev.remove.filter(id => id !== deviceId), deviceId]
        }));
        
        // Update local state immediately for UI feedback
        setLocalMember(prev => ({
          ...prev,
          assignedDevices: prev.assignedDevices.filter(id => id !== deviceId)
        }));
      } else {
        // Mark to add device to member's assignments
        setDeviceChanges(prev => ({
          remove: prev.remove.filter(id => id !== deviceId),
          add: [...prev.add.filter(id => id !== deviceId), deviceId]
        }));
        
        // Update local state immediately for UI feedback
        setLocalMember(prev => ({
          ...prev,
          assignedDevices: [...prev.assignedDevices, deviceId]
        }));
      }
      
      setPendingChanges(true);
    } catch (error) {
      console.error("Error toggling device assignment:", error);
      toast.error("Failed to update device assignment");
    }
  };
  
  const submitChanges = async () => {
    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);
      const memberRef = doc(db, "members", member.memberId);
      
      // Process room changes
      if (roomChanges.add.length > 0 || roomChanges.remove.length > 0) {
        const updatedRooms = [
          ...member.assignedRooms.filter(roomId => !roomChanges.remove.includes(roomId)),
          ...roomChanges.add.filter(roomId => !member.assignedRooms.includes(roomId))
        ];
        
        batch.update(memberRef, {
          assignedRooms: updatedRooms
        });
      }
      
      // Process device changes
      if (deviceChanges.add.length > 0 || deviceChanges.remove.length > 0) {
        const updatedDevices = [
          ...member.assignedDevices.filter(deviceId => !deviceChanges.remove.includes(deviceId)),
          ...deviceChanges.add.filter(deviceId => !member.assignedDevices.includes(deviceId))
        ];
        
        batch.update(memberRef, {
          assignedDevices: updatedDevices
        });
        
        // Update the device records too
        for (const deviceId of deviceChanges.add) {
          const deviceRef = doc(db, "devices", deviceId);
          batch.update(deviceRef, {
            assignedMembers: arrayUnion(member.memberId)
          });
        }
        
        for (const deviceId of deviceChanges.remove) {
          const deviceRef = doc(db, "devices", deviceId);
          batch.update(deviceRef, {
            assignedMembers: arrayRemove(member.memberId)
          });
        }
      }
      
      await batch.commit();
      
      // Reset changes
      setRoomChanges({ add: [], remove: [] });
      setDeviceChanges({ add: [], remove: [] });
      setPendingChanges(false);
      
      toast.success("Member assignments updated successfully");
      
      // Notify parent component of updates
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error submitting changes:", error);
      toast.error("Failed to update assignments");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getDeviceIcon = (category: string) => {
    switch (category) {
      case "TV":
        return <Tv className="h-4 w-4" />;
      default:
        return null;
    }
  };
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-2">
          Manage Assignments
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Assignments for {member.member_name}</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="space-y-2">
            <div className="h-6 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
            <div className="h-6 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Assigned Rooms</h3>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-4 space-y-2">
                  {rooms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rooms available</p>
                  ) : (
                    rooms.map((room) => {
                      const isAssigned = localMember.assignedRooms.includes(room.roomId);
                      return (
                        <div 
                          key={room.roomId} 
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-muted-foreground" />
                            <span>{room.room_name}</span>
                          </div>
                          <Button
                            variant={isAssigned ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleRoomAssignment(room.roomId, isAssigned)}
                          >
                            {isAssigned ? (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Unassign
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Assign
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Assigned Devices</h3>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-4 space-y-2">
                  {devices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No devices available</p>
                  ) : (
                    devices.map((device) => {
                      const isAssigned = localMember.assignedDevices.includes(device.deviceId);
                      const roomInfo = rooms.find(r => r.roomId === device.roomId);
                      
                      return (
                        <div 
                          key={device.deviceId} 
                          className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(device.device_category)}
                              <span>{device.device_name}</span>
                            </div>
                            {roomInfo && (
                              <Badge variant="outline" className="text-xs">
                                {roomInfo.room_name}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant={isAssigned ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => toggleDeviceAssignment(device.deviceId, isAssigned)}
                          >
                            {isAssigned ? (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Unassign
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Assign
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            
            {pendingChanges && (
              <div className="flex justify-end">
                <Button 
                  onClick={submitChanges} 
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin">↻</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Submit Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MemberAssignments;
