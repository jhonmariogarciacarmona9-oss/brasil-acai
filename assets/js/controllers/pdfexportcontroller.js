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
    },

    /**
     * Exporta e inicia envío automático por email/PDF a los proveedores seleccionados
     */
    async exportarProveedoresSeleccionadosPDF(grupos) {
        try {
            if (!grupos || grupos.length === 0) {
                window.ui.showNotify('⚠️ No hay elementos seleccionados para enviar.', 'warning');
                return;
            }

            console.log('✉️ Procesando envío a proveedores para grupos:', grupos);

            // Agrupar por proveedor
            const porProveedor = {};
            grupos.forEach(g => {
                const provNombre = g.proveedor || 'Sin Proveedor';
                if (!porProveedor[provNombre]) {
                    porProveedor[provNombre] = {
                        nombre: provNombre,
                        emails: [],
                        items: []
                    };
                }

                if (window.providerModel) {
                    const provObj = window.providerModel.getProveedores(false).find(p => String(p.nombre).trim().toLowerCase() === String(provNombre).trim().toLowerCase());
                    if (provObj) {
                        if (Array.isArray(provObj.emails) && provObj.emails.length > 0) {
                            provObj.emails.forEach(em => {
                                if (em && !porProveedor[provNombre].emails.includes(em)) {
                                    porProveedor[provNombre].emails.push(em);
                                }
                            });
                        }
                        if (provObj.email) {
                            const split = String(provObj.email).split(/[;,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
                            split.forEach(em => {
                                if (em && !porProveedor[provNombre].emails.includes(em)) {
                                    porProveedor[provNombre].emails.push(em);
                                }
                            });
                        }
                    }
                }

                (g.items || []).forEach(item => {
                    porProveedor[provNombre].items.push({
                        producto: g.producto,
                        tienda: item.tienda,
                        cantidad: item.cantidad,
                        precio: item.precio,
                        stock_actual: item.stock_actual,
                        responsable: item.responsable,
                        fecha: item.fecha,
                        emailProveedor: item.emailProveedor || ''
                    });

                    if (item.emailProveedor && !porProveedor[provNombre].emails.includes(item.emailProveedor)) {
                        porProveedor[provNombre].emails.push(item.emailProveedor);
                    }
                });
            });

            const listProveedores = Object.values(porProveedor);

            // Enviar desde el backend evita CORS de Apps Script y el fallback mailto
            // que abre una pestaña about:blank si el navegador no tiene cliente de correo.
            if (!window._supabase?.functions?.invoke) {
                window.ui.showNotify('No está disponible la conexión con Supabase. Recarga la aplicación e inténtalo de nuevo.', 'danger');
                return;
            }

            const senderEmail = localStorage.getItem('apps_script_sender_email') || '';
            const orders = listProveedores.map(provData => ({
                proveedor: provData.nombre,
                correos: provData.emails,
                items: provData.items.map(item => ({
                    producto: item.producto || '-',
                    cantidad_a_pedir: Number(item.cantidad) || 0
                })),
                tiendas: Array.from(new Set(provData.items.map(item => String(item.tienda || '').trim()).filter(Boolean)))
            }));

            window.ui.showNotify('Enviando pedidos a los proveedores...', 'info');
            const { data, error } = await window._supabase.functions.invoke('send-provider-orders', {
                body: { senderEmail, orders }
            });

            if (error) {
                console.error('Error en send-provider-orders:', error);
                window.ui.showNotify(`No se pudo completar el envío: ${error.message || 'Error de conexión con Supabase'}`, 'danger');
                return;
            }

            const resultados = Array.isArray(data?.results) ? data.results : [];
            const fallidos = resultados.filter(resultado => !resultado.ok);
            const enviadosBackend = Number(data?.sent) || resultados.filter(resultado => resultado.ok).length;

            if (enviadosBackend > 0 && fallidos.length === 0) {
                window.ui.showNotify(`Pedidos enviados correctamente a ${enviadosBackend} proveedor(es).`, 'success');
            } else if (enviadosBackend > 0) {
                window.ui.showNotify(`Enviados: ${enviadosBackend}. Con error: ${fallidos.map(resultado => `${resultado.proveedor}: ${resultado.detail}`).join('; ')}`, 'warning');
            } else {
                const detalle = fallidos.map(resultado => `${resultado.proveedor}: ${resultado.detail}`).join('; ');
                window.ui.showNotify(`No se enviaron los pedidos${detalle ? `: ${detalle}` : '.'}`, 'danger');
            }
            return;

            let enviados = 0;

            const webhookUrl = localStorage.getItem('apps_script_webhook_url') || window.APPS_SCRIPT_WEBHOOK_URL || '';
            const webhookKey = localStorage.getItem('apps_script_webhook_key') || '';

            for (const provData of listProveedores) {
                const nombreProv = provData.nombre;
                const itemsProv = provData.items;
                const emails = provData.emails;

                const datosPdf = itemsProv.map(it => ({
                    fecha: it.fecha ? new Date(it.fecha).toLocaleString('es-ES') : '-',
                    tienda: it.tienda || '-',
                    proveedor: nombreProv,
                    producto: it.producto || '-',
                    cantidad_maxima: (it.stock_actual || 0) + (it.cantidad || 0),
                    cantidad_actual: it.stock_actual || 0,
                    cantidad_a_pedir: it.cantidad || 0,
                    coste: (it.cantidad || 0) * (it.precio || 0),
                    responsable: it.responsable || '-',
                    estado: 'pendiente'
                }));

                const filtrosHeader = {
                    tienda: 'Varias',
                    proveedor: nombreProv,
                    fecha: new Date().toLocaleDateString('es-ES')
                };

                // Generar PDF en memoria (autoSave: false) sin abrir emergentes ni descargas automáticas
                let pdfResult = null;
                try {
                    pdfResult = await window.pdfGenerator.generarReporteStockFaltante(`Pedido_${nombreProv}`, datosPdf, filtrosHeader, { autoSave: false });
                } catch (pdfErr) {
                    console.warn(`⚠️ Error generando PDF para ${nombreProv}:`, pdfErr);
                }

                if (webhookUrl && emails && emails.length > 0) {
                    try {
                        window.ui.showNotify(`✉️ Enviando correo automático a ${nombreProv}...`, 'info');

                        let htmlBody = `<h3 style="color:#7c3aed;">Pedido de Insumos - Brasil Açaí</h3>`;
                        htmlBody += `<p>Estimado/a <strong>${nombreProv}</strong>,</p>`;
                        htmlBody += `<p>Adjuntamos el pedido de insumos para las tiendas de Brasil Açaí:</p>`;
                        htmlBody += `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; border-color:#e5e7eb;">`;
                        htmlBody += `<tr style="background-color:#7c3aed; color:#ffffff;"><th>Producto</th><th style="text-align:center;">Cantidad</th><th>Tienda Destino</th></tr>`;
                        itemsProv.forEach(it => {
                            htmlBody += `<tr><td>${it.producto}</td><td style="text-align:center;"><b>${it.cantidad}</b></td><td>${it.tienda}</td></tr>`;
                        });
                        htmlBody += `</table><br/><p>Generado el: ${new Date().toLocaleString('es-ES')}</p><p>Gracias,<br/><b>Brasil Açaí SGP</b></p>`;

                        const senderEmail = localStorage.getItem('apps_script_sender_email') || '';

                        const payload = {
                            webhookKey: webhookKey,
                            senderEmail: senderEmail,
                            to: emails,
                            subject: `Pedido de Insumos Brasil Açaí - ${nombreProv}`,
                            html: htmlBody,
                            attachment: pdfResult?.base64 ? {
                                filename: pdfResult.filename || `Pedido_${nombreProv}.pdf`,
                                mimeType: 'application/pdf',
                                base64: pdfResult.base64
                            } : null
                        };

                        const response = await fetch(webhookUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify(payload)
                        });

                        const resData = await response.json().catch(() => ({}));
                        if (resData.ok) {
                            window.ui.showNotify(`✅ Correo enviado automáticamente a ${nombreProv} (${emails.join(', ')})`, 'success');
                            enviados++;
                        } else {
                            console.warn('⚠️ Google Apps Script devolvió error:', resData);
                            window.ui.showNotify(`⚠️ Error del webhook para ${nombreProv}: ${resData.error || resData.message || 'Error desconocido'}. Intenta con tu cliente de correo.`, 'warning');
                            this._enviarMailtoFallback(emails, nombreProv, itemsProv);
                            enviados++;
                        }
                    } catch (netErr) {
                        console.error('Error enviando vía Webhook:', netErr);
                        window.ui.showNotify(`⚠️ No se pudo conectar con el webhook. Abriendo cliente de correo...`, 'warning');
                        this._enviarMailtoFallback(emails, nombreProv, itemsProv);
                        enviados++;
                    }
                } else if (emails && emails.length > 0) {
                    // Sin webhook configurado: abrir cliente de correo
                    window.ui.showNotify(`ℹ️ No hay webhook configurado. Abriendo cliente de correo para ${nombreProv}...`, 'info');
                    this._enviarMailtoFallback(emails, nombreProv, itemsProv);
                    enviados++;
                } else {
                    window.ui.showNotify(`⚠️ El proveedor "${nombreProv}" no tiene un correo electrónico registrado. Ve a Proveedores para añadirlo.`, 'warning');
                }
            }

            if (enviados > 0) {
                window.ui.showNotify(`✅ Envío completado para ${enviados} proveedor(es).`, 'success');
            }

        } catch (err) {
            console.error('❌ Error en exportarProveedoresSeleccionadosPDF:', err);
            window.ui.showNotify(`❌ Error al enviar a proveedores: ${err.message}`, 'danger');
        }
    },

    _enviarMailtoFallback(emails, nombreProv, itemsProv) {
        const emailTo = emails.join(',');
        const subject = encodeURIComponent(`Pedido de Insumos Brasil Açaí - ${nombreProv}`);

        let bodyText = `Hola ${nombreProv},\n\nSolicitamos los siguientes insumos para las tiendas de Brasil Açaí:\n\n`;
        itemsProv.forEach(it => {
            bodyText += `• ${it.producto}: ${it.cantidad} unidad(es) (Tienda: ${it.tienda})\n`;
        });
        bodyText += `\nGenerado el: ${new Date().toLocaleString('es-ES')}\n\nGracias,\nBrasil Açaí SGP`;

        const body = encodeURIComponent(bodyText);
        const mailtoUrl = `mailto:${emailTo}?subject=${subject}&body=${body}`;
        // Usar window.open con _blank para abrir el cliente de correo sin navegar fuera de la app
        window.open(mailtoUrl, '_blank');
    }
};

window.pdfExportController = pdfExportController;
