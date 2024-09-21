import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// Main functional component for the video editor application
const App: React.FC = () => {
  // State hooks for managing video source, file name, playback state, and timing
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
  const [isConverting, setIsConverting] = useState(false);

  // Handle file selection for video input
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Check for valid video file type
    if (file && file.type === 'video/mp4') {
      // Set video source URL and file name for display
      setVideoSrc(URL.createObjectURL(file));
      setFileName(file.name);
    }
  };

  // Update current playback time and handle loop logic
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Loop back to start time if the end time is reached
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = startTime;
      }
    }
  };

  // Set metadata for video duration upon loading
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setEndTime(videoRef.current.duration); // Default to full duration
    }
  };

  // Toggle play/pause functionality
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.currentTime = startTime; // Start from selected start time
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Fast forward playback by 10 seconds
  const handleFastForward = () => {
    if (videoRef.current) {
      const newTime = Math.min(videoRef.current.currentTime + 10, endTime);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Rewind playback by 10 seconds
  const handleRewind = () => {
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 10, startTime);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Update playback time based on user clicking on the timeline
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && videoRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickedTime = (x / rect.width) * duration;
      const newTime = Math.max(startTime, Math.min(clickedTime, endTime));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Handle dragging of trim handles for selecting start and end times
  const handleTrimDrag = (e: React.MouseEvent<HTMLDivElement>, isStart: boolean) => {
    const handleMouseMove = (e: MouseEvent) => {
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const newTime = (x / rect.width) * duration;
        if (isStart) {
          setStartTime(Math.min(newTime, endTime - 1)); // Ensure start is before end
          if (videoRef.current && videoRef.current.currentTime < newTime) {
            videoRef.current.currentTime = newTime;
          }
        } else {
          setEndTime(Math.max(newTime, startTime + 1)); // Ensure end is after start
          if (videoRef.current && videoRef.current.currentTime > newTime) {
            videoRef.current.currentTime = newTime;
          }
        }
      }
    };

    // Clean up event listeners on mouse up
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Add event listeners for drag functionality
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Generate audio from the video, converting to WAV format
  const handleGenerateSubtitle = async () => {
    if (!videoRef.current || !videoSrc) return; // Early return if no video

    setIsConverting(true); // Indicate conversion in progress

    const mediaElement = videoRef.current;
    // Capture the audio stream from the video element
    const stream = (mediaElement as any).captureStream();
    const audioTrack = stream.getAudioTracks()[0];
    const audioStream = new MediaStream([audioTrack]);

    const mediaRecorder = new MediaRecorder(audioStream);
    const audioChunks: Blob[] = []; // Store audio chunks for processing

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data); // Collect audio data
    };

    // Handle end of recording to create a downloadable WAV file
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = fileName.replace('.mp4', '.wav'); // Rename file appropriately
      document.body.appendChild(link);
      link.click(); // Trigger download
      document.body.removeChild(link); // Clean up link element
      setIsConverting(false); // Reset conversion state
    };

    mediaRecorder.start(); // Start recording
    mediaElement.currentTime = startTime; // Start playback from trimmed start
    mediaElement.play(); // Play the video to record audio

    // Stop recording when the video reaches the end time
    mediaElement.ontimeupdate = () => {
      if (mediaElement.currentTime >= endTime) {
        mediaElement.pause();
        mediaRecorder.stop(); // Stop recording when reaching end time
        mediaElement.ontimeupdate = null; // Cleanup event listener
      }
    };
  };

  // Update video playback rate when changed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Format time in MM:SS for display
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
          style={{ display: 'none' }} // Hide input
        />
        {fileName && <p className="file-name">{fileName}</p>} {/* Display selected file name */}
      </div>
      <div className="main-content">
        <div className="top-bar">
          <h2>Untitled Project</h2>
          <button
            className="export-btn"
            onClick={handleGenerateSubtitle}
            disabled={!videoSrc || isConverting} // Disable if no video or converting
          >
            {isConverting ? 'Converting...' : 'Generate Audio'} {/* Dynamic button text */}
          </button>
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
                  onMouseDown={(e) => handleTrimDrag(e, true)} // Start trim handle
                ></div>
                <div
                  ref={endHandleRef}
                  className="trim-handle end-handle"
                  style={{ left: `${(endTime / duration) * 100}%` }}
                  onMouseDown={(e) => handleTrimDrag(e, false)} // End trim handle
                ></div>
              </div>
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span> {/* Display current time */}
              <span>{formatTime(duration)}</span> {/* Display total duration */}
            </div>
          </>
        ) : (
          <div className="placeholder">
            <p>Import media to start editing</p> {/* Placeholder prompt */}
          </div>
        )}
      </div>
    </div>
  );
};

export default App; // Export the App component for use in other files