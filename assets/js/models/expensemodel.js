const expenseModel = {
    expenses: [],
    usarLocalStorage: false, // Fallback si tabla no existe
    tableChecked: false, // Evitar verificar múltiples veces

    async checkTableStatus() {
        if (this.tableChecked) return this.usarLocalStorage;
        
        try {
            const { error } = await window._supabase
                .from('gastos')
                .select('count', { count: 'exact', head: true });
            
            if (error?.code === '42P01') {
                console.warn('⚠️ Tabla "gastos" no existe. Usando localStorage.');
                this.usarLocalStorage = true;
            } else {
                this.usarLocalStorage = false;
            }
        } catch (err) {
            console.warn('⚠️ No se pudo verificar tabla, usando localStorage por seguridad');
            this.usarLocalStorage = true;
        }
        
        this.tableChecked = true;
        return this.usarLocalStorage;
    },

    async fetchExpenses() {
        try {
            
            // Si ya sabemos que usamos localStorage, cargar de ahí
            if (this.usarLocalStorage) {
                const stored = localStorage.getItem('gastos_backup');
                this.expenses = stored ? JSON.parse(stored) : [];
                return this.expenses;
            }

            const { data, error } = await window._supabase
                .from('gastos')
                .select('*')
                .order('fecha', { ascending: false });

            if (error) {
                console.warn('⚠️ Error intentando obtener de Supabase, usando localStorage:', error.message);
                this.usarLocalStorage = true;
                
                // Fallback a localStorage
                const stored = localStorage.getItem('gastos_backup');
                this.expenses = stored ? JSON.parse(stored) : [];
                return this.expenses;
            }
            
            this.expenses = data || [];
            
            // Respaldar en localStorage también
            localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
            return this.expenses;
        } catch (err) {
            console.error('Error en fetchExpenses:', err);
            
            // Último recurso: localStorage
            const stored = localStorage.getItem('gastos_backup');
            this.expenses = stored ? JSON.parse(stored) : [];
            return this.expenses;
        }
    },

    async addExpense(expenseData) {
        try {
            
            if (!window._supabase) {
                throw new Error('Supabase no está inicializado');
            }
            
            // Si sabemos que hay que usar localStorage, hacerlo directamente
            if (this.usarLocalStorage) {
                const nuevoGasto = {
                    id: Date.now(),
                    ...expenseData,
                    created_at: new Date().toISOString()
                };
                
                this.expenses.unshift(nuevoGasto);
                localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                
                window.ui?.showNotify?.('Aviso', 'Gasto guardado localmente (sin conexión a servidor)', 'info');
                return true;
            }

            // Intentar insertar en Supabase
            const { data, error } = await window._supabase
                .from('gastos')
                .insert([expenseData])
                .select();

            if (error) {
                console.warn('⚠️ Error al insertar:', error.message);
                
                // Si es error de columna "tienda" no existe, intentar sin ella
                if (error.message?.includes('tienda')) {
                    const datosLimpios = { ...expenseData };
                    delete datosLimpios.tienda;
                    
                    const { data: data2, error: error2 } = await window._supabase
                        .from('gastos')
                        .insert([datosLimpios])
                        .select();
                    
                    if (error2) {
                        console.error('❌ Sigue fallando:', error2.message);
                        throw error2;
                    }
                    
                    if (data2 && data2.length > 0) {
                        this.expenses.unshift(data2[0]);
                        localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                    }
                    return true;
                }
                
                // Si es error de tabla no existe, usar localStorage
                if (error.code === '42P01' || error.message?.includes('not exist')) {
                    this.usarLocalStorage = true;
                    
                    const nuevoGasto = {
                        id: Date.now(),
                        ...expenseData,
                        created_at: new Date().toISOString()
                    };
                    
                    this.expenses.unshift(nuevoGasto);
                    localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                    
                    window.ui?.showNotify?.('Aviso', 'Gasto guardado localmente. Tabla "gastos" no existe.', 'warning');
                    return true;
                }
                
                throw new Error(error.message || 'Error al guardar gasto');
            }
            
            
            if (data && data.length > 0) {
                this.expenses.unshift(data[0]);
                localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
            }
            
            return true;
        } catch (err) {
            console.error('❌ Error en addExpense:', err);
            
            // Fallback final: guardar en localStorage
            try {
                const nuevoGasto = {
                    id: Date.now(),
                    ...expenseData,
                    created_at: new Date().toISOString()
                };
                
                this.expenses.unshift(nuevoGasto);
                localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                
                window.ui?.showNotify?.('Aviso', 'Gasto guardado localmente', 'warning');
                return true;
            } catch (localErr) {
                console.error('❌ Error incluso guardando en localStorage:', localErr);
                throw new Error('No se pudo guardar el gasto en ningún lugar');
            }
        }
    },

    async checkAndProcessPayroll() {
        // Lógica para verificar si es fin de mes y si ya se procesó la nómina
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

        if (today.getDate() !== lastDayOfMonth) return; // Solo el último día

        const monthLabel = today.toLocaleString('es-ES', { month: 'long' });

        // Verificar si ya existe nómina para este mes/año
        const { data: existing } = await window._supabase
            .from('gastos')
            .select('id')
            .eq('categoria', 'Nómina')
            .eq('es_automatico', true)
            .gte('fecha', new Date(year, month, 1).toISOString())
            .lte('fecha', new Date(year, month, lastDayOfMonth, 23, 59, 59).toISOString());

        if (existing && existing.length > 0) return; // Ya procesado

        // Obtener empleados activos
        const { data: employees } = await window._supabase
            .from('Tabla De Perfiles')
            .select('*')
            .eq('rol', 'empleado')
            .eq('activo', true);

        if (!employees) return;

        for (const emp of employees) {
            if (emp.sueldo_mensual > 0) {
                await this.addExpense({
                    descripcion: `Sueldo Mensual - ${monthLabel} (${emp.nombre_usuario})`,
                    categoria: 'Nómina',
                    monto: emp.sueldo_mensual,
                    es_automatico: true,
                    usuario_referencia: emp.nombre_usuario
                });
            }
        }
    },

    async terminateEmployee(email, daysWorked, monthlySalary) {
        const resignationPay = (monthlySalary / 30) * daysWorked;

        // 1. Desactivar empleado
        const { error: err1 } = await window._supabase
            .from('Tabla De Perfiles')
            .update({ activo: false })
            .ilike('nombre_usuario', email);

        if (err1) throw err1;

        // 2. Registrar gasto de liquidación
        await this.addExpense({
            descripcion: `Liquidación/Sueldo Proporcional - ${email} (${daysWorked} días)`,
            categoria: 'Nómina',
            monto: parseFloat(resignationPay.toFixed(2)),
            usuario_referencia: email
        });

        return resignationPay;
    },

    async deleteExpense(expenseId) {
        try {
            
            if (!window._supabase) {
                throw new Error('Supabase no está inicializado');
            }
            
            // 🔐 VALIDACIÓN DE PERMISOS: Verificar que usuario tenga derecho a eliminar este gasto
            const profile = window.authModel.getProfile();
            const rol = (profile.rol || '').toLowerCase().trim();
            const isAdmin = rol === 'administrador' || rol === 'auxiliar_administrativo';
            
            // Buscar el gasto para validar tienda
            const gasto = this.expenses.find(e => String(e.id) === String(expenseId));
            
            if (gasto && !isAdmin) {
                // Franquiciado solo puede eliminar gastos de su tienda
                const tiendaGasto = (gasto.tienda || 'General').trim();
                const tiendaUsuario = (profile.tienda_asignada || 'Todas').trim();
                
                if (tiendaGasto !== tiendaUsuario) {
                    console.error(`🔐 Acceso denegado: Franquiciado no puede eliminar gastos de tienda ${tiendaGasto}`);
                    throw new Error(`❌ No tienes permiso para eliminar gastos de la tienda "${tiendaGasto}"`);
                }
            }
            
            // Convertir a string si es número
            const idStr = String(expenseId);
            
            // Si estamos usando localStorage o el ID es un número (localStorage)
            if (this.usarLocalStorage || !isNaN(expenseId)) {
                const index = this.expenses.findIndex(e => String(e.id) === idStr);
                if (index > -1) {
                    this.expenses.splice(index, 1);
                    localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                    return true;
                }
                throw new Error('Gasto no encontrado en localStorage');
            }

            // Intentar eliminar de Supabase (si es UUID)
            const { error } = await window._supabase
                .from('gastos')
                .delete()
                .eq('id', idStr);

            if (error) {
                console.error('❌ Error al eliminar en Supabase:', error.message);
                
                // Si tabla no existe, usar localStorage
                if (error.code === '42P01' || error.message?.includes('not exist')) {
                    this.usarLocalStorage = true;
                    // Intentar eliminar de localStorage
                    const index = this.expenses.findIndex(e => String(e.id) === idStr);
                    if (index > -1) {
                        this.expenses.splice(index, 1);
                        localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
                        return true;
                    }
                }
                throw error;
            }

            // Eliminar de la lista local también
            const index = this.expenses.findIndex(e => String(e.id) === idStr);
            if (index > -1) {
                this.expenses.splice(index, 1);
                localStorage.setItem('gastos_backup', JSON.stringify(this.expenses));
            }

            return true;
        } catch (err) {
            console.error('❌ Error en deleteExpense:', err);
            throw err;
        }
    }
};

window.expenseModel = expenseModel;
