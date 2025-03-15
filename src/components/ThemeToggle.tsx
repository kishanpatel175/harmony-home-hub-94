
import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme === "dark" ? "dark" : "light") as "light" | "dark";
  });
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    // Update class on document element
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setIsChanging(true);
    setTimeout(() => {
      setTheme(theme === "light" ? "dark" : "light");
      setIsChanging(false);
    }, 150);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="relative overflow-hidden group"
    >
      {isChanging ? (
        <SunMoon className="h-5 w-5 animate-spin" />
      ) : theme === "light" ? (
        <>
          <Moon className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
          <div className="absolute inset-0 bg-primary/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300"></div>
        </>
      ) : (
        <>
          <Sun className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" />
          <div className="absolute inset-0 bg-primary/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300"></div>
        </>
      )}
    </Button>
  );
};

export default ThemeToggle;
