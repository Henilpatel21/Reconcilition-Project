import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DataSources from './pages/DataSources';
import UploadSettlement from './pages/UploadSettlement';
import Reconciliation from './pages/Reconciliation';
import Logs from './pages/Logs';
import { ToastProvider } from './context/ToastContext';

function PrivateRoute({ children }){
  const { user } = React.useContext(AuthContext);
  if(!user) return <Navigate to="/login" />;
  return children;
}

export default function App(){
  return (
    <AuthProvider>
      <ToastProvider>
        <NavBar />
        <Routes
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/data-sources" element={<PrivateRoute><DataSources /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute><UploadSettlement /></PrivateRoute>} />
          <Route path="/reconcile" element={<PrivateRoute><Reconciliation /></PrivateRoute>} />
          <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
