
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Input, Button } from './ui';

type AuthMode = 'login' | 'reset' | 'register' | 'update_password';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update_password');
      }
    });
    
    // Check URL params for pre-fill
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const emailParam = params.get('email');
    const nameParam = params.get('name');

    if (modeParam === 'register') setMode('register');
    if (emailParam) setEmail(emailParam);
    if (nameParam) setFullName(nameParam);

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage('Регистрация успешна! Пожалуйста, проверьте почту для подтверждения (если это настроено) или войдите.');
      setMode('login');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage('Ссылка для сброса пароля отправлена на ваш Email. Пожалуйста, проверьте почту.');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { error } = await supabase.auth.updateUser({ password: password });

    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage('Пароль успешно обновлен! Теперь вы можете войти с новым паролем.');
      setMode('login');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-[28px] shadow-sm border border-[#e1e2e1] animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#d3e4ff] text-[#001d3d] rounded-2xl mb-6 shadow-sm">
            <span className="material-icons-round text-3xl">
              {mode === 'login' ? 'home_max' : mode === 'update_password' ? 'lock_open' : 'lock_reset'}
            </span>
          </div>
          <h1 className="text-2xl font-medium text-[#1c1b1f] tracking-tight">
            {mode === 'login' ? 'SmartHome CRM' : mode === 'register' ? 'Регистрация' : mode === 'update_password' ? 'Новый пароль' : 'Восстановление доступа'}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {mode === 'login' 
              ? 'Войдите в систему для начала работы' 
              : mode === 'register'
              ? 'Создайте новый аккаунт'
              : mode === 'update_password'
              ? 'Введите новый пароль для вашего аккаунта'
              : 'Введите Email, указанный при регистрации'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            {error && <div className="bg-[#ffdad6] text-[#410002] p-4 rounded-xl text-sm animate-in shake-1 duration-200">{error}</div>}
            {successMessage && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-100">{successMessage}</div>}
            <div className="space-y-4">
              <Input label="Рабочий Email" type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} icon="email" />
              <div className="space-y-1">
                <Input label="Пароль" type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} icon="lock" />
                <div className="flex justify-between items-center">
                  <button 
                    type="button" 
                    onClick={() => { setMode('register'); setError(null); setSuccessMessage(null); }}
                    className="text-[11px] font-bold text-[#005ac1] uppercase tracking-wider hover:underline px-2 py-1"
                  >
                    Регистрация
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setMode('reset'); setError(null); setSuccessMessage(null); }}
                    className="text-[11px] font-bold text-[#005ac1] uppercase tracking-wider hover:underline px-2 py-1"
                  >
                    Забыли пароль?
                  </button>
                </div>
              </div>
            </div>
            <Button type="submit" loading={loading} className="w-full h-12" icon="login">Войти</Button>
          </form>
        ) : mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-6">
            {error && <div className="bg-[#ffdad6] text-[#410002] p-4 rounded-xl text-sm">{error}</div>}
            <div className="space-y-4">
              <Input label="ФИО" type="text" required value={fullName} onChange={(e: any) => setFullName(e.target.value)} icon="person" />
              <Input label="Рабочий Email" type="email" required value={email} onChange={(e: any) => setEmail(e.target.value)} icon="email" />
              <Input label="Пароль" type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} icon="lock" />
            </div>
            <div className="space-y-3">
              <Button type="submit" loading={loading} className="w-full h-12" icon="person_add">Зарегистрироваться</Button>
              <Button 
                variant="ghost" 
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                className="w-full h-12" 
                icon="arrow_back"
                disabled={loading}
              >
                Вернуться к входу
              </Button>
            </div>
          </form>
        ) : mode === 'update_password' ? (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            {error && <div className="bg-[#ffdad6] text-[#410002] p-4 rounded-xl text-sm">{error}</div>}
            <div className="space-y-4">
              <Input label="Новый пароль" type="password" required value={password} onChange={(e: any) => setPassword(e.target.value)} icon="lock" placeholder="Минимум 6 символов" />
            </div>
            <Button type="submit" loading={loading} className="w-full h-12" icon="save">Сохранить пароль</Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {error && <div className="bg-[#ffdad6] text-[#410002] p-4 rounded-xl text-sm">{error}</div>}
            {successMessage && <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm border border-emerald-100">{successMessage}</div>}
            
            <Input 
              label="Ваш Email" 
              type="email" 
              required 
              value={email} 
              onChange={(e: any) => setEmail(e.target.value)} 
              icon="alternate_email" 
              placeholder="example@company.com"
            />

            <div className="space-y-3">
              <Button type="submit" loading={loading} className="w-full h-12" icon="send">
                Отправить ссылку
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
                className="w-full h-12" 
                icon="arrow_back"
                disabled={loading}
              >
                Вернуться к входу
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;
