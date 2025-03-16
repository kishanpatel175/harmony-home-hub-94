
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RoomDetail from "./pages/RoomDetail";
import MembersPage from "./pages/MembersPage";
import Navigation from "./components/Navigation";
import { useEffect, useState } from "react";
import { db } from "./lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc, onSnapshot } from "firebase/firestore";
import { Member, roleHierarchy } from "./lib/types";
import { toast } from "./components/ui/sonner";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./components/PanicModeButton";

const queryClient = new QueryClient();

const App = () => {
  const [initializing, setInitializing] = useState(true);

  // Improved function to calculate and update the most privileged user
  const updateMostPrivilegedUser = async (presentMembers: Member[]) => {
    try {
      console.log("Calculating most privileged user from present members...", presentMembers);
      
      if (!presentMembers.length) {
        console.log("No members are present. Clearing privileged user.");
        // No one is present, clear the privileged user
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
        return;
      }
      
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
      
      // Check if the most privileged user has changed by first getting current value
      const currentPrivilegedDoc = await getDoc(doc(db, "current_most_privileged_user", "current"));
      const currentData = currentPrivilegedDoc.exists() ? currentPrivilegedDoc.data() : null;
      const currentPrivilegedId = currentData?.current_most_privileged_user_id || "";
      
      // Only update if there's a change to avoid unnecessary writes
      if (mostPrivilegedUser && (mostPrivilegedUser.memberId !== currentPrivilegedId)) {
        console.log(`Setting most privileged user to: ${mostPrivilegedUser.member_name} (${mostPrivilegedUser.role})`);
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: mostPrivilegedUser.memberId,
          current_privileged_role: mostPrivilegedUser.role,
          updatedAt: serverTimestamp()
        });
        toast.success(`Most privileged user set to: ${mostPrivilegedUser.member_name}`);
        
        // Dispatch event to notify components about the change
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
      } else if (!mostPrivilegedUser && currentPrivilegedId) {
        // If there's no privileged user but we had one before, clear it
        console.log("No privileged user found among present members.");
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT));
      } else {
        console.log("Privileged user remains unchanged");
      }
    } catch (error) {
      console.error("Error updating most privileged user:", error);
      toast.error("Failed to update privilege data");
    }
  };

  // Function to fetch present members
  const fetchPresentMembers = async () => {
    try {
      const presentMembersQuery = collection(db, "present_scan");
      const presentSnapshot = await getDocs(presentMembersQuery);
      
      if (presentSnapshot.empty) {
        return [];
      }
      
      // Get full member data for each present member
      const presentMembers: Member[] = [];
      for (const docSnap of presentSnapshot.docs) {
        const memberId = docSnap.id;
        const memberDoc = await getDoc(doc(db, "members", memberId));
        
        if (memberDoc.exists()) {
          presentMembers.push({
            ...memberDoc.data(),
            memberId: memberDoc.id
          } as Member);
        }
      }
      
      return presentMembers;
    } catch (error) {
      console.error("Error fetching present members:", error);
      return [];
    }
  };

  // Check for theme preference
  useEffect(() => {
    // Check localStorage for theme preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Initialize Firebase collections with default values and set up listeners
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        setInitializing(true);
        
        // Set up panic mode document if it doesn't exist
        await setDoc(doc(db, "panic_mode", "current"), {
          is_panic_mode: false,
          activatedAt: serverTimestamp()
        }, { merge: true });
        
        // Initial fetch and update of privileged user
        const presentMembers = await fetchPresentMembers();
        await updateMostPrivilegedUser(presentMembers);
        
        console.log("Firebase initialized with default documents");
        
        // Setup listener for present_scan collection to update privileged user in real-time
        const presentScanRef = collection(db, "present_scan");
        const unsubscribePresentScan = onSnapshot(presentScanRef, async (snapshot) => {
          console.log("Present scan changed, recalculating privileged user...");
          
          // Fetch updated member data for each present member ID
          const presentMemberIds = snapshot.docs.map(doc => doc.id);
          const updatedPresentMembers: Member[] = [];
          
          for (const memberId of presentMemberIds) {
            try {
              const memberDoc = await getDoc(doc(db, "members", memberId));
              if (memberDoc.exists()) {
                updatedPresentMembers.push({
                  ...memberDoc.data(),
                  memberId: memberDoc.id
                } as Member);
              }
            } catch (error) {
              console.error(`Error fetching member ${memberId}:`, error);
            }
          }
          
          // Update the privileged user based on the latest present members
          await updateMostPrivilegedUser(updatedPresentMembers);
        });
        
        setInitializing(false);
        
        return () => {
          unsubscribePresentScan();
        };
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        setInitializing(false);
      }
    };
    
    initializeFirebase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-background pb-16">
            {initializing ? (
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                <span className="ml-2 text-sm text-muted-foreground">Initializing system...</span>
              </div>
            ) : (
              <>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/room/:roomId" element={<RoomDetail />} />
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Navigation />
              </>
            )}
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
