const stockFaltanteController = {
    currentMode: 'historial',
    tbody: null,
    eventsBound: false,
    selectedItems: new Set(),

    getLocalISODate() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    async init() {
        console.log('📋 Inicializando Stock Faltante Controller...');
        
        this.tbody = document.getElementById('tbodyPedidosFaltante');

        if (!this.tbody) {
            console.error('❌ Elementos del Stock Faltante no encontrados');
            return;
        }

        // Verificar que orderModel existe
        if (!window.orderModel) {
            console.error('❌ orderModel no disponible');
            this.tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Error: orderModel no inicializado</td></tr>`;
            return;
        }

        if (!this.eventsBound) {
            this.bindEvents();
        }

        const fechaFiltro = document.getElementById('fechaFiltroFaltante');
        if (fechaFiltro && !fechaFiltro.value) {
            fechaFiltro.value = this.getLocalISODate();
        }
        
        this.cargarTiendas();
        this.cargarProveedores();

        // Siempre recargar datos cuando se abre la sección
        console.log('🔄 Forzando recarga de pedidos...');
        await this.cargarPedidos();
        
        console.log('✅ Stock Faltante Controller inicializado');
    },

    cargarTiendas() {
        const tiendas = window.productModel ? (window.productModel.tiendas || []) : [];
        return;
    },

    cargarProveedores() {
        const selectFiltro = document.getElementById('proveedorFiltroFaltante');
        if (!selectFiltro) return;

        const tiendaSeleccionada = document.getElementById('tiendaSelect')?.value || 'todas';
        const proveedores = window.providerModel
            ? (window.providerModel.getProveedores ? window.providerModel.getProveedores(false, tiendaSeleccionada) : [])
            : [];
        const opcionBase = '<option value="todos">Todos los proveedores</option>';
        const opcionesProveedores = proveedores
            .map(p => `<option value="${p.nombre}">${p.nombre}</option>`)
            .join('');

        selectFiltro.innerHTML = opcionBase + opcionesProveedores;
    },

    cargarResponsables() {
        const selectResponsable = document.getElementById('responsableFiltroFaltante');
        if (!selectResponsable) return;

        const fechaFiltro = document.getElementById('fechaFiltroFaltante')?.value || '';
        const fechaSeleccionada = fechaFiltro ? this.extractYMD(fechaFiltro) : '';
        const responsableActual = selectResponsable.value || 'todos';
        const pedidos = window.orderModel?.reportes || [];
        const responsables = new Set();

        pedidos.forEach((pedido) => {
            if (pedido.archivado) return;

            if (fechaSeleccionada) {
                const fechaPedido = this.extractYMD(pedido.fecha || pedido.created_at);
                if (fechaPedido !== fechaSeleccionada) return;
            }

            const detalleVisible = (pedido.detalle || []).some(prod => !prod.archivado);
            if (!detalleVisible) return;

            const nombre = this.extraerResponsablePedido(pedido);
            if (nombre) {
                responsables.add(nombre);
            }
        });

        const opcionBase = '<option value="todos">Todos los responsables</option>';
        const opciones = Array.from(responsables)
            .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
            .map(nombre => `<option value="${nombre}">${nombre}</option>`)
            .join('');

        selectResponsable.innerHTML = opcionBase + opciones;

        const existeOpcion = Array.from(selectResponsable.options).some(opt => opt.value === responsableActual);
        selectResponsable.value = existeOpcion ? responsableActual : 'todos';
    },

    extraerResponsablePedido(pedido) {
        const observaciones = String(pedido?.observaciones || '');
        const match = observaciones.match(/Responsable:\s*([^,\n|]+)/);
        return match ? String(match[1] || '').trim() : '';
    },

    bindEvents() {
        // Escuchar cambios en el selector de tienda existente (el del top)
        const selectorTiendaTop = document.getElementById('tiendaSelect');
        if (selectorTiendaTop) {
            selectorTiendaTop.addEventListener('change', () => {
                this.cargarProveedores();
                this.renderTabla();
            });
        }

        const filtros = ['fechaFiltroFaltante', 'proveedorFiltroFaltante', 'responsableFiltroFaltante'];
        filtros.forEach(filtroId => {
            const el = document.getElementById(filtroId);
            if (el) {
                el.addEventListener('change', () => {
                    if (filtroId === 'fechaFiltroFaltante') {
                        this.cargarResponsables();
                    }
                    this.renderTabla();
                });
                if (filtroId === 'fechaFiltroFaltante') {
                    el.addEventListener('input', () => {
                        this.cargarResponsables();
                        this.renderTabla();
                    });
                }
            }
        });

        const buscador = document.getElementById('buscadorFaltante');
        if (buscador) buscador.addEventListener('input', () => this.renderTabla());

        const btnEliminarLista = document.getElementById('btn-eliminar-lista');
        if (btnEliminarLista) {
            btnEliminarLista.addEventListener('click', () => this.eliminarListaPorResponsable());
        }

        const btnLimpiarSeleccion = document.getElementById('btn-limpiar-seleccion-faltante');
        if (btnLimpiarSeleccion) {
            btnLimpiarSeleccion.addEventListener('click', () => this.limpiarSeleccion());
        }

        const btnEnviarProveedores = document.getElementById('btn-enviar-proveedores');
        if (btnEnviarProveedores) {
            btnEnviarProveedores.addEventListener('click', () => this.enviarSeleccionadosAProveedores());
        }

        const checkAll = document.getElementById('check-all-faltante');
        if (checkAll) {
            checkAll.addEventListener('change', (e) => this.toggleSeleccionGlobal(e.target.checked));
        }

        this.eventsBound = true;
    },

    _getRowKey(item) {
        const pedido = String(item?.pedidoId || '').trim();
        const producto = String(item?.producto || '').trim();
        const tienda = String(item?.tienda || '').trim();
        const proveedor = String(item?.proveedor || '').trim();
        return `${pedido}__${proveedor}__${tienda}__${producto}`;
    },

    limpiarSeleccion() {
        this.selectedItems.clear();
        this.renderTabla();
    },

    toggleSeleccionGlobal(checked) {
        if (!this.tbody) return;

        this.tbody.querySelectorAll('.check-faltante-item').forEach(input => {
            input.checked = checked;
            const rowKey = input.dataset.rowKey;
            if (checked) {
                this.selectedItems.add(rowKey);
            } else {
                this.selectedItems.delete(rowKey);
            }
        });
    },

    getSeleccionadosAgrupados() {
        const grupos = {};
        const pedidos = (window.orderModel?.reportes || []).filter(p => !p.archivado);

        pedidos.forEach(pedido => {
            const proveedor = pedido.proveedor || this._extraerProveedorDesdeObservaciones(pedido.observaciones);
            const detalles = Array.isArray(pedido.detalle) ? pedido.detalle : [];

            detalles.forEach(prod => {
                if (prod.archivado) return;
                const rowKey = this._getRowKey({
                    pedidoId: pedido.id,
                    proveedor,
                    tienda: pedido.tienda,
                    producto: prod.producto
                });

                if (!this.selectedItems.has(rowKey)) return;

                const key = `${proveedor}__${prod.producto}`;
                if (!grupos[key]) {
                    grupos[key] = {
                        proveedor,
                        producto: prod.producto,
                        items: []
                    };
                }

                grupos[key].items.push({
                    pedidoId: pedido.id,
                    tienda: pedido.tienda,
                    cantidad: prod.cantidad_pedida || 0,
                    precio: prod.precio_referencia || 0,
                    stock_actual: prod.stock_actual || prod.stock_registrado || 0,
                    fecha: pedido.fecha || pedido.created_at,
                    responsable: this.extraerResponsablePedido(pedido),
                    emailProveedor: window.providerModel?.getProveedores?.(false)?.find(p => String(p.nombre).trim() === String(proveedor).trim())?.email || ''
                });
            });
        });

        return Object.values(grupos);
    },

    _extraerProveedorDesdeObservaciones(observaciones) {
        const texto = String(observaciones || '');
        const match = texto.match(/Proveedor:\s*([^,\n|]+)/i);
        return match ? String(match[1] || '').trim() : 'Sin Proveedor';
    },

    async enviarSeleccionadosAProveedores() {
        const grupos = this.getSeleccionadosAgrupados();

        if (grupos.length === 0) {
            window.ui.showNotify('Selecciona al menos un producto para enviar a proveedores.', 'warning');
            return;
        }

        if (!window.pdfExportController?.exportarProveedoresSeleccionadosPDF) {
            window.ui.showNotify('El módulo de exportación no está disponible.', 'danger');
            return;
        }

        await window.pdfExportController.exportarProveedoresSeleccionadosPDF(grupos);
    },

    _capturarFiltrosActuales() {
        return {
            proveedor: document.getElementById('proveedorFiltroFaltante')?.value || 'todos',
            responsable: document.getElementById('responsableFiltroFaltante')?.value || 'todos',
            fecha: document.getElementById('fechaFiltroFaltante')?.value || '',
            busqueda: document.getElementById('buscadorFaltante')?.value || ''
        };
    },

    _restaurarFiltrosActuales(filtros) {
        const selectProveedor = document.getElementById('proveedorFiltroFaltante');
        const selectResponsable = document.getElementById('responsableFiltroFaltante');
        const inputFecha = document.getElementById('fechaFiltroFaltante');
        const inputBusqueda = document.getElementById('buscadorFaltante');

        if (selectProveedor) {
            const existeOpcion = Array.from(selectProveedor.options).some(opt => opt.value === filtros.proveedor);
            selectProveedor.value = existeOpcion ? filtros.proveedor : 'todos';
        }

        if (selectResponsable) {
            const existeOpcion = Array.from(selectResponsable.options).some(opt => opt.value === filtros.responsable);
            selectResponsable.value = existeOpcion ? filtros.responsable : 'todos';
        }

        if (inputFecha) {
            inputFecha.value = filtros.fecha || '';
        }

        if (inputBusqueda) {
            inputBusqueda.value = filtros.busqueda || '';
        }
    },

    async cargarPedidos() {
        try {
            console.log('🔄 Iniciando análisis de Stock Faltante...');
            
            // Verificar que orderModel existe
            if (!window.orderModel || !window.productModel) {
                console.error('❌ Modelos no disponibles');
                if (this.tbody) {
                    this.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">Error: Modelos no inicializados</td></tr>`;
                }
                return;
            }

            // 1. Cargar todos los productos
            console.log('📦 Cargando productos...');
            await window.productModel.fetchProductos();
            
            // 2. Cargar proveedores
            console.log('🏢 Cargando proveedores...');
            if (window.providerModel) {
                await window.providerModel.fetchProveedores();
                this.cargarProveedores();
            }
            
            // 3. Cargar todos los pedidos pendientes
            console.log('📡 Cargando pedidos pendientes...');
            await window.orderModel.fetchReportes(true);
            
            console.log('✅ Datos cargados correctamente');
            this.cargarResponsables();
            this.renderTabla();
        } catch (err) {
            console.error('❌ Error cargando datos:', err);
            if (this.tbody) {
                this.tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">❌ Error: ${err.message}</td></tr>`;
            }
        }
    },

    // Helper: Extraer YYYY-MM-DD de una fecha respetando la hora LOCAL del usuario.
    // IMPORTANTE: `created_at` de Supabase viene en UTC (termina en 'Z' o '+00:00').
    // Un timestamp como "2026-07-14T22:30:00Z" es UTC, pero en España (UTC+2) es el 2026-07-15.
    // Si tomamos el substring directamente obtendríamos "2026-07-14" → fecha incorrecta.
    // La solución: pasar SIEMPRE por new Date() que aplica la zona horaria del navegador,
    // excepto cuando el string NO tiene información de zona (ej. "2026-07-15T18:30:00") ya que
    // en ese caso JavaScript lo interpreta como hora local y el resultado ya es correcto.
    extractYMD(fechaStr) {
        if (!fechaStr) return '';
        const raw = String(fechaStr).trim();
        if (!raw) return '';

        try {
            const date = new Date(raw);
            if (isNaN(date.getTime())) {
                // Fallback: tomar los primeros 10 chars si no se puede parsear
                return raw.substring(0, 10);
            }
            // Usar getFullYear/Month/Date que devuelven la hora LOCAL del navegador
            const year  = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day   = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return raw.substring(0, 10);
        }
    },

    renderTabla() {
        if (!this.tbody) return;

        if (!window.orderModel) {
            this.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Modelos no inicializados</td></tr>`;
            return;
        }

        const responsableFiltro = document.getElementById('responsableFiltroFaltante')?.value || 'todos';
        const tituloBase = '<i class="bi bi-clock-history me-2"></i>Pedidos Pendientes';
        const tituloElemento = document.getElementById('titulo-stock-faltante');
        if (tituloElemento) {
            tituloElemento.innerHTML = responsableFiltro !== 'todos'
                ? `${tituloBase} <span class="badge bg-info text-dark ms-2">Responsable: ${responsableFiltro}</span>`
                : tituloBase;
        }

        const tiendaFiltro = document.getElementById('tiendaSelect')?.value || 'todas';
        const provFiltro = document.getElementById('proveedorFiltroFaltante')?.value || 'todos';
        const fechaFiltro = document.getElementById('fechaFiltroFaltante')?.value || '';
        const textoBusqueda = (document.getElementById('buscadorFaltante')?.value || '').toLowerCase().trim();
        
        // Obtener pedidos que NO están archivados
        let pedidos = (window.orderModel.reportes || []).filter(p => !p.archivado);
        
        // 📅 FILTRO DE FECHA
        // Prioridad: campo `fecha` (timestamp local guardado al crear el pedido)
        // Fallback:  `created_at` (UTC de Supabase; extractYMD lo convierte a hora local)
        if (fechaFiltro) {
            const fechaSeleccionada = this.extractYMD(fechaFiltro);
            pedidos = pedidos.filter(p => {
                const fechaPedido = this.extractYMD(p.fecha || p.created_at);
                return fechaPedido === fechaSeleccionada;
            });
        }
        
        if (pedidos.length === 0) {
            this.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">✅ Sin pedidos pendientes</td></tr>`;
            return;
        }

        // 🔄 AGRUPAR datos por Proveedor + Producto
        const gruposAgrupados = {};
        const ordenProveedores = [];
        
        pedidos.forEach(pedido => {
            // Aplicar filtro de tienda
            if (tiendaFiltro !== 'todas' && pedido.tienda !== tiendaFiltro) return;
            
            // Extraer proveedor
            let proveedor = pedido.proveedor || 'Sin Proveedor';
            if (!pedido.proveedor && pedido.observaciones) {
                const provMatch = pedido.observaciones.match(/Proveedor:\s*([^|,\n]+)/);
                if (provMatch) {
                    proveedor = provMatch[1].trim();
                }
            }
            
            // Aplicar filtro de proveedor
            if (provFiltro !== 'todos' && proveedor !== provFiltro) return;

            // Extraer responsable
            const responsable = this.extraerResponsablePedido(pedido) || 'Usuario';

            // Aplicar filtro de responsable por el nombre escrito al generar pedido
            if (responsableFiltro !== 'todos' && responsable !== responsableFiltro) return;

            // Procesar productos del pedido
            const detalle = pedido.detalle || [];
            detalle.forEach((prod, idx) => {
                // 🔍 FILTRAR: No mostrar productos archivados
                if (prod.archivado) return;

                const clave = `${proveedor}|${prod.producto}`;
                if (!gruposAgrupados[clave]) {
                    gruposAgrupados[clave] = {
                        proveedor,
                        producto: prod.producto,
                        tiendas: []
                    };
                    if (!ordenProveedores.includes(proveedor)) {
                        ordenProveedores.push(proveedor);
                    }
                }

                    const fechaPedidoRaw = pedido.created_at || pedido.fecha;

                    gruposAgrupados[clave].tiendas.push({
                    tienda: pedido.tienda,
                    pedidoId: pedido.id,
                    cantidad: prod.cantidad_pedida || 0,
                    precio: prod.precio_referencia || 0,
                    estado: prod.estado_producto || 'recibido',
                    esArchivado: prod.archivado || false,
                        fecha: fechaPedidoRaw ? new Date(fechaPedidoRaw).toLocaleString('es-ES') : '-',
                    responsable
                });
            });
        });

        // 🔍 FILTRO POR TEXTO: producto o proveedor
        if (textoBusqueda) {
            for (const k of Object.keys(gruposAgrupados)) {
                const g = gruposAgrupados[k];
                if (!(g.producto || '').toLowerCase().includes(textoBusqueda) &&
                    !(g.proveedor || '').toLowerCase().includes(textoBusqueda)) {
                    delete gruposAgrupados[k];
                }
            }
            for (let i = ordenProveedores.length - 1; i >= 0; i--) {
                const prov = ordenProveedores[i];
                if (!Object.keys(gruposAgrupados).some(k => k.startsWith(prov + '|'))) {
                    ordenProveedores.splice(i, 1);
                }
            }
        }

        if (ordenProveedores.length === 0 && (textoBusqueda || pedidos.length > 0)) {
            this.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">🔍 Sin resultados para "<strong>${textoBusqueda}</strong>"</td></tr>`;
            return;
        }

        this.tbody.innerHTML = "";
        let rowCount = 0;

        // 📋 MOSTRAR en orden por Proveedor → Producto → Tiendas
        ordenProveedores.forEach(proveedor => {
            // Encontrar todos los productos de este proveedor
            const productosDelProveedor = Object.keys(gruposAgrupados)
                .filter(k => k.startsWith(proveedor + '|'))
                .map(k => gruposAgrupados[k])
                .sort((a, b) => a.producto.localeCompare(b.producto));

            productosDelProveedor.forEach(grupo => {
                // Para cada producto del proveedor, mostrar una fila por tienda
                grupo.tiendas.forEach((item, itemIdx) => {
                    const tr = document.createElement('tr');
                    const cantidad = item.cantidad;
                    const precio = item.precio;
                    const coste = cantidad * precio;
                    const cantidadMaxima = item.tienda ? window.productModel.getStockMaximo(grupo.producto, item.tienda) : 0;
                    const cantidadActual = item.tienda ? window.productModel.getStockActual(grupo.producto, item.tienda) : 0;
                    const rowKey = this._getRowKey({
                        pedidoId: item.pedidoId,
                        proveedor: grupo.proveedor,
                        tienda: item.tienda,
                        producto: grupo.producto
                    });
                    const checked = this.selectedItems.has(rowKey) ? 'checked' : '';

                    // Determinar botón según estado
                    let btnHTML = '';
                    if (item.esArchivado) {
                        btnHTML = `<span class="badge bg-secondary shadow-sm"><i class="bi bi-archive me-1"></i>ARCHIVADO</span>`;
                    } else if (item.estado === 'completado') {
                        btnHTML = `<button class="btn btn-xs btn-outline-secondary btn-avanzar-estado-stock-faltante" data-pedido="${item.pedidoId}" data-producto="${grupo.producto}" style="padding: 4px 8px; font-size: 11px;" title="Pulsa para archivar este producto"><i class="bi bi-archive me-1"></i>Archivar</button>`;
                    } else {
                        btnHTML = `<button class="btn btn-xs btn-success btn-avanzar-estado-stock-faltante" data-pedido="${item.pedidoId}" data-producto="${grupo.producto}" style="padding: 4px 8px; font-size: 11px;" title="Pulsa para marcar como completado"><i class="bi bi-check2 me-1"></i>Completar</button>`;
                    }

                    const trHTML = `
                        <td class="text-center align-middle"><input type="checkbox" class="form-check-input check-faltante-item" data-row-key="${rowKey}" ${checked}></td>
                        <td class="small align-middle">${item.fecha}</td>
                        <td class="fw-bold align-middle">${item.tienda || 'N/A'}</td>
                        <td class="align-middle">
                            <span class="badge bg-secondary">
                                ${grupo.proveedor}
                            </span>
                        </td>
                        <td>${grupo.producto || 'N/A'}</td>
                        <td class="text-center"><input type="number" class="input-cantidad-pedida form-control form-control-sm text-center" 
                            value="${cantidad}" 
                            data-precio="${precio}"
                            data-pedido="${item.pedidoId}"
                            data-producto="${grupo.producto}"
                            data-value-original="${cantidad}"
                            autocomplete="off"
                            inputmode="numeric"
                            style="width: 70px; margin: 0 auto;"></td>
                        <td class="text-end fw-bold col-coste coste-total">${coste.toFixed(2)}€</td>
                        <td class="text-center align-middle"><span class="badge bg-info text-dark">${item.responsable}</span></td>
                        <td class="text-center align-middle">
                            ${btnHTML}
                        </td>
                    `;
                    
                    tr.innerHTML = trHTML;
                    tr.dataset.cantidadMaxima = String(cantidadMaxima || 0);
                    tr.dataset.cantidadActual = String(cantidadActual || 0);
                    tr.dataset.coste = String(coste || 0);
                    this.tbody.appendChild(tr);
                    rowCount++;
                });
            });
        });

        if (rowCount === 0) {
            this.tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">✅ Sin pedidos que coincidan con los filtros</td></tr>`;
            return;
        }

        this.bindTableEvents();
    },

    bindTableEvents() {
        // Inputs de cantidad
        document.querySelectorAll('.input-cantidad-pedida').forEach(input => {
            input.addEventListener('change', (e) => this.actualizarCantidad(e));
            input.addEventListener('input', (e) => this.actualizarCostoEnTiempoReal(e));
        });

        // Botón para avanzar estado
        document.querySelectorAll('.btn-avanzar-estado-stock-faltante').forEach(btn => {
            btn.addEventListener('click', (e) => this.avanzarEstado(e));
        });

        document.querySelectorAll('.check-faltante-item').forEach(input => {
            input.addEventListener('change', (e) => {
                const rowKey = e.currentTarget.dataset.rowKey;
                if (e.currentTarget.checked) {
                    this.selectedItems.add(rowKey);
                } else {
                    this.selectedItems.delete(rowKey);
                }

                const allChecks = Array.from(document.querySelectorAll('.check-faltante-item'));
                const checkAll = document.getElementById('check-all-faltante');
                if (checkAll) {
                    const allChecked = allChecks.length > 0 && allChecks.every(chk => chk.checked);
                    const someChecked = allChecks.some(chk => chk.checked);
                    checkAll.checked = allChecked;
                    checkAll.indeterminate = !allChecked && someChecked;
                }
            });
        });

        const checkAll = document.getElementById('check-all-faltante');
        if (checkAll) {
            const allChecks = Array.from(document.querySelectorAll('.check-faltante-item'));
            checkAll.checked = allChecks.length > 0 && allChecks.every(chk => chk.checked);
            checkAll.indeterminate = !checkAll.checked && allChecks.some(chk => chk.checked);
        }
    },

    async eliminarListaPorResponsable() {
        try {
            const responsableSeleccionado = document.getElementById('responsableFiltroFaltante')?.value || 'todos';

            if (responsableSeleccionado === 'todos') {
                window.ui.showNotify('Selecciona un responsable para eliminar su lista completa.', 'warning');
                return;
            }

            const pedidos = (window.orderModel?.reportes || []).filter(p => !p.archivado);
            const pedidosObjetivo = pedidos.filter(pedido => this.extraerResponsablePedido(pedido) === responsableSeleccionado);

            if (pedidosObjetivo.length === 0) {
                window.ui.showNotify(`No hay pedidos para el responsable ${responsableSeleccionado}.`, 'warning');
                return;
            }

            const confirmar = window.confirm(`Se eliminaran ${pedidosObjetivo.length} pedido(s) de ${responsableSeleccionado}. Esta accion no se puede deshacer. Deseas continuar?`);
            if (!confirmar) return;

            const idsAEliminar = pedidosObjetivo.map(p => p.id);

            const { error } = await window._supabase
                .from('pedidos')
                .delete()
                .in('id', idsAEliminar);

            if (error) {
                throw error;
            }

            await this.cargarPedidos();

            const selectResponsable = document.getElementById('responsableFiltroFaltante');
            if (selectResponsable) {
                const existe = Array.from(selectResponsable.options).some(opt => opt.value === responsableSeleccionado);
                selectResponsable.value = existe ? responsableSeleccionado : 'todos';
            }

            this.renderTabla();
            window.ui.showNotify(`Lista eliminada: ${idsAEliminar.length} pedido(s) de ${responsableSeleccionado}.`, 'success');
        } catch (err) {
            console.error('❌ Error al eliminar lista por responsable:', err);
            window.ui.showNotify(`❌ Error al eliminar lista: ${err.message}`, 'danger');
        }
    },

    async avanzarEstado(event) {
        const btn = event.currentTarget;
        const pedidoId = btn.dataset.pedido;
        const producto = btn.dataset.producto;

        try {
            // 🔐 GUARDAR FILTROS ACTUALES antes de recargar
            const filtroProveedorSeleccionado = document.getElementById('proveedorFiltroFaltante')?.value || 'todos';
            const filtroFechaSeleccionado = document.getElementById('fechaFiltroFaltante')?.value || 'todos';

            // 👤 OBTENER USUARIO ACTUAL
            const profile = window.authModel ? window.authModel.getProfile() : null;
            const usuarioActual = profile?.nombre_usuario || 'Usuario Desconocido';

            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) throw new Error("Pedido no encontrado");

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) throw new Error("Producto no encontrado");

            // Ciclar entre estados: recibido → completado → archivado
            const estadoActual = prodItem.estado_producto || 'recibido';
            
            if (estadoActual === 'recibido') {
                // ✅ TRANSICIÓN: recibido → completado
                prodItem.estado_producto = 'completado';
                
                // 📦 ACTUALIZAR STOCK ACTUAL cuando se marca como completado
                const tienda = pedRef.tienda;
                const cantidad = prodItem.cantidad_pedida || 0;
                
                if (cantidad > 0 && window.productModel) {
                    const stockActual = window.productModel.getStockActual(producto, tienda) || 0;
                    const nuevoStock = stockActual + cantidad;
                    
                    console.log(`📦 Actualizando stock: ${producto} en "${tienda}": ${stockActual} + ${cantidad} = ${nuevoStock}`);
                    await window.productModel.updateProductoField(producto, 'stock_actual', nuevoStock, tienda);
                    window.ui.showNotify(`✅ Stock actualizado: ${producto} → ${nuevoStock}`, 'success');
                }
            } else if (estadoActual === 'completado') {
                // 📂 TRANSICIÓN: completado → archivado
                prodItem.archivado = true;
                prodItem.estado_producto = 'archivado';
            }

            // � Verificar si TODOS los items están completados o archivados
            const todosCompletados = (pedRef.detalle || []).every(item => 
                item.estado_producto === 'completado' || item.archivado
            );
            
            // Si todos están completados, cambiar el estado del pedido para no interferir con nuevos pedidos
            if (todosCompletados && pedRef.estado === 'pendiente') {
                console.log(`✅ Todos los items completados. Cambiar pedido a 'completado'`);
                pedRef.estado = 'completado';
            }

            await window._supabase
                .from('pedidos')
                .update({ 
                    detalle: pedRef.detalle,
                    estado: pedRef.estado
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

            // Recargar ambas secciones
            await this.cargarPedidos();
            
            // 🔐 RESTAURAR FILTROS después de recargar
            const selectProveedor = document.getElementById('proveedorFiltroFaltante');
            const selectFecha = document.getElementById('fechaFiltroFaltante');
            
            if (selectProveedor) {
                selectProveedor.value = filtroProveedorSeleccionado;
            }
            if (selectFecha) {
                selectFecha.value = filtroFechaSeleccionado;
            }
            
            // Renderizar con los filtros restaurados
            this.renderTabla();
            
            // Actualizar inventario si está visible
            if (typeof window.inventoryController !== 'undefined') {
                window.inventoryController.renderTable(document.getElementById('provSelect')?.value || 'todos');
            }
            
        } catch (err) {
            console.error('❌ Error al avanzar estado:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'danger');
        }
    },

    actualizarCostoEnTiempoReal(event) {
        // Actualizar el costo de la fila mientras se escribe la cantidad
        const input = event.target;
        const fila = input.closest('tr');
        if (!fila) return;
        const nuevaCantidad = Number(input.value) || 0;
        const precio = Number(input.dataset.precio) || 0;
        const costo = nuevaCantidad * precio;
        
        const celda_costo = fila.querySelector('.coste-total');
        if (celda_costo) {
            celda_costo.textContent = costo.toFixed(2) + '€';
        }

        fila.dataset.coste = String(costo || 0);
    },

    async actualizarCantidad(event) {
        // Si el input tiene data-pedido (viene de tabla de pedidos históricos), actualizar en Supabase
        const pedidoId = event.target.dataset.pedido;
        
        if (pedidoId) {
            const producto = event.target.dataset.producto;
            const cantidadNueva = Math.max(0, parseInt(event.target.value) || 0);
            const cantidadOriginal = parseInt(event.target.dataset.valueOriginal) || 0;

            if (cantidadNueva === cantidadOriginal) return;

            const filtrosActuales = this._capturarFiltrosActuales();

            try {
                const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
                if (!pedRef) throw new Error("Pedido no encontrado");

                const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
                if (!prodItem) throw new Error("Producto no encontrado");

                prodItem.cantidad_pedida = cantidadNueva;
                event.target.dataset.valueOriginal = cantidadNueva;

                await window._supabase
                    .from('pedidos')
                    .update({ 
                        detalle: pedRef.detalle,
                        observaciones: pedRef.observaciones
                    })
                    .eq('id', pedidoId);

                await this.cargarPedidos();
                this._restaurarFiltrosActuales(filtrosActuales);
                this.renderTabla();
                window.ui.showNotify('✅ Cantidad actualizada correctamente', 'success');
            } catch (err) {
                console.error('Error:', err);
                window.ui.showNotify(`❌ Error al actualizar cantidad: ${err.message}`, 'danger');
                event.target.value = cantidadOriginal;
            }
        } else {
            // Si es del Stock Faltante, solo actualizar el costo visualmente
            this.actualizarCostoEnTiempoReal(event);
        }
    },

    async marcarRecibidoDropdown(event) {
        const link = event.currentTarget;
        const pedidoId = link.dataset.pedido;
        const producto = link.dataset.producto;

        try {
            // 👤 OBTENER USUARIO ACTUAL
            const profile = window.authModel ? window.authModel.getProfile() : null;
            const usuarioActual = profile?.nombre_usuario || 'Usuario Desconocido';

            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) throw new Error("Pedido no encontrado");

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) throw new Error("Producto no encontrado");

            prodItem.estado_producto = 'recibido';
            prodItem.archivado = false;

            await window._supabase
                .from('pedidos')
                .update({ 
                    detalle: pedRef.detalle
                })
                .eq('id', pedidoId);

            window.ui.showNotify('✅ Producto marcado como recibido', 'success');
            await this.cargarPedidos();
        } catch (err) {
            console.error('Error:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'danger');
        }
    },

    async completarProductoDropdown(event) {
        const link = event.currentTarget;
        const pedidoId = link.dataset.pedido;
        const producto = link.dataset.producto;

        try {
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) throw new Error("Pedido no encontrado");

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) throw new Error("Producto no encontrado");

            prodItem.estado_producto = 'completado';
            prodItem.archivado = false;

            await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);

            window.ui.showNotify('✅ Producto completado', 'success');
            await this.cargarPedidos();
        } catch (err) {
            console.error('Error:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'danger');
        }
    },

    async archivarProductoDropdown(event) {
        const link = event.currentTarget;
        const pedidoId = link.dataset.pedido;
        const producto = link.dataset.producto;

        try {
            const pedRef = window.orderModel.reportes.find(r => r.id == pedidoId);
            if (!pedRef) {
                throw new Error("Pedido no encontrado");
            }

            const prodItem = (pedRef.detalle || []).find(p => p.producto === producto);
            if (!prodItem) {
                throw new Error("Producto no encontrado");
            }

            // Mostrar notificación informativa que desaparece automáticamente
            window.ui.showNotify(`📦 Archivando "${producto}"...`, 'info');

            console.log('📦 Archivando producto:', producto, 'en pedido:', pedidoId);
            prodItem.archivado = true;

            const { error } = await window._supabase
                .from('pedidos')
                .update({ detalle: pedRef.detalle })
                .eq('id', pedidoId);

            if (error) {
                throw new Error(error.message);
            }

            console.log('✅ Producto archivado exitosamente');
            window.ui.showNotify('✅ Producto archivado', 'success');
            
            // Cerrar dropdown
            const dropdown = link.closest('.dropdown');
            if (dropdown) {
                const dropdownBtn = dropdown.querySelector('[data-bs-toggle="dropdown"]');
                if (dropdownBtn) {
                    try {
                        const bsDropdown = new bootstrap.Dropdown(dropdownBtn);
                        bsDropdown.hide();
                    } catch (e) {
                        console.warn('No se pudo cerrar dropdown:', e);
                    }
                }
            }
            
            // Recargar datos
            await this.cargarPedidos();
        } catch (err) {
            console.error('❌ Error archivando:', err);
            window.ui.showNotify(`❌ Error: ${err.message}`, 'danger');
        }
    },

    async archivarPedidoCompleto(event) {
        const pedidoId = event.target.dataset.pedido;

        if (!confirm('¿Archivar todo el pedido?')) return;

        try {
            await window.orderModel.setOrderStatus(pedidoId, 'archivado');
            await this.cargarPedidos();
            alert('✅ Pedido archivado completamente');
        } catch (err) {
            console.error('Error:', err);
            alert(`❌ Error: ${err.message}`);
        }
    },


};

window.stockFaltanteController = stockFaltanteController;
