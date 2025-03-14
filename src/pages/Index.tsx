
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { Room } from "@/lib/types";
import RoomCard from "@/components/RoomCard";
import PanicModeButton from "@/components/PanicModeButton";
import StatusDisplay from "@/components/StatusDisplay";
import { Plus, RefreshCw } from "lucide-react";
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

const Index = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const roomsQuery = query(collection(db, "rooms"), orderBy("room_createdAt", "desc"));
        const roomsSnapshot = await getDocs(roomsQuery);
        const roomsList = roomsSnapshot.docs.map(doc => ({
          ...doc.data(),
          roomId: doc.id
        })) as Room[];
        
        setRooms(roomsList);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        toast.error("Failed to load rooms");
      } finally {
        setLoading(false);
      }
    };
    
    fetchRooms();
  }, [refreshKey]);
  
  const addRoom = async () => {
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }
    
    try {
      setIsAddingRoom(true);
      
      await addDoc(collection(db, "rooms"), {
        room_name: newRoomName.trim(),
        room_createdAt: serverTimestamp()
      });
      
      setNewRoomName("");
      setRefreshKey(prev => prev + 1);
      toast.success("Room added successfully");
      
    } catch (error) {
      console.error("Error adding room:", error);
      toast.error("Failed to add room");
    } finally {
      setIsAddingRoom(false);
    }
  };

  return (
    <div className="container mx-auto px-4 pb-20 pt-6 min-h-screen">
      <header className="mb-6 animate-fade-in">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-semibold">Smart Home Hub</h1>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loading}
          >
            <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
          </Button>
        </div>
        <p className="text-muted-foreground">Manage your rooms, devices, and members</p>
      </header>
      
      <StatusDisplay />
      
      <div className="mb-6">
        <PanicModeButton />
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-medium">Rooms</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              <span>Add Room</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>
                Enter a name for the new room.
              </DialogDescription>
            </DialogHeader>
            
            <Input
              placeholder="Room name (e.g. Living Room)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="mt-4"
            />
            
            <DialogFooter className="mt-4">
              <Button 
                type="submit" 
                onClick={addRoom}
                disabled={isAddingRoom || !newRoomName.trim()}
              >
                {isAddingRoom ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : "Add Room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-muted-foreground mb-4">No rooms added yet</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Your First Room</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Room</DialogTitle>
                <DialogDescription>
                  Enter a name for the new room.
                </DialogDescription>
              </DialogHeader>
              
              <Input
                placeholder="Room name (e.g. Living Room)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="mt-4"
              />
              
              <DialogFooter className="mt-4">
                <Button 
                  type="submit" 
                  onClick={addRoom}
                  disabled={isAddingRoom || !newRoomName.trim()}
                >
                  {isAddingRoom ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : "Add Room"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
          {rooms.map((room) => (
            <RoomCard key={room.roomId} room={room} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
