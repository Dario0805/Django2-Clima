"""Configuración de Django para el proyecto de clima con Open-Meteo.

Lee las variables desde Backend/.env (python-dotenv). En producción Render
inyecta DATABASE_URL y las demás variables directamente.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Carga las variables guardadas en Backend/.env (si existe).
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-cambia-esta-clave-en-produccion')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
# El admin en https exige confianza explícita del origen (protección CSRF de Django).
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',  # Tokens de acceso (tabla authtoken_token).
    'corsheaders',
    'clima',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Sirve estáticos en producción.
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS: autorizamos los dos orígenes del servidor de desarrollo de Vite.
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'static_frontend'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# DB_NAME, DB_USER, DB_PASSWORD, DB_HOST y DB_PORT vienen de Backend/.env.
# En Render (producción) se define DATABASE_URL automáticamente.
if os.getenv('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.parse(os.environ['DATABASE_URL'], conn_max_age=600),
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'taller_clima'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', '123'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


LANGUAGE_CODE = 'es'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True


STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static_frontend']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# En producción, WhiteNoise comprime y sirve versiones con hash.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Paginación global y autenticación por token en la API REST.
# El panel espera {count, next, previous, results} y permite ?page_size=.
# La llave viaja en el encabezado Authorization: Token <token>.
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'clima.paginacion.PaginacionMediciones',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Límite opcional para la API de Open-Meteo (10 000 llamadas/día sin clave).
OPEN_METEO_BASE_HISTORICO = os.getenv(
    'OPEN_METEO_BASE_HISTORICO',
    'https://archive-api.open-meteo.com/v1/archive',
)
OPEN_METEO_BASE_PRONOSTICO = os.getenv(
    'OPEN_METEO_BASE_PRONOSTICO',
    'https://api.open-meteo.com/v1/forecast',
)
