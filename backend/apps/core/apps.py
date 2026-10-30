from django.apps import AppConfig
from django.db import connections
from django.db.models.signals import post_migrate


def enable_row_level_security(sender, using, **kwargs):
    """Enable RLS on every table in the public schema after migrations.

    Supabase exposes the public schema through its REST API, so any table without RLS
    is readable and writable with the project's anon key. Django connects as the table
    owner (postgres), which bypasses RLS, so enabling it without policies only blocks
    the REST API.
    """
    connection = connections[using]
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT c.relname FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
            """
        )
        for (table,) in cursor.fetchall():
            cursor.execute(f"ALTER TABLE public.{connection.ops.quote_name(table)} ENABLE ROW LEVEL SECURITY")


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"

    def ready(self):
        # post_migrate is sent once per app after the whole migrate run; listen only for this app
        post_migrate.connect(enable_row_level_security, sender=self)
