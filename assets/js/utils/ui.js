// UI Helper Functions
const ui = {
    showNotify(arg1, arg2, arg3 = 'info') {
        // Soportar dos formas de llamado:
        // 1. showNotify(message, type) - 2 argumentos
        // 2. showNotify(title, message, type) - 3 argumentos
        
        let title, message, type;
        
        if (typeof arg2 === 'string' && ['success', 'error', 'warning', 'info', 'danger'].includes(arg2)) {
            // Forma 1: showNotify(message, type)
            title = '';
            message = arg1;
            type = arg2 === 'danger' ? 'error' : arg2;
        } else {
            // Forma 2: showNotify(title, message, type)
            title = arg1;
            message = arg2;
            type = arg3 === 'danger' ? 'error' : arg3;
        }

        // Crear sistema de toasts automáticos
        const container = this.getToastContainer();
        const toast = document.createElement('div');
        
        const colors = {
            'success': { bg: '#10b981', border: '#059669', icon: '✅' },
            'error': { bg: '#ef4444', border: '#dc2626', icon: '❌' },
            'warning': { bg: '#f59e0b', border: '#d97706', icon: '⚠️' },
            'info': { bg: '#3b82f6', border: '#2563eb', icon: 'ℹ️' }
        };
        
        const config = colors[type] || colors.info;
        
        toast.className = 'ui-toast';
        toast.innerHTML = `
            <div style="
                background: linear-gradient(135deg, ${config.bg} 0%, ${config.border} 100%);
                color: white;
                padding: 14px 18px;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                border-left: 4px solid ${config.border};
                animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                max-width: 380px;
                font-weight: 500;
            ">
                <span style="font-size: 1.2rem; flex-shrink: 0;">${config.icon}</span>
                <div style="flex: 1;">
                    ${title ? `<div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 2px;">${title}</div>` : ''}
                    <div style="font-size: 0.9rem;">${message}</div>
                </div>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Remover automáticamente después de 3.5 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },
    
    getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
            
            // Agregar estilos de animación si no existen
            if (!document.getElementById('toast-styles')) {
                const style = document.createElement('style');
                style.id = 'toast-styles';
                style.textContent = `
                    @keyframes slideInRight {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    
                    @keyframes slideOutRight {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                    
                    .ui-toast {
                        pointer-events: auto;
                    }
                    
                    @media (max-width: 576px) {
                        #toast-container {
                            top: 10px !important;
                            right: 10px !important;
                            left: 10px !important;
                        }
                        
                        .ui-toast > div {
                            max-width: 100% !important;
                        }
                    }
                `;
                document.head.appendChild(style);
            }
        }
        return container;
    }
};

window.ui = ui;
