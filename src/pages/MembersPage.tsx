
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, query, orderBy, getDocs, addDoc, serverTimestamp, 
  doc, deleteDoc, onSnapshot, where
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
    const fetchMembers = async () => {
      try {
        setLoading(true);
        
        const membersQuery = query(
          collection(db, "members"),
          orderBy("createdAt", "desc")
        );
        
        const membersSnapshot = await getDocs(membersQuery);
        const membersList = membersSnapshot.docs.map(doc => ({
          ...doc.data(),
          memberId: doc.id
        })) as Member[];
        
        setMembers(membersList);
      } catch (error) {
        console.error("Error fetching members:", error);
        toast.error("Failed to load members");
      } finally {
        setLoading(false);
      }
    };
    
    fetchMembers();
    
    // Listen for the most privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as CurrentPrivilegedUser;
        setPrivilegedUserId(data.current_most_privileged_user_id);
      } else {
        setPrivilegedUserId(null);
      }
    });
    
    // Determine who is inside the house
    const getMembersInside = async () => {
      try {
        const insideMembers: string[] = [];
        
        // For each member, check if they have an inscan without a subsequent outscan
        for (const member of members) {
          // Get the latest scan for this member
          const scanQuery = query(
            collection(db, "scan_log"),
            where("scan_memberId", "==", member.memberId),
            orderBy("scan_time", "desc"),
            // limit(1) - not using in this example as we're doing client-side filtering
          );
          
          const scanSnapshot = await getDocs(scanQuery);
          
          if (!scanSnapshot.empty) {
            const latestScan = scanSnapshot.docs[0].data() as ScanLog;
            if (latestScan.scan_type === "inscan") {
              insideMembers.push(member.memberId);
            }
          }
        }
        
        setMembersInside(insideMembers);
      } catch (error) {
        console.error("Error determining members inside:", error);
      }
    };
    
    // For demo purposes, we'll assume some members are inside
    if (members.length > 0) {
      setMembersInside(members.slice(0, 2).map(m => m.memberId));
    }
    
    return () => {
      unsubscribePrivileged();
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
      
      // Refresh the list
      const membersQuery = query(
        collection(db, "members"),
        orderBy("createdAt", "desc")
      );
      
      const membersSnapshot = await getDocs(membersQuery);
      const membersList = membersSnapshot.docs.map(doc => ({
        ...doc.data(),
        memberId: doc.id
      })) as Member[];
      
      setMembers(membersList);
      
      toast.success("Member added successfully");
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Failed to add member");
    } finally {
      setIsAddingMember(false);
    }
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MembersPage;
