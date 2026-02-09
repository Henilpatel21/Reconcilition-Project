import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '../services/authService';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import { Link } from 'react-router-dom';

export default function Login(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState(null);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const toast = useContext(ToastContext);

  const handle = async (e)=>{
    e.preventDefault();
    try{
      const res = await apiLogin({ email, password });
      login(res.token, res.user);
      toast.show('Logged in', 'success');
      navigate('/');
    }catch(err){
      setError(err?.response?.data?.message || 'Login failed');
      toast.show('Login failed', 'danger');
    }
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:480, margin:'24px auto'}}>
        <h2>Login</h2>
        <form onSubmit={handle}>
          <div style={{marginBottom:8}}>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:8,borderRadius:6}} />
          </div>
          <div style={{marginBottom:8}}>
            <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:8,borderRadius:6}} />
          </div>
          {error && <div className="muted" style={{color:'var(--danger)',marginBottom:8}}>{error}</div>}
          <button className="btn" type="submit">Login</button>
          <div style={{marginTop:12, textAlign:'center'}}>
            <small>First time here? <Link to="/register">Create an account</Link></small>
          </div>
        </form>
      </div>
    </div>
  );
}
