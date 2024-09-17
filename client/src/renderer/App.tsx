import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const App: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'video/mp4') {
      setVideoSrc(URL.createObjectURL(file));
      setFileName(file.name);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setEndTime(videoRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFastForward = () => {
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.currentTime + 1, duration);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleRewind = () => {
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 1, 0);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && videoRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickedTime = (x / rect.width) * duration;
      videoRef.current.currentTime = clickedTime;
      setCurrentTime(clickedTime);
    }
  };

  const handleTrimDrag = (e: React.MouseEvent<HTMLDivElement>, isStart: boolean) => {
    const handleMouseMove = (e: MouseEvent) => {
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newTime = (x / rect.width) * duration;
        if (isStart) {
          setStartTime(Math.min(newTime, endTime - 1));
        } else {
          setEndTime(Math.max(newTime, startTime + 1));
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleGenerateSubtitle = () => {
    console.log('Generating subtitle...');
    console.log(`Start time: ${startTime}, End time: ${endTime}`);
    console.log('Trimmed video converted to MP3 and sent to backend (simulated)');
    // Here you would actually send the trimmed video data to your backend
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-editor">
      <div className="sidebar">
        <button className="import-btn" onClick={() => document.getElementById('fileInput')?.click()}>
          Import Media
        </button>
        <input
          id="fileInput"
          type="file"
          accept="video/mp4"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {fileName && <p className="file-name">{fileName}</p>}
      </div>
      <div className="main-content">
        <div className="top-bar">
          <h2>Untitled Project</h2>
          <button className="export-btn" onClick={handleGenerateSubtitle}>Generate Subtitle</button>
        </div>
        {videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className="video-player"
            />
            <div className="controls">
              <button onClick={handleRewind}>⏪</button>
              <button onClick={handlePlayPause}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={handleFastForward}>⏩</button>
            </div>
            <div className="timeline-container">
              <div className="timeline" ref={timelineRef} onClick={handleTimelineClick}>
                <div className="progress" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                <div className="trim-area" style={{
                  left: `${(startTime / duration) * 100}%`,
                  right: `${100 - (endTime / duration) * 100}%`
                }}></div>
                <div
                  ref={startHandleRef}
                  className="trim-handle start-handle"
                  style={{ left: `${(startTime / duration) * 100}%` }}
                  onMouseDown={(e) => handleTrimDrag(e, true)}
                ></div>
                <div
                  ref={endHandleRef}
                  className="trim-handle end-handle"
                  style={{ left: `${(endTime / duration) * 100}%` }}
                  onMouseDown={(e) => handleTrimDrag(e, false)}
                ></div>
              </div>
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </>
        ) : (
          <div className="placeholder">
            <p>Import media to start editing</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;