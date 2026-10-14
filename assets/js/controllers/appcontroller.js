const appController = {
    keyboardEventsBound: false,

    bindGlobalEvents() {
        const navInv = document.getElementById('nav-inv');
        const navStockFaltante = document.getElementById('link-stock-faltante');
        const navRep = document.getElementById('link-reportes');

        const closeMenu = () => {
            const navCollapse = document.getElementById('navAppContent');
            if (navCollapse.classList.contains('show')) {
                const bsCollapse = bootstrap.Collapse.getInstance(navCollapse);
                if (bsCollapse) bsCollapse.hide();
            }
        };

        if (navInv) navInv.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('inventario');
            closeMenu();
        });
        if (navStockFaltante) navStockFaltante.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('stock-faltante');
            window.stockFaltanteController.init();
            closeMenu();
        });
        if (navRep) navRep.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('reportes');
            window.reportController.cargarReportes('financiero');
            closeMenu();
        });
        const navFin = document.getElementById('link-finanzas');
        if (navFin) navFin.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('gastos');
            window.financeController.init();
            closeMenu();
        });
        const navProv = document.getElementById('link-proveedores');
        if (navProv) navProv.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('proveedores');
            window.providerController.init();
            closeMenu();
        });
        const navCopias = document.getElementById('link-copias');
        if (navCopias) navCopias.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('copias');
            window.copiasPedidosController?.init?.();
            closeMenu();
        });
        const navEmp = document.getElementById('link-empleados');
        if (navEmp) navEmp.addEventListener('click', (event) => {
            event.preventDefault();
            this.showSection('empleados');
            window.employeeController.init();
            window.tiendaController.init();
            closeMenu();
        });

        if (!this.keyboardEventsBound) {
            document.addEventListener('keydown', (event) => this.handleGlobalKeydown(event));
            this.keyboardEventsBound = true;
        }
    },
    async initializeDashboard() {
        const profile = window.authModel.getProfile();
        this.setupRoleVisibility(profile);

        // Pre-cargar proveedores globalmente
        if (window.providerModel) {
            await window.providerModel.fetchProveedores();
        }

        // Ejecución en paralelo de la carga inicial
        await window.inventoryController.init();

        window.authController.bindEvents();
        window.inventoryController.bindEvents();
        window.reportController.bindEvents();

        const rol = profile.rol.toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        const isFranquiciado = rol === 'franquiciado';
        
        // Inicializar Finance para Admin y Franquiciado
        if (isAdmin || isFranquiciado) {
            await window.financeController.init();
        }
    },
    setupRoleVisibility(profile) {
        const rol = profile.rol.toLowerCase().trim();
        const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
        const isAdminOnly = rol === 'administrador';
        const isFranquiciado = rol === 'franquiciado';

        document.getElementById('userTag').innerText = profile.nombre_usuario;
        document.getElementById('roleBadge').innerText = rol;
        let badgeClass = 'bg-secondary';
        if (rol === 'administrador') badgeClass = 'bg-danger';
        else if (rol === 'auxiliar_administrativo') badgeClass = 'bg-warning text-dark';
        else if (rol === 'franquiciado') badgeClass = 'bg-primary';
        else if (rol === 'empleado') badgeClass = 'bg-success';
        document.getElementById('roleBadge').className = `badge badge-role ms-2 text-uppercase ${badgeClass}`;

        // Admin (incluye Auxiliar Admin) y Franquiciado pueden ver Stock Faltante
        const canViewOrders = isAdmin || isFranquiciado;
        document.getElementById('link-stock-faltante-wrap').style.display = canViewOrders ? 'block' : 'none';
        
        // Admin (incluye Auxiliar Admin) y Franquiciado pueden ver reportes financieros
        document.getElementById('link-reportes-wrap').style.display = (isAdmin || isFranquiciado) ? 'block' : 'none';

        const finWrap = document.getElementById('link-finanzas-wrap');
        if (finWrap) {
            finWrap.style.display = (isAdmin || isFranquiciado) ? 'block' : 'none';
        }

        // Admin y Franquiciado pueden acceder a gestión de proveedores
        const provWrap = document.getElementById('link-proveedores-wrap');
        if (provWrap) {
            provWrap.style.display = (isAdmin || isFranquiciado) ? 'block' : 'none';
        }

        // Admin, Auxiliar Administrativo y Franquiciado pueden ver copias de pedidos
        const copiasWrap = document.getElementById('link-copias-wrap');
        if (copiasWrap) {
            copiasWrap.style.display = (isAdmin || isFranquiciado) ? 'block' : 'none';
        }

        // Admin (incluye Auxiliar Admin) y Franquiciado pueden acceder a gestión de empleados/usuarios
        const empWrap = document.getElementById('link-empleados-wrap');
        if (empWrap) {
            empWrap.style.display = (isAdmin || isFranquiciado) ? 'block' : 'none';
        }
        
        const btnAddEmployee = document.getElementById('btn-add-employee');
        if (btnAddEmployee) {
            btnAddEmployee.style.display = isAdmin ? 'block' : 'none';
        }
        
        // Admin (incluye Auxiliar Admin) puede acceder a gestión de tiendas
        const panelTiendas = document.getElementById('panel-tiendas');
        if (panelTiendas) {
            panelTiendas.classList.toggle('d-none', !isAdmin);
        }
    },
    showSection(sec) {
        document.getElementById('sec-inventario').style.display = (sec === 'inventario') ? 'block' : 'none';
        document.getElementById('sec-stock-faltante').style.display = (sec === 'stock-faltante') ? 'block' : 'none';
        document.getElementById('sec-reportes').style.display = (sec === 'reportes') ? 'block' : 'none';
        document.getElementById('sec-gastos').style.display = (sec === 'gastos') ? 'block' : 'none';
        document.getElementById('sec-proveedores').style.display = (sec === 'proveedores') ? 'block' : 'none';
        document.getElementById('sec-copias').style.display = (sec === 'copias') ? 'block' : 'none';
        document.getElementById('sec-empleados').style.display = (sec === 'empleados') ? 'block' : 'none';

        document.getElementById('nav-inv').classList.toggle('active', sec === 'inventario');
        
        const linkStockFaltante = document.getElementById('link-stock-faltante');
        if (linkStockFaltante) linkStockFaltante.classList.toggle('active', sec === 'stock-faltante');
        
        document.getElementById('link-reportes').classList.toggle('active', sec === 'reportes');

        const linkFin = document.getElementById('link-finanzas');
        if (linkFin) linkFin.classList.toggle('active', sec === 'gastos');

        const linkProv = document.getElementById('link-proveedores');
        if (linkProv) linkProv.classList.toggle('active', sec === 'proveedores');

        const linkCopias = document.getElementById('link-copias');
        if (linkCopias) linkCopias.classList.toggle('active', sec === 'copias');

        const linkEmp = document.getElementById('link-empleados');
        if (linkEmp) linkEmp.classList.toggle('active', sec === 'empleados');
    },

    handleGlobalKeydown(event) {
        const activeModal = this.getActiveModal();
        if (!activeModal) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            activeModal.close();
            return;
        }

        if (event.key === 'Tab') {
            this.trapFocus(event, activeModal.modal);
        }
    },

    getActiveModal() {
        const modalConfigs = [
            {
                modal: document.getElementById('modal-product'),
                close: () => window.inventoryController?.cerrarModalProducto?.()
            },
            {
                modal: document.getElementById('modal-employee'),
                close: () => window.employeeController?.cerrarModal?.()
            },
            {
                modal: document.getElementById('modal-tienda'),
                close: () => window.tiendaController?.cerrarModal?.()
            },
            {
                modal: document.getElementById('modal-nuevo-proveedor'),
                close: () => window.providerController?.cerrarModalProveedor?.()
            },
            {
                modal: document.getElementById('update-modal'),
                close: () => document.getElementById('update-modal')?.remove()
            },
            {
                modal: document.getElementById('pwa-install-modal'),
                close: () => document.getElementById('pwa-install-modal')?.remove()
            }
        ];

        return modalConfigs.find(config => this.isVisible(config.modal)) || null;
    },

    focusFirstElementInModal(modal) {
        const focusable = this.getFocusableElements(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    },

    trapFocus(event, modal) {
        const focusable = this.getFocusableElements(modal);
        if (focusable.length === 0) {
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (!modal.contains(active)) {
            event.preventDefault();
            first.focus();
            return;
        }

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
            return;
        }

        if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    },

    getFocusableElements(container) {
        if (!container) {
            return [];
        }

        const selectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        return Array.from(container.querySelectorAll(selectors)).filter(element => this.isFocusable(element));
    },

    isFocusable(element) {
        if (!element) {
            return false;
        }

        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    },

    isVisible(element) {
        if (!element) {
            return false;
        }

        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }
};

window.appController = appController;
