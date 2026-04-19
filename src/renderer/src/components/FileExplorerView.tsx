import { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  ChevronLeft, 
  RefreshCw, 
  Save, 
  FileText, 
  ChevronRight,
  Loader2,
  Download,
  Plus,
  FolderPlus,
  Upload,
  Trash2
} from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import './FileExplorerView.css';

interface FileItem {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

interface FileExplorerViewProps {
  server: any;
  isActive: boolean;
  isHidden: boolean;
}

const TEXT_EXTENSIONS = ['.txt', '.js', '.ts', '.tsx', '.jsx', '.json', '.yaml', '.yml', '.conf', '.cfg', '.log', '.md', '.sh', '.py', '.css', '.html', '.env', '.local', '.xml', '.bashrc', '.profile', '.dockerfile', '.yml', '.yaml'];

const getLanguageFromPath = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  const file = path.split('/').pop()?.toLowerCase();
  
  if (file === 'dockerfile') return 'dockerfile';
  if (file === 'package.json') return 'json';
  
  switch (ext) {
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    case 'sh': case 'bash': return 'shell';
    case 'yml': case 'yaml': return 'yaml';
    case 'py': return 'python';
    case 'xml': return 'xml';
    case 'sql': return 'sql';
    case 'conf': case 'ini': case 'cfg': return 'ini';
    default: return 'plaintext';
  }
};

const FileExplorerView = ({ server, isActive, isHidden }: FileExplorerViewProps) => {
  useEffect(() => {
    loader.init().then((monaco) => {
      monaco.editor.defineTheme('homelab-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0d1117',
          'editor.lineHighlightBackground': '#161b22',
        }
      });
    });
  }, []);

  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.sftpList(server.id, path);
      // Sort: directories first, then files
      const sorted = result.files.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sorted);
      setCurrentPath(result.path);
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file: FileItem) => {
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    if (file.isDir) {
      loadDirectory(fullPath);
    } else {
      openFile(fullPath);
    }
  };

  const openFile = async (path: string) => {
    // Basic restriction: only open common text extensions
    const fileName = path.split('/').pop()?.toLowerCase() || '';
    const isText = TEXT_EXTENSIONS.some(e => fileName.endsWith(e)) || !fileName.includes('.');
    
    if (!isText) {
      setError(`Cannot open binary file: ${path.split('/').pop()}. You can download it instead.`);
      setSelectedFile(null); // Don't show editor for binary
      return;
    }

    setReading(true);
    setSelectedFile(path);
    setError(null);
    try {
      const content = await window.api.sftpRead(server.id, path);
      setFileContent(content);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
      setSelectedFile(null);
    } finally {
      setReading(false);
    }
  };

  const handleDownload = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    try {
      await window.api.sftpDownload(server.id, fullPath, file.name);
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const handleDelete = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    
    if (!window.confirm(`Are you sure you want to delete ${file.isDir ? 'folder' : 'file'} "${file.name}"?`)) {
      return;
    }

    try {
      await window.api.sftpDelete(server.id, fullPath, file.isDir);
      loadDirectory(currentPath);
      if (selectedFile === fullPath) {
        setSelectedFile(null);
        setFileContent('');
      }
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateFile = async () => {
    if (!newItemName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`;
    try {
      await window.api.sftpTouch(server.id, fullPath);
      setNewItemName('');
      setIsCreatingFile(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Create file failed: ${err.message}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) return;
    const fullPath = currentPath === '/' ? `/${newItemName}` : `${currentPath}/${newItemName}`;
    try {
      await window.api.sftpMkdir(server.id, fullPath);
      setNewItemName('');
      setIsCreatingFolder(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Create folder failed: ${err.message}`);
    }
  };

  const handleManualUpload = async () => {
    const localPaths = await window.api.dialogOpenFiles();
    if (!localPaths) return;
    
    setLoading(true);
    try {
      for (const localPath of localPaths) {
        const fileName = localPath.split(/[\\/]/).pop()!;
        const remotePath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;
        await window.api.sftpUpload(server.id, localPath, remotePath);
      }
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    setLoading(true);
    try {
      for (const file of files) {
        const remotePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
        await window.api.sftpUpload(server.id, (file as any).path, remotePath);
      }
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Drop upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await window.api.sftpWrite(server.id, selectedFile, fileContent);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    loadDirectory(parentPath);
  };

  useEffect(() => {
    if (isActive && files.length === 0) {
      loadDirectory('.');
    }
  }, [isActive]);

  if (isHidden) return null;

  return (
    <div className={`file-explorer-container ${isActive ? 'animate-fade-in' : ''}`}>
      <div className="file-explorer-sidebar">
        <div className="explorer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} className="text-secondary" />
            <span>Explorer</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="icon-btn" onClick={() => { setIsCreatingFile(true); setIsCreatingFolder(false); setNewItemName(''); }} title="New File">
              <Plus size={14} />
            </button>
            <button className="icon-btn" onClick={() => { setIsCreatingFolder(true); setIsCreatingFile(false); setNewItemName(''); }} title="New Directory">
              <FolderPlus size={14} />
            </button>
            <button className="icon-btn" onClick={handleManualUpload} title="Upload">
              <Upload size={14} />
            </button>
            <button className="icon-btn" onClick={() => loadDirectory(currentPath)} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="current-path">
          <button className="icon-btn" onClick={goBack} disabled={currentPath === '/' || loading}>
            <ChevronLeft size={16} />
          </button>
          <span title={currentPath}>{currentPath}</span>
        </div>

        <div 
          className={`file-list ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {(isCreatingFile || isCreatingFolder) && (
            <div className="file-item creating">
              <div className="file-icon">
                {isCreatingFolder ? <Folder size={16} color="var(--accent-color)" /> : <FileText size={16} color="var(--text-secondary)" />}
              </div>
              <input 
                autoFocus
                className="inline-input"
                autoComplete="off"
                data-gramm="false"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') isCreatingFolder ? handleCreateFolder() : handleCreateFile();
                  if (e.key === 'Escape') { setIsCreatingFile(false); setIsCreatingFolder(false); }
                }}
                onBlur={() => {
                  setTimeout(() => { setIsCreatingFile(false); setIsCreatingFolder(false); }, 200);
                }}
              />
            </div>
          )}
          {loading && files.length === 0 ? (
            <div className="explorer-empty">
              <Loader2 className="animate-spin" />
              <span>Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="explorer-empty">
              <span>No files found</span>
            </div>
          ) : (
            files.map((file) => (
              <div 
                key={file.name} 
                className={`file-item ${selectedFile?.endsWith(file.name) ? 'active' : ''}`}
                onClick={() => handleFileClick(file)}
              >
                <div className="file-icon">
                  {file.isDir ? <Folder size={16} color="var(--accent-color)" /> : <FileText size={16} color="var(--text-secondary)" />}
                </div>
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  {!file.isDir && <div className="file-details">{(file.size / 1024).toFixed(1)} KB</div>}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {!file.isDir && (
                    <button className="icon-btn download-btn" onClick={(e) => handleDownload(file, e)} title="Download">
                      <Download size={14} />
                    </button>
                  )}
                  <button className="icon-btn delete-btn" onClick={(e) => handleDelete(file, e)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
                {file.isDir && <ChevronRight size={14} opacity={0.5} />}
              </div>
            ))
          )}
        </div>
        
        {error && (
          <div style={{ padding: '12px', background: 'var(--danger-color)', color: 'white', fontSize: '0.8rem' }}>
            {error}
          </div>
        )}
      </div>

      <div className="editor-area">
        {reading ? (
          <div className="explorer-empty">
            <Loader2 className="animate-spin" size={32} />
            <p>Reading remote file...</p>
          </div>
        ) : selectedFile ? (
          <>
            <div className="editor-header">
              <div className="editor-title">
                <File size={14} style={{ marginRight: 8 }} />
                {selectedFile.split('/').pop()}
              </div>
              <button 
                className="btn-save" 
                onClick={handleSave} 
                disabled={saving}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <Editor
                height="100%"
                theme="homelab-dark"
                loading={null}
                language={getLanguageFromPath(selectedFile)}
                value={fileContent}
                onChange={(value) => setFileContent(value || '')}
                options={{
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                  fixedOverflowWidgets: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="explorer-empty">
            <FileText size={48} opacity={0.2} />
            <p>Select a file to view or edit its content</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorerView;
