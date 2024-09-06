import React, { useState, useRef } from 'react';
import './App.css';

function DragDropBox() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    if (files[0].name.endsWith('.mp3')) {
      setFile(files[0]);
      console.log(files[0]);
    } else {
      alert('Please select an MP3 file.');
    }
  };

  const onBoxClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div
      className={`drag-drop-box ${isDragging ? 'dragging' : ''}`}
      onClick={onBoxClick}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        accept=".mp3"
        style={{ display: 'none' }}
      />
      {file ? (
        <p>File selected: {file.name}</p>
      ) : (
        <p>Drag and drop an MP3 file here, or click to select a file</p>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>MP3 File Uploader</h1>
        <DragDropBox />
      </header>
    </div>
  );
}

export default App;