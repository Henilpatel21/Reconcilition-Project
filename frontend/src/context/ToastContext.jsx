import React, { createContext, useState } from 'react';

export const ToastContext = createContext();

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([]);

  const show = (message, type='info', timeout=4000) => {
    const id = Date.now()+Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(()=> setToasts(t => t.filter(x=>x.id!==id)), timeout);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{position:'fixed',right:16,top:16,zIndex:9999}}>
        {toasts.map(t=> (
          <div key={t.id} style={{marginBottom:8,background:'rgba(0,0,0,0.6)',padding:'8px 12px',borderRadius:6,color:'#fff'}}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
