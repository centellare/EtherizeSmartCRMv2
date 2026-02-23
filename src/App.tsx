import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Система восстановлена</h1>
        <p className="text-gray-700 mb-4">
          Приносим извинения за сбой. Структура проекта была повреждена, но мы восстановили основные файлы.
        </p>
        <p className="text-sm text-gray-500">
          Пожалуйста, сообщите, какой функционал вы хотели бы видеть или восстановить.
        </p>
      </div>
    </div>
  );
}

export default App;
