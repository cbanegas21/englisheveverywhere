# Plan Maestro — EnglishKolab (brainstorm Carlos, 2026-06-22)

Documento de referencia del plan completo de cambios + features. Sale del brainstorm
de Carlos y de 9 agentes de análisis (landing, sala, persistencia, Moodle, libros,
conversación, biblioteca). Cada item trae su código de referencia para rastrearlo.

> **Filosofía:** la plataforma se pule hasta dejarla **perfecta**. Lo gentil se queda
> gentil (las tareas son invitación, no obligación). Nada de esto toca el camino del
> dinero (créditos/Stripe/payouts) salvo donde se diga explícito.

---

## 1. Decisiones ya tomadas (cerradas)

- **Libros:** se integran los libros reales (Interchange + Everybody Up). Carlos tiene la
  cobertura legal por escrito — decisión y riesgo suyos. Procedemos.
- **Tareas:** opcionales/repaso, filosofía gentil intacta + copy anti-IA
  ("si respondes con IA te engañas a ti mismo; no importa fallar, así tu maestro te ayuda").
- **Cursivas:** NO se quitan → **barrido de legibilidad** (más grandes / bold / mejor
  contraste), extendido al texto grisáceo de toda la página y la app.
- **Conversación:** es un **TRACK + MODO**, no un producto aparte. Mismo pack/precio.
- **Grabación de video:** NO ahora. Fase 2 con consentimiento explícito (ojo: menores en
  Everybody Up). Sí aporta (re-mirar la clase), pero después de los arreglos.

## 2. Decisiones pendientes (las que ocupo de Carlos)

- 🔴 **D1 — Libros, el "cómo":** (A) mostrar las **páginas reales** del libro en la sala con
  capa para llenar en vivo, vs (B) recrear **ejercicios interactivos propios** por unidad.
  *Recomendación: empezar por A.*
- 🔴 **D2 — Lista de beneficios del pricing:** confirmar qué se anuncia **hoy** vs **"pronto"**
  (ver §6, tabla candidata) para no prometer lo no construido.
- 🔴 **D3 — Pricing sin el quiz:** al quitar "Descubre tu plan ideal", los botones "Empieza"
  ¿van a **/registro** o a una `/descubre` re-enfocada en horario? ¿Retiramos `/descubre`?
- 🟢 **D4 — Botón logueado:** ¿"Conectado como Carlos" (guardar nombre) o genérico
  "Conectado · Ir a mi panel"?
- 🟢 **D5 — Everybody Up:** falta su scope/secuencia (como el Excel de Interchange) para
  modelar el currículo de niños.
- 🟢 **D6 — Copys (ES+EN):** Claude las redacta y Carlos corrige (recomendado), vs aprobar
  una por una.

---

## 3. FASE 0 — Arreglos rápidos (lanzable casi ya · horas c/u · riesgo bajo)

Todo en `src/components/landing/*` y `src/app/[lang]/sala/*`.

| Ref | Qué | Archivo |
|---|---|---|
| B1 / SALA-04 | Toast "No se compartió sonido" **persistente** hasta cerrar (quitar auto-dismiss de 9s para el aviso info) | RoomShell.tsx:374-378 |
| B2 / SALA-02 | Transcript/cuaderno **oculto por defecto** (init `false`) + apagar el motor cuando está cerrado (ahorra Deepgram) | RoomShell.tsx:197-199 |
| A13 / LAND-05 | Quitar el **puntito "AI slop"** de los títulos (`.ek-kicker::before`) | globals.css:204 |
| A7-A9 / LAND-08 | Copys "Cómo funciona": 01 "+te enseñamos a usar la plataforma"; paso pack "+según tu horario"; 04 "+por video y con la plataforma" | HowItWorks.tsx |
| A10 / LAND-09 | "Cada clase deja huella" → mencionar progreso + vocabulario + resumen IA | NotebookBanner.tsx:14 |
| A12 / LAND-10 | FAQ "¿Caducan?" → "No… **pero** te recomendamos seguir tu plan con constancia" | FAQ.tsx:60/:32 |
| A6 / LAND-07 | Carrusel de países: acelerar (60s→~30s) + verificar banderas (se ve "estático" por lentitud o reduce-motion) | TrustStrip.tsx:86 |

## 4. FASE 1 — Arreglos medianos (medio día–2 días)

| Ref | Qué | Esfuerzo | Nota |
|---|---|---|---|
| A1 / LAND-01 | "Ir al Dashboard" → "Empieza ya" + estado logueado (D4) | M | |
| A3+A14 / LAND-04 | **Legibilidad**: cursivas chiquitas más grandes/bold + subir contraste del texto gris (Pricing subs, captions, notas) + traducir los 3 strings en inglés sueltos | L | no quitar cursivas |
| A2 / LAND-02 | Navbar: estado al hacer scroll (sólido + sombra) para que no se transparente sobre las fotos | M | |
| A4 / LAND-03 | Hamburguesa en desktop: ajustar densidad/breakpoint (confirmar a qué ancho la ve) | S | |
| A11 / LAND-09 | Lista real de **beneficios de plataforma** + "tu constancia importa" en el pricing (D2) | M | no prometer lo no construido |
| A5 / LAND-06 | **Quitar** "Descubre tu plan ideal" + reenfocar título a **disponibilidad/horario** (D3) | M | toca routing |
| **B3 / SALA-01** | **Bug del transcript** (el grande): (a) desacoplar el motor del ancho ≥1024px → que corra en ambos lados; (b) activar cancelación de eco para que la voz del otro no se atribuya a uno | L | bug real, prioridad |
| B4 / SALA-03,04,05 | Estado "calentamiento / aún no se guarda nada" al entrar antes de la hora + **guardar el vocabulario IA** (hoy se genera y se tira) + (opcional) guardar transcript incremental | M | |

## 5. FASE 2 — Features grandes (semanas · roadmap · cada una shippable sola)

### 5.1 Conversación (track + modo) — INT-A/B/C, DR-1..5
- **Fase 1 (M):** `bookings.mode` ('general'/'conversación') + resumen IA enfocado en habla
  + panel de prompt por nivel + auto-default desde el intake (`self_rated_level`). Cero dinero.
- **Fase 2 (L):** currículo propio CEFR (decks de temas/role-play/debate Task-Based) en la
  sala + `students.track`. **Costo real = escribir el contenido.**
- **Fase 3 (XL, después):** práctica con IA de voz entre clases (tema asignado por el maestro →
  transcript al maestro). ~$0.50–1/alumno/mes. Tarea que alimenta la clase humana, no la reemplaza.
- Retención: escalera CEFR visible + feedback de fluidez por clase + temas personales.

### 5.2 Libros interactivos — BOOK-03/04, LIB-CUR-04 + scope Interchange
- Motor = el **"Scope & sequence"** de Carlos (cada libro = 16 unidades; unidad = X.1, X.2,
  video, practice; Exam cada ~4 unidades; el plan de horas define el ritmo).
- Modelo: tablas `book_units` (libro/nivel/unidad/sección) + "maestro habilita unidad X a
  alumno Y" + respuestas del alumno + gate de entitlement (hoy `getBookSignedUrl` solo checa
  `is_active` — falta por-alumno).
- En la sala: panel del libro **sincronizado en vivo** (LiveKit data channel, como la pizarra)
  donde ambos ven y el alumno llena. Depende de **D1** (páginas reales vs contenido propio).
- Pendiente: scope de **Everybody Up** (D5).

### 5.3 Sistema tipo Moodle (tareas/quizzes/práctica) — BLK-01..09, PLAN-SEQ
Hoy solo existe la tabla plana de tareas (migración 017). Todo lo demás es nuevo. ~2.5–3 semanas, 5 sub-fases:
- **P1 (L):** jerarquía curso→unidad→item + adjuntos (archivo/audio) + tracking de completado (sin obligatorias, gentil).
- **P2 (XL):** banco de preguntas + motor de quizzes con auto-calificación (opción múltiple, V/F, matching, cloze). Sirve para examen Y para práctica estilo Duolingo.
- **P3 (L):** repaso de vocabulario con repetición espaciada, sacado del vocab de la clase (extraído con IA).
- **P4 (L):** grabación de pronunciación (alumno se graba → storage → maestro revisa).
- **P5 (M):** mini-juegos (flashcards, match, fill-the-gap) + audios TTS para escuchar en el bus.
- Copy anti-IA en las tareas. Todo opcional (filosofía gentil).

### 5.4 Biblioteca / Carpeta / Materiales (aclarar las 3 cosas) — LIB-CUR-01..06
Hoy hay confusión: 3 superficies y ninguna es lo que se quiere.
- **Biblioteca del libro** (interactiva, §5.2) — hoy apagada (`LIBRARY_ENABLED=false`); el admin
  ya puede subir pero es invisible para alumnos.
- **"Tu carpeta"** (alumno sube su propio contenido) — **no existe**, hay que crearla (bucket nuevo + RLS por usuario).
- **Materiales del maestro** — hoy es puro placeholder estático.
- Aclaración: subir archivos hoy es **solo admin** (no maestros).

### 5.5 Diplomas de certificación CEFR — A11/C11
Al terminar cada nivel: "¡Felicidades, ya eres B2!". Depende de tener niveles + progreso (se
apoya en §5.1 escalera CEFR y §5.3 progreso). Esfuerzo M.

### 5.6 Grabación de video (diferida)
LiveKit Egress → storage → reproductor en el historial. Con consentimiento explícito + retención
limitada. Ojo menores (Everybody Up). Fase 2, decisión de Carlos.

---

## 6. Beneficios de plataforma — candidata para D2 (qué anunciar hoy)

| Beneficio | Estado real (código) | ¿Anunciar ya? (Carlos) |
|---|---|---|
| Pago con tarjeta en la app | ✅ live | |
| Resúmenes IA de cada clase | ✅ live | |
| Transcript de la clase | ⚠️ live (con el bug B3 por arreglar) | |
| Vocabulario IA personalizado | ⚠️ se genera pero NO se guarda (B4) | |
| Seguimiento de progreso | ✅ live | |
| Clases grabadas (re-mirar) | ❌ no existe (§5.6) | |
| Quizzes / práctica / juegos | ❌ por construir (§5.3) | |
| Biblioteca interactiva | ❌ apagada (§5.2) | |
| Diplomas CEFR | ❌ por construir (§5.5) | |
| Video que no caduca | ✅ live | |

---

## 7. Orden de construcción recomendado

1. **FASE 0** (arreglos rápidos landing + sala) — lanzable de inmediato.
2. **FASE 1** (legibilidad, pricing reframe, **bug del transcript B3**, persistencia B4).
3. **FASE 2.1 Conversación Fase 1** (modo + resumen enfocado) — barato, alto valor.
4. **FASE 2.2 Libros interactivos** (con el scope) — el gran diferenciador (depende D1).
5. **FASE 2.3 Moodle P1→P5** — el sistema de práctica/quizzes (la apuesta larga).
6. Resto: carpeta del alumno, diplomas, conversación Fase 2/3, grabación.

Cada fase lleva su QA exhaustivo (screenshots, sección por sección) al estándar de Carlos.

---

## 8. Spec detallado — Libro interactivo · "El Patio" · Moodle (clon)

### 8.1 Libro interactivo (Interchange/Everybody Up)
- **Todo bloqueado por default.** El **maestro desbloquea** unidad por unidad, clase por clase,
  siguiendo el scope. **En clase el maestro maneja el libro** (el alumno no interactúa); **después
  de clase el alumno ve, en SOLO LECTURA, lo desbloqueado** para repasar. No hay llenado de dos vías
  → build más simple.
- Tablas: `book_units` (libro/nivel/unidad/sección/asset) + `student_unit_access` (alumno, unidad,
  unlocked_at, por maestro) + gate de entitlement en el visor.
- **En clase (ideal):** el libro como **PIZARRA ANOTABLE** — la página del libro de fondo + capa de
  anotación que el maestro dibuja/marca, sincronizada en vivo al alumno (reusa Excalidraw + LiveKit data
  channel ya existentes). **Fallback:** compartir pantalla. El alumno lo **VE en vivo, no lo controla**.
- **Después de clase:** visor **read-only** de lo desbloqueado en el panel del alumno.
- Fuente de páginas = los PDFs de Carlos (extraer del `.exe`/zips cuando los consiga → `docs/_libros/`).

### 8.2 "The Lab" — surface gamificado del alumno (NO se llama "Tareas")
Nombre **"The Lab" / "El Lab"** (juego con english**Ko·LAB**). Ruta `/[lang]/dashboard/lab`.
Feed de tarjetas (mobile-first), no lista de pendientes:
- **Hero "Continuar"** (lo más valioso ahora) → **"De tu última clase"** (auto-generado) →
  **"Para repasar"** (SRS) → **"De parte de tu maestro/a"** (lo que asignó) → **"Juegos"** → **"Tu progreso"**.
- **Auto-generación:** en `completeSession` → **guardar el vocabulario** (hoy se tira) + 1 llamada
  haiku que arma listening + mini-quiz del transcript. La práctica "se siente como que la clase siguió".
- **SRS** = SM-2 lite, **gentil** (sin rachas punitivas; el intervalo solo se alarga).
- **Tipos de ítem** (React nativo, equivalentes a H5P, un solo renderer): flashcard, cloze (rellenar),
  opción múltiple, match, memory, drag-words, mark-words, listening ("escribe lo que oyes").
- **Pronunciación:** el alumno **graba su voz** → se guarda en storage (arregla el hueco de H5P que la
  pierde) → el maestro la revisa + opcional auto-score con Deepgram. **Sin IA conversacional.**
- **Gamificación:** XP + anillos de progreso + "palabras dominadas". **SIN rachas/ligas/leaderboards**
  (alinea con la marca gentil).

### 8.3 Autoría del maestro = clon fiel de Moodle
- **Banco de preguntas:** un modelo JSONB (una tabla, payload por tipo). **Fase 1** = opción múltiple
  (single/multi, % por opción + feedback), V/F, respuesta corta (wildcards/case), numérico, matching,
  ensayo (manual). **Fase 2** = cloze, drag&drop (texto/imagen/markers), select-missing-words, calculated.
- **Motor de quiz:** páginas + barajado, intentos + método de calificación (mayor/promedio/primero/último),
  **comportamientos** (deferred / immediate / interactive-con-intentos primero; CBM/adaptive después),
  **matriz de review-options** (qué ve el alumno durante/después/luego), feedback (por-respuesta / general /
  combinado / hints), feedback global por rango de nota.
- **Tareas (assignment):** texto online + archivos, **rúbrica / marking guide**, feedback (comentarios /
  inline / archivo / audio). **Override gentil/anti-IA** (suavizar lo punitivo, copy "si respondes con IA
  te engañas a ti mismo", todo opcional, sin "reprobaste").
- **Actividades a clonar YA:** ⭐ **Glosario** (banco de vocabulario), ⭐ **contenido interactivo tipo H5P**
  (subset, React nativo — NO runtime PHP), **recursos** (Book/Page/File/URL, reusa la biblioteca). Después:
  Lesson, Choice, Feedback. **Skip:** Wiki, Workshop, Survey (no aplican a 1:1).
- Reusar migración 017 (RLS-read + escritura service-role) como plantilla para todo lo nuevo.

### 8.4 Carpeta del maestro
- Stash privado del maestro (sube PDFs/material) + botón **"compartir con [alumno]"** por archivo
  (solo si quiere → aparece read-only en el panel de ese alumno). **El alumno nunca sube nada.**

### 8.5 Orden de construcción del bloque Moodle/Patio
- **P1 (núcleo Moodle):** shell de El Patio + banco de preguntas + motor de quiz (MCQ/VF/SA/Match/Essay)
  + assignment (texto/archivo) + carpeta del maestro.
- **P2 (personalización + práctica):** auto-generación desde la clase + SRS + 4 tipos interactivos +
  pronunciación + XP/progreso.
- **P3:** glosario, drag&drop, más juegos, Lesson.
