-- Ces fonctions ne doivent être invoquées que par leurs triggers, jamais directement via l'API REST/RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;
