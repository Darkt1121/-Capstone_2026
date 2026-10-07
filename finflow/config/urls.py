from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from core import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', auth_views.LoginView.as_view(), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('', views.inicio, name='inicio'),
    path('movimientos/', views.movimientos, name='movimientos'),
    path('calendario/', views.calendario, name='calendario'),
    path('dia/<str:fecha>/', views.dia, name='dia'),
    path('configuracion/', views.configuracion, name='configuracion'),
]
