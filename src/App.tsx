
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, HashRouter, useLocation, useNavigate } from "react-router-dom";
import { UserProvider } from "@/contexts/UserContext";
import { GameStateProvider } from "@/contexts/GameStateContext";
import OnePocketArena from "./pages/OnePocketArena";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import PaymentPage from "./pages/Payment";
import UserSettings from "./pages/UserSettings";
import ReloadCoinsPage from "./pages/ReloadCoins";
import SignupPage from "./pages/Signup";
import MemberSignupPage from "./pages/MemberSignup";
import FeaturesPage from "./pages/Features";
import AboutPage from "./pages/About";
import FAQPage from "./pages/FAQ";
import { CreditAuditDashboard } from "@/components/CreditAuditDashboard";
import UserRecovery from "./pages/UserRecovery";
import DebugGameState from "./pages/DebugGameState";
import AuditDashboard from "./pages/AuditDashboard";
import BettingSimulator from "./pages/BettingSimulator";
import Whitebook from "./pages/Whitebook";
import "./App.css";

const queryClient = new QueryClient();

// Quick access arena selector component
const ArenaSelector = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Don't show on landing or other non-arena pages
  const isArenasPage = currentPath === "/" || currentPath === "/betting-queue" || currentPath === "/one-pocket-arena";
  
  if (!isArenasPage) return null;

  const handleBettingQueue = () => {
    // Mute sounds BEFORE navigation
    (window as any).__MUTE_SOUNDS = true;
    setTimeout(() => {
      (window as any).__MUTE_SOUNDS = false;
    }, 10000);
    navigate("/one-pocket-arena");
  };

  const isBettingArena = currentPath === "/betting-queue" || currentPath === "/one-pocket-arena";

  return null;
  // Betting Queue button removed - replaced with navigation from landing page
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <GameStateProvider>
            <Routes>
              {/* Main landing page - keep accessible */}
              <Route path="/" element={<Landing />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/member-signup" element={<MemberSignupPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/about" element={<AboutPage />} />
              {/* 9-BALL ARENA HIDDEN - Redirect betting arena routes to 1-Pocket only */}
              <Route path="/betting-queue" element={<OnePocketArena />} />
              <Route path="/one-pocket-arena" element={<OnePocketArena />} />
              <Route path="/subscription" element={<PaymentPage />} />
              <Route path="/user-settings" element={<UserSettings />} />
              <Route path="/reload-coins" element={<ReloadCoinsPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/credit-audit" element={<CreditAuditDashboard />} />
              <Route path="/recover-users" element={<UserRecovery />} />
              <Route path="/debug-state" element={<DebugGameState />} />
              <Route path="/audit" element={<AuditDashboard />} />
              <Route path="/simulate" element={<BettingSimulator />} />
              <Route path="/whitebook" element={<Whitebook />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ArenaSelector />
          </GameStateProvider>
        </HashRouter>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
