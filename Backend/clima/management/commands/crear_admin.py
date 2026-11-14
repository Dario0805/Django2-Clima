"""Crea un superusuario demo con credenciales fijas (solo desarrollo)."""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Crea un usuario administrador demo (admin / admin123).'

    def handle(self, *args, **options):
        User = get_user_model()
        usuario, creado = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@taller-clima.local',
                'is_staff': True,
                'is_superuser': True,
            },
        )
        if creado:
            usuario.set_password('admin123')
            usuario.save()
            self.stdout.write(self.style.SUCCESS(
                'Superusuario "admin" creado con clave "admin123".'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                'El usuario "admin" ya existe. No se modificó.'
            ))
