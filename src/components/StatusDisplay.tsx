
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, doc, onSnapshot } from "firebase/firestore";
import { UserRound, Home as HomeIcon, Shield, Users, UserCheck, LogIn, LogOut } from "lucide-react";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";
import { Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const StatusDisplay = () => {
  const [membersAtHome, setMembersAtHome] = useState<Member[]>([]);
  const [privilegedUser, setPrivilegedUser] = useState<string>("");
  const [privilegedRole, setPrivilegedRole] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [privilegedUserDetails, setPrivilegedUserDetails] = useState<Member | null>(null);

  useEffect(() => {
    setLoading(true);
    
    // Listen to present members
    const presentMembersRef = collection(db, "present_scan");
    const unsubscribePresent = onSnapshot(presentMembersRef, async (snapshot) => {
      try {
        const presentMembers: Member[] = [];
        
        for (const docSnap of snapshot.docs) {
          // Get the full member data
          const memberDoc = await getDoc(doc(db, "members", docSnap.id));
          
          if (memberDoc.exists()) {
            presentMembers.push({
              ...memberDoc.data(),
              memberId: memberDoc.id
            } as Member);
          }
        }
        
        setMembersAtHome(presentMembers);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching present members:", error);
      }
    });
    
    // Listen to current privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        const privilegedUserId = data.current_most_privileged_user_id || "";
        setPrivilegedUser(privilegedUserId);
        setPrivilegedRole(data.current_privileged_role || "None");
        
        // Fetch the full details of the privileged user if ID exists
        if (privilegedUserId) {
          try {
            const memberDoc = await getDoc(doc(db, "members", privilegedUserId));
            if (memberDoc.exists()) {
              setPrivilegedUserDetails({
                ...memberDoc.data(),
                memberId: memberDoc.id
              } as Member);
            } else {
              setPrivilegedUserDetails(null);
            }
          } catch (error) {
            console.error("Error fetching privileged user details:", error);
            setPrivilegedUserDetails(null);
          }
        } else {
          setPrivilegedUserDetails(null);
        }
      } else {
        setPrivilegedUser("");
        setPrivilegedRole("None");
        setPrivilegedUserDetails(null);
      }
    });
    
    // Listen for device updates to refresh data
    const handleDeviceUpdate = () => {
      console.log("Device update detected, refreshing status display");
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      unsubscribePresent();
      unsubscribePrivileged();
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, []);

  return (
    <div className="glass-card p-4 rounded-xl mb-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">Access Control Status</h3>
          <p className="text-sm text-muted-foreground">Current system status and controls</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-3 rounded-lg hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden group-hover:bg-primary/20 transition-all duration-300">
              <Shield className="w-4 h-4 text-primary relative z-10" />
            </div>
            <div>
              <h4 className="text-sm font-medium">Privileged User</h4>
              {loading ? (
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <div className="flex items-center gap-1">
                  <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {privilegedUser === "" ? "None" : (
                      <>
                        {privilegedUserDetails?.member_name || "Unknown"} 
                        <span className="text-xs ml-1 opacity-70">({privilegedRole})</span>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="glass-card p-3 rounded-lg hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center relative overflow-hidden group-hover:bg-primary/20 transition-all duration-300">
              <HomeIcon className="w-4 h-4 text-primary relative z-10" />
            </div>
            <div>
              <h4 className="text-sm font-medium">Present Members</h4>
              {loading ? (
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              ) : (
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{membersAtHome.length} members</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {!loading && membersAtHome.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Members Currently Present:</h4>
          <div className="space-y-1.5">
            {membersAtHome.map((member) => (
              <div 
                key={member.memberId} 
                className={cn(
                  "text-sm p-1.5 rounded-md flex items-center gap-2",
                  member.memberId === privilegedUser ? "bg-primary/10" : ""
                )}
              >
                <UserCheck className={cn(
                  "w-4 h-4", 
                  member.memberId === privilegedUser ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={member.memberId === privilegedUser ? "font-medium" : ""}>
                  {member.member_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({member.role})
                </span>
                {member.memberId === privilegedUser && (
                  <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-auto">
                    Privileged
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;
