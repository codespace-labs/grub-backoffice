# grub backoffice

Backoffice inicial en Next.js para operaciones y calidad de datos.

## Variables de entorno

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xmdoaikmmhdzdzxovwzn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de Supabase>
```

## Objetivo de esta fase

- consumir la nueva capa admin (`api-admin-*`)
- reemplazar el dashboard HTML suelto
- preparar una extracción limpia a `repo-backoffice`
- autenticar operadores reales vía Supabase Auth
- listar usuarios del backoffice y administrar roles desde UI

## Convenciones UI

- no usar emojis como iconos en la interfaz
- para iconografia usar solo `lucide-react`, que es la libreria oficial del backoffice
- no mezclar otras librerias de iconos salvo que se acuerde explicitamente

## Roles

El backoffice usa el JWT del usuario autenticado y los roles viven en Supabase Auth:

- `app_metadata.role=admin`
- `app_metadata.role=operator`
- `app_metadata.role=viewer`

Las Edge Functions admin ya validan esos roles antes de responder.
