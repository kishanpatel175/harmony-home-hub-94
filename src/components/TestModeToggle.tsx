
import { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const TestModeToggle = () => {
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and fetch test mode state
  useEffect(() => {
    const fetchTestModeState = async () => {
      try {
        setIsLoading(true);
        const testModeRef = doc(db, "test_mode", "current");
        const testModeSnap = await getDoc(testModeRef);
        
        if (testModeSnap.exists()) {
          setIsTestMode(testModeSnap.data().is_test_mode || false);
        } else {
          // Initialize the document if it doesn't exist
          await setDoc(testModeRef, {
            is_test_mode: false,
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error fetching test mode:", error);
        toast.error("Failed to fetch test mode state");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTestModeState();
  }, []);

  // Toggle test mode
  const toggleTestMode = async () => {
    try {
      setIsLoading(true);
      const newState = !isTestMode;
      
      // Update Firestore
      const testModeRef = doc(db, "test_mode", "current");
      await setDoc(testModeRef, {
        is_test_mode: newState,
        updatedAt: serverTimestamp()
      });
      
      setIsTestMode(newState);
      toast.success(`Test Mode ${newState ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error("Error toggling test mode:", error);
      toast.error("Failed to toggle test mode");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className={cn(
        "flex items-center gap-2 w-full transition-colors", 
        isTestMode ? "bg-amber-50 hover:bg-amber-100 border-amber-200" : "bg-background"
      )}
      onClick={toggleTestMode}
      disabled={isLoading}
    >
      {isTestMode ? (
        <ToggleRight className="w-5 h-5 text-amber-500" />
      ) : (
        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
      )}
      <span className={isTestMode ? "text-amber-700" : ""}>
        Test Mode {isTestMode ? "ON" : "OFF"}
      </span>
    </Button>
  );
};

export default TestModeToggle;
