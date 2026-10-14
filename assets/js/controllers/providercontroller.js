const providerController = {
    draftEmails: [],

    async init() {
        await this.cargarProveedores();
        this.cargarTiendasAsignacion();
        this.bindEvents();
    },

    _getTiendaSeleccionada() {
        const select = document.getElementById('tiendaSelect');
        const val = select?.value || 'todas';
        const profile = window.authModel?.getProfile?.() || {};
        const rol = (profile.rol || '').toLowerCase().trim();
        if (rol === 'franquiciado' && profile.tienda_asignada && profile.tienda_asignada !== 'Todas') {
            return profile.tienda_asignada;
        }
        return val;
    },

    _renderEmailBadges(emails = []) {
        if (!emails.length) return '<span class="text-muted">-</span>';
        return emails.map(email => `<span class="badge bg-light text-dark border me-1 mb-1">${email}</span>`).join('');
    },

    _renderSimpleText(value) {
        const texto = String(value || '').trim();
        return texto || '<span class="text-muted">-</span>';
    },

    _renderTiendasBadge(prov) {
        if (prov.all_tiendas !== false) {
            return '<span class="badge bg-primary-subtle text-primary-emphasis border">Todas</span>';
        }

        const tiendas = Array.isArray(prov.tiendas_asignadas) ? prov.tiendas_asignadas : [];
        if (!tiendas.length) {
            return '<span class="badge bg-secondary">Sin asignar</span>';
        }

        return tiendas.map(t => `<span class="badge bg-info text-dark me-1 mb-1">${t}</span>`).join('');
    },

    cargarTiendasAsignacion() {
        const contenedor = document.getElementById('nuevo-proveedor-tiendas-lista');
        if (!contenedor) return;

        const tiendas = Array.isArray(window.productModel?.tiendas)
            ? window.productModel.tiendas
            : [];

        contenedor.innerHTML = tiendas.length
            ? tiendas.map(t => {
                const nombre = String(t.nombre_tienda || '').trim();
                return `
                    <div class="form-check form-check-inline me-3 mb-1">
                        <input class="form-check-input chk-nueva-tienda-proveedor" type="checkbox" value="${nombre}" id="chk-prov-${nombre.replace(/\s+/g, '-')}">
                        <label class="form-check-label small" for="chk-prov-${nombre.replace(/\s+/g, '-')}">${nombre}</label>
                    </div>
                `;
            }).join('')
            : '<small class="text-muted">No hay tiendas cargadas.</small>';
    },

    _getNuevaAsignacionTiendas() {
        const modo = document.getElementById('nuevo-proveedor-asignacion')?.value || 'todas';
        if (modo === 'todas') {
            return { all_tiendas: true, tiendas_asignadas: [] };
        }

        const seleccionadas = Array.from(document.querySelectorAll('.chk-nueva-tienda-proveedor:checked'))
            .map(chk => chk.value);

        return {
            all_tiendas: false,
            tiendas_asignadas: seleccionadas
        };
    },

    _parseEmails(raw) {
        return [...new Set(String(raw || '')
            .split(/[;,\n]/)
            .map(v => v.trim().toLowerCase())
            .filter(Boolean))];
    },

    _syncDraftEmailsToTextarea() {
        const textarea = document.getElementById('input-nuevo-proveedor-emails');
        if (textarea) textarea.value = this.draftEmails.join(', ');
    },

    _renderDraftEmails() {
        const container = document.getElementById('nuevo-proveedor-emails-lista');
        if (!container) return;

        if (!this.draftEmails.length) {
            container.innerHTML = '<small class="text-muted">Sin correos agregados</small>';
            return;
        }

        container.innerHTML = this.draftEmails.map((email, idx) => `
            <span class="badge bg-light text-dark border me-2 mb-2">
                ${email}
                <button type="button" class="btn btn-sm p-0 ms-2 text-danger btn-remove-email-proveedor" data-index="${idx}" style="line-height:1;">
                    <i class="bi bi-x-circle"></i>
                </button>
            </span>
        `).join('');

        container.querySelectorAll('.btn-remove-email-proveedor').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = Number(btn.dataset.index);
                if (Number.isInteger(index) && index >= 0) {
                    this.draftEmails.splice(index, 1);
                    this._syncDraftEmailsToTextarea();
                    this._renderDraftEmails();
                }
            });
        });
    },

    agregarEmailDraft() {
        const input = document.getElementById('input-nuevo-proveedor-email-item');
        if (!input) return;

        const nuevos = this._parseEmails(input.value);
        if (!nuevos.length) return;

        this.draftEmails = [...new Set([...this.draftEmails, ...nuevos])];
        input.value = '';
        this._syncDraftEmailsToTextarea();
        this._renderDraftEmails();
    },

    async cargarProveedores() {
        try {
            await window.providerModel.fetchProveedores();
            this.renderTablaProveedores();
        } catch (err) {
            console.error('Error cargando proveedores:', err);
            window.ui.showNotify('❌ Error al cargar proveedores', 'error');
        }
    },

    renderTablaProveedores() {
        const tbody = document.getElementById('tbody-proveedores');
        if (!tbody) return;

        const tiendaSeleccionada = this._getTiendaSeleccionada();
        const proveedores = window.providerModel.getProveedores(false, tiendaSeleccionada);

        if (proveedores.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        No hay proveedores registrados
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = proveedores.map(prov => `
            <tr>
                <td><strong>${prov.nombre}</strong></td>
                <td>${this._renderSimpleText(prov.cif_empresa)}</td>
                <td>${this._renderSimpleText(prov.direccion)}</td>
                <td>${this._renderEmailBadges(prov.emails || [])}</td>
                <td>${this._renderTiendasBadge(prov)}</td>
                <td>
                    <span class="badge ${prov.activo ? 'bg-success' : 'bg-danger'}">
                        ${prov.activo ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                </td>
                <td class="text-nowrap">
                    <div class="d-inline-flex gap-1 flex-wrap">
                        <button class="btn btn-sm btn-info" style="padding: 3px 8px; font-size: 0.8rem;"
                                onclick="providerController.abrirEditarProveedor(${prov.id}, '${prov.nombre.replace(/'/g, "\\'")}')">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-sm ${prov.activo ? 'btn-warning' : 'btn-success'}" style="padding: 3px 8px; font-size: 0.8rem;"
                                onclick="providerController.toggleStatus(${prov.id}, ${!prov.activo})">
                            ${prov.activo ? '❌ Desactivar' : '✓ Activar'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    abrirModalProveedor() {
        const modal = document.getElementById('modal-nuevo-proveedor');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('input-nuevo-proveedor').value = '';
            document.getElementById('input-nuevo-proveedor-cif').value = '';
            document.getElementById('input-nuevo-proveedor-direccion').value = '';
            document.getElementById('input-nuevo-proveedor-telefono').value = '';
            document.getElementById('input-nuevo-proveedor-email-item').value = '';
            document.getElementById('input-nuevo-proveedor-emails').value = '';
            const asignacion = document.getElementById('nuevo-proveedor-asignacion');
            if (asignacion) asignacion.value = 'todas';
            document.querySelectorAll('.chk-nueva-tienda-proveedor').forEach(chk => {
                chk.checked = false;
            });
            this.draftEmails = [];
            this._renderDraftEmails();
            document.getElementById('input-nuevo-proveedor').focus();
            window.appController?.focusFirstElementInModal?.(modal);
        }
    },

    cerrarModalProveedor() {
        const modal = document.getElementById('modal-nuevo-proveedor');
        if (modal) modal.style.display = 'none';
    },

    async crearProveedor() {
        const nombre = document.getElementById('input-nuevo-proveedor').value.trim();
        const cifEmpresa = document.getElementById('input-nuevo-proveedor-cif')?.value?.trim() || '';
        const direccion = document.getElementById('input-nuevo-proveedor-direccion')?.value?.trim() || '';
        const telefono = document.getElementById('input-nuevo-proveedor-telefono')?.value?.trim() || '';
        const emailsRaw = document.getElementById('input-nuevo-proveedor-emails')?.value || '';
        const emails = [...new Set([...this.draftEmails, ...this._parseEmails(emailsRaw)])];
        const assignment = this._getNuevaAsignacionTiendas();

        if (!nombre) {
            window.ui.showNotify('❌ Por favor ingresa el nombre del proveedor', 'error');
            document.getElementById('input-nuevo-proveedor').focus();
            return;
        }

        if (!assignment.all_tiendas && assignment.tiendas_asignadas.length === 0) {
            window.ui.showNotify('❌ Selecciona al menos una tienda o usa "Todas".', 'error');
            return;
        }

        try {
            const btnConfirm = document.getElementById('btn-crear-proveedor');
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Creando...';

            await window.providerModel.insertProveedor(nombre, emails, true, assignment, {
                cif_empresa: cifEmpresa,
                direccion,
                telefono
            });

            window.ui.showNotify(`✅ Proveedor "${nombre}" creado exitosamente`, 'success');

            this.cerrarModalProveedor();
            this.renderTablaProveedores();

            // Actualizar producto dropdown
            this.actualizarDropdownProductos();

            btnConfirm.disabled = false;
            btnConfirm.innerHTML = '<i class="bi bi-check-circle me-2"></i>Crear Proveedor';
        } catch (err) {
            console.error('Error al crear proveedor:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'error');
            document.getElementById('btn-crear-proveedor').disabled = false;
            document.getElementById('btn-crear-proveedor').innerHTML = '<i class="bi bi-check-circle me-2"></i>Crear Proveedor';
        }
    },

    async toggleStatus(proveedorId, nuevoEstado) {
        try {
            const tienda = this._getTiendaSeleccionada();
            const isTodas = !tienda || tienda === 'todas' || tienda.toLowerCase() === 'todas las tiendas';

            if (!isTodas) {
                const prov = window.providerModel.getProveedores().find(p => String(p.id) === String(proveedorId));
                if (prov) {
                    let tiendas = Array.isArray(prov.tiendas_asignadas) ? [...prov.tiendas_asignadas] : [];
                    if (prov.all_tiendas !== false) {
                        const todasTiendas = (window.productModel.tiendas || []).map(t => t.nombre_tienda);
                        tiendas = nuevoEstado ? todasTiendas : todasTiendas.filter(t => t !== tienda);
                    } else {
                        if (!nuevoEstado) {
                            tiendas = tiendas.filter(t => t !== tienda);
                        } else {
                            if (!tiendas.includes(tienda)) tiendas.push(tienda);
                        }
                    }

                    await window.providerModel.updateProveedorDatos(proveedorId, {
                        all_tiendas: false,
                        tiendas_asignadas: tiendas
                    });

                    window.ui.showNotify(`✅ Proveedor ${nuevoEstado ? 'activado' : 'desactivado'} para la tienda ${tienda}`, 'success');
                    this.renderTablaProveedores();
                    if (window.inventoryController) {
                        await window.productModel.fetchProductos();
                        window.inventoryController.renderTable();
                    }
                    return;
                }
            }

            await window.providerModel.toggleProveedorStatus(proveedorId, nuevoEstado);
            window.ui.showNotify(
                `✅ Proveedor ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`,
                'success'
            );
            this.renderTablaProveedores();

            // Recargar productos para que se filtren correctamente
            if (window.inventoryController) {
                await window.productModel.fetchProductos();
                window.inventoryController.renderTable();
            }
        } catch (err) {
            console.error('Error toggling proveedor:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'error');
        }
    },

    async eliminarProveedor(proveedorId) {
        if (!confirm('¿Estás seguro de que deseas eliminar este proveedor?')) {
            return;
        }

        try {
            await window.providerModel.deleteProveedor(proveedorId);
            window.ui.showNotify('✅ Proveedor eliminado exitosamente', 'success');
            this.renderTablaProveedores();

            // Recargar productos
            if (window.inventoryController) {
                await window.productModel.fetchProductos();
                window.inventoryController.renderTable();
            }
        } catch (err) {
            console.error('Error eliminando proveedor:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'error');
        }
    },

    actualizarDropdownProductos() {
        const provSelect = document.getElementById('prod-proveedor');
        if (provSelect) {
            const tienda = this._getTiendaSeleccionada();
            const proveedores = window.providerModel.getProveedoresPorNombre(true, tienda);
            const opciones = proveedores
                .map(p => `<option value="${p}">${p}</option>`)
                .join('');
            provSelect.innerHTML = `<option value="">Seleccionar proveedor...</option>${opciones}`;
        }
    },

    abrirEditarProveedor(proveedorId, nombreActual) {
        const proveedor = window.providerModel.getProveedores().find(p => String(p.id) === String(proveedorId));
        const emailsActuales = Array.isArray(proveedor?.emails) ? proveedor.emails : [];

        const nuevoNombre = prompt(`Editar nombre del proveedor:\n\n(Actual: ${nombreActual})`, nombreActual);
        if (nuevoNombre === null) return; // Cancelado
        
        const nuevoNombreTrimmed = nuevoNombre.trim();
        if (!nuevoNombreTrimmed) {
            window.ui.showNotify('❌ El nombre del proveedor no puede estar vacío', 'error');
            return;
        }

        const correosPrompt = prompt(
            `Editar correos del proveedor (separados por coma):\n\nActuales: ${emailsActuales.join(', ') || 'Sin correos'}`,
            emailsActuales.join(', ')
        );
        if (correosPrompt === null) return;
        const nuevosEmails = this._parseEmails(correosPrompt);

        const cifPrompt = prompt(
            `Editar CIF de empresa (opcional):\n\nActual: ${proveedor?.cif_empresa || 'Sin CIF'}`,
            proveedor?.cif_empresa || ''
        );
        if (cifPrompt === null) return;

        const direccionPrompt = prompt(
            `Editar dirección (opcional):\n\nActual: ${proveedor?.direccion || 'Sin dirección'}`,
            proveedor?.direccion || ''
        );
        if (direccionPrompt === null) return;

        const telefonoPrompt = prompt(
            `Editar número de teléfono (opcional):\n\nActual: ${proveedor?.telefono || 'Sin teléfono'}`,
            proveedor?.telefono || ''
        );
        if (telefonoPrompt === null) return;

        const todasTiendasActual = proveedor?.all_tiendas !== false;
        const aplicaTodas = confirm(`Asignacion de tiendas para ${nuevoNombreTrimmed}:\nAceptar = Todas las tiendas\nCancelar = Tiendas especificas`);
        let tiendasAsignadas = proveedor?.tiendas_asignadas || [];
        let allTiendas = aplicaTodas;

        if (!aplicaTodas) {
            const tiendasRaw = prompt(
                'Escribe las tiendas separadas por coma para este proveedor:',
                (tiendasAsignadas || []).join(', ')
            );
            if (tiendasRaw === null) return;
            tiendasAsignadas = String(tiendasRaw)
                .split(',')
                .map(v => v.trim())
                .filter(Boolean);
            if (!tiendasAsignadas.length) {
                window.ui.showNotify('❌ Debes asignar al menos una tienda.', 'error');
                return;
            }
        }

        if (nuevoNombreTrimmed === nombreActual
            && JSON.stringify(nuevosEmails) === JSON.stringify(emailsActuales)
            && allTiendas === todasTiendasActual
            && JSON.stringify(tiendasAsignadas) === JSON.stringify(proveedor?.tiendas_asignadas || [])
            && String(cifPrompt || '').trim() === String(proveedor?.cif_empresa || '').trim()
            && String(direccionPrompt || '').trim() === String(proveedor?.direccion || '').trim()
            && String(telefonoPrompt || '').trim() === String(proveedor?.telefono || '').trim()) {
            return;
        }

        this.guardarEditarProveedor(proveedorId, nombreActual, nuevoNombreTrimmed, nuevosEmails, {
            all_tiendas: allTiendas,
            tiendas_asignadas: tiendasAsignadas,
            cif_empresa: String(cifPrompt || '').trim(),
            direccion: String(direccionPrompt || '').trim(),
            telefono: String(telefonoPrompt || '').trim()
        });
    },

    async guardarEditarProveedor(proveedorId, nombreAnterior, nuevoNombre, nuevosEmails = [], assignment = { all_tiendas: true, tiendas_asignadas: [] }) {
        try {
            // Actualizar en providerModel
            await window.providerModel.updateProveedorDatos(proveedorId, {
                nombre: nuevoNombre,
                emails: nuevosEmails,
                all_tiendas: assignment.all_tiendas,
                tiendas_asignadas: assignment.tiendas_asignadas,
                cif_empresa: assignment.cif_empresa || '',
                direccion: assignment.direccion || '',
                telefono: assignment.telefono || ''
            });

            // Actualizar todos los productos que tengan este proveedor
            const productosConProveedor = window.productModel.productosBase.filter(p => p.proveedor === nombreAnterior);
            for (const producto of productosConProveedor) {
                const { error } = await window._supabase
                    .from('productos')
                    .update({ proveedor: nuevoNombre })
                    .eq('id', producto.id);

                if (error) {
                    console.warn(`⚠️ Error actualizando producto ${producto.producto}:`, error);
                } else {
                    producto.proveedor = nuevoNombre;
                }
            }

            // Actualizar stock faltante si está cargado
            if (window.stockFaltanteController) {
                await window.stockFaltanteController.cargarPedidos();
            }

            window.ui.showNotify(`✅ Proveedor "${nombreAnterior}" renombrado a "${nuevoNombre}"`, 'success');
            this.renderTablaProveedores();
            this.actualizarDropdownProductos();

        } catch (err) {
            console.error('Error al editar proveedor:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'error');
        }
    },

    bindEvents() {
        // Botón para abrir modal
        const btnNuevoProveedor = document.getElementById('btn-nuevo-proveedor');
        if (btnNuevoProveedor) {
            btnNuevoProveedor.addEventListener('click', () => this.abrirModalProveedor());
        }

        // Botones del modal
        const btnCancel = document.getElementById('btn-cancel-proveedor');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => this.cerrarModalProveedor());
        }

        const btnConfirm = document.getElementById('btn-crear-proveedor');
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => this.crearProveedor());
        }

        const btnAddEmail = document.getElementById('btn-add-email-proveedor');
        if (btnAddEmail) {
            btnAddEmail.addEventListener('click', () => this.agregarEmailDraft());
        }

        const inputEmailItem = document.getElementById('input-nuevo-proveedor-email-item');
        if (inputEmailItem) {
            inputEmailItem.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.agregarEmailDraft();
                }
            });
        }

        const asignacionSelect = document.getElementById('nuevo-proveedor-asignacion');
        if (asignacionSelect) {
            asignacionSelect.addEventListener('change', () => {
                const isEspecifica = asignacionSelect.value === 'especificas';
                const wrapper = document.getElementById('nuevo-proveedor-tiendas-wrapper');
                if (wrapper) {
                    wrapper.style.display = isEspecifica ? 'block' : 'none';
                }
            });
        }

        // Cerrar modal al hacer click en overlay
        const modal = document.getElementById('modal-nuevo-proveedor');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.cerrarModalProveedor();
            });
        }

        // Enter en input abre modal
        const input = document.getElementById('input-nuevo-proveedor');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.crearProveedor();
            });
        }

        const tiendaSelect = document.getElementById('tiendaSelect');
        if (tiendaSelect) {
            tiendaSelect.addEventListener('change', () => {
                this.renderTablaProveedores();
                this.actualizarDropdownProductos();
            });
        }
    }
};

window.providerController = providerController;
