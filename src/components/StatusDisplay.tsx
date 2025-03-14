
import { useEffect, useState } from "react";
import { Shield, UserCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { CurrentPrivilegedUser, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const StatusDisplay = () => {
  const [privilegedUser, setPrivilegedUser] = useState<{
    userId: string;
    name: string;
    role: string;
  } | null>(null);
  
  const [membersInside, setMembersInside] = useState<number>(0);
  
  useEffect(() => {
    // Listen for the most privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, async (snapshot) => {
      if (snapshot.exists()) {
        const privilegedData = snapshot.data() as CurrentPrivilegedUser;
        
        // Get the user's name
        const userRef = doc(db, "members", privilegedData.current_most_privileged_user_id);
        const userSnap = await getDocs(query(collection(db, "members"), 
          where("memberId", "==", privilegedData.current_most_privileged_user_id), limit(1)));
        
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data() as Member;
          setPrivilegedUser({
            userId: privilegedData.current_most_privileged_user_id,
            name: userData.member_name,
            role: privilegedData.current_privileged_role
          });
        } else {
          setPrivilegedUser(null);
        }
      } else {
        setPrivilegedUser(null);
      }
    });
    
    // Count members currently inside
    const countMembersInside = async () => {
      try {
        // Get all members
        const membersSnapshot = await getDocs(collection(db, "members"));
        const memberIds = membersSnapshot.docs.map(doc => doc.data().memberId);
        
        // For each member, check if they have an inscan without a subsequent outscan
        let insideCount = 0;
        
        for (const memberId of memberIds) {
          // Get the latest scan for this member
          const scanQuery = query(
            collection(db, "scan_log"),
            where("scan_memberId", "==", memberId),
            orderBy("scan_time", "desc"),
            limit(1)
          );
          
          const scanSnapshot = await getDocs(scanQuery);
          
          if (!scanSnapshot.empty) {
            const latestScan = scanSnapshot.docs[0].data();
            if (latestScan.scan_type === "inscan") {
              insideCount++;
            }
          }
        }
        
        setMembersInside(insideCount);
      } catch (error) {
        console.error("Error counting members inside:", error);
      }
    };
    
    countMembersInside();
    const interval = setInterval(countMembersInside, 30000); // Update every 30 seconds
    
    return () => {
      unsubscribePrivileged();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="glass-card rounded-xl p-4 mb-6 animate-scale-in">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            privilegedUser ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Privileged User</p>
            <p className="font-medium">
              {privilegedUser 
                ? `${privilegedUser.name} (${privilegedUser.role})` 
                : "No one is home"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            membersInside > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Members Home</p>
            <p className="font-medium">
              {membersInside === 0 
                ? "No one is home" 
                : `${membersInside} ${membersInside === 1 ? "member" : "members"}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;
