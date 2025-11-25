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
          if (file) {
            const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
            const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
            if (isMedia || isHeic) {
              newFiles.push(file);
            }
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

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      return isMedia || isHeic;
    });

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles).filter(file => {
        const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/');
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
        return isMedia || isHeic;
      });
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
        console.log(`Uploading ${fileName} (${formatFileSize(file.size)})`);

        // Step 1: Get SAS URL for direct upload
        newStatus[fileName] = 'Getting upload URL...';
        setUploadStatus({ ...newStatus });

        const urlResponse = await fetch(`/api/getUploadUrl?fileName=${encodeURIComponent(fileName)}`);
        
        console.log('Get upload URL response status:', urlResponse.status);
        console.log('Get upload URL response headers:', Object.fromEntries(urlResponse.headers.entries()));
        
        if (!urlResponse.ok) {
          const contentType = urlResponse.headers.get('content-type');
          let errorMessage = 'Failed to get upload URL';
          
          if (contentType && contentType.includes('application/json')) {
            try {
              const error = await urlResponse.json();
              errorMessage = error.error || error.message || errorMessage;
            } catch (e) {
              const text = await urlResponse.text();
              console.error('Non-JSON error response:', text);
              errorMessage = `HTTP ${urlResponse.status}: ${text.substring(0, 100)}`;
            }
          } else {
            const text = await urlResponse.text();
            console.error('Non-JSON error response:', text);
            errorMessage = `HTTP ${urlResponse.status}: ${text.substring(0, 100)}`;
          }
          
          throw new Error(errorMessage);
        }

        const responseText = await urlResponse.text();
        console.log('Get upload URL response body:', responseText.substring(0, 200));
        
        let uploadData;
        try {
          uploadData = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse JSON:', responseText);
          throw new Error('Invalid JSON response from server');
        }
        
        const { uploadUrl, fileName: uniqueFileName, renamed } = uploadData;
        
        if (renamed) {
          console.log(`File renamed to avoid duplicate: ${fileName} -> ${uniqueFileName}`);
          newStatus[fileName] = `Renamed to ${uniqueFileName}, uploading...`;
          setUploadStatus({ ...newStatus });
        }

        // Step 2: Upload directly to blob storage with progress tracking
        newStatus[fileName] = 'Uploading to storage...';
        setUploadStatus({ ...newStatus });

        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 90); // 0-90% for upload
            newProgress[fileName] = percentComplete;
            setUploadProgress({ ...newProgress });
          }
        });

        // Upload using XMLHttpRequest for progress tracking
        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response);
            } else {
              reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
            }
          });
          xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });

        console.log(`✅ Upload to storage complete: ${uniqueFileName}`);
        newProgress[fileName] = 90;
        setUploadProgress({ ...newProgress });

        // Step 3: Notify API that upload is complete
        newStatus[fileName] = 'Processing...';
        setUploadStatus({ ...newStatus });

        const completeResponse = await fetch('/api/uploadComplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: uniqueFileName,
            contentType: file.type || 'application/octet-stream',
            fileModifiedDate: file.lastModified ? new Date(file.lastModified).toISOString() : null
          }),
        });

        if (completeResponse.ok) {
          const result = await completeResponse.json();
          console.log(`✅ Processing complete:`, result);
          newProgress[fileName] = 100;
          newStatus[fileName] = 'success';
          successCount++;
        } else {
          const error = await completeResponse.json();
          throw new Error(error.error || 'Failed to process uploaded file');
        }

      } catch (error: any) {
        console.error(`❌ Upload error for ${fileName}:`, error);
        
        let errorMessage = 'Upload failed';
        if (error.name === 'AbortError') {
          errorMessage = 'Upload timed out';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        newStatus[fileName] = `error: ${errorMessage}`;
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
          <p>📁 Drag and drop images, videos, or audio files here</p>
          <p>or click to browse</p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>You can also paste (Ctrl+V) images from clipboard</p>
          <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
            Supported: Images (JPG, PNG, GIF), Videos (MP4, MOV), Audio (MP3, M4A, WAV, OGG)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.heic,.heif"
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

          {/* Overall Progress */}
          {uploading && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: '500' }}>
                Overall Progress: {Object.values(uploadStatus).filter(s => s === 'success').length} / {files.length} completed
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${(Object.values(uploadStatus).filter(s => s === 'success').length / files.length) * 100}%`,
                  height: '100%',
                  background: '#28a745',
                  transition: 'width 0.3s'
                }}></div>
              </div>
            </div>
          )}

          {/* Compact list view */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.9rem', fontWeight: '600' }}>Filename</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: '600', width: '80px' }}>Size</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', width: '80px' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', width: '200px' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', width: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{file.name}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: '#666' }}>
                      {formatFileSize(file.size)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
                      {file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : '🎙️'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
                      {uploadStatus[file.name] ? (
                        <>
                          {uploadStatus[file.name] === 'uploading' && (
                            <span style={{ color: '#007bff' }}>⏳ Uploading...</span>
                          )}
                          {uploadStatus[file.name] === 'Getting upload URL...' && (
                            <span style={{ color: '#6c757d' }}>🔗 Preparing...</span>
                          )}
                          {uploadStatus[file.name] === 'Uploading to storage...' && (
                            <div>
                              <div style={{ fontSize: '0.8rem', color: '#007bff', marginBottom: '2px' }}>
                                {uploadProgress[file.name]}%
                              </div>
                              <div style={{ width: '100%', height: '4px', background: '#e0e0e0', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ 
                                  width: `${uploadProgress[file.name]}%`,
                                  height: '100%',
                                  background: '#007bff',
                                  transition: 'width 0.2s'
                                }}></div>
                              </div>
                            </div>
                          )}
                          {uploadStatus[file.name] === 'Processing...' && (
                            <span style={{ color: '#ffc107' }}>⚙️ Processing...</span>
                          )}
                          {uploadStatus[file.name] === 'success' && (
                            <span style={{ color: '#28a745', fontWeight: '500' }}>✅ Done</span>
                          )}
                          {uploadStatus[file.name]?.startsWith('error') && (
                            <span style={{ color: '#dc3545', fontSize: '0.8rem' }} title={uploadStatus[file.name]}>
                              ❌ Error
                            </span>
                          )}
                          {uploadStatus[file.name]?.includes('Renamed to') && (
                            <span style={{ color: '#ff8800', fontSize: '0.8rem' }}>
                              📝 {uploadProgress[file.name]}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {!uploading && !uploadStatus[file.name] && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveFile(index)}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

        .files-list table {
          font-size: 0.95rem;
        }

        .files-list tbody tr:hover {
          background-color: #f8f9fa;
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
