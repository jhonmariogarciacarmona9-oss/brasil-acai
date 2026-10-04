const authModel = {
    userProfile: null,
    async signIn(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        
        // Buscar usuario en Tabla De Perfiles
        const { data: profile, error } = await window._supabase
            .from('Tabla De Perfiles')
            .select('*')
            .ilike('nombre_usuario', cleanEmail)
            .single();

        if (error || !profile) {
            throw new Error('Usuario no encontrado en el sistema');
        }

        // Validar contraseña contra Supabase Auth
        try {
            const { error: authError } = await window._supabase.auth.signInWithPassword({ 
                email: cleanEmail, 
                password: password 
            });
            
            // Si hay error de autenticación
            if (authError) {
                // Mensaje específico por tipo de error
                if (authError.message.includes('Invalid login credentials') || authError.message.includes('invalid_grant')) {
                    throw new Error('Contraseña incorrecta');
                } else if (authError.message.includes('Email not confirmed')) {
                    throw new Error('Email no confirmado. Revisa tu correo para activar la cuenta');
                } else {
                    throw new Error(`Error de autenticación: ${authError.message}`);
                }
            }
        } catch (authErr) {
            // Si el error ya es nuestro (contraseña incorrecta, etc.), pasarlo
            if (authErr.message && authErr.message.includes('Contraseña')) {
                throw authErr;
            }
            // Si hay otro error, indicar que deben registrarse
            throw new Error('Usuario no encontrado en la autenticación. Contacta al administrador para que te registre correctamente');
        }
        
        // Usar el perfil de la Tabla De Perfiles
        this.userProfile = profile;
        this.saveSession();
        return this.userProfile;
    },

    saveSession() {
        if (this.userProfile) {
            localStorage.setItem('userProfile', JSON.stringify(this.userProfile));
        }
    },
    loadSession() {
        const saved = localStorage.getItem('userProfile');
        if (saved) {
            this.userProfile = JSON.parse(saved);
            return this.userProfile;
        }
        return null;
    },
    clearSession() {
        this.userProfile = null;
        localStorage.removeItem('userProfile');
    },
    getProfile() { return this.userProfile; },

    isAdmin() {
        if (!this.userProfile) return false;
        const rol = this.userProfile.rol.toLowerCase().trim();
        return rol === 'administrador' || rol === 'auxiliar_administrativo';
    },
    async fetchAllProfiles() {
        const { data, error } = await window._supabase
            .from('Tabla De Perfiles')
            .select('*')
            .order('nombre_usuario');
        if (error) throw error;
        return data;
    },
    async updateProfile(email, updates) {
        const { error } = await window._supabase
            .from('Tabla De Perfiles')
            .update(updates)
            .ilike('nombre_usuario', email);
        if (error) throw error;
        return true;
    }
};

window.authModel = authModel;
