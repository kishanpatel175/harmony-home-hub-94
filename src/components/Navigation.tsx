
import { Link, useLocation } from "react-router-dom";
import { Home, User, Users, DoorClosed, Settings, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const location = useLocation();
  const { currentUser, isAdmin } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3 gap-1">
          <NavItem to="/" icon={<Home />} label="Home" isActive={location.pathname === "/"} />
          
          <NavItem to="/members" icon={<Users />} label="Members" isActive={location.pathname === "/members"} />
          
          {isAdmin && (
            <NavItem to="/users" icon={<User />} label="Users" isActive={location.pathname === "/users"} />
          )}
          
          {isAdmin && (
            <NavItem to="/raspberry-pi" icon={<Cpu />} label="Raspberry Pi" isActive={location.pathname === "/raspberry-pi"} />
          )}
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ to, icon, label, isActive }: { to: string; icon: React.ReactNode; label: string; isActive: boolean }) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center justify-center px-4 py-2 rounded-lg transition-colors", 
        isActive 
          ? "text-primary" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      <div className="w-6 h-6">{icon}</div>
      <span className="text-xs mt-1">{label}</span>
    </Link>
  );
};

export default Navigation;
