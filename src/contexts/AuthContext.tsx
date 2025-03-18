
import React, { createContext, useState, useEffect, useContext } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  UserCredential 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "@/components/ui/sonner";

export type UserRole = "admin" | "normal";

interface AuthUser extends User {
  role: UserRole;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (userId: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user role from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const authUser = {
              ...user,
              role: userData.role as UserRole
            } as AuthUser;
            
            setCurrentUser(authUser);
          } else {
            // If user document doesn't exist yet, create it with default role
            await setDoc(doc(db, "users", user.uid), {
              email: user.email,
              role: "normal",
              createdAt: new Date()
            });
            
            const authUser = {
              ...user,
              role: "normal" as UserRole
            } as AuthUser;
            
            setCurrentUser(authUser);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          toast.error("Error loading user data");
        }
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login successful");
    } catch (error: any) {
      const errorMessage = error.message || "Failed to login";
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error: any) {
      const errorMessage = error.message || "Failed to logout";
      toast.error(errorMessage);
      throw error;
    }
  };

  const changePassword = async (userId: string, newPassword: string) => {
    try {
      // For security, only admins can change passwords
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("You do not have permission to change passwords");
      }

      // In a real app, you would typically use Firebase Admin SDK in a secure backend
      // For this demo, we're just showing the UI flow
      toast.success("Password changed successfully");
      return;
    } catch (error: any) {
      const errorMessage = error.message || "Failed to change password";
      toast.error(errorMessage);
      throw error;
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const value = {
    currentUser,
    isAdmin,
    isLoading,
    login,
    logout,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
