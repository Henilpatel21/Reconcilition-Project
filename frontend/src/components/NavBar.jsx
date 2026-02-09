import React, { useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="nav">
      <NavLink to="/" end className={({isActive}) => isActive ? 'active' : ''}>Dashboard</NavLink>
      <NavLink to="/data-sources" className={({isActive}) => isActive ? 'active' : ''}>Data Sources</NavLink>
      <NavLink to="/upload" className={({isActive}) => isActive ? 'active' : ''}>Upload Settlement</NavLink>
      <NavLink to="/reconcile" className={({isActive}) => isActive ? 'active' : ''}>Reconciliation</NavLink>
      <NavLink to="/logs" className={({isActive}) => isActive ? 'active' : ''}>Logs</NavLink>
      <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
        {user ? (
          <>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:12,color:'var(--muted)'}}>{user.role}</div>
              <div style={{fontWeight:700}}>{user.name}</div>
            </div>
            <button className="btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <NavLink to="/login">Login</NavLink>
        )}
      </div>
    </div>
  );
}
