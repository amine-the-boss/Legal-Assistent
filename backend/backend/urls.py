#backend/urls.py
from django.contrib import admin
from django.urls import path, include
from .views import api_root

urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/', include('legal_assistant.urls')),
]