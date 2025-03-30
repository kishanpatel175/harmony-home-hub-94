
export interface Room {
  roomId: string;
  room_name: string;
  room_createdAt: any; // Firebase Timestamp
}

export interface Device {
  deviceId: string;
  device_name: string;
  device_category: "Light" | "Fan" | "TV" | "Door Lock" | "Refrigerator" | string;
  device_status: "ON" | "OFF";
  roomId: string | null;
  assignedMembers: string[];
  device_createdAt: any; // Firebase Timestamp
  pin: string; // New field for Raspberry Pi's physical pin number
}

export interface Member {
  memberId: string;
  member_name: string;
  role: "Owner" | "House Member" | "Guest" | "Maid";
  assignedRooms: string[];
  assignedDevices: string[];
  createdAt: any; // Firebase Timestamp
}

export interface ScanLog {
  scanId: string;
  scan_type: "inscan" | "outscan";
  scan_memberId: string;
  scan_time: any; // Firebase Timestamp
}

export interface CurrentPrivilegedUser {
  current_most_privileged_user_id: string;
  current_privileged_role: "Owner" | "House Member" | "Guest" | "Maid";
  updatedAt: any; // Firebase Timestamp
}

export interface PanicMode {
  is_panic_mode: boolean;
  activatedAt: any; // Firebase Timestamp
}

export const roleHierarchy = {
  "Owner": 4,
  "House Member": 3,
  "Guest": 2,
  "Maid": 1
};
