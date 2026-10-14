const authModel = {
    userProfile: null,
    async signIn(email, password) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !password) {
            throw new Error('Por favor ingresa tu correo y contraseña');
        }

        // 1. Buscar perfil en Tabla De Perfiles (insensible a mayúsculas y espacios)
        let profile = null;
        try {
            const { data: profiles, error: profileError } = await window._supabase
                .from('Tabla De Perfiles')
                .select('*');

            if (profileError) {
                console.error('⚠️ Error consultando Tabla De Perfiles:', profileError);
                throw new Error('Error de conexión con la base de datos: ' + profileError.message);
            }

            if (profiles && profiles.length > 0) {
                profile = profiles.find(p => String(p.nombre_usuario || '').trim().toLowerCase() === cleanEmail);
            }
        } catch (e) {
            if (e.message && e.message.includes('Error de conexión')) throw e;
            console.warn('⚠️ Error consultando Tabla De Perfiles:', e);
        }

        // 2. Validar si el perfil existe
        if (!profile) {
            throw new Error('Usuario no encontrado en el sistema. Por favor verifica que el correo esté bien escrito');
        }

        // 3. Validar estado del perfil
        if (profile.activo === false) {
            try { await window._supabase.auth.signOut(); } catch (_) {}
            throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador');
        }

        // 4. Intentar autenticar con Supabase Auth
        let authRes = await window._supabase.auth.signInWithPassword({ 
            email: cleanEmail, 
            password: password 
        });

        if (authRes.error) {
            console.warn('⚠️ signInWithPassword falló:', authRes.error.message);
            // Intentar registrar el usuario en Auth si existe en la BD pero aún no en Auth
            try {
                const signUpRes = await window._supabase.auth.signUp({ 
                    email: cleanEmail, 
                    password: password 
                });
                
                if (signUpRes.error) {
                    const msg = (signUpRes.error.message || '').toLowerCase();
                    const code = signUpRes.error.code || '';
                    const isAlreadyRegistered = msg.includes('already') || code === 'user_already_exists';
                    
                    if (isAlreadyRegistered) {
                        throw new Error('Contraseña incorrecta. Por favor verifica tus credenciales');
                    } else {
                        throw new Error(authRes.error.message || signUpRes.error.message);
                    }
                } else {
                    // Tras el registro exitoso, volver a iniciar sesión para asegurar el token de sesión
                    authRes = await window._supabase.auth.signInWithPassword({ 
                        email: cleanEmail, 
                        password: password 
                    });
                    if (authRes.error) {
                        throw new Error('Error al iniciar sesión tras registrar la cuenta en Auth: ' + authRes.error.message);
                    }
                }
            } catch (err) {
                throw err;
            }
        }

        // 5. Verificar que la sesión activa fue creada correctamente
        const { data: { session } } = await window._supabase.auth.getSession();
        if (!session && !authRes.data?.session) {
            throw new Error('No se pudo establecer una sesión activa en Supabase Auth');
        }

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
