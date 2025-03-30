import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import { 
  doc, getDoc, collection, query, where, getDocs, deleteDoc, addDoc, updateDoc, 
  serverTimestamp, onSnapshot, writeBatch
} from "firebase/firestore";
import { Room, Device, CurrentPrivilegedUser, Member } from "@/lib/types";
import DeviceItem from "@/components/DeviceItem";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ChevronLeft, Plus, RefreshCw, Trash2, AlertTriangle, UserRound, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "@/components/PanicModeButton";

const deviceCategories = [
  "Light",
  "Fan",
  "TV",
  "Door Lock",
  "Refrigerator",
  "Other"
];

const RoomDetail = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isAdmin } = useAuth();
  
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceCategory, setNewDeviceCategory] = useState(deviceCategories[0]);
  
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  
  const [privilegedUserId, setPrivilegedUserId] = useState<string | null>(null);
  const [canControlDevices, setCanControlDevices] = useState(false);
  
  const [panicMode, setPanicMode] = useState(false);
  
  const [hasPresentMembers, setHasPresentMembers] = useState(false);
  
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomId) return;
      
      try {
        setLoading(true);
        const roomDocRef = doc(db, "rooms", roomId);
        const roomDoc = await getDoc(roomDocRef);
        
        if (roomDoc.exists()) {
          setRoom({ ...roomDoc.data(), roomId: roomDoc.id } as Room);
        } else {
          toast.error("Room not found");
          navigate("/");
        }
      } catch (error) {
        console.error("Error fetching room:", error);
        toast.error("Failed to load room");
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoom();
  }, [roomId, navigate]);
  
  useEffect(() => {
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as CurrentPrivilegedUser;
        setPrivilegedUserId(data.current_most_privileged_user_id);
        
        if (isAdmin) {
          setCanControlDevices(true);
        } else {
          setCanControlDevices(!!data.current_most_privileged_user_id);
        }
      } else {
        setPrivilegedUserId(null);
        setCanControlDevices(isAdmin);
      }
    });
    
    const panicModeRef = doc(db, "panic_mode", "current");
    
    const unsubscribePanic = onSnapshot(panicModeRef, (doc) => {
      if (doc.exists()) {
        setPanicMode(doc.data()?.is_panic_mode || false);
      }
    });
    
    const presentMembersRef = collection(db, "present_scan");
    const unsubscribePresentMembers = onSnapshot(presentMembersRef, (snapshot) => {
      const hasMembers = !snapshot.empty;
      setHasPresentMembers(hasMembers);
      
      if (!isAdmin) {
        setCanControlDevices(hasMembers);
      }
    });
    
    return () => {
      unsubscribePrivileged();
      unsubscribePanic();
      unsubscribePresentMembers();
    };
  }, [isAdmin]);
  
  useEffect(() => {
    const fetchDevices = async () => {
      if (!roomId) return;
      
      try {
        setLoading(true);
        const devicesQuery = query(
          collection(db, "devices"),
          where("roomId", "==", roomId)
        );
        
        const devicesSnapshot = await getDocs(devicesQuery);
        const devicesList = devicesSnapshot.docs.map(doc => ({
          ...doc.data(),
          deviceId: doc.id
        })) as Device[];
        
        setDevices(devicesList);
      } catch (error) {
        console.error("Error fetching devices:", error);
        toast.error("Failed to load devices");
      } finally {
        setLoading(false);
      }
    };
    
    fetchDevices();
  }, [roomId, refreshKey]);
  
  const addDevice = async () => {
    if (!roomId || !newDeviceName.trim()) return;
    
    try {
      setIsAddingDevice(true);
      
      await addDoc(collection(db, "devices"), {
        device_name: newDeviceName.trim(),
        device_category: newDeviceCategory,
        device_status: "OFF",
        roomId: roomId,
        assignedMembers: [],
        device_createdAt: serverTimestamp(),
        pin: "X"
      });
      
      setNewDeviceName("");
      setNewDeviceCategory(deviceCategories[0]);
      setRefreshKey(prev => prev + 1);
      toast.success("Device added successfully");
      
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error adding device:", error);
      toast.error("Failed to add device");
    } finally {
      setIsAddingDevice(false);
    }
  };
  
  const deleteDevice = async (deviceId: string) => {
    try {
      const deviceDoc = await getDoc(doc(db, "devices", deviceId));
      if (!deviceDoc.exists()) {
        toast.error("Device not found");
        return;
      }
      
      const deviceData = deviceDoc.data();
      const assignedMembers = deviceData.assignedMembers || [];
      
      const batch = writeBatch(db);
      
      for (const memberId of assignedMembers) {
        const memberDoc = await getDoc(doc(db, "members", memberId));
        if (memberDoc.exists()) {
          const memberData = memberDoc.data();
          const updatedAssignedDevices = (memberData.assignedDevices || []).filter(
            (id: string) => id !== deviceId
          );
          
          batch.update(doc(db, "members", memberId), {
            assignedDevices: updatedAssignedDevices
          });
        }
      }
      
      batch.delete(doc(db, "devices", deviceId));
      
      await batch.commit();
      
      setRefreshKey(prev => prev + 1);
      toast.success("Device deleted successfully");
      
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error("Failed to delete device");
    }
  };
  
  const deleteRoom = async () => {
    if (!roomId) return;
    
    try {
      setIsDeletingRoom(true);
      
      const devicesQuery = query(
        collection(db, "devices"),
        where("roomId", "==", roomId)
      );
      
      const devicesSnapshot = await getDocs(devicesQuery);
      const deviceIds = devicesSnapshot.docs.map(doc => doc.id);
      
      const membersQuery = query(collection(db, "members"));
      const membersSnapshot = await getDocs(membersQuery);
      const members = membersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Member & { id: string }));
      
      const batch = writeBatch(db);
      
      for (const member of members) {
        let needsUpdate = false;
        let updatedAssignedRooms = [...(member.assignedRooms || [])];
        let updatedAssignedDevices = [...(member.assignedDevices || [])];
        
        if (updatedAssignedRooms.includes(roomId)) {
          updatedAssignedRooms = updatedAssignedRooms.filter(id => id !== roomId);
          needsUpdate = true;
        }
        
        const hasDevices = deviceIds.some(deviceId => updatedAssignedDevices.includes(deviceId));
        if (hasDevices) {
          updatedAssignedDevices = updatedAssignedDevices.filter(
            deviceId => !deviceIds.includes(deviceId)
          );
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          batch.update(doc(db, "members", member.id), {
            assignedRooms: updatedAssignedRooms,
            assignedDevices: updatedAssignedDevices
          });
        }
      }
      
      for (const deviceId of deviceIds) {
        batch.delete(doc(db, "devices", deviceId));
      }
      
      batch.delete(doc(db, "rooms", roomId));
      
      await batch.commit();
      
      toast.success("Room deleted successfully");
      navigate("/");
      
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
      
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Failed to delete room");
    } finally {
      setIsDeletingRoom(false);
    }
  };

  if (loading && !room) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4" />
          <div className="h-24 bg-muted rounded-xl mb-6" />
          <div className="h-8 bg-muted rounded w-32 mb-4" />
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pb-20 pt-6">
      <div className="flex items-center gap-2 mb-6 animate-fade-in">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate("/")}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-semibold">{room?.room_name}</h1>
      </div>
      
      {panicMode && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 mb-6 flex items-center gap-3 animate-pulse-gentle">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Panic Mode Active</p>
            <p className="text-sm text-destructive/80">All door locks are open and devices are turned off</p>
          </div>
        </div>
      )}
      
      {!isAdmin && !hasPresentMembers && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Users className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">No members present</p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80">Device control is disabled until someone enters the home</p>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium">Devices</h2>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  <span>Add Device</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Device</DialogTitle>
                  <DialogDescription>
                    Enter details for the new device in {room?.room_name}.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="device-name" className="text-sm font-medium">
                      Device Name
                    </label>
                    <Input
                      id="device-name"
                      placeholder="Device name (e.g. Ceiling Light)"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <label htmlFor="device-category" className="text-sm font-medium">
                      Device Category
                    </label>
                    <Select 
                      value={newDeviceCategory}
                      onValueChange={setNewDeviceCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    type="submit" 
                    onClick={addDevice}
                    disabled={isAddingDevice || !newDeviceName.trim()}
                  >
                    {isAddingDevice ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : "Add Device"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete Room</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the room "{room?.room_name}". All devices will be unlinked from this room.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteRoom}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingRoom}
                  >
                    {isDeletingRoom ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      
      {devices.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-muted-foreground mb-4">No devices added to this room yet</p>
          {isAdmin ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button>Add Your First Device</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Device</DialogTitle>
                  <DialogDescription>
                    Enter details for the new device in {room?.room_name}.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="device-name" className="text-sm font-medium">
                      Device Name
                    </label>
                    <Input
                      id="device-name"
                      placeholder="Device name (e.g. Ceiling Light)"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <label htmlFor="device-category" className="text-sm font-medium">
                      Device Category
                    </label>
                    <Select 
                      value={newDeviceCategory}
                      onValueChange={setNewDeviceCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    type="submit" 
                    onClick={addDevice}
                    disabled={isAddingDevice || !newDeviceName.trim()}
                  >
                    {isAddingDevice ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : "Add Device"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <p>Please contact an administrator to add devices.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 animate-fade-in">
          {devices.map((device) => (
            <DeviceItem 
              key={device.deviceId} 
              device={device} 
              canControl={canControlDevices && !panicMode}
              onDeleteDevice={deleteDevice}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoomDetail;
