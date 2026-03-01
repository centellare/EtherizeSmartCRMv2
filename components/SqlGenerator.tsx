
import React, { useState } from 'react';
import { TableSchema } from '../types';
import { MIGRATION_SQL_V10, MIGRATION_SQL_V11, MIGRATION_SQL_V12, MIGRATION_SQL_V13, MIGRATION_SQL_V14, MIGRATION_SQL_V15, MIGRATION_SQL_V16, MIGRATION_SQL_V17, MIGRATION_SQL_V18, MIGRATION_SQL_V19, MIGRATION_SQL_V20, MIGRATION_SQL_V21, MIGRATION_SQL_V22 } from '../constants';

interface SqlGeneratorProps { 
  schemas: TableSchema[]; 
}

const SqlGenerator: React.FC<SqlGeneratorProps> = ({ schemas }) => {
  const [copiedV22, setCopiedV22] = useState(false);
  const [copiedV21, setCopiedV21] = useState(false);
  const [copiedV20, setCopiedV20] = useState(false);
  const [copiedV19, setCopiedV19] = useState(false);
  const [copiedV18, setCopiedV18] = useState(false);
  const [copiedV17, setCopiedV17] = useState(false);
  const [copiedV16, setCopiedV16] = useState(false);
  const [copiedV15, setCopiedV15] = useState(false);
  const [copiedV14, setCopiedV14] = useState(false);
  const [copiedV13, setCopiedV13] = useState(false);
  const [copiedV12, setCopiedV12] = useState(false);
  const [copiedV11, setCopiedV11] = useState(false);
  const [copiedV10, setCopiedV10] = useState(false);

  const handleCopyV22 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V22);
    setCopiedV22(true);
    setTimeout(() => setCopiedV22(false), 2000);
  };

  const handleCopyV21 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V21);
    setCopiedV21(true);
    setTimeout(() => setCopiedV21(false), 2000);
  };

  const handleCopyV20 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V20);
    setCopiedV20(true);
    setTimeout(() => setCopiedV20(false), 2000);
  };

  const handleCopyV19 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V19);
    setCopiedV19(true);
    setTimeout(() => setCopiedV19(false), 2000);
  };

  const handleCopyV18 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V18);
    setCopiedV18(true);
    setTimeout(() => setCopiedV18(false), 2000);
  };

  const handleCopyV17 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V17);
    setCopiedV17(true);
    setTimeout(() => setCopiedV17(false), 2000);
  };

  const handleCopyV16 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V16);
    setCopiedV16(true);
    setTimeout(() => setCopiedV16(false), 2000);
  };

  const handleCopyV15 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V15);
    setCopiedV15(true);
    setTimeout(() => setCopiedV15(false), 2000);
  };

  const handleCopyV14 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V14);
    setCopiedV14(true);
    setTimeout(() => setCopiedV14(false), 2000);
  };

  const handleCopyV13 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V13);
    setCopiedV13(true);
    setTimeout(() => setCopiedV13(false), 2000);
  };

  const handleCopyV12 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V12);
    setCopiedV12(true);
    setTimeout(() => setCopiedV12(false), 2000);
  };

  const handleCopyV11 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V11);
    setCopiedV11(true);
    setTimeout(() => setCopiedV11(false), 2000);
  };

  const handleCopyV10 = () => {
    navigator.clipboard.writeText(MIGRATION_SQL_V10);
    setCopiedV10(true);
    setTimeout(() => setCopiedV10(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* V22 Custom Templates */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-[24px] border border-indigo-200 shadow-sm">
        <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-indigo-600">description</span>
          Пользовательские шаблоны (v22.0)
        </h3>
        <div className="text-sm text-indigo-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-indigo-100">
          <p className="font-bold mb-2">Обновление для работы с шаблонами:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поле <b>name</b> для названий шаблонов.</li>
            <li>Добавляет поле <b>is_system</b> для защиты базовых шаблонов.</li>
            <li>Мигрирует существующие шаблоны, присваивая им понятные имена.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV22}
              className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-indigo-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV22 ? 'check' : 'content_copy'}</span>
              {copiedV22 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5b4fc] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V22}
            </pre>
          </div>
        </div>
      </div>

      {/* V21 Financial Analytics */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-[24px] border border-emerald-200 shadow-sm">
        <h3 className="text-lg font-bold text-emerald-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-emerald-600">pie_chart</span>
          Финансовая аналитика (v21.0)
        </h3>
        <div className="text-sm text-emerald-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-emerald-100">
          <p className="font-bold mb-2">Обновление структуры финансов:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поля <b>section</b> и <b>description</b> в транзакции.</li>
            <li>Позволяет вести учет по категориям и разделам (для диаграмм).</li>
            <li>Мигрирует старые категории в комментарии.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV21}
              className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-emerald-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV21 ? 'check' : 'content_copy'}</span>
              {copiedV21 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5f3fc] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V21}
            </pre>
          </div>
        </div>
      </div>

      {/* V20 Privacy Hardening */}
      <div className="bg-gradient-to-br from-cyan-50 to-sky-50 p-6 rounded-[24px] border border-cyan-200 shadow-sm">
        <h3 className="text-lg font-bold text-cyan-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-cyan-600">lock</span>
          Приватность данных (v20.0)
        </h3>
        <div className="text-sm text-cyan-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-cyan-100">
          <p className="font-bold mb-2">Защита конфиденциальной информации:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Скрывает список сотрудников и клиентов от посторонних глаз.</li>
            <li>Клиенты видят только свой профиль и свои данные.</li>
            <li>Сотрудники видят всех клиентов и коллег (необходимо для работы).</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV20}
              className="px-4 py-2 bg-cyan-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-cyan-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV20 ? 'check' : 'content_copy'}</span>
              {copiedV20 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5f3fc] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V20}
            </pre>
          </div>
        </div>
      </div>

      {/* V19 Security Hardening */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-[24px] border border-indigo-200 shadow-sm">
        <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-indigo-600">security</span>
          Усиление безопасности (v19.0)
        </h3>
        <div className="text-sm text-indigo-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-indigo-100">
          <p className="font-bold mb-2">Критическое обновление безопасности:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет проверки прав доступа (RLS) внутрь RPC-функций.</li>
            <li>Запрещает создание задач и изменение этапов неавторизованным пользователям.</li>
            <li>Гарантирует, что только менеджеры и ответственные могут управлять объектами.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV19}
              className="px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-indigo-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV19 ? 'check' : 'content_copy'}</span>
              {copiedV19 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5b4fc] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V19}
            </pre>
          </div>
        </div>
      </div>

      {/* V18 Fix Role Casting */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-[24px] border border-emerald-200 shadow-sm">
        <h3 className="text-lg font-bold text-emerald-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-emerald-600">bug_report</span>
          Исправление ошибки типов (v18.0)
        </h3>
        <div className="text-sm text-emerald-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-emerald-100">
          <p className="font-bold mb-2">Исправляет ошибку "column role is of type user_role but expression is of type text":</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Обновляет функцию <code>admin_update_profile</code> с явным приведением типов (CAST).</li>
            <li>Теперь назначение ролей (в том числе 'client') будет работать корректно.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV18}
              className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-emerald-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV18 ? 'check' : 'content_copy'}</span>
              {copiedV18 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#e9d5ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V18}
            </pre>
          </div>
        </div>
      </div>

      {/* V17 Admin Manage User */}
      <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 p-6 rounded-[24px] border border-purple-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-purple-600">admin_panel_settings</span>
          Управление пользователями (v17.0)
        </h3>
        <div className="text-sm text-purple-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-purple-100">
          <p className="font-bold mb-2">Переход на "Закрытую систему":</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет функцию <code>admin_update_profile</code> для безопасного изменения ролей.</li>
            <li>Возвращает триггер регистрации в "безопасный режим" (всегда создает специалиста без доступа).</li>
            <li>Теперь права выдаются только через админ-панель.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV17}
              className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-purple-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV17 ? 'check' : 'content_copy'}</span>
              {copiedV17 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#e9d5ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V17}
            </pre>
          </div>
        </div>
      </div>

      {/* V16 Admin Delete User */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-[24px] border border-red-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-red-600">delete_forever</span>
          Функция удаления пользователей (v16.0)
        </h3>
        <div className="text-sm text-red-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-red-100">
          <p className="font-bold mb-2">Позволяет администраторам полностью удалять пользователей:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Создает безопасную RPC-функцию <code>admin_delete_user</code>.</li>
            <li>Решает проблему "This endpoint requires a valid Bearer token" при удалении через клиентский SDK.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV16}
              className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-red-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV16 ? 'check' : 'content_copy'}</span>
              {copiedV16 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#ffa5a5] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V16}
            </pre>
          </div>
        </div>
      </div>

      {/* V15 Client Registration Fix */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-[24px] border border-blue-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-blue-600">person_add</span>
          Исправление регистрации клиентов (v15.0)
        </h3>
        <div className="text-sm text-blue-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-blue-100">
          <p className="font-bold mb-2">Этот скрипт исправляет конфликт при создании доступа для клиентов:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Теперь система проверяет метаданные при создании пользователя.</li>
            <li>Если роль "client" (создан админом) — <b>автоматическое подтверждение</b>.</li>
            <li>Если роль не указана (обычная регистрация) — требует подтверждения.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV15}
              className="px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-blue-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV15 ? 'check' : 'content_copy'}</span>
              {copiedV15 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5d6ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V15}
            </pre>
          </div>
        </div>
      </div>

      {/* V14 Registration Fix Final */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-[24px] border border-emerald-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-emerald-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-emerald-600">verified_user</span>
          Финальное исправление регистрации (v14.0)
        </h3>
        <div className="text-sm text-emerald-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-emerald-100">
          <p className="font-bold mb-2">Этот скрипт максимально упрощает процесс регистрации:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Убирает все проверки (SELECT) из триггера, чтобы избежать блокировок.</li>
            <li>Явно задает search_path = public для безопасности.</li>
            <li>Добавляет политику INSERT для профилей (на всякий случай).</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV14}
              className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-emerald-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV14 ? 'check' : 'content_copy'}</span>
              {copiedV14 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5ffca] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V14}
            </pre>
          </div>
        </div>
      </div>

      {/* V13 Registration Recovery */}
      <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-[24px] border border-red-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-red-600">medical_services</span>
          Экстренное восстановление (v13.0)
        </h3>
        <div className="text-sm text-red-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-red-100">
          <p className="font-bold mb-2">Используйте этот скрипт, если регистрация "зависает":</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Полностью отключает уведомления при регистрации (возможная причина зависания).</li>
            <li>Гарантирует создание профиля.</li>
            <li>Проверяет наличие необходимых колонок.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV13}
              className="px-4 py-2 bg-red-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-red-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV13 ? 'check' : 'content_copy'}</span>
              {copiedV13 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#ffa5a5] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V13}
            </pre>
          </div>
        </div>
      </div>

      {/* V12 Registration Fix */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-[24px] border border-orange-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-orange-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-orange-600">bug_report</span>
          Исправление регистрации (v12.0)
        </h3>
        <div className="text-sm text-orange-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-orange-100">
          <p className="font-bold mb-2">Этот скрипт исправляет ошибку "Database error saving new user":</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Полностью пересоздает триггер регистрации.</li>
            <li>Добавляет обработку ошибок при создании уведомлений.</li>
            <li>Гарантирует создание пользователя даже при сбое уведомлений.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV12}
              className="px-4 py-2 bg-orange-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-orange-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV12 ? 'check' : 'content_copy'}</span>
              {copiedV12 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#ffdca5] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V12}
            </pre>
          </div>
        </div>
      </div>

      {/* V11 Security Update */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-[24px] border border-amber-200 shadow-sm opacity-50 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-amber-600">security</span>
          Обновление безопасности (v11.0)
        </h3>
        <div className="text-sm text-amber-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-amber-100">
          <p className="font-bold mb-2">Этот скрипт добавляет систему подтверждения пользователей:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поле <b>is_approved</b> в профили.</li>
            <li>Блокирует доступ неподтвержденным пользователям.</li>
            <li>Добавляет функции для смены пароля/email администратором.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV11}
              className="px-4 py-2 bg-amber-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-amber-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV11 ? 'check' : 'content_copy'}</span>
              {copiedV11 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#ffdca5] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V11}
            </pre>
          </div>
        </div>
      </div>

      {/* V10 Document Customization */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-[24px] border border-purple-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-bold text-purple-900 mb-2 flex items-center gap-2">
          <span className="material-icons-round text-purple-600">edit_document</span>
          Обновление базы данных (v10.0)
        </h3>
        <div className="text-sm text-purple-800 mb-4 leading-relaxed bg-white/50 p-4 rounded-xl border border-purple-100">
          <p className="font-bold mb-2">Этот скрипт добавляет возможность кастомизации документов:</p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Добавляет поля <b>preamble</b> и <b>footer</b> в таблицы КП и Счетов.</li>
            <li>Позволяет добавлять произвольный текст в начало и конец документов.</li>
          </ul>
        </div>
        
        <div className="relative group">
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={handleCopyV10}
              className="px-4 py-2 bg-purple-600 text-white rounded-full text-xs font-bold transition-all shadow-lg flex items-center gap-2 hover:bg-purple-700 hover:scale-105 active:scale-95"
            >
              <span className="material-icons-round text-sm">{copiedV10 ? 'check' : 'content_copy'}</span>
              {copiedV10 ? 'СКОПИРОВАНО' : 'КОПИРОВАТЬ SQL'}
            </button>
          </div>
          <div className="bg-[#1e1e1e] p-6 rounded-[20px] border border-slate-800 overflow-hidden shadow-inner">
            <pre className="overflow-x-auto text-[#a5d6ff] font-mono text-xs leading-relaxed scrollbar-hide whitespace-pre-wrap max-h-[400px]">
              {MIGRATION_SQL_V10}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlGenerator;
