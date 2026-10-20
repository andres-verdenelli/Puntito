# Puntito

Una app para llevar los puntos de la mesa: una persona anota, el resto mira el marcador desde su celular. Sin registro ni contraseñas.

**Aplicación:** [puntito-nine.vercel.app](https://puntito-nine.vercel.app) · [Proyecto Supabase](https://supabase.com/dashboard/project/tafjfzsqqiqmgjvztkck) · [Repositorio](https://github.com/andres-verdenelli/Puntito).

## Cómo se usa

1. Creá una partida y agregá entre 2 y 20 nombres. Podés acomodarlos antes de empezar: ese orden se usa para cargar los puntos, aunque después cambien las posiciones.
2. Compartí el enlace desde **Compartir partida**, por WhatsApp o con **Copiar enlace**. Quien lo recibe puede mirar, sin editar.
3. Tocá **Cargar puntos**. Para cada jugador, elegí **0, 5, 6, 7 u 8**. La app avanza sola; **Atrás** permite corregir el valor anterior.
4. Revisá el resumen y tocá **Guardar ronda**. Recién entonces se suman los puntos de todos. Un doble clic o reintento no los duplica.

La tabla va de mayor a menor; los empates conservan el orden inicial. Los espectadores consultan el marcador cada 3 segundos mientras la pestaña está visible y al volver a abrirla. Con mala conexión puede tardar más; la pantalla conserva el último marcador e informa el problema.

El permiso del anfitrión y la carga pendiente quedan en su navegador. Si borrás sus datos o cambiás de navegador/dispositivo, no recuperás el permiso de edición. El enlace compartido no lo contiene. Cualquiera con ese enlace puede ver los nombres y los puntos: usá nombres o apodos adecuados para compartir con el grupo.

## Desarrollo con pnpm

Requisitos: Node.js 24 y pnpm 10.30.3 (versión fijada en `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000). Este comando usa **Postgres local con PGlite**, ejecuta la misma migración y levanta un adaptador de RPC accesible solo en loopback. Los datos de prueba quedan en `output/local-db`, ignorado por Git. Sirve para probar el flujo sin credenciales, no se usa en producción ni ofrece una dirección accesible para tus amigos.

Para desarrollar contra un proyecto Supabase, copiá `.env.example` a `.env.local`, completá las dos variables y ejecutá `pnpm dev`.

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

Las pruebas ejecutan SQL real en PGlite: creación, rondas atómicas, idempotencia, permisos, acumulación y rechazo de datos inválidos. También verifican el orden de posiciones, validación de nombres y recuperación del borrador.

## Supabase Free

El proyecto remoto **Puntito** usa la región `sa-east-1` (São Paulo). Las funciones de Vercel usan `gru1`, fijado en `vercel.json`. No hace falta activar Auth ni Realtime.

Las CLI de Supabase y Vercel están en `devDependencies`, con versiones exactas. Para autenticarte desde este repositorio:

```sh
pnpm exec supabase login
pnpm exec vercel login
```

Para vincular la base existente y aplicar futuras migraciones:

```sh
pnpm exec supabase link --project-ref tafjfzsqqiqmgjvztkck
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

La configuración del proyecto queda en `supabase/config.toml`; el vínculo local y las credenciales no se versionan. Si el comando solicita la contraseña de la base, usá la guardada localmente durante la configuración. La app desplegada solo necesita las dos variables siguientes.

Para configurar otra instancia desde cero:

1. Creá un proyecto **Free** en [Supabase](https://supabase.com/dashboard). Elegí una región cercana a tu despliegue de Vercel.
2. Aplicá [la migración inicial](supabase/migrations/202610200001_initial.sql) con la CLI, o ejecutala una sola vez desde SQL Editor si no vas a administrar migraciones con la CLI.
3. Desde el proyecto obtené la URL y una clave **secret** para el servidor. Una clave legacy `service_role` también funciona. No uses la clave publicable/`anon` para esta app.
4. Configurá:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=tu-clave-secreta
```

No agregues `NEXT_PUBLIC_` a estas variables ni las subas a GitHub. Todas las consultas pasan por el servidor de Next.js. Las tablas tienen RLS y no admiten acceso con roles `anon`/`authenticated`; las RPC solo se conceden a `service_role`. La base almacena un hash SHA-256 del permiso de anfitrión y nunca lo devuelve al cliente.

## Publicación en Vercel Hobby

1. Subí el proyecto a un repositorio público de tu cuenta personal de GitHub.
2. Desde una cuenta **Hobby** de [Vercel](https://vercel.com/new), importá ese repositorio. Se detectan Next.js y pnpm desde el proyecto y el lockfile.
3. Cargá `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en las variables del servidor para los entornos donde vayas a probar. Usá `pnpm build` como comando de compilación si el panel lo solicita.
4. Desplegá y usá la dirección `*.vercel.app` incluida. No hace falta comprar un dominio. Los cambios en la rama principal generan nuevos despliegues.
5. Comprobá una partida con un navegador anfitrión y otro incógnito: el primero anota; el segundo solo mira. Revisá que una ronda guardada aparezca sin recargar y que el enlace compartido abra el marcador.

Para publicar desde la terminal en el proyecto ya vinculado, usá `pnpm exec vercel --prod`. El repositorio también está conectado a Vercel para desplegar los cambios de `main`. Las variables `SUPABASE_URL` y `SUPABASE_SECRET_KEY` están configuradas para producción y previews; la clave se guarda como Secret. `.vercelignore` excluye credenciales, artefactos y datos de prueba de las subidas por CLI.

La creación y el guardado requieren peticiones JSON desde el mismo origen. Cada ronda usa un identificador único y la versión del marcador: la base bloquea la partida durante la transacción, evita duplicados y rechaza cargas de otra pestaña basadas en una ronda vieja.

## Coste y alcance

El objetivo es **$0**, usando GitHub Free, Vercel Hobby y Supabase Free, sin extras pagos ni dominio propio. Esto está sujeto a sus cuotas y condiciones: [Vercel Hobby](https://vercel.com/docs/plans/hobby) es para uso personal no comercial y puede suspender funciones al agotar cuotas; [Supabase Free](https://supabase.com/pricing) puede pausar proyectos después de una semana sin actividad. No hay garantía de disponibilidad ilimitada.

La primera versión incluye el marcador y la carga de rondas. No incluye cuentas, recuperación de permisos, historial visible, edición de rondas ya guardadas ni sincronización de borradores entre pestañas. El anfitrión debe cargar una ronda desde una pestaña a la vez.
