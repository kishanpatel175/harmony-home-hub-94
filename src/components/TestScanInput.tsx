
import { useState, useEffect } from "react";
import { 
  Fingerprint, 
  LogIn, 
  LogOut, 
  AlertTriangle, 
  RefreshCw,
  UserCheck,
  UserX
} from "lucide-react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Member, roleHierarchy } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";

const TestScanInput = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [scanType, setScanType] = useState<"inscan" | "outscan">("inscan");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(true);
  const [presentMembers, setPresentMembers] = useState<Member[]>([]);
  
  // Fetch all members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const membersQuery = query(collection(db, "members"), orderBy("member_name"));
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
        setIsLoadingMembers(false);
      }
    };
    
    fetchMembers();
  }, []);

  // Fetch present members
  useEffect(() => {
    const fetchPresentMembers = async () => {
      try {
        const presentMembersQuery = query(collection(db, "present_scan"));
        const presentSnapshot = await getDocs(presentMembersQuery);
        
        const presentMemberIds = presentSnapshot.docs.map(doc => doc.id);
        
        // Find the full member data for each present member ID
        const presentMembersList: Member[] = [];
        for (const memberId of presentMemberIds) {
          const memberDoc = await getDoc(doc(db, "members", memberId));
          if (memberDoc.exists()) {
            presentMembersList.push({
              ...memberDoc.data(),
              memberId: memberDoc.id
            } as Member);
          }
        }
        
        setPresentMembers(presentMembersList);
      } catch (error) {
        console.error("Error fetching present members:", error);
      }
    };
    
    fetchPresentMembers();
  }, [isProcessing]);

  // Update most privileged user
  const updateMostPrivilegedUser = async () => {
    try {
      console.log("Updating most privileged user based on present members...");
      // Find the most privileged user among present members
      let mostPrivilegedUser: Member | null = null;
      let highestRoleRank = -1;
      
      for (const member of presentMembers) {
        const roleRank = roleHierarchy[member.role as keyof typeof roleHierarchy] || 0;
        if (roleRank > highestRoleRank) {
          highestRoleRank = roleRank;
          mostPrivilegedUser = member;
        }
      }
      
      // Get the current privileged user to check if it needs updating
      const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
      const privilegedUserDoc = await getDoc(privilegedUserRef);
      const currentPrivilegedId = privilegedUserDoc.exists() ? 
        privilegedUserDoc.data().current_most_privileged_user_id : "";
      
      // Only update if the privileged user has changed
      const newPrivilegedId = mostPrivilegedUser?.memberId || "";
      
      if (currentPrivilegedId !== newPrivilegedId) {
        if (mostPrivilegedUser) {
          console.log(`Updating most privileged user to: ${mostPrivilegedUser.member_name} (${mostPrivilegedUser.role})`);
          await setDoc(privilegedUserRef, {
            current_most_privileged_user_id: mostPrivilegedUser.memberId,
            current_privileged_role: mostPrivilegedUser.role,
            updatedAt: serverTimestamp()
          });
        } else {
          // No one is present, clear the privileged user
          console.log("Clearing most privileged user - no one present");
          await setDoc(privilegedUserRef, {
            current_most_privileged_user_id: "",
            current_privileged_role: "",
            updatedAt: serverTimestamp()
          });
        }
        
        // Trigger an update event so that device controls refresh
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
      } else {
        console.log("Most privileged user unchanged, no update needed");
      }
    } catch (error) {
      console.error("Error updating most privileged user:", error);
      toast.error("Failed to update privilege status");
    }
  };

  // Process the scan
  const processScan = async () => {
    if (!selectedMemberId) {
      toast.error("Please select a member");
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Get the selected member's details
      const selectedMember = members.find(m => m.memberId === selectedMemberId);
      
      if (!selectedMember) {
        toast.error("Invalid member selected");
        return;
      }
      
      // Check for duplicate inscan or invalid outscan
      const memberPresentDoc = doc(db, "present_scan", selectedMemberId);
      const memberPresentSnap = await getDoc(memberPresentDoc);
      const isPresent = memberPresentSnap.exists();
      
      if (scanType === "inscan" && isPresent) {
        toast.error(`${selectedMember.member_name} is already inside the house`);
        setIsProcessing(false);
        return;
      }
      
      if (scanType === "outscan" && !isPresent) {
        toast.error(`${selectedMember.member_name} is not currently inside the house`);
        setIsProcessing(false);
        return;
      }
      
      // Process the scan based on type
      if (scanType === "inscan") {
        // Add to present_scan collection
        await setDoc(memberPresentDoc, {
          member_name: selectedMember.member_name,
          role: selectedMember.role,
          scanTime: serverTimestamp()
        });
        
        // Add to scan_log
        await addDoc(collection(db, "scan_log"), {
          scan_memberId: selectedMemberId,
          scan_type: "inscan",
          scan_time: serverTimestamp()
        });
        
        toast.success(`${selectedMember.member_name} has entered the house`);
        
        // Update presentMembers with the new member
        setPresentMembers(prev => [...prev, selectedMember]);
      } else {
        // Remove from present_scan collection
        await deleteDoc(memberPresentDoc);
        
        // Add to scan_log
        await addDoc(collection(db, "scan_log"), {
          scan_memberId: selectedMemberId,
          scan_type: "outscan",
          scan_time: serverTimestamp()
        });
        
        toast.success(`${selectedMember.member_name} has left the house`);
        
        // Remove member from presentMembers
        setPresentMembers(prev => prev.filter(m => m.memberId !== selectedMemberId));
      }
      
      // Update the most privileged user
      // Wait a short moment to ensure Firestore operations have propagated
      setTimeout(async () => {
        await updateMostPrivilegedUser();
        setIsProcessing(false);
      }, 300);
      
      // Reset selection
      setSelectedMemberId("");
      
      // Trigger device update event to refresh components
      deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
    } catch (error) {
      console.error("Error processing scan:", error);
      toast.error("Failed to process scan");
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-card p-4 rounded-xl animate-fade-in mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Test Scan Simulator</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label>Select Member</Label>
          <Select
            value={selectedMemberId}
            onValueChange={setSelectedMemberId}
            disabled={isLoadingMembers || isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member to scan" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Members</SelectLabel>
                {members.map((member) => (
                  <SelectItem key={member.memberId} value={member.memberId}>
                    {member.member_name} ({member.role})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Scan Type</Label>
          <RadioGroup value={scanType} onValueChange={(value) => setScanType(value as "inscan" | "outscan")}>
            <div className="flex gap-4 pt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inscan" id="inscan" />
                <Label htmlFor="inscan" className="flex items-center gap-1">
                  <LogIn className="w-4 h-4 text-emerald-500" />
                  <span>In-Scan</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="outscan" id="outscan" />
                <Label htmlFor="outscan" className="flex items-center gap-1">
                  <LogOut className="w-4 h-4 text-amber-500" />
                  <span>Out-Scan</span>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>
        
        <Button 
          onClick={processScan} 
          className="w-full" 
          disabled={!selectedMemberId || isProcessing}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {scanType === "inscan" ? (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Register Entry
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Register Exit
                </>
              )}
            </>
          )}
        </Button>
        
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Currently Present Members:</h4>
          {presentMembers.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              No members currently inside the house
            </div>
          ) : (
            <div className="space-y-2">
              {presentMembers.map((member) => (
                <div key={member.memberId} className="flex items-center text-sm gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span>{member.member_name}</span>
                  <span className="text-xs text-muted-foreground">({member.role})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestScanInput;
