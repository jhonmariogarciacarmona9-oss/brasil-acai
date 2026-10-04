const productModel = {
    productosBase: [],
    proveedores: [],
    tiendas: [],
    stockPorTienda: {}, // Cache: { productoId: { tiendaNombre: { stock_maximo, stock_actual } } }

    async fetchTiendas() {
        const { data: tiendas, error } = await window._supabase.from('Tienda de Sucursal').select('id, nombre_tienda, direccion');
        if (error) {
            console.error("Error en Tiendas Supabase:", error);
            return this.tiendas || [];
        }
        this.tiendas = tiendas || [];
        return this.tiendas;
    },

    async fetchProductos() {
        // Cargar productos
        const { data: prods, error: prodError } = await window._supabase.from('productos').select('*').order('producto');
        
        if (prodError) {
            console.error('Error al cargar productos:', prodError);
            return this.productosBase || [];
        }
        
        // Cargar stock_por_tienda
        const { data: stockData, error: stockError } = await window._supabase.from('stock_por_tienda').select('*');
        
        if (stockError) {
            console.error('❌ ERROR al cargar stock_por_tienda:', stockError);
        }

        if (!stockData || stockData.length === 0) {
            console.warn('⚠️ ADVERTENCIA: stock_por_tienda está VACÍO o NULL');
        }
        
        // Construir mapa de stock por producto y tienda
        this.stockPorTienda = {};
        if (stockData) {
            stockData.forEach(stock => {
                const prodId = stock.producto_id;
                if (!this.stockPorTienda[prodId]) {
                    this.stockPorTienda[prodId] = {};
                }
                
                // Encontrar el nombre de la tienda
                const tienda = this.tiendas.find(t => t.id === stock.tienda_id);
                const tiendaNombre = tienda ? tienda.nombre_tienda : `Tienda_${stock.tienda_id}`;
                
                this.stockPorTienda[prodId][tiendaNombre] = {
                    stock_maximo: Number(stock.stock_maximo) || 0,
                    stock_actual: Number(stock.stock_actual) || 0
                };
            });
        }

        this.productosBase = prods || [];
        this.proveedores = [...new Set(this.productosBase.map(p => p.proveedor).filter(v => v))].sort();
        
        // Cargar proveedores de la tabla si existe providerModel
        if (window.providerModel && window.providerModel.proveedores.length === 0) {
            await window.providerModel.fetchProveedores();
        }
        
        return this.productosBase;
    },

    async updateProductoField(nombreProd, campo, valor, tiendaStr = null) {
        const prod = this.productosBase.find(p => p.producto === nombreProd);
        if (!prod) {
            console.error(`Producto no encontrado: ${nombreProd}`);
            return;
        }
        
        // Validar permiso: Franquiciado solo puede editar su tienda
        if ((campo === 'stock_actual' || campo === 'stock_maximo') && tiendaStr) {
            const profile = window.authModel.getProfile();
            const rol = (profile.rol || '').toLowerCase().trim();
            if (rol === 'franquiciado') {
                const tiendaActual = String(tiendaStr).trim();
                const tiendaAsignada = (profile.tienda_asignada || '').trim();
                if (tiendaActual !== tiendaAsignada) {
                    console.error(`❌ Franquiciado no puede editar tienda ${tiendaActual} (solo: ${tiendaAsignada})`);
                    window.ui.showNotify(`No puedes editar el stock de otra tienda`, 'danger');
                    return;
                }
            }
        }
        
        try {
            if (campo === 'stock_actual' || campo === 'stock_maximo') {
                if (!tiendaStr) {
                    console.error(`updateProductoField: tienda requerida para ${campo}`);
                    return;
                }
                
                const tiendaNorm = String(tiendaStr).trim();
                const valorNum = Math.max(0, Number(valor) || 0);
                
                // Encontrar tienda_id
                const tienda = this.tiendas.find(t => t.nombre_tienda === tiendaNorm);
                if (!tienda) {
                    console.error(`Tienda no encontrada: ${tiendaNorm}`);
                    return;
                }


                // Actualizar en memoria
                if (!this.stockPorTienda[prod.id]) {
                    this.stockPorTienda[prod.id] = {};
                }
                if (!this.stockPorTienda[prod.id][tiendaNorm]) {
                    this.stockPorTienda[prod.id][tiendaNorm] = { stock_maximo: 0, stock_actual: 0 };
                }
                this.stockPorTienda[prod.id][tiendaNorm][campo] = valorNum;
                
                // Obtener registro existente
                const { data: existente, error: selectError } = await window._supabase
                    .from('stock_por_tienda')
                    .select('*')
                    .eq('producto_id', prod.id)
                    .eq('tienda_id', tienda.id);

                if (selectError) {
                    console.error('Error al obtener registro:', selectError);
                    return;
                }

                
                let error;
                
                if (existente && existente.length > 0) {
                    // ACTUALIZAR registro existente - SOLO cambiar el campo específico
                    const updateData = { 
                        [campo]: valorNum, 
                        updated_at: new Date().toISOString() 
                    };
                    
                    
                    const result = await window._supabase.from('stock_por_tienda')
                        .update(updateData)
                        .eq('producto_id', prod.id)
                        .eq('tienda_id', tienda.id);
                    
                    error = result.error;
                    
                    if (error) {
                        console.error(`❌ Error PATCH:`, error, `Detalle:`, error.message);
                    } else {
                    }
                } else {
                    // CREAR nuevo registro - establecer ambos valores
                    const newData = {
                        producto_id: prod.id,
                        tienda_id: tienda.id,
                        stock_maximo: campo === 'stock_maximo' ? valorNum : 0,
                        stock_actual: campo === 'stock_actual' ? valorNum : 0
                    };
                    
                    
                    const result = await window._supabase.from('stock_por_tienda').insert([newData]);
                    error = result.error;
                    
                    if (error) {
                        console.error(`❌ Error INSERT:`, error);
                    } else {
                    }
                }
                
                if (error) {
                    console.error(`❌ Error al guardar ${campo}:`, error);
                } else {
                }
                    
            } else if (campo === 'precio') {
                const valorNum = Number(valor) || 0;
                prod.precio = valorNum;
                
                try {
                    const { error } = await window._supabase.from('productos')
                        .update({ precio: valorNum })
                        .eq('id', prod.id);
                    
                    if (error) {
                        console.error(`❌ Error al guardar precio:`, error);
                        window.ui.showNotify(`❌ Error al guardar precio: ${error.message}`, 'danger');
                    } else {
                        let pedidosActualizados = 0;

                        if (window.orderModel?.syncPendingOrderPricesForProduct) {
                            pedidosActualizados = await window.orderModel.syncPendingOrderPricesForProduct(prod.producto, valorNum);
                        }

                        const mensajePedidos = pedidosActualizados > 0
                            ? ` Se actualizaron ${pedidosActualizados} pedido(s) pendiente(s).`
                            : '';

                        window.ui.showNotify(`✅ Precio actualizado: €${valorNum}.${mensajePedidos}`, 'success');
                    }
                } catch (err) {
                    console.error('Error en actualización de precio:', err);
                    window.ui.showNotify(`❌ Error al guardar precio`, 'danger');
                }
            }
        } catch (err) {
            console.error('Error en updateProductoField:', err);
        }
    },

    async renameProducto(nombreOld, nombreNew, tiendaActual = null) {
        try {
            // Buscar el producto por nombre antiguo
            const prod = this.productosBase.find(p => p.producto === nombreOld);
            if (!prod) {
                throw new Error(`Producto "${nombreOld}" no encontrado`);
            }

            // Cambiar el nombre globalmente en la tabla de productos (para todas las tiendas)
            
            const { error } = await window._supabase
                .from('productos')
                .update({ producto: nombreNew })
                .eq('id', prod.id);

            if (error) {
                throw new Error(`Error al actualizar en Supabase: ${error.message}`);
            }

            // Actualizar en memoria
            prod.producto = nombreNew;

            return true;

        } catch (err) {
            console.error('Error en renameProducto:', err);
            throw err;
        }
    },

    async insertProducto(nombre, proveedor, precio, aplicarA = 'todas') {
        try {
            // Validar entrada
            if (!nombre || !proveedor) {
                throw new Error('Nombre y proveedor son requeridos');
            }

            // Insertar en tabla productos
            const { data, error } = await window._supabase
                .from('productos')
                .insert([{ 
                    producto: nombre,
                    proveedor: proveedor,
                    precio: parseFloat(precio) || 0
                }])
                .select();

            if (error) {
                console.error('Error al insertar producto:', error);
                throw error;
            }


            // Actualizar lista local
            if (data && data.length > 0) {
                const nuevoProducto = data[0];
                this.productosBase.push(nuevoProducto);

                // Actualizar lista de proveedores si es uno nuevo
                if (!this.proveedores.includes(proveedor)) {
                    this.proveedores.push(proveedor);
                    this.proveedores.sort();
                }


                // Si se aplica a todas las tiendas, crear registros de stock para cada una
                if (aplicarA === 'todas' && this.tiendas && this.tiendas.length > 0) {
                    
                    const stockRecords = this.tiendas.map(tienda => ({
                        producto_id: nuevoProducto.id,
                        tienda_id: tienda.id,
                        stock_maximo: 0,
                        stock_actual: 0
                    }));

                    const { error: stockError } = await window._supabase
                        .from('stock_por_tienda')
                        .insert(stockRecords);

                    if (stockError) {
                        console.error('Error al crear registros de stock:', stockError);
                        // No lanzar error aquí, el producto ya se creó
                    } else {
                        
                        // Actualizar el cache local
                        if (!this.stockPorTienda[nuevoProducto.id]) {
                            this.stockPorTienda[nuevoProducto.id] = {};
                        }
                        
                        stockRecords.forEach(record => {
                            const tienda = this.tiendas.find(t => t.id === record.tienda_id);
                            if (tienda) {
                                this.stockPorTienda[nuevoProducto.id][tienda.nombre_tienda] = {
                                    stock_maximo: 0,
                                    stock_actual: 0
                                };
                            }
                        });
                    }
                }
            }

            return true;
        } catch (err) {
            console.error('Error en insertProducto:', err);
            throw err;
        }
    },

    async deleteProducto(productoId) {
        try {
            if (!productoId) {
                throw new Error('ID de producto requerido');
            }

            // Encontrar el producto en el cache local
            const producto = this.productosBase.find(p => p.id === productoId);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }


            // Eliminar registros de stock_por_tienda
            const { error: stockError } = await window._supabase
                .from('stock_por_tienda')
                .delete()
                .eq('producto_id', productoId);

            if (stockError) {
                console.error('Error al eliminar registros de stock:', stockError);
                throw stockError;
            }


            // Eliminar el producto de la tabla productos
            const { error: prodError } = await window._supabase
                .from('productos')
                .delete()
                .eq('id', productoId);

            if (prodError) {
                console.error('Error al eliminar producto:', prodError);
                throw prodError;
            }


            // Actualizar el cache local
            this.productosBase = this.productosBase.filter(p => p.id !== productoId);
            
            // Limpiar stock del cache
            if (this.stockPorTienda[productoId]) {
                delete this.stockPorTienda[productoId];
            }

            // Actualizar lista de proveedores si no hay más productos de ese proveedor
            const proveedoresFiltrados = [...new Set(this.productosBase.map(p => p.proveedor).filter(v => v))].sort();
            this.proveedores = proveedoresFiltrados;

            return true;
        } catch (err) {
            console.error('Error en deleteProducto:', err);
            throw err;
        }
    },

    getProductosFiltrados(proveedorFiltro) {
        // Filtrar por proveedores activos
        let productosFiltrados = this.productosBase;
        
        if (window.providerModel && window.providerModel.proveedores.length > 0) {
            const proveedoresActivos = window.providerModel.getProveedoresPorNombre(true);
            productosFiltrados = productosFiltrados.filter(p => proveedoresActivos.includes(p.proveedor));
        }
        
        if (proveedorFiltro && proveedorFiltro !== 'todos') {
            return productosFiltrados.filter(p => p.proveedor === proveedorFiltro);
        }
        return productosFiltrados;
    },
    getProductos() { return this.productosBase; },
    
    getProveedores(soloActivos = true) { 
        if (soloActivos && window.providerModel && window.providerModel.proveedores.length > 0) {
            // Retornar solo proveedores activos desde la tabla proveedores
            return window.providerModel.getProveedoresPorNombre(true);
        }
        return this.proveedores; 
    },
    
    // Obtener el valor de stock para una tienda específica
    getStockActual(producto, tienda) {
        const prod = this.productosBase.find(p => p.producto === producto);
        if (!prod) {
            return 0;
        }
        
        const tiendaNorm = String(tienda).trim();
        
        if (this.stockPorTienda[prod.id] && this.stockPorTienda[prod.id][tiendaNorm]) {
            const valor = Math.max(0, this.stockPorTienda[prod.id][tiendaNorm].stock_actual || 0);
            return valor;
        }
        
        // Sin datos - retornar 0 silenciosamente
        return 0;
    },
    
    getStockMaximo(producto, tienda) {
        const prod = this.productosBase.find(p => p.producto === producto);
        if (!prod) {
            return 0;
        }
        
        const tiendaNorm = String(tienda).trim();
        
        if (this.stockPorTienda[prod.id] && this.stockPorTienda[prod.id][tiendaNorm]) {
            const valor = Math.max(0, this.stockPorTienda[prod.id][tiendaNorm].stock_maximo || 0);
            return valor;
        }
        
        // Sin datos - retornar 0 silenciosamente
        return 0;
    },

    // 🏭 Insertar nuevo proveedor
    async insertProveedor(nombre) {
        try {
            if (!nombre || nombre.trim() === '') {
                throw new Error('El nombre del proveedor es requerido');
            }

            // Validar que no exista un proveedor con el mismo nombre
            if (this.proveedores.includes(nombre.trim())) {
                throw new Error(`El proveedor "${nombre}" ya existe`);
            }

            // Verificar si existe tabla 'proveedores' o si usamos JSON en la tabla productos
            // Por ahora, agregamos directamente a la lista local y lo sincronizamos
            // Si existe tabla proveedores:
            const { data, error } = await window._supabase
                .from('proveedores')
                .insert([{ nombre: nombre.trim() }])
                .select();

            if (error) {
                // Si la tabla no existe, solo agregarlo a la lista de proveedores
                if (error.message.includes('does not exist') || error.message.includes('no existe')) {
                    this.proveedores.push(nombre.trim());
                    this.proveedores.sort();
                    localStorage.setItem('proveedores_custom', JSON.stringify(this.proveedores));
                    return { id: null, nombre: nombre.trim(), local: true };
                }
                throw error;
            }

            // Si se insertó exitosamente en BD
            if (data && data.length > 0) {
                this.proveedores.push(nombre.trim());
                this.proveedores.sort();
                return data[0];
            }

            return { nombre: nombre.trim(), id: null };
        } catch (err) {
            console.error('Error en insertProveedor:', err);
            throw err;
        }
    }
};


window.productModel = productModel;
