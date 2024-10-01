import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import './App.css';
import axios from 'axios';

const ffmpeg = new FFmpeg();

interface Subtitle {
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;  // Subtitle text
}

const dummySubtitles: Subtitle[] = [
  { start: 0, end: 3.5, text: 'Hello, welcome to the video!' },
  { start: 4, end: 7.5, text: 'This is a sample subtitle.' },
  { start: 8, end: 11.5, text: 'Enjoy watching!' },
  { start: 12, end: 15, text: 'Thank you for viewing.' },
];

const App: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Array<{ start: number; end: number }>>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [subtitleText, setSubtitleText] = useState('')
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([
    { start: 0, end: 3.5, text: 'Hello, welcome to the video!' },
    { start: 4, end: 7.5, text: 'This is a sample subtitle.' },
    { start: 8, end: 11.5, text: 'Enjoy watching!' },
    { start: 12, end: 14.5, text: 'Thank you for viewing.' },
    { start: 15, end: 18.5, text: 'Yoolooo.' },
    { start: 19, end: 25.5, text: 'OMGGGG.' },
    { start: 26, end: 36, text: 'Broooo.' },
  ]);

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        await ffmpeg.load();
        ffmpeg.on('log', ({ message }) => {
          console.log(message);
        });
        ffmpeg.on('progress', ({ progress }) => {
          console.log(`Progress: ${Math.round(progress * 100)}%`);
          setProgress(Math.round(progress * 100));
        });
        setFfmpegLoaded(true);
      } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        setError('Failed to load FFmpeg. Please try reloading the page.');
      }
    };
    loadFFmpeg();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'video/mp4') {
      setVideoSrc(URL.createObjectURL(file));
      setFileName(file.name);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      setCurrentTime(current);
  
      // Find the current subtitle
      const currentSubtitle = subtitles.find(
        (subtitle) => current >= subtitle.start && current <= subtitle.end
      );
  
      if (currentSubtitle) {
        setSubtitleText(currentSubtitle.text);
      } else {
        setSubtitleText(''); // Clear subtitle if no match
      }
    }
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setSubtitleText(newText);
  
    // Find and update the current subtitle in the subtitles array
    setSubtitles((prevSubtitles) =>
      prevSubtitles.map((subtitle) =>
        currentTime >= subtitle.start && currentTime <= subtitle.end
          ? { ...subtitle, text: newText }
          : subtitle
      )
    );
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setSelectionEnd(videoRef.current.duration);
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
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
    }
  };

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'start' | 'end') => {
    setIsDragging(type);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min((x / rect.width) * duration, duration));

      if (isDragging === 'start') {
        setSelectionStart(Math.min(newTime, selectionEnd));
      } else if (isDragging === 'end') {
        setSelectionEnd(Math.max(newTime, selectionStart));
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  const handleSplitSelection = () => {
    setSelectedSections([...selectedSections, { start: selectionStart, end: selectionEnd }]);
  };


  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };


  const handleMergeSections = async () => {
    if (!videoSrc || selectedSections.length === 0 || !ffmpegLoaded) return;

    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoSrc));

      // Sort selected sections by start time
      const sortedSections = [...selectedSections].sort((a, b) => a.start - b.start);

      // Create a file with a list of video parts to concatenate
      let concatFileContent = '';
      for (let i = 0; i < sortedSections.length; i++) {
        const { start, end } = sortedSections[i];
        const trimmedName = `trimmed${i}.mp4`;

        // Trim the video
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-ss', `${start}`,
          '-to', `${end}`,
          '-c', 'copy',
          trimmedName
        ]);

        concatFileContent += `file ${trimmedName}\n`;
      }

      await ffmpeg.writeFile('concat_list.txt', concatFileContent);

      // Concatenate all trimmed parts
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        'output.mp4'
      ]);

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged_video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error merging video sections:', error);
      setError('Failed to merge video sections. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const mergeSelectedSections = async () => {
    if (selectedSections.length === 0) return null;

    // Sort selected sections by start time
    const sortedSections = [...selectedSections].sort((a, b) => a.start - b.start);

    // Create a file with a list of video parts to concatenate
    let concatFileContent = '';
    for (let i = 0; i < sortedSections.length; i++) {
      const { start, end } = sortedSections[i];
      const trimmedName = `trimmed${i}.mp4`;

      // Trim the video
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-ss', `${start}`,
        '-to', `${end}`,
        '-c', 'copy',
        trimmedName
      ]);

      concatFileContent += `file ${trimmedName}\n`;
    }

    await ffmpeg.writeFile('concat_list.txt', concatFileContent);

    // Concatenate all trimmed parts
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat_list.txt',
      '-c', 'copy',
      'merged.mp4'
    ]);

    return 'merged.mp4';
  };

  const handleMp4ToMp3Conversion = async (): Promise<Blob | null> => {
    if (!videoSrc || !ffmpegLoaded) return null;
  
    setIsConverting(true);
    setError(null);
    setProgress(0);
  
    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoSrc));
  
      let inputFile = 'input.mp4';
      let outputFileName = 'converted_audio.mp3';
  
      if (selectedSections.length > 0) {
        const mergedFile = await mergeSelectedSections();
        if (!mergedFile) {
          throw new Error('Failed to merge selected sections');
        }
        inputFile = mergedFile;
        outputFileName = 'trimmed_converted_audio.mp3';
      }
  
      await ffmpeg.exec(['-i', inputFile, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputFileName]);
  
      const data = await ffmpeg.readFile(outputFileName);
      return new Blob([data], { type: 'audio/mp3' });
    } catch (error) {
      console.error('Error converting MP4 to MP3:', error);
      setError('Failed to convert MP4 to MP3. Please try again.');
      return null;
    } finally {
      setIsConverting(false);
    }
  };
  const parseSRT = (srtContent: string): Subtitle[] => {
    const subtitles: Subtitle[] = [];
    const subtitleBlocks = srtContent.trim().split('\n\n');
  
    subtitleBlocks.forEach(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const [, timecodes, ...textLines] = lines;
        const [start, end] = timecodes.split(' --> ').map(timeToSeconds);
        subtitles.push({
          start,
          end,
          text: textLines.join('\n')
        });
      }
    });
  
    return subtitles;
  };
  
  const timeToSeconds = (timeString: string): number => {
    const [hours, minutes, secondsAndMs] = timeString.split(':');
    const [seconds, ms] = secondsAndMs.split(',');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
  };

  const handleGenerateSubtitles = async () => {
    if (!videoSrc || !ffmpegLoaded) return;
  
    setIsGeneratingSubtitles(true);
    setError(null);
    setProgress(0);
  
    try {
      // Convert video to MP3 using the existing function
      const mp3Blob = await handleMp4ToMp3Conversion();
      
      if (!mp3Blob) {
        throw new Error('Failed to convert video to MP3');
      }
  
      // Create FormData and append the MP3 file
      const formData = new FormData();
      formData.append('file', mp3Blob, `audio_${Date.now()}.mp3`);
  
      // Send MP3 to backend for transcription
      const response = await axios.post('http://127.0.0.1:8000/transcribe', formData, {
        headers: { 
          'accept': 'application/json',
          'Content-Type': 'multipart/form-data'
        },
      });
  
      // Parse the SRT response and update subtitles
      const parsedSubtitles = parseSRT(response.data.srt_subtitles);
      setSubtitles(parsedSubtitles);
  
    } catch (error) {
      console.error('Error generating subtitles:', error);
      setError('Failed to generate subtitles. Please try again.');
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  const startRecording = () => {
    if (!videoContainerRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (!video || !ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const stream = canvas.captureStream(30); // 30 FPS

    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);

    const drawVideo = () => {
      if (isRecording) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Draw subtitles
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(subtitleText, canvas.width / 2, canvas.height - 50);

        requestAnimationFrame(drawVideo);
      }
    };

    drawVideo();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadRecordedVideo = () => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = 'recorded-video-with-subtitles.webm';
    a.click();
    window.URL.revokeObjectURL(url);
    setRecordedChunks([]);
  };

 const handleDownload = async () => {
  const videoUrl = 'https://cdn.pixabay.com/video/2023/11/26/190776-888535446_large.mp4';

  // Fetch the video content and convert it to a Blob
  const response = await fetch(videoUrl);
  const blob = await response.blob();
  
  // Create an anchor element to trigger the download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'output-video.mp4'; // The default file name when downloaded
  
  // Append the link to the document, trigger the click, and then remove the link
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the object URL after download
  URL.revokeObjectURL(link.href);
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

        <button
          className="download-btn"
          onClick={handleDownload}
          style={{ marginLeft: 'auto' }}
        >Download</button>

        {fileName && <p className="file-name">{fileName}</p>}
      </div>
      <div className="main-content">
        <div className="top-bar">
          <h2>Video Editor</h2>
          {error && <div className="error-message">{error}</div>}
          {isConverting && <div className="progress-bar" style={{ width: `${progress}%` }}></div>}
          <button
            onClick={handleMergeSections}
            disabled={!ffmpegLoaded || isConverting || selectedSections.length === 0}
          >
            {isConverting ? 'Merging...' : 'Merge Selected Sections'}
          </button>
          <button
            onClick={handleMp4ToMp3Conversion}
            disabled={!ffmpegLoaded || isConverting}
          >
            {isConverting ? 'Converting...' : 'Convert to MP3'}
          </button>
          <button
          onClick={handleGenerateSubtitles}
          disabled={!ffmpegLoaded || isConverting || isGeneratingSubtitles || !videoSrc}
        >
          {isGeneratingSubtitles ? 'Generating Subtitles...' : 'Generate Subtitles'}
        </button>
        </div>
        {videoSrc ? (
          <>
            <div className="video-container">
              <video
                ref={videoRef}
                src={videoSrc}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="video-player"
              />
              <textarea
                className="subtitle-textbox"
                value={subtitleText}
                onChange={handleSubtitleChange}
              />
            </div>
            
            <div className="controls">
              <button onClick={handleRewind}>⏪</button>
              <button onClick={handlePlayPause}>{isPlaying ? '⏸' : '▶'}</button>
              <button onClick={handleFastForward}>⏩</button>
            </div>
            <div
              className="timeline-container"
              ref={timelineRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="timeline" onClick={handleTimelineClick}>
                <div className="progress" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                {selectedSections.map((section, index) => (
                  <div
                    key={index}
                    className="selected-section"
                    style={{
                      left: `${(section.start / duration) * 100}%`,
                      width: `${((section.end - section.start) / duration) * 100}%`,
                    }}
                  ></div>
                ))}
                <div
                  className="selection-bar start"
                  style={{ left: `${(selectionStart / duration) * 100}%` }}
                  onMouseDown={(e) => handleMouseDown(e, 'start')}
                ></div>
                <div
                  className="selection-bar end"
                  style={{ left: `${(selectionEnd / duration) * 100}%` }}
                  onMouseDown={(e) => handleMouseDown(e, 'end')}
                ></div>
                <div
                  className="selection-range"
                  style={{
                    left: `${(selectionStart / duration) * 100}%`,
                    width: `${((selectionEnd - selectionStart) / duration) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="split-controls">
              <button onClick={handleSplitSelection}>Split Video</button>
              <span>{formatTime(selectionStart)} - {formatTime(selectionEnd)}</span>
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