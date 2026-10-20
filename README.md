# Puntito

Una app para llevar los puntos de la mesa: una persona anota, el resto mira el marcador desde su celular. Sin registro ni contraseñas.

**Aplicación:** [puntito-nine.vercel.app](https://puntito-nine.vercel.app) · [Proyecto Supabase](https://supabase.com/dashboard/project/tafjfzsqqiqmgjvztkck) · [Repositorio](https://github.com/andres-verdenelli/Puntito).

## Cómo se usa

1. Creá una partida y agregá entre 2 y 10 nombres. Podés acomodarlos antes de empezar: ese orden se usa para cargar los puntos, aunque después cambien las posiciones.
2. Compartí el enlace desde **Compartir partida**, por WhatsApp o con **Copiar enlace**. Quien lo recibe puede mirar, sin editar.
3. Tocá **Cargar puntos**. Para cada jugador, elegí **0, 5, 6, 7 u 8**. La app avanza sola; **Atrás** permite corregir el valor anterior.
4. Revisá el resumen y tocá **Guardar ronda**. Recién entonces se suman los puntos de todos. Un doble clic o reintento no los duplica.

La tabla va de mayor a menor; los empates conservan el orden inicial. Los espectadores consultan el marcador cada 3 segundos mientras la pestaña está visible y al volver a abrirla. Con mala conexión puede tardar más; la pantalla conserva el último marcador e informa el problema.

El permiso del anfitrión y la carga pendiente quedan en su navegador. Si borrás sus datos o cambiás de navegador/dispositivo, no recuperás el permiso de edición. El enlace compartido no lo contiene. Cualquiera con ese enlace puede ver los nombres y los puntos: usá nombres o apodos adecuados para compartir con el grupo.

## Instalar y usar en iPhone

La presentación está en `/`. **Abrir Puntito** lleva a `/app`, donde podés crear una partida o entrar con un enlace. Al abrir `/app` de nuevo se retoma la última partida y, si había una ronda pendiente, la carga continúa en el mismo jugador. Desde el marcador, la flecha de inicio abre el menú para crear otra mesa.

En Safari, usá **Compartir → Agregar a inicio** y, si aparece, mantené activado **Abrir como app**. El ícono abre `/app` en modo independiente. Instalá Puntito antes de crear la primera partida: Safari y la app instalada pueden usar almacenamiento separado, por lo que no se garantiza trasladar el permiso de anfitrión de una a la otra. No borres los datos de la app si querés conservar ese permiso.

La experiencia de juego ocupa el alto disponible y respeta las áreas del notch y del indicador de inicio. La tabla desaparece al cargar puntos: se muestra un jugador por vez, seguido del resumen y la confirmación de guardado. Si los diez jugadores no entran con un tamaño legible, el marcador y el resumen usan páginas con botones. La lista de preparación puede desplazarse dentro de su panel; la pantalla de juego no tiene scroll general. El navegador conserva el control de algunos gestos del sistema. La confirmación al recargar se muestra sólo cuando el navegador la admite; la recuperación depende del borrador guardado, no de esa confirmación.

La instalación no agrega juego sin conexión: crear y guardar requieren internet. El borrador queda en el dispositivo y el marcador abierto conserva la última lectura si se pierde la conexión. Esta versión no instala un service worker ni almacena respuestas privadas en caché.

Antes de publicar, aplicá la migración `202610200002_ten_players.sql` con el procedimiento de Supabase documentado abajo. Limita las partidas nuevas a diez sin eliminar las existentes. En desarrollo local y en las pruebas, las migraciones se aplican automáticamente en orden.

### Comprobación en un iPhone real

- Instalar desde Safari y abrir desde el ícono: entra a la app sin las barras de Safari.
- Crear una partida de diez jugadores, cargar una ronda y confirmar que la tabla sólo aparece antes y después de cargar.
- Cerrar y volver a abrir a mitad de la carga: se conserva el jugador y los puntos ya elegidos.
- Comprobar marcador, resumen, botones, notch e indicador de inicio con texto normal y ampliado; usar la paginación cuando haga falta.
- Comprobar pérdida y recuperación de conexión, y que compartir sólo dé permiso de lectura.

## Desarrollo con pnpm

Requisitos: Node.js 24 y pnpm 10.30.3 (versión fijada en `packageManager`).

```sh
pnpm install --frozen-lockfile
pnpm dev:local
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000). Este comando usa **Postgres local con PGlite**, ejecuta la misma migración y levanta un adaptador de RPC accesible solo en loopback. Los datos de prueba quedan en `output/local-db`, ignorado por Git. Sirve para probar el flujo sin credenciales y no se usa en producción.

Para probar desde un teléfono en la misma red sin recargas automáticas del modo de desarrollo, usá `pnpm preview:lan` en lugar de `pnpm dev:local`. Este comando compila y sirve la app con los datos locales. Si necesitás recarga automática mientras editás, usá `pnpm dev:lan`. La terminal muestra las direcciones IP disponibles en el puerto 3000. Sólo Next.js se expone a la red; el adaptador de la base queda en loopback. La interfaz y las partidas se pueden probar por HTTP; las funciones que exigen un contexto seguro, como compartir con el sistema o copiar automáticamente al portapapeles, pueden no estar disponibles. Para validar la instalación completa como PWA, usá el despliegue HTTPS.

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
2. Aplicá las migraciones con la CLI. Si usás SQL Editor, ejecutá una vez [la migración inicial](supabase/migrations/202610200001_initial.sql) y después [el límite de diez jugadores](supabase/migrations/202610200002_ten_players.sql), en ese orden.
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
