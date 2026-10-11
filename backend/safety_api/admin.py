
from django.contrib import admin
from .models import Chemical, SDSDocument


@admin.register(Chemical)
class ChemicalAdmin(admin.ModelAdmin):
    list_display = ("name", "manufacturer", "location", "created_at")
    search_fields = ("name", "manufacturer", "location")


@admin.register(SDSDocument)
class SDSDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "chemical",
        "revision_date",
        "next_review_date",
    )
    list_filter = ("next_review_date",)
    search_fields = ("title", "chemical__name")
