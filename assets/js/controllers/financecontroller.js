const financeController = {
    currentView: 'total', // 'total', 'manual', 'pedidos'
    eventsBound: false, // Prevenir duplicación de listeners

    async init() {
        await window.expenseModel.checkTableStatus();
        await this.checkPayroll();
        await this.refreshData();
        this.setupTiendaDropdown(); // 🔧 Configurar dropdown de tiendas según permisos
        if (!this.eventsBound) {
            this.bindEvents();
        }
    },

    async checkPayroll() {
        const profile = window.authModel.getProfile();
        const rol = profile.rol.toLowerCase();
        if (rol === 'administrador' || rol === 'auxiliar_administrativo') {
            try {
                await window.expenseModel.checkAndProcessPayroll();
            } catch (e) {
                console.error("Error procesando nómina automática:", e);
            }
        }
    },

    setupTiendaDropdown() {
        // 🔧 Bloquear dropdown de tiendas para Franquiciado - solo puede ver su tienda asignada
        const profile = window.authModel.getProfile();
        const rol = (profile.rol || '').toLowerCase().trim();
        const isFranquiciado = rol === 'franquiciado';
        const tiendaSelect = document.getElementById('gasto-tienda');
        
        if (tiendaSelect && isFranquiciado) {
            // Desabilitar el select - Franquiciado SOLO puede registrar gastos en su tienda
            tiendaSelect.disabled = true;
            // Limpiar opciones y mostrar SOLO su tienda asignada
            const miTienda = profile.tienda_asignada || 'Mi Tienda';
            tiendaSelect.innerHTML = `<option value="${miTienda}" selected>${miTienda}</option>`;
        }
    },

    bindEvents() {
        const filtroVista = document.getElementById('filtro-vista-gastos');
        if (filtroVista) filtroVista.onchange = (e) => {
            this.currentView = e.target.value;
            this.renderFinanceStats();
        };

        const filtroPeriodo = document.getElementById('filtro-periodo-gastos');
        const filtroFecha = document.getElementById('filtro-fecha-gastos');

        if (filtroPeriodo) {
            filtroPeriodo.onchange = (e) => {
                if (filtroFecha) {
                    const now = new Date();
                    if (e.target.value === 'date') {
                        filtroFecha.type = 'date';
                        filtroFecha.value = now.toISOString().substring(0, 10);
                    } else {
                        filtroFecha.type = 'month';
                        filtroFecha.value = now.toISOString().substring(0, 7);
                    }
                }
                this.renderFinanceStats();
            };
        }

        if (filtroFecha) {
            filtroFecha.onchange = () => this.renderFinanceStats();
            filtroFecha.oninput = () => this.renderFinanceStats();
        }

        const tiendaSelect = document.getElementById('tiendaSelect');
        if (tiendaSelect) tiendaSelect.addEventListener('change', () => {
            this.renderFinanceStats();
        });

        // Configurar formulario de agregar gasto
        this.setupGastoForm();

        this.eventsBound = true;
    },

    setupGastoForm() {
        // Llenar select de tiendas - Traer tiendas de la BD
        const gastoTiendaSelect = document.getElementById('gastoTienda');
        if (!gastoTiendaSelect) return;

        const profile = window.authModel.getProfile();
        const rol = (profile.rol || '').toLowerCase().trim();
        const isFranquiciado = rol === 'franquiciado';

        // Cargar tiendas de forma asincrónica
        this.actualizarSelectTiendas(gastoTiendaSelect, isFranquiciado);

        // Listener para el formulario
        const formGasto = document.getElementById('formAgregarGasto');
        if (formGasto) {
            formGasto.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.agregarGastoManual();
            });
        }
    },

    async actualizarSelectTiendas(select, isFranquiciado) {
        try {
            // Obtener tiendas de la BD
            let tiendas = await window.productModel.fetchTiendas();
            
            const profile = window.authModel.getProfile();

            // Si es franquiciado, solo mostrar su tienda
            if (isFranquiciado) {
                const miTienda = profile.tienda_asignada || 'Mi Tienda';
                select.innerHTML = `<option value="${miTienda}" selected>${miTienda}</option>`;
                select.disabled = true;
                return;
            }

            // Para admin, listar todas las tiendas
            if (tiendas && tiendas.length > 0) {
                const options = tiendas
                    .map(t => `<option value="${t.nombre_tienda}">${t.nombre_tienda}</option>`)
                    .join('');
                select.innerHTML = '<option value="">-- Seleccionar Tienda --</option>' + options;
            } else {
                // Fallback si no hay tiendas en la BD
                select.innerHTML = '<option value="">-- Seleccionar Tienda --</option><option value="General">General</option>';
            }
            
            select.disabled = false;
        } catch (error) {
            console.warn('Error cargando tiendas:', error);
            select.innerHTML = '<option value="">-- Seleccionar Tienda --</option><option value="General">General</option>';
        }
    },

    async agregarGastoManual() {
        const tienda = document.getElementById('gastoTienda').value;
        const concepto = document.getElementById('gastoConcepto').value;
        const monto = parseFloat(document.getElementById('gastoMonto').value);
        const tipo = document.getElementById('gastoTipo').value;

        if (!tienda || !concepto || !monto || monto <= 0) {
            window.ui?.showNotify('❌ Por favor completa todos los campos', 'danger');
            return;
        }

        try {
            const profile = window.authModel.getProfile();
            
            // Mapear campos del formulario a la estructura de la tabla Supabase
            const nuevoGasto = {
                descripcion: `${concepto} (${tienda})`, // Descripción con tienda incluida
                categoria: tipo,
                monto: monto,
                tienda: tienda, // Campo tienda para filtros y gráfico por tienda
                fecha: new Date().toISOString(),
                es_automatico: false // Es manual, no automático
                // usuario_referencia se deja como null
            };

            // Guardar en el modelo
            await window.expenseModel.addExpense(nuevoGasto);

            // Limpiar formulario
            document.getElementById('formAgregarGasto').reset();
            document.getElementById('gastoConcepto').focus();

            // Actualizar vistas
            this.renderFinanceStats();

            window.ui?.showNotify(`✅ Gasto agregado exitosamente para ${tienda}`, 'success');
        } catch (error) {
            console.error('Error agregando gasto:', error);
            window.ui?.showNotify(`❌ Error al agregar gasto: ${error.message}`, 'danger');
        }
    },

    async refreshData() {
        await window.expenseModel.fetchExpenses();
        await window.orderModel.fetchReportes(true); // Cargar pedidos para cálculos financieros
        await window.authModel.fetchAllProfiles(); // Para lista de empleados
        this.renderFinanceStats();
        this.renderEmployeeList();
    },

    renderFinanceStats() {
        try {
            const profile = window.authModel.getProfile();
            const rol = profile.rol.toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            const tiendaSeleccionada = document.getElementById('tiendaSelect')?.value || 'todas';
            
            const filtroPeriodo = document.getElementById('filtro-periodo-gastos')?.value || 'month';
            const filtroFechaInput = document.getElementById('filtro-fecha-gastos');
            
            if (filtroFechaInput && !filtroFechaInput.value) {
                const now = new Date();
                filtroFechaInput.value = filtroPeriodo === 'date'
                    ? now.toISOString().substring(0, 10)
                    : now.toISOString().substring(0, 7);
            }
            const fechaFiltroVal = filtroFechaInput?.value || '';

            // Actualizar etiqueta del período
            const periodLabel = document.getElementById('finance-period-label');
            if (periodLabel && fechaFiltroVal) {
                if (filtroPeriodo === 'month') {
                    const [y, m] = fechaFiltroVal.split('-');
                    const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
                    const monthName = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                    periodLabel.innerText = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                } else {
                    const d = new Date(fechaFiltroVal);
                    periodLabel.innerText = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            }

            const allExpenses = window.expenseModel.expenses || [];
            const allOrders = window.orderModel.reportes || [];

            // Filtrar gastos manuales por fecha/mes
            const expenses = allExpenses.filter(e => {
                if (!fechaFiltroVal) return true;
                const dateStr = (e.fecha || '').substring(0, 10);
                if (filtroPeriodo === 'month') {
                    return dateStr.substring(0, 7) === fechaFiltroVal;
                } else {
                    return dateStr === fechaFiltroVal;
                }
            });

            // Filtrar pedidos por fecha/mes
            const orders = allOrders.filter(ped => {
                if (!fechaFiltroVal) return true;
                const rawFecha = ped.created_at || ped.fecha || '';
                let dateStr = '';
                if (typeof rawFecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawFecha)) {
                    dateStr = rawFecha.substring(0, 10);
                } else {
                    try {
                        const d = new Date(rawFecha);
                        if (!isNaN(d.getTime())) {
                            dateStr = d.toISOString().substring(0, 10);
                        }
                    } catch (_) {}
                }
                if (filtroPeriodo === 'month') {
                    return dateStr.substring(0, 7) === fechaFiltroVal;
                } else {
                    return dateStr === fechaFiltroVal;
                }
            });

            let totalManual = 0;
            let totalOrders = 0;
            const categories = {};

            // Procesar Gastos Manuales - filtrar por tienda seleccionada y rol
            expenses.forEach(e => {
                const tienda = e.tienda || 'General';
                // Franquiciado solo ve su tienda asignada
                if (!isAdmin && tienda !== profile.tienda_asignada) {
                    return;
                }
                // Filtrar por tienda seleccionada en dropdown
                if (tiendaSeleccionada !== 'todas' && tienda !== tiendaSeleccionada) {
                    return;
                }
                
                totalManual += e.monto;
                if (this.currentView === 'total' || this.currentView === 'manual') {
                    categories[e.categoria] = (categories[e.categoria] || 0) + e.monto;
                }
            });

            // Procesar Gastos de Pedidos - filtrar por tienda seleccionada y rol
            orders.forEach(ped => {
                // Franquiciado solo ve su tienda asignada
                if (!isAdmin && ped.tienda !== profile.tienda_asignada) {
                    return;
                }
                // Filtrar por tienda seleccionada en dropdown
                if (tiendaSeleccionada !== 'todas' && ped.tienda !== tiendaSeleccionada) {
                    return;
                }
                
                const detalles = ped.detalle || [];
                detalles.forEach(item => {
                    const itemCompletado = item?.estado_producto === 'completado' || item?.archivado === true;
                    const pedidoCompletado = ped?.estado === 'completado';
                    if (!itemCompletado && !pedidoCompletado) {
                        return;
                    }

                    const cost = (item.cantidad_pedida * (item.precio_referencia || 0));
                    totalOrders += cost;
                    if (this.currentView === 'total' || this.currentView === 'pedidos') {
                        categories['Insumos'] = (categories['Insumos'] || 0) + cost;
                    }
                });
            });

            const granTotal = totalManual + totalOrders;
            
            const totalElement = document.getElementById('finance-gran-total');
            if (totalElement) {
                totalElement.innerText =
                    (this.currentView === 'manual' ? totalManual : (this.currentView === 'pedidos' ? totalOrders : granTotal)).toFixed(2) + "€";
            } else {
                console.warn('⚠️ Elemento finance-gran-total no encontrado');
            }

            this.renderChart(categories);
            this.renderGastosPorTienda(expenses, orders);
            this.renderExpensesTable(expenses);
        } catch (err) {
            console.error('❌ Error en renderFinanceStats:', err);
        }
    },

    renderChart(categories) {
        const flowDiv = document.getElementById('expenseFlow');
        if (!flowDiv) return;

        // Calcular total para porcentajes
        const total = Object.values(categories).reduce((sum, val) => sum + val, 0);
        
        // Colores para las categorías
        const colors = {
            'Operación': '#7c3aed',
            'Mantenimiento': '#28a745',
            'Marketing': '#dc3545',
            'Nómina': '#ffc107',
            'Insumos': '#17a2b8',
            'Otros': '#6c757d'
        };

        // Crear tarjetas de flujo
        let html = '';
        
        if (total === 0) {
            html = '<p class="text-muted text-center small mb-0">Sin gastos registrados</p>';
        } else {
            Object.entries(categories).forEach(([categoria, monto]) => {
                const porcentaje = ((monto / total) * 100).toFixed(1);
                const color = colors[categoria] || '#7c3aed';
                
                html += `
                    <div class="expense-flow-item">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold small" style="color: ${color};">${categoria}</span>
                            <span class="badge fw-bold" style="background-color: ${color}; color: white;">€${monto.toFixed(2)}</span>
                        </div>
                        <div class="progress" style="height: 6px; background-color: rgba(0,0,0,0.05);">
                            <div class="progress-bar" style="width: ${porcentaje}%; background-color: ${color}; transition: width 0.3s ease;"></div>
                        </div>
                        <small class="text-muted d-block" style="font-size: 0.75rem; margin-top: 2px;">${porcentaje}% del total</small>
                    </div>
                `;
            });
        }

        flowDiv.innerHTML = html;
    },

    renderExpensesTable(expenses) {
        try {
            const profile = window.authModel.getProfile();
            const rol = profile.rol.toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            
            const tbody = document.getElementById('listaGastos');
            
            if (!tbody) {
                // Elemento listaGastos no existe - sección de gastos fue eliminada
                return;
            }
            
            
            // Franquiciado solo ve gastos de su tienda
            const expensesFiltered = isAdmin ? expenses : expenses.filter(e => 
                (e.tienda || 'General') === profile.tienda_asignada
            );
            
            
            tbody.innerHTML = expensesFiltered.map(e => `
                <tr>
                    <td class="small">${new Date(e.fecha).toLocaleDateString()}</td>
                    <td>${e.descripcion}</td>
                    <td><span class="badge bg-light text-dark shadow-sm">${e.categoria}</span></td>
                    <td><span class="badge bg-info text-dark small">${e.tienda || 'General'}</span></td>
                    <td class="text-end fw-bold">${e.monto.toFixed(2)}€</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-danger btn-eliminar-gasto" data-gasto-id="${e.id}" title="Eliminar gasto">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            
            // Agregar event listeners para botones de eliminar
            document.querySelectorAll('.btn-eliminar-gasto').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const gastoId = btn.dataset.gastoId;
                    
                    if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
                        return;
                    }
                    
                    try {
                        await window.expenseModel.deleteExpense(gastoId);
                        window.ui.showNotify('Éxito', 'Gasto eliminado correctamente', 'success');
                        await this.refreshData();
                    } catch (err) {
                        console.error('Error al eliminar gasto:', err);
                        window.ui.showNotify('Error', 'No se pudo eliminar el gasto: ' + err.message, 'danger');
                    }
                });
            });
        } catch (err) {
            console.error('❌ Error renderizando tabla de gastos:', err);
        }
    },

    async renderEmployeeList() {
        const listDiv = document.getElementById('lista-empleados-nomina');
        
        // Si el elemento no existe (sección de nómina fue eliminada), salir
        if (!listDiv) {
            return;
        }

        const profile = window.authModel.getProfile();
        const rol = profile.rol.toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        
        // Franquiciado no debe ver la lista de empleados (nómina es solo Admin)
        if (!isAdmin) {
            listDiv.innerHTML = '<div class="alert alert-info"><i class="bi bi-lock-fill"></i> Solo administradores pueden ver la nómina</div>';
            return;
        }

        const profiles = await window.authModel.fetchAllProfiles();

        listDiv.innerHTML = profiles.map(emp => {
            const isInactive = !emp.activo;
            const rol = emp.rol.toLowerCase();

            return `
            <div class="list-group-item px-0 py-3 border-light">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div class="fw-bold text-dark d-flex align-items-center">
                            ${emp.nombre_usuario}
                            ${emp.activo ? '<span class="badge bg-success-subtle text-success ms-2 x-small">ACTIVO</span>' : '<span class="badge bg-danger-subtle text-danger ms-2 x-small">BAJA</span>'}
                        </div>
                        <div class="text-muted x-small text-uppercase">${emp.rol}</div>
                    </div>
                </div>
                
                <div class="d-flex gap-2 align-items-center">
                    <div class="input-group input-group-sm" style="max-width: 140px;">
                        <span class="input-group-text bg-light border-0">€</span>
                        <input type="number" class="form-control border-0 bg-light" value="${emp.sueldo_mensual || 0}" 
                               id="sueldo-input-${emp.id}" 
                               onchange="window.financeController.updateSueldo('${emp.nombre_usuario}', this.value)">
                    </div>
                    
                    <div class="ms-auto">
                        ${emp.activo ? `
                             <button class="btn btn-sm btn-outline-danger border-0" onclick="window.financeController.bajaEmpleado('${emp.nombre_usuario}', ${emp.sueldo_mensual})">
                                <i class="bi bi-person-x"></i> BAJA
                            </button>
                        ` : `
                             <button class="btn btn-sm btn-outline-success border-0" onclick="window.financeController.altaEmpleado('${emp.nombre_usuario}')">
                                <i class="bi bi-person-check"></i> ALTA
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `}).join('');
    },

    async updateSueldo(email, value) {
        // Solo Admin puede actualizar sueldos
        if (!window.authModel.isAdmin()) {
            alert('❌ Acceso denegado: Solo el administrador puede actualizar sueldos');
            return;
        }
        
        const monto = parseFloat(value);
        if (isNaN(monto) || monto < 0) return alert("Sueldo no válido.");
        try {
            await window.authModel.updateProfile(email, { sueldo_mensual: monto });
            // No refrescamos toda la lista para no perder el foco si hay muchos, 
            // pero notificamos éxito sutilmente (o simplemente dejamos que el usuario lo vea)
        } catch (e) {
            alert("Error al actualizar sueldo: " + e.message);
        }
    },

    async altaEmpleado(email) {
        // Solo Admin puede dar de alta empleados
        if (!window.authModel.isAdmin()) {
            alert('❌ Acceso denegado: Solo el administrador puede dar de alta empleados');
            return;
        }
        
        try {
            await window.authModel.updateProfile(email, { activo: true });
            await this.refreshData();
        } catch (e) {
            alert("Error: " + e.message);
        }
    },

    async bajaEmpleado(email, sueldo) {
        // Solo Admin puede dar de baja empleados
        if (!window.authModel.isAdmin()) {
            alert('❌ Acceso denegado: Solo el administrador puede dar de baja empleados');
            return;
        }
        
        const today = new Date();
        const daysWorked = today.getDate();

        try {
            await window.expenseModel.terminateEmployee(email, daysWorked, sueldo);
            alert(`✅ Empleado dado de baja y liquidación registrada con éxito.`);
            await this.refreshData();
        } catch (e) {
            alert("❌ Error en baja: " + e.message);
        }
    },

    renderGastosPorTienda(filteredExpenses = null, filteredOrders = null) {
        const canvas = document.getElementById('chartGastosPorTienda');
        if (!canvas) return;

        const expenses = filteredExpenses || window.expenseModel.expenses || [];
        const orders = filteredOrders || window.orderModel.reportes || [];
        const gastosPorTienda = {};
        const tiendaSeleccionada = document.getElementById('tiendaSelect')?.value || 'todas';

        // Procesar gastos manuales
        expenses.forEach(e => {
            const tienda = e.tienda || 'General';
            if (tiendaSeleccionada !== 'todas' && tienda !== tiendaSeleccionada) return;
            if (this.currentView === 'total' || this.currentView === 'manual') {
                gastosPorTienda[tienda] = (gastosPorTienda[tienda] || 0) + e.monto;
            }
        });

        // Procesar gastos de pedidos por tienda
        orders.forEach(ped => {
            const tienda = ped.tienda || 'General';
            if (tiendaSeleccionada !== 'todas' && tienda !== tiendaSeleccionada) return;
            if (this.currentView === 'total' || this.currentView === 'pedidos') {
                const detalles = ped.detalle || [];
                detalles.forEach(item => {
                    const itemCompletado = item?.estado_producto === 'completado' || item?.archivado === true;
                    const pedidoCompletado = ped?.estado === 'completado';
                    if (!itemCompletado && !pedidoCompletado) {
                        return;
                    }

                    const cost = (item.cantidad_pedida * (item.precio_referencia || 0));
                    gastosPorTienda[tienda] = (gastosPorTienda[tienda] || 0) + cost;
                });
            }
        });

        // Colores por tienda - Paleta completa y variada
        const tiendaColores = {
            'Boadilla': '#7c3aed',
            'Centro': '#0d6efd',
            'Online': '#198754',
            'General': '#6c757d'
        };

        // Paleta de colores para generar automáticamente
        const colorPaleta = [
            '#7c3aed', '#a855f7', '#0d6efd', '#0dcaf0', '#198754', '#20c997',
            '#ffc107', '#fd7e14', '#dc3545', '#f472b6', '#e91e63', '#9c27b0',
            '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688',
            '#4caf50', '#8bc34a', '#cddc39', '#ff5722', '#795548', '#607d8b'
        ];

        const labels = Object.keys(gastosPorTienda);
        const data = Object.values(gastosPorTienda);
        
        // Crear colores asignando un color único por tienda
        const backgroundColors = labels.map((tienda, index) => {
            // Si está en el mapa predefinido, usar ese color
            if (tiendaColores[tienda]) {
                return tiendaColores[tienda];
            }
            // Si no, usar un color de la paleta basado en el índice
            return colorPaleta[index % colorPaleta.length];
        });

        const borderColors = labels.map((tienda, index) => {
            // Usar el mismo color que el fondo pero más oscuro
            if (tiendaColores[tienda]) {
                return tiendaColores[tienda];
            }
            return colorPaleta[index % colorPaleta.length];
        });

        // Destruir gráfico anterior si existe
        if (window.chartGastosPorTiendaInstance) {
            window.chartGastosPorTiendaInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        window.chartGastosPorTiendaInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Sin datos'],
                datasets: [{
                    label: 'Gastos (€)',
                    data: data.length > 0 ? data : [0],
                    backgroundColor: backgroundColors.length > 0 ? backgroundColors : ['#ccc'],
                    borderColor: borderColors.length > 0 ? borderColors : ['#ccc'],
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 'flex',
                    maxBarThickness: 50
                }]
            },
            options: {
                indexAxis: 'y', // Barras horizontales
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return '€' + context.parsed.x.toFixed(2);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '€' + value.toFixed(0);
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Exporta los gastos actuales a PDF
     */

};

window.financeController = financeController;
