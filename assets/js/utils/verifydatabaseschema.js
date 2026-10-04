// Utilidad para verificar el esquema de la base de datos
const verifyDatabaseSchema = {
    async checkNombreUsuarioUniqueness() {

        try {
            const { data: allProfiles, error: fetchError } = await window._supabase
                .from('Tabla De Perfiles')
                .select('nombre_usuario');

            if (fetchError) {
                console.error("❌ Error fetching profiles:", fetchError);
                return { status: 'error', message: fetchError.message };
            }

            // 2. Buscar duplicados
            const emails = allProfiles.map(p => p.nombre_usuario?.toLowerCase());
            const duplicados = emails.filter((item, index) => emails.indexOf(item) !== index);
            
            
            if (duplicados.length > 0) {
                console.warn(`⚠️ Se encontraron ${duplicados.length} emails duplicados:`, [...new Set(duplicados)]);
                return { 
                    status: 'warning', 
                    message: `${duplicados.length} duplicados encontrados`,
                    duplicates: [...new Set(duplicados)]
                };
            } else {
            }

            // 3. Test: intentar insertar email duplicado
            const testEmail = allProfiles[0]?.nombre_usuario;
            
            if (!testEmail) {
                console.warn("⚠️ No hay registros para hacer test");
                return { status: 'warning', message: 'No hay registros para verificar' };
            }

            const { error: insertError } = await window._supabase
                .from('Tabla De Perfiles')
                .insert({
                    nombre_usuario: testEmail,
                    rol: 'test',
                    tienda_asignada: 'test',
                    activo: true
                });

            if (insertError) {
                if (insertError.message.includes('unique') || insertError.message.includes('Duplicate')) {
                    return { 
                        status: 'success', 
                        message: 'nombre_usuario tiene constraint UNIQUE activo ✓'
                    };
                } else {
                    return { 
                        status: 'warning', 
                        message: `Error diferente al UNIQUE: ${insertError.message}`
                    };
                }
            } else {
                console.error("❌ NO HAY CONSTRAINT UNIQUE - El duplicado fue insertado sin error");
                // Limpiar el registro de prueba
                await window._supabase
                    .from('Tabla De Perfiles')
                    .delete()
                    .eq('nombre_usuario', testEmail)
                    .gte('id', 0);
                
                return { 
                    status: 'error', 
                    message: 'nombre_usuario NO tiene constraint UNIQUE'
                };
            }

        } catch (e) {
            console.error("❌ Error en verificación:", e);
            return { status: 'error', message: e.message };
        }
    },

    async getColumnInfo() {
        
        try {
            // Obtener información del esquema
            const { data, error } = await window._supabase
                .from('Tabla De Perfiles')
                .select('*')
                .limit(1);

            if (error) {
                console.error("Error:", error);
                return;
            }


        } catch (e) {
            console.error("Error:", e);
        }
    },

    async showAllProfiles() {
        
        try {
            const { data } = await window._supabase
                .from('Tabla De Perfiles')
                .select('*')
                .order('nombre_usuario');

            if (!data || data.length === 0) {
                return;
            }

            console.table(data.map(p => ({
                'Email': p.nombre_usuario,
                'Rol': p.rol,
                'Tienda': p.tienda_asignada,
                'Activo': p.activo ? 'Sí' : 'No'
            })));

        } catch (e) {
            console.error("Error:", e);
        }
    }
};

window.verifyDatabaseSchema = verifyDatabaseSchema;
