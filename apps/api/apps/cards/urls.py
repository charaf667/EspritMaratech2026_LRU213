from django.urls import path

from . import views

urlpatterns = [
    path("feeling/redeem/", views.redeem_view, name="feeling-redeem"),
    path("feeling/card/<str:token>/", views.card_detail_view, name="feeling-card"),
]
