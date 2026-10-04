const orderModel = {
    reportes: [],

    extractResponsableFromObservaciones(observaciones) {
        const texto = String(observaciones || '');
        const match = texto.match(/Responsable:\s*([^,\n|]+)/);
        return match ? String(match[1] || '').trim() : '';
    },

    extractProveedorFromObservaciones(observaciones) {
        const texto = String(observaciones || '');
        const match = texto.match(/Proveedor:\s*([^,\n|]+)/i);
        return match ? String(match[1] || '').trim() : '';
    },

    getDateKey(value = new Date()) {
        if (!value) return '';

        if (value instanceof Date) {
            return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
        }

        const raw = String(value).trim();
        if (!raw) return '';
        if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);

        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw.substring(0, 10);

        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    },

    createLocalTimestamp() {
        const now = new Date();
        const dateKey = this.getDateKey(now);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${dateKey}T${hours}:${minutes}:${seconds}`;
    },

    getOrderDateKey(pedido) {
        if (!pedido) return '';

        // La fecha funcional del pedido es la fecha local guardada en `fecha`.
        // `created_at` queda como respaldo para registros antiguos.
        return this.getDateKey(pedido.fecha || pedido.created_at);
    },

    async ensureActiveSession() {
        const { data, error } = await window._supabase.auth.getSession();

        if (error) {
            throw new Error(`❌ Error verificando sesión: ${error.message}`);
        }

        if (!data?.session?.user) {
            if (window.authModel?.clearSession) {
                window.authModel.clearSession();
            }
            throw new Error('❌ SESIÓN EXPIRADA: Inicia sesión de nuevo antes de generar pedidos.');
        }

        return data.session;
    },

    parseNumericValue(value) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }

        if (value === null || value === undefined) {
            return 0;
        }

        const raw = String(value).trim();
        if (!raw) {
            return 0;
        }

        const sanitized = raw.replace(/[^\d,.-]/g, '');
        const lastComma = sanitized.lastIndexOf(',');
        const lastDot = sanitized.lastIndexOf('.');

        let normalized = sanitized;
        if (lastComma > lastDot) {
            normalized = sanitized.replace(/\./g, '').replace(',', '.');
        } else if (lastDot > lastComma) {
            normalized = sanitized.replace(/,/g, '');
        } else {
            normalized = sanitized.replace(',', '.');
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    normalizeOrderDetail(detalle) {
        let parsedDetail = detalle;

        if (typeof parsedDetail === 'string') {
            try {
                parsedDetail = JSON.parse(parsedDetail);
            } catch (error) {
                console.warn('⚠️ No se pudo parsear detalle del pedido en orderModel:', error);
                return [];
            }
        }

        if (!Array.isArray(parsedDetail)) {
            return [];
        }

        return parsedDetail.map(item => ({
            ...item,
            cantidad_pedida: this.parseNumericValue(item?.cantidad_pedida),
            precio_referencia: this.parseNumericValue(item?.precio_referencia),
            stock_actual: this.parseNumericValue(item?.stock_actual),
            stock_registrado: this.parseNumericValue(item?.stock_registrado)
        }));
    },

    normalizeOrder(pedido) {
        return {
            ...pedido,
            detalle: this.normalizeOrderDetail(pedido?.detalle)
        };
    },

    async syncProductAcrossPendingOrders({ pedidoIdOrigen, producto, tienda, proveedor, dateValue }) {
        try {
            await this.ensureActiveSession();

            const productoNorm = String(producto || '').trim();
            const tiendaNorm = String(tienda || '').trim();
            const proveedorNorm = String(proveedor || '').trim().toLowerCase();
            const targetDateKey = this.getDateKey(dateValue || new Date());

            if (!productoNorm || !tiendaNorm || !proveedorNorm) {
                return { actualizados: 0 };
            }

            const { data: pedidos, error } = await window._supabase
                .from('pedidos')
                .select('*')
                .eq('estado', 'pendiente');

            if (error) {
                throw error;
            }

            const pedidosNormalizados = (pedidos || []).map(pedido => this.normalizeOrder(pedido));
            let actualizados = 0;

            for (const pedido of pedidosNormalizados) {
                if (String(pedido.id) === String(pedidoIdOrigen)) {
                    continue;
                }

                const pedidoDateKey = this.getOrderDateKey(pedido);
                if (pedidoDateKey !== targetDateKey) {
                    continue;
                }

                if (String(pedido.tienda || '').trim() !== tiendaNorm) {
                    continue;
                }

                const proveedorPedido = pedido.proveedor
                    ? String(pedido.proveedor).trim().toLowerCase()
                    : this.extractProveedorFromObservaciones(pedido.observaciones).toLowerCase();

                if (proveedorPedido !== proveedorNorm) {
                    continue;
                }

                const detalleOriginal = Array.isArray(pedido.detalle) ? pedido.detalle : [];
                const detalleActualizado = detalleOriginal.filter(item => String(item.producto || '').trim() !== productoNorm);

                if (detalleActualizado.length === detalleOriginal.length) {
                    continue;
                }

                const payload = {
                    detalle: detalleActualizado
                };

                if (detalleActualizado.length === 0) {
                    payload.estado = 'completado';
                }

                const { error: updateError } = await window._supabase
                    .from('pedidos')
                    .update(payload)
                    .eq('id', pedido.id);

                if (updateError) {
                    throw updateError;
                }

                const pedidoLocal = this.reportes.find(item => String(item.id) === String(pedido.id));
                if (pedidoLocal) {
                    pedidoLocal.detalle = this.normalizeOrderDetail(detalleActualizado);
                    if (detalleActualizado.length === 0) {
                        pedidoLocal.estado = 'completado';
                    }
                }

                actualizados++;
            }

            return { actualizados };
        } catch (e) {
            console.error('Error en syncProductAcrossPendingOrders:', e);
            throw e;
        }
    },

    async insertOrders(orderItems) {
        try {
            await this.ensureActiveSession();

            // Enviar a Supabase
            const { data, error } = await window._supabase.from('pedidos').insert(orderItems).select();
            
            if (error) {
                
                // Errores específicos
                if (error.code === '42501') {
                    throw new Error('🚫 RLS BLOQUEADO: La tabla "pedidos" está protegida por Row Level Security y tu usuario no tiene permisos para insertar. Contacta al administrador de Supabase para revisar la configuración RLS.');
                }
                if (error.code === '23503') {
                    throw new Error('❌ FOREIGN KEY ERROR: Uno de los IDs referenciados no existe. Verifica que todos los IDs de tienda, producto, etc. sean válidos.');
                }
                if (error.code === '23505') {
                    throw new Error('❌ DUPLICADO: Ya existe un pedido con uno de los IDs proporcionados.');
                }
                if (error.message && error.message.includes('column')) {
                    throw new Error(`❌ ERROR DE COLUMNA: ${error.message}`);
                }
                
                throw new Error(`❌ Error SQL (${error.code}): ${error.message}`);
            }

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('❌ INSERT SIN RESULTADO: Supabase no devolvió registros al crear el pedido.');
            }
            
            return true;
        } catch (e) {
            console.error('Error en insertOrders:', e);
            throw e;
        }
    },

    async fetchReportes(forceRefresh = false) {
        try {
            const { data: pedidos, error } = await window._supabase
                .from('pedidos')
                .select('*')
                .order('fecha', { ascending: false });
            
            if (error) {
                console.error('❌ Error al cargar pedidos:', error);
                throw error;
            }
            
            // 🔄 Enriquecer datos antiguos: agregarles campo 'proveedor' si no lo tienen
            this.reportes = (pedidos || []).map(pedido => {
                if (!pedido.proveedor && pedido.observaciones) {
                    // Extraer proveedor de observaciones si falta el campo
                    const match = String(pedido.observaciones).match(/Proveedor:\s*([^|,\n]+)/);
                    if (match) {
                        pedido.proveedor = match[1].trim();
                    }
                }

                return this.normalizeOrder(pedido);
            });
            
            return this.reportes;
        } catch (e) {
            console.error('Error en fetchReportes:', e);
            throw e;
        }
    },

    async setOrderStatus(orderId, newStatus) {
        try {
            const { error } = await window._supabase
                .from('pedidos')
                .update({ estado: newStatus })
                .eq('id', orderId);
            
            if (error) {
                console.error('Error actualizando estado:', error);
                throw error;
            }
            return true;
        } catch (e) {
            console.error("Error en setOrderStatus:", e);
            throw e;
        }
    },

    async deleteOrder(orderId) {
        try {
            const { error } = await window._supabase
                .from('pedidos')
                .delete()
                .eq('id', orderId);
            
            if (error) {
                console.error('Error eliminando orden:', error);
                throw error;
            }
            return true;
        } catch (e) {
            console.error("Error en deleteOrder:", e);
            throw e;
        }
    },

    // 🔍 Busca un pedido pendiente existente para proveedor, tienda, día y responsable
    findPendingOrderByProviderAndStore(proveedor, tienda, dateKey = this.getDateKey(), responsable = '') {
        // Normalizar entrada
        const tiendaNorm = String(tienda).trim();
        const proveedorNorm = String(proveedor).trim();
        const targetDateKey = this.getDateKey(dateKey);
        const responsableNorm = String(responsable || '').trim().toLowerCase();
        
        console.log(`🔍 Buscando pedido: proveedor="${proveedorNorm}", tienda="${tiendaNorm}", fecha="${targetDateKey}", responsable="${responsable}", total pedidos=${this.reportes.length}`);
        
        const resultado = this.reportes.find(pedido => {
            // Verificar tienda y estado
            if (pedido.estado !== 'pendiente') {
                console.log(`  ❌ Pedido ${pedido.id}: estado="${pedido.estado}" (no pendiente)`);
                return false;
            }
            if (String(pedido.tienda).trim() !== tiendaNorm) {
                console.log(`  ❌ Pedido ${pedido.id}: tienda="${pedido.tienda}" ≠ "${tiendaNorm}"`);
                return false;
            }

            const pedidoDateKey = this.getOrderDateKey(pedido);
            if (pedidoDateKey !== targetDateKey) {
                console.log(`  ❌ Pedido ${pedido.id}: fecha="${pedidoDateKey}" ≠ "${targetDateKey}"`);
                return false;
            }

            // Verificar responsable para permitir multiples listas por persona
            if (responsableNorm) {
                const responsablePedido = this.extractResponsableFromObservaciones(pedido.observaciones).toLowerCase();
                if (!responsablePedido || responsablePedido !== responsableNorm) {
                    console.log(`  ❌ Pedido ${pedido.id}: responsable="${responsablePedido || '-'}" ≠ "${responsableNorm}"`);
                    return false;
                }
            }
            
            // Método 1: Buscar por campo 'proveedor' si existe (nuevo sistema)
            if (pedido.proveedor) {
                const match = String(pedido.proveedor).trim() === proveedorNorm;
                console.log(`  ${match ? '✅' : '❌'} Pedido ${pedido.id}: proveedor="${pedido.proveedor}" ${match ? '===' : '≠'} "${proveedorNorm}"`);
                return match;
            }
            
            // Método 2: Fallback a buscar en observaciones (compatibilidad)
            if (pedido.observaciones) {
                const obs = String(pedido.observaciones);
                const match = obs.includes(`Proveedor: ${proveedorNorm}`) || 
                              obs.includes(`Proveedor:${proveedorNorm}`) ||
                              obs.includes(`proveedor: ${proveedorNorm.toLowerCase()}`);
                console.log(`  ${match ? '✅' : '❌'} Pedido ${pedido.id}: búsqueda en observaciones: ${match ? 'encontrado' : 'no encontrado'}`);
                return match;
            }
            
            console.log(`  ❌ Pedido ${pedido.id}: sin proveedor ni observaciones`);
            return false;
        });
        
        if (resultado) {
            console.log(`✅ ENCONTRADO pedido ${resultado.id} para ${proveedorNorm} en ${tiendaNorm} el ${targetDateKey}`);
        } else {
            console.log(`❌ NO ENCONTRADO pedido para ${proveedorNorm} en ${tiendaNorm} el ${targetDateKey}`);
        }
        
        return resultado;
    },

    // 📝 Actualiza detalles de un pedido existente
    async updateOrderDetails(orderId, nuevoDetalle) {
        try {
            await this.ensureActiveSession();

            const { error } = await window._supabase
                .from('pedidos')
                .update({ detalle: nuevoDetalle })
                .eq('id', orderId);
            
            if (error) {
                console.error('Error actualizando detalles:', error);
                throw error;
            }
            
            // Actualizar en memoria
            const pedidoLocal = this.reportes.find(p => p.id === orderId);
            if (pedidoLocal) {
                pedidoLocal.detalle = this.normalizeOrderDetail(nuevoDetalle);
            }
            
            return true;
        } catch (e) {
            console.error("Error en updateOrderDetails:", e);
            throw e;
        }
    },

    async syncPendingOrderPricesForProduct(producto, nuevoPrecio) {
        try {
            await this.ensureActiveSession();

            const productoNormalizado = String(producto || '').trim();
            const precioNormalizado = this.parseNumericValue(nuevoPrecio);

            if (!productoNormalizado) {
                return 0;
            }

            const { data: pedidos, error } = await window._supabase
                .from('pedidos')
                .select('*')
                .eq('estado', 'pendiente');

            if (error) {
                throw error;
            }

            const pedidosNormalizados = (pedidos || []).map(pedido => this.normalizeOrder(pedido));
            let actualizados = 0;

            for (const pedido of pedidosNormalizados) {
                let huboCambio = false;
                const detalleActualizado = pedido.detalle.map(item => {
                    if (String(item.producto || '').trim() !== productoNormalizado) {
                        return item;
                    }

                    if (this.parseNumericValue(item.precio_referencia) === precioNormalizado) {
                        return item;
                    }

                    huboCambio = true;
                    return {
                        ...item,
                        precio_referencia: precioNormalizado
                    };
                });

                if (!huboCambio) {
                    continue;
                }

                const { error: updateError } = await window._supabase
                    .from('pedidos')
                    .update({ detalle: detalleActualizado })
                    .eq('id', pedido.id);

                if (updateError) {
                    throw updateError;
                }

                const pedidoLocal = this.reportes.find(item => item.id === pedido.id);
                if (pedidoLocal) {
                    pedidoLocal.detalle = this.normalizeOrderDetail(detalleActualizado);
                }

                actualizados++;
            }

            return actualizados;
        } catch (e) {
            console.error('Error en syncPendingOrderPricesForProduct:', e);
            throw e;
        }
    },

    // 🔀 Fusiona productos o crea nuevo pedido
    async mergeOrCreateOrder(tienda, proveedor, nuevoDetalle, responsable) {
        try {
            await this.ensureActiveSession();

            // Validar tienda NO esté vacía
            if (!tienda || String(tienda).trim() === '' || tienda.toLowerCase() === 'todas') {
                throw new Error(`❌ Tienda inválida: [${tienda}]. Debe ser una tienda específica.`);
            }
            
            // Validar detalle es array
            if (!Array.isArray(nuevoDetalle) || nuevoDetalle.length === 0) {
                throw new Error(`❌ Detalle inválido: debe ser un array no vacío`);
            }
            
            // Validar cada item del detalle
            nuevoDetalle.forEach((item, idx) => {
                if (!item.producto) throw new Error(`❌ Detalle[${idx}]: falta campo 'producto'`);
                if (typeof item.cantidad_pedida !== 'number' || item.cantidad_pedida <= 0) {
                    throw new Error(`❌ Detalle[${idx}]: cantidad_pedida debe ser > 0`);
                }
            });
            
            const fechaPedido = this.createLocalTimestamp();
            const orderDateKey = this.getDateKey(fechaPedido);

            console.log(`\n📋 mergeOrCreateOrder: Buscando pedido pendiente para ${proveedor} en ${tienda} el ${orderDateKey} para responsable ${responsable}`);
            
                // 1️⃣ Buscar si existe pedido pendiente para este proveedor + tienda + día + responsable
                const pedidoExistente = this.findPendingOrderByProviderAndStore(proveedor, tienda, orderDateKey, responsable);
            
            if (pedidoExistente) {
                console.log(`✅ FUSIONANDO: Encontrado pedido ${pedidoExistente.id}`);
                // Fusionar: mantener existentes, actualizar cantidades
                const detalleActualizado = [...pedidoExistente.detalle];
                
                console.log(`   Detalle actual: ${detalleActualizado.map(d => `${d.producto}(${d.cantidad_pedida})`).join(', ')}`);
                console.log(`   Detalle nuevo:  ${nuevoDetalle.map(d => `${d.producto}(${d.cantidad_pedida})`).join(', ')}`);
                
                nuevoDetalle.forEach(nuevoItem => {
                    const itemExistente = detalleActualizado.find(d => d.producto === nuevoItem.producto);
                    
                    if (itemExistente) {
                        console.log(`   📝 Actualizar ${nuevoItem.producto}: ${itemExistente.cantidad_pedida} → ${nuevoItem.cantidad_pedida}`);
                        itemExistente.cantidad_pedida = nuevoItem.cantidad_pedida;
                        itemExistente.precio_referencia = this.parseNumericValue(nuevoItem.precio_referencia);
                        itemExistente.stock_actual = nuevoItem.stock_actual;
                    } else {
                        console.log(`   ➕ Agregar ${nuevoItem.producto}: ${nuevoItem.cantidad_pedida}`);
                        detalleActualizado.push(nuevoItem);
                    }
                });
                
                // 👤 Actualizar responsable en observaciones
                let observacionesActualizadas = pedidoExistente.observaciones || '';
                if (observacionesActualizadas.includes('Responsable:')) {
                    observacionesActualizadas = observacionesActualizadas.replace(/Responsable:\s*([^,\n|]+)/, `Responsable: ${responsable}`);
                } else {
                    observacionesActualizadas = `Responsable: ${responsable} | ${observacionesActualizadas}`;
                }
                
                // Actualizar en BD (detalle + observaciones)
                await window._supabase
                    .from('pedidos')
                    .update({ 
                        detalle: detalleActualizado,
                        observaciones: observacionesActualizadas
                    })
                    .eq('id', pedidoExistente.id);
                console.log(`   ✅ Guardado en BD`);
                return { tipo: 'actualizado', id: pedidoExistente.id };
            } else {
                console.log(`✨ CREANDO: Nuevo pedido para ${proveedor}`);
                const tiendaNormalizada = String(tienda).trim();
                const proveedorNormalizado = String(proveedor).trim();
                const responsableNormalizado = String(responsable).trim();
                
                console.log(`   Detalle: ${nuevoDetalle.map(d => `${d.producto}(${d.cantidad_pedida})`).join(', ')}`);
                
                const nuevoPedido = {
                    id: Date.now(),
                    fecha: fechaPedido,
                    tienda: tiendaNormalizada,
                    proveedor: proveedorNormalizado,  // ✨ Nuevo campo explícito
                    detalle: nuevoDetalle,
                    observaciones: `Pedido automático por stock faltante | Proveedor: ${proveedorNormalizado} | Responsable: ${responsableNormalizado}`,
                    estado: 'pendiente'
                };
                
                console.log(`   ID: ${nuevoPedido.id}, Estado: ${nuevoPedido.estado}`);
                await this.insertOrders([nuevoPedido]);
                console.log(`   ✅ Guardado en BD`);
                return { tipo: 'creado', id: nuevoPedido.id };
            }
        } catch (e) {
            console.error("❌ Error en mergeOrCreateOrder:", e);
            throw e;
        }
    }
};

window.orderModel = orderModel;
