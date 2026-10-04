# 📱 Guía de Instalación - Brasil Açaí SGP en Móviles

## ✅ La aplicación ahora es completamente descargable en dispositivos móviles

La app ha sido configurada como **PWA (Progressive Web App)**, lo que permite instalarla directamente en tu teléfono como una aplicación nativa.

---

## 📲 Cómo instalar en diferentes dispositivos

### 🤖 **Android (Chrome, Edge, Firefox)**

1. Abre la aplicación en tu navegador móvil
2. Tap en el botón **"📥 Descargar App"** en la pantalla de login
3. Selecciona **"Instalar"** en el popup
4. ¡Listo! La app aparecerá en tu pantalla de inicio

**Alternativa manual:**
- Abre el menú (⋮) → "Instalar aplicación" o "Agregar a pantalla de inicio"

---

### 🍎 **iOS (Safari)**

1. Abre la aplicación en **Safari** en tu dispositivo iOS
2. Tap en el botón **"Compartir"** (↗️)
3. Scroll y selecciona **"Agregar a pantalla de inicio"**
4. Dale un nombre (ej: "SGP Açaí")
5. Tap en **"Agregar"**
6. ¡Listo! La app estará en tu pantalla de inicio

**Nota:** iOS crea un acceso directo mejorado que funciona sin conexión.

---

### 💻 **Escritorio (Windows, Mac, Linux)**

#### Chrome/Edge:
1. Click en la URL bar
2. Click en el icono de instalación (si aparece)
3. Selecciona **"Instalar"**

#### Manual:
- Menu (⋮) → "Instalar aplicación Brasil Açaí SGP"

---

## 🌟 Características después de la instalación

✅ **Acceso sin conexión** - La app cachea automáticamente todos los datos  
✅ **Push Notifications** - Recibir alertas importantes  
✅ **Acceso rápido** - Icono en pantalla de inicio  
✅ **Experiencia nativa** - Se ve y funciona como una app nativa  
✅ **Actualizaciones automáticas** - Se sincroniza cuando hay conexión  

---

## 🔧 Funcionalidades técnicas implementadas

### Service Worker Mejorado
- Cache inteligente de recursos
- Soporte offline completo
- Sincronización en background

### Manifest.json Optimizado
- Iconos en múltiples tamaños (192x192, 512x512)
- Asociaciones deep-linking
- Shortcuts rápidos a secciones principales

### Meta Tags PWA
- Apple Mobile Web App
- Microsoft Tile Configuration
- Viewport optimizado para móviles
- Colores de tema consistentes

### Servidores Configurados
- **.htaccess** - Para servidores Apache
- **web.config** - Para servidores IIS
- **browserconfig.xml** - Para Windows
- Compresión GZIP habilitada
- Cache headers optimizados

---

## ⚠️ Requisitos para instalar

- **Navegador compatible:** Chrome, Edge, Firefox, Safari (versiones recientes)
- **Protocolo HTTPS** en producción (localhost funciona en desarrollo)
- **Conexión a internet** para sincronizar datos (funciona offline después)
- **Espacio disponible** mínimo 50MB

---

## 🐛 Troubleshooting

### "No veo el botón de descargar"
- Asegúrate de usar navegador compatible
- En iOS, usa Safari (otros navegadores no soportan PWA)
- Recarga la página (Ctrl+Shift+R o Cmd+Shift+R)

### "La app no se instala"
- Probablemente el navegador no soporta PWA
- En iOS, asegúrate de estar en Safari
- Intenta el método manual de agregar a pantalla de inicio

### "Datos no sincronizados offline"
- Esto es normal - solo funciona online con Supabase
- Los datos locales se guardan cuando hay conexión
- Al volver a conectarse, se sincroniza automáticamente

### "Errores después de instalar"
- Limpia el cache: Abre DevTools (F12) → Storage → Clear all
- Desinstala y reinstala la app
- Contacta con soporte técnico

---

## 📊 Monitoreo de la instalación

### Ver si está instalada correctamente:
```javascript
// En la consola (F12)
navigator.serviceWorker.getRegistrations()
  .then(registrations => console.log('Service Workers:', registrations))
```

### Checkear el cache:
```javascript
// En la consola (F12)
caches.keys().then(names => console.log('Caches activos:', names))
```

---

## 🚀 Actualizaciones futuras

Cuando actualicemos la app:
1. El Service Worker detectará la nueva versión
2. Se descargará automáticamente en background
3. La próxima vez que inicies la app, verás la versión actualizada

---

**¿Preguntas?** Contacta con el equipo técnico de Brasil Açaí  
**Última actualización:** Abril 2026
