import React, { useMemo } from 'react';

interface ArchiveTabProps {
  tasks: any[];
}

export const ArchiveTab: React.FC<ArchiveTabProps> = ({ tasks }) => {
  const documents = useMemo(() => {
    const list: any[] = [];
    tasks.forEach(t => {
      if (t.doc_link) {
        list.push({ id: `in-${t.id}`, type: 'input', name: t.doc_name || t.title, url: t.doc_link, date: t.created_at, author: t.creator?.full_name, task_name: t.title });
      }
      if (t.completion_doc_link) {
        list.push({ id: `out-${t.id}`, type: 'output', name: `Акт: ${t.completion_doc_name || t.title}`, url: t.completion_doc_link, date: t.completed_at, author: t.executor?.full_name, task_name: t.title });
      }
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tasks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h4 className="text-xl font-medium text-[#1c1b1f]">Архив документации</h4>
      {documents.length === 0 ? (
        <div className="p-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
          <p className="text-slate-400 font-medium italic">Файлы не найдены</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => (
            <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" 
              className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-blue-500 transition-all flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${doc.type === 'input' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <span className="material-icons-round text-2xl">{doc.type === 'input' ? 'description' : 'verified'}</span>
              </div>
              <div className="min-w-0 flex-grow">
                <p className="font-bold text-[#1c1b1f] truncate">{doc.name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">К задаче: {doc.task_name}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};