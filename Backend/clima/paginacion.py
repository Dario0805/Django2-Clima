from rest_framework.pagination import PageNumberPagination


class PaginacionMediciones(PageNumberPagination):
    """Paginación global de la API.

    El panel de React recorre los miles de mediciones con tiempos de
    respuesta inmediatos: el servidor entrega 50 filas por página y permite
    ajustar el tamaño con ?page_size=.
    """

    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 500
