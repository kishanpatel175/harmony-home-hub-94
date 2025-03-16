
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
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { Member, roleHierarchy } from "./lib/types";
import { toast } from "./components/ui/sonner";

const queryClient = new QueryClient();

const App = () => {
  const [initializing, setInitializing] = useState(true);

  // Initialize the most privileged user based on present members
  const updateMostPrivilegedUser = async () => {
    try {
      console.log("Initializing most privileged user from present_scan...");
      // Fetch all present members
      const presentMembersQuery = collection(db, "present_scan");
      const presentSnapshot = await getDocs(presentMembersQuery);
      
      if (presentSnapshot.empty) {
        console.log("No members are present. Clearing privileged user.");
        // No one is present, clear the privileged user
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
        return;
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
      
      // Update the current_most_privileged_user document
      if (mostPrivilegedUser) {
        console.log(`Setting most privileged user to: ${mostPrivilegedUser.member_name} (${mostPrivilegedUser.role})`);
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: mostPrivilegedUser.memberId,
          current_privileged_role: mostPrivilegedUser.role,
          updatedAt: serverTimestamp()
        });
        toast.success(`Most privileged user set to: ${mostPrivilegedUser.member_name}`);
      } else {
        console.log("No privileged user found among present members.");
        // No privileged user found, clear it
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error initializing most privileged user:", error);
      toast.error("Failed to initialize privilege data");
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

  // Initialize Firebase collections with default values if they don't exist
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        setInitializing(true);
        // Set up panic mode document if it doesn't exist
        await setDoc(doc(db, "panic_mode", "current"), {
          is_panic_mode: false,
          activatedAt: serverTimestamp()
        }, { merge: true });
        
        // Initialize current privileged user from present members
        await updateMostPrivilegedUser();
        
        console.log("Firebase initialized with default documents");
      } catch (error) {
        console.error("Error initializing Firebase:", error);
      } finally {
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
