
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import RoomDetail from "./pages/RoomDetail";
import MembersPage from "./pages/MembersPage";
import UserManagementPage from "./pages/UserManagementPage";
import UserCreationPage from "./pages/UserCreationPage";
import RaspberryPiInterface from "./pages/RaspberryPiInterface";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import { useEffect, useState, useRef } from "react";
import { db } from "./lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc, onSnapshot } from "firebase/firestore";
import { Member, roleHierarchy } from "./lib/types";
import { toast } from "./components/ui/sonner";
import { deviceUpdateEvent, DEVICE_UPDATE_EVENT } from "./components/PanicModeButton";

const queryClient = new QueryClient();

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const prevPrivilegedUserRef = useRef<string>("");
  const isInitialLoadRef = useRef<boolean>(true);

  const updateMostPrivilegedUser = async (presentMembers: Member[]) => {
    try {
      console.log("Calculating most privileged user from present members...", presentMembers);
      
      if (!presentMembers.length) {
        console.log("No members are present. Clearing privileged user.");
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT, { 
          detail: { type: 'privileged_user_changed', value: null }
        }));
        return;
      }
      
      let mostPrivilegedUser: Member | null = null;
      let highestRoleRank = -1;
      
      for (const member of presentMembers) {
        const roleRank = roleHierarchy[member.role as keyof typeof roleHierarchy] || 0;
        if (roleRank > highestRoleRank) {
          highestRoleRank = roleRank;
          mostPrivilegedUser = member;
        }
      }
      
      const currentPrivilegedDoc = await getDoc(doc(db, "current_most_privileged_user", "current"));
      const currentData = currentPrivilegedDoc.exists() ? currentPrivilegedDoc.data() : null;
      const currentPrivilegedId = currentData?.current_most_privileged_user_id || "";
      
      if (mostPrivilegedUser && (mostPrivilegedUser.memberId !== currentPrivilegedId)) {
        console.log(`Setting most privileged user to: ${mostPrivilegedUser.member_name} (${mostPrivilegedUser.role})`);
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: mostPrivilegedUser.memberId,
          current_privileged_role: mostPrivilegedUser.role,
          updatedAt: serverTimestamp()
        });
        toast.success(`Most privileged user set to: ${mostPrivilegedUser.member_name}`);
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT, { 
          detail: { 
            type: 'privileged_user_changed', 
            value: mostPrivilegedUser 
          }
        }));
      } else if (!mostPrivilegedUser && currentPrivilegedId) {
        console.log("No privileged user found among present members.");
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        });
        deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT, { 
          detail: { type: 'privileged_user_changed', value: null }
        }));
      } else {
        console.log("Privileged user remains unchanged");
      }
    } catch (error) {
      console.error("Error updating most privileged user:", error);
      toast.error("Failed to update privilege data");
    }
  };

  const fetchPresentMembers = async () => {
    try {
      const presentMembersQuery = collection(db, "present_scan");
      const presentSnapshot = await getDocs(presentMembersQuery);
      
      if (presentSnapshot.empty) {
        return [];
      }
      
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

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        setInitializing(true);
        
        await setDoc(doc(db, "panic_mode", "current"), {
          is_panic_mode: false,
          activatedAt: serverTimestamp()
        }, { merge: true });
        
        const presentMembers = await fetchPresentMembers();
        await updateMostPrivilegedUser(presentMembers);
        
        console.log("Firebase initialized with default documents");
        
        const currentPrivilegedDoc = await getDoc(doc(db, "current_most_privileged_user", "current"));
        if (currentPrivilegedDoc.exists()) {
          prevPrivilegedUserRef.current = currentPrivilegedDoc.data().current_most_privileged_user_id || "";
        }
        
        const presentScanRef = collection(db, "present_scan");
        const unsubscribePresentScan = onSnapshot(presentScanRef, async (snapshot) => {
          console.log("Present scan changed, recalculating privileged user...");
          
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
          
          await updateMostPrivilegedUser(updatedPresentMembers);
        });
        
        const privilegedUserRef = doc(db, "current_most_privileged_user", "current");
        const unsubscribePrivilegedUser = onSnapshot(privilegedUserRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log("Privileged user document changed:", data);
            const newPrivilegedUserId = data.current_most_privileged_user_id || "";
            
            deviceUpdateEvent.dispatchEvent(new CustomEvent(DEVICE_UPDATE_EVENT, { 
              detail: { 
                type: 'privileged_user_document_changed',
                value: data
              }
            }));
            
            if (!isInitialLoadRef.current && prevPrivilegedUserRef.current !== newPrivilegedUserId) {
              console.log("Privileged user changed from", prevPrivilegedUserRef.current, "to", newPrivilegedUserId);
              prevPrivilegedUserRef.current = newPrivilegedUserId;
              window.location.reload();
            } else {
              prevPrivilegedUserRef.current = newPrivilegedUserId;
              if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;
              }
            }
          }
        });
        
        setInitializing(false);
        
        return () => {
          unsubscribePresentScan();
          unsubscribePrivilegedUser();
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
      <AuthProvider>
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
                    <Route path="/login" element={<LoginPage />} />
                    
                    <Route path="/" element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/room/:roomId" element={
                      <ProtectedRoute>
                        <RoomDetail />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/members" element={
                      <ProtectedRoute requireAdmin={true}>
                        <MembersPage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/users" element={
                      <ProtectedRoute requireAdmin={true}>
                        <UserManagementPage />
                      </ProtectedRoute>
                    } />

                    <Route path="/create-user" element={
                      <ProtectedRoute requireAdmin={true}>
                        <UserCreationPage />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="/raspberry-pi" element={
                      <ProtectedRoute requireAdmin={true}>
                        <RaspberryPiInterface />
                      </ProtectedRoute>
                    } />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <Navigation />
                </>
              )}
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
