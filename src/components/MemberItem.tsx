
import { Member } from "@/lib/types";
import { useState, useEffect } from "react";
import { User, Crown, UserCheck, UserMinus, UserPlus, Home, Pencil } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MemberItemProps {
  member: Member;
  isInside?: boolean;
  isPrivileged?: boolean;
}

const MemberItem: React.FC<MemberItemProps> = ({ 
  member, 
  isInside = false,
  isPrivileged = false 
}) => {
  const [assignedRoomsCount, setAssignedRoomsCount] = useState<number>(0);
  const [assignedDevicesCount, setAssignedDevicesCount] = useState<number>(0);
  
  useEffect(() => {
    setAssignedRoomsCount(member.assignedRooms.length || 0);
    setAssignedDevicesCount(member.assignedDevices.length || 0);
  }, [member]);

  const getRoleIcon = () => {
    switch (member.role) {
      case "Owner":
        return <Crown className="w-4 h-4" />;
      case "House Member":
        return <UserCheck className="w-4 h-4" />;
      case "Guest":
        return <UserPlus className="w-4 h-4" />;
      case "Maid":
        return <UserMinus className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = () => {
    switch (member.role) {
      case "Owner":
        return "text-amber-500 bg-amber-50";
      case "House Member":
        return "text-emerald-500 bg-emerald-50";
      case "Guest":
        return "text-blue-500 bg-blue-50";
      case "Maid":
        return "text-purple-500 bg-purple-50";
      default:
        return "text-gray-500 bg-gray-50";
    }
  };

  return (
    <div className={cn(
      "glass-card p-4 rounded-xl transition-standard",
      isPrivileged ? "ring-2 ring-primary/30" : ""
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          isInside ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          <User className="w-6 h-6" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{member.member_name}</h3>
            {isPrivileged && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                Privileged
              </Badge>
            )}
            {isInside && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-500 border-emerald-200">
                Inside
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs flex items-center gap-1", getRoleColor())}>
              {getRoleIcon()}
              <span>{member.role}</span>
            </Badge>
            
            {assignedRoomsCount > 0 && (
              <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1">
                <Home className="w-3 h-3" />
                <span>{assignedRoomsCount} {assignedRoomsCount === 1 ? "room" : "rooms"}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberItem;
