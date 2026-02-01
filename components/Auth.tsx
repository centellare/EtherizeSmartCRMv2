import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Input, Button } from './ui';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-[28px] shadow-sm border border-[#e1e2e1]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#d3e4ff] text-[#001d3d] rounded-2xl mb-6">
            <span className="material-icons-round text-3xl">home_max</span>
          </div>
          <h1 className="text-2xl font-medium text-[#1c1b1f] tracking-tight">SmartHome CRM</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="bg-[#ffdad6] text-[#410002] p-4 rounded-xl text-sm">{error}</div>}
          <div className="space-y-4">
            <Input label="Рабочий Email" type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} icon="email" />
            <Input label="Пароль" type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} icon="lock" />
          </div>
          <Button type="submit" loading={loading} className="w-full h-12" icon="login">Войти</Button>
        </form>
      </div>
    </div>
  );
};

export default Auth;