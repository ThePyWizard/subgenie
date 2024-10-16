from fastapi import FastAPI, File, UploadFile, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import os
import whisper
import requests
from starlette import status
from dotenv import load_dotenv
import os
from os import getcwd
from openai import OpenAI

env_path = f"{getcwd()}/.env"
load_dotenv(env_path)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

client = OpenAI(
    # This is the default and can be omitted
    api_key = os.getenv('OPENAI_API_KEY'),
)


app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Load Whisper model
model = whisper.load_model("base")

def generate_srt(segments):
    srt_content = ""
    for i, segment in enumerate(segments, start=1):
        start = format_timestamp(segment['start'])
        end = format_timestamp(segment['end'])
        text = segment['text'].strip()
        srt_content += f"{i}\n{start} --> {end}\n{text}\n\n"
    return srt_content.strip()

def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = seconds % 60
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{int(seconds):02d},{milliseconds:03d}"


def translate_with_gpt(transcription, target_language):
    headers = {
        "Authorization": f"Bearer {client.api_key}",
        "Content-Type": "application/json"
    }

    # Chat-based prompt with the transcription
    prompt_message = f"Translate the following text to {target_language}:\n\n{transcription}"

    data = {
        "model": "gpt-4o-mini",  # Use the gpt-4o-mini model or any available one
        "messages": [
            {"role": "user", "content": prompt_message}
        ],
        "temperature": 0.7
    }

    response = client.chat.completions.create(
    messages=[{"role": "user", "content": prompt_message}],
    model="gpt-4o-mini",
)

    if response and response.choices:
        translated_text = response.choices[0]
        return translated_text
    else:
        raise HTTPException(status_code=500, detail="GPT Translation failed")



@app.post("/transcribe/{output_language}")
async def transcribe_audio(output_language: str, file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        contents = await file.read()
        temp_file.write(contents)
        temp_file_path = temp_file.name

    try:
        result = model.transcribe(temp_file_path, task="translate")
        srt_content = generate_srt(result["segments"])
        translated_text = translate_with_gpt(srt_content, output_language)

        return {
            "transcription": result["text"],
            "detected_language": result["language"],
            "translated_text": translated_text,
            "srt_subtitles": srt_content
        }
    finally:
        os.unlink(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)