from fastapi import FastAPI, File, UploadFile, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import tempfile
import os
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

print("openai api key", OPENAI_API_KEY)
# Initialize FastAPI app
app = FastAPI()

# Create a router for the transcription endpoints
transcription_router = APIRouter(
    prefix='/transcription',
    tags=['transcription']
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# OpenAI API configuration
 # Replace with your actual API key
WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions"

# Request model for translation
class TranslationRequest(BaseModel):
    output_language: str

# Utility function to generate SRT format
def generate_srt(segments):
    srt_content = ""
    for i, segment in enumerate(segments, start=1):
        start = format_timestamp(segment['start'])
        end = format_timestamp(segment['end'])
        text = segment['text'].strip()
        srt_content += f"{i}\n{start} --> {end}\n{text}\n\n"
    return srt_content.strip()

# Utility function to format timestamp for SRT
def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = seconds % 60
    milliseconds = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{int(seconds):02d},{milliseconds:03d}"

# Function to call Whisper API
def transcribe_with_whisper_api(file_path, language=None):
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    with open(file_path, "rb") as audio_file:
        files = {"file": audio_file}
        data = {"model": "whisper-1"}
        
        if language:
            data["language"] = language
        
        response = requests.post(WHISPER_API_URL, headers=headers, files=files, data=data)
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)
    
    return response.json()

# Endpoint to transcribe audio to text and SRT (version 1)
@transcription_router.post(path="/v1/transcribe", name="Transcribe Audio to Text and SRT")
async def transcribe_audio_v1(file: UploadFile = File(...)):
    """
    Transcribe audio file to text and generate SRT subtitles.
    Args:
        file: Audio file to transcribe
    Returns:
        Transcription, detected language, and SRT subtitles
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        contents = await file.read()
        temp_file.write(contents)
        temp_file_path = temp_file.name

    try:
        result = transcribe_with_whisper_api(temp_file_path)
        # Note: The Whisper API doesn't return segments, so we can't generate SRT here
        return {
            "transcription": result["text"],
            "detected_language": result.get("language", "Not provided by API"),
            "srt_subtitles": "Not available with Whisper API"
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        os.unlink(temp_file_path)

# Endpoint to transcribe and translate audio (version 2)
@transcription_router.post(path="/v2/transcribe/{output_language}", name="Transcribe and Translate Audio")
async def transcribe_audio_v2(
    output_language: str,
    file: UploadFile = File(...)
):
    """
    Transcribe and translate audio file to output language.
    Args:
        file: Audio file to transcribe
        output_language: Target language for transcription
    Returns:
        Transcription in the target language
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        contents = await file.read()
        temp_file.write(contents)
        temp_file_path = temp_file.name

    try:
        result = transcribe_with_whisper_api(temp_file_path, language=output_language)
        return {
            "transcription": result["text"],
            "detected_language": result.get("language", "Not provided by API"),
            "output_language": output_language,
            "srt_subtitles": "Not available with Whisper API"
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        os.unlink(temp_file_path)

def translate_with_gpt(transcription, target_language):
    openai.api_key = OPENAI_API_KEY
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
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

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt_message}],
        temperature=0.7
    )

    response = client.chat.completions.create(
    messages=[{"role": "user", "content": prompt_message}],
    model="gpt-4o-mini",
)

    if response and response.choices:
        translated_text = response.choices[0].message["content"].strip()
        return translated_text
    else:
        raise HTTPException(status_code=500, detail="GPT Translation failed")


# New route to transcribe audio and translate using GPT
@transcription_router.post(path="/v3/transcribe_and_translate_gpt/{output_language}", name="Transcribe and Translate Audio with GPT")
async def transcribe_audio_with_gpt_translation(
    output_language: str,
    file: UploadFile = File(...)
):
    """
    Transcribe audio file and translate it using GPT model to the target language.
    Args:
        file: Audio file to transcribe
        output_language: Target language for translation
    Returns:
        Transcription in English and translation in the target language
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        contents = await file.read()
        temp_file.write(contents)
        temp_file_path = temp_file.name

    try:
        # Transcribe the audio using Whisper API
        result = transcribe_with_whisper_api(temp_file_path)
        transcription = result["text"]
        
        # Translate transcription using GPT
        translated_text = translate_with_gpt(transcription, output_language)

        return {
            "transcription": transcription,
            "detected_language": result.get("language", "Not provided by API"),
            "output_language": output_language,
            "translated_text": translated_text,
            "srt_subtitles": "Not available with Whisper API"
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    finally:
        os.unlink(temp_file_path)


# Include the router in the app
app.include_router(transcription_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)