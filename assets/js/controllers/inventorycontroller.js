const inventoryController = {
    modoOrdenar: false,
    dragSrcRow: null,

    // ── Orden personalizado por tienda ──────────────────────────────────────
    getOrdenKey(tienda) {
        return `orden_productos_${tienda}`;
    },
    getOrdenGuardado(tienda) {
        try {
            const raw = localStorage.getItem(this.getOrdenKey(tienda));
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },
    guardarOrden(tienda, productos) {
        const orden = productos.map(p => p.producto);
        localStorage.setItem(this.getOrdenKey(tienda), JSON.stringify(orden));
    },
    aplicarOrden(productos, tienda) {
        const orden = this.getOrdenGuardado(tienda);
        if (!orden || orden.length === 0) return productos;
        const mapa = new Map(productos.map(p => [p.producto, p]));
        const ordenados = [];
        orden.forEach(nombre => { if (mapa.has(nombre)) { ordenados.push(mapa.get(nombre)); mapa.delete(nombre); } });
        mapa.forEach(p => ordenados.push(p)); // Productos nuevos al final
        return ordenados;
    },

    // ── Drag & Drop ─────────────────────────────────────────────────────────
    activarDragDrop(tbody) {
        const tienda = this.getTiendaActual();
        const filas = tbody.querySelectorAll('tr[draggable="true"]');
        let currentTouchRow = null;
        let touchClone = null;

        filas.forEach(fila => {
            // HTML5 Drag & Drop (Mouse)
            fila.addEventListener('dragstart', (e) => {
                this.dragSrcRow = fila;
                e.dataTransfer.effectAllowed = 'move';
                fila.style.opacity = '0.5';
            });
            fila.addEventListener('dragend', () => {
                fila.style.opacity = '';
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
            });
            fila.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
                fila.classList.add('drag-over');
            });
            fila.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.dragSrcRow && this.dragSrcRow !== fila) {
                    const allRows = [...tbody.querySelectorAll('tr[draggable="true"]')];
                    const srcIdx = allRows.indexOf(this.dragSrcRow);
                    const tgtIdx = allRows.indexOf(fila);
                    if (srcIdx < tgtIdx) {
                        fila.parentNode.insertBefore(this.dragSrcRow, fila.nextSibling);
                    } else {
                        fila.parentNode.insertBefore(this.dragSrcRow, fila);
                    }
                    const nuevasFila = [...tbody.querySelectorAll('tr[draggable="true"]')];
                    const nuevoOrden = nuevasFila.map(r => r.getAttribute('data-producto')).filter(Boolean);
                    localStorage.setItem(this.getOrdenKey(tienda), JSON.stringify(nuevoOrden));
                    window.ui?.showNotify?.('✅ Orden guardado para ' + tienda, 'success');
                }
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
            });

            // Soporte Táctil (Teléfonos / Móvil)
            const handleCell = fila.querySelector('.drag-handle') || fila;
            handleCell.addEventListener('touchstart', (e) => {
                if (!this.modoOrdenar) return;
                const touch = e.touches[0];
                currentTouchRow = fila;
                fila.classList.add('dragging-touch');

                touchClone = fila.cloneNode(true);
                touchClone.style.position = 'fixed';
                touchClone.style.left = `${fila.getBoundingClientRect().left}px`;
                touchClone.style.top = `${touch.clientY - 20}px`;
                touchClone.style.width = `${fila.offsetWidth}px`;
                touchClone.style.opacity = '0.85';
                touchClone.style.zIndex = '9999';
                touchClone.style.pointerEvents = 'none';
                touchClone.style.background = '#f3e8ff';
                touchClone.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
                document.body.appendChild(touchClone);
            }, { passive: true });

            handleCell.addEventListener('touchmove', (e) => {
                if (!this.modoOrdenar || !currentTouchRow || !touchClone) return;
                const touch = e.touches[0];
                touchClone.style.top = `${touch.clientY - 20}px`;

                const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!elementUnderTouch) return;
                const targetRow = elementUnderTouch.closest('tr[draggable="true"]');

                if (targetRow && targetRow !== currentTouchRow && tbody.contains(targetRow)) {
                    const allRows = [...tbody.querySelectorAll('tr[draggable="true"]')];
                    const srcIdx = allRows.indexOf(currentTouchRow);
                    const tgtIdx = allRows.indexOf(targetRow);

                    if (srcIdx < tgtIdx) {
                        targetRow.parentNode.insertBefore(currentTouchRow, targetRow.nextSibling);
                    } else {
                        targetRow.parentNode.insertBefore(currentTouchRow, targetRow);
                    }
                }
            }, { passive: true });

            const endTouch = () => {
                if (currentTouchRow) {
                    currentTouchRow.classList.remove('dragging-touch');
                    currentTouchRow = null;
                }
                if (touchClone) {
                    touchClone.remove();
                    touchClone = null;
                }
                if (this.modoOrdenar) {
                    const nuevasFila = [...tbody.querySelectorAll('tr[draggable="true"]')];
                    const nuevoOrden = nuevasFila.map(r => r.getAttribute('data-producto')).filter(Boolean);
                    localStorage.setItem(this.getOrdenKey(tienda), JSON.stringify(nuevoOrden));
                    window.ui?.showNotify?.('✅ Orden guardado para ' + tienda, 'success');
                }
            };

            handleCell.addEventListener('touchend', endTouch);
            handleCell.addEventListener('touchcancel', endTouch);
        });
    },

    toggleModoOrdenar() {
        this.modoOrdenar = !this.modoOrdenar;
        const btn = document.getElementById('btn-modo-ordenar');
        if (btn) {
            if (this.modoOrdenar) {
                btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Guardar Orden';
                btn.classList.remove('btn-outline-purple');
                btn.classList.add('btn-success');
            } else {
                btn.innerHTML = '<i class="bi bi-arrow-down-up me-1"></i>Personalizar Orden';
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-purple');
            }
        }
        this.renderTable(document.getElementById('provSelect')?.value || 'todos');
    },

    resetOrden() {
        const tienda = this.getTiendaActual();
        localStorage.removeItem(this.getOrdenKey(tienda));
        window.ui?.showNotify?.('🔄 Orden restablecido para ' + tienda, 'info');
        this.renderTable(document.getElementById('provSelect')?.value || 'todos');
    },

    bindEvents() {
        const provSelect = document.getElementById('provSelect');
        if (provSelect) provSelect.addEventListener('change', (e) => this.renderTable(e.target.value));
        const tiendaSelect = document.getElementById('tiendaSelect');
        if (tiendaSelect) tiendaSelect.addEventListener('change', (e) => this.cambiarSedeManual(e.target.value));
        
        const buscador = document.getElementById('buscadorInventario');
        if (buscador) buscador.addEventListener('input', () => {
            this.renderTable(document.getElementById('provSelect')?.value || 'todos');
        });

        const btnActualizar = document.getElementById('btn-actualizar-stock');
        if (btnActualizar) btnActualizar.addEventListener('click', () => this.actualizarStock());

        const btnModoOrdenar = document.getElementById('btn-modo-ordenar');
        if (btnModoOrdenar) btnModoOrdenar.addEventListener('click', () => this.toggleModoOrdenar());

        // Modal: Crear Nuevo Producto
        const btnAddProduct = document.getElementById('btn-add-product');
        if (btnAddProduct) btnAddProduct.addEventListener('click', () => this.abrirModalProducto());

        const btnCancelProduct = document.getElementById('btn-cancel-product');
        if (btnCancelProduct) btnCancelProduct.addEventListener('click', () => this.cerrarModalProducto());

        const btnConfirmProduct = document.getElementById('btn-confirm-product');
        if (btnConfirmProduct) btnConfirmProduct.addEventListener('click', () => this.crearProducto());

        // Cerrar modal si se hace click en el overlay
        const modalProduct = document.getElementById('modal-product');
        if (modalProduct) {
            modalProduct.addEventListener('click', (e) => {
                if (e.target === modalProduct) this.cerrarModalProducto();
            });
        }
    },
    getTiendaActual() {
        const tiendaSelect = document.getElementById('tiendaSelect');
        const valor = tiendaSelect ? tiendaSelect.value : 'Todas';
        const tiendaNormalizada = String(valor).trim();
        return tiendaNormalizada;
    },
    async init() {
        // 🔴 FIX: SEQUENTIAL loading - fetchProductos depends on tiendas being loaded first
        const tiendas = await window.productModel.fetchTiendas();
        const productos = await window.productModel.fetchProductos();

        // Cargar proveedores desde BD (sincroniza con productos existentes si tabla vacía)
        if (window.providerModel) {
            await window.providerModel.fetchProveedores();
        }

        // Ocultar botón "Crear Producto" para empleados
        const profile = window.authModel.getProfile();
        const rol = (profile.rol || '').toLowerCase().trim();
        const btnAddProduct = document.getElementById('btn-add-product');
        const btnGenerarPedido = document.getElementById('btn-actualizar-stock');
        if (btnAddProduct && rol === 'empleado') {
            btnAddProduct.style.display = 'none';
        }
        if (btnGenerarPedido && rol === 'empleado') {
            btnGenerarPedido.style.display = 'none';
        }

        this.populateTiendas(tiendas);
        this.populateProveedores(window.productModel.getProveedores(true));
        this.renderTable('todos');
    },
    populateTiendas(tiendas) {
        const select = document.getElementById('tiendaSelect');
        let opciones = tiendas.map(t => `<option value="${t.nombre_tienda}">${t.nombre_tienda}</option>`).join('');
        const isAdmin = window.authModel.isAdmin();
        const profile = window.authModel.getProfile();
        const tieneAccesoTodas = isAdmin || profile.tienda_asignada === 'Todas';
        
        if (tieneAccesoTodas) { 
            opciones = `<option value="todas">Todas las tiendas</option>` + opciones; 
        }
        select.innerHTML = opciones;
        
        // Si tiene acceso a todas las tiendas, mostrar "todas" por defecto
        if (tieneAccesoTodas) {
            select.value = 'todas';
            select.disabled = false;
        } else {
            // Los empleados sin acceso a todas deben ver solo su tienda asignada
            select.value = profile.tienda_asignada || select.options[0]?.value;
            select.disabled = true;
        }
        
        // Actualizar el label de tienda seleccionada al inicializar
        this.cambiarSedeManual(select.value);
    },
    populateProveedores(proveedores) {
        const html = '<option value="todos">Todos los proveedores</option>' + proveedores.map(v => `<option value="${v}">${v}</option>`).join('');
        const provSelect = document.getElementById('provSelect');
        const reportProv = document.getElementById('provReporteSelect');
        if (provSelect) provSelect.innerHTML = html;
        if (reportProv) reportProv.innerHTML = html;
    },
    cambiarSedeManual(valor) {
        // Re-renderizar tabla cuando cambia la tienda para mostrar valores específicos
        this.renderTable(document.getElementById('provSelect')?.value || 'todos');
        // Actualizar el label de tienda seleccionada
        document.getElementById('nombreTiendaActual').innerText = (valor === 'todas') ? 'Todas las tiendas' : valor;
        if (document.getElementById('sec-reportes').style.display === 'block') {
            window.reportController.renderReportes();
        }
    },
    renderTable(proveedorFiltro = 'todos') {
        const profile = window.authModel.getProfile();
        const rolLower = (profile.rol || '').toLowerCase().trim();
        const isAdmin = rolLower === 'administrador';
        const isAuxiliar = rolLower === 'auxiliar_administrativo';
        const isFranquiciado = rolLower === 'franquiciado';
        
        const textoBusqueda = (document.getElementById('buscadorInventario')?.value || '').toLowerCase().trim();
        
        let prods = window.productModel.getProductosFiltrados(proveedorFiltro);
        if (textoBusqueda) {
            prods = prods.filter(p => (p.producto || '').toLowerCase().includes(textoBusqueda));
        }

        const tiendaActual = this.getTiendaActual();

        // Filtrar productos eliminados específicamente para la tienda seleccionada
        if (tiendaActual && tiendaActual !== 'todas' && tiendaActual.toLowerCase() !== 'todas las tiendas') {
            prods = prods.filter(p => {
                const stockMapa = window.productModel.stockPorTienda[p.id];
                if (stockMapa && typeof stockMapa === 'object') {
                    return Object.prototype.hasOwnProperty.call(stockMapa, tiendaActual);
                }
                return true;
            });
        }

        let productosOrdenados;
        if (this.modoOrdenar) {
            // En modo ordenar: aplicar orden guardado (sin agrupar por proveedor)
            productosOrdenados = this.aplicarOrden([...prods], tiendaActual);
        } else {
            // Orden normal: por proveedor y luego por nombre, pero respetando orden personalizado si existe
            const ordenGuardado = this.getOrdenGuardado(tiendaActual);
            if (ordenGuardado && ordenGuardado.length > 0) {
                productosOrdenados = this.aplicarOrden([...prods], tiendaActual);
            } else {
                productosOrdenados = [...prods].sort((a, b) => {
                    const provA = (a.proveedor || 'Sin proveedor').toLowerCase();
                    const provB = (b.proveedor || 'Sin proveedor').toLowerCase();
                    if (provA !== provB) return provA.localeCompare(provB, 'es');
                    return (a.producto || '').toLowerCase().localeCompare((b.producto || '').toLowerCase(), 'es');
                });
            }
        }

        // Elementos UI Inventario
        const cabInventario = document.getElementById('cabecera-inventario');
        const tbInventario = document.getElementById('listaInventario');

        // Cabeceras
        let hInv = '';
        if (this.modoOrdenar) {
            hInv += `<th style="width:36px;"></th>`; // columna handle
        }
        hInv += `<th>Producto</th>`;
        if (isAdmin || isAuxiliar || isFranquiciado) {
            hInv += `<th>Proveedor</th><th class="text-center">Precio</th><th class="text-center">Máx</th>`;
        } else {
            hInv += `<th class="text-center">Stock Máximo</th>`;
        }
        hInv += `<th class="text-center">Stock Actual</th>`;
        if (isAdmin || isAuxiliar) {
            hInv += `<th class="text-center">Acciones</th>`;
        }
        cabInventario.innerHTML = hInv;

        // Limpiar tabla
        tbInventario.innerHTML = '';

        // Separadores de proveedor (solo en modo normal)
        let proveedorActual = null;

        productosOrdenados.forEach(p => {
            const proveedorProducto = p.proveedor || 'Sin proveedor';

            // Separador de proveedor (solo fuera del modo ordenar)
            if (!this.modoOrdenar && proveedorProducto !== proveedorActual) {
                proveedorActual = proveedorProducto;
                const trGroup = document.createElement('tr');
                trGroup.className = 'table-light';
                const cols = (isAdmin || isAuxiliar) ? 6 : (isFranquiciado ? 5 : 3);
                trGroup.innerHTML = `<td colspan="${cols}" class="fw-bold text-secondary">Proveedor: ${proveedorActual}</td>`;
                tbInventario.appendChild(trGroup);
            }

            const stockActual = Math.max(0, window.productModel.getStockActual(p.producto, tiendaActual) || 0);
            const stockMaximo = Math.max(0, window.productModel.getStockMaximo(p.producto, tiendaActual) || 0);
            const nombreProducto = p.producto;
            const precioProducto = Number(p.precio) || 0;

            const trInv = document.createElement('tr');
            if (this.modoOrdenar) {
                trInv.setAttribute('draggable', 'true');
                trInv.setAttribute('data-producto', p.producto);
                trInv.style.cursor = 'grab';
            }

            let rInv = '';

            // Handle de arrastre
            if (this.modoOrdenar) {
                rInv += `<td class="text-center align-middle text-muted" style="cursor:grab; font-size:1.2rem; user-select:none;" title="Arrastra para reordenar">⠿</td>`;
            }

            rInv += `<td class="small fw-bold">
                    <div class="input-group input-group-sm mb-0">
                      <input type="text" class="form-control text-center input-producto" 
                      value="${nombreProducto}" data-prod="${p.producto}" data-prod-id="${p.id}" data-campo="producto" data-oldvalue="${nombreProducto}"
                      ${(!isAdmin && !isAuxiliar && !isFranquiciado) || this.modoOrdenar ? 'disabled' : ''}>
                    </div>
                  </td>`;

            if (isAdmin || isAuxiliar || isFranquiciado) {
                rInv += `<td>${p.proveedor || '-'}</td>
                      <td class="text-center">
                        <div class="input-group input-group-sm mb-0 mx-auto" style="width: 100px;">
                          <input type="number" step="0.01" min="0" class="form-control text-center input-precio" 
                          value="${precioProducto}" data-prod="${p.producto}" data-prod-id="${p.id}" data-field="${tiendaActual}" data-campo="precio" data-oldvalue="${precioProducto}"
                          ${this.modoOrdenar ? 'disabled' : ''}>
                          <span class="input-group-text p-1">€</span>
                        </div>
                      </td>
                      <td class="text-center">
                        <input type="number" min="0" class="form-control form-control-sm text-center input-max" 
                        value="${stockMaximo}" data-prod="${p.producto}" data-prod-id="${p.id}" data-field="${tiendaActual}" data-campo="stock_maximo" data-oldvalue="${stockMaximo}"
                        ${this.modoOrdenar ? 'disabled' : ''}>
                      </td>`;
            } else {
                rInv += `<td class="text-center text-info fw-bold">${stockMaximo}</td>`;
            }

            rInv += `<td class="text-center">
                    <input type="number" min="0" class="form-control form-control-sm text-center border-primary input-stock" 
                    value="${stockActual}" data-prod="${p.producto}" data-prod-id="${p.id}" data-field="${tiendaActual}" data-campo="stock_actual" data-oldvalue="${stockActual}"
                    ${this.modoOrdenar ? 'disabled' : ''}>
                  </td>`;

            if (isAdmin || isAuxiliar) {
                rInv += `<td class="text-center">
                          <button class="btn btn-sm btn-danger" title="Eliminar producto"
                          onclick="window.inventoryController.eliminarProducto(${p.id}, '${nombreProducto}')"
                          ${this.modoOrdenar ? 'disabled' : ''}>
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>`;
            }

            trInv.innerHTML = rInv;
            tbInventario.appendChild(trInv);
            
            // Event listeners a inputs (solo fuera del modo ordenar)
            if (!this.modoOrdenar) {
                const inputs = trInv.querySelectorAll('input:not([disabled])');
                inputs.forEach(input => {
                    input.addEventListener('blur', (e) => {
                        const valorActual = input.value;
                        const valorGuardado = input.getAttribute('data-oldvalue');
                        if (valorActual !== valorGuardado) {
                            this.handleDataChange(e);
                            input.setAttribute('data-oldvalue', valorActual);
                        }
                    });
                    if (input.type === 'number') {
                        input.addEventListener('change', () => {
                            if (input.value < 0) input.value = 0;
                        });
                    }
                });
            }
        });

        // Activar drag & drop si estamos en modo ordenar
        if (this.modoOrdenar) {
            this.activarDragDrop(tbInventario);
        }
    },




    async handleDataChange(e) {
        const input = e.target;
        if (!input) return;
        
        const campo = input.getAttribute('data-campo');
        const nombreProd = input.getAttribute('data-prod');
        
        if (!campo || !nombreProd) return;
        
        // Caso especial: cambio de nombre de producto
        if (campo === 'producto') {
            const nombreNew = input.value.trim();
            const nombreOld = input.getAttribute('data-oldvalue');
            const prodId = input.getAttribute('data-prod-id');
            const tiendaActual = this.getTiendaActual();
            
            if (!nombreOld || !nombreNew) {
                input.value = nombreOld;
                return;
            }
            
            if (nombreOld === nombreNew) {
                return;
            }
            
            try {
                // No pasar tiendaActual para que el cambio sea global en todas las tiendas
                await window.productModel.renameProducto(nombreOld, nombreNew);
                
                // Actualizar el valor antiguo para futuras ediciones
                input.setAttribute('data-oldvalue', nombreNew);
                
                window.ui.showNotify(`✅ Nombre de producto actualizado en todas las tiendas`, 'success');
                
                // Recargar tabla para mostrar cambios
                this.renderTable();
            } catch (err) {
                console.error('Error al renombrar producto:', err);
                input.value = nombreOld;
                window.ui.showNotify(`❌ Error al renombrar: ${err.message}`, 'error');
            }
            return;
        }
        
        // Casos normales: precio, stock_actual, stock_maximo
        const valor = campo === 'precio' ? Number(input.value) : Math.max(0, Number(input.value));
        
        // Para precio, stock_actual y stock_maximo, pasar la tienda desde data-field
        if (campo === 'precio' || campo === 'stock_actual' || campo === 'stock_maximo') {
            let tienda = input.getAttribute('data-field');
            if (!tienda) return;
            
            // Normalizar tienda
            const tiendaNorm = String(tienda).trim();
            
            // Si es "Todas", no guardar tienda (caso de lectura, no edición)
            if (tiendaNorm === 'Todas' || tiendaNorm === 'todas') {
                await window.productModel.updateProductoField(nombreProd, campo, valor, null);
            } else {
                await window.productModel.updateProductoField(nombreProd, campo, valor, tiendaNorm);
            }
        } else {
            await window.productModel.updateProductoField(nombreProd, campo, valor);
        }
    },
    
    async actualizarStock() {
        const profile = window.authModel.getProfile();
        const rol = (profile?.rol || '').toLowerCase().trim();
        if (rol === 'empleado') {
            window.ui?.showNotify?.('Acceso denegado', 'No tienes permiso para generar pedidos automáticos.', 'warning');
            return;
        }

        const btnActualizar = document.getElementById('btn-actualizar-stock');
        const iconoBtnOriginal = btnActualizar.innerHTML;
        const inputNombre = document.getElementById('nombreGeneradorPedido');
        
        try {
            // Validar nombre
            const nombreGenerador = inputNombre.value.trim();
            if (!nombreGenerador) {
                alert('Por favor completa tu nombre para generar pedidos automáticos');
                inputNombre.focus();
                inputNombre.classList.add('is-invalid');
                return;
            }
            inputNombre.classList.remove('is-invalid');
            const responsable = nombreGenerador;
            
            // Validar que se haya seleccionado una tienda específica
            const tiendaActual = this.getTiendaActual();
            const tiendaLower = String(tiendaActual).toLowerCase().trim();
            
            if (!tiendaActual || tiendaLower === 'todas' || tiendaLower === '') {
                alert('Por favor selecciona una tienda específica (no "Todas las tiendas") para generar pedidos automáticos');
                return;
            }
            
            // 🔍 Verificar que la tienda exista en el cache
            const tiendaExiste = window.productModel.tiendas.find(t => 
                String(t.nombre_tienda).trim() === String(tiendaActual).trim()
            );
            
            if (!tiendaExiste) {
                console.error(`❌ TIENDA NO ENCONTRADA: [${tiendaActual}]`);
                alert(`❌ Tienda no válida: "${tiendaActual}"\n\nSe esperaba una de las siguientes tiendas:\n${window.productModel.tiendas.map(t => `• ${t.nombre_tienda}`).join('\n')}`);
                return;
            }

            const { data: tiendasDB, error: tiendaDbError } = await window._supabase
                .from('Tienda de Sucursal')
                .select('id, nombre_tienda');

            if (tiendaDbError) {
                throw new Error(`❌ No se pudo validar la tienda en la base de datos: ${tiendaDbError.message}`);
            }

            const tiendaEnDb = (tiendasDB || []).find(t =>
                String(t.nombre_tienda).trim() === String(tiendaActual).trim()
            );

            if (!tiendaEnDb) {
                throw new Error(`❌ La tienda "${tiendaActual}" no existe en la base de datos.`);
            }
            
            
            // Cambiar estado del botón a cargando
            btnActualizar.disabled = true;
            btnActualizar.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Procesando...';
            
            // Recargar productos desde BD
            await window.productModel.fetchProductos();
            
            // 🔍 CRÍTICO: Cargar pedidos ANTES de procesar para detectar existentes y actualizar sin duplicar
            console.log('📡 Cargando pedidos desde Supabase...');
            await window.orderModel.fetchReportes(true);
            console.log(`✅ Pedidos cargados: ${window.orderModel.reportes.length} total, ${window.orderModel.reportes.filter(p => p.estado === 'pendiente').length} pendientes`);
            
            // Calcular stock faltante y crear pedidos automáticos
            const proveedorFiltroActual = document.getElementById('provSelect')?.value || 'todos';
            const productos = (proveedorFiltroActual && proveedorFiltroActual !== 'todos')
                ? window.productModel.getProductosFiltrados(proveedorFiltroActual)
                : window.productModel.getProductos();
            
            
            // Recolectar productos con stock faltante
            const productosConFaltante = [];
            const pedidosPorProveedor = {};
            
            // Verificar si hay al menos UN producto con stock_maximo > 0
            let productosConMaximo = 0;
            productos.forEach(p => {
                const stockMaximo = window.productModel.getStockMaximo(p.producto, tiendaActual) || 0;
                if (stockMaximo > 0) productosConMaximo++;
            });
            if (productosConMaximo === 0) {
                console.warn(`⚠️ ADVERTENCIA: Ningún producto tiene stock_maximo establecido. Verifica la tienda seleccionada: "${tiendaActual}"`);
            }
            
            const filtroActivo = (proveedorFiltroActual && proveedorFiltroActual !== 'todos') ? proveedorFiltroActual : null;
            console.log(`📦 Analizando ${productos.length} productos en tienda "${tiendaActual}"${filtroActivo ? ` (filtro: ${filtroActivo})` : ''}...`);
            productos.forEach(p => {
                try {
                    const stockActual = window.productModel.getStockActual(p.producto, tiendaActual) || 0;
                    const stockMaximo = window.productModel.getStockMaximo(p.producto, tiendaActual) || 0;
                    const faltante = Math.max(0, stockMaximo - stockActual);
                    
                    if (faltante > 0) {
                        productosConFaltante.push({
                            producto: p.producto,
                            faltante: faltante,
                            proveedor: p.proveedor || 'Sin Proveedor',
                            precio: p.precio || 0
                        });
                        
                        // Agrupar por proveedor - 🔀 FUSIÓN INTELIGENTE: NO duplicar productos
                        const prov = p.proveedor || 'Sin Proveedor';
                        if (!pedidosPorProveedor[prov]) {
                            pedidosPorProveedor[prov] = [];
                        }
                        
                        // Buscar si el producto ya existe en esta lista de proveedor
                        const productoExistente = pedidosPorProveedor[prov].find(item => item.producto === p.producto);
                        
                        if (productoExistente) {
                            // PRODUCTO YA EXISTE: ACTUALIZAR cantidad con el nuevo valor
                            productoExistente.cantidad_pedida = faltante;
                            productoExistente.stock_actual = stockActual;
                        } else {
                            // PRODUCTO NUEVO: AGREGAR a la lista
                            const nuevoItem = {
                                producto: p.producto,
                                cantidad_pedida: faltante,
                                precio_referencia: Number(p.precio) || 0,
                                stock_actual: stockActual
                            };
                            pedidosPorProveedor[prov].push(nuevoItem);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Error procesando producto ${p.producto}:`, err);
                }
            });
            
            
            // Si hay productos con faltante, crear u ACTUALIZAR órdenes (nunca duplicar)
            if (productosConFaltante.length > 0) {
                console.log(`\n📊 GENERANDO PEDIDOS por ${productosConFaltante.length} productos con faltante:`);
                console.log(JSON.stringify(pedidosPorProveedor, null, 2));
                
                // Usar mergeOrCreateOrder para FUSIONAR en lugar de duplicar
                const resultados = [];
                for (const [prov, detalle] of Object.entries(pedidosPorProveedor)) {
                    try {
                        console.log(`\n🏢 Procesando proveedor: "${prov}"`);
                        console.log(`   Tienda: "${tiendaActual}"`);
                        console.log(`   Productos: ${detalle.map(d => d.producto).join(', ')}`);
                        
                        const resultado = await window.orderModel.mergeOrCreateOrder(
                            tiendaActual,
                            prov,
                            detalle,
                            responsable
                        );
                        
                        console.log(`   ➜ Resultado: ${resultado.tipo} (ID: ${resultado.id})`);
                        resultados.push(resultado);
                    } catch (err) {
                        console.error(`❌ Error procesando ${prov}:`, err);
                        throw err;
                    }
                }
                
                // Actualizar reportes
                await window.orderModel.fetchReportes(true);
                
                // Guardar el nombre del responsable en sessionStorage
                sessionStorage.setItem('ultimoResponsable', responsable);
                
                // Contar creados vs actualizados
                const creados = resultados.filter(r => r.tipo === 'creado').length;
                const actualizados = resultados.filter(r => r.tipo === 'actualizado').length;
                
                console.log(`\n✅ RESUMEN: ${creados} creados + ${actualizados} actualizados`);
                const filtroMsg = filtroActivo ? `\n🏢 Proveedor: ${filtroActivo}` : '';
                alert(`✅ Pedido generado por: ${responsable}${filtroMsg}\n\n✨ Creados: ${creados} pedido(s)\n🔄 Actualizados: ${actualizados} pedido(s)\n\n📦 Total: ${productosConFaltante.length} producto(s)`);
            } else {
                
                const msg = productosConMaximo === 0 
                    ? `❌ Ningún producto en la tienda "${tiendaActual}" tiene stock máximo establecido.\n\nDebe establecer un "Stock Máx" > 0 para al menos un producto para generar pedidos.`
                    : `✅ Todos los productos en la tienda "${tiendaActual}" tienen stock actual ≥ stock máximo.\n\nNo hay stock faltante que reponer.`;
                
                alert(msg);
            }
            
            // Limpiar nombre después de generar pedidos
            inputNombre.value = '';
            
            // Re-renderizar tabla con los datos actualizados
            const proveedorFiltro = document.getElementById('provSelect')?.value || 'todos';
            this.renderTable(proveedorFiltro);
            
            // Mostrar mensaje de éxito
            btnActualizar.innerHTML = '<i class="bi bi-check-circle me-1"></i>¡Actualizado!';
            btnActualizar.classList.remove('btn-primary');
            btnActualizar.classList.add('btn-success');
            
            setTimeout(() => {
                btnActualizar.innerHTML = iconoBtnOriginal;
                btnActualizar.classList.remove('btn-success');
                btnActualizar.classList.add('btn-primary');
                btnActualizar.disabled = false;
            }, 2000);
        } catch (error) {
            console.error('❌ Error completo durante actualización de stock:', error);

            if (String(error?.message || '').includes('SESIÓN EXPIRADA')) {
                alert(`${error.message}\n\nLa aplicación recargará la sesión para que vuelvas a entrar.`);
                if (window.authModel?.clearSession) {
                    window.authModel.clearSession();
                }
                window.location.reload();
                return;
            }
            
            // Mostrar error detallado al usuario
            let mensajeError = error.message || 'Error desconocido';
            
            // Errores específicos de Supabase
            if (mensajeError.includes('RLS') || mensajeError.includes('PERMISO')) {
                mensajeError = '❌ PROBLEMA DE PERMISOS:\nLa tabla "pedidos" tiene Row Level Security bloqueando inserciones.\n\nSOLUCIÓN:\n1. Ve a Supabase → Tabla "pedidos"\n2. Habilita RLS\n3. Crea una política INSERT permitida\n\nVer: SUPABASE_CONFIG.md para instrucciones detalladas';
            } else if (mensajeError.includes('FOREIGN KEY')) {
                mensajeError = '❌ ERROR DE FOREIGN KEY:\nLa tienda especificada no existe en "Tienda de Sucursal".\n\nVERIFICA: El nombre exacto de la tienda debe coincidir.';
            }
            
            alert(mensajeError);
            
            btnActualizar.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i>Error';
            btnActualizar.classList.remove('btn-primary');
            btnActualizar.classList.add('btn-danger');
            
            setTimeout(() => {
                btnActualizar.innerHTML = iconoBtnOriginal;
                btnActualizar.classList.remove('btn-danger');
                btnActualizar.classList.add('btn-primary');
                btnActualizar.disabled = false;
            }, 2000);
        }
    },

    abrirModalProducto() {
        const modal = document.getElementById('modal-product');
        if (modal) {
            // Limpiar campos
            document.getElementById('prod-nombre').value = '';
            document.getElementById('prod-precio').value = '';
            document.getElementById('prod-proveedor').value = '';

            // Llenar datalist de proveedores
            const proveedores = window.productModel.getProveedores();
            const datalist = document.getElementById('proveedores-list');
            datalist.innerHTML = proveedores.map(p => `<option value="${p}">`).join('');

            modal.style.display = 'flex';
            window.appController?.focusFirstElementInModal?.(modal);
        }
    },

    cerrarModalProducto() {
        const modal = document.getElementById('modal-product');
        if (modal) {
            modal.style.display = 'none';
            // Limpiar campos
            document.getElementById('prod-nombre').value = '';
            document.getElementById('prod-precio').value = '';
            document.getElementById('prod-proveedor').value = '';
        }
    },

    async crearProducto() {
        const nombre = document.getElementById('prod-nombre').value.trim();
        const proveedor = document.getElementById('prod-proveedor').value.trim();
        const precio = parseFloat(document.getElementById('prod-precio').value);

        // Validar
        if (!nombre) {
            window.ui.showNotify('❌ Por favor ingresa el nombre del producto', 'error');
            document.getElementById('prod-nombre').focus();
            return;
        }

        if (!proveedor) {
            window.ui.showNotify('❌ Por favor selecciona un proveedor', 'error');
            document.getElementById('prod-proveedor').focus();
            return;
        }

        if (isNaN(precio) || precio < 0) {
            window.ui.showNotify('❌ Por favor ingresa un precio válido', 'error');
            document.getElementById('prod-precio').focus();
            return;
        }

        // Validar que el producto no exista
        const existente = window.productModel.getProductos().some(p => p.producto.toLowerCase() === nombre.toLowerCase());
        if (existente) {
            window.ui.showNotify(`❌ El producto "${nombre}" ya existe`, 'error');
            document.getElementById('prod-nombre').focus();
            return;
        }

        try {
            
            const btnConfirm = document.getElementById('btn-confirm-product');
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Creando...';

            // Insertar producto SIEMPRE para todas las tiendas
            await window.productModel.insertProducto(nombre, proveedor, precio, 'todas');

            window.ui.showNotify(`✅ Producto "${nombre}" creado para todas las tiendas`, 'success');

            // Cerrar modal
            this.cerrarModalProducto();

            // Recargar tabla
            await window.productModel.fetchProductos();
            window.inventoryController.init();

            btnConfirm.disabled = false;
            btnConfirm.innerHTML = '<i class="bi bi-check-circle me-2"></i>Crear Producto';
        } catch (err) {
            console.error('Error al crear producto:', err);
            window.ui.showNotify(`❌ Error al crear producto: ${err.message}`, 'error');
            document.getElementById('btn-confirm-product').disabled = false;
            document.getElementById('btn-confirm-product').innerHTML = '<i class="bi bi-check-circle me-2"></i>Crear Producto';
        }
    },

    async eliminarProducto(productoId, nombreProducto) {
        try {
            const btnEliminar = event?.target?.closest('button');
            if (btnEliminar) btnEliminar.disabled = true;
            
            const tiendaActual = this.getTiendaActual();
            const isTodas = !tiendaActual || tiendaActual === 'todas' || tiendaActual.toLowerCase() === 'todas las tiendas';

            const msgConfirm = isTodas
                ? `¿Estás seguro de que deseas eliminar "${nombreProducto}" de TODAS las tiendas?`
                : `¿Estás seguro de que deseas eliminar "${nombreProducto}" de la tienda "${tiendaActual}"?`;

            if (!confirm(msgConfirm)) {
                if (btnEliminar) btnEliminar.disabled = false;
                return;
            }

            await window.productModel.deleteProducto(productoId, tiendaActual);
            
            const msgNotify = isTodas
                ? `✅ Producto "${nombreProducto}" eliminado de todas las tiendas`
                : `✅ Producto "${nombreProducto}" eliminado de "${tiendaActual}"`;

            window.ui.showNotify(msgNotify, 'success');
            
            // Recargar tabla
            await window.productModel.fetchProductos();
            this.renderTable(document.getElementById('provSelect')?.value || 'todos');
        } catch (err) {
            console.error('Error al eliminar producto:', err);
            window.ui.showNotify(`❌ Error al eliminar producto: ${err.message}`, 'error');
        }
    }
};

window.inventoryController = inventoryController;
