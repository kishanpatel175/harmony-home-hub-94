
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { LockIcon, HomeIcon } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the destination from the location state, or default to home
  const from = (location.state as any)?.from?.pathname || "/";

  const handleLogin = async (mode: "normal" | "admin") => {
    if (!email || !password) {
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      
      // After successful login, navigate to the intended destination
      navigate(from, { replace: true });
    } catch (error) {
      // Error is handled in the login function
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to HAS-ESS</CardTitle>
          <CardDescription>
            Login to manage your home automation system
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="normal" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="normal">Normal Mode</TabsTrigger>
            <TabsTrigger value="admin">Admin Mode</TabsTrigger>
          </TabsList>
          <TabsContent value="normal">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email-normal">Email</Label>
                <Input
                  id="email-normal"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-normal">Password</Label>
                <Input
                  id="password-normal"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handleLogin("normal")}
                disabled={isSubmitting || !email || !password}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">↻</span>
                    Logging in...
                  </>
                ) : (
                  <>
                    <HomeIcon className="mr-2 h-4 w-4" />
                    Login as User
                  </>
                )}
              </Button>
            </CardFooter>
          </TabsContent>
          <TabsContent value="admin">
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email-admin">Admin Email</Label>
                <Input
                  id="email-admin"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-admin">Admin Password</Label>
                <Input
                  id="password-admin"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant="destructive"
                onClick={() => handleLogin("admin")}
                disabled={isSubmitting || !email || !password}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">↻</span>
                    Logging in...
                  </>
                ) : (
                  <>
                    <LockIcon className="mr-2 h-4 w-4" />
                    Login as Admin
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

export default LoginPage;
