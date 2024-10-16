import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import './App.css';
import axios from 'axios';
import { CirclePlay, CirclePause, Loader } from 'lucide-react';

const ffmpeg = new FFmpeg();

interface Subtitle {
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;  // Subtitle text
}

const App: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Array<{ start: number; end: number }>>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'head' | null>(null);
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
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const videoOverlayRef = useRef<HTMLDivElement>(null);

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

    // Cleanup function to revoke the object URL when videoSrc changes or component unmounts
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const formatTimeHHMMSS = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClearSelection = () => {
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
    }
    setSelectedSections([]);
    setSelectionStart(0);
    setSelectionEnd(duration);
    setSubtitleText('');
    setVideoSrc(undefined);
    setFileName('');
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsConverting(false);
    setIsGeneratingSubtitles(false);
    setIsExporting(false);
    setExportProgress(0);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'video/mp4') {
      setVideoSrc(URL.createObjectURL(file));
      const fileNameWithoutExtension = file.name.split('.').slice(0, -1).join('.');
      setFileName(fileNameWithoutExtension);
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

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLTextAreaElement>, index?: number) => {
    const newText = e.target.value;
    setSubtitleText(newText);

    // Find and update the current subtitle in the subtitles array
    setSubtitles((prevSubtitles) =>
      prevSubtitles.map((subtitle, i) =>
        index !== undefined
          ? i === index
            ? { ...subtitle, text: newText }
            : subtitle
          : currentTime >= subtitle.start && currentTime <= subtitle.end
            ? { ...subtitle, text: newText }
            : subtitle
      )
    );
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end', index: number) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      setSubtitles((prevSubtitles) =>
        prevSubtitles.map((subtitle, i) =>
          i === index
            ? { ...subtitle, [type]: newValue }
            : subtitle
        )
      );
    }
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
      videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 5, duration);
    }
  };

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 5, 0);
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, type: 'start' | 'end' | 'head') => {
    setIsDragging(type);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && timelineRef.current && videoRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min((x / rect.width) * duration, duration));

      if (isDragging === 'start') {
        setSelectionStart(Math.min(newTime, selectionEnd));
      } else if (isDragging === 'end') {
        setSelectionEnd(Math.max(newTime, selectionStart));
      } else if (isDragging === 'head') {
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
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

      // Update the videoSrc with the new merged video
      setVideoSrc(url);

      // Reset selection and update duration
      setSelectedSections([]);
      setSelectionStart(0);
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            setSelectionEnd(videoRef.current.duration);
          }
        };
      }

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

  const handleDownload = async () => {
    if (!videoSrc || !ffmpegLoaded || subtitles.length === 0) return;

    setIsExporting(true);
    setError(null);
    setExportProgress(0);

    try {
      // Write video file to FFmpeg's virtual file system
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoSrc));

      // Generate ASS subtitle file content (Advanced SubStation Alpha)
      const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${subtitles.map(sub => {
        const start = formatAssTime(sub.start);
        const end = formatAssTime(sub.end);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,${sub.text.replace(/\n/g, '\\N')}`;
      }).join('\n')}`;

      // Write ASS file to FFmpeg's virtual file system
      await ffmpeg.writeFile('subtitles.ass', assContent);

      // Run FFmpeg command to burn subtitles into video
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', `ass=subtitles.ass:fontsdir=/fonts,scale=1280:720`,
        '-c:a', 'copy',
        '-preset', 'fast',
        'output.mp4'
      ]);

      // Read the output file
      const data = await ffmpeg.readFile('output.mp4');

      // Create a download link
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video_with_subtitles.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error exporting video with subtitles:', error);
      setError('Failed to export video with subtitles. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const formatAssTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}.${ms}`;
  };

  const formatSrtTime = (seconds: number) => {
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
  };

  return (
    <div className="video-editor">
      <div className="sidebar">
        <h2 className="file-name">{fileName || 'No file selected'}</h2>
        <div className="info-chips">
          <span className="chip">English</span>
          <span className="chip">{formatTime(duration)}</span>
        </div>
        <div className="button-group">
          <div className="dropdown">
            <select className="button" style={{ borderRadius: 'var(--radius)', width: '150px', height: '40px', display: 'inline-block' }}>
              <option value="English">Select Language</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </div>
          <button
            className="button"
            onClick={handleGenerateSubtitles}
            disabled={isGeneratingSubtitles}
            style={{ width: '150px', height: '40px', display: 'inline-block', textAlign: 'center', padding: '0' }}
          >
            {isGeneratingSubtitles ? <Loader className="animate-spin" /> : 'Generate Subtitles'}
          </button>
        </div>

        <div className="subtitle-card">
          {subtitles.map((subtitle, index) => (
            <div key={index} className="subtitle-item">
              <textarea className="subtitle-time" value={`${formatTime(subtitle.start)} - ${formatTime(subtitle.end)}`} style={{ resize: 'none' }}></textarea>
              <div className="subtitle-text">{subtitle.text}</div>
            </div>
          ))}
        </div>

      </div>
      <div className="main-content">
        <div className="export-controls">
          <button className="button" onClick={() => document.getElementById('fileInput')?.click()}>
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
            className="button"
            onClick={handleDownload}
            disabled={isExporting}
          >
            {isExporting ? <Loader className="animate-spin" /> : 'Export with Burned Subtitles'}
          </button>
        </div>
        <div className="video-preview" style={{ position: 'relative' }}>

          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            className="video-player"
          />

          {/* Subtitle Textarea */}
          <textarea
            style={{
              position: 'absolute',
              top: '75%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: 'white',
              border: 'none',
              outline: 'none',
              resize: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              zIndex: '1' // Ensure it's on top of the video
            }}
            value={subtitleText}
            onChange={handleSubtitleChange}
          />

          {/* Subtitle Overlay (Optional, for reference or styling) */}
          <div className="video-overlay" ref={videoOverlayRef}></div>

          <div className="timeline-container">
            <div className="timeline-wrapper">
              <span className="time-label start" style={{ transform: 'translate(-5px, 8px)' }}>{formatTime(currentTime)}</span>
              <div
                className="timeline"
                ref={timelineRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleTimelineClick}
                style={{ height: '22px' }} // Increased height of the timeline
              >
                <div className="progress" style={{ width: `${(currentTime / duration) * 100}%`, height: '100%' }}></div>
                <div className="playhead" style={{ left: `${(currentTime / duration) * 100}%`, width: '28px', height: '28px', backgroundColor: 'white', borderRadius: '4px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#0056b3', borderRadius: '4px' }}></div>
                </div> {/* Changed playhead to white square with a blue square at its center */}
                {selectedSections.map((section, index) => (
                  <div
                    key={index}
                    className="selected-section"
                    style={{
                      left: `${((section.start - currentTime) / duration) * 100}%`,
                      width: `${(((section.end - currentTime) - (section.start - currentTime)) / duration) * 100}%`,
                      height: '100%', // Adjusted height to match the increased timeline height
                    }}
                  ></div>
                ))}
                <div
                  className="selection-bar start"
                  style={{ left: `${((selectionStart - currentTime) / duration) * 100}%`, height: '32px', top: '50%', transform: 'translateY(-50%)' }} // Adjusted position to center vertically
                  onMouseDown={(e) => handleMouseDown(e, 'start')}
                ></div>
                <div
                  className="selection-bar end"
                  style={{ left: `${((selectionEnd - currentTime) / duration) * 100}%`, height: '32px', top: '50%', transform: 'translateY(-50%)' }} // Adjusted position to center vertically
                  onMouseDown={(e) => handleMouseDown(e, 'end')}
                ></div>
                <div
                  className="selection-range"
                  style={{
                    left: `${((selectionStart - currentTime) / duration) * 100}%`,
                    width: `${(((selectionEnd - currentTime) - (selectionStart - currentTime)) / duration) * 100}%`,
                    height: '100%', // Adjusted height to match the increased timeline height
                  }}
                ></div>
              </div>
              <span className="time-label end" style={{ transform: 'translate(5px, 8px)' }}>{formatTime(duration - currentTime)}</span>
            </div>
            <div className="current-time">{formatTime(currentTime)}</div>
          </div>
        </div>

        <div className="controls">
          <button className='button' style={{ width: '150px', height: '40px' }} onClick={handleRewind}>-5s</button>
          <button className='button' style={{ width: '150px', height: '40px' }} onClick={handlePlayPause}>{isPlaying ? <CirclePause /> : <CirclePlay />}</button>
          <button className='button' style={{ width: '150px', height: '40px' }} onClick={handleFastForward}>+5s</button>
          {/* <select className="button" style={{ borderRadius: 'var(--radius)', height: '40px', display: 'inline-block' }}>
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select> */}
        </div>
        <div className="button-group" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
          <button className="button" onClick={handleSplitSelection}>Split</button>
          <button
            className="button"
            onClick={handleMergeSections}
            disabled={isMerging}
          >
            {isMerging ? <Loader className="animate-spin" /> : 'Merge'}
          </button>
          <button className="button" onClick={handleClearSelection}>Clear</button>
        </div>
        {/* New section to display selected split sections */}
        <div className="selected-sections" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {selectedSections.map((section, index) => (
            <div key={index} className="selected-section-item" style={{ marginBottom: '0.5rem' }}>
              {formatTimeHHMMSS(section.start)} - {formatTimeHHMMSS(section.end)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
