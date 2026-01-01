import { Bell, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

interface HeaderProps {
  title: string;
  subtitle?: string;
  animated?: boolean; // تفعيل الحركة (افتراضياً false)
}

export default function Header({ title, subtitle, animated = false }: HeaderProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <div className="bg-gradient-to-r from-primary/20 to-accent/20 border-b border-border py-1 px-6">
      <div className="container max-w-lg mx-auto flex items-center justify-between">
        <div className="flex-1 overflow-hidden relative">
          {animated ? (
            <div className="inline-block animate-[scroll_10s_linear_infinite]">
              <h1 className="text-lg font-bold text-foreground whitespace-nowrap inline-block">
                {title} &nbsp;&nbsp;&nbsp; {title} &nbsp;&nbsp;&nbsp; {title}
              </h1>
            </div>
          ) : (
            <h1 className="text-lg font-bold text-foreground">
              {title}
            </h1>
          )}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {user?.role === 'admin' && (
            <button 
              onClick={() => setLocation('/admin')}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              title="لوحة التحكم"
            >
              <Settings className="w-6 h-6 text-foreground" />
            </button>
          )}
          <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <Bell className="w-6 h-6 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
