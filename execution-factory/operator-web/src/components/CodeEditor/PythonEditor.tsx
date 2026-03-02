import { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { registerPythonCompletion, registerCompletionWithDependencies } from './python-completion';

interface PythonEditorProps {
  className?: string;
  height?: string;
  value?: string;
  options?: editor.IStandaloneEditorConstructionOptions;
  dependencies?: string[]; // 依赖库
  onChange?: (newValue: string) => void;
}

function PythonEditor({ className, height, value, options, onChange, dependencies }: PythonEditorProps) {
  const tempRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      // 卸载补全提供程序
      tempRef.current?.dispose?.();
    };
  }, [dependencies]);

  const handleEditorDidMount = (_: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    registerPythonCompletion(monaco);

    if (dependencies?.length) {
      // 注册依赖库的关键词，用于补全
      tempRef.current = registerCompletionWithDependencies(monaco, 'python', dependencies);
    }
  };

  return (
    <MonacoEditor
      className={className}
      height={height}
      language="python"
      value={value}
      onMount={handleEditorDidMount}
      options={{
        scrollbar: {
          // 滚动条大小
          verticalScrollbarSize: 8, // 宽度
          horizontalScrollbarSize: 8, // 高度
        },
        fontSize: 14,
        minimap: { enabled: false },
        // 禁用聚焦行的边框
        renderLineHighlight: 'none',
        // 禁用滚动BeyondLastLine
        scrollBeyondLastLine: false,
        ...options,
      }}
      onChange={newValue => {
        onChange?.(newValue || '');
      }}
    />
  );
}

export default PythonEditor;
