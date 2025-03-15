
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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const queryClient = new QueryClient();

const App = () => {
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
        // Set up panic mode document if it doesn't exist
        await setDoc(doc(db, "panic_mode", "current"), {
          is_panic_mode: false,
          activatedAt: serverTimestamp()
        }, { merge: true });
        
        // Set up current privileged user document if it doesn't exist
        await setDoc(doc(db, "current_most_privileged_user", "current"), {
          current_most_privileged_user_id: "",
          current_privileged_role: "",
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log("Firebase initialized with default documents");
      } catch (error) {
        console.error("Error initializing Firebase:", error);
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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/room/:roomId" element={<RoomDetail />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Navigation />
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
