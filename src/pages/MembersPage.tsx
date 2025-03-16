
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, getDocs, addDoc, serverTimestamp, 
  doc, onSnapshot, where
} from "firebase/firestore";
import { Member, ScanLog, CurrentPrivilegedUser } from "@/lib/types";
import MemberItem from "@/components/MemberItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Plus, RefreshCw, UserPlus } from "lucide-react";
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
import { roleHierarchy } from "@/lib/types";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "@/components/PanicModeButton";

const roles = ["Owner", "House Member", "Guest", "Maid"];

const MembersPage = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersInside, setMembersInside] = useState<string[]>([]);
  const [privilegedUserId, setPrivilegedUserId] = useState<string | null>(null);

  // New member form
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState(roles[1]); // Default to House Member
  
  useEffect(() => {
    setLoading(true);
    
    // Set up real-time listeners
    
    // 1. Listen for all members
    const membersQuery = query(
      collection(db, "members"),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      try {
        const membersList = snapshot.docs.map(doc => ({
          ...doc.data(),
          memberId: doc.id
        })) as Member[];
        
        setMembers(membersList);
        setLoading(false);
      } catch (error) {
        console.error("Error processing members snapshot:", error);
        toast.error("Failed to update members list");
      }
    });
    
    // 2. Listen for present members
    const presentScanRef = collection(db, "present_scan");
    
    const unsubscribePresent = onSnapshot(presentScanRef, (snapshot) => {
      try {
        const insideMembers = snapshot.docs.map(doc => doc.id);
        setMembersInside(insideMembers);
      } catch (error) {
        console.error("Error processing present members snapshot:", error);
      }
    });
    
    // 3. Listen for the most privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as CurrentPrivilegedUser;
        setPrivilegedUserId(data.current_most_privileged_user_id);
      } else {
        setPrivilegedUserId(null);
      }
    });
    
    // Listen for device updates to refresh data if needed
    const handleDeviceUpdate = () => {
      console.log("Device update detected in MembersPage");
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      unsubscribeMembers();
      unsubscribePresent();
      unsubscribePrivileged();
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, []);
  
  const addMember = async () => {
    if (!newMemberName.trim()) {
      toast.error("Please enter a member name");
      return;
    }
    
    try {
      setIsAddingMember(true);
      
      await addDoc(collection(db, "members"), {
        member_name: newMemberName.trim(),
        role: newMemberRole,
        assignedRooms: [],
        assignedDevices: [],
        createdAt: serverTimestamp()
      });
      
      setNewMemberName("");
      setNewMemberRole(roles[1]);
      
      toast.success("Member added successfully");
      
      // Notify other components about the change
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
  };

  // Function to refresh the members list - just triggers a re-render
  const handleMemberUpdate = () => {
    // No need to do anything as we have real-time listeners now
    console.log("Member update triggered");
    // Still dispatch an event to ensure all components get updated
    deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
  };

  return (
    <div className="container mx-auto px-4 pb-20 pt-6 min-h-screen">
      <header className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold mb-2">Members</h1>
        <p className="text-muted-foreground">Manage household members and access privileges</p>
      </header>
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium">All Members</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-1">
              <UserPlus className="h-4 w-4" />
              <span>Add Member</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
              <DialogDescription>
                Enter details for the new household member.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="member-name" className="text-sm font-medium">
                  Member Name
                </label>
                <Input
                  id="member-name"
                  placeholder="Member name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="member-role" className="text-sm font-medium">
                  Role
                </label>
                <Select 
                  value={newMemberRole}
                  onValueChange={setNewMemberRole}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={addMember}
                disabled={isAddingMember || !newMemberName.trim()}
              >
                {isAddingMember ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : "Add Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center">
          <p className="text-muted-foreground mb-4">No members added yet</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add Your First Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Enter details for the new household member.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="member-name" className="text-sm font-medium">
                    Member Name
                  </label>
                  <Input
                    id="member-name"
                    placeholder="Member name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <label htmlFor="member-role" className="text-sm font-medium">
                    Role
                  </label>
                  <Select 
                    value={newMemberRole}
                    onValueChange={setNewMemberRole}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  onClick={addMember}
                  disabled={isAddingMember || !newMemberName.trim()}
                >
                  {isAddingMember ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : "Add Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 animate-fade-in">
          {members.map((member) => (
            <MemberItem 
              key={member.memberId} 
              member={member} 
              isInside={membersInside.includes(member.memberId)}
              isPrivileged={member.memberId === privilegedUserId}
              onUpdate={handleMemberUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MembersPage;
