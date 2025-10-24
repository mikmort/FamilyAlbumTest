'use client';

import { useState, useRef, useEffect } from 'react';

interface UploadMediaProps {
  onProcessFiles?: () => void;
}

export default function UploadMedia({ onProcessFiles }: UploadMediaProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: string }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
            newFiles.push(file);
          }
        }
      }

      if (newFiles.length > 0) {
        setFiles(prev => [...prev, ...newFiles]);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/') || file.type.startsWith('video/')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles).filter(
        file => file.type.startsWith('image/') || file.type.startsWith('video/')
      );
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please add files to upload');
      return;
    }

    setUploading(true);
    const newProgress: { [key: string]: number } = {};
    const newStatus: { [key: string]: string } = {};
    let successCount = 0;

    for (const file of files) {
      const fileName = file.name;
      newProgress[fileName] = 0;
      newStatus[fileName] = 'uploading';
      setUploadProgress({ ...newProgress });
      setUploadStatus({ ...newStatus });

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          newProgress[fileName] = 100;
          newStatus[fileName] = 'success';
          successCount++;
        } else {
          const error = await response.json();
          newStatus[fileName] = `error: ${error.error || 'Upload failed'}`;
        }
      } catch (error) {
        console.error('Upload error:', error);
        newStatus[fileName] = 'error: Network error';
      }

      setUploadProgress({ ...newProgress });
      setUploadStatus({ ...newStatus });
    }

    setUploading(false);
    setUploadedCount(successCount);
  };

  const handleClearCompleted = () => {
    setFiles(prev => prev.filter(file => uploadStatus[file.name] !== 'success'));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="upload-media-container">
      <h2>Upload Media</h2>
      
      {uploadedCount > 0 && (
        <div className="upload-success-banner">
          <p>✅ Successfully uploaded {uploadedCount} file{uploadedCount !== 1 ? 's' : ''}!</p>
          {onProcessFiles && (
            <button className="btn btn-primary" onClick={onProcessFiles}>
              Process Files Now →
            </button>
          )}
        </div>
      )}
      
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drop-zone-content">
          <p>📁 Drag and drop images or videos here</p>
          <p>or click to browse</p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>You can also paste (Ctrl+V) images from clipboard</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div className="files-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{files.length} file{files.length !== 1 ? 's' : ''} selected</h3>
            <div>
              <button
                className="btn btn-secondary"
                onClick={handleClearCompleted}
                disabled={uploading}
                style={{ marginRight: '0.5rem' }}
              >
                Clear Completed
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>
          </div>

          {files.map((file, index) => (
            <div key={index} className="file-item">
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
                <span className="file-type">
                  {file.type.startsWith('image/') ? '🖼️ Image' : '🎬 Video'}
                </span>
              </div>
              
              {uploadStatus[file.name] && (
                <div className="upload-status">
                  {uploadStatus[file.name] === 'uploading' && (
                    <span style={{ color: '#007bff' }}>⏳ Uploading...</span>
                  )}
                  {uploadStatus[file.name] === 'success' && (
                    <span style={{ color: '#28a745' }}>✅ Uploaded</span>
                  )}
                  {uploadStatus[file.name]?.startsWith('error') && (
                    <span style={{ color: '#dc3545' }}>{uploadStatus[file.name]}</span>
                  )}
                </div>
              )}

              {!uploading && !uploadStatus[file.name] && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleRemoveFile(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .upload-media-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .drop-zone {
          border: 3px dashed #ccc;
          border-radius: 8px;
          padding: 3rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: #f8f9fa;
          margin-bottom: 2rem;
        }

        .drop-zone:hover, .drop-zone.dragging {
          border-color: #007bff;
          background: #e7f3ff;
        }

        .drop-zone-content p {
          margin: 0.5rem 0;
          font-size: 1.1rem;
        }

        .files-list {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
        }

        .file-info {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex: 1;
        }

        .file-name {
          font-weight: 500;
          flex: 1;
        }

        .file-size, .file-type {
          color: #666;
          font-size: 0.9rem;
        }

        .upload-status {
          margin: 0 1rem;
        }

        .upload-success-banner {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .upload-success-banner p {
          margin: 0;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
