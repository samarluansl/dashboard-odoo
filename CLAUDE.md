# Dashboard Odoo — Preferencias del usuario

## Flujo de git
- **No pedir confirmación** para commit, push ni merge — todas las acciones están pre-aprobadas.
- Al hacer cambios en un worktree, preguntar si quiere PR o merge directo a main (Vercel despliega desde main).
- "Subes a vercel?" = mergear a main y push.

## Stack
- Next.js + TypeScript, desplegado en Vercel
- Odoo vía XML-RPC (`src/lib/odoo.ts`)
- Worktrees en `.claude/worktrees/`

## Patrones conocidos
- Error "Unknown XML-RPC tag 'TITLE'" = Odoo devuelve HTML en lugar de XML-RPC (sobrecarga). Solución: reducir llamadas secuenciales.
- Treasury route optimizada: de N+1 llamadas a 2 (search_read único + cálculo acumulado en JS).
