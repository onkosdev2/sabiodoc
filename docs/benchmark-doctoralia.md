# Benchmark: Doctoralia Perú vs SabioDoc

Fecha: 2026-09-29 · Autor: equipo SabioDoc
Fuente: revisión del sitio público `www.doctoralia.pe` (home, listado
especialidad × ciudad, perfil de médico, agenda, Q&A, enfermedades,
tratamientos, clínicas, app, FAQ y planes Pro) más inspección del código de
SabioDoc.

> Alcance: solo se revisó el sitio público y se renderizó con un navegador real.
> No se completó una reserva con pago ni se accedió a paneles autenticados.

**Modelo de SabioDoc (importante):** la única forma de cobro es la
**videoconsulta facturada por minuto**. No se cobra por servicio, consulta
presencial, seguro ni por cita. Las funcionalidades de Doctoralia que asumen otro
modelo de cobro se listan como referencia, **no como pendientes**.

## 1. Modelo de negocio de Doctoralia

Marketplace de salud + SaaS para profesionales. Monetiza con planes mensuales
a médicos (en Perú, referencial: **S/199 Starter, S/249 Plus, S/299 VIP** al
mes facturado anual; existe perfil gratuito) y con visibilidad/posicionamiento.

Ecosistema:

- Directorio: especialidades × ciudad × modalidad online, clínicas, ~29 000
  profesionales.
- Reserva online con disponibilidad real en el listado y en el perfil.
- Contenido SEO: enfermedades, pruebas/tratamientos, "Pregunta al Experto"
  (Q&A), FAQ.
- App de pacientes: mapa, recordatorios push, mensajería.
- Panel Pro del médico: agenda, recordatorios (email/SMS/push), lista de espera,
  videoconsulta, episodios clínicos, informes, web profesional, campañas SMS.
- Confianza: perfiles verificados, opiniones "Cita verificada", moderación.

## 2. Comparativa

| Dimensión | Doctoralia | SabioDoc |
|---|---|---|
| Descubrimiento / SEO | Páginas indexables por especialidad+ciudad, JSON-LD `Physician`+`AggregateRating` | SPA con sitemap estático de 8 rutas; JSON-LD básico añadido |
| Búsqueda y filtros | Online, fechas disponibles, seguro, más filtros, mapa | Búsqueda por keywords + filtro de disponibilidad; sin mapa |
| Listado de médicos | Foto, rating, dirección, servicio+precio, grilla de horarios y CTA | Foto, rating, precio/min, próximos horarios y reserva directa |
| Perfil del médico | Bio, especialidades, enfermedades, edades, consultorios, servicios/precios, media, formación, idiomas, nº colegiado | Foto, bio, especialidades, reseñas, precio/min, **verificado + nº colegiatura + dirección**, JSON-LD |
| Reserva | Desde listado y perfil, con pago online | Slots, reprogramar, cancelar (sin pago real) |
| Videoconsulta | En planes Pro | Jitsi + facturación por minuto (modelo central) |
| Pagos | Pago online, tarjeta recurrente, reembolsos, política 12 h | Wallet de créditos demo + Stripe placeholder |
| Reseñas / confianza | "Cita verificada", moderación, filtros pos/neg, búsqueda, reportar | Reseñas de citas completadas; sin badges ni moderación |
| Seguros | "Ver si acepta mi aseguradora", filtro, disclaimers | No aplica (pago por minuto) |
| Clínicas / sedes | Perfiles de clínica con varios médicos | No aplica (100 % videoconsulta) |
| Contenido | Q&A público, enfermedades, tratamientos | Guía/triage IA ricos pero no indexables |
| App y recordatorios | App + push + email + SMS | PWA + notificaciones in-app; sin push/SMS |
| Panel del médico (SaaS) | Agenda, CRM, informes, SMS, lista de espera, web | Dashboard, agenda, pacientes, videos; sin CRM/informes/SMS |
| IA clínica | No tiene | Triage, guía y pre-consulta con ficha y resumen |
| Multi-país | 12 países | Perú/es |

## 3. Estándares a adoptar

1. **Listado orientado a conversión**: horarios, precio por minuto y CTA de
   reserva en la tarjeta. *(hecho)*
2. **Filtros**: disponibilidad, idioma, sexo, experiencia y precio.
   *(disponibilidad: hecho)*
3. **Mapa y "cerca de mí"** (aunque la consulta sea online, ayuda a filtrar por
   ciudad/cobertura horaria).
4. **SEO**: prerender/SSR de rutas públicas, JSON-LD, sitemap dinámico y
   páginas de enfermedades/síntomas/Q&A. *(JSON-LD básico: hecho)*
5. **Confianza**: badges de verificación, moderación de reseñas y documentos,
   exposición del número de colegiatura. *(verificación, colegiatura, reseñas verificadas y reportes: hecho)*
6. **Perfil rico**: subespecialidades, idiomas, certificaciones, media y
   enfermedades tratadas.
7. **Comunicación**: chat persistente paciente–médico, recordatorios
   email/push y lista de espera.
8. **Monetización**: compra de créditos, pagos reales y comprobantes.

### Lo que NO aplica a SabioDoc

- Precios por servicio o por consulta presencial.
- Seguros/coberturas y "ver si acepta mi aseguradora".
- Consultorios físicos, direcciones y perfiles de clínica.
- Reserva de visitas presenciales.
- Pago por cita programada (en SabioDoc se paga por minuto de videollamada).

## 4. Diferenciales de SabioDoc

- **Videoconsulta facturada por minuto**: simple, transparente y sin fricción.
- **IA clínica de punta a punta**: triage + guía + pre-consulta con ficha
  estructurada y resumen para el médico. Doctoralia no lo tiene.
- **Resumen IA de la videoconsulta** (planificado para el lanzamiento): al
  terminar la consulta, la IA resume conclusiones e indicaciones para el médico
  y el paciente.
- Enfoque *AI-first* para reducir el tiempo de consulta y mejorar la calidad.

## 5. Roadmap priorizado

**Ahora (1–2 semanas)**

1. Disponibilidad + precio por minuto en el listado. *(hecho)*
2. Reserva directa desde la tarjeta (preselección de horario). *(hecho)*
3. Filtro de disponibilidad. *(hecho)*
4. JSON-LD `Physician` + `AggregateRating`. *(hecho)*
5. Exponer nº de colegiatura y badge "verificado". *(hecho)*
6. Dirección del médico en registro y edición. *(hecho)*
7. Landing pública `/como-funciona` para pacientes y médicos. *(hecho)*

**1–2 meses**

6. Prerender/SSR de rutas públicas y sitemap dinámico.
7. Recordatorios por email/push y lista de espera.
8. Moderación de reseñas + filtros positivas/negativas. *(reportes y ocultamiento: hecho)*
9. Filtros avanzados (idioma, sexo, experiencia, rango de precio/min).

**3–6 meses**

10. Q&A público y fichas de enfermedades/síntomas.
11. Chat persistente paciente–médico.
12. Pagos reales de créditos + comprobantes electrónicos.
13. Informes de uso en el panel del médico.

**6–12 meses**

14. App móvil (o PWA avanzada).
15. Planes/visibilidad para médicos.
16. Expansión multi-país.

## 6. Riesgos

- El SEO de Doctoralia es una ventaja de años; conviene atacar nichos (IA,
  videoconsulta, ciudades secundarias) en lugar de tráfico general.
- No copiar visibilidad pagada sin transparencia: erosiona confianza.
- Cumplimiento normativo en Perú: Ley 29733 (datos personales), Ley 26842
  (salud) y Ley 30421 (telesalud).
