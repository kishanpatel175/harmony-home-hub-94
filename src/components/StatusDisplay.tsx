
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, doc, onSnapshot } from "firebase/firestore";
import { UserRound, Home as HomeIcon } from "lucide-react";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./PanicModeButton";

const StatusDisplay = () => {
  const [membersAtHome, setMembersAtHome] = useState<number>(0);
  const [privilegedUser, setPrivilegedUser] = useState<string>("");
  const [privilegedRole, setPrivilegedRole] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchScanLogs = async () => {
    try {
      // Fetch the most recent 10 scan logs ordered by timestamp
      const scanLogsRef = collection(db, "scan_log");
      const scanLogsQuery = query(scanLogsRef, orderBy("scan_time", "desc"), limit(10));
      const scanLogsSnapshot = await getDocs(scanLogsQuery);
      
      // Count unique members who have an "inscan" but no later "outscan"
      const memberStatus = new Map();
      scanLogsSnapshot.docs.forEach(doc => {
        const scanData = doc.data();
        const memberId = scanData.scan_memberId;
        const scanType = scanData.scan_type;
        
        // Only track the most recent scan for each member
        if (!memberStatus.has(memberId) || scanData.scan_time > memberStatus.get(memberId).time) {
          memberStatus.set(memberId, { type: scanType, time: scanData.scan_time });
        }
      });
      
      // Count members with latest scan type being "inscan"
      const inscanMembers = Array.from(memberStatus.values()).filter(status => status.type === "inscan").length;
      setMembersAtHome(inscanMembers);
    } catch (error) {
      console.error("Error fetching scan logs:", error);
    }
  };

  useEffect(() => {
    setLoading(true);
    
    // Listen to current privileged user
    const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
    const unsubscribePrivileged = onSnapshot(privilegedUserRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPrivilegedUser(data.current_most_privileged_user_id || "None");
        setPrivilegedRole(data.current_privileged_role || "None");
      }
    });
    
    // Initial fetch of scan logs
    fetchScanLogs().then(() => setLoading(false));
    
    // Listen for device updates to refresh data
    const handleDeviceUpdate = () => {
      console.log("Device update detected, refreshing status display");
      fetchScanLogs();
    };
    
    deviceUpdateEvent.addEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    
    return () => {
      unsubscribePrivileged();
      deviceUpdateEvent.removeEventListener(DEVICE_UPDATE_EVENT, handleDeviceUpdate);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 animate-fade-in">
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Privileged User</h3>
            {loading ? (
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-sm text-muted-foreground">{privilegedUser} ({privilegedRole})</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <HomeIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Members at Home</h3>
            {loading ? (
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-sm text-muted-foreground">{membersAtHome} members</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;
