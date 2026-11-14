"""Comando de gestión para descargar histórico de Open-Meteo.

Uso:
    python manage.py descargar_clima --cantidad-anios 2
    python manage.py descargar_clima --ciudades 1 2 --desde 2023-01-01 --hasta 2023-12-31
    python manage.py descargar_clima --sembrar-ciudades

Sin --ciudades, descarga para todas las ciudades registradas. Si no hay
ninguna, --sembrar-ciudades crea un conjunto inicial de 50 ciudades
distribuidas en los cinco continentes (Colombia, América Latina, Norteamérica,
Europa, Asia, África y Oceanía). Cada ciudad × 2 años ≈ 36 500 mediciones.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError

from clima.fuente_open_meteo import descargar_mediciones
from clima.models import Ciudad


# 50 ciudades de los 5 continentes. Formato: (nombre, país, lat, lon, altitud).
# Suficientes para llenar miles de registros y servir al comparador.
CIUDADES_SEMILLA = [
    # --- Colombia (6) ---
    ('Bogotá', 'Colombia', 4.711, -74.072, 2640),
    ('Medellín', 'Colombia', 6.244, -75.581, 1495),
    ('Cali', 'Colombia', 3.451, -76.532, 1018),
    ('Barranquilla', 'Colombia', 10.968, -74.781, 18),
    ('Bucaramanga', 'Colombia', 7.119, -73.1227, 959),
    ('Pereira', 'Colombia', 4.813, -75.696, 1411),
    # --- América Latina (11) ---
    ('Quito', 'Ecuador', -0.180, -78.468, 2850),
    ('Lima', 'Perú', -12.046, -77.043, 154),
    ('Buenos Aires', 'Argentina', -34.603, -58.381, 25),
    ('Santiago', 'Chile', -33.448, -70.669, 570),
    ('Montevideo', 'Uruguay', -34.901, -56.164, 32),
    ('Asunción', 'Paraguay', -25.263, -57.575, 117),
    ('La Paz', 'Bolivia', -16.489, -68.119, 3640),
    ('Caracas', 'Venezuela', 10.480, -66.903, 900),
    ('Ciudad de México', 'México', 19.432, -99.133, 2240),
    ('San José', 'Costa Rica', 9.928, -84.090, 1170),
    ('Ciudad de Panamá', 'Panamá', 8.982, -79.519, 17),
    # --- Caribe (1) ---
    ('La Habana', 'Cuba', 23.113, -82.366, 59),
    # --- Norteamérica (4) ---
    ('Washington D.C.', 'EE.UU.', 38.907, -77.036, 23),
    ('Nueva York', 'EE.UU.', 40.712, -74.006, 10),
    ('Los Ángeles', 'EE.UU.', 34.052, -118.243, 89),
    ('Toronto', 'Canadá', 43.653, -79.383, 76),
    # --- Brasil (2) ---
    ('Brasilia', 'Brasil', -15.793, -47.882, 1170),
    ('Río de Janeiro', 'Brasil', -22.906, -43.172, 5),
    # --- Europa (11) ---
    ('Madrid', 'España', 40.416, -3.703, 667),
    ('París', 'Francia', 48.856, 2.352, 35),
    ('Londres', 'Reino Unido', 51.507, -0.127, 11),
    ('Berlín', 'Alemania', 52.520, 13.405, 34),
    ('Roma', 'Italia', 41.902, 12.496, 21),
    ('Lisboa', 'Portugal', 38.722, -9.139, 100),
    ('Ámsterdam', 'Países Bajos', 52.367, 4.904, 2),
    ('Atenas', 'Grecia', 37.983, 23.727, 70),
    ('Estocolmo', 'Suecia', 59.329, 18.068, 28),
    ('Moscú', 'Rusia', 55.755, 37.617, 144),
    ('Estambul', 'Turquía', 41.008, 28.978, 39),
    # --- Asia (8) ---
    ('Tokio', 'Japón', 35.689, 139.691, 40),
    ('Pekín', 'China', 39.904, 116.407, 43),
    ('Seúl', 'Corea del Sur', 37.566, 126.978, 38),
    ('Nueva Delhi', 'India', 28.613, 77.209, 216),
    ('Bangkok', 'Tailandia', 13.756, 100.501, 1),
    ('Singapur', 'Singapur', 1.352, 103.819, 15),
    ('Yakarta', 'Indonesia', -6.208, 106.845, 8),
    ('Manila', 'Filipinas', 14.599, 120.984, 16),
    # --- África (5) ---
    ('El Cairo', 'Egipto', 30.044, 31.235, 23),
    ('Lagos', 'Nigeria', 6.524, 3.379, 41),
    ('Nairobi', 'Kenia', -1.292, 36.821, 1795),
    ('Johannesburgo', 'Sudáfrica', -26.204, 28.047, 1753),
    ('Casablanca', 'Marruecos', 33.573, -7.589, 79),
    # --- Oceanía (2) ---
    ('Sídney', 'Australia', -33.868, 151.207, 58),
    ('Auckland', 'Nueva Zelanda', -36.848, 174.763, 196),
]


class Command(BaseCommand):
    help = (
        'Descarga mediciones reales del histórico de Open-Meteo y las guarda '
        'en bloque con bulk_create (sin duplicar).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--cantidad-anios',
            type=int,
            default=2,
            help='Años hacia atrás desde hoy (por defecto 2).',
        )
        parser.add_argument(
            '--desde',
            type=str,
            help='Fecha de inicio YYYY-MM-DD (sobreescribe --cantidad-anios).',
        )
        parser.add_argument(
            '--hasta',
            type=str,
            help='Fecha de fin YYYY-MM-DD (por defecto hoy).',
        )
        parser.add_argument(
            '--ciudades',
            nargs='+',
            type=int,
            help='IDs de ciudades a descargar (por defecto todas).',
        )
        parser.add_argument(
            '--sembrar-ciudades',
            action='store_true',
            help='Crea un conjunto inicial de ciudades si la tabla está vacía.',
        )

    def handle(self, *args, **options):
        if options['sembrar_ciudades'] and not Ciudad.objects.exists():
            self.stdout.write(self.style.WARNING('Sembrando ciudades iniciales...'))
            creadas = []
            for nombre, pais, lat, lon, alt in CIUDADES_SEMILLA:
                ciudad, was_created = Ciudad.objects.get_or_create(
                    latitud=lat,
                    longitud=lon,
                    defaults={'nombre': nombre, 'pais': pais, 'altitud': alt},
                )
                creadas.append(ciudad)
                self.stdout.write(f'  - {ciudad}')

        qs = Ciudad.objects.all()
        if options['ciudades']:
            qs = qs.filter(id__in=options['ciudades'])
        ciudades = list(qs)

        if not ciudades:
            raise CommandError(
                'No hay ciudades registradas. Ejecuta con --sembrar-ciudades.'
            )

        if options['desde']:
            fecha_inicio = date.fromisoformat(options['desde'])
        else:
            fecha_inicio = date.today() - timedelta(days=365 * options['cantidad_anios'])
        fecha_fin = date.fromisoformat(options['hasta']) if options['hasta'] else date.today()

        self.stdout.write(self.style.NOTICE(
            f'Descargando {ciudades.__len__()} ciudad(es) · '
            f'{fecha_inicio} a {fecha_fin}'
        ))

        try:
            informe = descargar_mediciones(ciudades, fecha_inicio, fecha_fin)
        except Exception as error:
            raise CommandError(f'No se pudo descargar de Open-Meteo: {error}')

        self.stdout.write(self.style.SUCCESS(
            f'Filas recibidas desde Open-Meteo: {informe["filas_recibidas"]:,}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Mediciones nuevas guardadas: {informe["creadas"]:,}'
        ))
        self.stdout.write(self.style.WARNING(
            f'Filas omitidas o duplicadas: {informe["filas_omitidas_o_duplicadas"]:,}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'Total de mediciones en PostgreSQL: {informe["total_mediciones"]:,}'
        ))
        self.stdout.write(f'Tiempo: {informe["ms"] / 1000:.1f} segundos')
