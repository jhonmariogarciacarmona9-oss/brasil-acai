/**
 * PWA Installation Handler - Soporte para iOS, Android y Desktop
 * Detecta automáticamente el SO y proporciona instrucciones específicas
 */

let deferredPrompt = null;
let pwaInstallable = false;

// Detectar Sistema Operativo
function detectOS() {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod|mac os x/.test(ua)) return 'iOS';
    if (/android/.test(ua)) return 'Android';
    if (/windows nt/.test(ua)) return 'Windows';
    if (/macintosh|mac os x/.test(ua)) return 'Mac';
    if (/linux/.test(ua)) return 'Linux';
    return 'Unknown';
}

// Crear modal de instalación personalizada
function createInstallModal(title, content, showSteps = true) {
    // Remover modal anterior si existe
    const existing = document.getElementById('pwa-install-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    const card = document.createElement('div');
    card.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 90vw;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <i class="bi bi-cloud-download" style="font-size: 28px; color: #7c3aed;"></i>
            <h5 style="margin: 0; color: #333;">${title}</h5>
        </div>
        <p style="color: #666; margin-bottom: 20px; line-height: 1.6;">${content}</p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button onclick="document.getElementById('pwa-install-modal').remove()" style="padding: 10px 20px; background: #e9ecef; color: #333; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                Cerrar
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.appendChild(card);
    
    // Cerrar al hacer click en el fondo
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Agregar estilo de animación
if (!document.getElementById('pwa-install-styles')) {
    const style = document.createElement('style');
    style.id = 'pwa-install-styles';
    style.textContent = `
        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

// Evento: beforeinstallprompt (Chrome, Edge, Firefox en Android)
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('✅ beforeinstallprompt disponible en', detectOS());
    e.preventDefault();
    deferredPrompt = e;
    pwaInstallable = true;
    console.log('✅ PWA INSTALABLE');
});

// Evento: App instalada
window.addEventListener('appinstalled', () => {
    console.log('✅ APP INSTALADA');
    deferredPrompt = null;
    pwaInstallable = false;
});

// Función: Prompts de instalación
async function promptInstallPWA() {
    if (!deferredPrompt) return;
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('Usuario respondió:', outcome);
        deferredPrompt = null;
    } catch (err) {
        console.error('Error al instalar:', err);
    }
}

// Instrucciones para iOS
function showiOSInstallInstructions() {
    createInstallModal(
        '📱 Instalar en iPhone/iPad',
        `<strong>Sigue estos pasos:</strong><br><br>
         1. Tap en el botón <strong>Compartir</strong> (↗️) en la parte inferior<br>
         2. Desplázate hacia abajo y tap en <strong>"Agregar a pantalla de inicio"</strong><br>
         3. Personaliza el nombre si quieres<br>
         4. ¡Listo! La app aparecerá en tu pantalla de inicio<br><br>
         <em style="color: #999; font-size: 0.9rem;">Nota: Primero asegúrate de agregar esta web a tu pantalla de inicio</em>`
    );
}

// Instrucciones para Android
function showAndroidInstallInstructions() {
    createInstallModal(
        '🤖 Instalar en Android',
        `<strong>Sigue estos pasos:</strong><br><br>
         1. Abre el menú <strong>(⋮)</strong> en la parte superior derecha<br>
         2. Busca y tap en <strong>"Instalar aplicación"</strong> o <strong>"Descargar app"</strong><br>
         3. Confirma cuando se te pida<br>
         4. ¡Listo! La app se instalará en tu dispositivo<br><br>
         <em style="color: #999; font-size: 0.9rem;">Si no ves esa opción, asegúrate de usar Chrome actualizado</em>`
    );
}

// Instrucciones para Desktop
function showDesktopInstallInstructions() {
    createInstallModal(
        '💻 Instalar en Desktop',
        `<strong>Chrome / Edge / Firefox:</strong><br><br>
         Deberías ver un icono de instalación <strong>⬇️</strong> o <strong>⊡</strong> en la barra de dirección.<br>
         Haz click en él y confirma cuando se te pida.<br><br>
         <strong>O alternativa:</strong><br>
         1. Abre el menú <strong>(⋮)</strong><br>
         2. Selecciona <strong>"Instalar aplicación"</strong><br>
         3. ¡Listo! Accesible desde tu escritorio o menú de aplicaciones`
    );
}

// Exportar globalmente
window.pwaInstall = {
    detectOS,
    promptInstallPWA,
    showiOSInstallInstructions,
    showAndroidInstallInstructions,
    showDesktopInstallInstructions
};

// Exponer variables globales
Object.defineProperty(window, 'deferredPrompt', {
    get() { return deferredPrompt; },
    set(value) { deferredPrompt = value; }
});

Object.defineProperty(window, 'pwaInstallable', {
    get() { return pwaInstallable; },
    set(value) { pwaInstallable = value; }
});
