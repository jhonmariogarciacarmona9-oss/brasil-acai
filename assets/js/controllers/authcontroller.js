const authController = {
    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm && !loginForm.dataset.boundSubmit) {
            loginForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleLogin();
            });
            loginForm.dataset.boundSubmit = 'true';
        }

        const btnSalir = document.getElementById('btn-salir');
        if (btnSalir) btnSalir.addEventListener('click', () => this.handleLogout());
    },
    async handleLogin() {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const pass = document.getElementById('login-password').value.trim();
        const errorDiv = document.getElementById('login-error');
        
        // Limpiar error anterior
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
        
        try {
            if (!email || !pass) {
                throw new Error('Usuario y contraseña son obligatorios');
            }
            
            await window.authModel.signIn(email, pass);
            document.getElementById('auth-container').classList.add('d-none');
            document.getElementById('app-container').style.display = 'block';
            window.appController.initializeDashboard();
        } catch (e) {
            // Mostrar error en el formulario
            if (errorDiv) {
                errorDiv.textContent = '❌ ' + e.message;
                errorDiv.style.display = 'block';
            } else {
                alert("Error al iniciar sesión: " + e.message);
            }
        }
    },
    async handleLogout() {
        window.authModel.clearSession();
        await window._supabase.auth.signOut();
        location.reload();
    }
};

window.authController = authController;
