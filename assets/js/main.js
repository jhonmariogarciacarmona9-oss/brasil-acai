
// �🔐 Toggle password visibility - Función global
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const btn = input?.parentElement?.querySelector('.btn-toggle-password');
    const icon = btn?.querySelector('i');
    
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('bi-eye-slash');
        icon.classList.add('bi-eye');
    } else {
        input.type = 'password';
        icon.classList.remove('bi-eye');
        icon.classList.add('bi-eye-slash');
    }
}

// 🔒 Bloquear flujo de cambio de contraseña de Supabase (PASSWORD_RECOVERY)
window._supabase?.auth?.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
        console.log('🔒 Evento PASSWORD_RECOVERY bloqueado');
        window._supabase.auth.signOut();
    }
});

// 🔒 Desactivar entrada por enlaces de recuperación/cambio de contraseña
(function blockRecoveryLinks() {
    try {
        const url = new URL(window.location.href);
        const hash = String(window.location.hash || '');
        const searchType = (url.searchParams.get('type') || '').toLowerCase();
        const hasRecoveryInHash = /type=recovery|recovery_token|access_token|refresh_token/i.test(hash);

        if (searchType === 'recovery' || hasRecoveryInHash) {
            console.log('🔒 Enlace de recuperación detectado y bloqueado');
            window._supabase?.auth?.signOut();
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (err) {
        console.warn('⚠️ No se pudo procesar bloqueo de recovery link:', err);
    }
})();

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔵 DOMContentLoaded iniciado');
    
    // Configurar botón de instalación PWA
    const btnInstall = document.getElementById('btn-install-login');
    if (btnInstall && window.pwaInstall) {
        const updateInstallButtonState = () => {
            const canInstall = Boolean(window.deferredPrompt);
            btnInstall.style.display = 'block';
            btnInstall.disabled = false;
            btnInstall.setAttribute('aria-disabled', canInstall ? 'false' : 'true');
        };
        
        updateInstallButtonState();
        window.addEventListener('beforeinstallprompt', updateInstallButtonState);
        window.addEventListener('appinstalled', updateInstallButtonState);
        
        btnInstall.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('📲 Click en botón de instalación');
            
            if (!window.deferredPrompt) {
                console.log('⚠️ Instalador nativo no disponible en este momento');
                if (window.ui?.showNotify) {
                    window.ui.showNotify('⚠️ El instalador no está disponible todavía. Intenta en Chrome o Edge.', 'warning');
                }
                updateInstallButtonState();
                return;
            }

            await window.pwaInstall.promptInstallPWA();
            updateInstallButtonState();
        });
    }
    
    // 🔧 INICIALIZAR: Verificar que jsPDF esté disponible antes de continuar
    if (window.pdfGenerator && window.pdfGenerator.checkDependencies) {
        const jsPDFReady = await window.pdfGenerator.checkDependencies();
        if (!jsPDFReady) {
            console.warn('⚠️ Advertencia: jsPDF podría no estar disponible. La exportación de PDF podría fallar.');
        } else {
            console.log('✅ jsPDF verificado y listo para usar');
        }
    }
    
    // Configurar Enter para validar en modales
    setupEnterKeyListeners();

    // Verificar si existe sesión guardada en localStorage
    const savedProfile = window.authModel.loadSession();
    
    if (savedProfile) {
        try {
            // Validar que la sesión de Supabase también esté activa
            const { data: { session } } = await window._supabase.auth.getSession();
            
            if (session) {
                // Sesión válida, restaurar dashboard
                document.getElementById('auth-container').classList.add('d-none');
                document.getElementById('app-container').style.display = 'block';
                window.authController.bindEvents();
                window.appController.bindGlobalEvents();
                window.pdfExportController.bindEvents();
                await window.appController.initializeDashboard();
            } else {
                // Sesión de Supabase expirada, limpiar localStorage
                window.authModel.clearSession();
                window.authController.bindEvents();
                window.appController.bindGlobalEvents();
                window.pdfExportController.bindEvents();
            }
        } catch (e) {
            console.error("Error verificando sesión:", e);
            window.authModel.clearSession();
            window.authController.bindEvents();
            window.appController.bindGlobalEvents();
            window.pdfExportController.bindEvents();
        }
    } else {
        // No hay sesión, mostrar login
        window.authController.bindEvents();
        window.appController.bindGlobalEvents();
        window.pdfExportController.bindEvents();
    }
});

// Función para configurar Enter como botón de validación en modales
function setupEnterKeyListeners() {
    // Modal de Producto
    const productInputs = ['prod-nombre', 'prod-proveedor', 'prod-precio'];
    productInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const confirmBtn = document.getElementById('btn-confirm-product');
                    if (confirmBtn) confirmBtn.click();
                }
            });
        }
    });

    // Modal de Empleado
    const employeeInputs = ['emp-correo', 'emp-nombre', 'emp-password', 'emp-rol', 'emp-tienda'];
    employeeInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const confirmBtn = document.getElementById('btn-confirm-employee');
                    if (confirmBtn) confirmBtn.click();
                }
            });
        }
    });

    // Modal de Tienda
    const tiendaInputs = ['tienda-nombre', 'tienda-direccion'];
    tiendaInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const confirmBtn = document.getElementById('btn-confirm-tienda');
                    if (confirmBtn) confirmBtn.click();
                }
            });
        }
    });
}

// 🔍 VERIFICACIÓN: Comparar versión de index.html cada 1 minuto
(function() {
    let lastIndexVersion = null;
    
    setInterval(async () => {
        try {
            const response = await fetch('./index.html?bust=' + Date.now(), { 
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
            const currentVersion = await response.text();
            const currentHash = hashCode(currentVersion);
            
            if (lastIndexVersion === null) {
                lastIndexVersion = currentHash;
            } else if (lastIndexVersion !== currentHash) {
                console.log('🔄 Cambios detectados en index.html, recargando...');
                window.location.reload(true); // true = desde servidor, ignorando caché
            }
        } catch (err) {
            console.warn('⚠️ Error verificando actualizaciones:', err);
        }
    }, 60 * 1000); // Cada 1 minuto
})();

// Función para generar hash simple
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}
