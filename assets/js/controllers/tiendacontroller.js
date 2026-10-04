const tiendaController = {
    init() {
        const profile = window.authModel.getProfile();
        const rol = profile.rol.toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        const isFranquiciado = rol === 'franquiciado';
        
        if (!isAdmin && !isFranquiciado) {
            console.warn('Acceso denegado: Solo administrador o franquiciado pueden gestionar tiendas');
            return;
        }
        
        this.bindEvents(isAdmin, isFranquiciado);
        this.cargarTiendas(isAdmin, isFranquiciado);
    },

    bindEvents(isAdmin, isFranquiciado) {
        // Solo Admin puede agregar tiendas
        const btnAddTienda = document.getElementById('btn-add-tienda');
        if (btnAddTienda) {
            btnAddTienda.style.display = isAdmin ? 'block' : 'none';
            if (isAdmin) {
                btnAddTienda.addEventListener('click', () => this.showModalAgregarTienda(isAdmin, isFranquiciado));
            }
        }

        const btnConfirm = document.getElementById('btn-confirm-tienda');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => this.guardarTienda(isAdmin, isFranquiciado));
        }

        const btnCancel = document.getElementById('btn-cancel-tienda');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cerrarModal());
        }
    },

    showModalAgregarTienda(isAdmin, isFranquiciado) {
        if (!isAdmin) {
            alert('❌ Acceso denegado: Solo el administrador puede crear tiendas');
            return;
        }
        
        const modal = document.getElementById('modal-tienda');
        modal.style.display = 'flex';
        this.limpiarFormulario();
        window.appController?.focusFirstElementInModal?.(modal);
    },

    cerrarModal() {
        document.getElementById('modal-tienda').style.display = 'none';
        this.limpiarFormulario();
    },

    limpiarFormulario() {
        document.getElementById('tienda-nombre').value = '';
        document.getElementById('tienda-direccion').value = '';
    },

    async guardarTienda(isAdmin, isFranquiciado) {
        // Verificar que solo administrador pueda crear tiendas
        if (!isAdmin) {
            alert('❌ Acceso denegado: Solo el administrador puede crear tiendas');
            return;
        }

        const nombre = document.getElementById('tienda-nombre').value.trim().toUpperCase();
        const direccion = document.getElementById('tienda-direccion').value.trim();

        // Validaciones
        if (!nombre) {
            alert('Por favor ingresa el nombre de la tienda');
            return;
        }


        if (nombre.length < 3) {
            alert('El nombre de la tienda debe tener al menos 3 caracteres');
            return;
        }

        try {
            // Obtener todas las tiendas y validar en cliente (esto evita problemas con ilike)
            const { data: todasTiendas, error: fetchError } = await window._supabase
                .from('Tienda de Sucursal')
                .select('nombre_tienda');
            
            if (fetchError) throw fetchError;

            // Validar sin case-sensitive
            const nombreNormalizado = nombre.toUpperCase().trim();
            const tiendaExiste = todasTiendas?.some(t => 
                t.nombre_tienda.toUpperCase().trim() === nombreNormalizado
            );

            if (tiendaExiste) {
                alert('❌ Esta tienda ya existe en el sistema');
                return;
            }

            // Crear la tienda (usar nombre original, sin mayúsculas para mantener consistencia)
            const { error: tiendaError } = await window._supabase
                .from('Tienda de Sucursal')
                .insert([{
                    nombre_tienda: document.getElementById('tienda-nombre').value.trim(),
                    direccion: direccion
                }]);

            if (tiendaError) {
                console.error("Error creando tienda:", tiendaError);
                if (tiendaError.code === '23505') {
                    alert('❌ Esta tienda ya existe en el sistema');
                } else {
                    throw tiendaError;
                }
                return;
            }

            alert(`✅ Tienda creada exitosamente: ${document.getElementById('tienda-nombre').value.trim()}`);
            
            this.cerrarModal();
            
            // Recargar lista de tiendas y actualizar selectores
            await window.productModel.fetchTiendas();
            this.cargarTiendas(isAdmin, isFranquiciado);
            
            // Actualizar selectores en empleados si existen
            if (window.employeeController) {
                await window.employeeController.cargarTiendasEnModal();
            }
            
            // Actualizar selector de tiendas en inventario y recargar datos
            if (window.inventoryController) {
                const tiendas = await window.productModel.fetchTiendas();
                window.inventoryController.populateTiendas(tiendas);
                // Recargar el inventario para la nueva tienda
                window.inventoryController.renderTable('todos');
            }

        } catch (e) {
            console.error("Error al crear tienda:", e);
            alert(`❌ Error: ${e.message || 'No se pudo crear la tienda'}`);
        }
    },

    async cargarTiendas(isAdmin, isFranquiciado) {
        const tbTiendas = document.getElementById('lista-tiendas');
        const profile = window.authModel.getProfile();
        
        try {
            let tiendas = await window.productModel.fetchTiendas();
            
            // Si es Franquiciado, solo mostrar su tienda asignada
            if (isFranquiciado && !isAdmin) {
                tiendas = tiendas.filter(t => t.nombre_tienda === profile.tienda_asignada);
            }
            
            tbTiendas.innerHTML = '';

            if (!tiendas || tiendas.length === 0) {
                tbTiendas.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #9ca3af;">
                        <div><i class="bi bi-inbox" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i></div>
                        <span>No hay tiendas registradas.</span>
                    </div>
                `;
                return;
            }

            tiendas.forEach(tienda => {
                const tiendaItem = document.createElement('div');
                tiendaItem.className = 'tienda-card';
                
                const direccionEditable = isAdmin ? 'contenteditable="true"' : '';
                const direccionPlaceholder = isAdmin ? 'data-placeholder="Haz clic para editar la dirección..."' : '';
                const nombreEditable = isAdmin ? 'contenteditable="true"' : '';
                
                tiendaItem.innerHTML = `
                    <div class="tienda-card-content">
                        <div class="tienda-nombre-wrapper">
                            <div class="tienda-icon"><i class="bi bi-shop"></i></div>
                            <div class="tienda-info">
                                <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                                    <h4 class="tienda-nombre" ${nombreEditable} data-original="${tienda.nombre_tienda}" style="${isAdmin ? 'cursor: pointer; padding: 8px; border-radius: 6px; flex: 1; margin: 0;' : 'margin: 0;'}">${tienda.nombre_tienda}</h4>
                                    ${isAdmin ? `<div style="display: flex; gap: 6px;">
                                        <button class="btn-tienda-edit" title="Editar nombre" style="background: none; border: none; color: #7c3aed; cursor: pointer; padding: 4px 6px; font-size: 1.1rem;">
                                            <i class="bi bi-pencil-square"></i>
                                        </button>
                                        <button class="btn-tienda-delete" title="Eliminar tienda" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px 6px; font-size: 1.1rem;">
                                            <i class="bi bi-trash3"></i>
                                        </button>
                                    </div>` : ''}
                                </div>
                                <div class="tienda-direccion-label">Dirección:</div>
                                <div ${direccionEditable} class="direccion-editable" data-tienda="${tienda.nombre_tienda}" ${direccionPlaceholder}>${tienda.direccion || 'Sin dirección'}</div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Si es admin, agregar eventos para editar dirección y nombre
                if (isAdmin) {
                    const dirDiv = tiendaItem.querySelector('.direccion-editable');
                    const nombreDiv = tiendaItem.querySelector('.tienda-nombre');
                    const btnEdit = tiendaItem.querySelector('.btn-tienda-edit');
                    const btnDelete = tiendaItem.querySelector('.btn-tienda-delete');
                    
                    // Evento para editar dirección
                    dirDiv.addEventListener('blur', () => {
                        const nuevaDireccion = dirDiv.textContent.trim() || '';
                        const nombreTienda = tienda.nombre_tienda;
                        if (nuevaDireccion !== (tienda.direccion || '')) {
                            window.tiendaController.actualizarDireccionTienda(nombreTienda, nuevaDireccion);
                        }
                    });
                    dirDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            dirDiv.blur();
                        }
                    });
                    dirDiv.addEventListener('focus', function() {
                        this.style.outline = '2px solid #7c3aed';
                    });
                    dirDiv.addEventListener('blur', function() {
                        this.style.outline = 'none';
                    });
                    
                    // Evento para editar nombre (clic en el botón editar)
                    btnEdit.addEventListener('click', () => {
                        nombreDiv.contentEditable = 'true';
                        nombreDiv.focus();
                        nombreDiv.style.outline = '2px solid #7c3aed';
                        nombreDiv.style.backgroundColor = '#f0f4ff';
                    });
                    
                    // Guardar nombre cuando pierde el foco o presiona Enter
                    nombreDiv.addEventListener('blur', () => {
                        nombreDiv.contentEditable = 'false';
                        nombreDiv.style.outline = 'none';
                        nombreDiv.style.backgroundColor = 'transparent';
                        
                        const nuevoNombre = nombreDiv.textContent.trim();
                        if (nuevoNombre && nuevoNombre !== tienda.nombre_tienda) {
                            window.tiendaController.actualizarNombreTienda(tienda.nombre_tienda, nuevoNombre);
                        } else {
                            nombreDiv.textContent = tienda.nombre_tienda;
                        }
                    });
                    
                    nombreDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            nombreDiv.blur();
                        }
                    });
                    
                    // Evento para eliminar tienda
                    btnDelete.addEventListener('click', () => {
                        if (confirm(`¿Estás seguro de que deseas eliminar la tienda "${tienda.nombre_tienda}"?`)) {
                            window.tiendaController.eliminarTienda(tienda.nombre_tienda);
                        }
                    });
                }
                
                tbTiendas.appendChild(tiendaItem);
            });

        } catch (e) {
            console.error("Error cargando tiendas:", e);
            tbTiendas.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #dc2626;">
                    <div><i class="bi bi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i></div>
                    <span>Error al cargar tiendas</span>
                </div>
            `;
        }
    },

    async eliminarTienda(nombre) {
        // Verificar que solo administrador pueda eliminar tiendas
        if (!window.authModel.isAdmin()) {
            alert('❌ Acceso denegado: Solo el administrador puede eliminar tiendas');
            return;
        }

        try {
            const { error } = await window._supabase
                .from('Tienda de Sucursal')
                .delete()
                .eq('nombre_tienda', nombre);

            if (error) throw error;

            alert(`✅ Tienda "${nombre}" eliminada correctamente`);
            
            // Recargar lista
            await window.productModel.fetchTiendas();
            this.cargarTiendas();

            // Actualizar selectores
            if (window.employeeController) {
                await window.employeeController.cargarTiendasEnModal();
            }
            
            if (window.inventoryController) {
                const tiendas = await window.productModel.fetchTiendas();
                window.inventoryController.populateTiendas(tiendas);
            }

        } catch (e) {
            alert(`❌ Error: ${e.message || 'No se pudo eliminar la tienda'}`);
        }
    }
,

    async actualizarDireccionTienda(nombreTienda, nuevaDireccion) {
        try {
            const { error } = await window._supabase
                .from('Tienda de Sucursal')
                .update({ direccion: nuevaDireccion })
                .eq('nombre_tienda', nombreTienda);

            if (error) {
                console.error("Error actualizando dirección:", error);
                alert('❌ Error al actualizar la dirección');
                return;
            }

            window.ui.showNotify(`✅ Dirección de ${nombreTienda} actualizada correctamente`, 'success');
            
            // Recargar tiendas
            const roleProfile = window.authModel.getProfile();
            const rol = roleProfile.rol.toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            const isFranquiciado = rol === 'franquiciado';
            
            this.cargarTiendas(isAdmin, isFranquiciado);
        } catch (e) {
            console.error("Error:", e);
            alert(`❌ Error: ${e.message}`);
        }
    },

    async actualizarNombreTienda(nombreActual, nuevoNombre) {
        try {
            // Verificar que solo administrador pueda actualizar nombres
            if (!window.authModel.isAdmin()) {
                alert('❌ Acceso denegado: Solo el administrador puede editar nombres de tiendas');
                return;
            }

            // Verificar que no haya otra tienda con el mismo nombre
            const { data: existentes } = await window._supabase
                .from('Tienda de Sucursal')
                .select('nombre_tienda')
                .eq('nombre_tienda', nuevoNombre);

            if (existentes && existentes.length > 0) {
                alert('❌ Ya existe una tienda con ese nombre');
                return;
            }

            // Actualizar nombre en la BD
            const { error } = await window._supabase
                .from('Tienda de Sucursal')
                .update({ nombre_tienda: nuevoNombre })
                .eq('nombre_tienda', nombreActual);

            if (error) {
                console.error("Error actualizando nombre:", error);
                alert('❌ Error al actualizar el nombre de la tienda');
                return;
            }

            // Actualizar referencias en otras tablas
            // Actualizar en Emplea si existen
            await window._supabase
                .from('Emplea')
                .update({ tienda_asignada: nuevoNombre })
                .eq('tienda_asignada', nombreActual);

            // Actualizar en Producto si existen
            await window._supabase
                .from('Producto')
                .update({ tienda : nuevoNombre })
                .eq('tienda', nombreActual);

            window.ui.showNotify(`✅ Nombre de tienda actualizado a "${nuevoNombre}"`, 'success');
            
            // Recargar tiendas
            const roleProfile = window.authModel.getProfile();
            const rol = roleProfile.rol.toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            const isFranquiciado = rol === 'franquiciado';
            
            this.cargarTiendas(isAdmin, isFranquiciado);
        } catch (e) {
            console.error("Error:", e);
            alert(`❌ Error: ${e.message}`);
        }
    }
};

window.tiendaController = tiendaController;
