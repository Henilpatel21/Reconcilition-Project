import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { register as apiRegister } from '../services/authService';
import { ToastContext } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';

export default function Register(){
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState(null);
  const navigate = useNavigate();
  const toast = useContext(ToastContext);
  const { login } = React.useContext(AuthContext);

  const handle = async (e)=>{
    e.preventDefault();
    try{
      const res = await apiRegister({ name, email, password });
      toast.show('Registered successfully', 'success');
      // if backend returns token + user, set auth context and redirect
      if (res.token) {
        login(res.token, res.user);
      }
      navigate('/');
    }catch(err){
      setError(err?.response?.data?.message || 'Registration failed');
      toast.show('Registration failed', 'danger');
    }
  }

  return (
    <div className="container">
      <div className="card" style={{maxWidth:520, margin:'24px auto'}}>
        <h2>Register</h2>
        <form onSubmit={handle}>
          <div style={{marginBottom:8}}>
            <input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} style={{width:'100%',padding:8,borderRadius:6}} />
          </div>
          <div style={{marginBottom:8}}>
            <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:8,borderRadius:6}} />
          </div>
          <div style={{marginBottom:8}}>
            <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:8,borderRadius:6}} />
          </div>
          {error && <div className="muted" style={{color:'var(--danger)',marginBottom:8}}>{error}</div>}
          <button className="btn" type="submit">Register</button>
        </form>
      </div>
    </div>
  );
}
