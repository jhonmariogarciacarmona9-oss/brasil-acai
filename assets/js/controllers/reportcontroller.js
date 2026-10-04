const reportController = {
    tbody: null,
    txtTotal: null,
    currentMode: 'historial',

    bindEvents() {
        if (!this.tbody) this.tbody = document.getElementById('listaReporte');
        if (!this.txtTotal) this.txtTotal = document.getElementById('txt-total-global');

        const provSelect = document.getElementById('provReporteSelect');
        if (provSelect) {
            // Remover listener anterior si existe para evitar duplicados
            const newProvSelect = provSelect.cloneNode(true);
            provSelect.parentNode.replaceChild(newProvSelect, provSelect);
            
            // Vincular evento al nuevo elemento
            document.getElementById('provReporteSelect').addEventListener('change', (e) => {
                this.renderReportes();
            });
        }

        const dateSelect = document.getElementById('fechaReporteSelect');
        if (dateSelect) {
            // Sin fecha por defecto: mostrar todos los pedidos al abrir
            dateSelect.value = '';
            dateSelect.addEventListener('change', () => this.renderReportes());
        }
    },

    async cargarReportes(mode) {
        if (!this.tbody) this.tbody = document.getElementById('listaReporte');
        
        // Validar acceso a modo financiero: solo Admin
        if (mode === 'financiero') {
            const profile = window.authModel.getProfile();
            const rol = profile.rol.toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            const isFranquiciado = rol === 'franquiciado';
            
            if (!isAdmin && !isFranquiciado) {
                console.warn('⛔ Acceso denegado: Solo Admin y Franquiciado pueden ver reportes financieros');
                window.ui.showNotify('No tienes permisos para acceder a reportes financieros', 'danger');
                this.currentMode = 'historial'; // Forzar vuelta a historial
                return;
            }
        }
        
        this.tbody.innerHTML = "<tr><td colspan='9' class='text-center'>Cargando datos...</td></tr>";
        try {
            if (mode) this.currentMode = mode;
            await window.orderModel.fetchReportes(true);
            this.renderReportes();
        } catch (e) {
            this.tbody.innerHTML = "<tr><td colspan='9' class='text-center text-danger'>Error al cargar reporte.</td></tr>";
        }
    },

    // FIXED: Parseo robusto de fecha — retorna YYYY-MM-DD
    extractYMD(fechaStr) {
        if (!fechaStr) return '';
        const raw = String(fechaStr).trim();

        // Si empieza por YYYY-MM-DD, usar esa parte sin pasar por Date.
        // Esto evita desfases de zona horaria con timestamps ISO en UTC.
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);

        try {
            const date = new Date(raw);
            if (isNaN(date.getTime())) return raw.substring(0, 10);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return raw.substring(0, 10);
        }
    },

    renderReportes() {
        if (!this.tbody) this.tbody = document.getElementById('listaReporte');
        if (!this.txtTotal) this.txtTotal = document.getElementById('txt-total-global');

        const isFinanciero = this.currentMode === 'financiero';
        const panelResumen = document.getElementById('panel-resumen-financiero');
        if (panelResumen) panelResumen.style.display = isFinanciero ? 'flex' : 'none';
        document.querySelectorAll('.col-coste').forEach(el => el.style.display = isFinanciero ? 'table-cell' : 'none');
        document.querySelectorAll('.col-responsable').forEach(el => {
            if (isFinanciero) {
                el.style.display = 'none';
                el.style.width = '0';
                el.style.padding = '0';
                el.style.border = '0';
                el.style.visibility = 'collapse';
            } else {
                el.style.display = 'table-cell';
                el.style.width = '';
                el.style.padding = '';
                el.style.border = '';
                el.style.visibility = 'visible';
            }
        });

        const tiendaFiltro = document.getElementById('tiendaSelect').value;
        const provFiltro = document.getElementById('provReporteSelect').value;
        const fechaFiltro = document.getElementById('fechaReporteSelect').value;

        let pedidos = window.orderModel.reportes;

        // Filtro de fecha: filtrar por DÍA (año-mes-día) usando extractYMD
        if (fechaFiltro) {
            const fechaSeleccionada = this.extractYMD(fechaFiltro);
            pedidos = pedidos.filter(ped => {
                return this.extractYMD(ped.fecha) === fechaSeleccionada;
            });
        }

        // Historial: ocultar archivados. Financiero: mostrar todo
        if (this.currentMode === 'historial') {
            pedidos = pedidos.filter(ped => ped.estado !== 'archivado');
        }

        let totalGlobal = 0;
        this.tbody.innerHTML = "";
        const datosGrafica = {};

        // Función auxiliar para extraer proveedor del pedido
        const extraerProveedor = (ped) => {
            // Prioridad 1: Campo explícito proveedor (nuevo sistema)
            if (ped.proveedor) return ped.proveedor;
            
            // Prioridad 2: Parsear observaciones (sistema antiguo)
            if (ped.observaciones) {
                // Nuevo formato: "Proveedor: ${prov} | Responsable:"
                if (ped.observaciones.includes('Proveedor:')) {
                    const parts = ped.observaciones.split('Proveedor: ')[1];
                    if (parts) {
                        return parts.split(' |')[0].trim();
                    }
                }
                // Formato antiguo: "destinado a ${prov} generado por"
                else if (ped.observaciones.includes('destinado a')) {
                    return ped.observaciones.split('destinado a ')[1].split(' generado por')[0];
                }
            }
            return '-';
        };

        if (tiendaFiltro === 'todas') {
            document.getElementById('titulo-reporte').innerHTML = isFinanciero ?
                '<i class="bi bi-graph-up-arrow me-2"></i>Suma Financiera Global' :
                '<i class="bi bi-collection-fill me-2"></i>Suma de Pedidos Globales';

            const agrupados = {};
            pedidos.forEach(ped => {
                const proveedorPedido = extraerProveedor(ped);
                if (provFiltro !== 'todos' && proveedorPedido !== provFiltro) return;

                // En modo financiero, mostrar todo (incluyendo archivados). En historial, ocultar archivados
                const detalleParaMostrar = isFinanciero ? (ped.detalle || []) : (ped.detalle || []).filter(d => !d.archivado);
                detalleParaMostrar.forEach(prodItem => {
                    const key = `${prodItem.producto}__${proveedorPedido}__${ped.estado}`;
                    if (!agrupados[key]) {
                        agrupados[key] = {
                            producto: prodItem.producto,
                            proveedor: proveedorPedido,
                            estado: ped.estado,
                            stock_actual_suma: 0,
                            cantidad_pedida: 0,
                            coste_total: 0
                        };
                    }
                    agrupados[key].stock_actual_suma += (prodItem.stock_actual || 0);
                    agrupados[key].cantidad_pedida += (prodItem.cantidad_pedida || 0);
                    const cost = prodItem.cantidad_pedida * (prodItem.precio_referencia || 0);
                    agrupados[key].coste_total += cost;

                    const itemComprado = prodItem?.estado_producto === 'completado' || prodItem?.archivado === true;
                    const pedidoCerrado = ped?.estado === 'completado' || ped?.estado === 'archivado';

                    // En financiero solo contar lo que queda por comprar.
                    // En historial mantener el comportamiento anterior.
                    const incluirEnTotal = !isFinanciero || (!itemComprado && !pedidoCerrado);
                    if (incluirEnTotal) {
                        totalGlobal += cost;
                        if (isFinanciero) {
                            datosGrafica[ped.tienda] = (datosGrafica[ped.tienda] || 0) + cost;
                        }
                    }
                });
            });

            if (Object.keys(agrupados).length === 0) {
                this.tbody.innerHTML = `<tr><td colspan='9' class='text-center text-muted py-4'>
                    <i class="bi bi-inbox me-2"></i>No hay pedidos para la fecha seleccionada.</td></tr>`;
                this.txtTotal.innerText = '0.00€';
                return;
            }

            Object.values(agrupados).forEach(grp => {
                const tr = document.createElement('tr');
                const badgeClass = grp.estado === 'pendiente' ? 'bg-warning text-dark' :
                    grp.estado === 'completado' ? 'bg-success' : 'bg-secondary';
                let trHTML = `
                    <td class="small align-middle"><span class="badge bg-light text-dark shadow-sm">- Múltiples -</span></td>
                    <td class="fw-bold align-middle">TODAS</td>
                    <td class="align-middle"><span class="badge bg-secondary">${grp.proveedor}</span></td>
                    <td>${grp.producto}</td>
                    <td class="text-center text-muted">${grp.stock_actual_suma}</td>
                    <td class="text-center fw-bold text-primary" style="font-size:1.1rem;">${grp.cantidad_pedida}</td>
                `;
                if (isFinanciero) {
                    trHTML += `<td class="text-end fw-bold col-coste">${grp.coste_total.toFixed(2)}€</td>`;
                }
                trHTML += `<td class="text-center align-middle">
                    <span class="badge ${badgeClass}">${grp.estado.toUpperCase()}</span></td>`;
                tr.innerHTML = trHTML;
                this.tbody.appendChild(tr);
            });

        } else {
            // MODO DETALLADO POR SEDE
            document.getElementById('titulo-reporte').innerHTML = isFinanciero ?
                '<i class="bi bi-graph-up-arrow me-2"></i>Reporte Financiero de Compras' :
                '<i class="bi bi-clock-history me-2"></i>Listado de Pedidos';

            const pedidosFiltrados = pedidos.filter(p => p.tienda === tiendaFiltro);

            if (pedidosFiltrados.length === 0) {
                this.tbody.innerHTML = `<tr><td colspan='9' class='text-center text-muted py-4'>
                    <i class="bi bi-inbox me-2"></i>No hay pedidos para esta tienda en la fecha seleccionada.</td></tr>`;
                this.txtTotal.innerText = '0.00€';
                return;
            }

            pedidosFiltrados.forEach(ped => {
                const fechaSub = new Date(ped.fecha).toLocaleString('es-ES');
                const proveedorPedido = extraerProveedor(ped);
                if (provFiltro !== 'todos' && proveedorPedido !== provFiltro) return;

                const detalles = ped.detalle || [];
                
                // En modo financiero, mostrar todo (incluyendo archivados). En historial, ocultar archivados
                const detallesFiltrados = isFinanciero ? detalles : detalles.filter(d => !d.archivado);
                
                if (detallesFiltrados.length === 0) {
                    // Si todos los productos están archivados y NO es financiero, no mostrar el pedido
                    return;
                }
                
                const rowSpan = detallesFiltrados.length > 0 ? detallesFiltrados.length : 1;

                detallesFiltrados.forEach((prodItem, index) => {
                    const coste = prodItem.cantidad_pedida * (prodItem.precio_referencia || 0);

                    // Extraer empleado y responsable
                    let empleadoPedido = '-';
                    let responsablePedido = '-';
                    if (ped.observaciones) {
                        // Buscar "Responsable:" en observaciones (nuevo formato)
                        if (ped.observaciones.includes('Responsable:')) {
                            const parts = ped.observaciones.split('Responsable: ');
                            if (parts[1]) {
                                responsablePedido = parts[1].split(' |')[0].trim();
                            }
                        }
                        // Si no hay Responsable, buscar en "Realizado por:" (formato antiguo)
                        else if (ped.observaciones.includes('Realizado por:')) {
                            let realizadoPor = ped.observaciones.split('Realizado por: ')[1];
                            if (realizadoPor) {
                                responsablePedido = realizadoPor.split(' |')[0].trim();
                            }
                        }
                        
                        // Extraer empleado si existe
                        if (ped.observaciones.includes('Generado por:')) {
                            empleadoPedido = ped.observaciones.split('Generado por: ')[1];
                        }
                    }

                    const itemComprado = prodItem?.estado_producto === 'completado' || prodItem?.archivado === true;
                    const pedidoCerrado = ped?.estado === 'completado' || ped?.estado === 'archivado';

                    // En financiero solo contar lo que queda por comprar.
                    // En historial mantener el comportamiento anterior.
                    const incluirEnTotal = !isFinanciero || (!itemComprado && !pedidoCerrado);
                    if (incluirEnTotal) {
                        totalGlobal += coste;
                        if (isFinanciero) {
                            datosGrafica[ped.tienda] = (datosGrafica[ped.tienda] || 0) + coste;
                        }
                    }

                    const tr = document.createElement('tr');
                    let trHTML = '';

                    if (index === 0) {
                        trHTML += `<td class="small align-middle" rowspan="${rowSpan}">${fechaSub}</td>`;
                        trHTML += `<td class="fw-bold align-middle" rowspan="${rowSpan}">${ped.tienda}</td>`;
                        trHTML += `<td class="align-middle" rowspan="${rowSpan}"><span class="badge bg-secondary">${proveedorPedido}</span></td>`;
                    }

                    trHTML += `<td>${prodItem.producto}</td>`;
                    trHTML += `<td class="text-center">${prodItem.stock_actual}</td>`;
                    
                    // Cantidad Pedida: editable en historial (estado pendiente), solo lectura en financiero
                    let cantidadHTML = '';
                    if (this.currentMode === 'historial' && ped.estado === 'pendiente') {
                        cantidadHTML = `<td class="text-center">
                            <input type="number" min="0" class="form-control form-control-sm text-center input-cantidad-pedida" 
                            value="${prodItem.cantidad_pedida}" data-pedido="${ped.id}" data-producto="${prodItem.producto}" 
                            data-value-original="${prodItem.cantidad_pedida}" style="width: 80px; margin: auto;">
                        </td>`;
                    } else {
                        cantidadHTML = `<td class="text-center fw-bold text-primary">${prodItem.cantidad_pedida}</td>`;
                    }
                    trHTML += cantidadHTML;

                    if (isFinanciero) {
                        trHTML += `<td class="text-end fw-bold col-coste">${coste.toFixed(2)}€</td>`;
                    }

                    // Columna "RESPONSABLE / REALIZADO POR" - solo en la primera fila y NO en financiero
                    if (index === 0 && !isFinanciero) {
                        trHTML += `<td class="text-center align-middle col-responsable" rowspan="${rowSpan}">
                            <div class="fw-bold text-purple" style="font-size: 0.95rem;">${responsablePedido}</div>
                            <small class="text-muted d-block mt-1" style="font-size: 0.70rem;">Ref: ${empleadoPedido}</small>
                        </td>`;
                    }

                    // Columna ESTADO - Para cada producto
                    let actionHTML = '';
                    let badgeClassGlobal = ped.estado === 'pendiente' ? 'bg-warning text-dark' :
                            ped.estado === 'completado' ? 'bg-success' : 'bg-secondary';
                    let isChecked = prodItem.recibido ? 'checked' : '';
                    let checkDisabled = ped.estado !== 'pendiente' ? 'disabled' : '';

                    // Obtener estado del producto (por defecto "recibido")
                    const estadoProducto = prodItem.estado_producto || 'recibido';
                    const esArchivado = prodItem.archivado || false;

                    if (this.currentMode === 'historial') {
                         if (ped.estado === 'pendiente') {
                             // Mostrar botón único que cicla entre: recibido → completado → archivado
                             let btnClass = '';
                             let btnIcon = '';
                             let btnText = '';
                             let btnTitle = '';

                             if (esArchivado) {
                                 actionHTML = `<span class="badge bg-secondary shadow-sm"><i class="bi bi-archive me-1"></i>ARCHIVADO</span>`;
                             } else if (estadoProducto === 'archivado') {
                                 // Ya archivado, solo mostrar badge
                                 actionHTML = `<span class="badge bg-secondary shadow-sm"><i class="bi bi-archive me-1"></i>ARCHIVADO</span>`;
                             } else if (estadoProducto === 'completado') {
                                 btnClass = 'btn-outline-secondary';
                                 btnIcon = 'bi-archive';
                                 btnText = 'Archivar';
                                 btnTitle = 'Pulsa para archivar este producto';
                                 actionHTML = `
                                    <button class="btn btn-xs ${btnClass} btn-avanzar-estado-producto" data-pedido="${ped.id}" data-producto="${prodItem.producto}" style="padding: 4px 8px; font-size: 11px;" title="${btnTitle}">
                                        <i class="bi ${btnIcon} me-1"></i>${btnText}
                                    </button>`;
                             } else {
                                 // Estado 'recibido' - mostrar botón para completar
                                 btnClass = 'btn-success';
                                 btnIcon = 'bi-check2';
                                 btnText = 'Completar';
                                 btnTitle = 'Pulsa para marcar como completado';
                                 actionHTML = `
                                    <button class="btn btn-xs ${btnClass} btn-avanzar-estado-producto" data-pedido="${ped.id}" data-producto="${prodItem.producto}" style="padding: 4px 8px; font-size: 11px;" title="${btnTitle}">
                                        <i class="bi ${btnIcon} me-1"></i>${btnText}
                                    </button>`;
                             }
                         } else {
                            actionHTML = `<span class="badge ${badgeClassGlobal} shadow-sm"><i class="bi bi-check-all me-1"></i>RECIBIDO</span>`;
                         } 
                    } else {
                         actionHTML = `<span class="badge ${badgeClassGlobal}">${ped.estado.toUpperCase()}</span>`;
                    }
                    
                    // Columna Acciones Globales del Pedido (Archivar) - Solo Primera Fila
                    let accionesGlobalesHTML = '';
                    if (index === 0) {
                        if (this.currentMode === 'historial') {
                            if (ped.estado === 'completado') {
                                accionesGlobalesHTML = `
                                <div class="mt-2 text-center border-top pt-2">
                                    <button class="btn btn-sm btn-outline-secondary btn-archivar" data-id="${ped.id}" title="Archivar pedido completo">
                                        <i class="bi bi-archive me-1"></i> Archivar
                                    </button>
                                </div>
                                `;
                            }
                        }
                    }

                    trHTML += `<td class="text-center align-middle">
                        ${actionHTML}
                        ${index === 0 ? accionesGlobalesHTML : ''}
                    </td>`;

                    tr.innerHTML = trHTML;
                    this.tbody.appendChild(tr);
                });
            });
        }

        this.txtTotal.innerText = totalGlobal.toFixed(2) + "€";

        this.tbody.querySelectorAll('.btn-archivar').forEach(btn =>
            btn.addEventListener('click', (e) => this.archivarPedido(e.currentTarget.dataset.id)));
        this.tbody.querySelectorAll('.btn-avanzar-estado-producto').forEach(btn =>
            btn.addEventListener('click', (e) => this.avanzarEstadoProducto(e.currentTarget.dataset.pedido, e.currentTarget.dataset.producto)));
        
        // Event listener para inputs de cantidad_pedida editables
        this.tbody.querySelectorAll('.input-cantidad-pedida').forEach(input =>
            input.addEventListener('change', (e) => this.actualizarCantidadPedida(e.currentTarget)));
    },



    async completarPedido(id) {
        try {
            await window.orderModel.setOrderStatus(id, 'completado');
            const pedRef = window.orderModel.reportes.find(r => r.id == id);
            if (pedRef && pedRef.detalle) {
                const tiendaActual = document.getElementById('tiendaSelect').value;
                let updated = false;
                for (let item of pedRef.detalle) {
                    if (!item.recibido) {
                        item.recibido = true;
                        updated = true;
                        const prod = (window.productModel.getProductos() || []).find(p => p.producto === item.producto);
                        if (prod) {
                            const nuevoStock = window.productModel.getStockActual(item.producto, tiendaActual) + item.cantidad_pedida;
                            await window.productModel.updateProductoField(item.producto, 'stock_actual', nuevoStock, tiendaActual);
                        }
                    }
                }
                if (updated) {
                    await window._supabase.from('pedidos').update({ detalle: pedRef.detalle }).eq('id', id);
                }
            }
            await this.cargarReportes(this.currentMode);
            window.ui.showNotify("Completado", "Pedido completado y stock actualizado.", "success");
        } catch (e) {
            window.ui.showNotify("Error", e.message, "error");
        }
    },

    async eliminarPedido(id) {
        try {
            await window.orderModel.deleteOrder(id);
            await this.cargarReportes(this.currentMode);
            window.ui.showNotify("Eliminado", "Pedido eliminado para siempre.", "success");
        } catch (e) {
            window.ui.showNotify("Error", "No se pudo eliminar el pedido.", "error");
        }
    },

    async archivarPedido(id) {
        try {
            await window.orderModel.setOrderStatus(id, 'archivado');
            await this.cargarReportes(this.currentMode);
            window.ui.showNotify("Archivado", "Pedido archivado correctamente.", "info");
        } catch (e) {
            window.ui.showNotify("Error", e.message, "error");
        }
    },

    async avanzarEstadoProducto(pedidoId, producto) {
        try {
            // 🔐 VALIDACIÓN DE PERMISOS
            const profile = window.authModel.getProfile();
            const rol = (profile.rol || '').toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            const isFranquiciado = rol === 'franquiciado';

            // Buscar el pedido
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) {
                throw new Error("Pedido no encontrado");
            }

            // 🔐 Franquiciado solo puede modificar su tienda asignada
            if (!isAdmin && isFranquiciado && pedRef.tienda !== profile.tienda_asignada) {
                throw new Error(`❌ No tienes permiso para modificar pedidos de la tienda "${pedRef.tienda}"`);
            }

            // Buscar el producto en el detalle
            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) {
                throw new Error("Producto no encontrado en el pedido");
            }

            // Ciclar entre estados: recibido → completado → archivado
            const estadoActual = prodItem.estado_producto || 'recibido';
            
            if (estadoActual === 'recibido') {
                prodItem.estado_producto = 'completado';
            } else if (estadoActual === 'completado') {
                prodItem.archivado = true;
                prodItem.estado_producto = 'archivado';
            }

            // 🔍 Verificar si TODOS los items están completados o archivados
            const todosCompletados = (pedRef.detalle || []).every(item => 
                item.estado_producto === 'completado' || item.archivado
            );
            
            // Si todos están completados, cambiar el estado del pedido para no interferir con nuevos pedidos
            if (todosCompletados && pedRef.estado === 'pendiente') {
                console.log(`✅ Todos los items completados. Cambiar pedido a 'completado'`);
                pedRef.estado = 'completado';
            }

            // Actualizar en Supabase
            await window._supabase
                .from('pedidos')
                .update({ 
                    detalle: pedRef.detalle,
                    estado: pedRef.estado  // ✨ Guardar el nuevo estado del pedido
                })
                .eq('id', pedidoId);

            if (window.orderModel?.syncProductAcrossPendingOrders) {
                await window.orderModel.syncProductAcrossPendingOrders({
                    pedidoIdOrigen: pedidoId,
                    producto,
                    tienda: pedRef.tienda,
                    proveedor: pedRef.proveedor || window.orderModel.extractProveedorFromObservaciones(pedRef.observaciones),
                    dateValue: pedRef.fecha || pedRef.created_at
                });
            }

            // Recargar para mostrar el nuevo estado
            await this.cargarReportes(this.currentMode);

            // Actualizar inventario si está visible
            if (typeof window.inventoryController !== 'undefined') {
                window.inventoryController.renderTable();
            }

        } catch (e) {
            console.error("Error al avanzar estado:", e);
            window.ui.showNotify("Error", e.message, "error");
        }
    },

    async marcarProductoRecibido(checkbox) {
        // 🔐 VALIDACIÓN DE PERMISOS - Verificar que usuario tenga acceso a este pedido
        const profile = window.authModel.getProfile();
        const rol = (profile.rol || '').toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        const isFranquiciado = rol === 'franquiciado';
        
        const pedidoId = checkbox.dataset.pedidoId;
        const producto = checkbox.dataset.producto;
        const cantidad = parseInt(checkbox.dataset.cantidad);
        const recibido = checkbox.checked;

        try {
            // Buscar el pedido en la lista local
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) {
                throw new Error("Pedido no encontrado");
            }
            
            // 🔐 Franquiciado solo puede marcar recibido de su tienda asignada
            if (!isAdmin && isFranquiciado && pedRef.tienda !== profile.tienda_asignada) {
                console.error(`🔐 Acceso denegado: Franquiciado intentó modificar pedido de tienda ${pedRef.tienda}`);
                throw new Error(`❌ No tienes permiso para modificar pedidos de la tienda "${pedRef.tienda}"`);
            }

            // Buscar el producto en el detalle del pedido
            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) {
                throw new Error("Producto no encontrado en el pedido");
            }

            // Actualizar el estado de recibido
            prodItem.recibido = recibido;
            // Inicializar el estado del producto si no existe
            if (!prodItem.estado_producto) {
                prodItem.estado_producto = 'recibido';
            }
            // Cuando se marca como recibido, cambiar estado a "recibido"
            if (recibido) {
                prodItem.estado_producto = 'recibido';
            } else {
                prodItem.estado_producto = 'recibido';
                prodItem.archivado = false;
            }

            // Actualizar en Supabase
            await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);

            // Actualizar el stock del producto
            const prod = (window.productModel.getProductos() || []).find(p => p.producto === producto);
            if (prod) {
                const tiendaActual = document.getElementById('tiendaSelect').value;
                let nuevoStock = window.productModel.getStockActual(producto, tiendaActual) || 0;
                if (recibido) {
                    nuevoStock += cantidad;
                } else {
                    nuevoStock = Math.max(0, nuevoStock - cantidad);
                }
                await window.productModel.updateProductoField(producto, 'stock_actual', nuevoStock, tiendaActual);
            }

            // Recargar para mostrar botones de "Completar"
            await this.cargarReportes(this.currentMode);

            // Actualizar el inventario si está visible
            if (typeof window.inventoryController !== 'undefined') {
                window.inventoryController.renderTable();
            }

        } catch (e) {
            console.error("Error al marcar producto:", e);
            window.ui.showNotify("Error", "No se pudo marcar el producto", "error");
        }
    },

    async actualizarCantidadPedida(input) {
        const pedidoId = input.dataset.pedido;
        const producto = input.dataset.producto;
        const cantidadNueva = Math.max(0, parseInt(input.value) || 0);
        const cantidadOriginal = parseInt(input.dataset.valueOriginal);

        // Si no cambió, no hacer nada
        if (cantidadNueva === cantidadOriginal) {
            return;
        }

        try {
            // Buscar el pedido
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) {
                throw new Error("Pedido no encontrado");
            }

            // Buscar el producto en el detalle
            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) {
                throw new Error("Producto no encontrado en el pedido");
            }


            // Actualizar cantidad
            prodItem.cantidad_pedida = cantidadNueva;

            // Actualizar en Supabase
            await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);


            // Actualizar el atributo de valor original para futuras comparaciones
            input.dataset.valueOriginal = cantidadNueva;

            // Recargar la vista para reflejar el cambio de costo
            await this.cargarReportes(this.currentMode);

        } catch (err) {
            console.error('Error al actualizar cantidad:', err);
            window.ui.showNotify(`❌ Error al actualizar cantidad: ${err.message}`, 'error');
            // Restaurar valor anterior
            input.value = cantidadOriginal;
        }
    },

    async completarProducto(pedidoId, producto) {
        try {
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) throw new Error("Pedido no encontrado");

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) throw new Error("Producto no encontrado");

            prodItem.estado_producto = 'completado';

            await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);

            await this.cargarReportes(this.currentMode);

            // Actualizar el inventario si está visible
            if (typeof window.inventoryController !== 'undefined') {
                window.inventoryController.renderTable();
            }

        } catch (e) {
            window.ui.showNotify("Error", e.message, "error");
        }
    },

    async archivarProducto(pedidoId, producto) {
        try {
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) throw new Error("Pedido no encontrado");

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) throw new Error("Producto no encontrado");

            prodItem.archivado = true;

            await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);

            await this.cargarReportes(this.currentMode);

        } catch (e) {
            window.ui.showNotify("Error", e.message, "error");
        }
    },

};

window.reportController = reportController;
