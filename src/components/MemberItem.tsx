
import { Member } from "@/lib/types";
import { useState, useEffect } from "react";
import { User, Crown, UserCheck, UserMinus, UserPlus, Home, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MemberAssignments from "./MemberAssignments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";

interface MemberItemProps {
  member: Member;
  isInside?: boolean;
  isPrivileged?: boolean;
  onUpdate?: () => void;
}

const MemberItem: React.FC<MemberItemProps> = ({ 
  member, 
  isInside = false,
  isPrivileged = false,
  onUpdate
}) => {
  const [assignedRoomsCount, setAssignedRoomsCount] = useState<number>(0);
  const [assignedDevicesCount, setAssignedDevicesCount] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
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

  const handleDeleteMember = async () => {
    try {
      setIsDeleting(true);
      await deleteDoc(doc(db, "members", member.memberId));
      toast.success(`${member.member_name} has been deleted`);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      toast.error("Failed to delete member");
    } finally {
      setIsDeleting(false);
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
          
          <div className="flex gap-2 mt-2">
            <MemberAssignments member={member} onUpdate={onUpdate} />
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {member.member_name} from the system.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteMember}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberItem;
