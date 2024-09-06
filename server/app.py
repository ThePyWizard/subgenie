import whisper
import os
from moviepy.editor import AudioFileClip
from datetime import timedelta

# Convert audio to SRT subtitle format
def convert_to_srt(transcription, srt_file):
    with open(srt_file, 'w', encoding='utf-8') as srt:
        for i, segment in enumerate(transcription['segments'], start=1):
            start_time = str(timedelta(seconds=int(segment['start'])))
            end_time = str(timedelta(seconds=int(segment['end'])))
            
            # Format to SRT
            srt.write(f"{i}\n")
            srt.write(f"{start_time} --> {end_time}\n")
            srt.write(f"{segment['text']}\n\n")

# Function to convert audio file to SRT
def audio_to_srt(audio_path, srt_file_path):
    # Load Whisper model (small or larger models for better accuracy)
    model = whisper.load_model("small")
    
    # Convert audio file to mp3 if necessary (for non-mp3 formats)
    if not audio_path.endswith(".mp3"):
        clip = AudioFileClip(audio_path)
        audio_path = os.path.splitext(audio_path)[0] + ".mp3"
        clip.write_audiofile(audio_path)

    # Transcribe audio
    result = model.transcribe(audio_path)
    
    # Convert transcription result to SRT format
    convert_to_srt(result, srt_file_path)
    print(f"SRT file saved as: {srt_file_path}")

# Example Usage
audio_file = 'C:/Users/jishn/OneDrive/Documents/subgen/subgenie/server/audio1.mp3'  # Path to your audio file
srt_file = 'output_subtitles.srt'   # Output SRT file
audio_to_srt(audio_file, srt_file)
