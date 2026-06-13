import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ConversationProvider } from "@/context/ConversationContext";
import AppLayout from "@/components/layout/AppLayout";
import SettingsPage from "./pages/SettingsPage";
import ContactsPage from "./pages/ContactsPage";
import MessageQueuePage from "./pages/MessageQueuePage";
import ContactProfilePage from "./pages/ContactProfilePage";
import AddJobPage from "./pages/AddJobPage";
import LoginPage from "./pages/LoginPage";
import JobCompletePage from "./pages/JobCompletePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/job-complete" element={<JobCompletePage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ConversationProvider>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/messages" replace />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/contacts" element={<ContactsPage />} />
                      <Route path="/messages" element={<MessageQueuePage />} />
                      <Route path="/add-job" element={<AddJobPage />} />
                      <Route path="/contacts/:id" element={<ContactProfilePage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                  </ConversationProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
