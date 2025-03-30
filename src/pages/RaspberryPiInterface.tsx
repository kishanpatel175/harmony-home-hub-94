
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
  Save,
  Info,
  AlertCircle
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

// Valid physical pin numbers that map to GPIO pins
const VALID_PIN_NUMBERS = [
  '3', '5', '7', '8', '10', '11', '12', '13', '15', '16', '18', '19', 
  '21', '22', '23', '24', '26', '27', '28', '29', '31', '32', '33', 
  '35', '36', '37', '38', '40'
];

// Pins that may be problematic on Raspberry Pi 400
const PI_400_PROBLEMATIC_PINS = [
  '27', '28', // GPIO 0, 1 - used for ID EEPROM
  '36', // GPIO 16 - can be used for keyboard functions
  '38', '40' // GPIO 20, 21 - may be used for keyboard/mouse functions
];

// Pins that are recommended for Raspberry Pi 400
const PI_400_RECOMMENDED_PINS = [
  '11', '12', '13', '15', '16', '18', '22', '29', '31', '32', '33', '35', '37'
];

const RaspberryPiInterface = () => {
  // Firebase connection status
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Data states
  const [devices, setDevices] = useState<(Device & { id: string, room_name: string, pin_problematic?: boolean })[]>([]);
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
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});

  // Live refresh state
  const [liveRefreshEnabled, setLiveRefreshEnabled] = useState(false);
  const [liveRefreshIntervals, setLiveRefreshIntervals] = useState<{
    devices: NodeJS.Timeout | null;
    members: NodeJS.Timeout | null;
    panicMode: NodeJS.Timeout | null;
  }>({
    devices: null,
    members: null,
    panicMode: null
  });
  const DEFAULT_REFRESH_RATE = 5000; // 5 seconds

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
        
        // Check if pin is potentially problematic on Pi 400
        const isPinProblematic = deviceData.pin ? PI_400_PROBLEMATIC_PINS.includes(deviceData.pin) : false;
        
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
          room_name: roomName,
          pin_problematic: isPinProblematic
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

  // Toggle live refresh functionality
  const toggleLiveRefresh = useCallback((enabled: boolean) => {
    setLiveRefreshEnabled(enabled);
    
    if (enabled) {
      // Start refresh intervals
      const devicesInterval = setInterval(fetchDevices, DEFAULT_REFRESH_RATE);
      const membersInterval = setInterval(fetchPresentMembers, DEFAULT_REFRESH_RATE);
      const panicModeInterval = setInterval(fetchPanicMode, DEFAULT_REFRESH_RATE);
      
      setLiveRefreshIntervals({
        devices: devicesInterval,
        members: membersInterval,
        panicMode: panicModeInterval
      });
      
      toast.success("Live refresh enabled");
      console.log("Live refresh enabled");
    } else {
      // Clear all intervals
      if (liveRefreshIntervals.devices) clearInterval(liveRefreshIntervals.devices);
      if (liveRefreshIntervals.members) clearInterval(liveRefreshIntervals.members);
      if (liveRefreshIntervals.panicMode) clearInterval(liveRefreshIntervals.panicMode);
      
      setLiveRefreshIntervals({
        devices: null,
        members: null,
        panicMode: null
      });
      
      toast.info("Live refresh disabled");
      console.log("Live refresh disabled");
    }
  }, [fetchDevices, fetchPresentMembers, fetchPanicMode, liveRefreshIntervals]);

  // Load all data on component mount
  useEffect(() => {
    if (isConnected) {
      fetchDevices();
      fetchPresentMembers();
      fetchPanicMode();
    }
    
    // Cleanup function to clear any intervals when component unmounts
    return () => {
      if (liveRefreshIntervals.devices) clearInterval(liveRefreshIntervals.devices);
      if (liveRefreshIntervals.members) clearInterval(liveRefreshIntervals.members);
      if (liveRefreshIntervals.panicMode) clearInterval(liveRefreshIntervals.panicMode);
    };
  }, [isConnected, fetchDevices, fetchPresentMembers, fetchPanicMode, liveRefreshIntervals]);

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

  // Check if pin is potentially problematic on Pi 400
  const isPinProblematicForPi400 = (pin: string): boolean => {
    return PI_400_PROBLEMATIC_PINS.includes(pin);
  };
  
  // Check if pin is recommended for Pi 400
  const isPinRecommendedForPi400 = (pin: string): boolean => {
    return PI_400_RECOMMENDED_PINS.includes(pin);
  };

  // Validate pin number
  const validatePin = (pin: string): boolean => {
    return VALID_PIN_NUMBERS.includes(pin);
  };

  // Handle pin input change
  const handlePinChange = (deviceId: string, value: string) => {
    setEditingPins(prev => ({
      ...prev,
      [deviceId]: value
    }));
    
    // Clear any existing error when user starts typing
    if (pinErrors[deviceId]) {
      setPinErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[deviceId];
        return newErrors;
      });
    }
  };

  // Save pin to Firebase
  const savePin = async (deviceId: string) => {
    // Temporarily disable live refresh if enabled to prevent interference
    const wasLiveRefreshEnabled = liveRefreshEnabled;
    if (wasLiveRefreshEnabled) {
      toggleLiveRefresh(false);
    }
    
    const newPin = editingPins[deviceId]?.trim();
    
    if (!newPin) {
      setPinErrors(prev => ({
        ...prev,
        [deviceId]: "Pin cannot be empty"
      }));
      toast.error("Pin cannot be empty");
      return;
    }
    
    // Pin should only contain digits
    if (!/^\d+$/.test(newPin)) {
      setPinErrors(prev => ({
        ...prev,
        [deviceId]: "Pin must contain only digits"
      }));
      toast.error("Pin must contain only digits");
      return;
    }
    
    // Validate pin number is in the allowed list
    if (!validatePin(newPin)) {
      setPinErrors(prev => ({
        ...prev,
        [deviceId]: `Invalid pin number. Must be one of: ${VALID_PIN_NUMBERS.join(', ')}`
      }));
      toast.error(`Invalid physical pin. Must be one of: ${VALID_PIN_NUMBERS.join(', ')}`);
      return;
    }
    
    try {
      setSavingPins(prev => ({ ...prev, [deviceId]: true }));
      
      await updateDoc(doc(db, "devices", deviceId), {
        pin: newPin
      });
      
      // Clear any errors
      setPinErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[deviceId];
        return newErrors;
      });
      
      // Warn if the pin is potentially problematic on Pi 400
      if (isPinProblematicForPi400(newPin)) {
        toast.warning(
          `Pin ${newPin} may be reserved for keyboard functionality on Raspberry Pi 400. If it doesn't work, try one of the recommended pins.`,
          { duration: 6000 }
        );
      } else if (isPinRecommendedForPi400(newPin)) {
        toast.success("Pin updated successfully. This is a recommended pin for Pi 400.");
      } else {
        toast.success("Pin updated successfully");
      }
      
      // Re-enable live refresh if it was enabled before
      if (wasLiveRefreshEnabled) {
        setTimeout(() => toggleLiveRefresh(true), 1000);
      }
    } catch (error) {
      console.error("Error updating pin:", error);
      toast.error("Failed to update pin");
    } finally {
      setSavingPins(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  // Test a specific pin
  const testPin = async (pin: string) => {
    try {
      // Check if pin is valid
      if (!validatePin(pin)) {
        toast.error(`Invalid pin number. Must be one of: ${VALID_PIN_NUMBERS.join(', ')}`);
        return;
      }
      
      // Call the test pin API
      const response = await fetch('/api/test-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Testing pin ${pin}. It should turn ON for 1 second.`);
        if (result.warning) {
          toast.warning(result.warning, { duration: 6000 });
        }
      } else {
        toast.error(result.error || 'Failed to test pin');
      }
    } catch (error) {
      console.error('Error testing pin:', error);
      toast.error('Error testing pin');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Raspberry Pi 400 Control Interface</h1>
      
      {/* Pi 400 Notice */}
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="text-blue-500 dark:text-blue-400 h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <h3 className="font-medium text-blue-800 dark:text-blue-300">Raspberry Pi 400 Configuration</h3>
            <p className="mt-1 text-blue-700 dark:text-blue-400">
              This interface is optimized for Raspberry Pi 400. Some pins may be reserved for keyboard functionality.
              To avoid issues, we recommend using pins {PI_400_RECOMMENDED_PINS.join(', ')}.
            </p>
          </div>
        </div>
      </div>
      
      {/* Live Refresh Toggle */}
      <div className="mb-6 flex justify-center">
        <div className="flex items-center p-3 bg-background border rounded-lg shadow-sm">
          <span className="mr-3 font-medium">Live Refresh</span>
          <Switch
            checked={liveRefreshEnabled}
            onCheckedChange={toggleLiveRefresh}
            id="live-refresh-toggle"
          />
          <div className={cn(
            "ml-3 text-xs px-2 py-1 rounded-full flex items-center gap-1",
            liveRefreshEnabled 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted text-muted-foreground"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              liveRefreshEnabled && "animate-pulse bg-primary-foreground",
              !liveRefreshEnabled && "bg-muted-foreground"
            )} />
            <span>{liveRefreshEnabled ? "Live" : "Off"}</span>
          </div>
        </div>
      </div>
      
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
                disabled={liveRefreshEnabled}
              >
                <RefreshCw className={cn("w-4 h-4", liveRefreshEnabled && "animate-spin")} />
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
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3 dark:bg-amber-950/20 dark:border-amber-800">
                    <Info className="text-amber-500 dark:text-amber-400 h-5 w-5 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">Pi 400 Pin Recommendations:</span> Use pins {PI_400_RECOMMENDED_PINS.join(', ')} for best results.
                      <span className="block mt-1">
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                          <a 
                            href="https://pinout.xyz/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-amber-600 dark:text-amber-400"
                          >
                            View Raspberry Pi pinout diagram
                          </a>
                        </Button>
                      </span>
                    </div>
                  </div>
                  
                  {devices.map((device) => (
                    <div 
                      key={device.id} 
                      className={cn(
                        "border rounded-lg p-4 space-y-3",
                        device.pin_problematic && "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                      )}
                    >
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
                      
                      {device.pin_problematic && (
                        <div className="flex items-start gap-2 p-2 bg-amber-100 rounded-md dark:bg-amber-950/40">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Pin {device.pin} may be reserved on Pi 400. Consider changing to a recommended pin.
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            className={cn("flex-1", pinErrors[device.id] && "border-red-500")}
                            placeholder="Physical Pin Number (3-40)"
                            value={editingPins[device.id] || ""}
                            onChange={(e) => handlePinChange(device.id, e.target.value)}
                          />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
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
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-2 max-w-xs">
                                  <p className="font-medium">Valid pins: {VALID_PIN_NUMBERS.join(', ')}</p>
                                  <p className="text-xs text-amber-500">
                                    Recommended Pi 400 pins: {PI_400_RECOMMENDED_PINS.join(', ')}
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        {pinErrors[device.id] && (
                          <p className="text-xs text-red-500">{pinErrors[device.id]}</p>
                        )}
                        
                        {device.pin && (
                          <div className="flex gap-2 mt-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs", 
                                isPinRecommendedForPi400(device.pin) && "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400",
                                isPinProblematicForPi400(device.pin) && "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              )}
                            >
                              Pin {device.pin}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-6 px-2"
                              onClick={() => testPin(device.pin!)}
                            >
                              Test Pin
                            </Button>
                          </div>
                        )}
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
                disabled={liveRefreshEnabled}
              >
                <RefreshCw className={cn("w-4 h-4", liveRefreshEnabled && "animate-spin")} />
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
                disabled={liveRefreshEnabled}
              >
                <RefreshCw className={cn("w-4 h-4", liveRefreshEnabled && "animate-spin")} />
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
          
          {/* Raspberry Pi 400 Information - DIV4 */}
          <Card>
            <CardHeader>
              <CardTitle>Raspberry Pi 400 Information</CardTitle>
              <CardDescription>
                Special considerations for the Raspberry Pi 400 model
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">About Raspberry Pi 400</h3>
                <p className="text-sm text-muted-foreground">
                  The Raspberry Pi 400 is a complete personal computer built into a compact keyboard. 
                  While it has the same GPIO capabilities as other Raspberry Pi models, some pins may be used 
                  internally for keyboard and other functions.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Recommended Pins</h3>
                <p className="text-sm text-muted-foreground">
                  For the most reliable operation with Raspberry Pi 400, use these recommended pins:
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {PI_400_RECOMMENDED_PINS.map(pin => (
                    <Badge key={pin} variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                      {pin}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Potentially Problematic Pins</h3>
                <p className="text-sm text-muted-foreground">
                  These pins might be reserved for keyboard or internal functions on the Pi 400:
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {PI_400_PROBLEMATIC_PINS.map(pin => (
                    <Badge key={pin} variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      {pin}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Troubleshooting</h3>
                <p className="text-sm text-muted-foreground">
                  If you see "EINVAL: invalid argument" errors or "Error setting up GPIO pin" messages, the pin might 
                  be reserved or unavailable on Pi 400. Try using one of the recommended pins instead.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Always use <code>sudo npm start</code> when running the server to ensure proper GPIO permissions.
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
