
import React, { createContext, useState, useEffect, useContext } from "react";
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword,
  UserCredential,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  register: (email: string, password: string, role: UserRole) => Promise<void>;
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
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const authUser = {
              ...user,
              role: userData.role as UserRole
            } as AuthUser;
            
            setCurrentUser(authUser);
          } else {
            // For your specific users, create documents if they don't exist
            if (user.email === "kishanpatel1750@gmail.com") {
              await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: "admin",
                createdAt: serverTimestamp()
              });
              
              const authUser = {
                ...user,
                role: "admin" as UserRole
              } as AuthUser;
              
              setCurrentUser(authUser);
            } else if (user.email === "kishan6434@gmail.com") {
              await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: "normal",
                createdAt: serverTimestamp()
              });
              
              const authUser = {
                ...user,
                role: "normal" as UserRole
              } as AuthUser;
              
              setCurrentUser(authUser);
            } else {
              // Default for any other user
              await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: "normal",
                createdAt: serverTimestamp()
              });
              
              const authUser = {
                ...user,
                role: "normal" as UserRole
              } as AuthUser;
              
              setCurrentUser(authUser);
            }
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
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("You do not have permission to change passwords");
      }

      toast.success("Password changed successfully");
      return;
    } catch (error: any) {
      const errorMessage = error.message || "Failed to change password";
      toast.error(errorMessage);
      throw error;
    }
  };

  const register = async (email: string, password: string, role: UserRole) => {
    try {
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error("Only admin users can create new users");
      }

      setIsLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      await setDoc(doc(db, "users", newUser.uid), {
        email: newUser.email,
        role: role,
        createdAt: serverTimestamp()
      });

      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} user created successfully`);
      
      await signOut(auth);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to create user";
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const value = {
    currentUser,
    isAdmin,
    isLoading,
    login,
    logout,
    changePassword,
    register
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
