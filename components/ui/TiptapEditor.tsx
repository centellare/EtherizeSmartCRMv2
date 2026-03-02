import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from './Button';

interface TiptapEditorProps {
    content: string;
    onChange: (content: string, json?: any) => void;
    className?: string;
    placeholder?: string;
}

export interface TiptapEditorRef {
    getEditor: () => Editor | null;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({ 
    content, 
    onChange, 
    className = '',
    placeholder = 'Введите текст...'
}, ref) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: placeholder,
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML(), editor.getJSON());
        },
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-full p-0',
            },
        },
    });

    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
    }));

    // Update editor content when prop changes (but only if it's different to avoid loops)
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className={`flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white ${className}`}>
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border-b border-slate-200 no-print">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-slate-200' : ''}
                    title="Жирный"
                >
                    <span className="material-icons-round text-sm">format_bold</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-slate-200' : ''}
                    title="Курсив"
                >
                    <span className="material-icons-round text-sm">format_italic</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={editor.isActive('underline') ? 'bg-slate-200' : ''}
                    title="Подчеркнутый"
                >
                    <span className="material-icons-round text-sm">format_underlined</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={editor.isActive('strike') ? 'bg-slate-200' : ''}
                    title="Зачеркнутый"
                >
                    <span className="material-icons-round text-sm">format_strikethrough</span>
                </Button>

                <div className="w-px h-6 bg-slate-300 mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={editor.isActive({ textAlign: 'left' }) ? 'bg-slate-200' : ''}
                    title="По левому краю"
                >
                    <span className="material-icons-round text-sm">format_align_left</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={editor.isActive({ textAlign: 'center' }) ? 'bg-slate-200' : ''}
                    title="По центру"
                >
                    <span className="material-icons-round text-sm">format_align_center</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={editor.isActive({ textAlign: 'right' }) ? 'bg-slate-200' : ''}
                    title="По правому краю"
                >
                    <span className="material-icons-round text-sm">format_align_right</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                    className={editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-200' : ''}
                    title="По ширине"
                >
                    <span className="material-icons-round text-sm">format_align_justify</span>
                </Button>

                <div className="w-px h-6 bg-slate-300 mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'bg-slate-200' : ''}
                    title="Маркированный список"
                >
                    <span className="material-icons-round text-sm">format_list_bulleted</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'bg-slate-200' : ''}
                    title="Нумерованный список"
                >
                    <span className="material-icons-round text-sm">format_list_numbered</span>
                </Button>

                <div className="w-px h-6 bg-slate-300 mx-1 self-center" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    title="Отменить"
                >
                    <span className="material-icons-round text-sm">undo</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    title="Повторить"
                >
                    <span className="material-icons-round text-sm">redo</span>
                </Button>
                
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    title="Очистить форматирование"
                >
                    <span className="material-icons-round text-sm">format_clear</span>
                </Button>
            </div>

            {/* Editor Content */}
            <div className="flex-grow overflow-y-auto bg-white">
                <EditorContent editor={editor} className="h-full" />
            </div>
        </div>
    );
});
