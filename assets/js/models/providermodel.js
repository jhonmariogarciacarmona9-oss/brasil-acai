const providerModel = {
    proveedores: [],
    supabase: window._supabase,
    supportaEmail: null,
    supportaCampos: {},
    metadataStorageKey: 'proveedores_metadata_v1',

    _normalizarTexto(input) {
        const texto = String(input || '').trim();
        return texto;
    },

    _normalizarEmailList(input) {
        if (Array.isArray(input)) {
            return [...new Set(input
                .map(v => String(v || '').trim().toLowerCase())
                .filter(Boolean))];
        }

        return [...new Set(String(input || '')
            .split(/[;,\n]/)
            .map(v => v.trim().toLowerCase())
            .filter(Boolean))];
    },

    _normalizarTiendasList(input) {
        if (!Array.isArray(input)) return [];
        return [...new Set(input.map(v => String(v || '').trim()).filter(Boolean))];
    },

    _getMetadataMap() {
        try {
            const raw = localStorage.getItem(this.metadataStorageKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (_) {
            return {};
        }
    },

    _setMetadataMap(map) {
        localStorage.setItem(this.metadataStorageKey, JSON.stringify(map || {}));
    },

    _saveProviderMetadata(providerId, metadata = {}) {
        const key = String(providerId);
        const map = this._getMetadataMap();
        map[key] = {
            ...(map[key] || {}),
            ...metadata,
            emails: this._normalizarEmailList(metadata.emails || map[key]?.emails || []),
            tiendas_asignadas: this._normalizarTiendasList(metadata.tiendas_asignadas || map[key]?.tiendas_asignadas || []),
            cif_empresa: this._normalizarTexto(metadata.cif_empresa || map[key]?.cif_empresa || ''),
            direccion: this._normalizarTexto(metadata.direccion || map[key]?.direccion || ''),
            telefono: this._normalizarTexto(metadata.telefono || map[key]?.telefono || ''),
            all_tiendas: typeof metadata.all_tiendas === 'boolean'
                ? metadata.all_tiendas
                : (typeof map[key]?.all_tiendas === 'boolean' ? map[key].all_tiendas : true)
        };
        this._setMetadataMap(map);
    },

    _applyProviderMetadata(proveedor) {
        const map = this._getMetadataMap();
        const meta = map[String(proveedor.id)] || {};

        const emailsDB = this._normalizarEmailList(proveedor.email || '');
        const emailsMeta = this._normalizarEmailList(meta.emails || []);
        const emails = emailsMeta.length > 0 ? emailsMeta : emailsDB;

        const tiendasAsignadas = this._normalizarTiendasList(meta.tiendas_asignadas || []);
        const allTiendas = typeof meta.all_tiendas === 'boolean' ? meta.all_tiendas : true;
        const cif_empresa = this._normalizarTexto(meta.cif_empresa || proveedor.cif_empresa || '');
        const direccion = this._normalizarTexto(meta.direccion || proveedor.direccion || '');
        const telefono = this._normalizarTexto(meta.telefono || proveedor.telefono || '');

        return {
            ...proveedor,
            emails,
            email: emails.join(', '),
            tiendas_asignadas: tiendasAsignadas,
            all_tiendas: allTiendas,
            cif_empresa,
            direccion,
            telefono
        };
    },

    _mergeAndPersistMetadata() {
        this.proveedores = this.proveedores.map(p => {
            const merged = this._applyProviderMetadata(p);
            this._saveProviderMetadata(merged.id, {
                emails: merged.emails,
                tiendas_asignadas: merged.tiendas_asignadas,
                all_tiendas: merged.all_tiendas,
                cif_empresa: merged.cif_empresa,
                direccion: merged.direccion,
                telefono: merged.telefono
            });
            return merged;
        });
    },

    async detectEmailSupport() {
        if (this.supportaEmail !== null) {
            return this.supportaEmail;
        }

        try {
            const { error } = await this.supabase
                .from('proveedores')
                .select('email')
                .limit(1);

            this.supportaEmail = !error;
        } catch (err) {
            this.supportaEmail = false;
        }

        return this.supportaEmail;
    },

    async detectFieldSupport(fieldName) {
        if (Object.prototype.hasOwnProperty.call(this.supportaCampos, fieldName)) {
            return this.supportaCampos[fieldName];
        }

        try {
            const { error } = await this.supabase
                .from('proveedores')
                .select(fieldName)
                .limit(1);

            this.supportaCampos[fieldName] = !error;
        } catch (_) {
            this.supportaCampos[fieldName] = false;
        }

        return this.supportaCampos[fieldName];
    },

    async fetchProveedores() {
        try {
            const { data, error } = await this.supabase
                .from('proveedores')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;

            this.proveedores = data || [];

            // Si no hay proveedores en la tabla, sincronizar desde productos existentes
            if (this.proveedores.length === 0) {
                await this.sincronizarProveedoresDesdeProductos();
            }

            this._mergeAndPersistMetadata();

            return this.proveedores;
        } catch (err) {
            console.error('Error fetching proveedores:', err);
            // Fallback: cargar desde productos
            await this.sincronizarProveedoresDesdeProductos();
            this._mergeAndPersistMetadata();
            return this.proveedores;
        }
    },

    async sincronizarProveedoresDesdeProductos() {
        try {
            // Obtener todos los proveedores únicos de la tabla productos
            const { data: productos, error: prodError } = await this.supabase
                .from('productos')
                .select('proveedor');

            if (prodError) {
                console.error('Error cargando productos:', prodError);
                return;
            }

            // Obtener proveedores únicos
            const proveedoresUnicos = [...new Set(
                productos
                    .map(p => p.proveedor)
                    .filter(p => p && p.trim() !== '')
            )].sort();

            if (proveedoresUnicos.length === 0) return;

            const soportaEmail = await this.detectEmailSupport();

            // Insertar proveedores en la tabla
            const proveedoresParaInsertar = proveedoresUnicos.map(nombre => ({
                nombre: nombre.trim(),
                activo: true,
                ...(soportaEmail ? { email: '' } : {})
            }));

            const { data: insertados, error: insertError } = await this.supabase
                .from('proveedores')
                .insert(proveedoresParaInsertar)
                .select();

            if (insertError) {
                console.error('Error sincronizando proveedores:', insertError);
                // Si falla, mantener en memoria
                this.proveedores = proveedoresParaInsertar;
                return;
            }

            this.proveedores = insertados || proveedoresParaInsertar;
        } catch (err) {
            console.error('Error en sincronización:', err);
        }
    },

    async insertProveedor(nombre, emails = [], activo = true, assignment = { all_tiendas: true, tiendas_asignadas: [] }, details = {}) {
        try {
            if (!nombre || !nombre.trim()) {
                throw new Error('El nombre del proveedor es requerido');
            }

            const soportaEmail = await this.detectEmailSupport();
            const soportaCif = await this.detectFieldSupport('cif_empresa');
            const soportaDireccion = await this.detectFieldSupport('direccion');
            const soportaTelefono = await this.detectFieldSupport('telefono');
            const emailsNorm = this._normalizarEmailList(emails);
            const tiendasNorm = this._normalizarTiendasList(assignment?.tiendas_asignadas || []);
            const allTiendas = assignment?.all_tiendas !== false;
            const cifEmpresa = this._normalizarTexto(details?.cif_empresa);
            const direccion = this._normalizarTexto(details?.direccion);
            const telefono = this._normalizarTexto(details?.telefono);

            // Validar duplicados
            if (this.proveedores.some(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
                throw new Error('Este proveedor ya existe');
            }

            const payload = {
                nombre: nombre.trim(),
                activo
            };

            if (soportaEmail) {
                payload.email = emailsNorm.join(', ');
            }
            if (soportaCif) {
                payload.cif_empresa = cifEmpresa;
            }
            if (soportaDireccion) {
                payload.direccion = direccion;
            }
            if (soportaTelefono) {
                payload.telefono = telefono;
            }

            const { data, error } = await this.supabase
                .from('proveedores')
                .insert([payload])
                .select();

            if (error) throw error;

            const creado = data?.[0];
            if (creado?.id) {
                this._saveProviderMetadata(creado.id, {
                    emails: emailsNorm,
                    tiendas_asignadas: tiendasNorm,
                    all_tiendas: allTiendas,
                    cif_empresa: cifEmpresa,
                    direccion,
                    telefono
                });
            }

            await this.fetchProveedores();
            return data?.[0] || null;
        } catch (err) {
            console.error('Error inserting proveedor:', err);
            throw err;
        }
    },

    async toggleProveedorStatus(proveedorId, nuevoEstado) {
        try {
            const { data, error } = await this.supabase
                .from('proveedores')
                .update({ activo: nuevoEstado })
                .eq('id', proveedorId)
                .select();

            if (error) throw error;

            await this.fetchProveedores();
            return data?.[0] || null;
        } catch (err) {
            console.error('Error toggling proveedor status:', err);
            throw err;
        }
    },

    async deleteProveedor(proveedorId) {
        try {
            const { error } = await this.supabase
                .from('proveedores')
                .delete()
                .eq('id', proveedorId);

            if (error) throw error;

            await this.fetchProveedores();
            return true;
        } catch (err) {
            console.error('Error deleting proveedor:', err);
            throw err;
        }
    },

    async updateProveedorDatos(proveedorId, updates = {}) {
        try {
            const payload = {};

            if (typeof updates.nombre === 'string') {
                const nuevoNombre = updates.nombre.trim();
                if (!nuevoNombre) {
                    throw new Error('El nombre del proveedor es requerido');
                }

                if (this.proveedores.some(p => p.id !== proveedorId && p.nombre.toLowerCase() === nuevoNombre.toLowerCase())) {
                    throw new Error('Ya existe un proveedor con ese nombre');
                }

                payload.nombre = nuevoNombre;
            }

            if (typeof updates.email === 'string') {
                const soportaEmail = await this.detectEmailSupport();
                if (soportaEmail) {
                    payload.email = updates.email.trim();
                }
            }

            if (typeof updates.cif_empresa === 'string') {
                const soportaCif = await this.detectFieldSupport('cif_empresa');
                if (soportaCif) {
                    payload.cif_empresa = this._normalizarTexto(updates.cif_empresa);
                }
            }

            if (typeof updates.direccion === 'string') {
                const soportaDireccion = await this.detectFieldSupport('direccion');
                if (soportaDireccion) {
                    payload.direccion = this._normalizarTexto(updates.direccion);
                }
            }

            if (typeof updates.telefono === 'string') {
                const soportaTelefono = await this.detectFieldSupport('telefono');
                if (soportaTelefono) {
                    payload.telefono = this._normalizarTexto(updates.telefono);
                }
            }

            if (Array.isArray(updates.emails)) {
                const soportaEmail = await this.detectEmailSupport();
                if (soportaEmail) {
                    payload.email = this._normalizarEmailList(updates.emails).join(', ');
                }
            }

            if (typeof updates.activo === 'boolean') {
                payload.activo = updates.activo;
            }

            if (Object.keys(payload).length === 0) {
                return null;
            }

            const { data, error } = await this.supabase
                .from('proveedores')
                .update(payload)
                .eq('id', proveedorId)
                .select();

            if (error) throw error;

            const providerId = String(proveedorId);
            const current = this.proveedores.find(p => String(p.id) === providerId) || {};
            this._saveProviderMetadata(proveedorId, {
                emails: Array.isArray(updates.emails)
                    ? updates.emails
                    : this._normalizarEmailList(payload.email || current.email || ''),
                tiendas_asignadas: Array.isArray(updates.tiendas_asignadas)
                    ? updates.tiendas_asignadas
                    : (current.tiendas_asignadas || []),
                cif_empresa: typeof updates.cif_empresa === 'string'
                    ? this._normalizarTexto(updates.cif_empresa)
                    : (current.cif_empresa || ''),
                direccion: typeof updates.direccion === 'string'
                    ? this._normalizarTexto(updates.direccion)
                    : (current.direccion || ''),
                telefono: typeof updates.telefono === 'string'
                    ? this._normalizarTexto(updates.telefono)
                    : (current.telefono || ''),
                all_tiendas: typeof updates.all_tiendas === 'boolean'
                    ? updates.all_tiendas
                    : (typeof current.all_tiendas === 'boolean' ? current.all_tiendas : true)
            });

            await this.fetchProveedores();
            return data?.[0] || null;
        } catch (err) {
            console.error('Error updating proveedor datos:', err);
            throw err;
        }
    },

    async updateProveedorNombre(proveedorId, nuevoNombre) {
        try {
            if (!nuevoNombre || !nuevoNombre.trim()) {
                throw new Error('El nombre del proveedor es requerido');
            }

            return await this.updateProveedorDatos(proveedorId, { nombre: nuevoNombre.trim() });
        } catch (err) {
            console.error('Error updating proveedor nombre:', err);
            throw err;
        }
    },

    getProveedores(soloActivos = false, tienda = null) {
        let list = this.proveedores;

        if (soloActivos) {
            list = list.filter(p => p.activo === true);
        }

        const tiendaNorm = String(tienda || '').trim();
        if (tiendaNorm && tiendaNorm !== 'todas' && tiendaNorm.toLowerCase() !== 'todas las tiendas') {
            list = list.filter(p => {
                if (p.all_tiendas !== false) return true;
                const tiendas = this._normalizarTiendasList(p.tiendas_asignadas || []);
                return tiendas.includes(tiendaNorm);
            });
        }

        return list;
    },

    getProveedoresPorNombre(soloActivos = false, tienda = null) {
        const list = this.getProveedores(soloActivos, tienda);
        return list.map(p => p.nombre);
    }
};

window.providerModel = providerModel;
