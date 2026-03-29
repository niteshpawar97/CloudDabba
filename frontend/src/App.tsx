import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthLayout } from './layouts/AuthLayout';
import { AppLayout } from './layouts/AppLayout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { GitHubIntegration } from './pages/GitHubIntegration';
import { ProjectDetail } from './pages/ProjectDetail';
import { Deploy } from './pages/Deploy';
import { LogsViewer } from './pages/LogsViewer';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/github" element={<GitHubIntegration />} />
              <Route path="/projects/:projectId" element={<ProjectDetail />} />
              <Route path="/deploy" element={<Deploy />} />
              <Route path="/logs/:deploymentId" element={<LogsViewer />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
