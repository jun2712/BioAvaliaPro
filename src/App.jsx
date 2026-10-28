import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Painel from '@/pages/Painel';
import Home from '@/pages/Home';
import ClienteDetail from '@/pages/ClienteDetail';
import AvaliacaoForm from '@/pages/AvaliacaoForm';
import RelatorioPublico from '@/pages/RelatorioPublico';
import ImportExport from '@/pages/ImportExport';
import Relatorios from '@/pages/Relatorios';
import Anamnese from '@/pages/Anamnese';
import AnamnesePublica from '@/pages/AnamnesePublica';
import Agenda from '@/pages/Agenda';
import Configuracoes from '@/pages/Configuracoes';
import Administracao from '@/pages/Administracao';
import CalculoProteinaPublica from '@/pages/CalculoProteinaPublica';
import Privacidade from '@/pages/Privacidade';
import Termos from '@/pages/Termos';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/relatorio/:token" element={<RelatorioPublico />} />
    <Route path="/responder/:token" element={<AnamnesePublica />} />
    <Route path="/proteina/:token" element={<CalculoProteinaPublica />} />
    <Route path="/privacidade" element={<Privacidade />} />
    <Route path="/termos" element={<Termos />} />
    <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
      <Route path="/" element={<Painel />} />
      <Route path="/clientes" element={<Home />} />
      <Route path="/cliente/:id" element={<ClienteDetail />} />
      <Route path="/import-export" element={<ImportExport />} />
      <Route path="/relatorios" element={<Relatorios />} />
      <Route path="/anamnese" element={<Anamnese />} />
      <Route path="/agenda" element={<Agenda />} />
      <Route path="/configuracoes" element={<Configuracoes />} />
      <Route path="/administracao" element={<Administracao />} />
      <Route path="/avaliacao/nova/:clienteId" element={<AvaliacaoForm />} />
      <Route path="/avaliacao/editar/:id" element={<AvaliacaoForm />} />
    </Route>
    <Route path="*" element={<PageNotFound />} />
  </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App