# Jitsi self-hosted de SabioDoc

**Instancia actual:** `https://jitsi.onkosdev.us`

SabioDoc usa esta instancia para las videoconsultas. Paciente y médico entran a
la misma sala desde el iframe del frontend; el backend genera la URL y, si la
instancia usa JWT, también los tokens por participante.

## Configuración del backend

En `apps/api/.env`:

```env
JITSI_BASE_URL=https://jitsi.onkosdev.us
JITSI_ROOM_PREFIX=SabioDoc
JITSI_JWT_APP_ID=sabiodoc
JITSI_JWT_AUDIENCE=jitsi
JITSI_JWT_SUBJECT=meet.jitsi
JITSI_MODERATOR_REQUIRED=true
JITSI_JWT_SECRET=<JWT_APP_SECRET del servidor>
```

- `JITSI_BASE_URL` debe incluir el esquema `https://` y no llevar slash final.
- `JITSI_JWT_APP_ID`, `JITSI_JWT_AUDIENCE` y `JITSI_JWT_SUBJECT` deben coincidir
  exactamente con `JWT_APP_ID`, `JWT_ACCEPTED_AUDIENCES` y `JWT_SUBJECT` del
  servidor Jitsi.
- `JITSI_JWT_SECRET` debe ser el mismo `JWT_APP_SECRET` configurado en Jitsi.
- `JITSI_MODERATOR_REQUIRED=true` hace que únicamente el token del médico lleve
  `context.user.moderator=true`.

Reinicia el backend después de cambiar el `.env`.

## Cabeceras del frontend

El dominio debe estar permitido en [`apps/web/public/_headers`](../apps/web/public/_headers):

- `script-src`: carga de `external_api.js`.
- `frame-src`: iframe de la sala.
- `Permissions-Policy`: cámara, micrófono y captura de pantalla.

El valor actual ya incluye `https://jitsi.onkosdev.us`.

## Token esperado

El backend genera este payload y lo firma con `JITSI_JWT_SECRET`:

```json
{
  "aud": "jitsi",
  "iss": "sabiodoc",
  "sub": "meet.jitsi",
  "room": "SabioDoc-...",
  "exp": 1993000000,
  "context": {
    "user": {
      "id": "35",
      "name": "Nombre del participante",
      "email": "correo@dominio.com",
      "moderator": true,
      "affiliation": "owner"
    }
  }
}
```

Solo el rol `doctor` recibe `moderator: true` y `affiliation: "owner"`.
El paciente recibe `moderator: false` y `affiliation: "member"`.

## Jitsi self-hosted

Para una sala abierta sin login, en el `.env` de `docker-jitsi-meet`:

```env
ENABLE_AUTH=0
ENABLE_GUESTS=1
ENABLE_LOBBY=0
PUBLIC_URL=https://jitsi.onkosdev.us
```

Aplicar y reiniciar los contenedores. Verifica que el dominio tenga TLS válido y
que abra desde dos navegadores distintos sin pedir moderador.

## Verificación

1. Paciente y médico entran a la misma URL de sala.
2. Ninguno ve “waiting for moderator”.
3. Ambos ven y oyen al otro.
4. El médico puede iniciar la consulta.
5. El cobro y el cronómetro se activan correctamente.

## Seguridad

Sin lobby ni autenticación, cualquiera que conozca la URL podría entrar. Por eso:

- la sala se genera con nombre aleatorio;
- la URL/token se entrega solo a los participantes;
- la sala expira al terminar la cita;
- se recomienda habilitar JWT + lobby cuando el flujo de autenticación de Jitsi
  esté validado en producción.
