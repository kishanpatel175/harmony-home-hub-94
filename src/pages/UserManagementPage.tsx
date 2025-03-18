
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, RefreshCw, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

const UserManagementPage = () => {
  const { isAdmin, changePassword } = useAuth();
  const [normalUserPassword, setNormalUserPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isUpdatingNormal, setIsUpdatingNormal] = useState(false);
  const [isUpdatingAdmin, setIsUpdatingAdmin] = useState(false);

  const handleChangeNormalPassword = async () => {
    if (!normalUserPassword) return;
    
    try {
      setIsUpdatingNormal(true);
      // In a real app, you would pass the user ID
      await changePassword("normal-user-id", normalUserPassword);
      setNormalUserPassword("");
    } catch (error) {
      // Error handled in changePassword
    } finally {
      setIsUpdatingNormal(false);
    }
  };

  const handleChangeAdminPassword = async () => {
    if (!adminPassword) return;
    
    try {
      setIsUpdatingAdmin(true);
      // In a real app, you would pass the user ID
      await changePassword("admin-user-id", adminPassword);
      setAdminPassword("");
    } catch (error) {
      // Error handled in changePassword
    } finally {
      setIsUpdatingAdmin(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Home
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 pb-20">
      <div className="flex justify-between items-center mb-6">
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        
        <Button asChild variant="outline">
          <Link to="/create-user">
            <UserPlus className="mr-2 h-4 w-4" />
            Create New User
          </Link>
        </Button>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Change passwords for system users
          </CardDescription>
        </CardHeader>
        
        <Tabs defaultValue="normal-user">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="normal-user">Normal User</TabsTrigger>
            <TabsTrigger value="admin-user">Admin User</TabsTrigger>
          </TabsList>
          
          <TabsContent value="normal-user">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="normal-password">New Password</Label>
                <Input
                  id="normal-password"
                  type="password"
                  placeholder="Enter new password"
                  value={normalUserPassword}
                  onChange={(e) => setNormalUserPassword(e.target.value)}
                  disabled={isUpdatingNormal}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleChangeNormalPassword}
                disabled={isUpdatingNormal || !normalUserPassword}
              >
                {isUpdatingNormal ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Normal User Password
                  </>
                )}
              </Button>
            </CardFooter>
          </TabsContent>
          
          <TabsContent value="admin-user">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">New Admin Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Enter new admin password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  disabled={isUpdatingAdmin}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant="destructive"
                onClick={handleChangeAdminPassword}
                disabled={isUpdatingAdmin || !adminPassword}
              >
                {isUpdatingAdmin ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Admin Password
                  </>
                )}
              </Button>
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default UserManagementPage;
