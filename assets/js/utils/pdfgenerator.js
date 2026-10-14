/**
 * PDF Generator para Brasil Açaí SGP
 * Exporta reportes de Gastos y Financiero con branding profesional
 */

const pdfGenerator = {
    /**
     * Verifica que jsPDF esté disponible - con retry agresivo
     */
    async checkDependencies() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 segundos (100 * 100ms)
            
            const checkInterval = setInterval(() => {
                attempts++;
                
                // Buscar jsPDF en múltiples ubicaciones (en orden de preferencia)
                let jsPDFLib = null;
                if (window.jsPDFGlobal) {
                    jsPDFLib = window.jsPDFGlobal;
                } else if (window.jspdf?.jsPDF) {
                    jsPDFLib = window.jspdf.jsPDF;
                } else if (window.jsPDF) {
                    jsPDFLib = window.jsPDF;
                } else if (typeof jsPDF !== 'undefined') {
                    jsPDFLib = jsPDF;
                } else if (window.html2pdf) {
                    // Alternativamente, html2pdf también incluye jsPDF
                    jsPDFLib = window.html2pdf.jsPDF;
                }
                
                if (jsPDFLib) {
                    clearInterval(checkInterval);
                    window.jsPDFLib = jsPDFLib;
                    console.log('✅ jsPDF cargado exitosamente');
                    resolve(true);
                    return;
                }
                
                // Si alcanzó el máximo de intentos, parar
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('❌ jsPDF no se pudo cargar después de 10 segundos');
                    resolve(false);
                }
            }, 100);
        });
    },
    /**
     * Convierte una imagen a base64
     */
    async imageToBase64(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = reject;
            img.src = imagePath;
        });
    },

    /**
     * Genera PDF de Gastos con logo y eslogan
     */
    async generarReporteGastos(titulo, datos, filtros = {}) {
        try {
            console.log('📄 Generando PDF de Gastos...');
            
            // Verificar que jsPDF esté disponible
            await this.checkDependencies();
            
            // Obtener jsPDF usando la forma correcta
            let jsPDFLib;
            if (window.jspdf && window.jspdf.jsPDF) {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (window.jsPDFLib) {
                jsPDFLib = window.jsPDFLib;
            } else {
                throw new Error('❌ La librería jsPDF no está disponible. Verifica la conexión a internet.');
            }
            
            // Cargar imágenes con fallback (si fallan, continuar sin ellas)
            let logoBase64 = null;
            let esloganBase64 = null;
            try {
                logoBase64 = await this.imageToBase64('assets/icons/logo-brasil-removebg-preview.png');
            } catch (e) {
                console.warn('⚠️ No se pudo cargar el logo:', e);
            }
            try {
                esloganBase64 = await this.imageToBase64('assets/eslogan.png');
            } catch (e) {
                console.warn('⚠️ No se pudo cargar el eslogan:', e);
            }
            
            // Crear documento PDF
            const doc = new jsPDFLib('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            // 1. ENCABEZADO CON LOGO Y ESLOGAN
            const logoWidth = 22;
            const logoHeight = 22;
            const esloganWidth = 80;
            const esloganHeight = 13;
            
            // Eslogan izquierda
            if (esloganBase64) {
                doc.addImage(esloganBase64, 'PNG', 10, 10, esloganWidth, esloganHeight);
            }
            
            // Logo derecha
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);
            }
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text('Reporte de Gastos', pageWidth / 2, 42, { align: 'center' });
            
            // 2. FILTROS APLICADOS
            let yPosition = 55;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Filtros Aplicados:', 10, yPosition);
            yPosition += 6;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            if (filtros.tienda) doc.text(`• Tienda: ${filtros.tienda}`, 15, yPosition), yPosition += 4;
            if (filtros.tipo) doc.text(`• Tipo: ${filtros.tipo}`, 15, yPosition), yPosition += 4;
            
            // Mostrar fecha sin hora
            const fecha = new Date().toLocaleDateString('es-ES');
            doc.text(`• Fecha: ${fecha}`, 15, yPosition);
            yPosition += 4;
            
            yPosition += 3;
            
            // 3. TABLA DE DATOS
            if (Array.isArray(datos) && datos.length > 0) {
                const columns = ['Concepto', 'Tipo', 'Monto', 'Fecha'];
                const rows = datos.map(d => [
                    d.concepto || '-',
                    d.tipo || '-',
                    `€${(d.monto || 0).toFixed(2)}`,
                    d.fecha ? new Date(d.fecha).toLocaleDateString('es-ES') : '-'
                ]);
                
                if (typeof doc.autoTable === 'function') {
                    doc.autoTable({
                        head: [columns],
                        body: rows,
                        startY: yPosition,
                        theme: 'grid',
                        headStyles: {
                            fillColor: [124, 58, 237],
                            textColor: 255,
                            fontStyle: 'bold',
                            halign: 'center'
                        },
                        bodyStyles: {
                            textColor: 50,
                            fontSize: 9
                        },
                        columnStyles: {
                            2: { halign: 'right' }
                        },
                        margin: { left: 10, right: 10 }
                    });
                    
                    yPosition = doc.lastAutoTable.finalY + 10;
                } else {
                    // Fallback: tabla manual si autoTable no disponible
                    console.warn('⚠️ autoTable no disponible, generando tabla manual');
                    doc.setFontSize(9);
                    rows.forEach((row, i) => {
                        const y = yPosition + (i * 6);
                        if (y > pageHeight - 20) return;
                        doc.text(row.join('  |  '), 10, y);
                    });
                    yPosition += rows.length * 6 + 10;
                }
            }
            
            // 4. RESUMEN FINANCIERO
            if (datos && datos.length > 0) {
                const total = datos.reduce((sum, d) => sum + (d.monto || 0), 0);
                const porTipo = {};
                
                datos.forEach(d => {
                    const tipo = d.tipo || 'Sin clasificar';
                    porTipo[tipo] = (porTipo[tipo] || 0) + (d.monto || 0);
                });
                
                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Resumen Financiero:', 10, yPosition);
                yPosition += 6;
                
                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                
                Object.entries(porTipo).forEach(([tipo, monto]) => {
                    doc.text(`${tipo}: €${monto.toFixed(2)}`, 15, yPosition);
                    yPosition += 4;
                });
                
                yPosition += 2;
                doc.setFont(undefined, 'bold');
                doc.setFontSize(11);
                doc.text(`TOTAL: €${total.toFixed(2)}`, 15, yPosition);
            }
            
            // 5. PIE DE PÁGINA (Eliminado el número de página)
            
            // Generar nombre del archivo
            const fechaGeneracion = new Date().toISOString().split('T')[0];
            const nombreArchivo = `Gastos_${fechaGeneracion}.pdf`;
            
            // Descargar
            doc.save(nombreArchivo);
            console.log(`✅ PDF generado: ${nombreArchivo}`);
            window.ui.showNotify(`✅ PDF descargado: ${nombreArchivo}`, 'success');
            
        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },

    /**
     * Genera PDF de Reporte Financiero
     */
    async generarReporteFinanciero(titulo, datos, filtros = {}) {
        try {
            console.log('📄 Generando PDF Financiero...');
            
            // Verificar que jsPDF esté disponible
            await this.checkDependencies();
            
            // Obtener jsPDF usando la forma correcta
            let jsPDFLib;
            if (window.jspdf && window.jspdf.jsPDF) {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (window.jsPDFLib) {
                jsPDFLib = window.jsPDFLib;
            } else {
                throw new Error('❌ La librería jsPDF no está disponible. Verifica la conexión a internet.');
            }
            
            // Cargar imágenes
            const logoBase64 = await this.imageToBase64('assets/icons/logo-brasil-removebg-preview.png');
            const esloganBase64 = await this.imageToBase64('assets/eslogan.png');
            
            // Crear documento PDF
            const doc = new jsPDFLib('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            // 1. ENCABEZADO CON LOGO Y ESLOGAN
            const logoWidth = 25;
            const logoHeight = 25;
            const esloganWidth = 80;
            const esloganHeight = 13;
            
            // Eslogan izquierda
            doc.addImage(esloganBase64, 'PNG', 10, 10, esloganWidth, esloganHeight);
            
            // Logo derecha
            doc.addImage(logoBase64, 'PNG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('Reporte Financiero', 15, 42);
            
            // 2. INFORMACIÓN GENERAL
            let yPosition = 55;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Información del Reporte:', 10, yPosition);
            yPosition += 6;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            if (filtros.tienda) doc.text(`• Tienda: ${filtros.tienda}`, 15, yPosition), yPosition += 4;
            
            // Mostrar fecha sin hora
            const fecha2 = new Date().toLocaleDateString('es-ES');
            doc.text(`• Fecha: ${fecha2}`, 15, yPosition);
            yPosition += 4;
            
            // 3. TABLA PRINCIPAL
            if (Array.isArray(datos) && datos.length > 0) {
                const columns = ['Descripción', 'Monto (€)'];
                
                // Calcular totales
                const total = datos.reduce((sum, d) => sum + (d.valor || 0), 0);
                
                const rows = datos.map(d => [
                    d.descripcion || d.concepto || '-',
                    `${(d.valor || 0).toFixed(2)}`
                ]);
                
                // Agregar total al final
                rows.push(['TOTAL', `${total.toFixed(2)}`]);
                
                doc.autoTable({
                    head: [columns],
                    body: rows,
                    startY: yPosition,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [124, 58, 237],
                        textColor: 255,
                        fontStyle: 'bold'
                    },
                    bodyStyles: {
                        textColor: 50,
                        fontSize: 9
                    },
                    footStyles: {
                        fillColor: [230, 230, 230],
                        textColor: 0,
                        fontStyle: 'bold'
                    },
                    columnStyles: {
                        1: { halign: 'right' }
                    }
                });
                
                yPosition = doc.lastAutoTable.finalY + 10;
            }
            
            // 4. NOTA FINAL
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.text('Este reporte fue generado automáticamente por el Sistema de Gestión Brasil Açaí', 10, pageHeight - 15);
            
            // 5. PIE DE PÁGINA (Eliminado el número de página)
            
            // Generar nombre del archivo
            const fechaGeneracionFinanciero = new Date().toISOString().split('T')[0];
            const nombreArchivo = `Reporte_Financiero_${fechaGeneracionFinanciero}.pdf`;
            
            // Descargar
            doc.save(nombreArchivo);
            console.log(`✅ PDF generado: ${nombreArchivo}`);
            window.ui.showNotify(`✅ PDF descargado: ${nombreArchivo}`, 'success');
            
        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },

    /**
     * Genera PDF de Reporte de Pedidos con tabla completa
     */
    async generarReportePedidos(titulo, datos, filtros = {}) {
        try {
            console.log('📄 Generando PDF de Pedidos...');

            await this.checkDependencies();

            let jsPDFLib;
            if (window.jspdf && window.jspdf.jsPDF) {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (window.jsPDFLib) {
                jsPDFLib = window.jsPDFLib;
            } else {
                throw new Error('❌ La librería jsPDF no está disponible.');
            }

            const logoBase64 = await this.imageToBase64('assets/icons/logo-brasil-removebg-preview.png');
            const esloganBase64 = await this.imageToBase64('assets/eslogan.png');

            const doc = new jsPDFLib('l', 'mm', 'a4'); // Landscape para más columnas
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // 1. ENCABEZADO
            const logoWidth = 22;
            const logoHeight = 22;
            const esloganWidth = 80;
            const esloganHeight = 13;

            doc.addImage(esloganBase64, 'PNG', 10, 10, esloganWidth, esloganHeight);
            doc.addImage(logoBase64, 'PNG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);

            doc.setFontSize(13);
            doc.setFont(undefined, 'bold');
            doc.text(titulo || 'Reporte de Pedidos', pageWidth / 2, 42, { align: 'center' });

            // 2. FILTROS
            let yPosition = 52;
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            if (filtros.tienda) doc.text(`• Tienda: ${filtros.tienda}`, 15, yPosition), yPosition += 4;
            if (filtros.proveedor) doc.text(`• Proveedor: ${filtros.proveedor}`, 15, yPosition), yPosition += 4;
            if (filtros.fecha && filtros.fecha !== 'Sin filtro') doc.text(`• Fecha: ${filtros.fecha}`, 15, yPosition), yPosition += 4;
            yPosition += 3;

            // 3. TABLA
            if (Array.isArray(datos) && datos.length > 0) {
                const columns = ['Fecha', 'Tienda', 'Proveedor', 'Producto', 'Stock', 'A Pedir', 'Coste (€)', 'Estado'];

                const rows = datos.map(d => [
                    d.fecha || '-',
                    d.tienda || '-',
                    d.proveedor || '-',
                    d.producto || '-',
                    String(d.stockRegistrado ?? 0),
                    String(d.aPedir ?? 0),
                    `${(d.coste || 0).toFixed(2)}`,
                    (d.estado || '-').toUpperCase()
                ]);

                const totalCoste = datos.reduce((sum, d) => sum + (d.coste || 0), 0);
                rows.push(['', '', '', '', '', 'TOTAL', `${totalCoste.toFixed(2)}`, '']);

                doc.autoTable({
                    head: [columns],
                    body: rows,
                    startY: yPosition,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [124, 58, 237],
                        textColor: 255,
                        fontStyle: 'bold',
                        halign: 'center',
                        fontSize: 8
                    },
                    bodyStyles: {
                        textColor: 50,
                        fontSize: 8
                    },
                    columnStyles: {
                        0: { cellWidth: 35 },
                        4: { halign: 'center' },
                        5: { halign: 'center' },
                        6: { halign: 'right' },
                        7: { halign: 'center' }
                    },
                    didParseCell: (data) => {
                        // Estilo para fila TOTAL
                        if (data.row.index === rows.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [230, 230, 230];
                        }
                    },
                    margin: { left: 10, right: 10 }
                });

                yPosition = doc.lastAutoTable.finalY + 10;
            }

            // 4. PIE
            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.text('Este reporte fue generado automáticamente por el Sistema de Gestión Brasil Açaí', 10, pageHeight - 10);

            // Nombre del archivo incluye proveedor si está filtrado
            const fechaGen = new Date().toISOString().split('T')[0];
            const sufijoProv = filtros.proveedor && filtros.proveedor !== 'Todos' ? `_${filtros.proveedor.replace(/\s+/g, '_')}` : '';
            const nombreArchivo = `Pedidos${sufijoProv}_${fechaGen}.pdf`;

            doc.save(nombreArchivo);
            console.log(`✅ PDF generado: ${nombreArchivo}`);
            window.ui.showNotify(`✅ PDF descargado: ${nombreArchivo}`, 'success');

        } catch (error) {
            console.error('❌ Error generando PDF de pedidos:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    },

    /**
     * Genera PDF de Stock Faltante
     */
    async generarReporteStockFaltante(titulo, datos, filtros = {}, options = {}) {
        try {
            console.log('📄 Generando PDF Stock Faltante...');

            // Verificar que jsPDF esté disponible
            await this.checkDependencies();

            // Obtener jsPDF usando la forma correcta
            let jsPDFLib;
            if (window.jspdf && window.jspdf.jsPDF) {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (window.jsPDFLib) {
                jsPDFLib = window.jsPDFLib;
            } else {
                throw new Error('❌ La librería jsPDF no está disponible. Verifica la conexión a internet.');
            }

            // Cargar imágenes
            const logoBase64 = await this.imageToBase64('assets/icons/logo-brasil-removebg-preview.png');
            const esloganBase64 = await this.imageToBase64('assets/eslogan.png');

            // Crear documento PDF
            const doc = new jsPDFLib('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. ENCABEZADO CON LOGO Y ESLOGAN
            const logoWidth = 22;
            const logoHeight = 22;
            const esloganWidth = 80;
            const esloganHeight = 13;

            // Eslogan izquierda
            doc.addImage(esloganBase64, 'PNG', 10, 10, esloganWidth, esloganHeight);

            // Logo derecha
            doc.addImage(logoBase64, 'PNG', pageWidth - logoWidth - 10, 10, logoWidth, logoHeight);

            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text('Reporte de Stock Faltante', pageWidth / 2, 42, { align: 'center' });

            // 2. INFORMACIÓN GENERAL
            let yPosition = 55;
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text('Información del Reporte:', 10, yPosition);
            yPosition += 6;

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            if (filtros.tienda) doc.text(`• Tienda: ${filtros.tienda}`, 15, yPosition), yPosition += 4;
            if (filtros.proveedor) doc.text(`• Proveedor: ${filtros.proveedor}`, 15, yPosition), yPosition += 4;
            if (filtros.fecha) doc.text(`• Fecha: ${filtros.fecha}`, 15, yPosition), yPosition += 4;

            yPosition += 5;

            // 3. TABLA PRINCIPAL
            if (Array.isArray(datos) && datos.length > 0) {
                const columns = ['Tienda', 'Proveedor', 'Producto', 'Cant. Max', 'Cant. Actual', 'Cant. a Pedir', 'Coste (€)', 'Responsable', 'Estado'];

                // Agrupar visualmente por proveedor con filas separadoras
                const rows = [];
                const separadorIndices = [];
                let proveedorAnterior = null;
                let rowIndex = 0;

                datos.forEach((d) => {
                    if (d.proveedor !== proveedorAnterior && proveedorAnterior !== null) {
                        separadorIndices.push(rowIndex);
                        rows.push(Array(columns.length).fill(''));
                        rowIndex++;
                    }

                    rows.push([
                        d.tienda || '-',
                        d.proveedor || '-',
                        d.producto || '-',
                        String(d.cantidad_maxima ?? 0),
                        String(d.cantidad_actual ?? 0),
                        String(d.cantidad_a_pedir ?? 0),
                        Number(d.coste ?? 0).toFixed(2),
                        d.responsable || '-',
                        d.estado || '-'
                    ]);
                    rowIndex++;
                    proveedorAnterior = d.proveedor;
                });

                doc.autoTable({
                    head: [columns],
                    body: rows,
                    startY: yPosition,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [124, 58, 237],
                        textColor: 255,
                        fontStyle: 'bold',
                        halign: 'center',
                        fontSize: 8
                    },
                    bodyStyles: {
                        textColor: 50,
                        fontSize: 7
                    },
                    columnStyles: {
                        3: { halign: 'center' },
                        4: { halign: 'center' },
                        5: { halign: 'center' },
                        6: { halign: 'right' }
                    },
                    didDrawCell: (data) => {
                        if (separadorIndices.includes(data.row.index)) {
                            data.cell.styles.lineWidth = 0;
                            data.cell.styles.fillColor = [255, 255, 255];
                            data.cell.styles.textColor = [255, 255, 255];
                            data.cell.styles.minCellHeight = 3;
                        }
                    },
                    margin: { left: 10, right: 10 }
                });

                yPosition = doc.lastAutoTable.finalY + 10;
            }

            // 4. RESUMEN
            if (datos && datos.length > 0) {
                const totalCantidad = datos.reduce((sum, d) => sum + (Number(d.cantidad_a_pedir) || 0), 0);
                const totalCoste = datos.reduce((sum, d) => sum + (Number(d.coste) || 0), 0);

                doc.setFontSize(11);
                doc.setFont(undefined, 'bold');
                doc.text('Resumen:', 10, yPosition);
                yPosition += 6;

                doc.setFontSize(9);
                doc.setFont(undefined, 'normal');
                doc.text(`Total de Cantidad a Pedir: ${totalCantidad}`, 15, yPosition);
                yPosition += 4;
                doc.text(`Coste Total: €${totalCoste.toFixed(2)}`, 15, yPosition);
            }

            // 5. Guardar archivo y obtener Base64
            const fechaGeneracionStock = new Date().toISOString().split('T')[0];
            const nombreArchivo = `${titulo || 'Stock_Faltante'}_${fechaGeneracionStock}.pdf`;

            if (options.autoSave !== false) {
                doc.save(nombreArchivo);
                console.log(`✅ PDF generado y descargado: ${nombreArchivo}`);
                window.ui.showNotify(`✅ PDF descargado: ${nombreArchivo}`, 'success');
            } else {
                console.log(`✅ PDF generado en memoria para envío: ${nombreArchivo}`);
            }

            const base64Data = doc.output('datauristring').split(',')[1];
            return { base64: base64Data, filename: nombreArchivo };

        } catch (error) {
            console.error('❌ Error generando PDF:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
            return null;
        }
    },

    /**
     * Genera el albarán de pedido a proveedor con diseño profesional
     * matching the reference image layout exactly.
     *
     * order = {
     *   proveedor:           string,
     *   proveedor_cif:       string,
     *   proveedor_direccion: string,
     *   proveedor_telefono:  string,
     *   items:               [{ sku, producto, cantidad_a_pedir }],
     *   tiendas:             [string],   // nombres de tiendas destino
     *   direcciones:         [string],   // direcciones de entrega
     *   numeroPedido:        string,     // opcional
     *   horario:             string,     // opcional (ej. "9:00 – 22:00h")
     * }
     */
    async generarAlbaranProveedor(titulo = 'Pedido Proveedor', proveedor = '-', datos = [], filtros = {}, order = {}) {
        try {
            await this.checkDependencies();

            let jsPDFLib;
            if (window.jspdf && window.jspdf.jsPDF) {
                jsPDFLib = window.jspdf.jsPDF;
            } else if (window.jsPDFLib) {
                jsPDFLib = window.jsPDFLib;
            } else {
                throw new Error('jsPDF no esta disponible');
            }

            // ── Constantes de color ──────────────────────────────────────────
            const PURPLE      = [124, 58, 237];   // encabezados tabla y bloques morados
            const PURPLE_LIGHT= [230, 222, 255];  // filas alternas de tabla
            const PURPLE_MED  = [160, 120, 220];  // borde / header bloque
            const WHITE       = [255, 255, 255];
            const GRAY_LIGHT  = [245, 245, 248];
            const DARK_TEXT   = [30, 30, 50];
            const BLUE_LINK   = [60, 80, 200];

            const doc = new jsPDFLib('p', 'mm', 'a4');
            const pageWidth  = doc.internal.pageSize.getWidth();   // 210
            const pageHeight = doc.internal.pageSize.getHeight();  // 297

            const marginL = 14;
            const marginR = 14;
            const contentW = pageWidth - marginL - marginR;       // 182

            // ── Cargar logo ──────────────────────────────────────────────────
            let logoBase64 = null;
            try { logoBase64 = await this.imageToBase64('assets/icons/logo-brasil-removebg-preview.png'); } catch (_) {}
            if (!logoBase64) {
                try { logoBase64 = await this.imageToBase64('assets/logo.png'); } catch (_) {}
            }

            // ════════════════════════════════════════════════════════════════
            // 1. BLOQUE SUPERIOR: Logo (izq) + Bloque "Pedido Proveedor" (der)
            // ════════════════════════════════════════════════════════════════
            const headerTop = 12;

            // — Logo / marca izquierda —
            const logoSize = 22;
            if (logoBase64) {
                doc.addImage(logoBase64, 'PNG', marginL, headerTop, logoSize, logoSize);
            }
            // Texto "BRASIL AÇAÍ" + "TASTY AND HEALTHY" debajo del logo
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...PURPLE);
            doc.text('BRASIL AÇAÍ', marginL, headerTop + logoSize + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(120, 100, 160);
            doc.text('TASTY AND HEALTHY', marginL, headerTop + logoSize + 9);

            // — Bloque morado "Pedido Proveedor" a la derecha —
            const blockW = 90;
            const blockX = pageWidth - marginR - blockW;
            const blockY = headerTop;

            // Rectángulo título morado
            doc.setFillColor(...PURPLE);
            doc.roundedRect(blockX, blockY, blockW, 10, 2, 2, 'F');
            doc.setFont('helvetica', 'bolditalic');
            doc.setFontSize(13);
            doc.setTextColor(...WHITE);
            doc.text('Pedido Proveedor', blockX + blockW / 2, blockY + 7, { align: 'center' });

            // Subbloque: Fecha | Número de pedido
            const subY = blockY + 11;
            const subH = 16;
            doc.setFillColor(...WHITE);
            doc.setDrawColor(...PURPLE_MED);
            doc.setLineWidth(0.4);
            doc.rect(blockX, subY, blockW / 2, subH);
            doc.rect(blockX + blockW / 2, subY, blockW / 2, subH);

            // Cabeceras sub-tabla
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...PURPLE);
            doc.text('Fecha pedido', blockX + blockW / 4, subY + 4.5, { align: 'center' });
            doc.text('Número de pedido', blockX + blockW * 3 / 4, subY + 4.5, { align: 'center' });

            // Línea separadora interna
            doc.setDrawColor(...PURPLE_LIGHT);
            doc.setLineWidth(0.3);
            doc.line(blockX, subY + 6, blockX + blockW, subY + 6);

            // Valores
            const fechaPedido = filtros.fecha
                ? filtros.fecha
                : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

            // Generar número de pedido: MMAJ26/001 style si no viene
            let numPedido = order.numeroPedido || filtros.numeroPedido || '';
            if (!numPedido) {
                const now = new Date();
                const mesAbr = now.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
                const anio   = String(now.getFullYear()).slice(2);
                const dia    = String(now.getDate()).padStart(3, '0');
                numPedido = `MM${mesAbr}${anio}/${dia}`;
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...DARK_TEXT);
            doc.text(fechaPedido, blockX + blockW / 4, subY + 12, { align: 'center' });
            doc.text(numPedido,   blockX + blockW * 3 / 4, subY + 12, { align: 'center' });

            // ════════════════════════════════════════════════════════════════
            // 2. SECCIÓN DATOS CENTRO / DIRECCIÓN ENTREGA
            // ════════════════════════════════════════════════════════════════
            const table2Y = headerTop + logoSize + 14;   // ~ 49

            // Calcular el ID de centro (primer tienda del array o filtros.tienda)
            const tiendas     = Array.isArray(order.tiendas) && order.tiendas.length ? order.tiendas : (filtros.tienda ? [filtros.tienda] : ['']);
            const tiendaLabel = tiendas[0] || '';

            // Dirección de entrega (primera dirección del array)
            const direcciones = Array.isArray(order.direcciones) && order.direcciones.length ? order.direcciones : [];
            const dirEntrega  = direcciones[0] || '';
            const telefono    = filtros.telefono || order.proveedor_telefono || '';
            const horario     = order.horario || filtros.horario || '9:00 – 22:00h';

            // Ancho de cada columna a partes iguales
            const colW = contentW / 2;

            const sectionH = 36;

            // Fondo header izquierdo "Datos del centro"
            doc.setFillColor(...PURPLE);
            doc.rect(marginL, table2Y, colW, 6, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...WHITE);
            doc.text(`Datos del centro  ${tiendaLabel}`, marginL + 2, table2Y + 4.3);

            // Fondo header derecho "Dirección entrega y horario"
            doc.setFillColor(...PURPLE);
            doc.rect(marginL + colW, table2Y, colW, 6, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...WHITE);
            doc.text('Dirección entrega y horario', marginL + colW + 2, table2Y + 4.3);

            // Cuerpo izquierdo (datos del emisor / empresa)
            const bodyY = table2Y + 6;
            doc.setFillColor(250, 248, 255);
            doc.setDrawColor(...PURPLE_MED);
            doc.setLineWidth(0.35);
            doc.rect(marginL, bodyY, colW, sectionH);

            const provName = String(proveedor || order.proveedor || '-');
            const provCIF  = String(order.proveedor_cif || '');
            const provDir  = String(order.proveedor_direccion || '');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...DARK_TEXT);
            doc.text(provName, marginL + 2, bodyY + 5.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);

            let infoY = bodyY + 10;
            if (provCIF) {
                doc.text(provCIF, marginL + 2, infoY);
                infoY += 5;
            }
            if (provDir) {
                const lines = doc.splitTextToSize(provDir, colW - 4);
                doc.text(lines, marginL + 2, infoY);
                infoY += lines.length * 4.5;
            }

            // Cuerpo derecho (dirección de entrega)
            doc.setFillColor(250, 248, 255);
            doc.rect(marginL + colW, bodyY, colW, sectionH);

            let entregaY = bodyY + 5.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...BLUE_LINK);

            if (dirEntrega) {
                const lines = doc.splitTextToSize(dirEntrega, colW - 4);
                doc.text(lines, marginL + colW + 2, entregaY);
                entregaY += lines.length * 4.5 + 2;
            }

            doc.setTextColor(...DARK_TEXT);
            if (telefono) {
                doc.text(`Teléfono: ${telefono}`, marginL + colW + 2, entregaY);
                entregaY += 5;
            }

            entregaY += 3;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(horario, marginL + colW + 2, entregaY);

            // ════════════════════════════════════════════════════════════════
            // 3. TABLA DE PRODUCTOS: SKU | PRODUCTO / SERVICIO | CANTIDAD
            // ════════════════════════════════════════════════════════════════
            const tableStartY = bodyY + sectionH + 8;

            const rows = (Array.isArray(datos) ? datos : []).map((item) => {
                const qty = Number(item.cantidad_a_pedir ?? item.cantidad ?? 0);
                return [
                    item.sku || item.codigo || '',
                    item.producto || '-',
                    qty > 0 ? String(qty) : ''
                ];
            });

            doc.autoTable({
                head: [['SKU', 'PRODUCTO / SERVICIO', 'CANTIDAD']],
                body: rows,
                startY: tableStartY,
                theme: 'plain',
                headStyles: {
                    fillColor: PURPLE,
                    textColor: WHITE,
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 8.5,
                    cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }
                },
                bodyStyles: {
                    textColor: DARK_TEXT,
                    fontSize: 8,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 32 },
                    1: { halign: 'left' },
                    2: { halign: 'center', cellWidth: 28, fontStyle: 'bold', textColor: PURPLE }
                },
                didParseCell(data) {
                    if (data.section === 'body') {
                        // Filas alternas: lila muy clara / blanco
                        data.cell.styles.fillColor = data.row.index % 2 === 0 ? WHITE : PURPLE_LIGHT;
                        // Borde inferior sutil
                        data.cell.styles.lineColor = [220, 215, 235];
                        data.cell.styles.lineWidth = 0.2;
                    }
                },
                margin: { left: marginL, right: marginR }
            });

            // ════════════════════════════════════════════════════════════════
            // 4. PIE DE PÁGINA
            // ════════════════════════════════════════════════════════════════
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(160, 150, 180);
                doc.text(
                    'Documento generado automáticamente por el Sistema de Gestión Brasil Açaí',
                    pageWidth / 2,
                    pageHeight - 8,
                    { align: 'center' }
                );
                doc.text(`Pág. ${i} / ${totalPages}`, pageWidth - marginR, pageHeight - 8, { align: 'right' });
            }

            // ── Guardar ──────────────────────────────────────────────────────
            const fechaGen = new Date().toISOString().split('T')[0];
            const safeProv = String(proveedor || 'Proveedor').replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ]/g, '_');
            const nombreArchivo = `PedidoProveedor_${safeProv}_${fechaGen}.pdf`;
            doc.save(nombreArchivo);
            window.ui.showNotify(`✅ PDF descargado: ${nombreArchivo}`, 'success');

        } catch (error) {
            console.error('❌ Error generando albaran PDF:', error);
            window.ui.showNotify(`❌ Error: ${error.message}`, 'danger');
        }
    }
};

window.pdfGenerator = pdfGenerator;