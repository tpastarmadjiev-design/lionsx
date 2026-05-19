import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CelebrationProvider } from "@/components/CelebrationProvider";
import { usePageViewTracking } from "@/hooks/usePageViewTracking";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Training from "./pages/Training";
import Challenges from "./pages/Challenges";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Ranks from "./pages/Ranks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  usePageViewTracking();
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/training" element={<Training />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/ranks" element={<Ranks />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CelebrationProvider>
            <AppRoutes />
          </CelebrationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
