Subgenie 🎥✨
============

Subgenie is an automated subtitle generation and embedding system for videos. It aims to make content more accessible for hearing-impaired and non-native speakers by providing an easy-to-use interface for generating and embedding subtitles in videos.

🔍 Problem Statement
--------------------

-   Videos without subtitles are inaccessible to hearing-impaired and non-native speakers.
-   Manual transcription is time-consuming and resource-intensive.

🎯 Project Goal
---------------

Develop an automated system to:

-   Generate subtitles from any language input
-   Embed subtitles into videos
-   Provide an easy interface for users to upload videos, automatically generate subtitles, and download the final video with embedded subtitles

🚀 Features
-----------

-   📤 Video upload and processing
-   🗣️ Automatic subtitle generation
-   📺 Subtitle embedding
-   🌐 Multi-language support
-   ✂️ Video trimming and splitting
-   🎨 User-friendly design
-   🔄 Language translations
-   ✏️ AI-generated subtitle editing

💻 Technologies Used
--------------------

### Frontend

-   ⚛️ Electron.js: Enables desktop application features
-   ⚛️ React: Used for creating the UI components
-   🎞️ FFMPEG: Used for video-to-audio conversion and embedding subtitles into videos

### Backend

-   🐍 Python (or 🟩 Node.js): Handles MP3-to-SRT conversion and communicates with the frontend
-   ⚡ FastAPI: For handling API endpoints to model
-   🗣️ Speech-to-Text Model: Converts audio into subtitle format (SRT)

🔄 System Overview
------------------

1.  User uploads a video file
2.  Audio is extracted and converted to MP3
3.  MP3 is sent to the backend for speech-to-text conversion into SRT
4.  The SRT file is sent back to the frontend
5.  The SRT is embedded into the video, and the user can download the subtitled video

🏗️ System Architecture
-----------------------

![System Architecture Diagram](https://github.com/user-attachments/assets/e4838bf4-900a-471e-aef0-0044ae898177)

📊 Data Flow Diagram
--------------------

![Data Flow Diagram](https://github.com/user-attachments/assets/2f1e3e6c-8cc4-4ce6-b88e-5b601c5962f2)

🎬 FFMPEG Architecture
----------------------

![FFMPEG Architecture Diagram](https://github.com/user-attachments/assets/548f51ec-927f-4840-8e4b-b4b8b5cbb427)

🗣️ Whisper Architecture
------------------------

![Whisper Architecture Diagram](https://github.com/user-attachments/assets/d9047a02-1a80-4d6f-802d-fe471b9642ef)

⚡ Electron Architecture
-----------------------

![Electron Architecture Diagram](https://github.com/user-attachments/assets/9fae6109-3b9a-4595-a909-4240381e4f46)

🎯 Target Market
----------------

-   📹 Aspiring Vloggers
-   🌟 Social Media Stars
-   🚀 Startup Companies

🚀 Project Workflow
-------------------

-   **Tech stack selection:** Choosing the best tools for making native desktop apps
-   **UI Design Completion:** User Interactive design in FIGMA
-   **Finding the Translational Models:** Research on best language translational models
-   **Defining Features:** Feature planning based on tech stack capabilities
-   **Development Started:** Team split into frontend and backend development
-   **Completion of MVP:** Development of all basic product features

🚧 Challenges Faced
-------------------

-   Burning subtitles to video using ffmpeg
-   Limited access to premium translational models
-   Deployment issues in various cloud providers
