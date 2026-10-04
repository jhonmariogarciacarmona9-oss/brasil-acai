/**
 * Sistema de Notificación de Actualizaciones
 * Verifica si hay una nueva versión disponible y notifica al usuario
 */

let updateAvailable = false;

// Mostrar versión en el badge del navbar
function displayVersionBadge(version) {
    const badge = document.getElementById('app-version-badge');
    if (badge && version && version !== '0.0.0') {
        badge.textContent = 'v' + version;
    }
}

// Verificar si hay actualización disponible
async function checkForUpdates() {
    try {
        const response = await fetch('./version.txt?cache-bust=' + Date.now(), {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
        
        const latestVersion = (await response.text()).trim();
        const currentVersion = localStorage.getItem('appVersion') || '0.0.0';
        
        // Siempre mostrar la versión del servidor en el badge
        displayVersionBadge(latestVersion);
        
        if (latestVersion !== currentVersion) {
            updateAvailable = true;
            console.log('✅ Nueva versión disponible:', latestVersion);
            showUpdateNotification(latestVersion);
        } else {
            // Garantizar que la versión queda guardada
            localStorage.setItem('appVersion', latestVersion);
        }
    } catch (error) {
        console.error('Error verificando actualizaciones:', error);
    }
}

// Mostrar notificación de actualización
function showUpdateNotification(newVersion) {
    // Crear modal de actualización
    const modal = document.createElement('div');
    modal.id = 'update-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            text-align: center;
        ">
            <div style="
                font-size: 2rem;
                margin-bottom: 15px;
                color: #7c3aed;
            ">🎉</div>
            
            <h3 style="
                font-weight: bold;
                margin: 15px 0;
                color: #1f2937;
            ">Nueva Actualización Disponible</h3>
            
            <p style="
                color: #6b7280;
                margin: 15px 0;
                font-size: 0.95rem;
                line-height: 1.6;
            ">
                Se ha encontrado una nueva versión (<strong>${newVersion}</strong>) de Brasil Açaí SGP.
                <br><br>
                Toca el botón de abajo para actualizar y obtener las mejores características.
            </p>
            
            <div style="
                display: block;
                margin-top: 25px;
            ">
                <button id="btn-update-now" style="
                    width: 100%;
                    padding: 12px;
                    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
                " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 16px rgba(124, 58, 237, 0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 12px rgba(124, 58, 237, 0.3)';">
                    Actualizar Ahora
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('btn-update-now').addEventListener('click', () => {
        updateApp(newVersion);
    });
}

// Actualizar app
function updateApp(newVersion) {
    console.log('🔄 Actualizando app a versión:', newVersion);
    
    // Guardar nueva versión
    localStorage.setItem('appVersion', newVersion);
    
    // Clear caches
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
                console.log('Caché eliminada:', cacheName);
            });
        });
    }
    
    // Desactivar todos los Service Workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.unregister();
                console.log('Service Worker desregistrado');
            });
        });
    }
    
    // Recargar página después de un pequeño delay
    setTimeout(() => {
        window.location.href = './index.html?updated=' + Date.now();
    }, 500);
}

// Verificar actualizaciones al cargar
window.addEventListener('load', () => {
    // Mostrar versión guardada inmediatamente mientras se hace el fetch
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion && savedVersion !== '0.0.0') {
        displayVersionBadge(savedVersion);
    }
    checkForUpdates();
});

// Verificar actualizaciones cada 5 minutos
setInterval(() => {
    console.log('🔍 Verificando actualizaciones (periódico)...');
    checkForUpdates();
}, 5 * 60 * 1000);

// Exportar
window.updateChecker = {
    checkForUpdates,
    showUpdateNotification,
    updateApp,
    displayVersionBadge
};
