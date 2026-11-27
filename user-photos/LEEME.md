# Fotografías de Regionle — paquete mundial acumulativo

## Contenido

Incluye las 249 fichas existentes, incluidas las cinco de la categoría Antártida: **1623 fotografías en total**, entre 3 y 8 por ficha, media **6.518**. Incluye 1880 archivos WebP, los JSON completos y el manifiesto de procedencia. Brasil y las fotos originales se conservan; `FICHAS.md` detalla los recuentos.

Este ZIP es autónomo y acumulativo: no hace falta instalar entregas anteriores. La versión de referencia es el commit `b00a3ee0bed0e13be0e3f5fa8e0706ff19b6ad75`.

## Procedencia y derechos

Cada foto contiene título de Wikimedia Commons, autor cuando consta, licencia, enlace de licencia cuando consta, y pie breve en español e inglés. `MANIFIESTO.json` ofrece la URL de Commons por fotografía y los metadatos disponibles. La fotografía de la mezquita Istiqlal incorporada en la entrega 07 se ha retirado porque Wikimedia Commons la había eliminado por cuestiones de libertad de panorama; no se ha modificado ninguna foto original. Las imágenes añadidas y sus licencias se han revisado; no es una certificación independiente de ubicación ni de derechos de terceros sobre edificios, personas u otros elementos. Antes de publicar, revisar en Commons las condiciones particulares y los requisitos de atribución y de fotografías de patrimonio.

Las fotos añadidas se sirven a 640 píxeles de ancho para reducir el tamaño. Las cabeceras originales y las fotos originales de Brasil conservan sus variantes. Las versiones antiguas de 1280 de fotos añadidas no se borran si estaban instaladas, pero dejan de referenciarse.

## Instalación para otra IA

Sobre una copia de seguridad del repositorio ejecutar `python aplicar.py /ruta/al/regionle`. El aplicador acepta los perfiles originales del commit indicado, los de las primeras tandas, los de la entrega 07 y los de este archivo; comprueba sus SHA-256 y las colisiones de imágenes antes de copiar. Ante diferencias se detiene sin copiar nada.

**Integración permanente:** los JSON de `public/data/profiles` sirven para la vista previa, pero el generador `npm run data:profiles` no conoce estas fotos añadidas y puede sobrescribir las fichas o eliminar archivos. Adaptar las fuentes y el aprovisionamiento de Commons, fijar estos recursos y probar el generador en una copia sin destruir otros datos. Verificar atribuciones, derechos, interfaz y pruebas antes de desplegar.
