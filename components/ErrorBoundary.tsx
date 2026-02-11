import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// FIX: Use Component directly to avoid type resolution issues with React.Component
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    // Жесткая перезагрузка страницы для сброса состояния
    window.location.reload();
  };

  private handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-[32px] border border-red-100 shadow-xl text-center">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-icons-round text-4xl">error_outline</span>
            </div>
            
            <h2 className="text-2xl font-bold text-[#1c1b1f] mb-2">Что-то пошло не так</h2>
            <p className="text-slate-500 mb-6 text-sm">
              Произошла непредвиденная ошибка в интерфейсе. Мы уже работаем над этим.
            </p>

            <div className="bg-slate-50 p-4 rounded-xl mb-6 text-left overflow-auto max-h-32 border border-slate-100">
                <code className="text-xs text-red-800 font-mono break-all">
                    {this.state.error?.message || 'Unknown Error'}
                </code>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={this.handleReload} icon="refresh" className="w-full h-12">
                Перезагрузить страницу
              </Button>
              <Button onClick={this.handleClearCache} variant="ghost" icon="cleaning_services" className="w-full h-12 text-slate-500">
                Сбросить кэш и перезайти
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}