const copiasPedidosController = {
    initialized: false,
    expandedDays: new Set(), // Días actualmente expandidos

    getDateKey(value = new Date()) {
        if (value instanceof Date) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return '';

        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    formatDateDisplay(dateKey) {
        if (!dateKey) return '-';
        const [y, m, d] = dateKey.split('-');
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
    },

    extractProveedor(pedido) {
        if (pedido?.proveedor) return String(pedido.proveedor).trim();
        const obs = String(pedido?.observaciones || '');
        const match = obs.match(/Proveedor:\s*([^,\n|]+)/i);
        return match ? String(match[1] || '').trim() : '-';
    },

    extractResponsable(pedido) {
        const obs = String(pedido?.observaciones || '');
        const match = obs.match(/Responsable:\s*([^,\n|]+)/i);
        return match ? String(match[1] || '').trim() : '-';
    },

    bindEvents() {
        if (this.initialized) return;

        const fecha = document.getElementById('copias-fecha');
        if (fecha) fecha.addEventListener('change', () => this.render());

        const tienda = document.getElementById('copias-tienda');
        if (tienda) tienda.addEventListener('change', () => this.render());

        const btnRecargar = document.getElementById('btn-recargar-copias');
        if (btnRecargar) btnRecargar.addEventListener('click', () => this.init());

        this.initialized = true;
    },

    setupFilters() {
        const fecha = document.getElementById('copias-fecha');
        if (fecha && !fecha.value) {
            fecha.value = ''; // Sin fecha por defecto: mostrar todos
        }

        const tiendaSelect = document.getElementById('copias-tienda');
        if (!tiendaSelect) return;

        const profile = window.authModel?.getProfile?.() || {};
        const rol = String(profile.rol || '').toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        const isFranquiciado = rol === 'franquiciado';

        const tiendas = Array.isArray(window.productModel?.tiendas) ? window.productModel.tiendas : [];

        if (isFranquiciado) {
            const tiendaAsignada = profile.tienda_asignada || 'Mi tienda';
            tiendaSelect.innerHTML = `<option value="${tiendaAsignada}">${tiendaAsignada}</option>`;
            tiendaSelect.value = tiendaAsignada;
            tiendaSelect.disabled = true;
            return;
        }

        const options = tiendas.map(t => `<option value="${t.nombre_tienda}">${t.nombre_tienda}</option>`).join('');
        tiendaSelect.innerHTML = `<option value="todas">Todas las tiendas</option>${options}`;
        tiendaSelect.disabled = !isAdmin;
    },

    canAccess() {
        const profile = window.authModel?.getProfile?.() || {};
        const rol = String(profile.rol || '').toLowerCase().trim();
        return rol === 'administrador' || rol === 'auxiliar_administrativo' || rol === 'franquiciado';
    },

    async init() {
        if (!this.canAccess()) {
            window.ui.showNotify('No tienes permisos para ver copias de pedidos.', 'warning');
            return;
        }

        this.bindEvents();
        await window.orderModel.fetchReportes(true);
        this.setupFilters();
        this.render();
    },

    toggleDay(dateKey) {
        if (this.expandedDays.has(dateKey)) {
            this.expandedDays.delete(dateKey);
        } else {
            this.expandedDays.add(dateKey);
        }
        this.render();
    },

    render() {
        const tbody = document.getElementById('tbody-copias-pedidos');
        if (!tbody) return;

        const profile = window.authModel?.getProfile?.() || {};
        const rol = String(profile.rol || '').toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';

        const fechaFiltro = document.getElementById('copias-fecha')?.value || '';
        const tiendaFiltro = document.getElementById('copias-tienda')?.value || 'todas';

        let pedidos = Array.isArray(window.orderModel?.reportes) ? [...window.orderModel.reportes] : [];

        if (rol === 'franquiciado') {
            pedidos = pedidos.filter(p => String(p.tienda || '').trim() === String(profile.tienda_asignada || '').trim());
        }

        if (fechaFiltro) {
            pedidos = pedidos.filter(p => this.getDateKey(p.fecha || p.created_at) === this.getDateKey(fechaFiltro));
        }

        if (isAdmin && tiendaFiltro !== 'todas') {
            pedidos = pedidos.filter(p => String(p.tienda || '').trim() === String(tiendaFiltro).trim());
        }

        if (!pedidos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>No hay copias de pedidos para los filtros actuales.</td></tr>';
            return;
        }

        // Agrupar pedidos por día
        const porDia = {};
        pedidos.forEach(pedido => {
            const dateKey = this.getDateKey(pedido.fecha || pedido.created_at);
            if (!porDia[dateKey]) porDia[dateKey] = [];
            porDia[dateKey].push(pedido);
        });

        // Ordenar días de más reciente a más antiguo
        const diasOrdenados = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

        let html = '';

        diasOrdenados.forEach(dateKey => {
            const pedidosDia = porDia[dateKey];
            const isExpanded = this.expandedDays.has(dateKey);
            const arrow = isExpanded ? 'bi-chevron-down' : 'bi-chevron-right';

            // Calcular resumen del día
            let totalProductos = 0;
            let tiendas = new Set();
            let proveedores = new Set();
            pedidosDia.forEach(p => {
                tiendas.add(p.tienda || '-');
                proveedores.add(this.extractProveedor(p));
                const detalle = Array.isArray(p.detalle) ? p.detalle : [];
                totalProductos += detalle.length;
            });

            const tiendasTxt = tiendas.size <= 2
                ? [...tiendas].join(', ')
                : `${[...tiendas].slice(0, 2).join(', ')} +${tiendas.size - 2}`;

            // Fila cabecera del día (siempre visible)
            html += `
                <tr class="table-light fw-bold" style="cursor:pointer; user-select:none;" onclick="copiasPedidosController.toggleDay('${dateKey}')">
                    <td colspan="6">
                        <div class="d-flex align-items-center gap-3">
                            <i class="bi ${arrow} text-purple fs-6" style="transition: transform 0.2s;"></i>
                            <span class="text-purple fs-6">📅 ${this.formatDateDisplay(dateKey)}</span>
                            <span class="badge bg-purple text-white ms-1">${pedidosDia.length} pedido${pedidosDia.length !== 1 ? 's' : ''}</span>
                            <span class="badge bg-light text-dark border">${totalProductos} producto${totalProductos !== 1 ? 's' : ''}</span>
                            <small class="text-muted ms-2">${tiendasTxt}</small>
                        </div>
                    </td>
                </tr>`;

            // Filas de detalle (solo si está expandido)
            if (isExpanded) {
                pedidosDia.forEach(pedido => {
                    const proveedor = this.extractProveedor(pedido);
                    const responsable = this.extractResponsable(pedido);
                    const detalle = Array.isArray(pedido.detalle) ? pedido.detalle : [];
                    const fechaTxt = pedido.fecha ? new Date(pedido.fecha).toLocaleString('es-ES') : '-';

                    if (detalle.length === 0) return;

                    // Subcabecera del pedido dentro del día
                    html += `
                        <tr style="background: #f8f5ff;">
                            <td colspan="6" class="py-1 ps-5">
                                <small class="text-muted">
                                    <i class="bi bi-clock me-1"></i>${fechaTxt}
                                    &nbsp;|&nbsp;
                                    <strong>${pedido.tienda || '-'}</strong>
                                    &nbsp;|&nbsp;
                                    <span class="badge bg-secondary">${proveedor}</span>
                                    &nbsp;|&nbsp;
                                    <i class="bi bi-person me-1"></i>${responsable}
                                </small>
                            </td>
                        </tr>`;

                    // Filas de productos
                    detalle.forEach(item => {
                        html += `
                            <tr style="background: #fdfcff;">
                                <td class="ps-5" style="border-left: 3px solid #7c3aed;"></td>
                                <td>${pedido.tienda || '-'}</td>
                                <td><span class="badge bg-secondary">${proveedor}</span></td>
                                <td>${item.producto || '-'}</td>
                                <td class="text-center fw-bold text-primary">${Number(item.cantidad_pedida) || 0}</td>
                                <td>${responsable}</td>
                            </tr>`;
                    });
                });

                // Separador visual al cerrar el grupo
                html += `<tr><td colspan="6" style="padding: 2px; background: #e9e3ff;"></td></tr>`;
            }
        });

        tbody.innerHTML = html;
    }
};

window.copiasPedidosController = copiasPedidosController;
