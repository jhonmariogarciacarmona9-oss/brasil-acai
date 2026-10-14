const employeeController = {
    isCreatingNewEmployee: false, // 🔧 Flag confiable para distinguir creación de edición
    
    init() {
        const profile = window.authModel.getProfile();
        const rol = (profile?.rol || '').toLowerCase().trim();
        const tienePermiso = window.authModel.isAdmin() || rol === 'franquiciado';
        if (!tienePermiso) {
            console.warn('Acceso denegado: Solo administradores y franquiciados pueden ver gestión de usuarios');
            return;
        }
        this.bindEvents();
        this.cargarEmpleados();
    },

    bindEvents() {
        const btnAddEmp = document.getElementById('btn-add-employee');
        if (btnAddEmp) {
            btnAddEmp.addEventListener('click', () => this.showModalAgregarEmpleado());
        }

        const btnConfirm = document.getElementById('btn-confirm-employee');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => this.guardarEmpleado());
        }

        const btnCancel = document.getElementById('btn-cancel-employee');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cerrarModal());
        }

        const empRol = document.getElementById('emp-rol');
        if (empRol) {
            empRol.addEventListener('change', () => this.actualizarVerTienda());
        }
    },

    showModalAgregarEmpleado() {
        const modal = document.getElementById('modal-employee');
        modal.style.display = 'flex';
        this.isCreatingNewEmployee = true; // 🔧 Marcar como CREACIÓN NEW
        this.limpiarFormulario();
        this.cargarTiendasEnModal();
        window.appController?.focusFirstElementInModal?.(modal);
    },

    cerrarModal() {
        document.getElementById('modal-employee').style.display = 'none';
        this.isCreatingNewEmployee = false; // 🔧 Resetear flag al cerrar
        this.limpiarFormulario();
    },

    limpiarFormulario() {
        document.getElementById('emp-correo').value = '';
        document.getElementById('emp-nombre').value = '';
        document.getElementById('emp-password').value = '';
        document.getElementById('emp-rol').value = 'empleado';
        document.getElementById('emp-tienda').value = '';
    },

    async cargarTiendasEnModal() {
        try {
            const rol = document.getElementById('emp-rol').value;
            const profile = window.authModel.getProfile();
            const tiendas = await window.productModel.fetchTiendas();
            const selectTienda = document.getElementById('emp-tienda');
            
            // 🔧 Usar flag confiable en lugar de detección frágil por correoInput vacío
            const esCreacion = this.isCreatingNewEmployee;
            
            selectTienda.innerHTML = '';
            
            // Administrador y Auxiliar: pueden asignar a cualquier tienda o "Todas"
            if (rol === 'administrador' || rol === 'auxiliar_administrativo') {
                const optionTodas = document.createElement('option');
                optionTodas.value = null;
                optionTodas.textContent = 'Todas las tiendas';
                optionTodas.selected = true;
                selectTienda.appendChild(optionTodas);
                selectTienda.disabled = true;
            } 
            // Franquiciado
            else if (rol === 'franquiciado') {
                // CREACIÓN: Admin elige qué tienda asignar al franquiciado
                if (esCreacion) {
                    const optionSelect = document.createElement('option');
                    optionSelect.value = '';
                    optionSelect.textContent = '-- Seleccionar tienda a asignar --';
                    optionSelect.selected = true;
                    selectTienda.appendChild(optionSelect);
                    
                    tiendas.forEach(t => {
                        const option = document.createElement('option');
                        option.value = t.nombre_tienda;
                        option.textContent = t.nombre_tienda;
                        selectTienda.appendChild(option);
                    });
                    selectTienda.disabled = false;
                } 
                // EDICIÓN: Franquiciado solo ve su tienda actual
                else {
                    const optionMiTienda = document.createElement('option');
                    optionMiTienda.value = profile.tienda_asignada;
                    optionMiTienda.textContent = `Mi Tienda: ${profile.tienda_asignada}`;
                    optionMiTienda.selected = true;
                    selectTienda.appendChild(optionMiTienda);
                    selectTienda.disabled = true;
                }
            }
            // Empleados
            else {
                // Para empleados, mostrar "Todas" como opción y lista de tiendas individuales
                const optionTodas = document.createElement('option');
                optionTodas.value = 'Todas';
                optionTodas.textContent = 'Todas las tiendas';
                selectTienda.appendChild(optionTodas);
                
                const optionDefault = document.createElement('option');
                optionDefault.value = '';
                optionDefault.textContent = '-- O seleccionar una tienda específica --';
                selectTienda.appendChild(optionDefault);
                
                tiendas.forEach(t => {
                    const option = document.createElement('option');
                    option.value = t.nombre_tienda;
                    option.textContent = t.nombre_tienda;
                    selectTienda.appendChild(option);
                });
                selectTienda.disabled = false;
            }
        } catch (e) {
            console.error("Error cargando tiendas:", e);
        }
    },

    actualizarVerTienda() {
        this.cargarTiendasEnModal();
    },

    async guardarEmpleado() {
        // Verificar que solo administrador pueda crear empleados
        if (!window.authModel.isAdmin()) {
            alert('❌ Acceso denegado: Solo el administrador puede crear empleados');
            return;
        }

        const correo = document.getElementById('emp-correo').value.trim().toLowerCase();
        const nombre = document.getElementById('emp-nombre').value.trim();
        const password = document.getElementById('emp-password').value.trim();
        const rol = document.getElementById('emp-rol').value;
        const tienda = document.getElementById('emp-tienda').value;

        // Validaciones
        if (!correo || !nombre || !password) {
            alert('Por favor completa Email, Nombre y Contraseña');
            return;
        }

        // Validar tienda para empleados y franquiciados nuevos
        if ((rol === 'empleado' || rol === 'franquiciado') && !tienda) {
            alert(`Por favor selecciona una tienda para este ${rol === 'franquiciado' ? 'Franquiciado' : 'Empleado'}`);
            return;
        }

        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo)) {
            alert('Por favor ingresa un email válido');
            return;
        }

        try {
            // Determinar tienda según rol
            const tiendaAsignada = (rol === 'administrador' || rol === 'auxiliar_administrativo') ? null : tienda;

            // 1. PRIMERO: Verificar si ya existe en Tabla De Perfiles
            const { data: existente, error: checkError } = await window._supabase
                .from('Tabla De Perfiles')
                .select('id, nombre_usuario')
                .ilike('nombre_usuario', correo);

            if (checkError) {
                console.error("Error verificando perfil:", checkError);
                window.ui.showNotify('❌ Error', 'No se pudo verificar si el email existe', 'error');
                return;
            }

            if (existente && existente.length > 0) {
                window.ui.showNotify('⚠️ Email duplicado', `El email ${correo} ya está registrado en el sistema`, 'error');
                return; // IMPORTANTE: Salir aquí sin continuar
            }

            // 2. Si no existe en Tabla De Perfiles, intentar crear en Auth
            const { data: authData, error: authError } = await window._supabase.auth.signUp({
                email: correo,
                password: password
            });

            if (authError) {
                const msg = (authError.message || '').toLowerCase();
                const code = authError.code || '';
                const isAlreadyRegistered = msg.includes('already') || code === 'user_already_exists';
                
                if (!isAlreadyRegistered) {
                    console.error("Error en Auth:", authError);
                    window.ui.showNotify('❌ Error', authError.message, 'error');
                    return;
                }
            }

            // 3. Si Auth fue exitoso o el usuario ya existía en Auth, crear el perfil
            const { error: profileError } = await window._supabase
                .from('Tabla De Perfiles')
                .insert([{
                    nombre_usuario: correo,
                    rol: rol.toLowerCase(),
                    tienda_asignada: tiendaAsignada,
                    activo: true,
                    sueldo_mensual: 0
                }]);

            if (profileError) {
                console.error("Error creando perfil:", profileError);
                window.ui.showNotify('❌ Error', 'No se pudo crear el perfil del empleado: ' + profileError.message, 'error');
                return;
            }

            // 4. Éxito total
            const tiendaDisplay = tiendaAsignada === null ? 'Todas las tiendas' : tiendaAsignada;
            window.ui.showNotify('✅ Éxito', `${rol.charAt(0).toUpperCase() + rol.slice(1)} creado: ${correo}`, 'success');
            
            this.cerrarModal();
            this.cargarEmpleados();
        } catch (e) {
            console.error("Error creando empleado:", e);
            window.ui.showNotify('❌ Error', e.message, 'error');
        }
    },

    async cargarEmpleados() {
        try {
            const empleados = await window.authModel.fetchAllProfiles();
            const listDiv = document.getElementById('lista-empleados-gestion');
            
            if (!listDiv) return;

            if (!empleados || empleados.length === 0) {
                listDiv.innerHTML = '<p class="text-muted text-center p-3">No hay empleados registrados</p>';
                return;
            }

            listDiv.innerHTML = empleados.map(emp => {
                const badgeRol = this.getBadgeRol(emp.rol);
                const btnEstado = emp.activo 
                    ? `<button class="btn btn-outline-danger btn-sm" onclick="window.employeeController.toggleEmpleadoEstado('${emp.id}', '${emp.nombre_usuario}', true)" title="Desactivar"><i class="bi bi-lock-fill"></i></button>`
                    : `<button class="btn btn-outline-success btn-sm" onclick="window.employeeController.toggleEmpleadoEstado('${emp.id}', '${emp.nombre_usuario}', false)" title="Activar"><i class="bi bi-unlock-fill"></i></button>`;
                
                return `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <div class="fw-bold text-dark">${emp.nombre_usuario}</div>
                                <small class="text-muted">
                                    ${badgeRol}
                                    <span class="ms-2 badge bg-info">${emp.tienda_asignada || 'Sin tienda'}</span>
                                    ${emp.activo ? '<span class="ms-2 badge bg-success">ACTIVO</span>' : '<span class="ms-2 badge bg-secondary">INACTIVO</span>'}
                                </small>
                            </div>
                            <div class="btn-group-sm" role="group">
                                ${btnEstado}
                                <button class="btn btn-outline-danger btn-sm" onclick="window.employeeController.eliminarEmpleado('${emp.id}', '${emp.nombre_usuario}')" title="Eliminar">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error("Error cargando empleados:", e);
        }
    },

    getBadgeRol(rol) {
        const rolLower = (rol || '').toLowerCase();
        if (rolLower === 'auxiliar_administrativo') {
            return '<span class="badge bg-warning text-dark">Auxiliar Administrativo</span>';
        } else if (rolLower === 'administrador') {
            return '<span class="badge bg-danger">Administrador</span>';
        } else if (rolLower === 'franquiciado') {
            return '<span class="badge bg-warning text-dark">Franquiciado</span>';
        } else {
            return '<span class="badge bg-success">Empleado</span>';
        }
    },

    async toggleEmpleadoEstado(id, nombre, estadoActual) {
        const nuevoEstado = !estadoActual;
        const textoEstado = nuevoEstado ? 'ACTIVAR' : 'DESACTIVAR';
        
        try {
            const { error } = await window._supabase
                .from('Tabla De Perfiles')
                .update({ activo: nuevoEstado })
                .eq('nombre_usuario', nombre);

            if (error) throw error;

            alert(`✅ Empleado ${textoEstado === 'ACTIVAR' ? 'activado' : 'desactivado'}`);
            this.cargarEmpleados();
        } catch (e) {
            alert(`❌ Error: ${e.message}`);
        }
    },

    async eliminarEmpleado(id, nombre) {
        try {
            
            if (!nombre) {
                throw new Error('Nombre de empleado no válido');
            }

            // Usar nombre_usuario para el DELETE ya que id puede estar restringido por RLS
            const { error } = await window._supabase
                .from('Tabla De Perfiles')
                .delete()
                .eq('nombre_usuario', nombre);

            if (error) {
                console.error('❌ Error en delete:', error);
                throw error;
            }

            alert(`✅ Empleado ${nombre} eliminado`);
            this.cargarEmpleados();
        } catch (e) {
            console.error('❌ Error al eliminar empleado:', e);
            alert(`❌ Error: ${e.message}`);
        }
    }
};

window.employeeController = employeeController;
