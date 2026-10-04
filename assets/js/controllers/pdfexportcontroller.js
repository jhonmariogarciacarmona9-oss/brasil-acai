/**
 * PDF Export Controller
 * Maneja la exportación de reportes a PDF
 */

const pdfExportController = {
    
    bindEvents() {
        console.log('🔗 Binding PDF Export Events...');
        
        // Botón exportar Gastos PDF
        const btnExportGastos = document.getElementById('btn-export-gastos-pdf');
        if (btnExportGastos) {
            btnExportGastos.addEventListener('click', () => this.exportarGastosPDF());
        }
        
        // Botón exportar Reportes PDF
        const btnExportReportes = document.getElementById('btn-export-reportes-pdf');
        if (btnExportReportes) {
            btnExportReportes.addEventListener('click', () => this.exportarReportesPDF());
        }
        
        // Botón exportar Stock Faltante PDF
        const btnExportStock = document.getElementById('btn-export-stock-pdf');
        if (btnExportStock) {
            btnExportStock.addEventListener('click', () => this.exportarStockFaltantePDF());
        }

        // Botón exportar Stock Faltante Excel
        const btnExportStockExcel = document.getElementById('btn-export-stock-excel');
        if (btnExportStockExcel) {
            btnExportStockExcel.addEventListener('click', () => this.exportarStockFaltanteExcel());
        }
    },
    
    /**
     * Exporta gastos a PDF
     */
    async exportarGastosPDF() {
        try {
            console.log('📄 Iniciando exportación de Gastos...');
            
            // Obtener datos frescos - cada fetch independiente para no perder datos
            let expenses = [];
            let orders = [];
            
            try {
                if (window.expenseModel && window.expenseModel.fetchExpenses) {
                    expenses = await window.expenseModel.fetchExpenses() || [];
                }
            } catch (e) {
                console.warn('⚠️ Error cargando gastos, continuando con datos vacíos:', e);
            }
            
            try {
                if (window.orderModel && window.orderModel.fetchReportes) {
                    orders = await window.orderModel.fetchReportes(true) || [];
                }
            } catch (e) {
                console.warn('⚠️ Error cargando pedidos, continuando sin insumos:', e);
            }
            
            // Obtener tienda y filtro seleccionado
            const tiendaSeleccionada = document.getElementById('tiendaSelect')?.value || 'todas';
            const filtroVista = document.getElementById('filtro-vista-gastos')?.value || 'total';
            
            // Obtener usuario actual para permisos
            const profile = window.authModel.getProfile();
            const rol = (profile.rol || '').toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            
            let datos = [];
            
            // 📊 GASTOS MANUALES
            if (filtroVista === 'total' || filtroVista === 'manual') {
                expenses.forEach(gasto => {
                    // Filtrar por tienda si no es admin
                    if (tiendaSeleccionada !== 'todas' && tiendaSeleccionada !== 'Todas') {
                        // Extraer tienda de descripción o comparar
                        const gastotienda = (gasto.tienda || '').trim();
                        const seleccionada = String(tiendaSeleccionada).trim();
                        if (gastotienda && gastotienda !== seleccionada) return;
                    }
                    
                    datos.push({
                        concepto: gasto.descripcion || '-',
                        tipo: gasto.categoria || '-',
                        monto: parseFloat(gasto.monto) || 0,
                        fecha: gasto.fecha || new Date().toISOString(),
                        origen: 'manual'
                    });
                });
            }
            
            // 📦 GASTOS DE PEDIDOS (Insumos)
            if (filtroVista === 'total' || filtroVista === 'pedidos') {
                orders.forEach(pedido => {
                    // Filtrar por tienda
                    if (tiendaSeleccionada !== 'todas' && tiendaSeleccionada !== 'Todas') {
                        const pedidoTienda = (pedido.tienda || '').trim();
                        const seleccionada = String(tiendaSeleccionada).trim();
                        if (pedidoTienda && pedidoTienda !== seleccionada) return;
                    }
                    
                    // Procesar cada detalle del pedido
                    const detalles = pedido.detalle || [];
                    detalles.forEach(item => {
                        const itemCompletado = item?.estado_producto === 'completado' || item?.archivado === true;
                        const pedidoCompletado = pedido?.estado === 'completado';
                        if (!itemCompletado && !pedidoCompletado) return;

                        const cost = (item.cantidad_pedida || 0) * (item.precio_referencia || 0);
                        datos.push({
                            concepto: item.producto || '-',
                            tipo: 'Insumos',
                            monto: cost,
                            fecha: pedido.fecha || new Date().toISOString(),
                            origen: 'pedido'
                        });
                    });
                });
            }
            
            if (datos.length === 0) {
                window.ui.showNotify('❌ No hay datos de gastos para exportar con ese filtro', 'warning');
                return;
            }
            
            // Preparar filtros para el PDF
            const filtros = {
                tienda: tiendaSeleccionada === 'todas' || tiendaSeleccionada === 'Todas' ? 'General' : tiendaSeleccionada,
                tipo: filtroVista === 'total' ? 'General' : (filtroVista === 'manual' ? 'Gastos Manuales' : 'Gastos de Pedidos'),
            };
            
            console.log(`✅ Exportando ${datos.length} gastos...`);
            // Generar PDF
            await window.pdfGenerator.generarReporteGastos('Reporte de Gastos', datos, filtros);
            window.ui.showNotify('✅ PDF exportado correctamente', 'success');
            
        } catch (error) {
            console.error('❌ Error exportando gastos:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },
    
    /**
     * Extrae el proveedor de las observaciones de un pedido
     */
    _extraerProveedor(ped) {
        if (ped?.proveedor) {
            return String(ped.proveedor).trim();
        }

        let proveedor = '-';
        if (ped.observaciones) {
            if (ped.observaciones.includes('Proveedor:')) {
                const parts = ped.observaciones.split('Proveedor: ')[1];
                if (parts) proveedor = parts.split(' |')[0].trim();
            } else if (ped.observaciones.includes('destinado a')) {
                proveedor = ped.observaciones.split('destinado a ')[1].split(' generado por')[0];
            }
        }
        return proveedor;
    },

    /**
     * Exporta reportes/compras a PDF — respeta filtros activos (proveedor, fecha, tienda)
     */
    async exportarReportesPDF() {
        try {
            console.log('📄 Iniciando exportación de Reportes...');

            // Leer filtros activos del DOM
            const tiendaFiltro = document.getElementById('tiendaSelect')?.value || 'todas';
            const provFiltro = document.getElementById('provReporteSelect')?.value || 'todos';
            const fechaFiltro = document.getElementById('fechaReporteSelect')?.value || '';

            let pedidos = window.orderModel?.reportes || [];

            // Filtro de fecha por MES (igual que reportController)
            if (fechaFiltro) {
                const mesExport = fechaFiltro.substring(0, 7); // "YYYY-MM"
                pedidos = pedidos.filter(ped => {
                    try {
                        const d = new Date(ped.fecha);
                        if (isNaN(d.getTime())) return ped.fecha.substring(0, 7) === mesExport;
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        return `${y}-${m}` === mesExport;
                    } catch (_) {
                        return ped.fecha.substring(0, 7) === mesExport;
                    }
                });
            }

            // Filtro de tienda
            if (tiendaFiltro !== 'todas') {
                pedidos = pedidos.filter(p => p.tienda === tiendaFiltro);
            }

            // Construir filas con filtro de proveedor
            let datos = [];
            pedidos.forEach(ped => {
                const proveedor = this._extraerProveedor(ped);
                if (provFiltro !== 'todos' && proveedor !== provFiltro) return;

                const detalles = ped.detalle || [];
                detalles.forEach(item => {
                    const coste = (item.cantidad_pedida || 0) * (item.precio_referencia || 0);
                    datos.push({
                        fecha: new Date(ped.fecha).toLocaleString('es-ES'),
                        tienda: ped.tienda || '-',
                        proveedor: proveedor,
                        producto: item.producto || '-',
                        stockRegistrado: item.stock_actual || 0,
                        aPedir: item.cantidad_pedida || 0,
                        coste: coste,
                        estado: ped.estado || '-'
                    });
                });
            });

            if (datos.length === 0) {
                window.ui.showNotify('❌ No hay datos de reportes para exportar', 'warning');
                return;
            }

            // Preparar filtros para el encabezado del PDF
            const filtros = {
                tienda: tiendaFiltro === 'todas' ? 'Todas' : tiendaFiltro,
                proveedor: provFiltro !== 'todos' ? provFiltro : 'Todos',
                fecha: fechaFiltro || 'Sin filtro'
            };

            // Generar PDF con tabla completa
            await window.pdfGenerator.generarReportePedidos('Reporte de Pedidos', datos, filtros);

        } catch (error) {
            console.error('❌ Error exportando reportes:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },

    _extractYMD(fechaStr) {
        if (!fechaStr) return '';
        const raw = String(fechaStr).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);

        try {
            const date = new Date(raw);
            if (isNaN(date.getTime())) return raw.substring(0, 10);
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        } catch (_) {
            return raw.substring(0, 10);
        }
    },

    _extraerResponsable(ped) {
        if (!ped?.observaciones) return 'Usuario';
        const match = String(ped.observaciones).match(/Responsable:\s*([^,\n]+)/);
        return match ? match[1].trim() : 'Usuario';
    },

    _parseNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    },

    _resolveDetalle(detalle) {
        if (Array.isArray(detalle)) return detalle;
        if (typeof detalle === 'string') {
            try {
                const parsed = JSON.parse(detalle);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        }
        return [];
    },

    /**
     * Exporta stock faltante a PDF usando datos del modelo (sin scrapeo de DOM)
     */
    async exportarStockFaltantePDF() {
        try {
            console.log('📄 Iniciando exportación de Stock Faltante...');

            const fechaFiltro = document.getElementById('fechaFiltroFaltante')?.value || '';
            const proveedorFiltro = document.getElementById('proveedorFiltroFaltante')?.value || 'todos';
            const responsableFiltro = document.getElementById('responsableFiltroFaltante')?.value || 'todos';
            const tiendaFiltro = document.getElementById('tiendaSelect')?.value || 'todas';

            let pedidos = (window.orderModel?.reportes || []).filter(p => !p.archivado);

            if (fechaFiltro) {
                const fechaSeleccionada = this._extractYMD(fechaFiltro);
                pedidos = pedidos.filter(p => this._extractYMD(p.created_at || p.fecha) === fechaSeleccionada);
            }

            if (tiendaFiltro !== 'todas') {
                pedidos = pedidos.filter(p => p.tienda === tiendaFiltro);
            }

            const datos = [];

            pedidos.forEach(pedido => {
                const proveedor = this._extraerProveedor(pedido);
                if (proveedorFiltro !== 'todos' && proveedor !== proveedorFiltro) return;

                const responsable = this._extraerResponsable(pedido);
                if (responsableFiltro !== 'todos' && responsable !== responsableFiltro) return;
                const fechaRaw = pedido.created_at || pedido.fecha;
                const fechaTexto = fechaRaw ? new Date(fechaRaw).toLocaleString('es-ES') : '-';

                const detalles = this._resolveDetalle(pedido.detalle);
                detalles.forEach(prod => {
                    if (prod?.archivado) return;

                    const cantidadPedida = this._parseNumber(prod.cantidad_pedida);
                    const precioRef = this._parseNumber(prod.precio_referencia);
                    const stockActual = this._parseNumber(prod.stock_actual ?? prod.stock_registrado);
                    const stockMaximo = stockActual + cantidadPedida;

                    datos.push({
                        fecha: fechaTexto,
                        tienda: pedido.tienda || '-',
                        proveedor,
                        producto: prod.producto || '-',
                        cantidad_maxima: stockMaximo,
                        cantidad_actual: stockActual,
                        cantidad_a_pedir: cantidadPedida,
                        coste: cantidadPedida * precioRef,
                        responsable,
                        estado: prod.estado_producto || 'recibido'
                    });
                });
            });

            datos.sort((a, b) => {
                const provCmp = String(a.proveedor).localeCompare(String(b.proveedor), 'es');
                if (provCmp !== 0) return provCmp;
                const prodCmp = String(a.producto).localeCompare(String(b.producto), 'es');
                if (prodCmp !== 0) return prodCmp;
                return String(a.tienda).localeCompare(String(b.tienda), 'es');
            });

            if (datos.length === 0) {
                window.ui.showNotify('❌ No hay datos de stock faltante para exportar', 'warning');
                return;
            }

            const filtros = {
                tienda: tiendaFiltro === 'todas' ? 'Todas' : tiendaFiltro,
                proveedor: proveedorFiltro !== 'todos' ? proveedorFiltro : 'Todos',
                responsable: responsableFiltro !== 'todos' ? responsableFiltro : 'Todos',
                fecha: fechaFiltro || 'Sin filtro'
            };

            await window.pdfGenerator.generarReporteStockFaltante('Reporte de Stock Faltante', datos, filtros);

        } catch (error) {
            console.error('❌ Error exportando stock faltante:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },

    /**
     * Exporta stock faltante a Excel usando los mismos filtros activos que la tabla
     */
    async exportarStockFaltanteExcel() {
        try {
            console.log('📊 Iniciando exportación de Stock Faltante a Excel...');

            if (typeof XLSX === 'undefined') {
                throw new Error('La libreria XLSX no esta disponible');
            }

            const fechaFiltro = document.getElementById('fechaFiltroFaltante')?.value || '';
            const proveedorFiltro = document.getElementById('proveedorFiltroFaltante')?.value || 'todos';
            const responsableFiltro = document.getElementById('responsableFiltroFaltante')?.value || 'todos';
            const tiendaFiltro = document.getElementById('tiendaSelect')?.value || 'todas';

            let pedidos = (window.orderModel?.reportes || []).filter(p => !p.archivado);

            if (fechaFiltro) {
                const fechaSeleccionada = this._extractYMD(fechaFiltro);
                pedidos = pedidos.filter(p => this._extractYMD(p.created_at || p.fecha) === fechaSeleccionada);
            }

            if (tiendaFiltro !== 'todas') {
                pedidos = pedidos.filter(p => p.tienda === tiendaFiltro);
            }

            const filasExcel = [];

            pedidos.forEach(pedido => {
                const proveedor = this._extraerProveedor(pedido);
                if (proveedorFiltro !== 'todos' && proveedor !== proveedorFiltro) return;

                const responsable = this._extraerResponsable(pedido);
                if (responsableFiltro !== 'todos' && responsable !== responsableFiltro) return;

                const fechaRaw = pedido.created_at || pedido.fecha;
                const fechaTexto = fechaRaw ? new Date(fechaRaw).toLocaleString('es-ES') : '-';

                const detalles = this._resolveDetalle(pedido.detalle);
                detalles.forEach(prod => {
                    if (prod?.archivado) return;

                    const cantidadPedida = this._parseNumber(prod.cantidad_pedida);
                    const precioRef = this._parseNumber(prod.precio_referencia);
                    const stockActual = this._parseNumber(prod.stock_actual ?? prod.stock_registrado);
                    const stockMaximo = stockActual + cantidadPedida;

                    filasExcel.push({
                        Fecha: fechaTexto,
                        Tienda: pedido.tienda || '-',
                        Proveedor: proveedor,
                        Producto: prod.producto || '-',
                        'Cantidad Maxima': stockMaximo,
                        'Cantidad Actual': stockActual,
                        'Cantidad a Pedir': cantidadPedida,
                        Coste: cantidadPedida * precioRef,
                        Responsable: responsable,
                        Estado: prod.estado_producto || 'recibido'
                    });
                });
            });

            filasExcel.sort((a, b) => {
                const provCmp = String(a.Proveedor).localeCompare(String(b.Proveedor), 'es');
                if (provCmp !== 0) return provCmp;
                const prodCmp = String(a.Producto).localeCompare(String(b.Producto), 'es');
                if (prodCmp !== 0) return prodCmp;
                return String(a.Tienda).localeCompare(String(b.Tienda), 'es');
            });

            if (filasExcel.length === 0) {
                window.ui.showNotify('❌ No hay datos de stock faltante para exportar', 'warning');
                return;
            }

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(filasExcel);
            XLSX.utils.book_append_sheet(wb, ws, 'Stock Faltante');

            const marcaResponsable = responsableFiltro !== 'todos' ? `_${responsableFiltro}` : '';
            const marcaFecha = fechaFiltro ? `_${fechaFiltro}` : '';
            const nombreArchivo = `stock_faltante${marcaResponsable}${marcaFecha}.xlsx`;

            XLSX.writeFile(wb, nombreArchivo);
            window.ui.showNotify('✅ Excel exportado correctamente', 'success');
        } catch (error) {
            console.error('❌ Error exportando stock faltante a Excel:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    }
};

window.pdfExportController = pdfExportController;
