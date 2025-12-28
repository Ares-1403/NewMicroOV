// static/main.js - Versión final con todas las mejoras y correcciones

// 1. Registro único y limpio al inicio
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js') // Apunta a la raíz
            .then(reg => console.log('SW activo en scope:', reg.scope))
            .catch(err => console.log('Error de SW:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // 1. REFERENCIAS A ELEMENTOS DEL DOM
    // =================================================================
    const startCameraBtn = document.getElementById('startCameraBtn');
    const boxBtn = document.getElementById('boxBtn');
    const scanBtn = document.getElementById('scanBtn');
    const fileExploreBtn = document.getElementById('fileExploreBtn');
    const fileInput = document.getElementById('file-input');

    const welcomeMessage = document.getElementById('welcomeMessage');
    const videoFeed = document.getElementById('videoFeed');
    const uploadedImage = document.getElementById('uploadedImage');
    const detectionOverlay = document.getElementById('detectionOverlay');
    const ctx = detectionOverlay.getContext('2d');

    const aiChatToggleBtn = document.getElementById('aiChatToggleBtn');
    const closeAIPanelBtn = document.getElementById('closeAIPanelBtn');
    const aiChatContainer = document.getElementById('aiChatContainer');
    const aiChatWindow = document.getElementById('aiChatWindow');
    const promptButtonsContainer = document.getElementById('promptButtonsContainer');

    // =================================================================
    // 2. VARIABLES DE ESTADO Y PROMPTS
    // =================================================================
    let originalFile = null;
    let cameraState = 'off';
    let currentMode = 'welcome';
    let isDrawing = false;
    let startX, startY;
    
    let originalImageSrc = null;
    let isYoloActive = false;    

    let analysisContext = {
        sampleType: null,
        ph: null,
        stainType: null,
        chatHistory: []
    };

    const prompts = {
        'Sedimento Urinario': {
            'Ácida': {
                prompt1: `La muestra es orina (sedimento urinario) con pH Ácida. A partir de esta imagen del campo microscópico, describe en una sola frase breve qué estructuras celulares o elementos principales se observan (ej. eritrocitos, leucocitos, células, cristales, cilindros, bacterias).`,
                prompt2: `La muestra es orina (sedimento urinario) con pH Ácida. Entrega un conteo de apoyo visual en el siguiente formato:\n- Lista de estructuras observadas (con subtipos si es posible: eritrocitos, leucocitos, células epiteliales, cilindros, cristales, bacterias, levaduras, musina).\n- Conteo aproximado por campo: número absoluto o estimado.\n- Clasificación semicuantitativa: escasos (+), moderados (++), abundantes (+++).\nSi una estructura no está presente, indica "no observada".`,
                prompt3: `La muestra es orina (sedimento urinario) con pH Ácida. A partir del área recortada, describe qué objeto específico se observa, nombrando la estructura, su subtipo si aplica, y sus características morfológicas visibles.`
            },
            'Alcalina': {
                prompt1: `La muestra es orina (sedimento urinario) con pH Alcalina. A partir de esta imagen del campo microscópico, describe en una sola frase breve qué estructuras celulares o elementos principales se observan (ej. eritrocitos, leucocitos, células, cristales, cilindros, bacterias).`,
                prompt2: `La muestra es orina (sedimento urinario) con pH Alcalina. Entrega un conteo de apoyo visual en el siguiente formato:\n- Lista de estructuras observadas (con subtipos si es posible: eritrocitos, leucocitos, células epiteliales, cilindros, cristales, bacterias, levaduras, musina).\n- Conteo aproximado por campo: número absoluto o estimado.\n- Clasificación semicuantitativa: escasos (+), moderados (++), abundantes (+++).\nSi una estructura no está presente, indica "no observada".`,
                prompt3: `La muestra es orina (sedimento urinario) con pH Alcalina. A partir del área recortada, describe qué objeto específico se observa, nombrando la estructura, su subtipo si aplica, y sus características morfológicas visibles.`
            }
        },
        'Extendido Sanguíneo': {
            'Wright-Giemsa': {
                prompt1: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright-Giemsa. A partir de esta imagen de microscopio, describe en una sola frase breve qué estructuras celulares se observan en el campo (ej. eritrocitos, neutrófilos, linfocitos, eosinófilos, basófilos, monocitos, plaquetas). Mantén la descripción concisa, como una leyenda de referencia. No emitas interpretación clínica ni diagnóstica.`,
                prompt2: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright-Giemsa. Analiza el campo microscópico de la imagen y entrega el resultado de apoyo visual en el siguiente formato:\n- Lista de las células o estructuras observadas.\n- Conteo aproximado de cada estructura.\n- Clasificación semicuantitativa: escasos, moderados o abundantes.\n- Señalar si se aprecian formas atípicas o anómalas de manera descriptiva, sin interpretación clínica.`,
                prompt3: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright-Giemsa. A partir del recorte señalado, describe de forma breve y clara qué célula o estructura específica se observa. Limítate a nombrar la estructura y describir rasgos inusuales de manera neutral, sin interpretación clínica.`,
                diferencial: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido. A partir de esta imagen de microscopio, realiza un recuento diferencial de leucocitos en el campo observado con el siguiente formato:\n- Lista de los tipos celulares identificados (neutrófilos, linfocitos, monocitos, eosinófilos, basófilos).\n- Conteo aproximado de cada tipo.\n- Estimación porcentual relativa.\n- Señalar si se observan formas atípicas o anómalas de manera descriptiva, sin emitir diagnóstico.`
            },
            'Giemsa': {
                prompt1: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Giemsa. A partir de esta imagen de microscopio, describe en una sola frase breve qué estructuras celulares se observan en el campo. Mantén la descripción concisa, como una leyenda de referencia. No emitas interpretación clínica ni diagnóstica.`,
                prompt2: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Giemsa. Analiza el campo microscópico y entrega el resultado de apoyo visual en el siguiente formato:\n- Lista de las células o estructuras observadas.\n- Conteo aproximado de cada estructura.\n- Clasificación semicuantitativa.\n- Señalar si se aprecian formas atípicas o anómalas de manera descriptiva, sin interpretación clínica.`,
                prompt3: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Giemsa. A partir del recorte señalado, describe de forma breve y clara qué célula o estructura específica se observa. Limítate a nombrar la estructura y describir rasgos inusuales de manera neutral, sin interpretación clínica.`,
                diferencial: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido. A partir de esta imagen de microscopio, realiza un recuento diferencial de leucocitos en el campo observado con el siguiente formato:\n- Lista de los tipos celulares identificados.\n- Conteo aproximado de cada tipo.\n- Estimación porcentual relativa.\n- Señalar si se observan formas atípicas o anómalas de manera descriptiva, sin emitir diagnóstico.`
            },
            'Wright': {
                prompt1: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright. A partir de esta imagen de microscopio, describe en una sola frase breve qué estructuras celulares se observan en el campo. Mantén la descripción concisa, como una leyenda de referencia. No emitas interpretación clínica ni diagnóst-ica.`,
                prompt2: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright. Analiza el campo microscópico y entrega el resultado de apoyo visual en el siguiente formato:\n- Lista de las células o estructuras observadas.\n- Conteo aproximado de cada estructura.\n- Clasificación semicuantitativa.\n- Señalar si se aprecian formas atípicas o anómalas de manera descriptiva, sin interpretación clínica.`,
                prompt3: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido con Wright. A partir del recorte señalado, describe de forma breve y clara qué célula o estructura específica se observa. Limítate a nombrar la estructura y describir rasgos inusuales de manera neutral, sin interpretación clínica.`,
                diferencial: `La muestra ya fue identificada como sangre: frotis sanguíneo teñido. A partir de esta imagen de microscopio, realiza un recuento diferencial de leucocitos en el campo observado con el siguiente formato:\n- Lista de los tipos celulares identificados.\n- Conteo aproximado de cada tipo.\n- Estimación porcentual relativa.\n- Señalar si se observan formas atípicas o anómalas de manera descriptiva, sin emitir diagnóstico.`
            }
        }
    };

    // =================================================================
    // 3. LÓGICA DE CÁMARA Y SUBIDA DE ARCHIVOS
    // =================================================================
    startCameraBtn.addEventListener('click', handleCameraClick);
    async function handleCameraClick() {
        disableManualDrawing();
        if (cameraState === 'off') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } });
                videoFeed.srcObject = stream;
                videoFeed.style.display = 'block';
                welcomeMessage.style.display = 'none';
                uploadedImage.style.display = 'none';
                cameraState = 'live';
                currentMode = 'realtime_video';
            } catch (err) {
                showModal("No se pudo acceder a la cámara trasera.");
            }
        } else if (cameraState === 'live') {
            const canvas = document.createElement('canvas');
            canvas.width = videoFeed.videoWidth;
            canvas.height = videoFeed.videoHeight;
            canvas.getContext('2d').drawImage(videoFeed, 0, 0);
            uploadedImage.src = canvas.toDataURL('image/jpeg');
            uploadedImage.style.display = 'block';
            stopCameraStream();
            cameraState = 'captured';
            currentMode = 'static_image';
            originalFile = null;
            videoFeed.style.display = 'none';
            startCameraBtn.querySelector('img').src = '/static/camera-off.svg';
            originalImageSrc = uploadedImage.src;
            isYoloActive = false;
        } else if (cameraState === 'captured') {
            uploadedImage.style.display = 'none';
            welcomeMessage.style.display = 'block';
            cameraState = 'off';
            currentMode = 'welcome';
            startCameraBtn.querySelector('img').src = '/static/camera-on.svg';
            disableManualDrawing();
        }
    }

    function stopCameraStream() {
        if (videoFeed.srcObject) {
            videoFeed.srcObject.getTracks().forEach(track => track.stop());
            videoFeed.srcObject = null;
        }
    }

    fileExploreBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) startStaticImageMode(file);
        fileInput.value = '';
    });

    async function startStaticImageMode(file) {
        disableManualDrawing();
        originalFile = file;
        const formData = new FormData();
        formData.append("file", file);
        const loadingModal = showModal('Subiendo y procesando imagen...', true);
        try {
            const response = await fetch('/upload_image/', { method: 'POST', body: formData });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Error del servidor: ${response.status}`);
            }
            const result = await response.json();
            if (result.image_base64) {
                stopCameraStream();
                cameraState = 'off';
                currentMode = 'static_image';
                startCameraBtn.querySelector('img').src = '/static/camera-on.svg';
                welcomeMessage.style.display = 'none';
                videoFeed.style.display = 'none';
                uploadedImage.src = `data:image/jpeg;base64,${result.image_base64}`;
                uploadedImage.style.display = 'block';
                originalImageSrc = uploadedImage.src;
                isYoloActive = false;
                resetAIContext();
            }
        } catch (error) {
            showModal(error.message);
        } finally {
            if (loadingModal) loadingModal.remove();
        }
    }

// =================================================================
    // 4. LÓGICA CENTRAL DE LUNA AI
    // =================================================================
    aiChatToggleBtn.addEventListener('click', toggleChatPanel);
    closeAIPanelBtn.addEventListener('click', toggleChatPanel);

    /**
     * Alterna la visibilidad del panel de chat y gestiona el estado visual 
     * del botón de activación (Luna).
     */
    function toggleChatPanel() {
        aiChatContainer.classList.toggle('w-0');
        aiChatContainer.classList.toggle('w-80');
        
        // Cambia el estilo del botón: fondo blanco e icono negro cuando está activo
        aiChatToggleBtn.classList.toggle('active-btn');

        if (aiChatContainer.classList.contains('w-80')) {
            renderChatButtons();
            // Inyecta el disclaimer actualizado al abrir el panel
            aiChatWindow.prepend(createDisclaimer());
        }
    }

    /**
     * Crea el componente de advertencia con diseño limpio:
     * Fondo blanco, texto negro e icono de alerta.
     */
    function createDisclaimer() {
        const existing = document.getElementById('aiDisclaimer');
        if (existing) existing.remove();

        const disclaimer = document.createElement('div');
        disclaimer.id = 'aiDisclaimer';
        // Estilos solicitados: bg-white, texto negro, sin emoji
        disclaimer.className = 'flex items-center gap-2 text-xs font-semibold text-black bg-white mt-2 mb-4 p-3 rounded-lg shadow-sm';
        
        // Uso de ion-icon en lugar de emoji para un look más profesional
        disclaimer.innerHTML = `
            <ion-icon name="alert-circle-outline" class="text-lg flex-shrink-0"></ion-icon>
            <span>Esta función sigue en fase de pruebas, compruebe los resultados del análisis.</span>
        `;
        return disclaimer;
    }

    /**
     * Reinicia el contexto de la conversación y limpia la interfaz del chat.
     */
    function resetAIContext() {
        analysisContext = { sampleType: null, ph: null, stainType: null, chatHistory: [] };
        aiChatWindow.innerHTML = '';
        renderChatButtons();
        
        // Mantiene el aviso legal visible tras el reinicio si el panel está abierto
        if (aiChatContainer.classList.contains('w-80')) {
            aiChatWindow.prepend(createDisclaimer());
        }
    }
    
    function renderChatButtons() {
        promptButtonsContainer.innerHTML = '';
        if (!analysisContext.sampleType) {
            const btn = createChatButton('Definir Tipo de Muestra', () => {
                analysisContext.sampleType = 'pending_selection';
                renderChatButtons();
            });
            promptButtonsContainer.appendChild(btn);
        } else if (analysisContext.sampleType === 'pending_selection') {
            const btn1 = createChatButton('Sedimento Urinario', () => {
                analysisContext.sampleType = 'Sedimento Urinario';
                renderChatButtons();
            });
            const btn2 = createChatButton('Extendido Sanguíneo', () => {
                analysisContext.sampleType = 'Extendido Sanguíneo';
                renderChatButtons();
            });
            promptButtonsContainer.append(btn1, btn2);
        } else if (analysisContext.sampleType === 'Sedimento Urinario' && !analysisContext.ph) {
            const btn1 = createChatButton('pH Ácida', () => {
                analysisContext.ph = 'Ácida';
                renderChatButtons();
            });
            const btn2 = createChatButton('pH Alcalina', () => {
                analysisContext.ph = 'Alcalina';
                renderChatButtons();
            });
            promptButtonsContainer.append(btn1, btn2);
        } else if (analysisContext.sampleType === 'Extendido Sanguíneo' && !analysisContext.stainType) {
            const btn1 = createChatButton('Wright-Giemsa', () => {
                analysisContext.stainType = 'Wright-Giemsa';
                renderChatButtons();
            });
            const btn2 = createChatButton('Giemsa', () => {
                analysisContext.stainType = 'Giemsa';
                renderChatButtons();
            });
            const btn3 = createChatButton('Wright', () => {
                analysisContext.stainType = 'Wright';
                renderChatButtons();
            });
            promptButtonsContainer.append(btn1, btn2, btn3);
        } else {
            if (analysisContext.sampleType === 'Sedimento Urinario' && analysisContext.ph) {
                const btn1 = createChatButton('¿Qué estoy mirando?', () => {
                    const userPrompt = prompts[analysisContext.sampleType][analysisContext.ph].prompt1;
                    sendToLunaAI(getImageBase64(uploadedImage), userPrompt);
                });
                const btn2 = createChatButton('Conteo', () => {
                    const userPrompt = prompts[analysisContext.sampleType][analysisContext.ph].prompt2;
                    sendToLunaAI(getImageBase64(uploadedImage), userPrompt);
                });
                promptButtonsContainer.append(btn1, btn2);
            }
            if (analysisContext.sampleType === 'Extendido Sanguíneo' && analysisContext.stainType) {
                 const btn1 = createChatButton('Descripción', () => {
                    const userPrompt = prompts[analysisContext.sampleType][analysisContext.stainType].prompt1;
                    sendToLunaAI(getImageBase64(uploadedImage), userPrompt);
                });
                const btn2 = createChatButton('Conteo', () => {
                    const userPrompt = prompts[analysisContext.sampleType][analysisContext.stainType].prompt2;
                    sendToLunaAI(getImageBase64(uploadedImage), userPrompt);
                });
                const btn3 = createChatButton('Diferencial', () => {
                    const userPrompt = prompts[analysisContext.sampleType][analysisContext.stainType].diferencial;
                    sendToLunaAI(getImageBase64(uploadedImage), userPrompt);
                });
                promptButtonsContainer.append(btn1, btn2, btn3);
            }
            const resetBtn = createChatButton('Reiniciar Muestra', resetAIContext);
            promptButtonsContainer.appendChild(resetBtn);
        }
    }

    async function sendToLunaAI(imageBase64, userPrompt) {
        if (!imageBase64) {
            showModal("No hay una imagen activa para analizar.");
            return;
        }
        analysisContext.chatHistory.push({ role: 'user', content: userPrompt });
        displayMessageInChat(userPrompt, 'user');
        const loadingMessage = displayMessageInChat('Luna está analizando...', 'ai');
        try {
            const response = await fetch('/analyze_with_ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64, messages: analysisContext.chatHistory }),
            });
            if (!response.ok) throw new Error("Error en la respuesta del servidor de IA.");
            const result = await response.json();
            loadingMessage.innerText = result.response;
            analysisContext.chatHistory.push({ role: 'assistant', content: result.response });
        } catch (error) {
            loadingMessage.innerText = 'Error: No se pudo conectar con Luna AI.';
        }
    }

    // =================================================================
    // 5. LÓGICA DE ANÁLISIS (YOLO Y ENCAJONADO MANUAL)
    // =================================================================
    scanBtn.addEventListener('click', () => {
        if (uploadedImage.style.display !== 'block') {
            showModal('Esta función requiere una imagen estática.');
            return;
        }
        if (isYoloActive) {
            uploadedImage.src = originalImageSrc;
            isYoloActive = false;
        } else {
            let imageDataSource = originalFile ? originalFile : dataURLtoBlob(originalImageSrc);
            if (imageDataSource) {
                runInference(imageDataSource);
            } else {
                showModal('No se encontró una fuente de imagen válida para analizar.');
            }
        }
    });

    async function runInference(fileOrBlob) {
        const loadingModal = showModal('Analizando con Luna AI (Esta función sigue en fase de pruebas, compruebe los resultados del análisis)', true);
        const formData = new FormData();
        formData.append("file", fileOrBlob, "image.jpg");
        try {
            const response = await fetch('/analyze_image/', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Error en el servidor: ${response.status}`);
            const result = await response.json();
            if (result.annotated_image_base64) {
                uploadedImage.src = `data:image/jpeg;base64,${result.annotated_image_base64}`;
                isYoloActive = true;
            }
        } catch (error) {
            showModal('Error al conectar con el servicio de análisis.');
        } finally {
            if (loadingModal) loadingModal.remove();
        }
    }

    boxBtn.addEventListener('click', () => {
        if (uploadedImage.style.display !== 'block') {
            showModal('Sube un archivo o captura una foto para encajonar.');
            return;
        }
        if (detectionOverlay.classList.contains('drawing-cursor')) {
            disableManualDrawing();
        } else {
            if (!analysisContext.sampleType || (!analysisContext.ph && !analysisContext.stainType)) {
                showModal("Define primero el contexto de la muestra en el chat de Luna para analizar un recorte.");
                return;
            }
            enableManualDrawing();
        }
    });
    
    function endDrawing(event) {
        if (!isDrawing) return;
        event.preventDefault();
        isDrawing = false;
        
        const coords = getEventCoords(event);
        const boxWidth = Math.abs(coords.x - startX);
        const boxHeight = Math.abs(coords.y - startY);
        
        // Dibuja el cuadro final una última vez
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);

        if (boxWidth < 10 || boxHeight < 10) {
            // No envíes el prompt si la caja es muy pequeña, pero déjala dibujada
            return; 
        }

        const rect = { x: Math.min(startX, coords.x), y: Math.min(startY, coords.y), w: boxWidth, h: boxHeight };
        const croppedImageBase64 = cropImage(uploadedImage, rect);
        
        let userPrompt;
        if (analysisContext.sampleType === 'Sedimento Urinario') {
            userPrompt = prompts[analysisContext.sampleType][analysisContext.ph].prompt3;
        } else if (analysisContext.sampleType === 'Extendido Sanguíneo') {
            userPrompt = prompts[analysisContext.sampleType][analysisContext.stainType].prompt3;
        }
        
        sendToLunaAI(croppedImageBase64, userPrompt);
        
        // **SOLUCIÓN**: Ya no se desactiva el modo de dibujo aquí para que la caja permanezca.
        // disableManualDrawing(); 
    }
    
    // =================================================================
    // 6. FUNCIONES DE UTILIDAD Y CÓDIGO RESTANTE
    // =================================================================
    function createChatButton(text, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = "w-full p-2 rounded-lg bg-button-dark text-text-light hover:bg-white hover:text-background-dark transition-colors duration-200";
        button.onclick = onClick;
        return button;
    }

    function displayMessageInChat(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `p-2 rounded-lg mb-2 max-w-[85%] ${sender === 'user' ? 'bg-white text-background-dark ml-auto' : 'bg-button-dark text-white mr-auto'}`;
        messageDiv.innerText = text;
        aiChatWindow.appendChild(messageDiv);
        aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
        return messageDiv;
    }

    function enableManualDrawing() {
        if (!detectionOverlay.classList.contains('drawing-cursor')) {
            const imgRect = uploadedImage.getBoundingClientRect();
            Object.assign(detectionOverlay.style, {
                display: 'block', position: 'absolute',
                top: `${imgRect.top}px`, left: `${imgRect.left}px`,
                width: `${imgRect.width}px`, height: `${imgRect.height}px`,
            });
            detectionOverlay.width = imgRect.width;
            detectionOverlay.height = imgRect.height;
            detectionOverlay.classList.add('drawing-cursor');
            detectionOverlay.addEventListener('mousedown', startDrawing);
            detectionOverlay.addEventListener('mousemove', draw);
            detectionOverlay.addEventListener('mouseup', endDrawing);
            detectionOverlay.addEventListener('touchstart', startDrawing, { passive: false });
            detectionOverlay.addEventListener('touchmove', draw, { passive: false });
            detectionOverlay.addEventListener('touchend', endDrawing);
        }
    }

    function disableManualDrawing() {
        if (detectionOverlay.classList.contains('drawing-cursor')) {
            detectionOverlay.style.display = 'none';
            ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
            detectionOverlay.classList.remove('drawing-cursor');
            detectionOverlay.removeEventListener('mousedown', startDrawing);
            detectionOverlay.removeEventListener('mousemove', draw);
            detectionOverlay.removeEventListener('mouseup', endDrawing);
            detectionOverlay.removeEventListener('touchstart', startDrawing);
            detectionOverlay.removeEventListener('touchmove', draw);
            detectionOverlay.removeEventListener('touchend', endDrawing);
        }
    }

    function getEventCoords(event) {
        const rect = detectionOverlay.getBoundingClientRect();
        let point;
        if (event.touches && event.touches.length > 0) {
            point = event.touches[0];
        } else if (event.changedTouches && event.changedTouches.length > 0) {
            point = event.changedTouches[0];
        } else {
            point = event;
        }
        return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    }

    function startDrawing(event) {
        event.preventDefault();
        isDrawing = true;
        const coords = getEventCoords(event);
        startX = coords.x;
        startY = coords.y;
        ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
    }

    function draw(event) {
        if (!isDrawing) return;
        event.preventDefault();
        const coords = getEventCoords(event);
        ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
    }

    function dataURLtoBlob(dataurl) {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) { u8arr[n] = bstr.charCodeAt(n); }
        return new Blob([u8arr], { type: mime });
    }
    
    function cropImage(sourceImage, rect) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const scaleX = sourceImage.naturalWidth / sourceImage.offsetWidth;
        const scaleY = sourceImage.naturalHeight / sourceImage.offsetHeight;
        const cropX = rect.x * scaleX;
        const cropY = rect.y * scaleY;
        const cropWidth = rect.w * scaleX;
        const cropHeight = rect.h * scaleY;
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        tempCtx.drawImage(sourceImage, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        return tempCanvas.toDataURL('image/jpeg').split(',')[1];
    }
    
    function getImageBase64(imageElement) {
        if (!imageElement || !imageElement.src || !imageElement.src.startsWith('data:image')) return null;
        const canvas = document.createElement('canvas');
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0);
        return canvas.toDataURL('image/jpeg').split(',')[1];
    }
    
    function showModal(message, isTemporary = false) {
        const existingModal = document.querySelector('.modal-container');
        if (existingModal) existingModal.remove();
        const modal = document.createElement('div');
        modal.className = 'modal-container fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50';
        let content = `<div class="bg-sidebar-dark p-6 rounded-lg shadow-xl text-text-light text-center"><p>${message}</p></div>`;
        if (!isTemporary) {
            content = `
                <div class="bg-sidebar-dark p-6 rounded-lg shadow-xl text-text-light text-center">
                    <p>${message}</p>
                    <button class="modal-close-btn mt-4 px-4 py-2 rounded-lg bg-button-dark text-white hover:bg-white hover:text-background-dark transition-colors duration-200">Cerrar</button>
                </div>`;
        }
        modal.innerHTML = content;
        document.body.appendChild(modal);
        if (isTemporary) {
            setTimeout(() => modal.remove(), 2500);
        } else {
            modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
        }
        return modal;
    }

    renderChatButtons();
});

// --- AJUSTE FORZADO: OCULTAR BARRA DE NAVEGACIÓN ---

function forceFullscreen() {
    const docEl = document.documentElement;
    
    // Solo intentamos entrar si no estamos ya en pantalla completa
    if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(err => console.log(err));
        } else if (docEl.webkitRequestFullscreen) { /* Safari/iOS */
            docEl.webkitRequestFullscreen();
        }
    }
}

// ... (parte final de main.js)
// Escuchar cambio de orientación
window.addEventListener("orientationchange", () => {
    if (window.orientation === 90 || window.orientation === -90) {
        // En horizontal, pedimos pantalla completa
        forceFullscreen();
        // Scroll forzado para "empujar" cualquier barra remanente
        window.scrollTo(0, 1);
    }
});
