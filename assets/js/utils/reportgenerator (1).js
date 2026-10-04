/**
 * Report Generator - Genera reportes en PDF con diseño profesional
 */

const reportGenerator = {
    
    styles: {
        primaryColor: '#6D53A1',
        secondaryColor: '#6D53A1',
        successColor: '#28a745',
        dangerColor: '#dc3545',
        neutralColor: '#6c757d',
        lightBg: '#f8f9fa',
        borderColor: '#dee2e6'
    },

    /**
     * Genera un reporte de gastos en PDF
     */
    async generateExpenseReport(expenses = [], orders = [], currentView = 'total', tiendaFiltro = 'todas') {
        try {
            if (typeof html2pdf === 'undefined') {
                throw new Error('Librería html2pdf no disponible');
            }

            // Filtrar por tienda si no es "todas"
            let expensesFiltradas = expenses;
            let ordersFiltradas = orders;
            
            if (tiendaFiltro !== 'todas') {
                expensesFiltradas = expenses.filter(e => (e.tienda || 'General') === tiendaFiltro);
                ordersFiltradas = orders.filter(o => o.tienda === tiendaFiltro);
            }

            const contenido = this.createExpenseContent(expensesFiltradas, ordersFiltradas, currentView, tiendaFiltro);
            
            const opt = {
                margin: 12,
                filename: `Reporte_Gastos_${tiendaFiltro !== 'todas' ? tiendaFiltro + '_' : ''}${this.getDateString()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
            };

            return new Promise((resolve, reject) => {
                html2pdf().set(opt).from(contenido).save();
                resolve('PDF generado exitosamente');
            });
        } catch (error) {
            throw error;
        }
    },

    /**
     * Genera un reporte de pedidos en PDF
     */
    async generateReportesPDF(reportes = [], tiendaFiltro = 'todas', mostrarArchivados = false) {
        try {
            if (typeof html2pdf === 'undefined') {
                throw new Error('Librería html2pdf no disponible');
            }

            reportes.forEach((r, i) => {
                if ((r.detalle || []).length > 0) {
                    r.detalle.forEach((d, j) => {
                    });
                }
            });

            // Filtrar por tienda si no es "todas"
            let reportesFiltrados = reportes;
            if (tiendaFiltro !== 'todas') {
                reportesFiltrados = reportes.filter(r => r.tienda === tiendaFiltro);
            }

            const contenido = this.createReportesContent(reportesFiltrados, tiendaFiltro, mostrarArchivados);
            
            // Ajustar márgenes basado en cantidad de datos
            const tienePocosDatos = reportesFiltrados.length < 5;
            const opt = {
                margin: [15, 10, 15, 10],
                filename: `Reporte_Pedidos_${tiendaFiltro !== 'todas' ? tiendaFiltro + '_' : ''}${this.getDateString()}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { 
                    scale: 1.5, 
                    useCORS: true, 
                    allowTaint: true, 
                    logging: false,
                    letterRendering: true,
                    backgroundColor: '#ffffff',
                    allowTaint: true
                },
                jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }
            };

            return new Promise((resolve, reject) => {
                html2pdf().set(opt).from(contenido).save();
                resolve('PDF generado exitosamente');
            });
        } catch (error) {
            throw error;
        }
    },

    /**
     * Crea el contenido HTML del reporte de gastos
     */
    createExpenseContent(expenses, orders, currentView, tiendaFiltro = 'todas') {
        const container = document.createElement('div');
        container.style.cssText = `padding: 12px; font-family: Arial, sans-serif; color: #333;`;

        // Agregar estilos con importación de fuente
        container.appendChild(this.createFontStyles());

        const headerTitulo = tiendaFiltro !== 'todas' ? `Reporte de Gastos - ${tiendaFiltro}` : 'Reporte de Gastos';
        container.appendChild(this.createHeader(headerTitulo));
        container.appendChild(this.createReportDate());
        
        const summary = this.calculateExpenseSummary(expenses, orders, currentView);
        container.appendChild(this.createFinancialSummary(summary, currentView));

        if (currentView === 'total' || currentView === 'manual') {
            container.appendChild(this.createExpensesTable(expenses));
        }

        if (currentView === 'total' || currentView === 'pedidos') {
            container.appendChild(this.createOrdersTable(orders));
        }

        container.appendChild(this.createFooter());
        return container;
    },

    /**
     * Crea el contenido HTML del reporte de pedidos
     */
    createReportesContent(reportes, tiendaFiltro = 'todas', mostrarArchivados = false) {
        const container = document.createElement('div');
        container.style.cssText = `padding: 12px; font-family: Arial, sans-serif; color: #333; page-break-after: avoid;`;

        // Agregar estilos con importación de fuente
        container.appendChild(this.createFontStyles());

        const headerTitulo = tiendaFiltro !== 'todas' ? `Reporte de Pedidos - ${tiendaFiltro}` : 'Reporte de Pedidos';
        container.appendChild(this.createHeader(headerTitulo));
        container.appendChild(this.createReportDate());

        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `background: ${this.styles.lightBg}; padding: 10px; border-radius: 5px; margin: 8px 0; border-left: 4px solid ${this.styles.primaryColor};`;
        infoDiv.innerHTML = `<p style="margin: 0; font-weight: bold;">Total Pedidos: <span style="color: ${this.styles.primaryColor}; font-size: 16px;">${reportes.length}</span></p>`;
        container.appendChild(infoDiv);

        container.appendChild(this.createReportesTable(reportes, mostrarArchivados));
        container.appendChild(this.createFooter());
        
        return container;
    },

    /**
     * Crea estilos y fuentes para el reporte
     */
    createFontStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700;800;900&display=swap');
            
            .brand-title {
                font-family: 'Fredoka', sans-serif !important;
                font-weight: 900 !important;
                letter-spacing: -0.5px !important;
            }
            
            /* Evitar cortes de filas entre páginas */
            table {
                page-break-inside: avoid;
            }
            
            tbody tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            
            thead tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
            
            /* Prevenir viudas/huérfanas */
            p {
                widows: 3;
                orphans: 3;
            }
        `;
        return style;
    },

    /**
     * Crea el header
     */
    createHeader(titulo) {
        const header = document.createElement('div');
        header.style.cssText = `display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 3px solid ${this.styles.primaryColor}; padding-bottom: 12px; margin-bottom: 12px;`;

        // Contenedor de texto (izquierda)
        const textContainer = document.createElement('div');
        textContainer.style.cssText = 'flex: 1; text-align: left;';

        // Imagen del eslogan en lugar de texto
        const eslogan = document.createElement('img');
        eslogan.src = 'assets/eslogan.png';
        eslogan.style.cssText = `max-height: 60px; max-width: 300px; margin-bottom: 8px; object-fit: contain;`;
        textContainer.appendChild(eslogan);

        const title = document.createElement('h2');
        title.textContent = titulo;
        title.style.cssText = `color: ${this.styles.secondaryColor}; font-size: 16px; margin: 0; font-weight: 600;`;
        textContainer.appendChild(title);

        header.appendChild(textContainer);

        // Logo (derecha)
        const logoContainer = document.createElement('div');
        logoContainer.style.cssText = 'flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;';
        const logo = document.createElement('img');
        logo.src = 'assets/icons/logo-brasil-removebg-preview.png';
        logo.style.cssText = 'max-height: 150px; max-width: 180px; object-fit: contain;';
        logoContainer.appendChild(logo);
        header.appendChild(logoContainer);

        return header;

    },

    /**
     * Crea la fecha del reporte
     */
    createReportDate() {
        const date = document.createElement('p');
        date.textContent = this.formatDate(new Date());
        date.style.cssText = `color: #999; margin: 8px 0 0 0; font-size: 10px; text-align: left;`;
        return date;
    },

    /**
     * Crea el resumen financiero
     */
    createFinancialSummary(summary, currentView) {
        const container = document.createElement('div');
        container.style.cssText = `display: grid; grid-template-columns: ${currentView === 'total' ? '1fr 1fr' : '1fr'}; gap: 8px; margin: 10px 0;`;

        if (currentView === 'total' || currentView === 'manual') {
            const card = document.createElement('div');
            card.style.cssText = `padding: 10px; background: ${this.styles.lightBg}; border-radius: 5px; border-left: 4px solid ${this.styles.successColor};`;
            card.innerHTML = `<p style="margin: 0; color: #666; font-size: 11px;">GASTOS MANUALES</p><h3 style="margin: 5px 0 0 0; color: ${this.styles.successColor}; font-size: 18px;">€${summary.totalManual.toFixed(2)}</h3>`;
            container.appendChild(card);
        }

        if (currentView === 'total' || currentView === 'pedidos') {
            const card = document.createElement('div');
            card.style.cssText = `padding: 10px; background: ${this.styles.lightBg}; border-radius: 5px; border-left: 4px solid ${this.styles.dangerColor};`;
            card.innerHTML = `<p style="margin: 0; color: #666; font-size: 11px;">GASTOS INSUMOS</p><h3 style="margin: 5px 0 0 0; color: ${this.styles.dangerColor}; font-size: 18px;">€${summary.totalOrders.toFixed(2)}</h3>`;
            container.appendChild(card);
        }

        if (currentView === 'total') {
            const card = document.createElement('div');
            card.style.cssText = `padding: 10px; background: ${this.styles.lightBg}; border-radius: 5px; border-left: 4px solid ${this.styles.primaryColor}; grid-column: 1 / -1;`;
            const total = summary.totalManual + summary.totalOrders;
            card.innerHTML = `<p style="margin: 0; color: #666; font-size: 11px;">TOTAL GENERAL</p><h3 style="margin: 5px 0 0 0; color: ${this.styles.primaryColor}; font-size: 19px;">€${total.toFixed(2)}</h3>`;
            container.appendChild(card);
        }

        return container;
    },

    /**
     * Crea tabla de gastos
     */
    createExpensesTable(expenses) {
        const section = document.createElement('div');
        section.style.cssText = 'margin: 10px 0;';

        const title = document.createElement('h4');
        title.textContent = 'Detalle de Gastos';
        title.style.cssText = `color: ${this.styles.primaryColor}; font-size: 12px; margin: 0 0 8px 0; border-bottom: 2px solid ${this.styles.primaryColor}; padding-bottom: 4px;`;
        section.appendChild(title);

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 10px;';

        const thead = document.createElement('thead');
        thead.innerHTML = `<tr style="background: ${this.styles.primaryColor}; color: white;"><th style="padding: 6px; text-align: left; border: 1px solid #ddd;">Fecha</th><th style="padding: 6px; text-align: left; border: 1px solid #ddd;">Descripción</th><th style="padding: 6px; text-align: left; border: 1px solid #ddd;">Categoría</th><th style="padding: 6px; text-align: right; border: 1px solid #ddd;">Monto</th></tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        expenses.forEach((e, i) => {
            const tr = document.createElement('tr');
            tr.style.backgroundColor = i % 2 ? '#fff' : this.styles.lightBg;
            tr.innerHTML = `<td style="padding: 4px; border: 1px solid #ddd;">${this.formatDate(new Date(e.fecha))}</td><td style="padding: 4px; border: 1px solid #ddd;">${e.descripcion}</td><td style="padding: 4px; border: 1px solid #ddd; color: ${this.styles.primaryColor}; font-weight: bold; font-size: 9px;">${e.categoria}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: right; color: ${this.styles.successColor}; font-weight: bold;">€${e.monto.toFixed(2)}</td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);

        return section;
    },

    /**
     * Crea tabla de órdenes
     */
    createOrdersTable(orders) {
        const section = document.createElement('div');
        section.style.cssText = 'margin: 10px 0;';

        const title = document.createElement('h4');
        title.textContent = 'Detalle de Insumos';
        title.style.cssText = `color: ${this.styles.primaryColor}; font-size: 12px; margin: 0 0 8px 0; border-bottom: 2px solid ${this.styles.primaryColor}; padding-bottom: 4px;`;
        section.appendChild(title);

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 9px;';

        const thead = document.createElement('thead');
        thead.innerHTML = `<tr style="background: ${this.styles.primaryColor}; color: white;"><th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Fecha</th><th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Producto</th><th style="padding: 5px; text-align: center; border: 1px solid #ddd;">Cant</th><th style="padding: 5px; text-align: right; border: 1px solid #ddd;">P.Unit</th><th style="padding: 5px; text-align: right; border: 1px solid #ddd;">Total</th></tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        let idx = 0;
        orders.forEach(ord => {
            (ord.detalle || []).forEach(item => {
                const tr = document.createElement('tr');
                tr.style.backgroundColor = idx % 2 ? '#fff' : this.styles.lightBg;
                const total = (item.cantidad_pedida || 0) * (item.precio_referencia || 0);
                tr.innerHTML = `<td style="padding: 4px; border: 1px solid #ddd;">${this.formatDate(new Date(ord.fecha))}</td><td style="padding: 4px; border: 1px solid #ddd;">${item.producto}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${item.cantidad_pedida}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: right;">€${(item.precio_referencia || 0).toFixed(2)}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: right; color: ${this.styles.dangerColor}; font-weight: bold;">€${total.toFixed(2)}</td>`;
                tbody.appendChild(tr);
                idx++;
            });
        });
        table.appendChild(tbody);
        section.appendChild(table);

        return section;
    },

    /**
     * Crea tabla de reportes - Optimizada para distribución entre páginas
     */
    createReportesTable(reportes, mostrarArchivados = false) {
        
        const section = document.createElement('div');
        section.style.cssText = 'margin: 8px 0;';

        // Crear una tabla por cada pedido para mejor distribución entre páginas
        reportes.forEach((r, pedidoIdx) => {
            const det = r.detalle || [];
            
            // Extract proveedor from observaciones
            let proveedor = '-';
            let responsable = '-';
            if (r.observaciones) {
                if (r.observaciones.includes('Proveedor:')) {
                    const parts = r.observaciones.split('Proveedor: ')[1];
                    if (parts) {
                        proveedor = parts.split(' |')[0].trim() || parts.split(' Responsable')[0].trim();
                    }
                } else if (r.observaciones.includes('destinado a')) {
                    proveedor = r.observaciones.split('destinado a ')[1].split(' generado por')[0];
                }
                
                if (r.observaciones.includes('Responsable:')) {
                    const parts = r.observaciones.split('Responsable: ');
                    if (parts[1]) {
                        responsable = parts[1].split(' |')[0].trim();
                    }
                } else if (r.observaciones.includes('Realizado por:')) {
                    let realizadoPor = r.observaciones.split('Realizado por: ')[1];
                    if (realizadoPor) {
                        responsable = realizadoPor.split(' |')[0].trim();
                    }
                }
            }
            
            const detFiltrados = mostrarArchivados ? det : det.filter(d => !d.archivado);
            
            // Crear tabla para este pedido
            const table = document.createElement('table');
            table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; page-break-inside: avoid; page-break-after: avoid; margin-bottom: 6px;';

            // Header solo para el primer pedido
            if (pedidoIdx === 0) {
                const thead = document.createElement('thead');
                thead.innerHTML = `<tr style="background: ${this.styles.primaryColor}; color: white;"><th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 11%;">Fecha</th><th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 28%; word-break: break-word;">Nombre</th><th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 18%; word-break: break-word;">Proveedor</th><th style="padding: 5px; text-align: center; border: 1px solid #ddd; width: 8%;">Stock</th><th style="padding: 5px; text-align: center; border: 1px solid #ddd; width: 8%;">Pedir</th><th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 10%;">Coste</th><th style="padding: 5px; text-align: center; border: 1px solid #ddd; width: 9%;">Resp.</th><th style="padding: 5px; text-align: center; border: 1px solid #ddd; width: 8%;">Estado</th></tr>`;
                table.appendChild(thead);
            }

            const tbody = document.createElement('tbody');
            
            if (detFiltrados.length === 0) {
                const tr = document.createElement('tr');
                tr.style.backgroundColor = pedidoIdx % 2 ? '#fff' : this.styles.lightBg;
                tr.style.pageBreakInside = 'avoid';
                tr.innerHTML = `<td style="padding: 3px; border: 1px solid #ddd;">${this.formatDate(new Date(r.fecha))}</td><td style="padding: 3px; border: 1px solid #ddd;">-</td><td style="padding: 3px; border: 1px solid #ddd;">${proveedor}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center;">0</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center;">0</td><td style="padding: 3px; border: 1px solid #ddd; text-align: right; font-weight: bold;">€0.00</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${responsable}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center; font-size: 8px;"><span style="background: ${r.estado === 'completado' ? '#d4edda' : '#e7e7e7'}; color: ${r.estado === 'completado' ? '#155724' : '#666'}; padding: 2px 5px; border-radius: 3px;">${r.estado || 'Pendiente'}</span></td>`;
                tbody.appendChild(tr);
            } else {
                detFiltrados.forEach((d, idx) => {
                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = (pedidoIdx + idx) % 2 ? '#fff' : this.styles.lightBg;
                    tr.style.pageBreakInside = 'avoid';
                    
                    const nombreProducto = d.producto || d.nombre_producto || d.name || '-';
                    const coste = (d.cantidad_pedida || 0) * (d.precio_referencia || 0);
                    
                    let estadoProducto = d.estado_producto || 'pendiente';
                    let esArchivado = d.archivado || false;
                    let textoEstado = 'PENDIENTE';
                    
                    if (esArchivado) {
                        textoEstado = 'ARCHIVADO';
                    } else if (estadoProducto === 'completado') {
                        textoEstado = 'COMPLETADO';
                    } else if (estadoProducto === 'recibido') {
                        textoEstado = 'RECIBIDO';
                    }
                    
                    tr.innerHTML = `<td style="padding: 3px; border: 1px solid #ddd; word-break: break-word; overflow-wrap: break-word;">${this.formatDate(new Date(r.fecha))}</td><td style="padding: 3px; border: 1px solid #ddd; word-break: break-word; overflow-wrap: break-word;">${nombreProducto}</td><td style="padding: 3px; border: 1px solid #ddd; word-break: break-word; overflow-wrap: break-word;">${proveedor}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${d.stock_registrado || d.stock_actual || 0}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${d.cantidad_pedida || 0}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: right; font-weight: bold;">€${coste.toFixed(2)}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center; font-size: 9px;">${responsable}</td><td style="padding: 3px; border: 1px solid #ddd; text-align: center; font-size: 8px;"><span style="background: ${this.getEstadoColor(textoEstado)}; color: ${this.getEstadoTextColor(textoEstado)}; padding: 2px 5px; border-radius: 3px;">${textoEstado}</span></td>`;
                    tbody.appendChild(tr);
                });
            }
            
            table.appendChild(tbody);
            section.appendChild(table);
        });

        return section;
    },

    /**
     * Crea el footer
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.style.cssText = `margin-top: 15px; padding-top: 8px; border-top: 1px solid ${this.styles.borderColor}; text-align: center; color: #999; font-size: 8px;`;
        footer.innerHTML = `<p style="margin: 2px 0;">Brasil Açaí © 2026 | Reporte generado automáticamente</p>`;
        return footer;
    },

    /**
     * Calcula resumen
     */
    calculateExpenseSummary(expenses, orders, currentView) {
        let totalManual = 0;
        let totalOrders = 0;

        expenses.forEach(e => {
            totalManual += e.monto || 0;
        });

        orders.forEach(ord => {
            (ord.detalle || []).forEach(item => {
                totalOrders += (item.cantidad_pedida || 0) * (item.precio_referencia || 0);
            });
        });

        return { totalManual, totalOrders };
    },

    /**
     * Formatea fecha
     */
    formatDate(date) {
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },

    /**
     * String para nombre de archivo
     */
    getDateString() {
        return new Date().toISOString().split('T')[0];
    },

    /**
     * Obtiene el color de fondo según el estado
     */
    getEstadoColor(estado) {
        switch(estado) {
            case 'COMPLETADO': return '#d4edda';
            case 'RECIBIDO': return '#d1ecf1';
            case 'ARCHIVADO': return '#e2e3e5';
            case 'PENDIENTE': return '#fff3cd';
            default: return '#e7e7e7';
        }
    },

    /**
     * Obtiene el color del texto según el estado
     */
    getEstadoTextColor(estado) {
        switch(estado) {
            case 'COMPLETADO': return '#155724';
            case 'RECIBIDO': return '#0c5460';
            case 'ARCHIVADO': return '#383d41';
            case 'PENDIENTE': return '#856404';
            default: return '#666';
        }
    }
};

window.reportGenerator = reportGenerator;
