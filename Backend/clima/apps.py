from django.apps import AppConfig


class ClimaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'clima'
    verbose_name = 'Histórico meteorológico (Open-Meteo)'
