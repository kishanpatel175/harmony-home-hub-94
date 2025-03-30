
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Device, Member, PanicMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/components/ui/card";
import { 
  RefreshCw, 
  Shield, 
  UserCheck, 
  Cpu, 
  AlertTriangle,
  Save
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const RaspberryPiInterface = () => {
  // Firebase connection status
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Data states
  const [devices, setDevices] = useState<(Device & { id: string, room_name: string })[]>([]);
  const [presentMembers, setPresentMembers] = useState<(Member & { id: string })[]>([]);
  const [privilegedUser, setPrivilegedUser] = useState<string>("");
  const [privilegedRole, setPrivilegedRole] = useState<string>("");
  const [privilegedUserDetails, setPrivilegedUserDetails] = useState<Member | null>(null);
  const [isPanicMode, setIsPanicMode] = useState(false);
  
  // Refresh triggers
  const [devicesRefreshKey, setDevicesRefreshKey] = useState(0);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);
  const [panicRefreshKey, setPanicRefreshKey] = useState(0);
  
  // Pin edit state
  const [editingPins, setEditingPins] = useState<Record<string, string>>({});
  const [savingPins, setSavingPins] = useState<Record<string, boolean>>({});

  // Check Firebase connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to get a document to verify connection
        const testDoc = await getDoc(doc(db, "panic_mode", "current"));
        setIsConnected(true);
        setConnectionError(null);
        console.log("Successfully connected to Firebase");
      } catch (error) {
        console.error("Firebase connection failed:", error);
        setIsConnected(false);
        setConnectionError(error instanceof Error ? error.message : "Unknown connection error");
      }
    };
    
    checkConnection();
  }, []);

  // Fetch devices with their room names
  const fetchDevices = useCallback(async () => {
    try {
      console.log("Fetching devices...");
      const devicesRef = collection(db, "devices");
      const devicesSnapshot = await getDocs(devicesRef);
      
      const devicesPromises = devicesSnapshot.docs.map(async (deviceDoc) => {
        const deviceData = deviceDoc.data() as Device;
        const deviceId = deviceDoc.id;
        
        // Initialize pin edit state if not already set
        if (!editingPins[deviceId] && deviceData.pin) {
          setEditingPins(prev => ({
            ...prev,
            [deviceId]: deviceData.pin
          }));
        }
        
        // Get room name if roomId exists
        let roomName = "Unassigned";
        if (deviceData.roomId) {
          try {
            const roomDoc = await getDoc(doc(db, "rooms", deviceData.roomId));
            if (roomDoc.exists()) {
              roomName = roomDoc.data().room_name;
            }
          } catch (err) {
            console.error(`Error fetching room for device ${deviceId}:`, err);
          }
        }
        
        return {
          ...deviceData,
          id: deviceId,
          room_name: roomName
        };
      });
      
      const devicesWithRooms = await Promise.all(devicesPromises);
      setDevices(devicesWithRooms);
      console.log("Devices fetched:", devicesWithRooms);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Failed to load devices");
    }
  }, [editingPins]);

  // Fetch present members and privileged user
  const fetchPresentMembers = useCallback(async () => {
    try {
      console.log("Fetching present members...");
      const presentMembersRef = collection(db, "present_scan");
      const presentSnapshot = await getDocs(presentMembersRef);
      
      const membersPromises = presentSnapshot.docs.map(async (docSnap) => {
        const memberId = docSnap.id;
        const memberDoc = await getDoc(doc(db, "members", memberId));
        
        if (memberDoc.exists()) {
          return {
            ...memberDoc.data(),
            id: memberDoc.id
          } as Member & { id: string };
        }
        return null;
      });
      
      const members = (await Promise.all(membersPromises)).filter(
        (member): member is Member & { id: string } => member !== null
      );
      
      setPresentMembers(members);
      console.log("Present members fetched:", members);
      
      // Get privileged user
      const privilegedUserDoc = await getDoc(doc(db, "current_most_privileged_user", "current"));
      if (privilegedUserDoc.exists()) {
        const data = privilegedUserDoc.data();
        const privilegedUserId = data.current_most_privileged_user_id || "";
        setPrivilegedUser(privilegedUserId);
        setPrivilegedRole(data.current_privileged_role || "None");
        
        if (privilegedUserId) {
          const memberDoc = await getDoc(doc(db, "members", privilegedUserId));
          if (memberDoc.exists()) {
            setPrivilegedUserDetails({
              ...memberDoc.data(),
              memberId: memberDoc.id
            } as Member);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load members");
    }
  }, []);

  // Fetch panic mode status
  const fetchPanicMode = useCallback(async () => {
    try {
      console.log("Fetching panic mode status...");
      const panicModeRef = doc(db, "panic_mode", "current");
      const panicModeDoc = await getDoc(panicModeRef);
      
      if (panicModeDoc.exists()) {
        const data = panicModeDoc.data() as PanicMode;
        setIsPanicMode(data.is_panic_mode);
        console.log("Panic mode status:", data.is_panic_mode);
      }
    } catch (error) {
      console.error("Error fetching panic mode:", error);
      toast.error("Failed to load panic mode status");
    }
  }, []);

  // Load all data on component mount
  useEffect(() => {
    if (isConnected) {
      fetchDevices();
      fetchPresentMembers();
      fetchPanicMode();
    }
  }, [isConnected, fetchDevices, fetchPresentMembers, fetchPanicMode]);

  // Refresh individual sections when refresh keys change
  useEffect(() => {
    if (isConnected) {
      fetchDevices();
    }
  }, [isConnected, fetchDevices, devicesRefreshKey]);

  useEffect(() => {
    if (isConnected) {
      fetchPresentMembers();
    }
  }, [isConnected, fetchPresentMembers, usersRefreshKey]);

  useEffect(() => {
    if (isConnected) {
      fetchPanicMode();
    }
  }, [isConnected, fetchPanicMode, panicRefreshKey]);

  // Handle pin input change
  const handlePinChange = (deviceId: string, value: string) => {
    setEditingPins(prev => ({
      ...prev,
      [deviceId]: value
    }));
  };

  // Save pin to Firebase
  const savePin = async (deviceId: string) => {
    const newPin = editingPins[deviceId]?.trim();
    
    if (!newPin) {
      toast.error("Pin cannot be empty");
      return;
    }
    
    // Pin should only contain digits
    if (!/^\d+$/.test(newPin)) {
      toast.error("Pin must contain only digits");
      return;
    }
    
    try {
      setSavingPins(prev => ({ ...prev, [deviceId]: true }));
      
      await updateDoc(doc(db, "devices", deviceId), {
        pin: newPin
      });
      
      toast.success("Pin updated successfully");
    } catch (error) {
      console.error("Error updating pin:", error);
      toast.error("Failed to update pin");
    } finally {
      setSavingPins(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Raspberry Pi Control Interface</h1>
      
      {/* Firebase Connection Status */}
      <div className="mb-8">
        <div className={cn(
          "p-4 rounded-lg border flex items-center gap-3",
          isConnected ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800" :
          "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
          )}>
            <Cpu className={cn(
              "w-5 h-5",
              isConnected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )} />
          </div>
          <div>
            <h2 className="font-semibold text-lg">
              {isConnected ? "Connected to Firebase" : "Connection Failed"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? "Connection to Firebase was successful. You can now interact with devices." 
                : connectionError || "Failed to connect to Firebase. Please check your connection."}
            </p>
          </div>
        </div>
      </div>
      
      {isConnected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Devices Section - DIV1 */}
          <Card>
            <CardHeader className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-4"
                onClick={() => setDevicesRefreshKey(prev => prev + 1)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" /> 
                Devices
              </CardTitle>
              <CardDescription>
                {devices.length} device{devices.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No devices found
                </div>
              ) : (
                <div className="space-y-4">
                  {devices.map((device) => (
                    <div key={device.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{device.device_name}</h3>
                          <div className="text-sm text-muted-foreground">
                            {device.device_category} • Room: {device.room_name}
                          </div>
                        </div>
                        <div className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          device.device_status === "ON" 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        )}>
                          {device.device_status}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          placeholder="Pin Number"
                          value={editingPins[device.id] || ""}
                          onChange={(e) => handlePinChange(device.id, e.target.value)}
                        />
                        <Button 
                          onClick={() => savePin(device.id)}
                          disabled={savingPins[device.id]}
                          size="sm"
                        >
                          {savingPins[device.id] ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-1" />
                          )}
                          Save Pin
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Present Users Section - DIV2 */}
          <Card>
            <CardHeader className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-4"
                onClick={() => setUsersRefreshKey(prev => prev + 1)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" /> 
                Present Members
              </CardTitle>
              <CardDescription>
                {presentMembers.length} member{presentMembers.length !== 1 ? 's' : ''} present
              </CardDescription>
            </CardHeader>
            <CardContent>
              {presentMembers.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">
                  No members currently present
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Privileged User Banner */}
                  <div className="bg-primary/10 p-3 rounded-lg flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <h4 className="font-medium">Current Privileged User</h4>
                      <p className="text-sm">
                        {privilegedUserDetails?.member_name || "None"} 
                        {privilegedRole && <span className="text-xs ml-1 opacity-70">({privilegedRole})</span>}
                      </p>
                    </div>
                  </div>
                  
                  {/* Member List */}
                  {presentMembers.map((member) => (
                    <div 
                      key={member.id} 
                      className={cn(
                        "p-3 rounded-lg border flex items-center justify-between",
                        member.id === privilegedUser ? "bg-primary/5 border-primary/20" : ""
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <UserCheck className={cn(
                          "w-5 h-5",
                          member.id === privilegedUser ? "text-primary" : "text-muted-foreground"  
                        )} />
                        <div>
                          <p className="font-medium">{member.member_name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      
                      {member.id === privilegedUser && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          Privileged
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Panic Mode Status - DIV3 */}
          <Card>
            <CardHeader className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-4"
                onClick={() => setPanicRefreshKey(prev => prev + 1)}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> 
                Panic Mode Status
              </CardTitle>
              <CardDescription>
                Current system emergency status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "p-6 rounded-lg border flex items-center gap-4",
                isPanicMode 
                  ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" 
                  : "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  isPanicMode ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"
                )}>
                  <AlertTriangle className={cn(
                    "w-6 h-6",
                    isPanicMode ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )} />
                </div>
                <div>
                  <h3 className="text-lg font-medium">
                    Panic Mode is {isPanicMode ? "ACTIVE" : "INACTIVE"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isPanicMode 
                      ? "Emergency mode is currently active. All doors are unlocked and devices are turned off." 
                      : "System is operating normally."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* System Instructions - DIV4 */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Instructions and information about the Raspberry Pi interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">About This Interface</h3>
                <p className="text-sm text-muted-foreground">
                  This dashboard provides control over your home automation system through your Raspberry Pi.
                  You can manage devices, view present members, and monitor panic mode status.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Refreshing Data</h3>
                <p className="text-sm text-muted-foreground">
                  Each panel has a refresh button in the top-right corner that allows you to update just that section.
                  This is useful if you need to check for changes without reloading the entire page.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Pin Number Management</h3>
                <p className="text-sm text-muted-foreground">
                  You can update the GPIO pin numbers for devices by entering a new pin value and clicking the Save button.
                  Pin numbers should be valid GPIO pin numbers for your Raspberry Pi model.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RaspberryPiInterface;
