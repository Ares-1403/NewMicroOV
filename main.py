# main.py - Backend de la aplicación MicroOV con FastAPI

# --- Importaciones para manejo de imágenes y archivos ---
from io import BytesIO
from PIL import Image
import base64
import cv2
import numpy as np
import re
import os

# --- Importaciones de FastAPI y utilidades ---
from fastapi import FastAPI, WebSocket, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv

# ===============================================================
# 1. INICIALIZACIÓN Y CONFIGURACIÓN
# ===============================================================

app = FastAPI()

# Cargar el modelo YOLOv8 personalizado [cite: 10, 71]
model = YOLO('best.pt')

# Configuración de API de OpenAI (Luna AI) [cite: 84]
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# Montar el directorio estático para archivos CSS, JS e imágenes 
app.mount("/static", StaticFiles(directory="static"), name="static")

# ===============================================================
# 2. RUTAS DE SERVICIO (ROOT SCOPE PARA PWA)
# ===============================================================

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Sirve el archivo HTML principal de la aplicación."""
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.get("/sw.js")
async def get_sw():
    # Eliminamos "static/" porque el archivo está en la raíz según tu captura
    return FileResponse("sw.js", media_type="application/javascript")

@app.get("/manifest.json")
async def get_manifest():
    # Eliminamos "static/"
    return FileResponse("manifest.json", media_type="application/json")

# ===============================================================
# 3. FUNCIONES DE UTILIDAD
# ===============================================================

def base64_to_cv2(base64_string):
    """Decodifica Base64 a imagen OpenCV."""
    try:
        img_bytes = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_bytes, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"Error decodificando Base64: {e}")
        return None

def cv2_to_base64(image):
    """Codifica imagen OpenCV a Base64."""
    try:
        ret, buffer = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 50])
        if not ret:
            raise ValueError("No se pudo codificar la imagen.")
        return base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        print(f"Error codificando a Base64: {e}")
        return None

class AIChatRequest(BaseModel):
    image: str
    messages: list

# ===============================================================
# 4. ENDPOINTS DE ANÁLISIS Y PROCESAMIENTO
# ===============================================================

@app.post("/upload_image/")
async def upload_image(file: UploadFile = File(...)):
    """Recibe, valida y redimensiona imágenes a 640px para optimizar YOLO."""
    if file.content_type not in ["image/jpeg", "image/png"]:
        return JSONResponse(status_code=400, content={"message": "Solo se aceptan JPG y PNG."})

    try:
        img_bytes = await file.read()
        image = Image.open(BytesIO(img_bytes))

        # Lógica de redimensionamiento a 640px (Formato nativo de YOLOv8) 
        max_size = 640
        if image.width > max_size or image.height > max_size:
            if image.width > image.height:
                new_width, new_height = max_size, int(max_size * image.height / image.width)
            else:
                new_height, new_width = max_size, int(max_size * image.width / image.height)
            image = image.resize((new_width, new_height), Image.LANCZOS)

        output_buffer = BytesIO()
        image.save(output_buffer, format="JPEG")
        base64_string = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
        
        return JSONResponse(content={"image_base64": base64_string})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@app.post("/analyze_image/")
async def analyze_image_endpoint(file: UploadFile = File(...)):
    """Análisis estático con YOLOv8[cite: 83]."""
    try:
        img_bytes = await file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img_np is None:
            return JSONResponse(status_code=400, content={"message": "No se pudo leer la imagen."})

        results = model(img_np, verbose=False)
        annotated_image_np = results[0].plot()
        annotated_image_base64 = cv2_to_base64(annotated_image_np)

        return JSONResponse(content={"annotated_image_base64": annotated_image_base64})
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": str(e)})

@app.post("/analyze_with_ai/")
async def analyze_with_ai(request: AIChatRequest):
    """Análisis contextual con Luna AI (GPT-4o)[cite: 84, 85]."""
    image_base64 = request.image
    messages = request.messages

    if not image_base64 or not messages:
        return JSONResponse(status_code=400, content={"response": "Faltan datos."})

    user_prompt = messages[-1]["content"] if messages else ""
    
    # Extracción de contexto para el System Prompt [cite: 122, 127]
    sample_match = re.search(r'La muestra es (.*?)(?: con| y un pH)', user_prompt, re.IGNORECASE)
    sample_type = sample_match.group(1).strip().lower() if sample_match else "indefinido"

    system_prompt_base = """
    Eres Luna, una IA de microscopía. Actúas como técnico de laboratorio. 
    Describe visualmente la imagen de forma técnica y profesional.
    No emitas diagnósticos ni recomendaciones médicas. [cite: 129]
    """
    
    final_system_prompt = f"{system_prompt_base}\nContexto: {sample_type}."
    
    api_messages = [{"role": "system", "content": final_system_prompt}]
    for msg in messages:
        if msg == messages[-1]:
            api_messages.append({
                "role": "user", 
                "content": [
                    {"type": "text", "text": msg["content"]},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                ]
            })
        else:
            api_messages.append({"role": msg["role"], "content": msg["content"]})

    try:
        response = client.chat.completions.create(model="gpt-4o", messages=api_messages, max_tokens=1000)
        return JSONResponse(content={"response": response.choices[0].message.content})
    except Exception as e:
        return JSONResponse(status_code=500, content={"response": "Error en Luna AI."})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Streaming de video en tiempo real con YOLOv8."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            import json
            message = json.loads(data)
            frame = base64_to_cv2(message['image'])
            if frame is not None:
                results = model(frame, verbose=False)
                encoded = cv2_to_base64(results[0].plot())
                await websocket.send_json({"image": encoded})
    except Exception:
        pass
    finally:
        await websocket.close()